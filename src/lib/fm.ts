import {
  AppConfig,
  CustomerFlowmeter,
  CustomerGroup,
  UsageData,
  ContractRow,
  ContractSummary,
  ContractStatus,
  ForecastResult,
  AnalysisModel,
  AnalysisResult,
  QualityCheckItem,
  StoppedCustomer
} from '../types';

export const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export const BLN_FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const MON3: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7,
  agu: 8, agt: 8, ags: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12
};

export const DEFAULT_CFG: AppConfig = {
  pembuat: 'Joy Felix',
  judul: 'Rekap Flowmeter',
  batas_atas: 110,
  batas_bawah: 80,
  mendekati: 5,
  ambang_perubahan: 30
};

export function sum(a: number[]): number {
  let t = 0;
  for (let i = 0; i < a.length; i++) t += a[i] || 0;
  return t;
}

export function mean(a: number[]): number {
  return a.length ? sum(a) / a.length : 0;
}

export function median(a: number[]): number {
  const s = a.slice().sort((x, y) => x - y);
  const n = s.length;
  return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0;
}

export function std(a: number[]): number {
  if (a.length < 2) return 0;
  const m = mean(a);
  let t = 0;
  a.forEach(x => { t += (x - m) * (x - m); });
  return Math.sqrt(t / (a.length - 1));
}

export function toYM(y: number | string, m: number | string): string | null {
  const ny = +y < 100 ? +y + 2000 : +y;
  const nm = +m;
  if (!(nm >= 1 && nm <= 12) || ny < 2000 || ny > 2100) return null;
  return ny + '-' + (nm < 10 ? '0' : '') + nm;
}

export function ymAdd(ym: string, k: number): string {
  let y = +ym.slice(0, 4);
  let m = +ym.slice(5, 7) - 1 + k;
  y += Math.floor(m / 12);
  m = ((m % 12) + 12) % 12;
  return toYM(y, m + 1) || ym;
}

export function ymLabel(ym: string): string {
  const idx = +ym.slice(5, 7) - 1;
  return (BLN[idx] || '') + ' ' + ym.slice(0, 4);
}

export function ymShort(ym: string): string {
  const idx = +ym.slice(5, 7) - 1;
  return (BLN[idx] || '') + ' ' + ym.slice(2, 4);
}

export function ymFull(ym: string): string {
  const idx = +ym.slice(5, 7) - 1;
  return (BLN_FULL[idx] || '') + ' ' + ym.slice(0, 4);
}

export function yearOf(ym: string): number {
  return +ym.slice(0, 4);
}

export function monthOf(ym: string): number {
  return +ym.slice(5, 7);
}

export function parseMonthHeader(h: any): string | null {
  const s = String(h == null ? '' : h).trim().replace(/^"|"$/g, '');
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](d{1,2})(?:[-/.](?:d{1,2}))?(?:[T\s].*)?$/);
  if (m) return toYM(m[1], m[2]);
  m = s.match(/^(\d{4})[-/.](\d{1,2})/);
  if (m) return toYM(m[1], m[2]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:\s.*)?$/);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    let mo: number;
    if (a > 12) mo = b;
    else if (b > 12) mo = a;
    else if (a === 1 && b !== 1) mo = b;
    else if (b === 1 && a !== 1) mo = a;
    else mo = b;
    return toYM(m[3], mo);
  }
  m = s.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (m) return toYM(m[2], m[1]);
  const al = s.toLowerCase().match(/[a-z]{3,}/);
  if (al && MON3[al[0].slice(0, 3)]) {
    const dg = s.match(/\d+/g) || [];
    let yr: string | null = null;
    for (let i = dg.length - 1; i >= 0; i--) {
      if (dg[i].length === 4) { yr = dg[i]; break; }
    }
    if (!yr && dg.length) yr = dg[dg.length - 1];
    if (yr && (yr.length === 4 || yr.length === 2)) {
      return toYM(yr, MON3[al[0].slice(0, 3)]);
    }
  }
  return null;
}

export function parseNum(s: any): number | null {
  if (s == null) return null;
  let str = String(s).trim().replace(/\s|m3|m³/gi, '');
  if (str === '') return null;
  if (str === '-' || str === '–' || str === '—') return 0;
  if (!/^[-+]?[\d.,]+$/.test(str)) return NaN;
  const hd = str.indexOf('.') > -1;
  const hc = str.indexOf(',') > -1;
  if (hd && hc) {
    const dec = str.lastIndexOf('.') > str.lastIndexOf(',') ? '.' : ',';
    const th = dec === '.' ? ',' : '.';
    str = str.split(th).join('').replace(dec, '.');
  } else if (hd || hc) {
    const sep = hd ? '.' : ',';
    const p = str.split(sep);
    if (p.length > 2 || (p.length === 2 && /^\d{3}$/.test(p[1]) && p[0].replace(/^[-+]/, '').length <= 3 && p[0].replace(/^[-+]/, '') !== '0')) {
      str = p.join('');
    } else {
      str = str.replace(sep, '.');
    }
  }
  const v = parseFloat(str);
  return isNaN(v) ? NaN : v;
}

export function splitCSV(txt: string, d: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) {
      if (c === '"') {
        if (txt[i + 1] === '"') { cur += '"'; i++; } else { q = false; }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      q = true;
    } else if (c === d) {
      row.push(cur);
      cur = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && txt[i + 1] === '\n') i++;
      row.push(cur);
      cur = '';
      if (row.some(x => x.trim())) rows.push(row);
      row = [];
    } else {
      cur += c;
    }
  }
  row.push(cur);
  if (row.some(x => x.trim())) rows.push(row);
  return rows;
}

