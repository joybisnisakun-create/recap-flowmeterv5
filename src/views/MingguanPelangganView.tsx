import React, { useState } from 'react';
import { WeeklyAnalysis } from '../types';
import * as FM from '../lib/fm';
import * as W from '../lib/weekly';
import { N, P, DL, WeeklyFlagPills, Panel } from '../lib/format';
import { Sparkline } from '../components/Charts';

function sevW(c: any): number {
  return c.flags.length ? (c.flags[0] === 'diam' || c.flags[0] === 'nol' ? 0 : 1) : 2;
}

export const MingguanPelangganView: React.FC<{
  A: WeeklyAnalysis | null;
  onOpenCustomer?: (key: string) => void;
}> = ({ A, onOpenCustomer }) => {
  const [search, setSearch] = useState('');
  const [flagFilter, setFlagFilter] = useState('all');
  const [sortKey, setSortKey] = useState<string>('sev');
  const [sortDir, setSortDir] = useState<number>(1);
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [matrixExpanded, setMatrixExpanded] = useState<Record<string, boolean>>({});

  if (!A) {
    return (
      <div className="banner warn">
        <span><b>Data mingguan belum tersedia.</b></span>
      </div>
    );
  }

  // Filter
  let cRowsFiltered = A.C.filter(c => {
    const q = search.toLowerCase();
    if (q && !c.nama.toLowerCase().includes(q) && !c.group.toLowerCase().includes(q)) return false;
    if (flagFilter === 'flag') return c.flags.length > 0;
    if (flagFilter === 'nol') return c.flags.includes('nol') || c.flags.includes('diam');
    if (flagFilter !== 'all') return c.flags.includes(flagFilter);
    return true;
  });

  // Sort
  cRowsFiltered.sort((a: any, b: any) => {
    if (sortKey === 'sev') {
      const x = sevW(a) * 1e6 - Math.abs(a.dev || 0);
      const y = sevW(b) * 1e6 - Math.abs(b.dev || 0);
      return sortDir * (x - y) || a.nama.localeCompare(b.nama);
    }
    if (sortKey === 'nama') {
      return sortDir * a.nama.localeCompare(b.nama);
    }
    const x = a[sortKey] ?? -1e12;
    const y = b[sortKey] ?? -1e12;
    return sortDir * (x - y) || a.nama.localeCompare(b.nama);
  });

  const cap = showAll ? cRowsFiltered.length : 40;
  const displayedCustomers = cRowsFiltered.slice(0, cap);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir * -1);
    } else {
      setSortKey(key);
      setSortDir(key === 'sev' || key === 'nama' ? 1 : -1);
    }
  };

  const last8Idx: number[] = [];
  for (let i = Math.max(0, A.n - 8); i < A.n; i++) last8Idx.push(i);

  const sortedGroupsBy8 = A.C.slice().sort(
    (a, b) => FM.sum(b.v.slice(-8)) - FM.sum(a.v.slice(-8))
  );

  return (
    <>
      <Panel
        title="Daftar pemakaian pelanggan mingguan"
        sub="Dikelompokkan per Pelanggan (Group). Pelanggan dengan beberapa flowmeter dapat dibuka dengan tombol ▶. Klik baris untuk detail lengkap."
      >
        <div className="toolbar">
          <input
            type="search"
            placeholder="Cari pelanggan…"
            aria-label="Cari pelanggan"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            value={flagFilter}
            onChange={e => setFlagFilter(e.target.value)}
            aria-label="Filter status"
          >
            <option value="all">Semua</option>
            <option value="flag">Perlu dicek</option>
            <option value="naik">Lonjakan</option>
            <option value="turun">Anjlok</option>
            <option value="nol">Nol / diam</option>
          </select>
          <span className="muted">
            {cRowsFiltered.length} pelanggan
            {cRowsFiltered.length > 40 && !showAll ? ' (40 teratas ditampilkan)' : ''}
          </span>
        </div>

        <div className="scroll tall">
          <table className="stick">
            <thead>
              <tr>
                <th className="sort" onClick={() => handleSort('nama')}>
                  Pelanggan {sortKey === 'nama' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th>Tren 16 minggu</th>
                <th className="sort n" onClick={() => handleSort('last')}>
                  Minggu terakhir {sortKey === 'last' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="sort n" onClick={() => handleSort('prev')}>
                  Minggu lalu {sortKey === 'prev' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="sort n" onClick={() => handleSort('wow')}>
                  WoW {sortKey === 'wow' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="sort n" onClick={() => handleSort('med8')}>
                  Median 8 mgg {sortKey === 'med8' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="sort n" onClick={() => handleSort('dev')}>
                  Selisih vs median {sortKey === 'dev' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="sort" onClick={() => handleSort('sev')}>
                  Status {sortKey === 'sev' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
              </tr>
            </thead>
            <tbody>
              {displayedCustomers.map((c, i) => {
                const multi = c.nFm > 1;
                const isOpen = !!expanded[c.key];

                return (
                  <React.Fragment key={c.key || i}>
                    <tr
                      className="clk"
                      onClick={() => onOpenCustomer?.(c.key || c.kode)}
                      title="Klik untuk membuka riwayat & analisis detail"
                    >
                      <td className="name">
                        {multi && (
                          <button
                            className="exp"
                            aria-label="Tampilkan rincian flowmeter"
                            aria-expanded={isOpen}
                            onClick={e => {
                              e.stopPropagation();
                              setExpanded(prev => ({ ...prev, [c.key]: !isOpen }));
                            }}
                          >
                            {isOpen ? '▼' : '▶'}
                          </button>
                        )}
                        <b>{c.nama}</b>
                        {multi && <span className="fmc-badge">{c.nFm} FM</span>}
                        <small>{c.zona}{c.kode ? ` · kode ${c.kode}` : ''}</small>
                      </td>
                      <td>
                        <Sparkline values={c.v.slice(-16)} width={96} height={24} />
                      </td>
                      <td className="n">{N(c.last)}</td>
                      <td className="n">{N(c.prev)}</td>
                      <td className="n">{DL(c.wow)}</td>
                      <td className="n">{N(c.med8)}</td>
                      <td className="n">
                        {c.dev == null
                          ? '–'
                          : `${c.dev >= 0 ? '+' : '−'}${P(Math.abs(c.dev))}`}
                      </td>
                      <td>
                        {c.flags.length > 0 ? (
                          <WeeklyFlagPills flags={c.flags} />
                        ) : (
                          <span className="pill ok">Normal</span>
                        )}
                      </td>
                    </tr>

                    {/* Sub-rows for child flowmeters */}
                    {isOpen &&
                      multi &&
                      c.fms.map(fm => (
                        <tr key={`${c.key}-${fm.nama}`} className="sub-row">
                          <td className="name" style={{ paddingLeft: 28 }}>
                            <span>{fm.nama}</span>
                            <small>Flowmeter · {fm.zona}</small>
                          </td>
                          <td>
                            <Sparkline values={fm.v.slice(-16)} width={84} height={20} />
                          </td>
                          <td className="n">{N(fm.last)}</td>
                          <td className="n">{N(fm.prev)}</td>
                          <td className="n">{DL(fm.wow)}</td>
                          <td className="n">{N(fm.med8)}</td>
                          <td className="n">
                            {fm.dev == null
                              ? '–'
                              : `${fm.dev >= 0 ? '+' : '−'}${P(Math.abs(fm.dev))}`}
                          </td>
                          <td>
                            {fm.flags.length > 0 ? (
                              <WeeklyFlagPills flags={fm.flags} />
                            ) : (
                              <span className="pill ok" style={{ fontSize: 11, padding: '0 6px' }}>
                                Normal
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {cRowsFiltered.length > 40 && (
          <button
            className="btn"
            style={{ marginTop: 8 }}
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? 'Tampilkan 40 teratas' : `Tampilkan semua ${cRowsFiltered.length}`}
          </button>
        )}
      </Panel>

      {/* Recap Last 8 Weeks Matrix Table */}
      <Panel
        title="Rekap per pelanggan (8 pekan terakhir)"
        sub="Pemakaian mingguan per pelanggan, m³. Multi-flowmeter dapat dirinci dengan tombol ▶. Baris dan kolom pertama menempel saat digulir."
      >
        <div className="scroll tall">
          <table className="stick">
            <thead>
              <tr>
                <th>Pelanggan</th>
                {last8Idx.map(i => (
                  <th key={i} className="n">
                    {W.fmtShort(A.weeks[i])}
                  </th>
                ))}
                <th className="n">Total 8 mgg</th>
              </tr>
            </thead>
            <tbody>
              {sortedGroupsBy8.map(g => {
                const multi = g.nFm > 1;
                const isOpen = !!matrixExpanded[g.key];

                return (
                  <React.Fragment key={g.key}>
                    <tr
                      className="clk"
                      onClick={() => onOpenCustomer?.(g.key || g.kode)}
                      title="Klik untuk membuka riwayat detail"
                    >
                      <td className="name">
                        {multi && (
                          <button
                            className="exp"
                            aria-label="Tampilkan rincian flowmeter"
                            aria-expanded={isOpen}
                            onClick={e => {
                              e.stopPropagation();
                              setMatrixExpanded(prev => ({ ...prev, [g.key]: !isOpen }));
                            }}
                          >
                            {isOpen ? '▼' : '▶'}
                          </button>
                        )}
                        <b>{g.nama}</b>
                        {multi && <span className="fmc-badge">{g.nFm} FM</span>}
                        <small>{g.zona}</small>
                      </td>
                      {last8Idx.map(i => (
                        <td key={i} className="n">
                          {N(g.v[i])}
                        </td>
                      ))}
                      <td className="n">
                        <b>{N(FM.sum(last8Idx.map(i => g.v[i])))}</b>
                      </td>
                    </tr>

                    {/* Sub-rows in matrix table */}
                    {isOpen &&
                      multi &&
                      g.fms.map(fm => (
                        <tr key={`${g.key}-${fm.nama}-mat`} className="sub-row">
                          <td className="name" style={{ paddingLeft: 28 }}>
                            <span>{fm.nama}</span>
                            <small>Flowmeter</small>
                          </td>
                          {last8Idx.map(i => (
                            <td key={i} className="n">
                              {N(fm.v[i])}
                            </td>
                          ))}
                          <td className="n">
                            {N(FM.sum(last8Idx.map(i => fm.v[i])))}
                          </td>
                        </tr>
                      ))}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                {last8Idx.map(i => (
                  <td key={i} className="n">
                    {N(A.total[i])}
                  </td>
                ))}
                <td className="n">
                  {N(FM.sum(last8Idx.map(i => A.total[i])))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>
    </>
  );
};
