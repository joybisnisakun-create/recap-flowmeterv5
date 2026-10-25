import React, { useState } from 'react';
import { AnalysisResult, GroupAnalysis, ContractStatus } from '../types';
import * as FM from '../lib/fm';
import { N, P, Pill, Gauge, MonthStrip, KPI, Panel } from '../lib/format';
import { LineChart, BarChart } from '../components/Charts';

const SEV: Record<ContractStatus, number> = {
  above: 0,
  below: 1,
  nearHigh: 2,
  nearLow: 3,
  ok: 4,
  none: 5
};

export const KontrakView: React.FC<{
  A: AnalysisResult;
  simActive: boolean;
  onSimOn: () => void;
  onOpenCustomer: (key: string) => void;
}> = ({ A, simActive, onSimOn, onOpenCustomer }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortKey, setSortKey] = useState<string>('sev');
  const [sortDir, setSortDir] = useState<number>(1);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (!A.hasContract) {
    return (
      <Panel title="Kontrak belum diisi">
        <div className="empty">
          <p>
            File <span className="mono">data/kontrak.csv</span> belum berisi nilai kontrak. Isi
            kolom <b>Kontrak FM</b> untuk kontrak per flowmeter, atau <b>Kontrak Kumulatif</b> pada
            baris pertama pelanggan yang memiliki lebih dari satu flowmeter (contoh No.Pel 6a untuk
            Dover Chemical). Satuan m³ per bulan.
          </p>
          <p>
            Batas yang dipakai: maksimum <b>{A.cfg.batas_atas}%</b> dan minimum{' '}
            <b>{A.cfg.batas_bawah}%</b> dari kontrak. Nilai ini bisa diubah di{' '}
            <span className="mono">data/config.json</span>.
          </p>
          <button className="btn pri" onClick={onSimOn}>
            Lihat tampilan dengan kontrak simulasi
          </button>
        </div>
      </Panel>
    );
  }

  const c = A.cnt;
  const G = A.G.filter(g => g.contract);
  const withoutContract = A.G.filter(g => !g.contract);
  const sumEx = G.reduce((a, g) => a + g.excess, 0);
  const sumSh = G.reduce((a, g) => a + g.short, 0);

  // Filter & Sort table
  let rows = G.slice();
  const q = search.toLowerCase();
  if (q) {
    rows = rows.filter(
      g => g.name.toLowerCase().includes(q) || String(g.kode).toLowerCase() === q
    );
  }
  if (statusFilter === 'out') {
    rows = rows.filter(g => g.st === 'above' || g.st === 'below');
  } else if (statusFilter === 'near') {
    rows = rows.filter(g => g.st === 'nearHigh' || g.st === 'nearLow');
  } else if (statusFilter === 'ok') {
    rows = rows.filter(g => g.st === 'ok');
  }

  const mag = (g: GroupAnalysis) => (g.st === 'above' ? g.excess : g.st === 'below' ? g.short : 0);
  rows.sort((a, b) => {
    if (sortKey === 'sev') {
      if (SEV[a.st] !== SEV[b.st]) return (SEV[a.st] - SEV[b.st]) * sortDir;
      return (mag(b) - mag(a)) * sortDir;
    }
    if (sortKey === 'name') return a.name.localeCompare(b.name, 'id') * sortDir;
    let x: number | null = 0;
    let y: number | null = 0;
    if (sortKey === 'c') {
      x = a.contract?.c ?? 0;
      y = b.contract?.c ?? 0;
    } else if (sortKey === 'vR') {
      x = a.vR;
      y = b.vR;
    } else if (sortKey === 'ratio') {
      x = a.ratio;
      y = b.ratio;
    } else if (sortKey === 'gap') {
      x = a.excess - a.short;
      y = b.excess - b.short;
    } else if (sortKey === 'ytdR') {
      x = a.ytdR;
      y = b.ytdR;
    } else if (sortKey === 'out') {
      x = a.outCount;
      y = b.outCount;
    }
    return ((x || 0) - (y || 0)) * sortDir;
  });

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir * -1);
    } else {
      setSortKey(key);
      setSortDir(key === 'sev' || key === 'name' ? 1 : -1);
    }
  };

  // Port charts
  const idx: number[] = [];
  A.months.forEach((_, i) => {
    if (A.port[i]?.n) idx.push(i);
  });
  const portLabels = idx.map(i => FM.ymShort(A.months[i]));
  const utilData = idx.map(i => (A.port[i].ratio == null ? null : A.port[i].ratio! * 100));
  const validUtils = utilData.filter((v): v is number => v != null);
  const lo = Math.min(...validUtils, A.cfg.batas_bawah);
  const hi = Math.max(...validUtils, A.cfg.batas_atas);

  return (
    <>
      <div className="grp" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
        <span>
          Status kontrak {FM.ymFull(A.ref)} · pelanggan berkontrak <b>{G.length}</b> dari <b>{A.nCust}</b>
        </span>
        {withoutContract.length > 0 && (
          <span style={{ fontSize: 12, color: 'var(--warning-tx)', background: 'var(--warning-bg)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--warning)' }}>
            ⚠️ {withoutContract.length} pelanggan belum terdaftar kontrak: {withoutContract.map(x => x.name).join(', ')}
          </span>
        )}
      </div>

      {/* 5 Status Tiles */}
      <section className="tiles">
        <div className="tile above">
          <div className="t-l">▲ Melebihi {A.cfg.batas_atas}%</div>
          <div className="t-v">{c.above}</div>
          <div className="t-s">+{N(sumEx)} m³ di atas batas</div>
        </div>
        <div className="tile nearHigh">
          <div className="t-l">! Mendekati batas atas</div>
          <div className="t-v">{c.nearHigh}</div>
          <div className="t-s">
            {A.cfg.batas_atas - A.cfg.mendekati}–{A.cfg.batas_atas}%
          </div>
        </div>
        <div className="tile ok">
          <div className="t-l">✓ Sesuai kontrak</div>
          <div className="t-v">{c.ok}</div>
          <div className="t-s">Di antara batas</div>
        </div>
        <div className="tile nearLow">
          <div className="t-l">! Mendekati minimum</div>
          <div className="t-v">{c.nearLow}</div>
          <div className="t-s">
            {A.cfg.batas_bawah}–{A.cfg.batas_bawah + A.cfg.mendekati}%
          </div>
        </div>
        <div className="tile below">
          <div className="t-l">▼ Di bawah {A.cfg.batas_bawah}%</div>
          <div className="t-v">{c.below}</div>
          <div className="t-s">−{N(sumSh)} m³ dari minimum</div>
        </div>
      </section>

      {/* Charts */}
      <div className="grid2">
        <Panel
          title="Utilisasi kontrak gabungan"
          sub="Total pemakaian pelanggan berkontrak dibanding total kontrak. Garis putus-putus: batas minimum dan maksimum."
        >
          <LineChart
            labels={portLabels}
            series={[
              {
                name: 'Utilisasi gabungan',
                color: 'var(--s1)',
                data: utilData,
                tipFmt: v => P(v)
              }
            ]}
            yMin={Math.floor((lo - 8) / 10) * 10}
            yMax={Math.ceil((hi + 8) / 10) * 10}
            yFmt={v => `${Math.round(v)}%`}
            refLines={[
              {
                y: A.cfg.batas_atas,
                label: `Maks ${A.cfg.batas_atas}%`,
                color: 'var(--critical)'
              },
              {
                y: A.cfg.batas_bawah,
                label: `Min ${A.cfg.batas_bawah}%`,
                color: 'var(--serious)',
                below: true
              }
            ]}
            height={280}
            aria="Utilisasi kontrak gabungan per bulan"
          />
        </Panel>

        <Panel
          title="Volume di luar batas per bulan"
          sub={`Di atas ${A.cfg.batas_atas}% (naik) dan kekurangan terhadap ${A.cfg.batas_bawah}% (turun), m³`}
        >
          <BarChart
            labels={portLabels}
            series={[
              {
                name: 'Di atas batas atas',
                color: 'var(--critical)',
                data: idx.map(i => A.port[i].ex)
              },
              {
                name: 'Kekurangan dari minimum',
                color: 'var(--serious)',
                data: idx.map(i => -A.port[i].sh)
              }
            ]}
            stacked={true}
            height={280}
            tipFmt={v => N(Math.abs(v))}
            aria="Volume di luar batas kontrak"
          />
        </Panel>
      </div>

      {/* Contract Compliance Table */}
      <Panel
        title="Kepatuhan kontrak per pelanggan"
        sub={`Kontrak per bulan, batas ${A.cfg.batas_bawah}–${A.cfg.batas_atas}%. Pelanggan dengan beberapa flowmeter dijumlahkan per kode pelanggan (klik ▶ untuk rincian FM). Klik baris untuk detail.`}
      >
        <div className="toolbar">
          <input
            type="search"
            placeholder="Cari pelanggan atau kode"
            aria-label="Cari pelanggan"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            aria-label="Filter status"
          >
            <option value="all">Semua status</option>
            <option value="out">Di luar batas</option>
            <option value="near">Mendekati batas</option>
            <option value="ok">Sesuai kontrak</option>
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
                <th className="sort n" onClick={() => handleSort('c')}>
                  Kontrak (m³) {sortKey === 'c' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="n">Min – Maks (m³)</th>
                <th className="sort n" onClick={() => handleSort('vR')}>
                  Pemakaian {sortKey === 'vR' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="sort n" onClick={() => handleSort('ratio')}>
                  % kontrak {sortKey === 'ratio' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th />
                <th className="sort" onClick={() => handleSort('sev')}>
                  Status {sortKey === 'sev' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="sort n" onClick={() => handleSort('gap')}>
                  Selisih ke batas {sortKey === 'gap' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th>Persen kontrak per bulan {A.year}</th>
                <th className="sort n" onClick={() => handleSort('ytdR')}>
                  YTD {sortKey === 'ytdR' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="sort n" onClick={() => handleSort('out')}>
                  Bln di luar {sortKey === 'out' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(g => {
                const isOpen = !!expanded[g.key];
                const multi = g.nFm > 1;
                const gap =
                  g.st === 'above' ? (
                    <span style={{ color: 'var(--critical-tx)' }}>+{N(g.excess)}</span>
                  ) : g.st === 'below' ? (
                    <span style={{ color: 'var(--serious-tx)' }}>−{N(g.short)}</span>
                  ) : (
                    <span className="muted">–</span>
                  );

                return (
                  <React.Fragment key={g.key}>
                    <tr className="clk" onClick={() => onOpenCustomer(g.key)}>
                      <td className="name">
                        {multi && (
                          <button
                            className="exp"
                            aria-label="Tampilkan flowmeter"
                            aria-expanded={isOpen}
                            onClick={e => {
                              e.stopPropagation();
                              setExpanded(prev => ({ ...prev, [g.key]: !isOpen }));
                            }}
                          >
                            {isOpen ? '▼' : '▶'}
                          </button>
                        )}
                        <b>{g.name}</b>
                        <small>
                          {g.zona}
                          {g.kode ? ` · kode ${g.kode}` : ''} · {g.nFm} FM
                          {g.contract?.src === 'kumulatif' && multi ? ' · kontrak kumulatif' : ''}
                        </small>
                      </td>
                      <td className="n">{N(g.contract?.c)}</td>
                      <td className="n muted">
                        {N(((g.contract?.c || 0) * A.cfg.batas_bawah) / 100)} –{' '}
                        {N(((g.contract?.c || 0) * A.cfg.batas_atas) / 100)}
                      </td>
                      <td className="n">{N(g.vR)}</td>
                      <td className="n">
                        <b>{P(g.ratio !== null ? g.ratio * 100 : null)}</b>
                      </td>
                      <td>
                        <Gauge ratio={g.ratio} cfg={A.cfg} />
                      </td>
                      <td>
                        <Pill status={g.st} />
                      </td>
                      <td className="n">{gap}</td>
                      <td>
                        <MonthStrip g={g} year={A.year} months={A.months} />
                      </td>
                      <td className="n">{P(g.ytdR != null ? g.ytdR * 100 : null)}</td>
                      <td className="n">{g.outCount}</td>
                    </tr>
                    {isOpen &&
                      multi &&
                      g.g.fms.map(f => {
                        const v = f.v[A.ref] || 0;
                        const fc = g.contract?.fm[f.id];
                        const r = fc ? v / fc : null;
                        const st = r != null ? FM.statusOf(r, A.cfg) : null;
                        return (
                          <tr key={f.id} className="sub-row">
                            <td>
                              {f.id} · {f.nama}
                            </td>
                            <td className="n">{fc ? N(fc) : '–'}</td>
                            <td className="n">
                              {fc
                                ? `${N((fc * A.cfg.batas_bawah) / 100)} – ${N(
                                    (fc * A.cfg.batas_atas) / 100
                                  )}`
                                : '–'}
                            </td>
                            <td className="n">{N(v)}</td>
                            <td className="n">
                              {r != null ? (
                                P(r * 100)
                              ) : (
                                <span className="muted">
                                  {P(g.vR ? (v / g.vR) * 100 : 0)} dari pelanggan
                                </span>
                              )}
                            </td>
                            <td />
                            <td>{st && <Pill status={st} />}</td>
                            <td colSpan={4} />
                          </tr>
                        );
                      })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
};