export function readCSV(txt: string): string[][] {
  const clean = String(txt).replace(/^\uFEFF/, '');
  const first = clean.split(/\r?\n/)[0] || '';
  const cnt = {
    ',': first.split(',').length,
    ';': first.split(';').length,
    '\t': first.split('\t').length
  };
  let d = ',';
  if (cnt[';'] > cnt[d]) d = ';';
  if (cnt['\t'] > cnt[d]) d = '\t';
  return splitCSV(clean, d);
}

export function normH(h: any): string {
  return String(h || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');
}

export function kodeOf(nopel: any, group: any): string {
  const m = /^(\d+)/.exec(String(nopel).trim());
  return m ? m[1] : 'g:' + group;
}

const META = {
  zona: ['zona', 'wilayah', 'area'],
  nopel: ['nopel', 'nopelanggan', 'kodepelanggan', 'kode', 'nopel.'],
  group: ['group', 'grup', 'kelompok', 'customer', 'pelanggan'],
  nama: ['namapelanggan', 'nama', 'namafm', 'flowmeter', 'namacustomer']
};

export function metaIndex(hd: string[], names: string[]): number {
  for (let i = 0; i < names.length; i++) {
    const x = hd.indexOf(names[i]);
    if (x > -1) return x;
  }
  return -1;
}

export function loadUsage(text: string): UsageData {
  const all = readCSV(text);
  const warn: string[] = [];
  if (all.length < 2) return { ok: false, error: 'File kosong atau hanya berisi judul kolom.', warnings: warn, customers: [], months: [], headerMonths: [], future: [] };
  const hd = all[0].map(normH);
  const iz = metaIndex(hd, META.zona);
  const ip = metaIndex(hd, META.nopel);
  const ig = metaIndex(hd, META.group);
  const inm = metaIndex(hd, META.nama);
  if (inm < 0 && ig < 0) return { ok: false, error: 'Kolom "Nama Pelanggan" atau "Group" tidak ditemukan.', warnings: warn, customers: [], months: [], headerMonths: [], future: [] };
  
  const metaSet: Record<number, number> = {};
  [iz, ip, ig, inm].forEach(x => { if (x > -1) metaSet[x] = 1; });
  const mcols: { i: number; ym: string }[] = [];
  const seenM: Record<string, number> = {};
  
  all[0].forEach((h, i) => {
    if (metaSet[i]) return;
    const ym = parseMonthHeader(h);
    if (!ym) return;
    if (seenM[ym]) {
      warn.push('Kolom bulan ' + ymLabel(ym) + ' muncul lebih dari sekali, kolom pertama yang dipakai.');
      return;
    }
    seenM[ym] = 1;
    mcols.push({ i, ym });
  });

  if (!mcols.length) return { ok: false, error: 'Tidak ada kolom bulan yang terbaca. Tulis judul kolom seperti 2026-01 atau Jan-26.', warnings: warn, customers: [], months: [], headerMonths: [], future: [] };
  mcols.sort((a, b) => (a.ym < b.ym ? -1 : 1));

  const custs: CustomerFlowmeter[] = [];
  let prevZona = '';
  const seenId: Record<string, number> = {};
  let bad = 0;

  all.slice(1).forEach((c, ri) => {
    let nama = (inm > -1 ? c[inm] : '') || '';
    let group = (ig > -1 ? c[ig] : '') || '';
    nama = String(nama).trim();
    group = String(group).trim();
    let nopel = ip > -1 ? String(c[ip] || '').trim() : '';
    if (!nama && !group && !nopel) return;
    if (/^(total|jumlah|grand total|sub ?total)/i.test(nama || group)) {
      warn.push('Baris "' + (nama || group) + '" dilewati karena terlihat seperti baris total.');
      return;
    }
    let zona = iz > -1 ? String(c[iz] || '').trim() : '';
    if (!zona || zona.toLowerCase() === 'tanpa zona') {
      zona = (prevZona && prevZona.toLowerCase() !== 'tanpa zona') ? prevZona : 'Merak';
    }
    prevZona = zona;
    if (!nama) nama = group;
    if (!group) group = nama;
    if (!nopel) nopel = String(custs.length + 1);
    if (seenId[nopel]) warn.push('No.Pel ' + nopel + ' muncul lebih dari sekali (baris ' + (ri + 2) + ').');
    seenId[nopel] = 1;

    const v: Record<string, number | null> = {};
    mcols.forEach(mc => {
      let x = parseNum(c[mc.i]);
      if (x !== null && isNaN(x)) {
        bad++;
        x = null;
      }
      v[mc.ym] = x;
    });
    custs.push({ id: nopel, kode: kodeOf(nopel, group), zona, group, nama, v });
  });

  if (bad) warn.push(bad + ' sel berisi nilai yang bukan angka dan dianggap kosong.');
  if (!custs.length) return { ok: false, error: 'Tidak ada baris data yang terbaca.', warnings: warn, customers: [], months: [], headerMonths: [], future: [] };

  const headerMonths = mcols.map(x => x.ym);
  const tot: Record<string, number> = {};
  headerMonths.forEach(ym => {
    tot[ym] = 0;
    custs.forEach(cu => {
      if ((cu.v[ym] || 0) > 0) tot[ym] += cu.v[ym] || 0;
    });
  });

  let firstIdx = -1;
  let lastIdx = -1;
  headerMonths.forEach((ym, i) => {
    if (tot[ym] > 0) {
      if (firstIdx < 0) firstIdx = i;
      lastIdx = i;
    }
  });

  if (lastIdx < 0) return { ok: false, error: 'Belum ada pemakaian bernilai lebih dari 0 pada bulan mana pun.', warnings: warn, customers: [], months: [], headerMonths: [], future: [] };
  let months = headerMonths.slice(firstIdx, lastIdx + 1);
  const full: string[] = [];
  let cur = months[0];
  while (cur <= months[months.length - 1]) {
    full.push(cur);
    cur = ymAdd(cur, 1);
  }
  if (full.length !== months.length) {
    warn.push('Ada bulan yang tidak punya kolom di antara ' + ymLabel(months[0]) + ' dan ' + ymLabel(months[months.length - 1]) + '. Dianggap kosong.');
    months = full;
  }
  return {
    ok: true,
    customers: custs,
    months,
    headerMonths,
    future: headerMonths.slice(lastIdx + 1),
    warnings: warn
  };
}

export function loadContracts(text: string): { rows: ContractRow[]; warnings: string[] } {
  const all = readCSV(text);
  const warn: string[] = [];
  const rows: ContractRow[] = [];
  if (all.length < 2) return { rows: [], warnings: warn };
  const hd = all[0].map(normH);
  const ip = metaIndex(hd, META.nopel);
  const ig = metaIndex(hd, META.group);
  const it = hd.indexOf('tahun');
  let ifm = -1;
  let icum = -1;
  hd.forEach((h, i) => {
    if (h.indexOf('kontrak') !== 0) return;
    if (h.indexOf('kumulatif') > -1) icum = i;
    else if (ifm < 0) ifm = i;
  });
  if (ip < 0 && ig < 0) return { rows: [], warnings: ['File kontrak: kolom No.Pel atau Group tidak ditemukan.'] };
  if (ifm < 0 && icum < 0) return { rows: [], warnings: ['File kontrak: kolom "Kontrak FM" atau "Kontrak Kumulatif" tidak ditemukan.'] };

  all.slice(1).forEach(c => {
    const nopel = ip > -1 ? String(c[ip] || '').trim() : '';
    const group = ig > -1 ? String(c[ig] || '').trim() : '';
    if (!nopel && !group) return;
    let fm = ifm > -1 ? parseNum(c[ifm]) : null;
    let cum = icum > -1 ? parseNum(c[icum]) : null;
    if (fm !== null && isNaN(fm)) {
      warn.push('Kontrak FM untuk ' + (nopel || group) + ' bukan angka.');
      fm = null;
    }
    if (cum !== null && isNaN(cum)) {
      warn.push('Kontrak Kumulatif untuk ' + (nopel || group) + ' bukan angka.');
      cum = null;
    }
    if (fm !== null && fm <= 0) fm = null;
    if (cum !== null && cum <= 0) cum = null;
    let yr = it > -1 ? parseNum(c[it]) : null;
    if (yr !== null && isNaN(yr)) yr = null;
    if (fm === null && cum === null) return;
    rows.push({ nopel, kode: kodeOf(nopel, group), group, fm, cum, year: yr });
  });

  return { rows, warnings: warn };
}

export function matchGroupName(a: string, b: string): boolean {
  if (!a || !b) return false;
  const na = normH(a);
  const nb = normH(b);
  if (na === nb) return true;
  // Handle trailing 's' or plural (e.g. "Angels Product" vs "Angels Products", "Chemical" vs "Chemicals")
  if (na.replace(/s$/, '') === nb.replace(/s$/, '')) return true;
  // Substring matching for company names
  if (na.length >= 6 && nb.length >= 6) {
    if (na.includes(nb) || nb.includes(na)) return true;
  }
  return false;
}

export function contractFor(rows: ContractRow[], kode: string, year: number, groupName?: string): ContractSummary | null {
  // 1. Prioritize matching by GROUP NAME (Company name)
  let mine: ContractRow[] = [];
  if (groupName) {
    mine = rows.filter(r => {
      const yrOk = r.year == null || r.year === year;
      if (!yrOk) return false;
      return matchGroupName(r.group, groupName);
    });
  }

  // 2. If no group match found, fallback to matching by kode / nopel
  // But ensure r.group does NOT belong to a different known company
  if (!mine.length && kode) {
    mine = rows.filter(r => {
      const yrOk = r.year == null || r.year === year;
      if (!yrOk) return false;
      if (r.kode && kode && r.kode === kode) {
        if (r.group && groupName && !matchGroupName(r.group, groupName)) {
          return false;
        }
        return true;
      }
      return false;
    });
  }

  if (!mine.length) return null;
  const byFm: Record<string, number> = {};
  let cum: number | null = null;
  mine.forEach(r => {
    if (r.fm != null) {
      if (!byFm[r.nopel] || r.year != null) byFm[r.nopel] = r.fm;
    }
  });
  const specific = mine.filter(r => r.cum != null && r.year === year);
  const generic = mine.filter(r => r.cum != null && r.year == null);
  if (specific.length) cum = specific[0].cum;
  else if (generic.length) cum = generic[0].cum;

  let fmSum = 0;
  let any = false;
  Object.keys(byFm).forEach(k => { fmSum += byFm[k]; any = true; });
  if (cum != null) return { c: cum, src: 'kumulatif', fm: byFm };
  if (any) {
    // If only one FM has a number and there are multiple flowmeters in the group,
    // the user stated: "kontraknya di baris pertama di masing masing Group" -> this is the group's cumulative contract
    const isSingleEntryForGroup = Object.keys(byFm).length === 1 && mine.length > 1;
    return {
      c: fmSum,
      src: isSingleEntryForGroup ? 'kumulatif' : 'jumlah FM',
      fm: byFm
    };
  }
  return null;
}

export function statusOf(ratio: number | null, cfg: AppConfig): ContractStatus {
  if (ratio == null || !isFinite(ratio)) return 'none';
  const p = ratio * 100;
  if (p > cfg.batas_atas) return 'above';
  if (p < cfg.batas_bawah) return 'below';
  if (p >= cfg.batas_atas - cfg.mendekati) return 'nearHigh';
  if (p <= cfg.batas_bawah + cfg.mendekati) return 'nearLow';
  return 'ok';
}

function rep(v: number, h: number): number[] {
  const a: number[] = [];
  for (let i = 0; i < h; i++) a.push(v);
  return a;
}

function f_sma(y: number[], h: number): number[] {
  return rep(mean(y.slice(-3)), h);
}

function f_lin(y: number[], h: number): number[] {
  const n = y.length;
  const xb = (n - 1) / 2;
  const yb = mean(y);
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (i - xb) * (i - xb);
    sxy += (i - xb) * (y[i] - yb);
  }
  const b = sxx ? sxy / sxx : 0;
  const a = yb - b * xb;
  const out: number[] = [];
  for (let i = 0; i < h; i++) out.push(a + b * (n + i));
  return out;
}

