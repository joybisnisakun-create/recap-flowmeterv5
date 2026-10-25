import React from 'react';
import { GroupAnalysis, AppConfig } from '../types';
import * as FM from '../lib/fm';
import { N, P, DL, Pill, FlagPills, KPI, Panel } from '../lib/format';
import { LineChart } from './Charts';

export const CustomerModal: React.FC<{
  g: GroupAnalysis;
  cfg: AppConfig;
  months: string[];
  fmonths: string[];
  refMonth: string;
  year: number;
  ytdIdx: number[];
  onClose: () => void;
}> = ({ g, cfg, months, fmonths, refMonth, year, ytdIdx, onClose }) => {
  const n = months.length;
  const hz = fmonths.length;

  const refs = g.contract
    ? [
        {
          y: (g.contract.c * cfg.batas_atas) / 100,
          label: `Maks ${cfg.batas_atas}%`,
          color: 'var(--critical)'
        },
        {
          y: (g.contract.c * cfg.batas_bawah) / 100,
          label: `Min ${cfg.batas_bawah}%`,
          color: 'var(--serious)',
          below: true
        }
      ]
    : [];

  const nulls = (k: number) => {
    const a: (number | null)[] = [];
    for (let i = 0; i < k; i++) a.push(null);
    return a;
  };

  const lineLabels = months.concat(fmonths).map(FM.ymShort);
  const actualSeriesData = g.nums.concat(nulls(hz));
  const fcSeriesData = nulls(n - 1)
    .concat([g.nums[n - 1]])
    .concat(g.fc.fc);
  const loSeriesData = nulls(n - 1)
    .concat([g.nums[n - 1]])
    .concat(g.fc.lo);
  const hiSeriesData = nulls(n - 1)
    .concat([g.nums[n - 1]])
    .concat(g.fc.hi);

  return (
    <div
      className="dialog-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12
      }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="dlg"
        style={{
          background: 'var(--bg)',
          color: 'var(--fg)',
          border: '1px solid var(--line)',
          borderRadius: 10,
          width: 'min(980px, calc(100vw - 24px))',
          maxHeight: 'calc(100vh - 24px)',
          overflowY: 'auto',
          padding: 18,
          boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
        }}
      >
        {/* Header */}
        <div className="dlg-h">
          <div>
            <h2>{g.name}</h2>
            <p>
              {g.zona}
              {g.kode ? ` · kode pelanggan ${g.kode}` : ''} · {g.nFm} flowmeter{' '}
              {g.flags.length > 0 && <FlagPills flags={g.flags} />}
            </p>
          </div>
          <button className="btn" onClick={onClose} aria-label="Tutup">
            Tutup
          </button>
        </div>

        {/* 4 KPIs */}
        <div className="kpis">
          <KPI
            label={`Pemakaian ${FM.ymShort(refMonth)}`}
            value={N(g.vR)}
            unit="m³"
            sub={
              <>
                MoM {DL(g.mom)}
                <br />
                YoY {g.yoy != null ? DL(g.yoy) : <span className="muted">–</span>}
              </>
            }
          />
          <KPI
            label={`Kumulatif ${year}`}
            value={N(g.ytd)}
            unit="m³"
            sub={`Rata-rata ${N(g.avg)} m³/bln`}
          />
          {g.contract ? (
            <KPI
              label="Kontrak"
              value={N(g.contract.c)}
              unit="m³/bln"
              sub={
                <>
                  Min {N((g.contract.c * cfg.batas_bawah) / 100)} · Maks{' '}
                  {N((g.contract.c * cfg.batas_atas) / 100)}
                  {g.contract.src === 'kumulatif' && g.nFm > 1 ? (
                    <>
                      <br />
                      Kontrak kumulatif {g.nFm} FM
                    </>
                  ) : null}
                  <br />
                  <span style={{ marginRight: 6 }}>% kontrak {FM.ymShort(refMonth)}:</span>
                  <b>{P(g.ratio !== null ? g.ratio * 100 : null)}</b>{' '}
                  <Pill status={g.st} />
                </>
              }
            />
          ) : (
            <KPI label="Kontrak" value="–" sub="Belum diisi" />
          )}
          <KPI
            label={`Proyeksi ${FM.ymShort(fmonths[0])}`}
            value={N(g.fc.fc[0])}
            unit="m³"
            sub={
              <>
                {g.fc.method}
                {g.fc.wape != null ? (
                  <>
                    <br />
                    WAPE {P(g.fc.wape * 100)}
                  </>
                ) : null}
              </>
            }
          />
        </div>

        {/* Chart */}
        <Panel
          title="Pemakaian dan proyeksi"
          sub={`Garis putus-putus = proyeksi (${g.fc.method})${
            g.contract ? '; garis merah dan oranye = batas maksimum dan minimum kontrak' : ''
          }`}
        >
          <LineChart
            labels={lineLabels}
            series={[
              { name: 'Aktual', color: 'var(--s1)', data: actualSeriesData },
              {
                name: 'Proyeksi',
                color: 'var(--s2)',
                dash: true,
                markFrom: n,
                data: fcSeriesData,
                lo: loSeriesData,
                hi: hiSeriesData
              }
            ]}
            refLines={refs}
            forecastFrom={n}
            height={280}
            aria={`Pemakaian dan proyeksi ${g.name}`}
          />
        </Panel>

        {/* Breakdown Tables */}
        <div className="grid2">
          {/* Monthly Breakdown */}
          <Panel title="Rincian bulanan">
            <div className="scroll tall" style={{ maxHeight: 300 }}>
              <table>
                <thead>
                  <tr>
                    <th>Bulan</th>
                    <th className="n">Pemakaian</th>
                    <th className="n">MoM</th>
                    {g.contract && (
                      <>
                        <th className="n">% kontrak</th>
                        <th>Status</th>
                        <th className="n">Selisih ke batas</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {months.map((m, i) => {
                    const mm =
                      i > 0
                        ? g.nums[i - 1]
                          ? ((g.nums[i] - g.nums[i - 1]) / g.nums[i - 1]) * 100
                          : null
                        : null;
                    const s = g.mStat[i];
                    return (
                      <tr key={m}>
                        <td>{FM.ymFull(m)}</td>
                        <td className="n">{N(g.nums[i])}</td>
                        <td className="n">{DL(mm)}</td>
                        {g.contract && (
                          <>
                            {s ? (
                              <>
                                <td className="n">{P(s.r * 100)}</td>
                                <td>
                                  <Pill status={s.st} />
                                </td>
                                <td className="n">
                                  {s.ex ? (
                                    <span style={{ color: 'var(--critical-tx)' }}>+{N(s.ex)}</span>
                                  ) : s.sh ? (
                                    <span style={{ color: 'var(--serious-tx)' }}>−{N(s.sh)}</span>
                                  ) : (
                                    <span className="muted">–</span>
                                  )}
                                </td>
                              </>
                            ) : (
                              <>
                                <td />
                                <td />
                                <td />
                              </>
                            )}
                          </>
                        )}
                      </tr>
                    );
                  })}
                  {/* Forecast Rows */}
                  {g.fc.fc.map((v, i) => {
                    const c = g.contract;
                    const st = g.fStat[i];
                    return (
                      <tr key={fmonths[i]} className="sub-row">
                        <td>{FM.ymFull(fmonths[i])} (proyeksi)</td>
                        <td className="n">{N(v)}</td>
                        <td className="n">
                          {N(g.fc.lo[i])} – {N(g.fc.hi[i])}
                        </td>
                        {c && (
                          <>
                            <td className="n">{P((v / c.c) * 100)}</td>
                            <td>
                              <Pill status={st} />
                            </td>
                            <td />
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          {/* Flowmeters */}
          <Panel title="Flowmeter">
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>Flowmeter</th>
                    <th className="n">{FM.ymShort(refMonth)}</th>
                    <th className="n">Pangsa</th>
                    <th className="n">YTD</th>
                    {g.contract && Object.keys(g.contract.fm).length > 0 && (
                      <>
                        <th className="n">Kontrak FM</th>
                        <th className="n">% kontrak</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {g.g.fms.map(f => {
                    const v = f.v[refMonth] || 0;
                    const y = ytdIdx.reduce(
                      (acc, i) => acc + (f.v[months[i]] || 0),
                      0
                    );
                    const fc = g.contract?.fm[f.id];
                    return (
                      <tr key={f.id}>
                        <td>
                          {f.id} · {f.nama}
                        </td>
                        <td className="n">{N(v)}</td>
                        <td className="n">{P(g.vR ? (v / g.vR) * 100 : 0)}</td>
                        <td className="n">{N(y)}</td>
                        {g.contract && Object.keys(g.contract.fm).length > 0 && (
                          <>
                            <td className="n">{fc ? N(fc) : '–'}</td>
                            <td className="n">{fc ? P((v / fc) * 100) : '–'}</td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
};
