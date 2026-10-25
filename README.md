# Rekap Flowmeter (React + Vite + TypeScript)

Dashboard pemakaian flowmeter interaktif: **Bulanan** (ringkasan, kepatuhan kontrak 80–110%, per zona, per pelanggan, proyeksi berbasis statistik), **Mingguan**, dan **Korelasi** bulanan × mingguan.
Dibuat oleh **Joy Felix**.

Aplikasi telah direwrite dari vanilla Dynamic ke aplikasi modern berbasis **React 18 + Vite + TypeScript**.

## Struktur Proyek

```
index.html                  Entri utama HTML
src/
  main.tsx                  Entri React
  App.tsx                   Komponen utama dashboard, state filter, & tab routing
  types.ts                  Definisi model data TypeScript
  index.css                 Desain tata letak, tema (terang/gelap), & tipografi
  lib/
    fm.ts                   Mesin analisis bulanan, OLS, Holt damped, kontrak, & validasi
    weekly.ts               Mesin analisis mingguan, dekomposisi harian, & korelasi
    format.tsx              Komponen format (Pill, Gauge, KPI, Panel, Badge)
  components/
    Charts.tsx              Komponen grafik SVG reaktif (LineChart, BarChart, Sparkline, ScatterPlot)
    CustomerModal.tsx       Modal interaktif detail flowmeter & pelanggan
  views/
    RingkasanView.tsx       Tab Ringkasan bulanan
    KontrakView.tsx         Tab Kepatuhan kontrak & utilisasi
    ZonaView.tsx            Tab Analisis zona & matriks MoM
    PelangganView.tsx       Tab Daftar pelanggan, filter & sparkline
    ProyeksiView.tsx        Tab Proyeksi masa depan & evaluasi metode
    MingguanView.tsx        Tab Analisis mingguan & deteksi lonjakan
    KorelasiView.tsx        Tab Korelasi Pearson/Spearman bulanan x mingguan
    DataView.tsx            Tab Status data, unduh CSV, & pratinjau lokal
data/
  pemakaian.csv             Data pemakaian bulanan
  mingguan.csv              Data pemakaian mingguan
  pelanggan_aktif.csv       Daftar pelanggan aktif
  kontrak.csv               Kontrak per flowmeter / kumulatif
  config.json               Konfigurasi batas kontrak, pembuat, & ambang
template/                   Template kosong tahun 2027
```

## Menjalankan Aplikasi

```bash
# Menjalankan server pengembangan (port 3000)
npm run dev

# Membangun produksi
npm run build

# Menjalankan preview produksi
npm run preview
```

## Sinkronisasi Otomatis Google Spreadsheet (Live Database)
Aplikasi terintegrasi langsung dengan Master Google Spreadsheet:
- **ID Spreadsheet**: `1pG_wyRh482dkLYetz_cxGNyy6xA4kTYnBn7ElE1CKAY`
- **Tautan Live**: [Buka Spreadsheet](https://docs.google.com/spreadsheets/d/1pG_wyRh482dkLYetz_cxGNyy6xA4kTYnBn7ElE1CKAY/edit?usp=sharing)
- **Multi-Device Live Sync**: Pengunjung dari perangkat mana pun (ponsel, tablet, desktop) akan otomatis menarik data terbaru saat membuka halaman, tanpa perlu login viewer.
- **Auto-Refresh**: Data diperbarui secara otomatis setiap 30 menit di latar belakang, serta dapat diperbarui manual kapan saja melalui tombol **Segarkan Live Data**.
- **Tab yang Disinkronkan**:
  1. `Pemakaian Bulanan` (Data pemakaian bulanan seluruh flowmeter/pelanggan)
  2. `Pemakaian Mingguan` (Data pemakaian mingguan)
  3. `Data Kontrak` (Data nomor kontrak dan kuota m³/bulan)
  4. `Pelanggan Aktif` (Daftar pelanggan aktif)

## Fitur Interaktif Baru
1. **Garis Proyeksi Utilisasi Kontrak**: Pada grafik utilisasi kontrak gabungan di tab Proyeksi, telah ditambahkan garis referensi proyeksi (warna aksen, garis putus-putus) yang menunjukkan titik estimasi akhir periode.
2. **Kartu & Modal Zona Interaktif**:
   - Mengklik kartu zona mana pun akan memunculkan popup interaktif (*Zone Detail Modal*) berisi metrik volume, persentase pangsa pasar zona, kepatuhan kontrak zona, grafik tren bulanan & mingguan, serta daftar pelanggan di zona tersebut.
   - Memilih filter per zona akan menampilkan tampilan khusus zona yang padat dan informatif (tanpa ruang kosong).
3. **Analisis Interaktif Tab Mingguan & Bulanan × Mingguan**:
   - Tab Mingguan dan Bulanan × Mingguan menyajikan grafik dan ringkasan interaktif baik untuk seluruh zona maupun per zona distribusi terpilih.
   - Evaluasi keselarasan dan tracking error WAPE per zona.
4. **Desain Responsif**: Tata letak dioptimalkan untuk perangkat mobile dan layar lebar (<= 768px).

## Metode Analisis
- **Bulanan**: MoM, YoY, kumulatif YTD, kepatuhan batas kontrak 80%–110%, rata-rata bergerak 3 bulan, tren linear OLS, Holt damped exponential smoothing, rasio musiman YoY, serta uji mundur (MAE, RMSE, WAPE).
- **Mingguan**: Pertumbuhan WoW, rata-rata bergerak 4 minggu, median 8 minggu dengan deteksi outlier robust MAD, proyeksi bulan berjalan dari laju harian 4 minggu, dan peringatan dini kontrak.
- **Korelasi**: Alokasi mingguan harian ke bulan kalender, korelasi Pearson & Spearman rank, estimasi bias, dan WAPE.