const PHI = 0.9;
function holtRun(y: number[], al: number, be: number) {
  const n = y.length;
  const k = Math.min(2, n - 1);
  let l = y[0];
  let t = k ? (y[k] - y[0]) / k : 0;
  let sse = 0;
  for (let i = 1; i < n; i++) {
    const pred = l + PHI * t;
    const e = y[i] - pred;
    sse += e * e;
    const ln = al * y[i] + (1 - al) * (l + PHI * t);
    t = be * (ln - l) + (1 - be) * PHI * t;
    l = ln;
  }
  return { l, t, sse };
}

function f_holt(y: number[], h: number): number[] {
  let best: { l: number; t: number; sse: number } | null = null;
  const als = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
  const bes = [0.05, 0.1, 0.2, 0.3, 0.5];
  als.forEach(al => {
    bes.forEach(be => {
      const r = holtRun(y, al, be);
      if (!best || r.sse < best.sse) best = r;
    });
  });
  const out: number[] = [];
  let acc = 0;
  let p = 1;
  for (let i = 0; i < h; i++) {
    p *= PHI;
    acc += p;
    out.push(best ? best.l + best.t * acc : 0);
  }
  return out;
}

function f_yoy(y: number[], h: number): number[] {
  const n = y.length;
  const k = Math.min(6, n - 12);
  const a = sum(y.slice(n - k));
  const b = sum(y.slice(n - 12 - k, n - 12));
  let r = b > 0 ? a / b : 1;
  r = Math.max(0.5, Math.min(2, r));
  const out: number[] = [];
  for (let i = 0; i < h; i++) {
    const idx = n + i - 12;
    out.push(idx >= 0 && idx < n ? y[idx] * r : mean(y.slice(-3)));
  }
  return out;
}

