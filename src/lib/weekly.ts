import * as FM from './fm';
import { AnalysisModel, WeeklyData, WeeklyAnalysis, WeeklyRow } from '../types';

const DAY = 864e5;

export function key(s: any): string {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function t(iso: string): number {
  return Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
}

export function iso(ms: number): string {
  const d = new Date(ms);
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
}

export function ymOf(ms: number): string {
  return iso(ms).slice(0, 7);
}

export function dim(ym: string): number {
  return new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate();
}

export function parseDate(h: any): string | null {
  const s = String(h || '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  m = s.match(/^(\d{1,2})[/.–-](\d{1,2})[/.–-](\d{4})$/);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return null;
}

export function fmtShort(d: string): string {
  return +d.slice(8, 10) + ' ' + (FM.BLN[+d.slice(5, 7) - 1] || '');
}

export function loadWeekly(text: string): WeeklyData {
  const all = FM.readCSV(text);
  const warn: string[] = [];
  if (all.length < 2) return { ok: false, error: 'File mingguan kosong.', warnings: warn, weeks: [], rows: [], future: 0 };
  const hd = all[0];
  let ig = -1;
  let inm = -1;
  const cols: { i: number; d: string }[] = [];

  hd.forEach((h, i) => {
    const n = key(h);
    if (n === 'group' || n === 'grup') ig = i;
    else if (n.indexOf('nama') === 0 || n.indexOf('customer') > -1 || n.indexOf('pelanggan') === 0) inm = inm < 0 ? i : inm;
    else {
      const d = parseDate(h);
      if (d) cols.push({ i, d });
    }
  });

  if (inm < 0 || !cols.length) return { ok: false, error: 'Kolom Nama Pelanggan atau kolom tanggal mingguan tidak terbaca.', warnings: warn, weeks: [], rows: [], future: 0 };
  cols.sort((a, b) => (a.d < b.d ? -1 : 1));

  const rows: WeeklyRow[] = [];
  let bad = 0;
  all.slice(1).forEach(c => {
    const nama = String(c[inm] || '').trim();
    if (!nama) return;
    const v = cols.map(cc => {
      let x = FM.parseNum(c[cc.i]);
      if (x !== null && isNaN(x)) {
        bad++;
        x = null;
      }
      return x;
    });
    rows.push({
      group: ig > -1 ? String(c[ig] || '').trim() : nama,
      nama,
      key: key(nama),
      v
    });
  });

  if (bad) warn.push(bad + ' sel mingguan bukan angka dan dianggap kosong.');
  let last = -1;
  cols.forEach((cc, i) => {
    if (rows.some(r => r.v[i] != null && (r.v[i] as number) > 0)) last = i;
  });

  if (last < 0) return { ok: false, error: 'Belum ada pemakaian mingguan.', warnings: warn, weeks: [], rows: [], future: 0 };
  const weeks = cols.slice(0, last + 1).map(x => x.d);
  rows.forEach(r => {
    r.v = r.v.slice(0, last + 1);
  });

  return { ok: true, weeks, rows, warnings: warn, future: cols.length - weeks.length };
}

export function toMonthly(weeks: string[], v: (number | null)[], mode: string): Record<string, { v: number; days: number; full: boolean }> {
  const est: Record<string, number> = {};
  const days: Record<string, number> = {};
  weeks.forEach((w, i) => {
    let end = t(w);
    let start = mode === 'awal' ? end : end - 6 * DAY;
    if (mode === 'awal') end = start + 6 * DAY;
    for (let d = start; d <= end; d += DAY) {
      const ym = ymOf(d);
      days[ym] = (days[ym] || 0) + 1;
      if (v[i] != null) est[ym] = (est[ym] || 0) + (v[i] as number) / 7;
    }
  });

  const out: Record<string, { v: number; days: number; full: boolean }> = {};
  Object.keys(est).forEach(ym => {
    out[ym] = { v: est[ym], days: days[ym], full: days[ym] === dim(ym) };
  });
  Object.keys(days).forEach(ym => {
    if (!out[ym]) out[ym] = { v: 0, days: days[ym], full: days[ym] === dim(ym) };
  });
  return out;
}

export function pearson(x: number[], y: number[]): number | null {
  const n = x.length;
  if (n < 3) return null;
  const mx = FM.mean(x);
  const my = FM.mean(y);
  let sxy = 0;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sx += (x[i] - mx) * (x[i] - mx);
    sy += (y[i] - my) * (y[i] - my);
  }
  return sx > 0 && sy > 0 ? sxy / Math.sqrt(sx * sy) : null;
}

export function rank(a: number[]): number[] {
  const idx = a.map((v, i) => [v, i] as [number, number]).sort((p, q) => p[0] - q[0]);
  const r: number[] = [];
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
}

export function spearman(x: number[], y: number[]): number | null {
  return pearson(rank(x), rank(y));
}

export function linfit(x: number[], y: number[]): { a: number; b: number } {
  const n = x.length;
  const mx = FM.mean(x);
  const my = FM.mean(y);
  let sxy = 0;
  let sx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sx += (x[i] - mx) * (x[i] - mx);
  }
  const b = sx ? sxy / sx : 0;
  return { a: my - b * mx, b };
}

