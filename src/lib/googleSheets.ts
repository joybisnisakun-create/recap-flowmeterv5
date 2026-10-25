import * as FM from './fm';

export interface SheetSummary {
  monthlyRows: number;
  monthlyColumns: number;
  weeklyRows: number;
  weeklyWeeks: number;
  contractRows: number;
  activeRows: number;
  lastUpdated: string;
}

export interface PullResult {
  ok: boolean;
  error?: string;
  usageText?: string;
  weeklyText?: string;
  contractText?: string;
  activeText?: string;
  summary?: SheetSummary;
}

export const DEFAULT_SHEET_NAMES = {
  monthly: 'Pemakaian Bulanan',
  weekly: 'Pemakaian Mingguan',
  contract: 'Data Kontrak',
  active: 'Pelanggan Aktif'
};

/**
 * Extracts a clean Google Spreadsheet ID from a full URL or a raw ID string.
 */
export function extractSpreadsheetId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

/**
 * Converts a 2D array of values from Google Sheets API into a properly formatted CSV string.
 */
export function gridToCSV(rows: any[][]): string {
  if (!rows || rows.length === 0) return '';
  return rows
    .map(row => {
      return row
        .map(cell => {
          if (cell === null || cell === undefined) return '';
          let str = String(cell);
          // If string contains comma, quote, or newline, escape it
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            str = `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(',');
    })
    .join('\n');
}

/**
 * Converts a CSV string into a 2D array for Google Sheets API values.
 */
export function csvToGrid(csvText: string): any[][] {
  if (!csvText) return [];
  const rawRows = FM.readCSV(csvText);
  return rawRows.map(row => {
    return row.map(val => {
      if (val === '') return '';
      // If it looks like a number, pass as number so Google Sheets treats it as numeric
      const cleanNum = String(val).replace(/\./g, '').replace(/,/g, '.');
      if (/^-?\d+(\.\d+)?$/.test(val)) {
        const num = Number(val);
        if (!isNaN(num)) return num;
      }
      return val;
    });
  });
}

/**
 * Fetches spreadsheet metadata (title and sheet names).
 */
export async function getSpreadsheetMeta(accessToken: string, spreadsheetId: string) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=spreadsheetId,properties.title,sheets.properties(sheetId,title)`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gagal membaca spreadsheet (HTTP ${res.status})`);
  }

  return await res.json();
}

/**
 * Creates a brand new master Google Spreadsheet in the user's Google Drive with 4 formatted tabs.
 */
export async function createMasterSpreadsheetTemplate(
  accessToken: string,
  data: {
    usageText: string;
    weeklyText: string;
    contractText: string;
    activeText: string;
  }
): Promise<{ spreadsheetId: string; spreadsheetUrl: string; title: string }> {
  const title = `Flowmeter Analytics - Master Data (${new Date().toLocaleDateString('id-ID')})`;

  // 1. Create spreadsheet with 4 tabs
  const createPayload = {
    properties: {
      title
    },
    sheets: [
      { properties: { title: DEFAULT_SHEET_NAMES.monthly, index: 0 } },
      { properties: { title: DEFAULT_SHEET_NAMES.weekly, index: 1 } },
      { properties: { title: DEFAULT_SHEET_NAMES.contract, index: 2 } },
      { properties: { title: DEFAULT_SHEET_NAMES.active, index: 3 } }
    ]
  };

  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(createPayload)
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gagal membuat spreadsheet baru di Google Drive (${createRes.status})`);
  }

  const created = await createRes.json();
  const spreadsheetId = created.spreadsheetId;
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // 2. Populate the 4 tabs with current data
  await pushDataToSpreadsheet(accessToken, spreadsheetId, data);

  return { spreadsheetId, spreadsheetUrl, title };
}

/**
 * Resolves sheet title in case the user named it slightly differently.
 */
function findMatchingSheetTitle(sheetList: string[], candidates: string[]): string {
  const lowerMap = new Map<string, string>();
  for (const s of sheetList) {
    lowerMap.set(s.toLowerCase().trim(), s);
  }

  for (const c of candidates) {
    const matched = lowerMap.get(c.toLowerCase().trim());
    if (matched) return matched;
  }

  // Fallback: check partial inclusion
  for (const s of sheetList) {
    const sLower = s.toLowerCase();
    for (const c of candidates) {
      if (sLower.includes(c.toLowerCase())) return s;
    }
  }

  return candidates[0];
}

/**
 * Pulls all 4 datasets from the master Google Spreadsheet.
 */
export async function pullDataFromSpreadsheet(
  accessToken: string,
  spreadsheetId: string
): Promise<PullResult> {
  try {
    const meta = await getSpreadsheetMeta(accessToken, spreadsheetId);
    const availableSheets: string[] = (meta.sheets || []).map((s: any) => s.properties?.title || '');

    const monthlySheet = findMatchingSheetTitle(availableSheets, [
      DEFAULT_SHEET_NAMES.monthly,
      'Bulanan',
      'Pemakaian',
      'Usage'
    ]);
    const weeklySheet = findMatchingSheetTitle(availableSheets, [
      DEFAULT_SHEET_NAMES.weekly,
      'Mingguan',
      'Weekly'
    ]);
    const contractSheet = findMatchingSheetTitle(availableSheets, [
      DEFAULT_SHEET_NAMES.contract,
      'Kontrak',
      'Contract'
    ]);
    const activeSheet = findMatchingSheetTitle(availableSheets, [
      DEFAULT_SHEET_NAMES.active,
      'Pelanggan Aktif',
      'Active Customers',
      'Aktif'
    ]);

    const ranges = [
      `'${monthlySheet}'!A1:ZZ1000`,
      `'${weeklySheet}'!A1:ZZ1000`,
      `'${contractSheet}'!A1:ZZ1000`,
      `'${activeSheet}'!A1:ZZ1000`
    ];

    const encodedRanges = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');
    const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${encodedRanges}&valueRenderOption=FORMATTED_VALUE`;

    const res = await fetch(getUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Gagal mengambil data dari Google Sheets (${res.status})`);
    }

    const data = await res.json();
    const valueRanges = data.valueRanges || [];

    const monthlyGrid = valueRanges[0]?.values || [];
    const weeklyGrid = valueRanges[1]?.values || [];
    const contractGrid = valueRanges[2]?.values || [];
    const activeGrid = valueRanges[3]?.values || [];

    if (monthlyGrid.length === 0) {
      throw new Error(`Lembar kerja "${monthlySheet}" kosong atau tidak memiliki data.`);
    }

    const usageText = gridToCSV(monthlyGrid);
    const weeklyText = weeklyGrid.length > 0 ? gridToCSV(weeklyGrid) : '';
    const contractText = contractGrid.length > 0 ? gridToCSV(contractGrid) : '';
    const activeText = activeGrid.length > 0 ? gridToCSV(activeGrid) : '';

    const summary: SheetSummary = {
      monthlyRows: Math.max(0, monthlyGrid.length - 1),
      monthlyColumns: monthlyGrid[0]?.length || 0,
      weeklyRows: Math.max(0, weeklyGrid.length - 1),
      weeklyWeeks: Math.max(0, (weeklyGrid[0]?.length || 2) - 2),
      contractRows: Math.max(0, contractGrid.length - 1),
      activeRows: Math.max(0, activeGrid.length - 1),
      lastUpdated: new Date().toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    };

    return {
      ok: true,
      usageText,
      weeklyText,
      contractText,
      activeText,
      summary
    };
  } catch (err: any) {
    return {
      ok: false,
      error: err.message || 'Terjadi kesalahan saat menarik data dari Google Sheets'
    };
  }
}