function f_wma3(y: number[], h: number): number[] {
  const s = y.slice(-3);
  if (s.length < 3) return rep(mean(s), h);
  const wVal = (s[0] * 1 + s[1] * 2 + s[2] * 3) / 6;
  return rep(wVal, h);
}

export const METHODS = [
  { id: 'sma', name: 'Rata-rata bergerak 3 bulan', fn: f_sma, min: 3 },
  { id: 'wma', name: 'Rata-rata terbobot (WMA 3 bulan)', fn: f_wma3, min: 3 },
  { id: 'lin', name: 'Tren linear (OLS)', fn: f_lin, min: 4 },
  { id: 'holt', name: 'Holt dengan redaman tren', fn: f_holt, min: 5 },
  { id: 'yoy', name: 'Rasio YoY musiman', fn: f_yoy, min: 15 }
];

function backtest(m: typeof METHODS[0], y: number[], start: number) {
  const errs: number[] = [];
  const acts: number[] = [];
  for (let t = start; t < y.length; t++) {
    const p = Math.max(0, m.fn(y.slice(0, t), 1)[0]);
    errs.push(y[t] - p);
    acts.push(y[t]);
  }
  const mae = mean(errs.map(Math.abs));
  const rmse = Math.sqrt(mean(errs.map(e => e * e)));
  const sa = sum(acts);
  return { mae, rmse, wape: sa > 0 ? sum(errs.map(Math.abs)) / sa : null, k: errs.length };
}

