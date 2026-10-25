export interface AppConfig {
  judul: string;
  pembuat: string;
  batas_atas: number;
  batas_bawah: number;
  mendekati: number;
  ambang_perubahan: number;
  master_spreadsheet_id?: string;
}

export interface CustomerFlowmeter {
  id: string;
  kode: string;
  zona: string;
  group: string;
  nama: string;
  v: Record<string, number | null>;
}

export interface CustomerGroup {
  key: string;
  kode: string;
  group: string;
  zona: string;
  fms: CustomerFlowmeter[];
  v: Record<string, number | null>;
  nums: number[];
}

export interface StoppedCustomer {
  key: string;
  kode: string;
  name: string;
  zona: string;
  fms: CustomerFlowmeter[];
  firstMonth: string | null;
  lastMonth: string | null;
  lastVolume: number;
  totalUsage: number;
  activeMonthsCount: number;
  avgActiveUsage: number;
  monthsInactive: number;
  nums: number[];
}

export interface UsageData {
  ok: boolean;
  error?: string;
  customers: CustomerFlowmeter[];
  months: string[];
  headerMonths: string[];
  future: string[];
  warnings: string[];
}

export interface ContractRow {
  nopel: string;
  kode: string;
  group: string;
  fm: number | null;
  cum: number | null;
  year: number | null;
}

export interface ContractSummary {
  c: number;
  src: 'kumulatif' | 'jumlah FM';
  fm: Record<string, number>;
}

export type ContractStatus = 'above' | 'below' | 'nearHigh' | 'nearLow' | 'ok' | 'none';

export interface MonthContractStat {
  r: number;
  st: ContractStatus;
  c: number;
  ex: number;
  sh: number;
}

export interface ForecastCandidate {
  id: string;
  name: string;
  mae: number;
  rmse: number;
  wape: number | null;
  k: number;
  fc: number[];
}

export interface ForecastResult {
  method: string;
  methodId: string;
  fc: number[];
  lo: number[];
  hi: number[];
  cands: ForecastCandidate[];
  rmse: number;
  mae?: number;
  wape?: number | null;
  k?: number;
  n: number;
  note: string;
}

export interface GroupAnalysis {
  g: CustomerGroup;
  key: string;
  kode: string;
  name: string;
  zona: string;
  nums: number[];
  vR: number;
  vP: number | null;
  vY: number | null;
  d: number | null;
  mom: number | null;
  yoy: number | null;
  ytd: number;
  ytdL: number | null;
  avg: number;
  cv: number;
  share: number;
  flags: string[];
  flagged: boolean;
  contract: ContractSummary | null;
  ratio: number | null;
  st: ContractStatus;
  excess: number;
  short: number;
  ytdC: number;
  ytdR: number | null;
  mStat: (MonthContractStat | null)[];
  outCount: number;
  ytdEx: number;
  ytdSh: number;
  fc: ForecastResult;
  fStat: ContractStatus[];
  nFm: number;
  healthScore: number;
}

export interface ZonaAnalysis {
  zona: string;
  nums: number[];
  vR: number;
  vP: number | null;
  d: number | null;
  mom: number | null;
  yoy: number | null;
  ytd: number;
  ytdL: number | null;
  share: number;
  nCust: number;
  nActive: number;
  nFm: number;
  nContract: number;
  util: number | null;
  nAbove: number;
  nBelow: number;
  fc: ForecastResult;
}

export interface PortMonth {
  n: number;
  U: number;
  C: number;
  ratio: number | null;
  ex: number;
  sh: number;
}

export interface AnalysisModel {
  months: string[];
  groups: CustomerGroup[];
  zonas: string[];
  customers: CustomerFlowmeter[];
  future: string[];
}

export interface TotalAnalysis {
  nums: number[];
  vR: number;
  vP: number | null;
  vY: number | null;
  ytd: number;
  ytdL: number | null;
  fc: ForecastResult;
  mom: number | null;
  d: number | null;
  yoy: number | null;
  avg: number;
  annualFc: number;
}

export interface AnalysisResult {
  cfg: AppConfig;
  months: string[];
  ref: string;
  ri: number;
  pi: number;
  yi: number;
  year: number;
  ytdIdx: number[];
  hasLY: boolean;
  fmonths: string[];
  G: GroupAnalysis[];
  Z: ZonaAnalysis[];
  total: TotalAnalysis;
  port: PortMonth[];
  cnt: Record<ContractStatus, number>;
  nCust: number;
  nActive: number;
  nFm: number;
  nFmActive: number;
  top10Share: number;
  k80: number;
  sorted: GroupAnalysis[];
  minAbs: number;
  hasContract: boolean;
}

export interface QualityCheckItem {
  ok: boolean;
  t: string;
}

export interface WeeklyRow {
  group: string;
  nama: string;
  key: string;
  v: (number | null)[];
}

export interface WeeklyData {
  ok: boolean;
  error?: string;
  weeks: string[];
  rows: WeeklyRow[];
  warnings: string[];
  future: number;
}

export interface WeeklyFlowmeterDetail {
  nama: string;
  zona: string;
  v: number[];
  last: number;
  prev: number | null;
  d: number | null;
  wow: number | null;
  med8: number;
  dev: number | null;
  flags: string[];
  ytd: number;
}

export interface WeeklyCustomerAnalysis {
  x: any;
  key: string;
  kode: string;
  nama: string;
  group: string;
  zona: string;
  nFm: number;
  fms: WeeklyFlowmeterDetail[];
  v: number[];
  last: number;
  prev: number | null;
  d: number | null;
  wow: number | null;
  med8: number;
  dev: number | null;
  z: number | null;
  flags: string[];
  zeroRun: number;
  ytd: number;
  cv: number;
}

export interface WeeklyPerCustomerCorr {
  key: string;
  kode: string;
  nama: string;
  group: string;
  zona: string;
  nFm: number;
  fms: {
    nama: string;
    n: number;
    sa: number;
    se: number;
    r: number | null;
    bias: number | null;
    wape: number | null;
    grade: 'selaras' | 'cukup' | 'selisih' | 'kosong';
  }[];
  n: number;
  sa: number;
  se: number;
  r: number | null;
  bias: number | null;
  wape: number | null;
  grade: 'selaras' | 'cukup' | 'selisih' | 'kosong';
}

export interface WeeklyAnalysis {
  weeks: string[];
  n: number;
  li: number;
  rows: any[];
  total: number[];
  wow: (number | null)[];
  ma4: (number | null)[];
  Z: {
    zona: string;
    v: number[];
    last: number;
    prev: number | null;
    wow: number | null;
    avg8: number;
  }[];
  C: WeeklyCustomerAnalysis[];
  perMonth: {
    ym: string;
    est: number;
    act: number;
    diff: number | null;
  }[];
  pairs: { x: any; ym: string; a: number; e: number }[];
  corr: {
    n: number;
    pearson: number | null;
    spearman: number | null;
    bias: number | null;
    wape: number | null;
    slope: number;
    icpt: number;
    months: string[];
  };
  perC: WeeklyPerCustomerCorr[];
  proj: {
    ym: string;
    mtdDays: number;
    days: number;
    full: boolean;
    mtd: number;
    total: number;
    rows: {
      x: any;
      kode: string;
      nama: string;
      group: string;
      zona: string;
      nFm: number;
      mtd: number;
      proj: number;
      fms: { nama: string; mtd: number; proj: number }[];
    }[];
  };
  th: number;
  mode: string;
  fullMonths: string[];
}
