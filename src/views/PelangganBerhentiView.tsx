import React, { useState } from 'react';
import { StoppedCustomer, AnalysisModel } from '../types';
import * as FM from '../lib/fm';
import { N, zc, KPI, Panel } from '../lib/format';
import { Sparkline } from '../components/Charts';

export const PelangganBerhentiView: React.FC<{
  stoppedList: StoppedCustomer[];
  model: AnalysisModel;
  onOpenCustomer: (key: string) => void;
}> = ({ stoppedList, model, onOpenCustomer }) => {
  const [search, setSearch] = useState('');
  const [selectedZona, setSelectedZona] = useState('');
  const [sortKey, setSortKey] = useState<string>('lastMonth');
  const [sortDir, setSortDir] = useState<number>(-1);

  // Filter
  let filtered = stoppedList.slice();
  const q = search.trim().toLowerCase();
  if (q) {
    filtered = filtered.filter(
      item =>
        item.name.toLowerCase().includes(q) ||
        item.kode.toLowerCase().includes(q) ||
        item.fms.some(f => f.nama.toLowerCase().includes(q))
    );
  }
  if (selectedZona) {
    filtered = filtered.filter(item => item.zona === selectedZona);
  }

  // Sort
  filtered.sort((a: any, b: any) => {
    if (sortKey === 'name') return a.name.localeCompare(b.name, 'id') * sortDir;
    if (sortKey === 'zona') return a.zona.localeCompare(b.zona, 'id') * sortDir;
    if (sortKey === 'lastMonth') {
      const ma = a.lastMonth || '';
      const mb = b.lastMonth || '';
      return ma.localeCompare(mb) * sortDir;
    }
    const va = a[sortKey] ?? -Infinity;
    const vb = b[sortKey] ?? -Infinity;
    return (va < vb ? -1 : va > vb ? 1 : 0) * sortDir;
  });

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir * -1);
    } else {
      setSortKey(key);
      setSortDir(key === 'name' || key === 'zona' ? 1 : -1);
    }
  };

  // Aggregates
  const totalStoppedCust = stoppedList.length;
  const totalStoppedFm = stoppedList.reduce((acc, c) => acc + c.fms.length, 0);
  const totalHistoricalVol = stoppedList.reduce((acc, c) => acc + c.totalUsage, 0);
  const avgActiveVol =
    totalStoppedCust > 0
      ? totalHistoricalVol / Math.max(1, stoppedList.reduce((acc, c) => acc + c.activeMonthsCount, 0))
      : 0;

  // CSV Export for stopped customers
  const handleDownloadCSV = () => {
    const headers = [
      'No.Pel/Kode',
      'Group / Nama Pelanggan',
      'Zona',
      'Jumlah Flowmeter',
      'Bulan Pertama Pemakaian',
      'Bulan Terakhir Pemakaian',
      'Volume Terakhir (m3)',
      'Total Pemakaian Historis (m3)',
      'Bulan Aktif',
      'Rata-rata Pemakaian Saat Aktif (m3/bln)',
      'Durasi Nonaktif (Bulan)'
    ];
    const rows = filtered.map(c => [
      c.kode || c.key,
      `"${c.name.replace(/"/g, '""')}"`,
      c.zona,
      c.fms.length,
      c.firstMonth || '-',
      c.lastMonth || '-',
      c.lastVolume,
      c.totalUsage,
      c.activeMonthsCount,
      Math.round(c.avgActiveUsage),
      c.monthsInactive
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `riwayat_pelanggan_berhenti_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Top Banner Explaining Data Separation */}
      <div className="banner" style={{ background: 'var(--surface)', borderLeft: '4px solid var(--muted)' }}>
        <span>
          <b>Arsip Riwayat Pelanggan Berhenti:</b> Halaman ini mencatat semua pelanggan dan flowmeter yang sudah tidak aktif berlangganan beserta riwayat pemakaian terakhirnya. Tab operasional lainnya (Ringkasan, Kontrak, Zona, dan Proyeksi) difokuskan khusus untuk pelanggan aktif agar evaluasi operasional tetap akurat.
        </span>
      </div>

      {/* Aggregate KPIs */}
      <div className="kpis">
        <KPI
          label="Pelanggan nonaktif"
          value={totalStoppedCust}
          unit="pelanggan"
          sub={`${totalStoppedFm} unit flowmeter`}
        />
        <KPI
          label="Total historis"
          value={N(totalHistoricalVol)}
          unit="m³"
          sub="Akumulasi pemakaian masa lalu"
        />
        <KPI
          label="Rata-rata saat aktif"
          value={N(avgActiveVol)}
          unit="m³/bln"
          sub="Rata-rata volume bulanan"
        />
        <KPI
          label="Terakhir pemakaian"
          value={stoppedList[0]?.lastMonth ? FM.ymLabel(stoppedList[0].lastMonth) : '–'}
          unit=""
          sub={stoppedList[0] ? stoppedList[0].name : '–'}
        />
      </div>

      <Panel
        title="Daftar Pelanggan yang Sudah Berhenti Berlangganan"
        sub="Catatan kapan terakhir pemakaian tercatat, volume terakhir, dan riwayat sebelum berhenti."
      >
        <div className="toolbar" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <input
            type="search"
            placeholder="Cari nama, kode pelanggan, atau flowmeter…"
            aria-label="Cari pelanggan berhenti"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ minWidth: 260 }}
          />
          <select
            value={selectedZona}
            onChange={e => setSelectedZona(e.target.value)}
            aria-label="Filter Zona"
          >
            <option value="">Semua Zona ({stoppedList.length})</option>
            {model.zonas.map(z => {
              const count = stoppedList.filter(s => s.zona === z).length;
              return (
                <option key={z} value={z}>
                  Zona {z} ({count})
                </option>
              );
            })}
          </select>
          <button className="btn" onClick={handleDownloadCSV} title="Unduh CSV riwayat pelanggan berhenti">
            Unduh CSV Riwayat
          </button>
          <span className="muted" style={{ marginLeft: 'auto' }}>
            Menampilkan {filtered.length} dari {stoppedList.length} pelanggan nonaktif
          </span>
        </div>

        <div className="scroll tall">
          <table className="stick">
            <thead>
              <tr>
                <th className="sort" onClick={() => handleSort('name')}>
                  Pelanggan & Flowmeter {sortKey === 'name' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="sort" onClick={() => handleSort('zona')}>
                  Zona {sortKey === 'zona' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th>Periode Aktif</th>
                <th className="sort n" onClick={() => handleSort('lastMonth')}>
                  Pemakaian Terakhir {sortKey === 'lastMonth' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="sort n" onClick={() => handleSort('lastVolume')}>
                  Vol. Terakhir (m³) {sortKey === 'lastVolume' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="sort n" onClick={() => handleSort('avgActiveUsage')}>
                  Rata-rata Aktif {sortKey === 'avgActiveUsage' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="sort n" onClick={() => handleSort('totalUsage')}>
                  Total Historis (m³) {sortKey === 'totalUsage' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="sort n" onClick={() => handleSort('monthsInactive')}>
                  Nonaktif {sortKey === 'monthsInactive' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th style={{ width: 100 }}>Tren Riwayat</th>
                <th style={{ textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--muted)' }}>
                    Tidak ada pelanggan berhenti yang cocok dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                filtered.map(c => {
                  return (
                    <tr key={c.key}>
                      <td>
                        <strong>{c.name}</strong>
                        <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                          {c.kode ? `Kode: ${c.kode}` : 'Kode: –'} · {c.fms.length} Flowmeter: {c.fms.map(f => f.nama).join(', ')}
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            fontSize: 12,
                            fontWeight: 500
                          }}
                        >
                          <i
                            style={{
                              display: 'inline-block',
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: zc(c.zona, model.zonas)
                            }}
                          />
                          {c.zona}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {c.firstMonth ? FM.ymLabel(c.firstMonth) : '–'} s.d.{' '}
                        {c.lastMonth ? FM.ymLabel(c.lastMonth) : '–'}
                        <div className="muted" style={{ fontSize: 11 }}>
                          ({c.activeMonthsCount} bulan aktif)
                        </div>
                      </td>
                      <td className="n">
                        <span style={{ fontWeight: 600 }}>
                          {c.lastMonth ? FM.ymLabel(c.lastMonth) : '–'}
                        </span>
                      </td>
                      <td className="n">
                        <strong className="mono">{N(c.lastVolume)}</strong>
                      </td>
                      <td className="n mono">{N(Math.round(c.avgActiveUsage))}</td>
                      <td className="n">
                        <span className="mono" style={{ fontWeight: 600 }}>
                          {N(c.totalUsage)}
                        </span>
                      </td>
                      <td className="n">
                        <span
                          className="pill"
                          style={{
                            background: 'var(--grid)',
                            color: 'var(--fg2)',
                            fontSize: 11,
                            padding: '2px 8px',
                            borderRadius: 4
                          }}
                        >
                          {c.monthsInactive > 0 ? `${c.monthsInactive} bln lalu` : 'Bulan acuan'}
                        </span>
                      </td>
                      <td>
                        <Sparkline values={c.nums} />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn"
                          style={{ fontSize: 11, padding: '4px 8px' }}
                          onClick={() => onOpenCustomer(c.key)}
                          title="Buka rincian riwayat lengkap"
                        >
                          Detail Riwayat
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
};