export function forecast(y: number[], h: number): ForecastResult {
  const n = y.length;
  const res: ForecastResult = {
    method: '',
    methodId: '',
    fc: [],
    lo: [],
    hi: [],
    cands: [],
    rmse: 0,
    n,
    note: ''
  };
  if (n === 0 || sum(y) === 0) {
    res.method = 'Nol';
    res.methodId = 'zero';
    res.fc = rep(0, h);
    res.lo = rep(0, h);
    res.hi = rep(0, h);
    return res;
  }
  const elig = METHODS.filter(m => n >= m.min + 2);
  if (n < 6 || !elig.length) {
    const fc0 = n >= 3 ? f_sma(y, h) : rep(y[n - 1], h);
    const sd = std(y);
    res.method = n >= 3 ? 'Rata-rata bergerak 3 bulan' : 'Nilai terakhir';
    res.methodId = 'sma';
    res.fc = fc0;
    res.rmse = sd;
    res.note = 'Data kurang dari 6 bulan, metode sederhana dipakai tanpa uji mundur.';
    res.lo = fc0.map((f, k) => Math.max(0, f - 1.28 * sd * Math.sqrt(1 + k * 0.5)));
    res.hi = fc0.map((f, k) => f + 1.28 * sd * Math.sqrt(1 + k * 0.5));
    return res;
  }
  let start = Math.max(Math.max(...elig.map(m => m.min)), n - 4);
  while (n - start < 2 && elig.length > 1) {
    elig.sort((a, b) => b.min - a.min);
    elig.shift();
    start = Math.max(Math.max(...elig.map(m => m.min)), n - 4);
  }
  let best: any = null;
  elig.sort((a, b) => METHODS.indexOf(a) - METHODS.indexOf(b));
  elig.forEach(m => {
    const bt = backtest(m, y, start);
    const f = m.fn(y, h).map(v => Math.max(0, v));
    const c = { id: m.id, name: m.name, mae: bt.mae, rmse: bt.rmse, wape: bt.wape, k: bt.k, fc: f };
    res.cands.push(c);
    if (!best || c.mae < best.mae - 1e-9) best = c;
  });

  res.method = best.name;
  res.methodId = best.id;
  res.fc = best.fc;
  res.rmse = best.rmse;
  res.mae = best.mae;
  res.wape = best.wape;
  res.k = best.k;
  res.lo = best.fc.map((f: number, k: number) => Math.max(0, f - 1.28 * best.rmse * Math.sqrt(1 + k * 0.5)));
  res.hi = best.fc.map((f: number, k: number) => f + 1.28 * best.rmse * Math.sqrt(1 + k * 0.5));
  return res;
}

export function slopePct(y: number[]): number {
  const n = y.length;
  if (n < 3) return 0;
  const xb = (n - 1) / 2;
  const yb = mean(y);
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (i - xb) * (i - xb);
    sxy += (i - xb) * (y[i] - yb);
  }
  return yb > 0 && sxx ? ((sxy / sxx) / yb) * 100 : 0;
}

export function buildModel(usage: UsageData): AnalysisModel {
  const months = usage.months;
  const gmap: Record<string, CustomerGroup> = {};
  const groups: CustomerGroup[] = [];
  const zonas: string[] = [];

  usage.customers.forEach(c => {
    if (!c.zona || c.zona.toLowerCase() === 'tanpa zona') {
      c.zona = 'Merak';
    }
    if (zonas.indexOf(c.zona) < 0 && c.zona.toLowerCase() !== 'tanpa zona') {
      zonas.push(c.zona);
    }
    // Grouping is based on company group name so multi-flowmeter customers stay consolidated
    const grpNorm = normH(c.group);
    const grpKey = grpNorm || (c.kode && !c.kode.startsWith('g:') ? c.kode : normH(c.nama));

    let g = gmap[grpKey];
    if (!g) {
      g = gmap[grpKey] = {
        key: grpKey,
        kode: c.kode.indexOf('g:') === 0 ? '' : c.kode,
        group: c.group || c.nama,
        zona: c.zona,
        fms: [],
        v: {},
        nums: []
      };
      groups.push(g);
    } else {
      if (!g.kode && c.kode && !c.kode.startsWith('g:')) {
        g.kode = c.kode;
      }
    }
    g.fms.push(c);
  });

  groups.forEach(g => {
    months.forEach(ym => {
      let any = false;
      let t = 0;
      g.fms.forEach(f => {
        const x = f.v[ym];
        if (x != null) {
          any = true;
          t += x;
        }
      });
      g.v[ym] = any ? t : null;
    });
    g.nums = months.map(ym => g.v[ym] || 0);
  });

  return { months, groups, zonas, customers: usage.customers, future: usage.future };
}

export function simulateContracts(model: AnalysisModel): ContractRow[] {
  const rows: ContractRow[] = [];
  model.groups.forEach(g => {
    const base = g.nums.slice(0, Math.min(6, g.nums.length));
    const mu = mean(base);
    if (mu < 50) return;
    rows.push({
      nopel: g.fms[0]?.id || '',
      kode: g.key,
      group: g.group,
      fm: null,
      cum: Math.round(mu / 50) * 50,
      year: null
    });
  });
  return rows;
}

