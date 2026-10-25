import React, { useState, useEffect, useMemo } from 'react';
import {
  AppConfig,
  UsageData,
  AnalysisResult,
  WeeklyAnalysis
} from './types';
import * as FM from './lib/fm';
import * as W from './lib/weekly';
import { zc, Panel } from './lib/format';
import { readExcelOrCSV } from './lib/excel';
import { RingkasanView } from './views/RingkasanView';
import { KontrakView } from './views/KontrakView';
import { ZonaView } from './views/ZonaView';
import { PelangganView } from './views/PelangganView';
import { PelangganBerhentiView } from './views/PelangganBerhentiView';
import { DataView } from './views/DataView';
import { ProyeksiView } from './views/ProyeksiView';
import { MingguanRingkasanView } from './views/MingguanRingkasanView';
import { MingguanZonaView } from './views/MingguanZonaView';
import { MingguanPelangganView } from './views/MingguanPelangganView';
import { MingguanProyeksiView } from './views/MingguanProyeksiView';
import { KorelasiHybridView } from './views/KorelasiHybridView';
import { CustomerModal } from './components/CustomerModal';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import {
  fetchLiveSpreadsheetData,
  STORAGE_KEYS,
  getMasterSpreadsheetId,
  setMasterSpreadsheetId,
  clearMasterSpreadsheet
} from './lib/googleSheets';


// Module and Sub-tab Definitions
type MainModule = 'bulanan' | 'mingguan' | 'korelasi' | 'data' | 'berhenti';

interface SubTabItem {
  id: string;
  label: string;
}

const MODULE_SUBTABS: Record<MainModule, SubTabItem[]> = {
  bulanan: [
    { id: 'ringkasan', label: 'Ringkasan' },
    { id: 'kontrak', label: 'Kontrak' },
    { id: 'zona', label: 'Zona' },
    { id: 'pelanggan', label: 'Pelanggan' },
    { id: 'proyeksi', label: 'Proyeksi' }
  ],
  mingguan: [
    { id: 'ringkasan', label: 'Ringkasan' },
    { id: 'zona', label: 'Zona' },
    { id: 'pelanggan', label: 'Pelanggan' },
    { id: 'proyeksi', label: 'Proyeksi' }
  ],
  korelasi: [],
  data: [],
  berhenti: []
};

