import React, { useState } from 'react';
import { AnalysisResult } from '../types';
import { N, P, DL, Pill, FlagPills, Panel } from '../lib/format';
import { Sparkline } from '../components/Charts';

export const PelangganView: React.FC<{
  A: AnalysisResult;
  onOpenCustomer: (key: string) => void;
}> = ({ A, onOpenCustomer }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortKey, setSortKey] = useState<string>('ytd');
  const [sortDir, setSortDir] = useState<number>(-1);
  const [showAll, setShowAll] = useState(false);

  let rows = A.G.slice();
  const q = search.toLowerCase();
  if (q) {
    rows = rows.filter(
      g =>
        g.name.toLowerCase().includes(q) ||
        String(g.kode).toLowerCase() === q ||
        g.g.fms.some(f => f.nama.toLowerCase().includes(q))
    );
  }

  if (statusFilter === 'chk') {
    rows = rows.filter(g => g.flagged);
  } else if (statusFilter === 'naik' || statusFilter === 'turun') {
    rows = rows.filter(g => g.flags.includes(statusFilter));
  } else if (statusFilter === 'nol') {
    rows = rows.filter(
      g =>
        g.flags.includes('nol') ||
        g.flags.includes('diam') ||
        g.flags.includes('kosong')
    );
  } else if (statusFilter === 'kontrak') {
    rows = rows.filter(g => g.st === 'above' || g.st === 'below');
  }

  rows.sort((a: any, b: any) => {
    if (sortKey === 'name') return a.name.localeCompare(b.name, 'id') * sortDir;
    if (sortKey === 'zona') return a.zona.localeCompare(b.zona, 'id') * sortDir;
    const x = a[sortKey] ?? -Infinity;
    const y = b[sortKey] ?? -Infinity;
    return (x < y ? -1 : x > y ? 1 : 0) * sortDir;
  });

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir * -1);
    } else {
      setSortKey(key);
      setSortDir(key === 'name' || key === 'zona' ? 1 : -1);
    }
  };

  const limit = showAll ? rows.length : Math.min(rows.length, 25);
  const displayedRows = rows.slice(0, limit);

  return (
    <Panel
      title="Pelanggan Aktif"
      sub="Daftar seluruh pelanggan yang saat ini aktif berlangganan. Pelanggan yang telah berhenti disajikan terpisah pada menu tab Pelanggan Berhenti. Klik baris untuk detail, grafik, dan proyeksi."
    >
      <div className="toolbar">
        <input
          type="search"
          placeholder="Cari pelanggan, flowmeter, atau kode"
          aria-label="Cari"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          aria-label="Filter"
        >
          <option value="all">Semua pelanggan</option>
          <option value="chk">Perlu dicek</option>
          <option value="naik">Naik tajam</option>
          <option value="turun">Turun tajam</option>
          <option value="nol">Nol atau meter diam</option>
          {A.hasContract && <option value="kontrak">Di luar batas kontrak</option>}
        </select>
        <span className="muted">{rows.length} pelanggan</span>
      </div>

      <div className="scroll tall">
        <table className="stick">
          <thead>
            <tr>
              <th className="sort" onClick={() => handleSort('name')}>
                Pelanggan {sortKey === 'name' ? (sortDir > 0 ? '▲' : '▼') : ''}
              </th>
              <th className="sort n" onClick={() => handleSort('ytd')}>
                YTD (m³) {sortKey === 'ytd' ? (sortDir > 0 ? '▲' : '▼') : ''}
              </th>
              <th className="sort n" onClick={() => handleSort('avg')}>
                Rata-rata/bln {sortKey === 'avg' ? (sortDir > 0 ? '▲' : '▼') : ''}
              </th>
              <th className="sort n" onClick={() => handleSort('vR')}>
                Bulan ini {sortKey === 'vR' ? (sortDir > 0 ? '▲' : '▼') : ''}
              </th>
              <th className="sort n" onClick={() => handleSort('mom')}>
                MoM {sortKey === 'mom' ? (sortDir > 0 ? '▲' : '▼') : ''}
              </th>
              <th className="sort n" onClick={() => handleSort('yoy')}>
                YoY {sortKey === 'yoy' ? (sortDir > 0 ? '▲' : '▼') : ''}
              </th>
              <th className="sort n" onClick={() => handleSort('cv')}>
                Variasi {sortKey === 'cv' ? (sortDir > 0 ? '▲' : '▼') : ''}
              </th>
              <th>Tren</th>
              <th className="sort n" onClick={() => handleSort('healthScore')}>
                Skor Sehat {sortKey === 'healthScore' ? (sortDir > 0 ? '▲' : '▼') : ''}
              </th>
              <th>Catatan data</th>
              <th className="sort" onClick={() => handleSort('ratio')}>
                Kontrak {sortKey === 'ratio' ? (sortDir > 0 ? '▲' : '▼') : ''}
              </th>
            </tr>
          </thead>
          <tbody>
            {displayedRows.map(g => {
              const hCls = g.healthScore >= 80 ? 'ok' : g.healthScore >= 60 ? 'warn' : 'bad';
              return (
              <tr
                key={g.key}
                className="clk"
                onClick={() => onOpenCustomer(g.key)}
              >
                <td className="name">
                  <b>{g.name}</b>
                  <small>
                    {g.zona}
                    {g.kode ? ` · kode ${g.kode}` : ''} · {g.nFm} FM
                  </small>
                </td>
                <td className="n">{N(g.ytd)}</td>
                <td className="n">{N(g.avg)}</td>
                <td className="n">{N(g.vR)}</td>
                <td className="n">{DL(g.mom)}</td>
                <td className="n">
                  {g.yoy != null ? DL(g.yoy) : <span className="muted">–</span>}
                </td>
                <td className="n">{g.cv ? `${P(g.cv * 100)}` : '–'}</td>
                <td>
                  <Sparkline values={g.nums} />
                </td>
                <td className="n">
                  <span className={`pill ${hCls}`} title="Indeks Kesehatan: kepatuhan kontrak, stabilitas CV & integritas data">
                    {g.healthScore}
                  </span>
                </td>
                <td>
                  {g.flags.length > 0 ? (
                    <FlagPills flags={g.flags} />
                  ) : (
                    <span className="muted">–</span>
                  )}
                </td>
                <td>
                  {g.contract ? (
                    <Pill status={g.st} />
                  ) : (
                    <span className="muted">–</span>
                  )}
                </td>
              </tr>
            );})}
          </tbody>
        </table>
      </div>

      {rows.length > 25 && (
        <div>
          <button className="btn" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Tampilkan 25 teratas' : `Tampilkan semua ${rows.length}`}
          </button>
        </div>
      )}
    </Panel>
  );
};