export function analyze(
  model: AnalysisModel,
  opt: {
    cfg: AppConfig;
    ref?: string;
    zona?: string;
    contractRows?: ContractRow[];
  }
): AnalysisResult {
  const cfg = opt.cfg;
  const months = model.months;
  const N = months.length;
  let ref = opt.ref || months[N - 1];
  let ri = months.indexOf(ref);
  if (ri < 0) {
    ri = N - 1;
    ref = months[ri];
  }
  const pi = ri > 0 ? ri - 1 : -1;
  const yi = months.indexOf(ymAdd(ref, -12));
  const year = yearOf(ref);
  const ytdIdx: number[] = [];
  months.forEach((m, i) => {
    if (yearOf(m) === year && i <= ri) ytdIdx.push(i);
  });
  const ytdLY: number[] = [];
  ytdIdx.forEach(i => {
    const j = months.indexOf(ymAdd(months[i], -12));
    if (j >= 0) ytdLY.push(j);
  });
  const hasLY = ytdLY.length === ytdIdx.length && ytdIdx.length > 0;
  const last = N - 1;
  const H = Math.max(3, 12 - monthOf(months[last]));
  const fmonths: string[] = [];
  for (let k = 1; k <= H; k++) fmonths.push(ymAdd(months[last], k));

  const cRows = opt.contractRows || [];
  const zf = opt.zona || '';
  const groups = model.groups.filter(g => !zf || g.zona === zf);

  const totalNums = months.map((_, i) => sum(groups.map(g => g.nums[i])));
  const totRef = totalNums[ri];
  const minAbs = Math.max(100, 0.0005 * totRef);

  const cYear: Record<string, ContractSummary | null> = {};
  function cOf(g: CustomerGroup, y: number) {
    const key = g.key + '|' + y;
    if (!(key in cYear)) cYear[key] = contractFor(cRows, g.key, y, g.group);
    return cYear[key];
  }

  const G = groups.map(g => {
    const nums = g.nums;
    const vR = nums[ri];
    const vP = pi >= 0 ? nums[pi] : null;
    const vY = yi >= 0 ? nums[yi] : null;
    const ytd = sum(ytdIdx.map(i => nums[i]));
    const ytdL = hasLY ? sum(ytdLY.map(i => nums[i])) : null;
    const d = vP === null ? null : vR - vP;
    const mom = vP !== null && vP > 0 ? (d! / vP) * 100 : null;
    const yoy = vY !== null && vY > 0 ? ((vR - vY) / vY) * 100 : null;
    const mu = mean(nums);
    const cv = mu > 0 ? std(nums) / mu : 0;

    const flags: string[] = [];
    const earlier = nums.slice(0, ri);
    let zeroRun = 0;
    for (let i = ri; i >= 0 && nums[i] === 0; i--) zeroRun++;
    if (vR === 0 && earlier.some(x => x > 0)) flags.push(zeroRun >= 3 ? 'diam' : 'nol');
    else if (vR === 0) flags.push('kosong');
    else if (vR > 0 && earlier.length && earlier.every(x => x === 0)) flags.push('baru');
    else if (mom !== null && Math.abs(mom) >= cfg.ambang_perubahan && Math.abs(d!) >= minAbs) flags.push(mom > 0 ? 'naik' : 'turun');
    if (g.fms.some(f => f.v[ref] == null) && vR !== 0) flags.push('blank');

    const cc = cOf(g, year);
    let ratio: number | null = null;
    let st: ContractStatus = 'none';
    let excess = 0;
    let short = 0;
    let ytdC = 0;
    let ytdR: number | null = null;

    const mStat = months.map((m, i) => {
      const c = cOf(g, yearOf(m));
      if (!c) return null;
      const r = nums[i] / c.c;
      return {
        r,
        st: statusOf(r, cfg),
        c: c.c,
        ex: Math.max(0, nums[i] - (cfg.batas_atas / 100) * c.c),
        sh: Math.max(0, (cfg.batas_bawah / 100) * c.c - nums[i])
      };
    });

    if (cc) {
      ratio = vR / cc.c;
      st = statusOf(ratio, cfg);
      excess = Math.max(0, vR - (cfg.batas_atas / 100) * cc.c);
      short = Math.max(0, (cfg.batas_bawah / 100) * cc.c - vR);
      ytdC = cc.c * ytdIdx.length;
      ytdR = ytdC ? ytd / ytdC : null;
    }
    const outCount = ytdIdx.filter(i => mStat[i] && (mStat[i]!.st === 'above' || mStat[i]!.st === 'below')).length;
    const ytdEx = sum(ytdIdx.map(i => (mStat[i] ? mStat[i]!.ex : 0)));
    const ytdSh = sum(ytdIdx.map(i => (mStat[i] ? mStat[i]!.sh : 0)));
    const fc = forecast(nums, fmonths.length);
    const fStat = fc.fc.map((v, i) => {
      const c = cOf(g, yearOf(fmonths[i]));
      return c ? statusOf(v / c.c, cfg) : 'none';
    });

    // Enterprise Customer Health & Compliance Score (0-100)
    let hScore = 100;
    if (cc) {
      if (st === 'above' || st === 'below') hScore -= 25;
      else if (st === 'nearHigh' || st === 'nearLow') hScore -= 10;
      hScore -= Math.min(25, outCount * 5);
    }
    if (cv > 50) hScore -= 15;
    else if (cv > 30) hScore -= 8;
    if (flags.includes('nol') || flags.includes('diam')) hScore -= 20;
    if (flags.includes('naik') || flags.includes('turun')) hScore -= 10;
    const healthScore = Math.max(0, Math.min(100, Math.round(hScore)));

    return {
      g,
      key: g.key,
      kode: g.kode,
      name: g.group,
      zona: g.zona,
      nums,
      vR,
      vP,
      vY,
      d,
      mom,
      yoy,
      ytd,
      ytdL,
      avg: mean(ytdIdx.map(i => nums[i])),
      cv,
      share: totRef ? (vR / totRef) * 100 : 0,
      flags,
      flagged: flags.some(f => f === 'naik' || f === 'turun' || f === 'nol' || f === 'diam' || f === 'blank'),
      contract: cc,
      ratio,
      st,
      excess,
      short,
      ytdC,
      ytdR,
      mStat,
      outCount,
      ytdEx,
      ytdSh,
      fc,
      fStat,
      nFm: g.fms.length,
      healthScore
    };
  });

  const zonaList = zf ? [zf] : model.zonas;
  const Z = zonaList.map(z => {
    const gs = G.filter(x => x.zona === z);
    const nums = months.map((_, i) => sum(gs.map(x => x.nums[i])));
    const vR = nums[ri];
    const vP = pi >= 0 ? nums[pi] : null;
    const vY = yi >= 0 ? nums[yi] : null;
    const ytd = sum(ytdIdx.map(i => nums[i]));
    const ytdL = hasLY ? sum(ytdLY.map(i => nums[i])) : null;
    const cg = gs.filter(x => x.contract);
    const uC = sum(cg.map(x => x.vR));
    const cC = sum(cg.map(x => x.contract!.c));
    return {
      zona: z,
      nums,
      vR,
      vP,
      d: vP === null ? null : vR - vP,
      mom: vP !== null && vP > 0 ? ((vR - vP) / vP) * 100 : null,
      yoy: vY !== null && vY > 0 ? ((vR - vY) / vY) * 100 : null,
      ytd,
      ytdL,
      share: totRef ? (vR / totRef) * 100 : 0,
      nCust: gs.length,
      nActive: gs.filter(x => x.vR > 0).length,
      nFm: sum(gs.map(x => x.nFm)),
      nContract: cg.length,
      util: cC ? uC / cC : null,
      nAbove: cg.filter(x => x.st === 'above').length,
      nBelow: cg.filter(x => x.st === 'below').length,
      fc: forecast(nums, fmonths.length)
    };
  });

  const port = months.map((_, i) => {
    const cg = G.filter(x => x.mStat[i]);
    const U = sum(cg.map(x => x.nums[i]));
    const C = sum(cg.map(x => x.mStat[i]!.c));
    return {
      n: cg.length,
      U,
      C,
      ratio: C ? U / C : null,
      ex: sum(cg.map(x => x.mStat[i]!.ex)),
      sh: sum(cg.map(x => x.mStat[i]!.sh))
    };
  });

  const cnt: Record<ContractStatus, number> = {
    above: 0,
    nearHigh: 0,
    ok: 0,
    nearLow: 0,
    below: 0,
    none: 0
  };
  G.forEach(x => {
    if (x.vR > 0 || x.contract) cnt[x.st]++;
  });
  const activeG = G.filter(x => x.vR > 0);

  const totalFc = forecast(totalNums, fmonths.length);
  const totalMom = pi >= 0 && totalNums[pi] > 0 ? ((totRef - totalNums[pi]) / totalNums[pi]) * 100 : null;
  const totalD = pi >= 0 ? totRef - totalNums[pi] : null;
  const totalYoy = yi >= 0 && totalNums[yi] > 0 ? ((totRef - totalNums[yi]) / totalNums[yi]) * 100 : null;
  const totalYtd = sum(ytdIdx.map(i => totalNums[i]));
  const totalYtdL = hasLY ? sum(ytdLY.map(i => totalNums[i])) : null;
  const totalAvg = mean(ytdIdx.map(i => totalNums[i]));
  const totalAnnualFc = totalYtd + sum(totalFc.fc.filter((_, i) => yearOf(fmonths[i]) === year));

  const total = {
    nums: totalNums,
    vR: totRef,
    vP: pi >= 0 ? totalNums[pi] : null,
    vY: yi >= 0 ? totalNums[yi] : null,
    ytd: totalYtd,
    ytdL: totalYtdL,
    fc: totalFc,
    mom: totalMom,
    d: totalD,
    yoy: totalYoy,
    avg: totalAvg,
    annualFc: totalAnnualFc
  };

  const sorted = G.slice().sort((a, b) => b.ytd - a.ytd);
  const top10 = sum(sorted.slice(0, 10).map(x => x.ytd));
  let cumShare = 0;
  let k80 = 0;
  sorted.forEach(x => {
    if (cumShare < 80 && total.ytd) {
      cumShare += (x.ytd / total.ytd) * 100;
      k80++;
    }
  });

  return {
    cfg,
    months,
    ref,
    ri,
    pi,
    yi,
    year,
    ytdIdx,
    hasLY,
    fmonths,
    G,
    Z,
    total,
    port,
    cnt,
    nCust: G.length,
    nActive: activeG.length,
    nFm: sum(G.map(x => x.nFm)),
    nFmActive: sum(G.map(x => x.g.fms.filter(f => (f.v[ref] || 0) > 0).length)),
    top10Share: total.ytd ? (top10 / total.ytd) * 100 : 0,
    k80,
    sorted,
    minAbs,
    hasContract: G.some(x => x.contract)
  };
}