async function fetchText(path: string): Promise<string | null> {
  try {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function nkey(s: any): string {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export const App: React.FC = () => {
  // Navigation State
  const [activeModule, setActiveModule] = useState<MainModule>('bulanan');
  const [bulananSubTab, setBulananSubTab] = useState<string>('ringkasan');
  const [mingguanSubTab, setMingguanSubTab] = useState<string>('ringkasan');

  // Filter State
  const [zona, setZona] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [refMonth, setRefMonth] = useState<string>('');
  const [threshold, setThreshold] = useState<number>(30);
  const [theme, setTheme] = useState<string>('auto');
  const [sim, setSim] = useState<boolean>(false);
  const [preview, setPreview] = useState<boolean>(false);
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState<string | null>(null);

  // Original text storage
  const [baseConfig, setBaseConfig] = useState<AppConfig>(FM.DEFAULT_CFG);
  const [baseUsageText, setBaseUsageText] = useState<string>('');
  const [baseContractText, setBaseContractText] = useState<string>('');
  const [baseWeeklyText, setBaseWeeklyText] = useState<string>('');
  const [baseActiveText, setBaseActiveText] = useState<string>('');

  // Active working text storage
  const [usageText, setUsageText] = useState<string>('');
  const [contractText, setContractText] = useState<string>('');
  const [weeklyText, setWeeklyText] = useState<string>('');
  const [activeText, setActiveText] = useState<string>('');

  // Google Sheets integration state
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState<boolean>(false);
  const [linkedSheetId, setLinkedSheetId] = useState<string>('');
  const [linkedSheetTitle, setLinkedSheetTitle] = useState<string>('');
  const [isMasterDatabase, setIsMasterDatabase] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isRefreshingLive, setIsRefreshingLive] = useState<boolean>(false);
  const [liveSyncToast, setLiveSyncToast] = useState<{ text: string; isError?: boolean } | null>(null);


  // Initialize Theme
  useEffect(() => {
    let saved = 'auto';
    try {
      saved = localStorage.getItem('fm-theme') || 'auto';
    } catch {}
    setTheme(saved);
    applyThemeToDOM(saved);
  }, []);

  const applyThemeToDOM = (t: string) => {
    const r = document.documentElement;
    if (t === 'auto') {
      r.removeAttribute('data-theme');
    } else {
      r.setAttribute('data-theme', t);
    }
    try {
      localStorage.setItem('fm-theme', t);
    } catch {}
  };

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    applyThemeToDOM(newTheme);
  };

  // URL Hash Sync for Two-Level Navigation
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      const parts = hash.split('/');
      const mod = parts[0] as MainModule;
      if (['bulanan', 'mingguan', 'korelasi', 'data', 'berhenti'].includes(mod)) {
        setActiveModule(mod);
        if (parts[1]) {
          if (mod === 'bulanan') setBulananSubTab(parts[1]);
          if (mod === 'mingguan') setMingguanSubTab(parts[1]);
        }
      }
    }

    const handleHashChange = () => {
      const h = window.location.hash.slice(1);
      if (h) {
        const parts = h.split('/');
        const mod = parts[0] as MainModule;
        if (['bulanan', 'mingguan', 'korelasi', 'data', 'berhenti'].includes(mod)) {
          setActiveModule(mod);
          if (parts[1]) {
            if (mod === 'bulanan') setBulananSubTab(parts[1]);
            if (mod === 'mingguan') setMingguanSubTab(parts[1]);
          }
        }
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const updateHash = (mod: MainModule, sub?: string) => {
    const hash = sub ? `${mod}/${sub}` : mod;
    try {
      window.history.replaceState(null, '', `#${hash}`);
    } catch {
      window.location.hash = hash;
    }
  };

  const handleModuleChange = (mod: MainModule) => {
    setActiveModule(mod);
    const sub = mod === 'bulanan' ? bulananSubTab : mod === 'mingguan' ? mingguanSubTab : undefined;
    updateHash(mod, sub);
    window.scrollTo(0, 0);
  };

  const handleSubTabChange = (sub: string) => {
    if (activeModule === 'bulanan') {
      setBulananSubTab(sub);
      updateHash('bulanan', sub);
    } else if (activeModule === 'mingguan') {
      setMingguanSubTab(sub);
      updateHash('mingguan', sub);
    }
    window.scrollTo(0, 0);
  };

  // Initial Load
  useEffect(() => {
    async function init() {
      setLoading(true);
      const [cfgTxt, uTxt, cTxt, wTxt, aTxt] = await Promise.all([
        fetchText('/data/config.json'),
        fetchText('/data/pemakaian.csv'),
        fetchText('/data/kontrak.csv'),
        fetchText('/data/mingguan.csv'),
        fetchText('/data/pelanggan_aktif.csv')
      ]);

      let cfg = FM.DEFAULT_CFG;
      if (cfgTxt) {
        try {
          cfg = { ...FM.DEFAULT_CFG, ...JSON.parse(cfgTxt) };
        } catch {}
      }
      setBaseConfig(cfg);
      setThreshold(cfg.ambang_perubahan);

      if (!uTxt) {
        setFatalError('File data/pemakaian.csv tidak ditemukan atau tidak bisa dibuka.');
        setLoading(false);
        return;
      }

      setBaseUsageText(uTxt);
      setBaseContractText(cTxt || '');
      setBaseWeeklyText(wTxt || '');
      setBaseActiveText(aTxt || '');

      let initialUsage = uTxt;
      let initialContract = cTxt || '';
      let initialWeekly = wTxt || '';
      let initialActive = aTxt || '';
      let isCached = false;

      // 1. Periksa apakah Master Spreadsheet ID tersimpan atau ada di config
      const masterId = getMasterSpreadsheetId() || cfg.master_spreadsheet_id || '1pG_wyRh482dkLYetz_cxGNyy6xA4kTYnBn7ElE1CKAY';
      const isMasterSaved =
        localStorage.getItem(STORAGE_KEYS.IS_MASTER_ACTIVE) === 'true' ||
        Boolean(cfg.master_spreadsheet_id) ||
        Boolean(masterId);

      if (masterId && isMasterSaved) {
        setLinkedSheetId(masterId);
        setIsMasterDatabase(true);

        // 1a. Tampilkan cache lokal instan agar UI tidak berkedip kosong
        try {
          const cachedUsage = localStorage.getItem(STORAGE_KEYS.CACHED_USAGE);
          const cachedContract = localStorage.getItem(STORAGE_KEYS.CACHED_CONTRACT);
          const cachedWeekly = localStorage.getItem(STORAGE_KEYS.CACHED_WEEKLY);
          const cachedActive = localStorage.getItem(STORAGE_KEYS.CACHED_ACTIVE);
          const savedSyncTime = localStorage.getItem(STORAGE_KEYS.LAST_SYNC);

          if (cachedUsage) {
            initialUsage = cachedUsage;
            if (cachedContract) initialContract = cachedContract;
            if (cachedWeekly) initialWeekly = cachedWeekly;
            if (cachedActive) initialActive = cachedActive;
            if (savedSyncTime) setLastSyncTime(savedSyncTime);
          }
        } catch {}

        setUsageText(initialUsage);
        setContractText(initialContract);
        setWeeklyText(initialWeekly);
        setActiveText(initialActive);
        setLoading(false);

        // 1b. Otomatis tarik data TERBARU langsung dari Google Spreadsheet Master
        try {
          const liveRes = await fetchLiveSpreadsheetData(masterId);
          if (liveRes.ok && liveRes.usageText) {
            setUsageText(liveRes.usageText);
            if (liveRes.weeklyText) setWeeklyText(liveRes.weeklyText);
            if (liveRes.contractText) setContractText(liveRes.contractText);
            if (liveRes.activeText) setActiveText(liveRes.activeText);

            const syncTimeStr = liveRes.summary?.lastUpdated || new Date().toLocaleString('id-ID');
            setLastSyncTime(syncTimeStr);

            try {
              localStorage.setItem(STORAGE_KEYS.LAST_SYNC, syncTimeStr);
              localStorage.setItem(STORAGE_KEYS.CACHED_USAGE, liveRes.usageText);
              if (liveRes.weeklyText) localStorage.setItem(STORAGE_KEYS.CACHED_WEEKLY, liveRes.weeklyText);
              if (liveRes.contractText) localStorage.setItem(STORAGE_KEYS.CACHED_CONTRACT, liveRes.contractText);
              if (liveRes.activeText) localStorage.setItem(STORAGE_KEYS.CACHED_ACTIVE, liveRes.activeText);
            } catch {}
          }
        } catch (e) {
          // Jika pengguna sedang offline, dashboard tetap aman berjalan dengan data cache terakhir
        }
        return;
      }

      // Jika belum ada Master Spreadsheet, gunakan cache pratinjau biasa jika ada
      try {
        const savedSheetId = localStorage.getItem(STORAGE_KEYS.LINKED_SHEET_ID) || '';
        const savedSyncTime = localStorage.getItem(STORAGE_KEYS.LAST_SYNC) || null;
        if (savedSheetId) setLinkedSheetId(savedSheetId);
        if (savedSyncTime) setLastSyncTime(savedSyncTime);

        const cachedUsage = localStorage.getItem(STORAGE_KEYS.CACHED_USAGE);
        const cachedContract = localStorage.getItem(STORAGE_KEYS.CACHED_CONTRACT);
        const cachedWeekly = localStorage.getItem(STORAGE_KEYS.CACHED_WEEKLY);
        const cachedActive = localStorage.getItem(STORAGE_KEYS.CACHED_ACTIVE);

        if (cachedUsage) {
          initialUsage = cachedUsage;
          if (cachedContract) initialContract = cachedContract;
          if (cachedWeekly) initialWeekly = cachedWeekly;
          if (cachedActive) initialActive = cachedActive;
          isCached = true;
        }
      } catch {}

      setUsageText(initialUsage);
      setContractText(initialContract);
      setWeeklyText(initialWeekly);
      setActiveText(initialActive);
      if (isCached) setPreview(true);

      setLoading(false);
    }
    init();
  }, []);

  // Quick refresh live data directly from Google Sheets
  const handleRefreshLiveData = async () => {
    const targetId = linkedSheetId || getMasterSpreadsheetId() || baseConfig.master_spreadsheet_id || '1pG_wyRh482dkLYetz_cxGNyy6xA4kTYnBn7ElE1CKAY';
    if (!targetId) {
      setIsSheetsModalOpen(true);
      return;
    }

    setIsRefreshingLive(true);
    setLiveSyncToast(null);

    try {
      const liveRes = await fetchLiveSpreadsheetData(targetId);
      if (liveRes.ok && liveRes.usageText) {
        setUsageText(liveRes.usageText);
        if (liveRes.weeklyText) setWeeklyText(liveRes.weeklyText);
        if (liveRes.contractText) setContractText(liveRes.contractText);
        if (liveRes.activeText) setActiveText(liveRes.activeText);

        const syncTimeStr = liveRes.summary?.lastUpdated || new Date().toLocaleString('id-ID');
        setLastSyncTime(syncTimeStr);
        setPreview(false);

        try {
          localStorage.setItem(STORAGE_KEYS.LAST_SYNC, syncTimeStr);
          localStorage.setItem(STORAGE_KEYS.CACHED_USAGE, liveRes.usageText);
          if (liveRes.weeklyText) localStorage.setItem(STORAGE_KEYS.CACHED_WEEKLY, liveRes.weeklyText);
          if (liveRes.contractText) localStorage.setItem(STORAGE_KEYS.CACHED_CONTRACT, liveRes.contractText);
          if (liveRes.activeText) localStorage.setItem(STORAGE_KEYS.CACHED_ACTIVE, liveRes.activeText);
        } catch {}

        setLiveSyncToast({
          text: `Data live berhasil diperbarui dari Google Sheets (${liveRes.summary?.monthlyRows || 0} bulanan, ${liveRes.summary?.weeklyRows || 0} mingguan)`
        });
        setTimeout(() => setLiveSyncToast(null), 4500);
      } else {
        setLiveSyncToast({
          text: liveRes.error || 'Gagal menyegarkan data. Pastikan izin Google Spreadsheet disetel ke Pelihat.',
          isError: true
        });
        setTimeout(() => setLiveSyncToast(null), 5000);
      }
    } catch (err: any) {
      setLiveSyncToast({
        text: err.message || 'Gagal menghubungi Google Sheets.',
        isError: true
      });
      setTimeout(() => setLiveSyncToast(null), 5000);
    } finally {
      setIsRefreshingLive(false);
    }
  };

  // Live data auto-refresh interval (30 minutes)
  useEffect(() => {
    const interval = setInterval(() => {
      handleRefreshLiveData();
    }, 30 * 60 * 1000); // 30 minutes
    return () => clearInterval(interval);
  }, [linkedSheetId, isMasterDatabase]);

  // Parse Active Customer Keys
  const activeKeys = useMemo<Set<string> | null>(() => {
    if (!activeText) return null;
    const rows = FM.readCSV(activeText).slice(1);
    const set = new Set<string>();
    rows.forEach(r => {
      if (r[0]) {
        set.add(nkey(r[0]));
        set.add(FM.normH(r[0]));
      }
      if (r[1]) {
        set.add(nkey(r[1]));
        set.add(FM.normH(r[1]));
      }
    });
    return set.size ? set : null;
  }, [activeText]);

  // Parse Base Usage Data
  const usageAll = useMemo<UsageData>(() => {
    if (!usageText) return { ok: false, error: 'Belum ada data', customers: [], months: [], headerMonths: [], future: [], warnings: [] };
    return FM.loadUsage(usageText);
  }, [usageText]);

  // Filter Active Customers (Operational views focus strictly on active customers)
  const { usage } = useMemo(() => {
    if (!usageAll.ok) return { usage: usageAll };
    let u = usageAll;
    if (activeKeys && activeKeys.size > 0) {
      const isCustActive = (c: any) => {
        const kNama = nkey(c.nama);
        const kNamaNorm = FM.normH(c.nama);
        const kGrp = nkey(c.group);
        const kGrpNorm = FM.normH(c.group);
        return (
          activeKeys.has(kNama) ||
          activeKeys.has(kNamaNorm) ||
          activeKeys.has(kGrp) ||
          activeKeys.has(kGrpNorm)
        );
      };
      const cs = u.customers.filter(c => isCustActive(c));
      if (cs.length > 0) {
        u = { ...u, customers: cs };
      }
    }
    return { usage: u };
  }, [usageAll, activeKeys]);

  // Extract Inactive/Stopped Customers for Dedicated Tab
  const stoppedCustomers = useMemo(() => {
    return FM.extractStoppedCustomers(usageAll, activeKeys, refMonth);
  }, [usageAll, activeKeys, refMonth]);

  // Build Monthly Model (Active Customers)
  const model = useMemo(() => {
    if (!usage.ok) return { months: [], groups: [], zonas: [], customers: [], future: [] };
    return FM.buildModel(usage);
  }, [usage]);

  // Extract available years from months
  const availableYears = useMemo<number[]>(() => {
    if (!model.months.length) return [2026];
    const yrSet = new Set<number>();
    model.months.forEach(m => yrSet.add(FM.yearOf(m)));
    return Array.from(yrSet).sort((a, b) => a - b);
  }, [model.months]);

  // Set default year and reference month
  useEffect(() => {
    if (availableYears.length > 0) {
      if (!availableYears.includes(selectedYear)) {
        setSelectedYear(availableYears[availableYears.length - 1]);
      }
    }
  }, [availableYears, selectedYear]);

  // Available months in selected year
  const monthsInSelectedYear = useMemo<string[]>(() => {
    return model.months.filter(m => FM.yearOf(m) === selectedYear);
  }, [model.months, selectedYear]);

  useEffect(() => {
    if (monthsInSelectedYear.length > 0) {
      if (!refMonth || !monthsInSelectedYear.includes(refMonth)) {
        setRefMonth(monthsInSelectedYear[monthsInSelectedYear.length - 1]);
      }
    } else if (model.months.length > 0) {
      setRefMonth(model.months[model.months.length - 1]);
    }
  }, [monthsInSelectedYear, refMonth, model.months]);

  // Parse Contracts
  const { contracts, cwarn } = useMemo(() => {
    if (!contractText) return { contracts: [], cwarn: [] };
    const res = FM.loadContracts(contractText);
    return { contracts: res.rows, cwarn: res.warnings };
  }, [contractText]);

  // Parse Weekly
  const { weekly, weeklyWarn } = useMemo(() => {
    if (!weeklyText) return { weekly: null, weeklyWarn: [] };
    const res = W.loadWeekly(weeklyText);
    if (res.ok) {
      return { weekly: res, weeklyWarn: res.warnings };
    }
    return { weekly: null, weeklyWarn: [res.error || 'Gagal membaca file mingguan'] };
  }, [weeklyText]);

  // Monthly Analysis computation
  const simActive = sim && contracts.length === 0;
  const analysis = useMemo<AnalysisResult | null>(() => {
    if (!model.months.length || !refMonth) return null;
    const contractRows = simActive ? FM.simulateContracts(model) : contracts;
    return FM.analyze(model, {
      cfg: { ...baseConfig, ambang_perubahan: threshold },
      ref: refMonth,
      zona,
      contractRows
    });
  }, [model, refMonth, zona, threshold, simActive, contracts, baseConfig]);

  // Weekly Analysis computation
  const weeklyAnalysis = useMemo<WeeklyAnalysis | null>(() => {
    if (!weekly || !model.customers.length) return null;
    const mode = W.bestMode(weekly, model);
    return W.analyze(weekly, model, { th: threshold, zona, mode });
  }, [weekly, model, threshold, zona]);

  // Full Model & Analysis for inspecting stopped customers in detail modal
  const fullModel = useMemo(() => {
    if (!usageAll.ok) return null;
    return FM.buildModel(usageAll);
  }, [usageAll]);

  const fullAnalysis = useMemo<AnalysisResult | null>(() => {
    if (!fullModel || !fullModel.months.length || !refMonth) return null;
    const contractRows = simActive ? FM.simulateContracts(fullModel) : contracts;
    return FM.analyze(fullModel, {
      cfg: { ...baseConfig, ambang_perubahan: threshold },
      ref: refMonth,
      zona: '',
      contractRows
    });
  }, [fullModel, refMonth, simActive, contracts, baseConfig, threshold]);

  // Selected customer for modal (find in active analysis or full analysis)
  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerKey) return null;
    if (analysis) {
      const found = analysis.G.find(g => g.key === selectedCustomerKey);
      if (found) return found;
    }
    if (fullAnalysis) {
      const foundFull = fullAnalysis.G.find(g => g.key === selectedCustomerKey);
      if (foundFull) return foundFull;
    }
    return null;
  }, [selectedCustomerKey, analysis, fullAnalysis]);



  // Reset Preview
  const handleResetPreview = () => {
    setUsageText(baseUsageText);
    setContractText(baseContractText);
    setWeeklyText(baseWeeklyText);
    setActiveText(baseActiveText);
    setPreview(false);
    try {
      localStorage.removeItem('fm-cached-usage');
      localStorage.removeItem('fm-cached-contract');
      localStorage.removeItem('fm-cached-weekly');
      localStorage.removeItem('fm-cached-active');
    } catch {}
  };

  const handlePreviewUsage = async (file: File) => {
    const txt = await readExcelOrCSV(file);
    setUsageText(txt);
    setPreview(true);
  };

  const handlePreviewContracts = async (file: File) => {
    const txt = await readExcelOrCSV(file);
    setContractText(txt);
    setPreview(true);
  };

  const handlePreviewWeekly = async (file: File) => {
    const txt = await readExcelOrCSV(file);
    setWeeklyText(txt);
    setPreview(true);
  };

  const handlePreviewActive = async (file: File) => {
    const txt = await readExcelOrCSV(file);
    setActiveText(txt);
    setPreview(true);
  };

  if (loading) {
    return (
      <div className="wrap">
        <div className="banner" style={{ marginTop: 40 }}>
          <span>Memuat data flowmeter…</span>
        </div>
      </div>
    );
  }

  if (fatalError || !usage.ok) {
    return (
      <div className="wrap" style={{ marginTop: 24 }}>
        <div className="banner bad">
          <span>
            <b>Data tidak bisa dibaca.</b> {fatalError || usage.error}
          </span>
        </div>
        <Panel title="Cara memperbaiki">
          <ul className="dl-list">
            <li>
              Pastikan file <span className="mono">data/pemakaian.csv</span> ada dan baris
              pertamanya berisi judul kolom: Zona, No.Pel, Group, Nama Pelanggan, lalu satu kolom
              per bulan (contoh 2026-01).
            </li>
            <li>
              Atau pilih file CSV atau Excel (.xlsx) dari komputer untuk dipratinjau:{' '}
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={async e => {
                  if (e.target.files?.[0]) {
                    const txt = await readExcelOrCSV(e.target.files[0]);
                    setUsageText(txt);
                    setFatalError(null);
                  }
                }}
              />
            </li>
          </ul>
        </Panel>
      </div>
    );
  }

  // Active customer count
  const activeCustomerCount = model.groups.length;

  const currentSubTabs = MODULE_SUBTABS[activeModule] || [];

  return (
    <div className="wrap">
      {/* Top Chrome */}
      <div className="chrome">
        <header className="top" style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 4 }}>
          {/* Main Title Row: Title on the left, All Action Controls on the far right */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <h1 style={{ margin: 0, fontSize: 'clamp(24px, 3.6vw, 32px)', lineHeight: 1 }}>{baseConfig.judul}</h1>
            </div>

            <div className="top-r" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', margin: 0 }}>
              {linkedSheetId && (
                <button
                  className="btn"
                  onClick={handleRefreshLiveData}
                  disabled={isRefreshingLive}
                  title={`Segarkan data live langsung dari Google Sheets (Sinkron terakhir: ${lastSyncTime || 'Belum tersinkron'})`}
                  style={{
                    fontSize: 12,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    borderColor: isMasterDatabase ? '#1baf7a' : 'var(--line)',
                    padding: '4px 9px',
                    minHeight: 28
                  }}
                >
                  <span className={isRefreshingLive ? 'spin-anim' : ''} style={{ fontSize: 12 }}>
                    🔄
                  </span>
                  <span>{isRefreshingLive ? 'Menyegarkan…' : 'Segarkan Data'}</span>
                </button>
              )}

              <button
                className="btn"
                onClick={() => setIsSheetsModalOpen(true)}
                title="Kelola & Pengaturan Database Google Sheets"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  borderColor: linkedSheetId ? '#1baf7a' : 'var(--line)',
                  background: isMasterDatabase ? 'rgba(27,175,122,0.08)' : undefined,
                  padding: '4px 9px',
                  minHeight: 28,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#0F9D58">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 7h10v2H7zm0 4h10v2H7zm0 4h7v2H7z"/>
                </svg>
                <span>{isMasterDatabase ? 'Live Database' : 'Google Sheets'}</span>
                {linkedSheetId && (
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: '#1baf7a',
                      boxShadow: '0 0 5px #1baf7a',
                      display: 'inline-block'
                    }}
                    title="Database Utama Aktif"
                  />
                )}
              </button>

              <select
                value={theme}
                onChange={e => handleThemeChange(e.target.value)}
                className="themebtn"
                aria-label="Tema tampilan"
                style={{
                  minHeight: 28,
                  padding: '3px 7px',
                  fontSize: 11.5,
                  borderRadius: 6
                }}
              >
                <option value="auto">Tema otomatis</option>
                <option value="light">Terang</option>
                <option value="dark">Gelap</option>
              </select>

              <div
                className="creator"
                title="Pembuat dashboard"
                style={{
                  padding: '2px 8px',
                  borderRadius: 6,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <span
                  className="av"
                  style={{
                    width: 22,
                    height: 22,
                    fontSize: 11.5,
                    borderRadius: 4
                  }}
                >
                  {(baseConfig.pembuat || 'J').charAt(0).toUpperCase()}
                </span>
                <span style={{ fontSize: 11.5, lineHeight: 1.15 }}>
                  <small style={{ fontSize: 9, display: 'block', color: 'var(--muted)', textTransform: 'uppercase' }}>Dibuat oleh</small>
                  <strong>{baseConfig.pembuat}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Subtitle Info Row */}
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.35 }}>
            Mulai data: {model.months.length ? FM.ymFull(model.months[0]) : '–'} ·{' '}
            <b>{activeCustomerCount} pelanggan aktif saat ini</b> · 4 zona distribusi air
            {isMasterDatabase && linkedSheetId && (
              <>
                {' '}· <span style={{ color: '#1baf7a', fontWeight: 600 }}>● Database Google Sheets Live</span>
              </>
            )}
          </p>
        </header>

        {/* Live Sync Toast Banner */}
        {liveSyncToast && (
          <div
            style={{
              padding: '8px 14px',
              margin: '6px 0 10px',
              borderRadius: 6,
              background: liveSyncToast.isError ? 'var(--critical-bg)' : 'var(--good-bg)',
              color: liveSyncToast.isError ? 'var(--critical-tx)' : 'var(--good-tx)',
              border: `1px solid ${liveSyncToast.isError ? 'var(--critical)' : 'var(--good)'}`,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10
            }}
          >
            <span>{liveSyncToast.isError ? '⚠️' : '✓'} {liveSyncToast.text}</span>
            <button
              onClick={() => setLiveSyncToast(null)}
              style={{ background: 'none', border: 0, cursor: 'pointer', color: 'inherit', fontWeight: 700 }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Level 1: Main Module Navigation */}
        <nav className="tabs" role="tablist" aria-label="Modul utama dashboard" style={{ borderBottom: '2px solid var(--line)' }}>
          <button
            className="tab"
            role="tab"
            aria-selected={activeModule === 'bulanan'}
            onClick={() => handleModuleChange('bulanan')}
            style={{ fontWeight: 600, fontSize: 15 }}
          >
            Bulanan
          </button>
          <button
            className="tab"
            role="tab"
            aria-selected={activeModule === 'mingguan'}
            onClick={() => handleModuleChange('mingguan')}
            style={{ fontWeight: 600, fontSize: 15 }}
          >
            Mingguan
          </button>
          <button
            className="tab"
            role="tab"
            aria-selected={activeModule === 'korelasi'}
            onClick={() => handleModuleChange('korelasi')}
            style={{ fontWeight: 600, fontSize: 15 }}
          >
            Bulanan × Mingguan
          </button>
          <button
            className="tab"
            role="tab"
            aria-selected={activeModule === 'data'}
            onClick={() => handleModuleChange('data')}
            style={{ fontWeight: 600, fontSize: 15 }}
          >
            Data & Metode
          </button>
          <button
            className="tab"
            role="tab"
            aria-selected={activeModule === 'berhenti'}
            onClick={() => handleModuleChange('berhenti')}
            style={{ fontWeight: 600, fontSize: 15 }}
          >
            Pelanggan Berhenti
          </button>
        </nav>

        {/* Level 2: Sub-Tabs (Contextual, hidden unless parent module is active) */}
        {currentSubTabs.length > 0 && (
          <div
            className="tabs"
            role="tablist"
            aria-label="Sub bagian modul"
            style={{
              paddingTop: 2,
              marginTop: 0,
              background: 'var(--surface)',
              borderRadius: '0 0 6px 6px',
              paddingInline: 8
            }}
          >
            {currentSubTabs.map(st => {
              const isActive =
                activeModule === 'bulanan'
                  ? bulananSubTab === st.id
                  : mingguanSubTab === st.id;
              return (
                <button
                  key={st.id}
                  className="tab"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => handleSubTabChange(st.id)}
                  style={{ fontSize: 13 }}
                >
                  {st.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Filters Bar */}
        <div className="filters">
          <div className="fld">
            <span className="cap">Zona</span>
            <div className="chips">
              <button
                className="chip"
                aria-pressed={!zona}
                onClick={() => setZona('')}
              >
                Semua zona
              </button>
              {model.zonas.map(z => (
                <button
                  key={z}
                  className="chip"
                  aria-pressed={zona === z}
                  onClick={() => setZona(z)}
                >
                  <i style={{ background: zc(z, model.zonas) }} />
                  {z}
                </button>
              ))}
            </div>
          </div>

          {/* Year and Reference Month Selectors for Bulanan */}
          {activeModule === 'bulanan' && (
            <>
              <div className="fld">
                <label htmlFor="f-year">Tahun</label>
                <select
                  id="f-year"
                  value={selectedYear}
                  onChange={e => {
                    const yr = +e.target.value;
                    setSelectedYear(yr);
                    const inYear = model.months.filter(m => FM.yearOf(m) === yr);
                    if (inYear.length) setRefMonth(inYear[inYear.length - 1]);
                  }}
                >
                  {availableYears.map(yr => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="fld">
                <label htmlFor="f-ref">Bulan acuan</label>
                <select
                  id="f-ref"
                  value={refMonth}
                  onChange={e => setRefMonth(e.target.value)}
                >
                  {monthsInSelectedYear.map(m => (
                    <option key={m} value={m}>
                      {FM.ymFull(m)}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="fld">
            <label htmlFor="f-th">
              {activeModule === 'mingguan' ? 'Ambang lonjakan/anjlok' : 'Ambang naik/turun tajam'}
            </label>
            <select
              id="f-th"
              value={threshold}
              onChange={e => setThreshold(+e.target.value)}
            >
              <option value="20">±20%</option>
              <option value="30">±30%</option>
              <option value="50">±50%</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main View Area */}
      <main aria-live="polite">
        {/* Warning Banners */}
        {preview && (
          <div className="banner warn">
            <span>
              {lastSyncTime ? (
                <>
                  <b>Data disinkronkan dari Google Sheets.</b> Terakhir diperbarui: {lastSyncTime}.
                </>
              ) : (
                <>
                  Mode pratinjau: menampilkan file lokal (CSV / Excel) yang Anda pilih. Data di situs tidak berubah.
                </>
              )}
            </span>
            <button className="btn" onClick={handleResetPreview}>
              Kembali ke data bawaan
            </button>
          </div>
        )}

        {simActive && (
          <div className="banner warn">
            <span>
              <b>SIMULASI.</b> Kontrak di bawah ini bukan kontrak asli. Nilainya dibuat dari
              rata-rata pemakaian 6 bulan pertama (dibulatkan 50 m³) hanya untuk memperlihatkan
              tampilan. Isi data/kontrak.csv untuk memakai kontrak sebenarnya.
            </span>
            <button className="btn" onClick={() => setSim(false)}>
              Matikan simulasi
            </button>
          </div>
        )}

        {/* View Routing */}
        {activeModule === 'bulanan' && analysis && (
          <>
            {bulananSubTab === 'ringkasan' && (
              <RingkasanView
                A={analysis}
                zona={zona}
                simActive={simActive}
                onOpenCustomer={k => setSelectedCustomerKey(k)}
              />
            )}
            {bulananSubTab === 'kontrak' && (
              <KontrakView
                A={analysis}
                simActive={simActive}
                onSimOn={() => setSim(true)}
                onOpenCustomer={k => setSelectedCustomerKey(k)}
              />
            )}
            {bulananSubTab === 'zona' && (
              <ZonaView
                A={analysis}
                zona={zona}
                onSelectZona={setZona}
                onOpenCustomer={k => setSelectedCustomerKey(k)}
                weeklyAnalysis={weeklyAnalysis}
                lastSyncTime={lastSyncTime}
              />
            )}
            {bulananSubTab === 'pelanggan' && (
              <PelangganView
                A={analysis}
                onOpenCustomer={k => setSelectedCustomerKey(k)}
              />
            )}
            {bulananSubTab === 'proyeksi' && (
              <ProyeksiView
                A={analysis}
                simActive={simActive}
                contracts={contracts}
                onOpenCustomer={k => setSelectedCustomerKey(k)}
              />
            )}
          </>
        )}

        {activeModule === 'mingguan' && (
          <>
            {mingguanSubTab === 'ringkasan' && (
              <MingguanRingkasanView
                A={weeklyAnalysis}
                model={model}
                cfg={baseConfig}
                zona={zona}
                contracts={contracts}
                simActive={simActive}
                onOpenCustomer={k => setSelectedCustomerKey(k)}
              />
            )}
            {mingguanSubTab === 'zona' && (
              <MingguanZonaView
                A={weeklyAnalysis}
                model={model}
                zona={zona}
                onSelectZona={setZona}
                onOpenCustomer={k => setSelectedCustomerKey(k)}
                monthlyAnalysis={analysis}
                lastSyncTime={lastSyncTime}
              />
            )}
            {mingguanSubTab === 'pelanggan' && (
              <MingguanPelangganView
                A={weeklyAnalysis}
                onOpenCustomer={k => setSelectedCustomerKey(k)}
              />
            )}
            {mingguanSubTab === 'proyeksi' && (
              <MingguanProyeksiView
                A={weeklyAnalysis}
                model={model}
                cfg={baseConfig}
                contracts={contracts}
                simActive={simActive}
                onOpenCustomer={k => setSelectedCustomerKey(k)}
              />
            )}
          </>
        )}

        {activeModule === 'korelasi' && (
          <KorelasiHybridView
            A={weeklyAnalysis}
            monthlyAnalysis={analysis}
            model={model}
            zona={zona}
            onSelectZona={setZona}
            onOpenCustomer={k => setSelectedCustomerKey(k)}
          />
        )}

        {activeModule === 'data' && analysis && (
          <DataView
            A={analysis}
            usage={usage}
            usageAll={usageAll}
            model={model}
            contracts={contracts}
            cwarn={cwarn}
            weekly={weekly}
            weeklyWarn={weeklyWarn}
            activeKeys={activeKeys}
            onPreviewUsage={handlePreviewUsage}
            onPreviewContracts={handlePreviewContracts}
            onPreviewWeekly={handlePreviewWeekly}
            onPreviewActive={handlePreviewActive}
            onOpenGoogleSheets={() => setIsSheetsModalOpen(true)}
            linkedSheetId={linkedSheetId}
            linkedSheetTitle={linkedSheetTitle}
            lastSyncTime={lastSyncTime}
          />
        )}

        {activeModule === 'berhenti' && (
          <PelangganBerhentiView
            stoppedList={stoppedCustomers}
            model={model}
            onOpenCustomer={k => setSelectedCustomerKey(k)}
          />
        )}
      </main>

      {/* Footer Disclaimer */}
      <footer>
        <div>
          <b>Disclaimer:</b> Analisis pada dashboard ini dihitung otomatis dari data pemakaian yang
          diinput dan bersifat pendukung keputusan, bukan pengganti pencatatan resmi. Metode yang
          dipakai: formula tetap bulanan MoM dan YoY, kumulatif tahun berjalan (YTD), kepatuhan
          kontrak dengan batas atas {baseConfig.batas_atas}% dan batas bawah {baseConfig.batas_bawah}%
          (dapat diatur), rata-rata bergerak, tren linear, Holt dengan redaman tren, rasio YoY
          musiman, serta uji mundur (MAE, WAPE) untuk memilih metode proyeksi. Proyeksi adalah
          perkiraan statistik dari pola historis dan dapat berbeda dari realisasi.
        </div>
        <div>
          © {new Date().getFullYear()} Dibuat oleh <b>{baseConfig.pembuat}</b>.
        </div>
      </footer>

      {/* Customer Detail Modal */}
      {selectedCustomer && analysis && (
        <CustomerModal
          g={selectedCustomer}
          cfg={analysis.cfg}
          months={analysis.months}
          fmonths={analysis.fmonths}
          refMonth={analysis.ref}
          year={analysis.year}
          ytdIdx={analysis.ytdIdx}
          onClose={() => setSelectedCustomerKey(null)}
        />
      )}

      {/* Google Sheets Sync & Master Database Modal */}
      <GoogleSheetsModal
        isOpen={isSheetsModalOpen}
        onClose={() => setIsSheetsModalOpen(false)}
        currentData={{
          usageText,
          weeklyText,
          contractText,
          activeText
        }}
        masterSheetId={linkedSheetId}
        isMasterActive={isMasterDatabase}
        onMasterSheetChange={(id, isMaster) => {
          setLinkedSheetId(id);
          setIsMasterDatabase(isMaster);
          if (id && isMaster) {
            setMasterSpreadsheetId(id);
            setPreview(false);
          } else {
            clearMasterSpreadsheet();
          }
        }}
        onApplyData={data => {
          setUsageText(data.usageText);
          if (data.weeklyText) setWeeklyText(data.weeklyText);
          if (data.contractText) setContractText(data.contractText);
          if (data.activeText) setActiveText(data.activeText);
          setPreview(false);
          setLastSyncTime(data.summary.lastUpdated);
          setIsMasterDatabase(true);
          try {
            localStorage.setItem(STORAGE_KEYS.CACHED_USAGE, data.usageText);
            if (data.weeklyText) localStorage.setItem(STORAGE_KEYS.CACHED_WEEKLY, data.weeklyText);
            if (data.contractText) localStorage.setItem(STORAGE_KEYS.CACHED_CONTRACT, data.contractText);
            if (data.activeText) localStorage.setItem(STORAGE_KEYS.CACHED_ACTIVE, data.activeText);
            localStorage.setItem(STORAGE_KEYS.LAST_SYNC, data.summary.lastUpdated);
          } catch {}
        }}
      />

    </div>
  );
};
