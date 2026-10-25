import React from 'react';
import { AppConfig, ContractStatus } from '../types';
import * as FM from './fm';

export const nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
export const nf1 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
export const nf3 = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export function N(v: number | null | undefined): string {
  return v == null || !isFinite(v) ? '–' : nf.format(Math.round(v));
}

export function SG(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return '–';
  const r = Math.round(v);
  return (r > 0 ? '+' : r < 0 ? '−' : '') + nf.format(Math.abs(r));
}

export function P(v: number | null | undefined): string {
  return v == null || !isFinite(v) ? '–' : nf1.format(v) + '%';
}

export function DL(p: number | null | undefined): React.ReactNode {
  if (p == null || !isFinite(p)) return <span className="muted">–</span>;
  const c = p > 0.05 ? 'pos' : p < -0.05 ? 'neg' : '';
  return <span className={`delta ${c}`}>{nf1.format(Math.abs(p))}%</span>;
}

export function list(a: string[]): string {
  if (a.length < 2) return a.join('');
  return a.slice(0, -1).join(', ') + ' dan ' + a[a.length - 1];
}

export const ZONE_PALETTE = [
  'var(--s1)', // Blue (#2a78d6)
  'var(--s2)', // Orange (#eb6834)
  'var(--s3)', // Teal/Green (#1baf7a)
  'var(--s4)', // Amber/Gold (#eda100)
  'var(--s7)', // Purple/Indigo (#6250d6)
  'var(--s5)', // Magenta/Pink (#e87ba4)
  'var(--s8)', // Crimson/Red (#e34948)
  'var(--s6)', // Forest Green (#008300)
];

// Explicit mapping for known zone names in Cilegon / Serang / Banten distribution area
const KNOWN_ZONES: Record<string, number> = {
  'bojonegara': 0,
  'kramatwatu': 1,
  'mangunreja': 2,
  'merak': 3,
  'zona 1': 0,
  'zona 2': 1,
  'zona 3': 2,
  'zona 4': 3,
  'zona 5': 4,
};

export function zc(z: string | undefined | null, zonas?: string[]): string {
  if (!z) return ZONE_PALETTE[0];
  const zNorm = String(z).trim().toLowerCase();

  // 1. If zonas list is provided and does NOT look like months (e.g. YYYY-MM), find index
  if (Array.isArray(zonas) && zonas.length > 0 && !String(zonas[0]).match(/^\d{4}-\d{2}$/)) {
    const idx = zonas.findIndex(x => String(x).trim().toLowerCase() === zNorm);
    if (idx >= 0) {
      return ZONE_PALETTE[idx % ZONE_PALETTE.length];
    }
  }

  // 2. Check known zone names dictionary
  if (KNOWN_ZONES[zNorm] !== undefined) {
    return ZONE_PALETTE[KNOWN_ZONES[zNorm] % ZONE_PALETTE.length];
  }

  // 3. Extract any digit from zone name (e.g. "Zona 1", "Z-2", etc.)
  const match = zNorm.match(/(\d+)/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num) && num > 0) {
      return ZONE_PALETTE[(num - 1) % ZONE_PALETTE.length];
    }
  }

  // 4. Deterministic string hash fallback to ensure unique, consistent colors for any other zones
  let hash = 0;
  for (let i = 0; i < zNorm.length; i++) {
    hash = ((hash << 5) - hash + zNorm.charCodeAt(i)) | 0;
  }
  return ZONE_PALETTE[Math.abs(hash) % ZONE_PALETTE.length];
}

export const ST: Record<ContractStatus, string> = {
  above: 'Melebihi batas atas',
  below: 'Di bawah minimum',
  nearHigh: 'Mendekati batas atas',
  nearLow: 'Mendekati minimum',
  ok: 'Sesuai kontrak',
  none: 'Tanpa kontrak'
};

export const Pill: React.FC<{ status: ContractStatus }> = ({ status }) => {
  return <span className={`pill ${status}`}>{ST[status] || status}</span>;
};