export function checkQuality(usage: UsageData, model: AnalysisModel): QualityCheckItem[] {
  const out: QualityCheckItem[] = [];
  const months = model.months;
  const last = months[months.length - 1];
  const blanks: string[] = [];
  const neg: string[] = [];
  const allZero: string[] = [];

  usage.customers.forEach(c => {
    months.forEach(m => {
      if (c.v[m] == null) blanks.push(c.id + ' ' + ymShort(m));
      else if ((c.v[m] || 0) < 0) neg.push(c.id + ' ' + ymShort(m));
    });
    if (months.every(m => !c.v[m])) allZero.push(c.id + ' ' + c.nama);
  });

  const futureUsed: string[] = [];
  usage.customers.forEach(c => {
    (usage.future || []).forEach(m => {
      if ((c.v[m] || 0) > 0) futureUsed.push(c.id);
    });
  });

  out.push({
    ok: true,
    t: 'Data terbaca: ' + usage.customers.length + ' FM, ' + model.groups.length + ' pelanggan, ' + model.zonas.length + ' zona, ' + months.length + ' bulan (' + ymLabel(months[0]) + ' - ' + ymLabel(last) + ').'
  });
  out.push({
    ok: true,
    t: 'Bulan terakhir yang terisi: ' + ymFull(last) + '. Kolom bulan sesudahnya (' + ((usage.future || []).length) + ' kolom) dianggap belum berjalan dan diabaikan.'
  });
  out.push(blanks.length ? {
    ok: false,
    t: blanks.length + ' sel kosong pada bulan yang sudah berjalan (contoh: ' + blanks.slice(0, 4).join(', ') + '). Kosong dihitung 0 pada total; isi 0 bila memang tidak ada pemakaian.'
  } : {
    ok: true,
    t: 'Tidak ada sel kosong pada bulan yang sudah berjalan.'
  });
  out.push(neg.length ? {
    ok: false,
    t: neg.length + ' nilai negatif (' + neg.slice(0, 4).join(', ') + '). Periksa kembali pencatatan.'
  } : {
    ok: true,
    t: 'Tidak ada nilai negatif.'
  });
  out.push(allZero.length ? {
    ok: false,
    t: allZero.length + ' FM tidak pernah ada pemakaian: ' + allZero.slice(0, 6).join('; ') + '.'
  } : {
    ok: true,
    t: 'Semua FM pernah mencatat pemakaian.'
  });
  if (futureUsed.length) {
    out.push({
      ok: false,
      t: 'Ada nilai lebih dari 0 pada kolom bulan di luar rentang terisi. Pastikan urutan kolom benar.'
    });
  }
  usage.warnings.forEach(w => {
    out.push({ ok: false, t: w });
  });
  return out;
}

