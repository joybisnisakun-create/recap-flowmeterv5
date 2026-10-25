import React, { useRef, useState, useEffect } from 'react';

const compact = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 });
const full = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

function esc(s: any): string {
  return String(s ?? '');
}

function trunc(s: any, n: number): string {
  const str = String(s ?? '');
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}

function niceTicks(min: number, max: number, n: number): number[] {
  if (!(max > min)) max = min + 1;
  const span = max - min;
  const step0 = Math.pow(10, Math.floor(Math.log10(span / n)));
  const err = span / n / step0;
  let step = step0;
  if (err >= 7.5) step *= 10;
  else if (err >= 3.5) step *= 5;
  else if (err >= 1.5) step *= 2;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const t: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) t.push(+v.toFixed(10));
  return t;
}

export interface LineSeries {
  name: string;
  color: string;
  data: (number | null)[];
  lo?: (number | null)[];
  hi?: (number | null)[];
  dash?: boolean;
  width?: number;
  noMarkers?: boolean;
  markFrom?: number;
  hideTip?: boolean;
  hideLegend?: boolean;
  tipFmt?: (v: number) => string;
}

export interface RefLine {
  y: number;
  label: string;
  color?: string;
  below?: boolean;
}

export const LineChart: React.FC<{
  labels: string[];
  series: LineSeries[];
  height?: number;
  mLeft?: number;
  yMin?: number;
  yMax?: number;
  forecastFrom?: number;
  refLines?: RefLine[];
  yFmt?: (v: number) => string;
  tipFmt?: (v: number) => string;
  tipTitle?: (k: number) => string;
  tipExtra?: (k: number) => React.ReactNode;
  legendExtra?: string[];
  aria?: string;
}> = ({
  labels,
  series,
  height = 280,
  mLeft = 54,
  yMin: propYMin,
  yMax: propYMax,
  forecastFrom,
  refLines = [],
  yFmt = v => compact.format(v),
  tipFmt = v => full.format(v),
  tipTitle,
  tipExtra,
  legendExtra = [],
  aria = 'Grafik garis'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.contentRect.width > 200) {
          setWidth(entry.contentRect.width);
        }
      }
    });
    ro.observe(containerRef.current);
    setWidth(containerRef.current.clientWidth || 600);
    return () => ro.disconnect();
  }, []);

  const n = labels.length;
  const m = { l: mLeft, r: 16, t: 14, b: 30 };
  const iw = Math.max(10, width - m.l - m.r);
  const ih = Math.max(10, height - m.t - m.b);

  const vals: number[] = [];
  series.forEach(s => {
    s.data.forEach(v => { if (v != null) vals.push(v); });
    (s.lo || []).forEach(v => { if (v != null) vals.push(v); });
    (s.hi || []).forEach(v => { if (v != null) vals.push(v); });
  });
  refLines.forEach(r => vals.push(r.y));

  let minVal = propYMin != null ? propYMin : (vals.length ? Math.min(0, ...vals) : 0);
  let maxVal = propYMax != null ? propYMax : (vals.length ? Math.max(...vals) : 1);
  if (!isFinite(minVal)) minVal = 0;
  if (!isFinite(maxVal)) maxVal = 1;

  const ticks = niceTicks(minVal, maxVal, 5);
  const ymin = propYMin != null ? propYMin : ticks[0];
  const ymax = propYMax != null ? propYMax : ticks[ticks.length - 1];

  const X = (k: number) => m.l + (k + 0.5) * (iw / n);
  const Y = (v: number) => m.t + ih - ((v - ymin) / (ymax - ymin || 1)) * ih;

  const handleMouseMove = (e: React.MouseEvent<SVGRectElement>) => {
    const svg = e.currentTarget.ownerSVGElement;
    if (svg && svg.createSVGPoint) {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (ctm) {
        const p = pt.matrixTransform(ctm.inverse());
        const step = iw / n;
        const k = Math.max(0, Math.min(n - 1, Math.floor((p.x - m.l) / step)));
        setHoverIndex(k);
        setMousePos({ x: X(k), y: Math.max(m.t, Math.min(m.t + ih, p.y)) });
        return;
      }
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const k = Math.max(0, Math.min(n - 1, Math.floor((cx / (rect.width || 1)) * n)));
    setHoverIndex(k);
    setMousePos({ x: X(k), y: e.clientY - rect.top });
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
    setMousePos(null);
  };

  const every = Math.ceil(n / Math.max(1, Math.floor(iw / 48)));

  return (
    <div ref={containerRef} className="chart">
      {/* Legend */}
      {(series.length > 1 || legendExtra.length > 0) && (
        <div className="legend">
          {series.filter(s => !s.hideLegend).map((s, idx) => (
            <span key={idx} className="lg">
              {s.dash ? (
                <span className="sw sw-dash" style={{ borderColor: s.color }} />
              ) : (
                <span className="sw" style={{ background: s.color }} />
              )}
              {s.name}
            </span>
          ))}
          {legendExtra.map((t, idx) => (
            <span key={idx} className="lg lg-note">{t}</span>
          ))}
        </div>
      )}

      {/* Plot */}
      <div className="plot" style={{ position: 'relative' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          role="img"
          aria-label={aria}
          style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
        >
          {/* Forecast background zone */}
          {forecastFrom != null && forecastFrom < n && (
            <g>
              <rect
                x={X(forecastFrom) - iw / n / 2}
                y={m.t}
                width={m.l + iw - (X(forecastFrom) - iw / n / 2)}
                height={ih}
                className="fc-zone"
              />
              <text x={X(forecastFrom) - iw / n / 2 + 6} y={m.t + 12} className="ax-t">
                Proyeksi
              </text>
            </g>
          )}

          {/* Grid lines and tick labels */}
          {ticks.map((t, idx) => {
            if (t < ymin - 1e-9 || t > ymax + 1e-9) return null;
            return (
              <g key={idx}>
                <line x1={m.l} x2={m.l + iw} y1={Y(t)} y2={Y(t)} className="grid" />
                <text x={m.l - 8} y={Y(t) + 4} textAnchor="end" className="ax-t">
                  {yFmt(t)}
                </text>
              </g>
            );
          })}

          {ymin < 0 && ymax > 0 && (
            <line x1={m.l} x2={m.l + iw} y1={Y(0)} y2={Y(0)} className="axis" />
          )}

          {/* X axis labels */}
          {labels.map((lab, i) => {
            if (i % every !== 0) return null;
            return (
              <text key={i} x={X(i)} y={height - 9} textAnchor="middle" className="ax-t">
                {lab}
              </text>
            );
          })}

          {/* Reference lines */}
          {refLines.map((r, idx) => (
            <g key={idx}>
              <line
                x1={m.l}
                x2={m.l + iw}
                y1={Y(r.y)}
                y2={Y(r.y)}
                className="ref"
                style={{ stroke: r.color || 'var(--muted)' }}
              />
              <text
                x={m.l + 6}
                y={Y(r.y) + (r.below ? 14 : -5)}
                textAnchor="start"
                className="ax-t ref-t"
              >
                {r.label}
              </text>
            </g>
          ))}

          {/* Series lines & confidence bands */}
          {series.map((s, idx) => {
            const hasBand = s.lo && s.hi;
            let upPoints: string[] = [];
            let dnPoints: string[] = [];
            if (hasBand) {
              for (let i = 0; i < n; i++) {
                if (s.lo![i] != null && s.hi![i] != null) {
                  upPoints.push(`${X(i)},${Y(s.hi![i]!)}`);
                  dnPoints.unshift(`${X(i)},${Y(s.lo![i]!)}`);
                }
              }
            }

            let pathD = '';
            let pen = false;
            for (let i = 0; i < n; i++) {
              const v = s.data[i];
              if (v == null) {
                pen = false;
                continue;
              }
              pathD += (pen ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(v).toFixed(1);
              pen = true;
            }

            let lastValid = -1;
            for (let i = 0; i < n; i++) {
              if (s.data[i] != null) lastValid = i;
            }

            return (
              <g key={idx}>
                {upPoints.length > 1 && (
                  <polygon
                    points={upPoints.concat(dnPoints).join(' ')}
                    style={{ fill: s.color, opacity: 0.16 }}
                    className="chart-poly-band"
                  />
                )}
                <path
                  d={pathD}
                  fill="none"
                  style={{ stroke: s.color }}
                  strokeWidth={s.width || 2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeDasharray={s.dash ? '6 4' : undefined}
                  className="chart-line-path"
                />
                {n <= 16 && !s.noMarkers &&
                  labels.map((_, i) => {
                    const v = s.data[i];
                    if (v == null || (s.markFrom != null && i < s.markFrom)) return null;
                    return (
                      <circle
                        key={i}
                        cx={X(i)}
                        cy={Y(v)}
                        r={i === lastValid ? 4.5 : 3}
                        style={{
                          fill: s.color,
                          cx: `${X(i).toFixed(1)}px`,
                          cy: `${Y(v).toFixed(1)}px`
                        }}
                        className="mk"
                      />
                    );
                  })}

                {/* Animated Pulsing Beacon at latest data point (in-place denyut pulse only) */}
                {lastValid >= 0 && s.data[lastValid] != null && !s.noMarkers && (
                  <g className="chart-beacon" key={`beacon-${idx}`}>
                    <circle
                      cx={X(lastValid)}
                      cy={Y(s.data[lastValid]!)}
                      r={4}
                      className="beacon-ring"
                      style={{
                        stroke: s.color,
                        cx: `${X(lastValid).toFixed(1)}px`,
                        cy: `${Y(s.data[lastValid]!).toFixed(1)}px`
                      }}
                    />
                    <circle
                      cx={X(lastValid)}
                      cy={Y(s.data[lastValid]!)}
                      r={4}
                      className="beacon-core"
                      style={{
                        fill: s.color,
                        cx: `${X(lastValid).toFixed(1)}px`,
                        cy: `${Y(s.data[lastValid]!).toFixed(1)}px`
                      }}
                    />
                  </g>
                )}
              </g>
            );
          })}

          {/* Crosshair indicator */}
          {hoverIndex !== null && (
            <line
              className="cross"
              x1={X(hoverIndex)}
              x2={X(hoverIndex)}
              y1={m.t}
              y2={m.t + ih}
            />
          )}

          {/* Hit area for mouse events */}
          <rect
            className="hit"
            x={m.l}
            y={m.t}
            width={iw}
            height={ih}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          />
        </svg>

        {/* Hover Tooltip */}
        {hoverIndex !== null && mousePos && (
          <div
            className="tip"
            style={{
              position: 'absolute',
              left: mousePos.x + 14 > width - 180 ? Math.max(4, mousePos.x - 170) : mousePos.x + 14,
              top: Math.max(2, mousePos.y - 40),
              pointerEvents: 'none'
            }}
          >
            <div className="tt-h">{tipTitle ? tipTitle(hoverIndex) : labels[hoverIndex]}</div>
            {series.map((s, idx) => {
              const val = s.data[hoverIndex];
              if (val == null || s.hideTip) return null;
              return (
                <div key={idx}>
                  <div className="tt-r">
                    <span className="sw" style={{ background: s.color }} />
                    <span className="tt-n">{s.name}</span>
                    <b>{(s.tipFmt || tipFmt)(val)}</b>
                  </div>
                  {s.lo && s.hi && s.lo[hoverIndex] != null && s.hi[hoverIndex] != null && (
                    <div className="tt-r tt-s">
                      <span className="tt-n">Rentang 80%</span>
                      <b>{tipFmt(s.lo[hoverIndex]!)} – {tipFmt(s.hi[hoverIndex]!)}</b>
                    </div>
                  )}
                </div>
              );
            })}
            {tipExtra && tipExtra(hoverIndex)}
          </div>
        )}
      </div>
    </div>
  );
};

export interface BarSeries {
  name: string;
  color: string;
  colors?: string[];
  colorFn?: (v: number, idx: number) => string;
  data: (number | null)[];
  hideTip?: boolean;
  tipFmt?: (v: number) => string;
}

export const BarChart: React.FC<{
  labels: string[];
  series: BarSeries[];
  height?: number;
  horizontal?: boolean;
  stacked?: boolean;
  mLeft?: number;
  maxLabel?: number;
  valueLabels?: boolean;
  refLines?: RefLine[];
  yFmt?: (v: number) => string;
  tipFmt?: (v: number) => string;
  labelFmt?: (v: number) => string;
  tipTitle?: (k: number) => string;
  tipExtra?: (k: number) => React.ReactNode;
  legendExtra?: string[];
  aria?: string;
}> = ({
  labels,
  series,
  height,
  horizontal = false,
  stacked = false,
  mLeft,
  maxLabel = 22,
  valueLabels = false,
  refLines = [],
  yFmt = v => compact.format(v),
  tipFmt = v => full.format(v),
  labelFmt,
  tipTitle,
  tipExtra,
  legendExtra = [],
  aria = 'Grafik batang'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.contentRect.width > 200) {
          setWidth(entry.contentRect.width);
        }
      }
    });
    ro.observe(containerRef.current);
    setWidth(containerRef.current.clientWidth || 600);
    return () => ro.disconnect();
  }, []);

  const n = labels.length;
  const ns = series.length;
  const labW = horizontal
    ? Math.min(Math.max(...labels.map(l => trunc(l, maxLabel).length), 4) * 6.4 + 12, width * 0.42)
    : 0;
  const H = height || (horizontal ? Math.max(160, n * 26 + 40) : 280);
  const m = horizontal
    ? { l: labW, r: valueLabels ? 64 : 16, t: 8, b: 26 }
    : { l: mLeft || 54, r: 14, t: 14, b: 30 };
  const iw = Math.max(10, width - m.l - m.r);
  const ih = Math.max(10, H - m.t - m.b);

  let lo = 0;
  let hi = 0;
  for (let i = 0; i < n; i++) {
    let pos = 0;
    let neg = 0;
    for (let j = 0; j < ns; j++) {
      const v = series[j].data[i] || 0;
      if (stacked) {
        if (v >= 0) pos += v;
        else neg += v;
      } else {
        if (v > hi) hi = v;
        if (v < lo) lo = v;
      }
    }
    if (stacked) {
      if (pos > hi) hi = pos;
      if (neg < lo) lo = neg;
    }
  }
  refLines.forEach(r => {
    if (r.y > hi) hi = r.y;
  });

  const ticks = niceTicks(lo, hi || 1, horizontal ? 4 : 5);
  const vmin = ticks[0];
  const vmax = ticks[ticks.length - 1];

  const V = horizontal
    ? (v: number) => m.l + ((v - vmin) / (vmax - vmin || 1)) * iw
    : (v: number) => m.t + ih - ((v - vmin) / (vmax - vmin || 1)) * ih;

  const step = (horizontal ? ih : iw) / (n || 1);
  const bw = Math.min(stacked || ns === 1 ? step * 0.62 : (step * 0.74) / ns, horizontal ? 22 : 56);
  const every = horizontal ? 1 : Math.ceil(n / Math.max(1, Math.floor(iw / 44)));

  return (
    <div ref={containerRef} className="chart">
      {/* Legend */}
      {(series.length > 1 || legendExtra.length > 0) && (
        <div className="legend">
          {series.map((s, idx) => (
            <span key={idx} className="lg">
              <span className="sw" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
          {legendExtra.map((t, idx) => (
            <span key={idx} className="lg lg-note">{t}</span>
          ))}
        </div>
      )}

      {/* Plot */}
      <div className="plot" style={{ position: 'relative' }}>
        <svg
          viewBox={`0 0 ${width} ${H}`}
          width={width}
          height={H}
          role="img"
          aria-label={aria}
          style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
        >
          {/* Ticks and Grid */}
          {ticks.map((t, idx) => {
            if (horizontal) {
              return (
                <g key={idx}>
                  <line x1={V(t)} x2={V(t)} y1={m.t} y2={m.t + ih} className="grid" />
                  <text x={V(t)} y={H - 8} textAnchor="middle" className="ax-t">
                    {yFmt(t)}
                  </text>
                </g>
              );
            } else {
              return (
                <g key={idx}>
                  <line x1={m.l} x2={m.l + iw} y1={V(t)} y2={V(t)} className="grid" />
                  <text x={m.l - 8} y={V(t) + 4} textAnchor="end" className="ax-t">
                    {yFmt(t)}
                  </text>
                </g>
              );
            }
          })}

          {/* Zero axis */}
          {horizontal ? (
            <line x1={V(0)} x2={V(0)} y1={m.t} y2={m.t + ih} className="axis" />
          ) : (
            <line x1={m.l} x2={m.l + iw} y1={V(0)} y2={V(0)} className="axis" />
          )}

          {/* Reference lines */}
          {!horizontal &&
            refLines.map((r, idx) => (
              <line
                key={idx}
                x1={m.l}
                x2={m.l + iw}
                y1={V(r.y)}
                y2={V(r.y)}
                className="ref"
                style={{ stroke: r.color || 'var(--muted)' }}
              />
            ))}

          {/* Axis Labels */}
          {labels.map((lab, i) => {
            const c = (horizontal ? m.t : m.l) + (i + 0.5) * step;
            if (horizontal) {
              return (
                <text key={i} x={m.l - 8} y={c + 4} textAnchor="end" className="ax-t ax-lab">
                  {trunc(lab, maxLabel)}
                </text>
              );
            } else if (i % every === 0) {
              return (
                <text key={i} x={c} y={H - 9} textAnchor="middle" className="ax-t">
                  {lab}
                </text>
              );
            }
            return null;
          })}

          {/* Bars */}
          {labels.map((_, i) => {
            const cpos = (horizontal ? m.t : m.l) + (i + 0.5) * step;
            let accP = 0;
            let accN = 0;

            return (
              <g key={i}>
                {series.map((s, j) => {
                  const val = s.data[i];
                  if (val == null) return null;
                  const col = (s.colorFn ? s.colorFn(val, i) : null) || (s.colors && s.colors[i]) || s.color;
                  let a = 0;
                  let b = val;
                  if (stacked) {
                    if (val >= 0) {
                      a = accP;
                      accP += val;
                      b = accP;
                    } else {
                      a = accN;
                      accN += val;
                      b = accN;
                    }
                  }
                  const off = stacked ? -bw / 2 : (j - (ns - 1) / 2) * (bw + 2) - bw / 2;
                  const p1 = V(a);
                  const p2 = V(b);
                  const x = horizontal ? Math.min(p1, p2) : cpos + off;
                  const y = horizontal ? cpos + off : Math.min(p1, p2);
                  const rw = horizontal ? Math.max(0.5, Math.abs(p2 - p1)) : bw;
                  const rh = horizontal ? bw : Math.max(0.5, Math.abs(p2 - p1));

                  const valText = (labelFmt || tipFmt)(val);

                  return (
                    <g key={j}>
                      <rect
                        x={x.toFixed(1)}
                        y={y.toFixed(1)}
                        width={rw.toFixed(1)}
                        height={rh.toFixed(1)}
                        rx={stacked ? 0 : 3}
                        className="barr"
                        style={{
                          fill: col,
                          x: `${x.toFixed(1)}px`,
                          y: `${y.toFixed(1)}px`,
                          width: `${rw.toFixed(1)}px`,
                          height: `${rh.toFixed(1)}px`
                        }}
                      />
                      {valueLabels && !stacked && ns === 1 && (
                        <text
                          x={
                            horizontal
                              ? V(val >= 0 ? val : 0) + (val >= 0 ? 6 : -6)
                              : cpos
                          }
                          y={horizontal ? cpos + 4 : val >= 0 ? V(val) - 6 : V(val) + 14}
                          textAnchor={horizontal ? (val >= 0 ? 'start' : 'end') : 'middle'}
                          className="val-t"
                          style={{
                            x: `${(horizontal ? V(val >= 0 ? val : 0) + (val >= 0 ? 6 : -6) : cpos).toFixed(1)}px`,
                            y: `${(horizontal ? cpos + 4 : val >= 0 ? V(val) - 6 : V(val) + 14).toFixed(1)}px`
                          }}
                        >
                          {valText}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Hover overlay rect */}
                <rect
                  className="cat"
                  x={horizontal ? m.l : m.l + i * step}
                  y={horizontal ? m.t + i * step : m.t}
                  width={horizontal ? iw : step}
                  height={horizontal ? step : ih}
                  onMouseMove={e => {
                    const svg = e.currentTarget.ownerSVGElement;
                    if (svg && svg.createSVGPoint) {
                      const pt = svg.createSVGPoint();
                      pt.x = e.clientX;
                      pt.y = e.clientY;
                      const ctm = svg.getScreenCTM();
                      if (ctm) {
                        const p = pt.matrixTransform(ctm.inverse());
                        setMousePos({ x: p.x, y: p.y });
                        setHoverIndex(i);
                        return;
                      }
                    }
                    const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                    if (rect) {
                      setMousePos({
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top
                      });
                    }
                    setHoverIndex(i);
                  }}
                  onMouseLeave={() => {
                    setHoverIndex(null);
                    setMousePos(null);
                  }}
                />
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip */}
        {hoverIndex !== null && mousePos && (
          <div
            className="tip"
            style={{
              position: 'absolute',
              left: mousePos.x + 14 > width - 180 ? Math.max(4, mousePos.x - 170) : mousePos.x + 14,
              top: Math.max(2, mousePos.y - 30),
              pointerEvents: 'none'
            }}
          >
            <div className="tt-h">{tipTitle ? tipTitle(hoverIndex) : labels[hoverIndex]}</div>
            {series.map((s, idx) => {
              const val = s.data[hoverIndex];
              if (val == null || s.hideTip) return null;
              const col = (s.colorFn ? s.colorFn(val, hoverIndex) : null) || (s.colors && s.colors[hoverIndex]) || s.color;
              return (
                <div key={idx} className="tt-r">
                  <span className="sw" style={{ background: col }} />
                  <span className="tt-n">{s.name}</span>
                  <b>{(s.tipFmt || tipFmt)(val)}</b>
                </div>
              );
            })}
            {stacked && ns > 1 && (
              <div className="tt-r tt-tot">
                <span className="tt-n">Total</span>
                <b>
                  {tipFmt(
                    series.reduce((sum, s) => sum + (s.data[hoverIndex] || 0), 0)
                  )}
                </b>
              </div>
            )}
            {tipExtra && tipExtra(hoverIndex)}
          </div>
        )}
      </div>
    </div>
  );
};

export const Sparkline: React.FC<{
  values: number[];
  width?: number;
  height?: number;
}> = ({ values, width = 84, height = 22 }) => {
  if (!values || values.length < 2) return null;
  const mx = Math.max(...values);
  const mn = Math.min(...values);
  const rg = mx - mn || 1;
  const pts = values.map((y, i) => {
    const px = (i / (values.length - 1)) * (width - 8) + 4;
    const py = height - 4 - ((y - mn) / rg) * (height - 8);
    return `${px.toFixed(1)},${py.toFixed(1)}`;
  });
  const lastParts = pts[pts.length - 1].split(',');

  return (
    <svg
      className="spark"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      style={{ display: 'inline-block', verticalAlign: 'middle', overflow: 'visible' }}
    >
      <polyline
        points={pts.join(' ')}
        fill="none"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastParts[0]} cy={lastParts[1]} r="4.5" className="spark-ping" />
      <circle cx={lastParts[0]} cy={lastParts[1]} r="2.5" className="spark-core" />
    </svg>
  );
};

export interface ScatterPoint {
  x: number;
  y: number;
  c?: string;
  t?: string;
}

export const ScatterPlot: React.FC<{
  points: ScatterPoint[];
  height?: number;
  xLabel?: string;
  yLabel?: string;
  aria?: string;
}> = ({
  points,
  height = 340,
  xLabel = '',
  yLabel = '',
  aria = 'Diagram sebaran'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.contentRect.width > 200) {
          setWidth(entry.contentRect.width);
        }
      }
    });
    ro.observe(containerRef.current);
    setWidth(containerRef.current.clientWidth || 600);
    return () => ro.disconnect();
  }, []);

  const pts = points.filter(p => p.x > 0 && p.y > 0);
  const m = { l: 56, r: 14, t: 12, b: 40 };
  const iw = Math.max(10, width - m.l - m.r);
  const ih = Math.max(10, height - m.t - m.b);

  const lo = pts.length ? Math.min(...pts.map(p => Math.min(p.x, p.y))) : 1;
  const hi = pts.length ? Math.max(...pts.map(p => Math.max(p.x, p.y))) : 10;
  let a = Math.floor(Math.log10(Math.max(lo, 1)));
  let b = Math.ceil(Math.log10(hi));
  if (b <= a) b = a + 1;

  const X = (v: number) => m.l + ((Math.log10(v) - a) / (b - a)) * iw;
  const Y = (v: number) => m.t + ih - ((Math.log10(v) - a) / (b - a)) * ih;

  const ticks: number[] = [];
  for (let k = a; k <= b; k++) ticks.push(k);

  return (
    <div ref={containerRef} className="chart">
      <div className="plot">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={aria}
          style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
        >
          {ticks.map(k => {
            const t = Math.pow(10, k);
            return (
              <g key={k}>
                <line x1={m.l} x2={m.l + iw} y1={Y(t)} y2={Y(t)} stroke="var(--grid)" />
                <text x={m.l - 6} y={Y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
                  {compact.format(t)}
                </text>
                <text x={X(t)} y={height - 22} textAnchor="middle" fontSize="11" fill="var(--muted)">
                  {compact.format(t)}
                </text>
              </g>
            );
          })}
          {/* Diagonal 1:1 line */}
          <line
            x1={X(Math.pow(10, a))}
            y1={Y(Math.pow(10, a))}
            x2={X(Math.pow(10, b))}
            y2={Y(Math.pow(10, b))}
            stroke="var(--axis)"
            strokeDasharray="5 4"
          />
          {/* Points */}
          {pts.map((p, idx) => (
            <circle
              key={idx}
              cx={X(p.x).toFixed(1)}
              cy={Y(p.y).toFixed(1)}
              r="3.2"
              fill={p.c || 'var(--s1)'}
              fillOpacity={0.55}
            >
              <title>{`${p.t || ''} | bulanan ${full.format(p.x)} | mingguan ${full.format(p.y)}`}</title>
            </circle>
          ))}
          {/* Axis Titles */}
          <text x={m.l + iw / 2} y={height - 6} textAnchor="middle" fontSize="12" fill="var(--fg2)">
            {xLabel}
          </text>
          <text
            transform={`translate(13 ${m.t + ih / 2}) rotate(-90)`}
            textAnchor="middle"
            fontSize="12"
            fill="var(--fg2)"
          >
            {yLabel}
          </text>
        </svg>
      </div>
    </div>
  );
};