/**
 * Pushes/Writes the current active datasets back to the 4 tabs of the Google Spreadsheet.
 */
export async function pushDataToSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  data: {
    usageText: string;
    weeklyText: string;
    contractText: string;
    activeText: string;
  }
) {
  const meta = await getSpreadsheetMeta(accessToken, spreadsheetId);
  const existingTitles: string[] = (meta.sheets || []).map((s: any) => s.properties?.title || '');

  // Check if all 4 sheets exist; if any are missing, create them via batchUpdate
  const requiredSheets = [
    DEFAULT_SHEET_NAMES.monthly,
    DEFAULT_SHEET_NAMES.weekly,
    DEFAULT_SHEET_NAMES.contract,
    DEFAULT_SHEET_NAMES.active
  ];

  const missingSheets = requiredSheets.filter(req => !existingTitles.includes(req));
  if (missingSheets.length > 0) {
    const addSheetRequests = missingSheets.map(title => ({
      addSheet: {
        properties: { title }
      }
    }));
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requests: addSheetRequests })
    });
  }

  // Clear previous data in those 4 sheets first to avoid ghost rows
  const clearPromises = requiredSheets.map(title =>
    fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(title)}'!A1:ZZ1000:clear`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    )
  );
  await Promise.all(clearPromises);

  // Write new data
  const monthlyGrid = csvToGrid(data.usageText);
  const weeklyGrid = csvToGrid(data.weeklyText);
  const contractGrid = csvToGrid(data.contractText);
  const activeGrid = csvToGrid(data.activeText);

  const batchUpdateData = [
    {
      range: `'${DEFAULT_SHEET_NAMES.monthly}'!A1`,
      values: monthlyGrid
    },
    {
      range: `'${DEFAULT_SHEET_NAMES.weekly}'!A1`,
      values: weeklyGrid
    },
    {
      range: `'${DEFAULT_SHEET_NAMES.contract}'!A1`,
      values: contractGrid
    },
    {
      range: `'${DEFAULT_SHEET_NAMES.active}'!A1`,
      values: activeGrid
    }
  ].filter(item => item.values.length > 0);

  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: batchUpdateData
      })
    }
  );

  if (!updateRes.ok) {
    const err = await updateRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gagal menyimpan data ke Google Sheets (${updateRes.status})`);
  }

  return await updateRes.json();
}

/**
 * Helper to fetch a single sheet tab as live CSV via Google Sheets GViz endpoint
 */
async function fetchSheetCsvLive(spreadsheetId: string, sheetNames: string[]): Promise<string | null> {
  for (const name of sheetNames) {
    try {
      const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const text = await res.text();
        // Ensure it's valid CSV and not an HTML authentication/error page
        if (text && !text.trim().startsWith('<!DOCTYPE') && !text.trim().startsWith('<html')) {
          if (text.trim().length > 10) {
            return text.trim();
          }
        }
      }
    } catch {
      // try next candidate sheet name
    }
  }
  return null;
}

/**
 * Fetches all 4 operational sheets live from a Google Spreadsheet without requiring viewer login.
 * Works when the user sets sharing to "Anyone with the link: Viewer".
 * Only the owner can edit the spreadsheet cells in Google Sheets, while everyone sees the live data in the dashboard.
 */
export async function refreshLiveData(accessToken: string, spreadsheetIdInput: string): Promise<void> {
  try {
    const result = await fetchLiveSpreadsheetData(spreadsheetIdInput);
    if (!result.ok) {
      console.error('Live sync failed:', result.error);
      return;
    }
    const { usageText, weeklyText, contractText, activeText, summary } = result;
    if (usageText) localStorage.setItem(STORAGE_KEYS.CACHED_USAGE, usageText);
    if (weeklyText) localStorage.setItem(STORAGE_KEYS.CACHED_WEEKLY, weeklyText);
    if (contractText) localStorage.setItem(STORAGE_KEYS.CACHED_CONTRACT, contractText);
    if (activeText) localStorage.setItem(STORAGE_KEYS.CACHED_ACTIVE, activeText);
    if (summary) localStorage.setItem(STORAGE_KEYS.LAST_SYNC, JSON.stringify({ time: new Date().toISOString(), summary }));
    const ev = new CustomEvent('liveSync', { detail: { time: new Date().toLocaleString('id-ID') } });
    window.dispatchEvent(ev);
  } catch (e) {
    console.error('Unexpected error during live sync', e);
  }
}

export async function fetchLiveSpreadsheetData(spreadsheetIdInput: string): Promise<PullResult> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdInput);
  if (!spreadsheetId) {
    return { ok: false, error: 'ID atau URL Spreadsheet tidak valid.' };
  }

  try {
    const [usageText, weeklyText, contractText, activeText] = await Promise.all([
      fetchSheetCsvLive(spreadsheetId, [DEFAULT_SHEET_NAMES.monthly, 'Bulanan', 'Monthly', 'Sheet1', 'Sheet 1']),
      fetchSheetCsvLive(spreadsheetId, [DEFAULT_SHEET_NAMES.weekly, 'Mingguan', 'Weekly', 'Sheet2', 'Sheet 2']),
      fetchSheetCsvLive(spreadsheetId, [DEFAULT_SHEET_NAMES.contract, 'Kontrak', 'Contract', 'Data Kontrak', 'Sheet3']),
      fetchSheetCsvLive(spreadsheetId, [DEFAULT_SHEET_NAMES.active, 'Pelanggan Aktif', 'Aktif', 'Active', 'Sheet4'])
    ]);

    if (!usageText) {
      return {
        ok: false,
        error: 'Tidak dapat membaca lembar "Pemakaian Bulanan". Pastikan akses Google Spreadsheet sudah diatur ke "Siapa saja yang memiliki link: Pelihat (Viewer)".'
      };
    }

    // Parse summary
    const monthlyRows = FM.readCSV(usageText);
    const weeklyRows = weeklyText ? FM.readCSV(weeklyText) : [];
    const contractRows = contractText ? FM.readCSV(contractText) : [];
    const activeRows = activeText ? FM.readCSV(activeText) : [];

    const summary: SheetSummary = {
      monthlyRows: Math.max(0, monthlyRows.length - 1),
      monthlyColumns: monthlyRows[0]?.length || 0,
      weeklyRows: Math.max(0, weeklyRows.length - 1),
      weeklyWeeks: Math.max(0, (weeklyRows[0]?.length || 2) - 2),
      contractRows: Math.max(0, contractRows.length - 1),
      activeRows: Math.max(0, activeRows.length - 1),
      lastUpdated: new Date().toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    };

    return {
      ok: true,
      usageText,
      weeklyText: weeklyText || '',
      contractText: contractText || '',
      activeText: activeText || '',
      summary
    };
  } catch (err: any) {
    return {
      ok: false,
      error: err.message || 'Gagal membaca data live dari Google Spreadsheet.'
    };
  }
}

export const LOCKED_MASTER_SPREADSHEET_ID = '1pG_wyRh482dkLYetz_cxGNyy6xA4kTYnBn7ElE1CKAY';
export const OWNER_EMAIL = 'joy.felix.sidabutar@gmail.com';
export const OWNER_NAME = 'Joy Felix';

export const STORAGE_KEYS = {
  MASTER_SHEET_ID: 'fm-sheets-master-id',
  IS_MASTER_ACTIVE: 'fm-sheets-is-master',
  LINKED_SHEET_ID: 'fm-sheets-spreadsheet-id',
  LAST_SYNC: 'fm-sheets-last-sync',
  CACHED_USAGE: 'fm-cached-usage',
  CACHED_WEEKLY: 'fm-cached-weekly',
  CACHED_CONTRACT: 'fm-cached-contract',
  CACHED_ACTIVE: 'fm-cached-active'
};

export function isOwnerUser(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === OWNER_EMAIL.toLowerCase();
}

export function getMasterSpreadsheetId(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.MASTER_SHEET_ID);
    if (saved && saved.trim()) return saved.trim();
  } catch {}
  return LOCKED_MASTER_SPREADSHEET_ID;
}

export function setMasterSpreadsheetId(id: string): void {
  try {
    const clean = extractSpreadsheetId(id) || LOCKED_MASTER_SPREADSHEET_ID;
    localStorage.setItem(STORAGE_KEYS.MASTER_SHEET_ID, clean);
    localStorage.setItem(STORAGE_KEYS.IS_MASTER_ACTIVE, 'true');
    localStorage.setItem(STORAGE_KEYS.LINKED_SHEET_ID, clean);
  } catch {}
}

export function clearMasterSpreadsheet(): void {
  try {
    // Reset back to locked permanent master
    localStorage.setItem(STORAGE_KEYS.MASTER_SHEET_ID, LOCKED_MASTER_SPREADSHEET_ID);
    localStorage.setItem(STORAGE_KEYS.IS_MASTER_ACTIVE, 'true');
    localStorage.setItem(STORAGE_KEYS.LINKED_SHEET_ID, LOCKED_MASTER_SPREADSHEET_ID);
  } catch {}
}