export function extractStoppedCustomers(
  usageAll: UsageData,
  activeKeys: Set<string> | null,
  refMonth: string
): StoppedCustomer[] {
  if (!usageAll.ok || !activeKeys || activeKeys.size === 0) return [];

  const isCustActive = (c: CustomerFlowmeter) => {
    const kNama = String(c.nama || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const kNamaNorm = normH(c.nama);
    const kGrp = String(c.group || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const kGrpNorm = normH(c.group);
    return (
      activeKeys.has(kNama) ||
      activeKeys.has(kNamaNorm) ||
      activeKeys.has(kGrp) ||
      activeKeys.has(kGrpNorm)
    );
  };

  // Group all customers by company group
  const groupMap: Record<string, CustomerFlowmeter[]> = {};
  usageAll.customers.forEach(c => {
    const grpKey = normH(c.group) || (c.kode && !c.kode.startsWith('g:') ? c.kode : normH(c.nama));
    if (!groupMap[grpKey]) groupMap[grpKey] = [];
    groupMap[grpKey].push(c);
  });

  const months = usageAll.months;
  const list: StoppedCustomer[] = [];

  Object.entries(groupMap).forEach(([kode, fms]) => {
    // If ANY flowmeter in this customer group is in the active list, this customer is ACTIVE
    const isAnyActive = fms.some(f => isCustActive(f));
    if (isAnyActive) return;

    const first = fms[0];
    const item: StoppedCustomer = {
      key: kode,
      kode: kode.startsWith('g:') ? '' : kode,
      name: first.group || first.nama,
      zona: first.zona,
      fms,
      firstMonth: null,
      lastMonth: null,
      lastVolume: 0,
      totalUsage: 0,
      activeMonthsCount: 0,
      avgActiveUsage: 0,
      monthsInactive: 0,
      nums: months.map(() => 0)
    };
    list.push(item);
  });

  list.forEach(item => {
    let firstM: string | null = null;
    let lastM: string | null = null;
    let lastV = 0;
    let tot = 0;
    let countActive = 0;

    months.forEach((ym, mi) => {
      let monthSum = 0;
      item.fms.forEach(f => {
        const v = f.v[ym];
        if (v != null && v > 0) monthSum += v;
      });
      item.nums[mi] = monthSum;
      if (monthSum > 0) {
        if (!firstM) firstM = ym;
        lastM = ym;
        lastV = monthSum;
        tot += monthSum;
        countActive++;
      }
    });

    item.firstMonth = firstM;
    item.lastMonth = lastM;
    item.lastVolume = lastV;
    item.totalUsage = tot;
    item.activeMonthsCount = countActive;
    item.avgActiveUsage = countActive > 0 ? tot / countActive : 0;

    const targetMonth = refMonth || months[months.length - 1];
    if (lastM && targetMonth && targetMonth > lastM) {
      const idxLast = months.indexOf(lastM);
      const idxTarget = months.indexOf(targetMonth);
      if (idxLast >= 0 && idxTarget >= 0) {
        item.monthsInactive = Math.max(0, idxTarget - idxLast);
      } else {
        const [y1, m1] = lastM.split('-').map(Number);
        const [y2, m2] = targetMonth.split('-').map(Number);
        item.monthsInactive = Math.max(0, (y2 - y1) * 12 + (m2 - m1));
      }
    } else {
      item.monthsInactive = 0;
    }
  });

  list.sort((a, b) => {
    if (a.lastMonth && b.lastMonth) {
      if (a.lastMonth !== b.lastMonth) return b.lastMonth.localeCompare(a.lastMonth);
    }
    return b.totalUsage - a.totalUsage;
  });

  return list;
}