export function analyze(
  W: WeeklyData,
  model: AnalysisModel,
  opt?: { th?: number; zona?: string; mode?: string }
): WeeklyAnalysis {
  opt = opt || {};
  const th = opt.th || 30;
  const zf = opt.zona || '';
  const mode = opt.mode || 'akhir';

  const byName: Record<string, any> = {};
  const byGroup: Record<string, any> = {};
  model.customers.forEach(c => {
    byName[key(c.nama)] = c;
    if (c.group && !byGroup[key(c.group)]) {
      byGroup[key(c.group)] = c;
    }
  });
  model.groups.forEach(g => {
    if (g.zona && g.zona.toLowerCase() !== 'tanpa zona' && !byGroup[key(g.group)]) {
      byGroup[key(g.group)] = g;
    }
  });

  const defaultZone = model.zonas.find(z => z && z.toLowerCase() !== 'tanpa zona') || 'Merak';
  const weeks = W.weeks;
  const n = weeks.length;
  const li = n - 1;

  const rows = W.rows
    .map(r => {
      let c = byName[r.key] || byName[key(r.group)] || byGroup[key(r.group)] || byGroup[r.key];
      if (!c) {
        c = model.customers.find(cx => {
          const kx = key(cx.nama);
          const kg = key(cx.group);
          return kx.includes(r.key) || r.key.includes(kx) || (r.group && kg.includes(key(r.group)));
        });
      }

      let resolvedZona = (c && c.zona && c.zona.toLowerCase() !== 'tanpa zona') ? c.zona : '';
      if (!resolvedZona && r.group) {
        const grp = model.groups.find(g => key(g.group) === key(r.group));
        if (grp && grp.zona && grp.zona.toLowerCase() !== 'tanpa zona') {
          resolvedZona = grp.zona;
        }
      }
      if (!resolvedZona) {
        resolvedZona = defaultZone;
      }

      const v = r.v.map(x => (x == null ? 0 : x));
      return {
        r,
        nama: r.nama,
        group: c ? c.group : r.group,
        zona: resolvedZona,
        kode: c ? c.kode : 'g:' + r.group,
        id: c ? c.id : '',
        cust: c || null,
        v,
        raw: r.v,
        m: {} as Record<string, { v: number; days: number; full: boolean }>
      };
    })
    .filter(x => !zf || x.zona === zf);

  const total = weeks.map((_, i) => FM.sum(rows.map(x => x.v[i])));
  const wow = total.map((v, i) => (i && total[i - 1] > 0 ? ((v - total[i - 1]) / total[i - 1]) * 100 : null));
  const ma4 = total.map((_, i) => (i >= 3 ? FM.mean(total.slice(i - 3, i + 1)) : null));

  const zonas: Record<string, number[]> = {};
  rows.forEach(x => {
    if (!x.zona || x.zona.toLowerCase() === 'tanpa zona') return;
    zonas[x.zona] = zonas[x.zona] || new Array(n).fill(0);
    x.v.forEach((a, i) => {
      zonas[x.zona][i] += a;
    });
  });

  const Z = Object.keys(zonas)
    .filter(z => z && z.trim() && z.toLowerCase() !== 'tanpa zona')
    .map(z => {
      const s = zonas[z];
      return {
        zona: z,
        v: s,
        last: s[li],
        prev: li > 0 ? s[li - 1] : null,
        wow: li > 0 && s[li - 1] > 0 ? ((s[li] - s[li - 1]) / s[li - 1]) * 100 : null,
        avg8: FM.mean(s.slice(Math.max(0, li - 8), li))
      };
    });

  const minAbs = Math.max(30, 0.0005 * total[li]);

  const monthsAll: Record<string, number> = {};
  rows.forEach(x => {
    const m = toMonthly(weeks, x.v, mode);
    x.m = m;
    Object.keys(m).forEach(ym => {
      monthsAll[ym] = m[ym].days;
    });
  });

  // Group individual flowmeters into Customer Groups
  const groupMap: Record<string, {
    key: string;
    kode: string;
    group: string;
    zona: string;
    fms: typeof rows;
  }> = {};
  const groupOrder: string[] = [];

  rows.forEach(r => {
    const grpKey = key(r.group) || r.kode || key(r.nama);
    if (!groupMap[grpKey]) {
      groupMap[grpKey] = {
        key: grpKey,
        kode: r.kode,
        group: r.group,
        zona: r.zona,
        fms: []
      };
      groupOrder.push(grpKey);
    }
    groupMap[grpKey].fms.push(r);
  });

  const C = groupOrder.map(gk => {
    const g = groupMap[gk];
    const s = weeks.map((_, i) => FM.sum(g.fms.map(f => f.v[i])));
    const last = s[li];
    const prev = li > 0 ? s[li - 1] : null;
    const base = s.slice(Math.max(0, li - 8), li);
    const med = FM.median(base);
    const mad = FM.median(base.map(a => Math.abs(a - med))) || 0;
    const dev = med > 0 ? ((last - med) / med) * 100 : null;
    const z = mad > 0 ? (0.6745 * (last - med)) / mad : null;
    const flags: string[] = [];
    let zr = 0;
    for (let i = li; i >= 0 && s[i] === 0; i--) zr++;
    if (last === 0 && med > 0) flags.push(zr >= 3 ? 'diam' : 'nol');
    else if (med > 0 && dev !== null && Math.abs(dev) >= th && Math.abs(last - med) >= minAbs) flags.push(dev > 0 ? 'naik' : 'turun');
    else if (z != null && Math.abs(z) >= 3.5 && Math.abs(last - med) >= minAbs) flags.push(z > 0 ? 'naik' : 'turun');

    // Individual flowmeter details
    const fms = g.fms.map(f => {
      const flast = f.v[li];
      const fprev = li > 0 ? f.v[li - 1] : null;
      const fbase = f.v.slice(Math.max(0, li - 8), li);
      const fmed = FM.median(fbase);
      const fdev = fmed > 0 ? ((flast - fmed) / fmed) * 100 : null;
      const fflags: string[] = [];
      if (flast === 0 && fmed > 0) fflags.push('nol');
      else if (fmed > 0 && fdev !== null && Math.abs(fdev) >= th) fflags.push(fdev > 0 ? 'naik' : 'turun');

      return {
        nama: f.nama,
        zona: f.zona,
        v: f.v,
        last: flast,
        prev: fprev,
        d: fprev == null ? null : flast - fprev,
        wow: fprev !== null && fprev > 0 ? ((flast - fprev) / fprev) * 100 : null,
        med8: fmed,
        dev: fdev,
        flags: fflags,
        ytd: FM.sum(f.v)
      };
    });

    return {
      x: { v: s, nama: g.group, group: g.group, zona: g.zona, kode: g.kode },
      key: g.key,
      kode: g.kode,
      nama: g.group,
      group: g.group,
      zona: g.zona,
      nFm: g.fms.length,
      fms,
      v: s,
      last,
      prev,
      d: prev == null ? null : last - prev,
      wow: prev !== null && prev > 0 ? ((last - prev) / prev) * 100 : null,
      med8: med,
      dev,
      z,
      flags,
      zeroRun: zr,
      ytd: FM.sum(s),
      cv: FM.mean(s) > 0 ? FM.std(s) / FM.mean(s) : 0
    };
  });

  const fullMonths = Object.keys(monthsAll)
    .sort()
    .filter(ym => monthsAll[ym] === dim(ym));
  const cmpMonths = fullMonths.filter(ym => model.months.indexOf(ym) > -1);

  const perMonth = cmpMonths.map(ym => {
    let e = 0;
    let a = 0;
    rows.forEach(x => {
      if (x.cust) {
        e += x.m[ym] ? x.m[ym].v : 0;
        a += x.cust.v[ym] || 0;
      }
    });
    return { ym, est: e, act: a, diff: a > 0 ? ((e - a) / a) * 100 : null };
  });

  const X: number[] = [];
  const Y: number[] = [];
  const pairs: { x: any; ym: string; a: number; e: number }[] = [];

  rows.forEach(x => {
    if (!x.cust) return;
    cmpMonths.forEach(ym => {
      const e = x.m[ym] ? x.m[ym].v : 0;
      const a = x.cust.v[ym];
      if (a != null) {
        X.push(a);
        Y.push(e);
        pairs.push({ x, ym, a, e });
      }
    });
  });

  const fit = X.length > 3 ? linfit(X, Y) : { a: 0, b: 1 };
  const sumA = FM.sum(X);
  const sumE = FM.sum(Y);
  const absErr = FM.sum(X.map((a, i) => Math.abs(Y[i] - a)));
  const corr = {
    n: X.length,
    pearson: pearson(X, Y),
    spearman: X.length > 3 ? spearman(X, Y) : null,
    bias: sumA ? ((sumE - sumA) / sumA) * 100 : null,
    wape: sumA ? (absErr / sumA) * 100 : null,
    slope: fit.b,
    icpt: fit.a,
    months: cmpMonths
  };

  // Grouped customer correlation (per Pelanggan / Group)
  const perC = groupOrder.map(gk => {
    const g = groupMap[gk];
    const custGroup = model.groups.find(cg => cg.key === g.key || cg.kode === g.kode || key(cg.group) === key(g.group));

    const a: number[] = [];
    const e: number[] = [];
    cmpMonths.forEach(ym => {
      let actualVal = 0;
      let hasActual = false;
      if (custGroup && custGroup.v[ym] != null) {
        actualVal = custGroup.v[ym]!;
        hasActual = true;
      } else {
        g.fms.forEach(f => {
          if (f.cust && f.cust.v[ym] != null) {
            actualVal += f.cust.v[ym]!;
            hasActual = true;
          }
        });
      }

      let estVal = 0;
      g.fms.forEach(f => {
        if (f.m[ym]) estVal += f.m[ym].v;
      });

      if (hasActual) {
        a.push(actualVal);
        e.push(estVal);
      }
    });

    const sa = FM.sum(a);
    const se = FM.sum(e);
    const r = pearson(a, e);
    const bias = sa > 0 ? ((se - sa) / sa) * 100 : null;
    const wape = sa > 0 ? (FM.sum(a.map((v, i) => Math.abs(e[i] - v))) / sa) * 100 : null;
    const grade: 'selaras' | 'cukup' | 'selisih' | 'kosong' =
      sa <= 0 && se <= 0
        ? 'kosong'
        : bias == null
        ? 'kosong'
        : wape !== null && wape <= 15 && (r == null || r >= 0.8)
        ? 'selaras'
        : wape !== null && wape <= 35
        ? 'cukup'
        : 'selisih';

    // Child flowmeter correlations
    const fms = g.fms.map(f => {
      const fa: number[] = [];
      const fe: number[] = [];
      cmpMonths.forEach(ym => {
        if (f.cust && f.cust.v[ym] != null) {
          fa.push(f.cust.v[ym]!);
          fe.push(f.m[ym] ? f.m[ym].v : 0);
        }
      });
      const fsa = FM.sum(fa);
      const fse = FM.sum(fe);
      const fr = pearson(fa, fe);
      const fbias = fsa > 0 ? ((fse - fsa) / fsa) * 100 : null;
      const fwape = fsa > 0 ? (FM.sum(fa.map((v, i) => Math.abs(fe[i] - v))) / fsa) * 100 : null;
      const fgrade: 'selaras' | 'cukup' | 'selisih' | 'kosong' =
        fsa <= 0 && fse <= 0
          ? 'kosong'
          : fbias == null
          ? 'kosong'
          : fwape !== null && fwape <= 15 && (fr == null || fr >= 0.8)
          ? 'selaras'
          : fwape !== null && fwape <= 35
          ? 'cukup'
          : 'selisih';

      return {
        nama: f.nama,
        n: fa.length,
        sa: fsa,
        se: fse,
        r: fr,
        bias: fbias,
        wape: fwape,
        grade: fgrade
      };
    });

    return {
      key: g.key,
      kode: g.kode,
      nama: g.group,
      group: g.group,
      zona: g.zona,
      nFm: g.fms.length,
      fms,
      n: a.length,
      sa,
      se,
      r,
      bias,
      wape,
      grade
    };
  });

  const lastEnd = t(weeks[li]);
  const cur = ymOf(lastEnd);
  const mtdDays = Math.min(dim(cur), +iso(lastEnd).slice(8, 10));
  const curFull = mtdDays === dim(cur);
  const run = (s: number[]) => {
    const w = s.slice(-4);
    return FM.mean(w) / 7;
  };

  // Grouped projections
  const pm = groupOrder.map(gk => {
    const g = groupMap[gk];
    let gMtd = 0;
    let gProj = 0;
    const fms = g.fms.map(f => {
      const fMtd = f.m[cur] ? f.m[cur].v : 0;
      const fRest = (dim(cur) - mtdDays) * run(f.v);
      const fProj = fMtd + fRest;
      gMtd += fMtd;
      gProj += fProj;
      return { nama: f.nama, mtd: fMtd, proj: fProj };
    });

    return {
      x: { kode: g.kode, group: g.group, zona: g.zona, nama: g.group },
      kode: g.kode,
      nama: g.group,
      group: g.group,
      zona: g.zona,
      nFm: g.fms.length,
      mtd: gMtd,
      proj: gProj,
      fms
    };
  });

  const proj = {
    ym: cur,
    mtdDays,
    days: dim(cur),
    full: curFull,
    mtd: FM.sum(pm.map(p => p.mtd)),
    total: FM.sum(pm.map(p => p.proj)),
    rows: pm
  };

  return {
    weeks,
    n,
    li,
    rows,
    total,
    wow,
    ma4,
    Z,
    C,
    perMonth,
    pairs,
    corr,
    perC,
    proj,
    th,
    mode,
    fullMonths
  };
}

export function bestMode(W: WeeklyData, model: AnalysisModel): string {
  let best: { m: string; w: number } | null = null;
  ['akhir', 'awal'].forEach(m => {
    const a = analyze(W, model, { mode: m });
    const w = a.corr.wape == null ? 1e9 : a.corr.wape;
    if (!best || w < best.w) best = { m, w };
  });
  return best ? best.m : 'akhir';
}