export const FLAG_DEF: Record<string, [string, string]> = {
  naik: ['warn', 'Naik tajam'],
  turun: ['warn', 'Turun tajam'],
  nol: ['bad', 'Nol bulan ini'],
  diam: ['bad', 'Meter diam 3+ bulan'],
  baru: ['info', 'Baru aktif'],
  kosong: ['none', 'Belum ada pemakaian'],
  blank: ['warn', 'Ada data kosong']
};

export const FlagPills: React.FC<{ flags: string[] }> = ({ flags }) => {
  return (
    <>
      {flags.map((f, i) => {
        const item = FLAG_DEF[f];
        if (!item) return null;
        return (
          <span key={i} className={`pill ${item[0]}`} style={{ marginRight: 4 }}>
            {item[1]}
          </span>
        );
      })}
    </>
  );
};

export const WeeklyFlagPills: React.FC<{ flags: string[] }> = ({ flags }) => {
  const WFLAG: Record<string, [string, string]> = {
    naik: ['warn', 'Lonjakan'],
    turun: ['warn', 'Anjlok'],
    nol: ['bad', 'Nol minggu ini'],
    diam: ['bad', 'Meter diam 3+ minggu']
  };
  return (
    <>
      {flags.map((f, i) => {
        const item = WFLAG[f];
        if (!item) return null;
        return (
          <span key={i} className={`pill ${item[0]}`} style={{ marginRight: 4 }}>
            {item[1]}
          </span>
        );
      })}
    </>
  );
};

export const GradePill: React.FC<{ grade: string }> = ({ grade }) => {
  const GRADE: Record<string, [string, string]> = {
    selaras: ['ok', 'Selaras'],
    cukup: ['warn', 'Cukup'],
    selisih: ['bad', 'Selisih besar'],
    kosong: ['none', 'Tanpa data']
  };
  const item = GRADE[grade] || ['none', grade];
  return <span className={`pill ${item[0]}`}>{item[1]}</span>;
};

export const Gauge: React.FC<{ ratio: number | null; cfg: AppConfig }> = ({ ratio, cfg }) => {
  const lo = cfg.batas_bawah;
  const hi = cfg.batas_atas;
  const max = 160;
  const pos = Math.min(max, (ratio || 0) * 100) / max * 100;
  return (
    <span className="gauge" title={`Batas ${lo}–${hi}%`}>
      <span
        className="band"
        style={{ left: `${(lo / max) * 100}%`, width: `${((hi - lo) / max) * 100}%` }}
      />
      <span className="dot" style={{ left: `${pos}%` }} />
    </span>
  );
};

export const MonthStrip: React.FC<{
  g: any;
  year: number;
  months: string[];
}> = ({ g, year, months }) => {
  const cells: React.ReactNode[] = [];
  for (let m = 1; m <= 12; m++) {
    const ym = year + '-' + (m < 10 ? '0' : '') + m;
    const i = months.indexOf(ym);
    const s = i >= 0 ? g.mStat[i] : null;
    if (s) {
      cells.push(
        <span
          key={m}
          className={`mcell ${s.st}`}
          title={`${FM.ymShort(ym)}: ${N(g.nums[i])} m³ = ${P(s.r * 100)} kontrak`}
        >
          {Math.round(s.r * 100)}
        </span>
      );
    } else {
      cells.push(<span key={m} className="mcell">·</span>);
    }
  }
  return <>{cells}</>;
};

export const KPI: React.FC<{
  label: string;
  value: React.ReactNode;
  unit?: string;
  sub?: React.ReactNode;
}> = ({ label, value, unit, sub }) => (
  <div className="kpi">
    <div className="l">{label}</div>
    <div className="v">
      {value}
      {unit && <small>{unit}</small>}
    </div>
    {sub && <div className="s">{sub}</div>}
  </div>
);

export const Panel: React.FC<{
  title: string;
  sub?: string;
  children: React.ReactNode;
  id?: string;
}> = ({ title, sub, children, id }) => (
  <section className="panel" id={id}>
    <div>
      <h2>{title}</h2>
      {sub && <div className="sub">{sub}</div>}
    </div>
    {children}
  </section>
);
