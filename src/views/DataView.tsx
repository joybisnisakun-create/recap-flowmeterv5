import React from 'react';
import { AnalysisResult, UsageData, AnalysisModel, WeeklyData } from '../types';
import * as FM from '../lib/fm';
import * as W from '../lib/weekly';
import { N, Panel } from '../lib/format';

function downloadCSV(name: string, text: string) {
  const a = document.createElement('a');
  const b = new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8' });
  a.href = URL.createObjectURL(b);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}

function generateCSV(usage: UsageData, extraYear?: { y?: number }): string {
  const months = usage.headerMonths.slice();
  if (extraYear) {
    const last = months[months.length - 1];
    const y = FM.yearOf(last) + (FM.monthOf(last) === 12 ? 1 : 0);
    if (!extraYear.y) extraYear.y = y;
    for (let m = 1; m <= 12; m++) {
      const ym = y + '-' + (m < 10 ? '0' : '') + m;
      if (months.indexOf(ym) < 0) {
        months.push(ym);
      }
    }
  }

  function q(v: any) {
    const s = String(v ?? '');
    return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  const out = [['Zona', 'No.Pel', 'Group', 'Nama Pelanggan'].concat(months).map(q).join(',')];
  usage.customers.forEach(c => {
    out.push(
      [c.zona, c.id, c.group, c.nama]
        .concat(months.map(m => (c.v[m] == null ? '' : String(c.v[m]))))
        .map(q)
        .join(',')
    );
  });
  return out.join('\r\n');
}

const FILE_ACCEPT = '.csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';

export const DataView: React.FC<{
  A: AnalysisResult;
  usage: UsageData;
  usageAll: UsageData;
  model: AnalysisModel;
  contracts: any[];
  cwarn: string[];
  weekly: WeeklyData | null;
  weeklyWarn: string[];
  activeKeys: Set<string> | null;
  onPreviewUsage: (file: File) => void;
  onPreviewContracts: (file: File) => void;
  onPreviewWeekly: (file: File) => void;
  onPreviewActive: (file: File) => void;
  onOpenGoogleSheets?: () => void;
  linkedSheetId?: string;
  linkedSheetTitle?: string;
  lastSyncTime?: string | null;
}> = ({
  A,
  usage,
  usageAll,
  model,
  contracts,
  cwarn,
  weekly,
  weeklyWarn,
  activeKeys,
  onPreviewUsage,
  onPreviewContracts,
  onPreviewWeekly,
  onPreviewActive,
  onOpenGoogleSheets,
  linkedSheetId,
  linkedSheetTitle,
  lastSyncTime
}) => {
  const q = FM.checkQuality(usage, model);
  const cfg = A.cfg;

  const lastMonth = model.months[model.months.length - 1];
  const nextY =
    FM.yearOf(lastMonth) + (FM.monthOf(lastMonth) === 12 ? 1 : 0);

  const contractCustomerCount = new Set(contracts.map(r => r.kode)).size;

  let unmatchedWeekly: any[] = [];
  if (weekly) {
    unmatchedWeekly = weekly.rows.filter(
      r => !usageAll.customers.some(c => W.key(c.nama) === r.key)
    );
  }

  const sheetUrl = linkedSheetId ? `https://docs.google.com/spreadsheets/d/${linkedSheetId}/edit` : null;

  return (
    <>
      {/* Google Sheets Live Sync Panel */}
      <Panel
        title="Pembaruan Data Otomatis: Google Sheets (Bulanan, Mingguan, Kontrak & Pelanggan)"
        sub="Pembaruan data dua arah langsung dari satu master Google Spreadsheet (4 tab) tanpa perlu konversi file manual."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              {linkedSheetId ? (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
                    ✓ Terhubung ke: {linkedSheetTitle || 'Master Google Spreadsheet'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    {lastSyncTime ? `Terakhir disinkronkan: ${lastSyncTime}` : 'ID Spreadsheet: ' + linkedSheetId}
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg2)' }}>
                    Belum ada Google Spreadsheet yang ditautkan.
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    Buat template otomatis di Google Drive Anda atau tautkan spreadsheet yang sudah ada.
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {sheetUrl && (
                <a
                  href={sheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn"
                  style={{ textDecoration: 'none', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <span>Buka di Google Sheets ↗</span>
                </a>
              )}
              {onOpenGoogleSheets && (
                <button
                  className="btn pri"
                  onClick={onOpenGoogleSheets}
                  style={{ fontWeight: 600, fontSize: 13 }}
                >
                  ⚡ Kelola & Sinkronkan Google Sheets
                </button>
              )}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 10,
              borderTop: '1px solid var(--line)',
              paddingTop: 12,
              fontSize: 12
            }}
          >
            <div style={{ background: 'var(--none-bg)', padding: '8px 10px', borderRadius: 6 }}>
              <strong style={{ display: 'block', color: 'var(--fg)' }}>1. Pemakaian Bulanan</strong>
              <span style={{ color: 'var(--muted)' }}>Data m³ per bulan per flowmeter (Zona, No.Pel, Group, Bulan)</span>
            </div>
            <div style={{ background: 'var(--none-bg)', padding: '8px 10px', borderRadius: 6 }}>
              <strong style={{ display: 'block', color: 'var(--fg)' }}>2. Pemakaian Mingguan</strong>
              <span style={{ color: 'var(--muted)' }}>Pembacaan meter mingguan (Group, Nama Pelanggan, Tanggal)</span>
            </div>
            <div style={{ background: 'var(--none-bg)', padding: '8px 10px', borderRadius: 6 }}>
              <strong style={{ display: 'block', color: 'var(--fg)' }}>3. Data Kontrak</strong>
              <span style={{ color: 'var(--muted)' }}>Batas kuota kontrak pelanggan (m³/bulan)</span>
            </div>
            <div style={{ background: 'var(--none-bg)', padding: '8px 10px', borderRadius: 6 }}>
              <strong style={{ display: 'block', color: 'var(--fg)' }}>4. Pelanggan Aktif</strong>
              <span style={{ color: 'var(--muted)' }}>Daftar pelanggan aktif untuk memisahkan pelanggan berhenti</span>
            </div>
          </div>
        </div>
      </Panel>

      {/* Data Quality & Status */}
      <Panel
        title="Status dan kualitas data"
        sub="Pemeriksaan otomatis kelengkapan data pemakaian, kontrak, dan daftar pelanggan aktif."
      >
        <ul className="checks">
          {q.map((x, i) => (
            <li key={i} className={x.ok ? '' : 'bad'}>
              {x.t}
            </li>
          ))}
          {cwarn.map((w, i) => (
            <li key={`c-${i}`} className="bad">
              {w}
            </li>
          ))}
          <li className={contracts.length ? '' : 'bad'}>
            {contracts.length
              ? `Kontrak terbaca untuk ${contractCustomerCount} pelanggan.`
              : 'Belum ada nilai kontrak di data/kontrak.csv.'}
          </li>
        </ul>
      </Panel>

      {/* How to update & upload */}
      <Panel
        title="Alur pembaruan data bulanan & mingguan"
        sub="Format didukung: CSV dan Excel (.xlsx) langsung tanpa konversi."
      >
        <ol className="dl-list">
          <li>
            <b>Pemakaian Bulanan</b>: Tambahkan nilai pemakaian bulan berjalan pada kolomnya. Kolom
            yang belum berjalan (mis. Okt–Des) boleh dibiarkan kosong.
          </li>
          <li>
            <b>Pemakaian Mingguan</b>: Masukkan pembacaan per pekan dengan tanggal akhir pekan sebagai
            judul kolom (mis. <span className="mono">2026-10-21</span>). File Excel{' '}
            <span className="mono">Pemakaian Mingguan.xlsx</span> dapat langsung diunggah di bawah.
          </li>
          <li>
            <b>Pelanggan Aktif</b>: Atur di <span className="mono">data/pelanggan_aktif.csv</span>{' '}
            atau file Excel <span className="mono">Daftar Pelanggan Aktif.xlsx</span>. Pelanggan di
            luar daftar ini otomatis ditandai sebagai berhenti.
          </li>
          <li>
            <b>Kontrak Pelanggan</b>: Ambang batas atas {cfg.batas_atas}% dan batas bawah{' '}
            {cfg.batas_bawah}% dari kontrak. Multi-flowmeter digabungkan otomatis berdasarkan No.Pel
            atau kode pelanggan.
          </li>
          <li>
            <b>Penyimpanan</b>: File yang di-commit ke GitHub akan otomatis ter-deploy ke situs dalam
            hitungan menit.
          </li>
        </ol>

        <div className="toolbar">
          <button
            className="btn"
            onClick={() => downloadCSV('pemakaian.csv', generateCSV(usage))}
          >
            Unduh pemakaian.csv saat ini
          </button>
          <button
            className="btn"
            onClick={() =>
              downloadCSV('pemakaian-tahun-baru.csv', generateCSV(usage, {}))
            }
          >
            Unduh template tahun {nextY}
          </button>

          <label className="btn" style={{ cursor: 'pointer' }}>
            Unggah / Pratinjau Pemakaian (CSV / XLSX)
            <input
              type="file"
              accept={FILE_ACCEPT}
              style={{ display: 'none' }}
              onChange={e => {
                if (e.target.files?.[0]) onPreviewUsage(e.target.files[0]);
              }}
            />
          </label>

          <label className="btn" style={{ cursor: 'pointer' }}>
            Unggah / Pratinjau Mingguan (CSV / XLSX)
            <input
              type="file"
              accept={FILE_ACCEPT}
              style={{ display: 'none' }}
              onChange={e => {
                if (e.target.files?.[0]) onPreviewWeekly(e.target.files[0]);
              }}
            />
          </label>

          <label className="btn" style={{ cursor: 'pointer' }}>
            Unggah / Pratinjau Pelanggan Aktif (CSV / XLSX)
            <input
              type="file"
              accept={FILE_ACCEPT}
              style={{ display: 'none' }}
              onChange={e => {
                if (e.target.files?.[0]) onPreviewActive(e.target.files[0]);
              }}
            />
          </label>

          <label className="btn" style={{ cursor: 'pointer' }}>
            Unggah / Pratinjau Kontrak (CSV / XLSX)
            <input
              type="file"
              accept={FILE_ACCEPT}
              style={{ display: 'none' }}
              onChange={e => {
                if (e.target.files?.[0]) onPreviewContracts(e.target.files[0]);
              }}
            />
          </label>
        </div>
        <p className="sub" style={{ marginTop: 0 }}>
          Pratinjau lokal menampilkan file Excel / CSV dari komputer Anda langsung di browser tanpa
          mengubah file repositori utama.
        </p>
      </Panel>

      {/* Asal-Usul & Silsilah Data (Data Lineage) */}
      <Panel
        title="Asal-usul & arsitektur data sistem"
        sub="Struktur integrasi multi-sumber: pemakaian bulanan, mingguan, master pelanggan aktif, dan kontrak"
      >
        <div className="grid2">
          <div className="panel" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
            <h3 style={{ fontSize: 14, marginBottom: 6, color: 'var(--accent)' }}>Sumber & Alur Data</h3>
            <ul className="dl-list" style={{ paddingLeft: 16 }}>
              <li>
                <b>1. Pemakaian Bulanan (Billing Meter)</b>: Dari file <span className="mono">pemakaian bulanan.csv</span> / <span className="mono">.xlsx</span>. Memuat realisasi penagihan resmi bulanan dari tahun 2024 hingga bulan acuan berjalan.
              </li>
              <li>
                <b>2. Pemakaian Mingguan (Operational Meter)</b>: Dari file <span className="mono">Pemakaian Mingguan.xlsx</span> / <span className="mono">data/mingguan.csv</span>. Memuat pembacaan meter operasional berkala per pekan (ditandai tanggal akhir pekan).
              </li>
              <li>
                <b>3. Master Pelanggan Aktif</b>: Dari file <span className="mono">Daftar Pelanggan Aktif.xlsx</span> / <span className="mono">data/pelanggan_aktif.csv</span>. Memuat 79 pelanggan aktif (100 flowmeter operasional). Pelanggan di luar daftar ini otomatis dipisahkan ke tab <i>Pelanggan Berhenti</i>.
              </li>
              <li>
                <b>4. Master Kontrak Tahunan</b>: Dari file <span className="mono">data/kontrak.csv</span>. Memuat batasan kuota volume tahunan (2024, 2025, 2026), baik per flowmeter maupun kontrak kumulatif.
              </li>
            </ul>
          </div>

          <div className="panel" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
            <h3 style={{ fontSize: 14, marginBottom: 6, color: 'var(--accent)' }}>Struktur Relasi: Pelanggan (Group) vs Flowmeter (FM)</h3>
            <ul className="dl-list" style={{ paddingLeft: 16 }}>
              <li>
                <b>Group = Nama Pelanggan</b>: Entitas bisnis / pelanggan resmi (misalnya <i>Caputra Mitra Sejati</i>, <i>Dover Chemical</i>, <i>Angels Products</i>).
              </li>
              <li>
                <b>Nama Pelanggan (pada meter) = Nama Flowmeter</b>: Titik meter fisik spesifik (misalnya <i>Caputra Mitra Sejati - I</i> dan <i>Caputra Mitra Sejati - II</i>).
              </li>
              <li>
                <b>Agregasi Otomatis</b>: Pada seluruh ringkasan bulanan, mingguan, korelasi, dan evaluasi kontrak, data digabungkan ke tingkat Pelanggan (Group).
              </li>
              <li>
                <b>Rincian Interaktif</b>: Pelanggan dengan &gt;1 flowmeter diberi penanda badge (mis. <span className="fmc-badge">2 FM</span>) dan tombol ekspansi <span className="mono">▶</span> untuk melihat kontribusi tiap flowmeter.
              </li>
            </ul>
          </div>
        </div>
      </Panel>

      {/* Glosarium, Legenda Notasi & Singkatan Baku */}
      <Panel
        title="Glosarium & legenda notasi matematis"
        sub="Daftar simbol, singkatan baku, kepanjangan resmi (Indonesia & Inggris), serta arti operasional di seluruh sistem"
      >
        <div className="scroll">
          <table className="glossary-table">
            <thead>
              <tr>
                <th style={{ width: 110 }}>Notasi / Simbol</th>
                <th style={{ width: 230 }}>Kepanjangan Baku</th>
                <th>Definisi & Arti Operasional di Sistem</th>
                <th style={{ width: 130 }}>Satuan / Skala</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span className="sym-badge">Y</span> atau <span className="sym-badge">y_t</span></td>
                <td><b>Volume Realisasi Aktual</b><br/><span className="muted">Actual Realized Volume</span></td>
                <td>Volume pemakaian air aktual bulanan berdasarkan data pembacaan meter tagihan resmi (Billing Meter) pada periode waktu <i>t</i>. Menjadi variabel acuan utama (ground truth).</td>
                <td>m³ (meter kubik)</td>
              </tr>
              <tr>
                <td><span className="sym-badge">ŷ</span> atau <span className="sym-badge">ŷ_(t+h)</span></td>
                <td><b>Volume Proyeksi / Prediksi</b><br/><span className="muted">Forecasted Volume</span></td>
                <td>Nilai taksiran atau ramalan pemakaian air untuk <i>h</i> periode ke depan yang dihasilkan oleh metode proyeksi matematis (SMA-3, OLS, Damped Holt, atau Seasonal Ratio).</td>
                <td>m³ (meter kubik)</td>
              </tr>
              <tr>
                <td><span className="sym-badge">W</span> atau <span className="sym-badge">W_w</span></td>
                <td><b>Pembacaan Mingguan</b><br/><span className="muted">Weekly Meter Reading</span></td>
                <td>Volume air yang dicatat instrumen pembacaan operasional per pekan (7 hari kalender) pada minggu ke-<i>w</i> (ditandai tanggal akhir pekan).</td>
                <td>m³ per pekan</td>
              </tr>
              <tr>
                <td><span className="sym-badge">WAPE</span></td>
                <td><b>Weighted Absolute Percentage Error</b><br/><span className="muted">Galat Absolut Terbobot</span></td>
                <td>Metrik baku evaluasi akurasi yang mengukur rasio total penyimpangan absolut antara pembacaan mingguan dan bulanan terhadap total volume aktual. Semakin kecil nilai WAPE (mendekati 0%), semakin akurat dan konsisten meter operasional.</td>
                <td>% (persentase)</td>
              </tr>
              <tr>
                <td><span className="sym-badge">r</span></td>
                <td><b>Pearson Correlation Coefficient</b><br/><span className="muted">Koefisien Korelasi Pearson</span></td>
                <td>Derajat keeratan hubungan linear antara deret waktu pembacaan mingguan (<i>e</i>) dan tagihan bulanan (<i>a</i>). Nilai <i>r</i> &ge; 0,80 menandakan keselarasan tren dan dinamika yang sangat kuat.</td>
                <td>-1,00 s.d. +1,00</td>
              </tr>
              <tr>
                <td><span className="sym-badge">Bias / MPB</span></td>
                <td><b>Mean Percentage Bias</b><br/><span className="muted">Persentase Bias / Arah Deviasi</span></td>
                <td>Mengukur kecenderungan sistematis pembacaan mingguan: nilai positif (+) berarti meter mingguan mencatat lebih tinggi dibanding tagihan bulanan resmi, sedangkan negatif (−) berarti mencatat lebih rendah.</td>
                <td>% (persentase)</td>
              </tr>
              <tr>
                <td><span className="sym-badge">MAE</span></td>
                <td><b>Mean Absolute Error</b><br/><span className="muted">Rata-rata Galat Absolut</span></td>
                <td>Rata-rata selisih mutlak fisik antara nilai aktual dan taksiran proyeksi dalam satuan volume m³. Digunakan untuk seleksi model backtesting terbaik.</td>
                <td>m³ (meter kubik)</td>
              </tr>
              <tr>
                <td><span className="sym-badge">RMSE</span></td>
                <td><b>Root Mean Squared Error</b><br/><span className="muted">Akar Rata-rata Kuadrat Galat</span></td>
                <td>Akar kuadrat rata-rata deviasi berpangkat dua, yang memberikan bobot penalti lebih tinggi pada penyimpangan volume yang ekstrem atau lonjakan anomali.</td>
                <td>m³ (meter kubik)</td>
              </tr>
              <tr>
                <td><span className="sym-badge">MoM</span></td>
                <td><b>Month-on-Month</b><br/><span className="muted">Pertumbuhan Bulan ke Bulan</span></td>
                <td>Persentase perubahan volume pemakaian bulan berjalan dibanding satu bulan kalender tepat sebelumnya.</td>
                <td>% (persentase)</td>
              </tr>
              <tr>
                <td><span className="sym-badge">YoY</span></td>
                <td><b>Year-on-Year</b><br/><span className="muted">Pertumbuhan Tahun ke Tahun</span></td>
                <td>Persentase perubahan volume pemakaian bulan berjalan dibanding bulan yang sama pada tahun kalender sebelumnya (menghilangkan pengaruh musiman bulanan).</td>
                <td>% (persentase)</td>
              </tr>
              <tr>
                <td><span className="sym-badge">WoW</span></td>
                <td><b>Week-on-Week</b><br/><span className="muted">Pertumbuhan Pekan ke Pekan</span></td>
                <td>Persentase perubahan volume pemakaian pekan operasional berjalan dibanding pekan operasional sebelumnya.</td>
                <td>% (persentase)</td>
              </tr>
              <tr>
                <td><span className="sym-badge">YTD</span></td>
                <td><b>Year-to-Date</b><br/><span className="muted">Kumulatif Tahun Berjalan</span></td>
                <td>Total akumulasi volume pemakaian air yang telah terealisasi sejak awal tahun (Januari) hingga bulan atau pekan evaluasi saat ini.</td>
                <td>m³ (kumulatif)</td>
              </tr>
              <tr>
                <td><span className="sym-badge">MTD</span></td>
                <td><b>Month-to-Date</b><br/><span className="muted">Kumulatif Bulan Berjalan</span></td>
                <td>Total volume pemakaian yang telah terjadi sejak hari pertama bulan berjalan hingga tanggal pembacaan mingguan terakhir.</td>
                <td>m³ (kumulatif)</td>
              </tr>
              <tr>
                <td><span className="sym-badge">CV</span></td>
                <td><b>Coefficient of Variation</b><br/><span className="muted">Koefisien Variasi / Volatilitas</span></td>
                <td>Rasio simpangan baku terhadap rata-rata (&sigma; / &mu;) untuk mengukur tingkat fluktuasi atau ketidakstabilan pemakaian pelanggan.</td>
                <td>Rasio / %</td>
              </tr>
              <tr>
                <td><span className="sym-badge">FM</span></td>
                <td><b>Flowmeter</b><br/><span className="muted">Alat Ukur Aliran / Debit Air Fisik</span></td>
                <td>Titik instrumen pengukuran fisik spesifik di lapangan (contoh: <i>Caputra Mitra Sejati - I</i> dan <i>Caputra Mitra Sejati - II</i>).</td>
                <td>Titik Ukur Fisik</td>
              </tr>
              <tr>
                <td><span className="sym-badge">Group</span></td>
                <td><b>Customer Group</b><br/><span className="muted">Nama Pelanggan Resmi (Entitas Bisnis)</span></td>
                <td>Nama badan usaha / pelanggan komersial terdaftar yang memiliki ikatan kontrak dengan PDAM dan dapat mengoperasikan satu atau beberapa flowmeter.</td>
                <td>Entitas Bisnis</td>
              </tr>
              <tr>
                <td><span className="sym-badge">a_i, e_i</span></td>
                <td><b>Actual &amp; Estimated Points</b></td>
                <td><i>a_i</i> = volume aktual penagihan bulanan resmi; <i>e_i</i> = volume estimasi hasil proration mingguan yang dialokasikan ke bulan tersebut.</td>
                <td>m³</td>
              </tr>
              <tr>
                <td><span className="sym-badge">&alpha;, &beta;, &gamma;, &phi;</span></td>
                <td><b>Smoothing &amp; Damping Parameters</b></td>
                <td>Parameter algoritma exponential smoothing: &alpha; (level), &beta; / &gamma; (tren), dan &phi; (faktor redaman = 0,92 untuk mencegah ekstrapolasi berlebihan).</td>
                <td>Konstanta (0 &ndash; 1)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Comprehensive Methods and Mathematical Formulas */}
      <Panel
        title="Katalog metode, pengertian & rumus matematis baku"
        sub="Dokumentasi lengkap formula perhitungan temporal, nowcasting, evaluasi korelasi, dan pemodelan proyeksi beserta perincian variabel"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Section 1: Temporal Growth */}
          <div className="panel" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
            <h3 style={{ fontSize: 14, marginBottom: 6, color: 'var(--accent)' }}>1. Metrik Pertumbuhan & Variasi Temporal</h3>
            <div className="grid2" style={{ gap: 12 }}>
              <div>
                <b>Month-on-Month (MoM)</b>
                <p className="sub" style={{ margin: '4px 0 6px' }}>Perubahan persentase volume bulan berjalan dibanding bulan sebelumnya.</p>
                <div className="formula-block">MoM = ((V_t − V_(t−1)) ÷ V_(t−1)) × 100%</div>
                <ul className="var-desc">
                  <li><b>V_t</b>: Volume pemakaian aktual bulan berjalan <i>t</i> (m³)</li>
                  <li><b>V_(t−1)</b>: Volume pemakaian aktual 1 bulan kalender sebelumnya (m³)</li>
                  <li><b>MoM</b>: Laju pertumbuhan bulanan (%)</li>
                </ul>
              </div>
              <div>
                <b>Year-on-Year (YoY)</b>
                <p className="sub" style={{ margin: '4px 0 6px' }}>Perubahan persentase volume bulan berjalan dibanding bulan yang sama di tahun lalu.</p>
                <div className="formula-block">YoY = ((V_t − V_(t−12)) ÷ V_(t−12)) × 100%</div>
                <ul className="var-desc">
                  <li><b>V_t</b>: Volume pemakaian aktual bulan berjalan <i>t</i> (m³)</li>
                  <li><b>V_(t−12)</b>: Volume pemakaian aktual bulan yang sama tahun lalu (12 bulan lalu) (m³)</li>
                  <li><b>YoY</b>: Laju pertumbuhan tahunan (%)</li>
                </ul>
              </div>
              <div>
                <b>Week-on-Week (WoW)</b>
                <p className="sub" style={{ margin: '4px 0 6px' }}>Perubahan persentase volume pekan berjalan dibanding pekan sebelumnya.</p>
                <div className="formula-block">WoW = ((W_w − W_(w−1)) ÷ W_(w−1)) × 100%</div>
                <ul className="var-desc">
                  <li><b>W_w</b>: Volume pembacaan meter operasional pekan berjalan <i>w</i> (m³)</li>
                  <li><b>W_(w−1)</b>: Volume pembacaan meter operasional pekan sebelumnya (m³)</li>
                  <li><b>WoW</b>: Laju pertumbuhan mingguan (%)</li>
                </ul>
              </div>
              <div>
                <b>Koefisien Variasi (Volatilitas Pemakaian)</b>
                <p className="sub" style={{ margin: '4px 0 6px' }}>Tingkat fluktuasi pemakaian: simpangan baku sampel dibagi nilai rata-rata bulanan.</p>
                <div className="formula-block">CV = σ ÷ μ = √(Σ(V_i − μ)² ÷ (N − 1)) ÷ μ</div>
                <ul className="var-desc">
                  <li><b>σ (Sigma)</b>: Simpangan baku (standar deviasi) sampel pemakaian bulanan</li>
                  <li><b>μ (Mu)</b>: Rata-rata aritmetika pemakaian bulanan seluruh periode</li>
                  <li><b>N</b>: Jumlah bulan observasi</li>
                  <li><b>CV</b>: Koefisien variasi (nilai tinggi &gt; 0,3 menandakan pemakaian volatil)</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Section 2: Weekly Proration & Nowcasting */}
          <div className="panel" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
            <h3 style={{ fontSize: 14, marginBottom: 6, color: 'var(--accent)' }}>2. Dekomposisi Harian & Nowcasting Mingguan ke Bulanan</h3>
            <ul className="dl-list" style={{ paddingLeft: 16 }}>
              <li>
                <b>Prorating Harian Kalender</b>: Pemakaian mingguan (7 hari kalender) didekomposisi rata ke setiap hari kalender:
                <div className="formula-block">V_harian = W_w ÷ 7</div>
                <ul className="var-desc">
                  <li><b>W_w</b>: Total volume pembacaan pekan ke-<i>w</i> (m³)</li>
                  <li><b>V_harian</b>: Laju rata-rata harian pada pekan tersebut (m³/hari). Apabila pekan melintasi batas akhir bulan kalender (misal 4 hari di Oktober dan 3 hari di November), volume dialokasikan proporsional ke masing-masing bulan kalender.</li>
                </ul>
              </li>
              <li>
                <b>Laju Harian Rata-rata 4 Pekan (Run-Rate)</b>:
                <div className="formula-block">RunRate = Mean(W_(terakhir 4 pekan)) ÷ 7</div>
                <ul className="var-desc">
                  <li><b>W_(terakhir 4 pekan)</b>: Rata-rata debit volume air dari 4 pekan operasional paling mutakhir (m³/hari).</li>
                </ul>
              </li>
              <li>
                <b>Nowcasting Akhir Bulan Berjalan</b>:
                <div className="formula-block">Proyeksi = V_MTD + (Hari_Total − Hari_MTD) × RunRate</div>
                <ul className="var-desc">
                  <li><b>V_MTD</b>: Volume Month-to-Date yang telah tercatat dari awal bulan hingga pekan terakhir (m³)</li>
                  <li><b>Hari_Total</b>: Jumlah total hari kalender di bulan bersangkutan (28 s.d. 31 hari)</li>
                  <li><b>Hari_MTD</b>: Jumlah hari kalender yang telah selesai s.d. pekan terakhir</li>
                  <li><b>Proyeksi</b>: Estimasi capaian total pemakaian di akhir bulan kalender sebelum tagihan resmi terbit.</li>
                </ul>
              </li>
            </ul>
          </div>

          {/* Section 3: Correlation & Calibration */}
          <div className="panel" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
            <h3 style={{ fontSize: 14, marginBottom: 6, color: 'var(--accent)' }}>3. Pengukuran Keselarasan & Korelasi (Bulanan x Mingguan)</h3>
            <div className="grid2" style={{ gap: 12 }}>
              <div>
                <b>Koefisien Korelasi Pearson (r)</b>
                <p className="sub" style={{ margin: '4px 0 6px' }}>Mengukur kekuatan hubungan linear antara akumulasi estimasi mingguan (e) dan data bulanan resmi (a).</p>
                <div className="formula-block">r = Σ(a_i − ā)(e_i − ē) ÷ [√(Σ(a_i − ā)²) × √(Σ(e_i − ē)²)]</div>
                <ul className="var-desc">
                  <li><b>a_i</b>: Nilai pemakaian aktual tagihan bulanan pada bulan <i>i</i> (m³)</li>
                  <li><b>ā</b>: Nilai rata-rata pemakaian tagihan bulanan resmi (m³)</li>
                  <li><b>e_i</b>: Nilai estimasi akumulasi mingguan yang dipetakan ke bulan <i>i</i> (m³)</li>
                  <li><b>ē</b>: Nilai rata-rata estimasi mingguan (m³)</li>
                  <li><b>r</b>: Koefisien korelasi linear (−1,00 s.d. +1,00; r &ge; 0,80 = selaras kuat)</li>
                </ul>
              </div>
              <div>
                <b>Weighted Absolute Percentage Error (WAPE)</b>
                <p className="sub" style={{ margin: '4px 0 6px' }}>Tingkat galat absolut pembacaan mingguan terbobot terhadap total volume keseluruhan.</p>
                <div className="formula-block">WAPE = (Σ |e_i − a_i| ÷ Σ a_i) × 100%</div>
                <ul className="var-desc">
                  <li><b>|e_i − a_i|</b>: Selisih absolut antara estimasi mingguan dan realisasi bulanan</li>
                  <li><b>Σ a_i</b>: Total volume seluruh penagihan bulanan yang dievaluasi</li>
                  <li><b>WAPE</b>: Persentase simpangan rata-rata terbobot (WAPE &le; 15% = Sangat Selaras)</li>
                </ul>
              </div>
              <div>
                <b>Persentase Bias Gabungan (Mean Percentage Bias)</b>
                <p className="sub" style={{ margin: '4px 0 6px' }}>Kecenderungan sistematis arah penyimpangan pembacaan mingguan relatif terhadap bulanan.</p>
                <div className="formula-block">Bias = ((Σ e_i − Σ a_i) ÷ Σ a_i) × 100%</div>
                <ul className="var-desc">
                  <li><b>Σ e_i</b>: Total volume estimasi mingguan</li>
                  <li><b>Σ a_i</b>: Total volume aktual bulanan resmi</li>
                  <li><b>Bias</b>: (+) = meter mingguan mencatat lebih tinggi; (−) = mencatat lebih rendah</li>
                </ul>
              </div>
              <div>
                <b>Kriteria Status Keselarasan Pelanggan</b>
                <ul style={{ margin: '4px 0 0', paddingLeft: 16, fontSize: 12.5, color: 'var(--fg2)' }}>
                  <li><b>Selaras (Grade A)</b>: WAPE &le; 15% dan r &ge; 0,80 (pembacaan meter konsisten dan valid).</li>
                  <li><b>Cukup (Grade B)</b>: WAPE 15% &ndash; 35% (selisih wajar batas kalender atau jadwal baca).</li>
                  <li><b>Selisih Besar (Grade C)</b>: WAPE &gt; 35% (indikasi anomali meter fisik atau beda tanggal kalibrasi).</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Section 4: Forecasting & Backtesting */}
          <div className="panel" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
            <h3 style={{ fontSize: 14, marginBottom: 6, color: 'var(--accent)' }}>4. Model Proyeksi & Evaluasi Uji Mundur (Backtesting)</h3>
            <p className="sub" style={{ margin: '0 0 10px' }}>
              Sistem mengevaluasi 4 metode peramalan secara otomatis untuk setiap pelanggan dan zona, lalu menetapkan metode dengan nilai Mean Absolute Error (MAE) terendah:
            </p>
            <ul className="dl-list" style={{ paddingLeft: 16 }}>
              <li>
                <b>1. Rata-rata Bergerak 3 Bulan (SMA-3 / Simple Moving Average)</b>:
                <div className="formula-block">ŷ_(t+h) = (y_t + y_(t−1) + y_(t−2)) ÷ 3</div>
                <ul className="var-desc">
                  <li><b>ŷ_(t+h)</b>: Proyeksi volume untuk <i>h</i> bulan ke depan</li>
                  <li><b>y_t, y_(t−1), y_(t−2)</b>: Nilai realisasi 3 bulan kalender terakhir</li>
                  <li><b>Aplikasi</b>: Sangat efektif untuk pelanggan industri dengan pola pemakaian stabil tanpa tren menanjak/menurun tajam.</li>
                </ul>
              </li>
              <li>
                <b>2. Tren Linear Kuadrat Terkecil (OLS / Ordinary Least Squares)</b>:
                <div className="formula-block">ŷ_t = α + β·t, dengan β = Σ(t − t̄)(y_t − ȳ) ÷ Σ(t − t̄)² dan α = ȳ − β·t̄</div>
                <ul className="var-desc">
                  <li><b>α (Alpha)</b>: Intersep dasar regresi linear</li>
                  <li><b>β (Beta)</b>: Kemiringan (slope) laju penambahan atau penurunan volume per bulan</li>
                  <li><b>t</b>: Indeks urutan bulan kalender (1, 2, ..., n)</li>
                  <li><b>Aplikasi</b>: Menangkap tren ekspansi kapasitas produksi atau penurunan konsumsi jangka menengah.</li>
                </ul>
              </li>
              <li>
                <b>3. Pemulusan Eksponensial Holt Linear dengan Redaman Tren (Damped Trend Holt)</b>:
                <div className="formula-block">
                  Level: L_t = α·y_t + (1−α)(L_(t−1) + φ·T_(t−1))<br/>
                  Tren: T_t = γ(L_t − L_(t−1)) + (1−γ)φ·T_(t−1)<br/>
                  Proyeksi: ŷ_(t+h) = L_t + Σ_(i=1)^h φⁱ · T_t
                </div>
                <ul className="var-desc">
                  <li><b>L_t</b>: Komponen level (estimasi dasar pemakaian pada akhir periode <i>t</i>)</li>
                  <li><b>T_t</b>: Komponen tren (arah laju pertumbuhan pada periode <i>t</i>)</li>
                  <li><b>α, γ</b>: Parameter pemulus level dan tren (0 &lt; α, γ &le; 1)</li>
                  <li><b>φ (Phi)</b>: Faktor redaman tren (default sistem: φ = 0,92) untuk meredam laju tren agar tidak terjadi proyeksi liar (overshoot/undershoot) pada jangka panjang.</li>
                </ul>
              </li>
              <li>
                <b>4. Rasio Musiman Tahunan (Seasonal Ratio YoY)</b>:
                <div className="formula-block">R = Σ_(k=0)² y_(t−k) ÷ Σ_(k=0)² y_(t−12−k), &nbsp; ŷ_(t+h) = y_(t−12+h) × R</div>
                <ul className="var-desc">
                  <li><b>R</b>: Rasio pembanding kuartal berjalan terhadap kuartal yang sama di tahun lalu</li>
                  <li><b>y_(t−12+h)</b>: Volume pemakaian pada bulan yang sama tahun lalu</li>
                  <li><b>Aplikasi</b>: Menangkap siklus musiman tahunan (misal lonjakan hari raya atau musim kemarau).</li>
                </ul>
              </li>
              <li>
                <b>Metode Evaluasi Uji Mundur (Backtesting MAE &amp; RMSE)</b>:
                <div className="formula-block">MAE = (1 ÷ k) Σ |y_i − ŷ_i|, &nbsp; RMSE = √((1 ÷ k) Σ (y_i − ŷ_i)²)</div>
                <ul className="var-desc">
                  <li><b>k</b>: Jumlah bulan uji mundur (default 3 bulan terakhir)</li>
                  <li><b>y_i</b>: Nilai sebenarnya yang terjadi pada bulan uji</li>
                  <li><b>ŷ_i</b>: Nilai yang diprediksi model hanya dengan menggunakan data sebelum bulan uji tersebut. Metode dengan MAE terkecil terpilih otomatis sebagai model resmi.</li>
                </ul>
              </li>
            </ul>
          </div>

          {/* Section 5: Contract Compliance */}
          <div className="panel" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
            <h3 style={{ fontSize: 14, marginBottom: 6, color: 'var(--accent)' }}>5. Ambang Batas Kepatuhan Kontrak & Take-or-Pay</h3>
            <div className="grid2" style={{ gap: 12 }}>
              <div>
                <b>Batas Kontrak Baku</b>
                <ul style={{ margin: '4px 0 0', paddingLeft: 16, fontSize: 12.5, color: 'var(--fg2)' }}>
                  <li><b>Batas Atas ({cfg.batas_atas}%)</b>: Maksimal kuota pemakaian yang diizinkan kontrak sebelum timbul sanksi/overtake.</li>
                  <li><b>Batas Bawah ({cfg.batas_bawah}%)</b>: Minimum take-or-pay yang wajib dibayar pelanggan meskipun pemakaian fisik lebih rendah.</li>
                  <li><b>Zona Waspada ({cfg.mendekati}%)</b>: Interval toleransi 70%&ndash;80% dan 100%&ndash;110% sebagai peringatan dini mitigasi.</li>
                </ul>
              </div>
              <div>
                <b>Kontrak Kumulatif</b>
                <p className="sub" style={{ margin: '4px 0 6px' }}>
                  Untuk pelanggan dengan multi-flowmeter yang disatukan dalam 1 kode pelanggan, evaluasi kepatuhan dilakukan terhadap jumlah pemakaian kumulatif seluruh flowmeter pelanggan tersebut terhadap nilai kontrak kumulatif pada baris utama master kontrak.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      {/* Weekly Data Quality & Methods */}
      {weekly && (
        <>
          <Panel title="Status data mingguan & pelanggan aktif">
            <ul className="checks">
              <li>
                Mingguan terbaca: {weekly.rows.length} pelanggan, {weekly.weeks.length} minggu (
                {weekly.weeks[0]} s.d. {weekly.weeks[weekly.weeks.length - 1]}).
              </li>
              <li className={unmatchedWeekly.length ? 'bad' : ''}>
                {unmatchedWeekly.length
                  ? `${unmatchedWeekly.length} nama di mingguan tidak ditemukan di data bulanan: ${unmatchedWeekly
                      .slice(0, 5)
                      .map(r => r.nama)
                      .join('; ')}. Samakan nama agar otomatis terhubung.`
                  : 'Semua nama di data mingguan terhubung sempurna dengan data pemakaian bulanan.'}
              </li>
              <li className={activeKeys ? '' : 'bad'}>
                {activeKeys
                  ? `Daftar pelanggan aktif: ${activeKeys.size} nama pelanggan. Pelanggan non-aktif disaring.`
                  : 'File pelanggan_aktif belum diatur: seluruh pelanggan dianggap aktif.'}
              </li>
              {weeklyWarn.map((x, i) => (
                <li key={i} className="bad">
                  {x}
                </li>
              ))}
            </ul>
          </Panel>
        </>
      )}
    </>
  );
};
