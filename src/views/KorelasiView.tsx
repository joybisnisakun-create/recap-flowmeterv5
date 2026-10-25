import React, { useState } from 'react';
import { WeeklyAnalysis, AnalysisModel } from '../types';
import * as FM from '../lib/fm';
import { N, SG, P, DL, list, zc, nf3, GradePill, KPI, Panel } from '../lib/format';
import { LineChart, BarChart, ScatterPlot } from '../components/Charts';

function rLabel(r: number | null): string {
  return r == null ? '–' : r >= 0.95 ? 'sangat kuat' : r >= 0.85 ? 'kuat' : r >= 0.6 ? 'sedang' : 'lemah';
}

export const KorelasiView: React.FC<{
  A: WeeklyAnalysis | null;
  model: AnalysisModel;
  onOpenCustomer?: (key: string) => void;
}> = ({ A, model, onOpenCustomer }) => {
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [sortKey, setSortKey] = useState<string>('wape');
  const [sortDir, setSortDir] = useState<number>(-1);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (!A) {
    return (
      <div className="banner warn">
        <span>
          <b>Data mingguan belum tersedia.</b> Letakkan file{' '}
          <span className="mono">data/mingguan.csv</span>.
        </span>
      </div>
    );
  }

  const c = A.corr;
  if (!c.n) {
    return (
      <div className="banner warn">
        <span>
          Belum ada bulan lengkap yang bisa dibandingkan antara data mingguan dan bulanan.
        </span>
      </div>
    );
  }

  const pc = A.perC.filter(x => x.r != null);
  const rm = FM.median(pc.map(x => x.r!));
  const cnt = A.perC.reduce((o: Record<string, number>, x) => {
    o[x.grade] = (o[x.grade] || 0) + 1;
    return o;
  }, {});

  const worst = A.perC
    .filter(x => x.grade === 'selisih')
    .sort((a, b) => (b.wape || 0) - (a.wape || 0))
    .slice(0, 3);

  const ins: { tag: string; cls: string; tx: string }[] = [
    {
      tag: 'Kesimpulan',
      cls: (c.wape || 0) <= 10 ? 'ok' : 'warn',
      tx: `Pembacaan mingguan dan bulanan ${
        (c.wape || 0) <= 10 ? 'sangat selaras' : 'cukup selaras'
      }: korelasi ${rLabel(c.pearson)} (r = ${c.pearson != null ? nf3.format(c.pearson) : '–'}), selisih absolut terbobot ${P(
        c.wape
      )} dan bias ${c.bias != null ? (c.bias >= 0 ? '+' : '−') + P(Math.abs(c.bias)) : '–'} pada ${
        c.months.length
      } bulan lengkap (${FM.ymShort(c.months[0])}–${FM.ymShort(c.months[c.months.length - 1])}).`
    },
    {
      tag: 'Catatan metode',
      cls: 'info',
      tx: `r gabungan didominasi pelanggan besar, karena itu ditampilkan juga median r per pelanggan (${
        rm != null ? nf3.format(rm) : '–'
      }) dan korelasi peringkat. Nilai mingguan dibagi rata per hari ke bulan kalender, jadi selisih kecil di batas bulan wajar.`
    }
  ];

  if (worst.length) {
    ins.push({
      tag: 'Perlu ditelusuri',
      cls: 'warn',
      tx: `${list(
        worst.map(
          x =>
            `${x.nama} (${x.bias != null ? (x.bias >= 0 ? '+' : '−') + P(Math.abs(x.bias)) : ''}, WAPE ${P(
              x.wape
            )})`
        )
      )} berselisih besar antara mingguan dan bulanan. Periksa salah input, satuan, atau pembacaan meter yang berbeda.`
    });
  }

  const mw = A.perMonth
    .slice()
    .sort((a, b) => Math.abs(b.diff || 0) - Math.abs(a.diff || 0))[0];
  if (mw) {
    ins.push({
      tag: 'Bulan paling menyimpang',
      cls: Math.abs(mw.diff || 0) > 5 ? 'warn' : 'info',
      tx: `${FM.ymFull(mw.ym)}: mingguan ${N(mw.est)} m³ vs bulanan ${N(mw.act)} m³ (${
        mw.diff != null ? (mw.diff >= 0 ? '+' : '−') + P(Math.abs(mw.diff)) : '–'
      }).`
    });
  }

  // Filter & sort customer correlation table
  let rows = A.perC.filter(x => {
    const q = search.toLowerCase();
    if (q && !x.nama.toLowerCase().includes(q)) return false;
    if (gradeFilter !== 'all' && x.grade !== gradeFilter) return false;
    return true;
  });

  rows.sort((a: any, b: any) => {
    if (sortKey === 'nama') return sortDir * a.nama.localeCompare(b.nama);
    const x = a[sortKey] ?? -1e12;
    const y = b[sortKey] ?? -1e12;
    return sortDir * (x - y);
  });

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir * -1);
    } else {
      setSortKey(key);
      setSortDir(key === 'nama' ? 1 : -1);
    }
  };

  const chartLabels = A.perMonth.map(p => FM.ymShort(p.ym));

  return (
    <>
      {/* 6 KPIs */}
      <section className="kpis">
        <KPI
          label="Korelasi Pearson (r)"
          value={c.pearson != null ? nf3.format(c.pearson) : '–'}
          sub={`${rLabel(c.pearson)} · ${c.n} pasang pelanggan-bulan`}
        />
        <KPI
          label="Korelasi peringkat (Spearman)"
          value={c.spearman != null ? nf3.format(c.spearman) : '–'}
          sub="tahan terhadap pelanggan sangat besar"
        />
        <KPI
          label="Median r per pelanggan"
          value={rm != null ? nf3.format(rm) : '–'}
          sub={`${pc.length} pelanggan dengan ≥3 bulan data`}
        />
        <KPI
          label="WAPE selisih"
          value={P(c.wape)}
          sub={`galat absolut terbobot, ${c.months.length} bulan lengkap`}
        />
        <KPI
          label="Bias mingguan"
          value={
            c.bias != null
              ? `${c.bias >= 0 ? '+' : '−'}${P(Math.abs(c.bias))}`
              : '–'
          }
          sub={
            (c.bias || 0) >= 0
              ? 'mingguan sedikit lebih tinggi dari bulanan'
              : 'mingguan sedikit lebih rendah dari bulanan'
          }
        />
        <KPI
          label="Pelanggan selaras"
          value={
            <>
              {cnt.selaras || 0}
              <small>dari {A.perC.length}</small>
            </>
          }
          sub={`${cnt.cukup || 0} cukup · ${cnt.selisih || 0} selisih besar`}
        />
      </section>

      {/* Automated Correlation Insights */}
      <Panel
        title="Analisis otomatis korelasi"
        sub="Membandingkan pemakaian bulanan resmi dengan jumlah pembacaan mingguan yang dialokasikan ke bulan."
      >
        <div className="ins-grid">
          {ins.map((item, idx) => (
            <article key={idx} className="ins">
              <span className={`pill ${item.cls}`}>{item.tag}</span>
              <p>{item.tx}</p>
            </article>
          ))}
        </div>
      </Panel>

      {/* Grid: Charts */}
      <div className="grid2">
        <Panel
          title="Total bulanan: aktual vs mingguan"
          sub="Hanya bulan yang pekan-pekannya lengkap, m³"
        >
          <LineChart
            labels={chartLabels}
            series={[
              {
                name: 'Bulanan (aktual)',
                color: 'var(--s1)',
                data: A.perMonth.map(p => p.act)
              },
              {
                name: 'Dari mingguan',
                color: 'var(--s2)',
                dash: true,
                data: A.perMonth.map(p => p.est)
              }
            ]}
            height={300}
            aria="Total bulanan aktual dan dari mingguan"
          />
        </Panel>

        <Panel
          title="Selisih per bulan"
          sub="Persentase (mingguan − bulanan) ÷ bulanan (hijau = mingguan lebih tinggi, oranye = lebih rendah)"
        >
          <BarChart
            labels={chartLabels}
            series={[
              {
                name: 'Selisih',
                color: 'var(--s1)',
                colorFn: v => (v >= 0 ? '#1baf7a' : '#eb6834'),
                data: A.perMonth.map(p => p.diff),
                tipFmt: v => P(v)
              }
            ]}
            height={300}
            valueLabels={true}
            labelFmt={v => P(v).replace('%', '')}
            yFmt={v => `${Math.round(v)}%`}
            aria="Selisih persen per bulan"
          />
        </Panel>

        <Panel
          title="Sebaran pelanggan-bulan"
          sub="Setiap titik = satu flowmeter pada satu bulan. Garis putus-putus = kesesuaian sempurna (skala log)."
        >
          <ScatterPlot
            points={A.pairs.map(p => ({
              x: p.a,
              y: p.e,
              c: zc(p.x.zona, model.zonas),
              t: `${p.x.nama} ${FM.ymShort(p.ym)}`
            }))}
            xLabel="Bulanan (m³)"
            yLabel="Dari mingguan (m³)"
            aria="Sebaran bulanan vs mingguan"
          />
        </Panel>

        <Panel title="Rekap per bulan">
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Bulan</th>
                  <th className="n">Dari mingguan</th>
                  <th className="n">Bulanan</th>
                  <th className="n">Selisih</th>
                  <th className="n">%</th>
                </tr>
              </thead>
              <tbody>
                {A.perMonth.map(p => (
                  <tr key={p.ym}>
                    <td>{FM.ymFull(p.ym)}</td>
                    <td className="n">{N(p.est)}</td>
                    <td className="n">{N(p.act)}</td>
                    <td className="n">{SG(p.est - p.act)}</td>
                    <td className="n">{DL(p.diff)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* Per Customer Correlation Table */}
      <Panel
        title="Korelasi per pelanggan"
        sub="Diurutkan dari selisih terbesar. Selaras = WAPE ≤ 15% dan r ≥ 0,8; cukup = WAPE ≤ 35%."
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
            value={gradeFilter}
            onChange={e => setGradeFilter(e.target.value)}
            aria-label="Filter"
          >
            <option value="all">Semua</option>
            <option value="selisih">Selisih besar</option>
            <option value="cukup">Cukup</option>
            <option value="selaras">Selaras</option>
          </select>
          <span className="muted">{rows.length} pelanggan</span>
        </div>

        <div className="scroll tall">
          <table className="stick">
            <thead>
              <tr>
                <th className="sort" onClick={() => handleSort('nama')}>
                  Pelanggan {sortKey === 'nama' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="sort n" onClick={() => handleSort('n')}>
                  Bulan {sortKey === 'n' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="sort n" onClick={() => handleSort('sa')}>
                  Bulanan (m³) {sortKey === 'sa' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="sort n" onClick={() => handleSort('se')}>
                  Mingguan (m³) {sortKey === 'se' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="sort n" onClick={() => handleSort('bias')}>
                  Bias {sortKey === 'bias' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="sort n" onClick={() => handleSort('wape')}>
                  WAPE {sortKey === 'wape' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="sort n" onClick={() => handleSort('r')}>
                  r {sortKey === 'r' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x, idx) => {
                const multi = x.nFm > 1;
                const isOpen = !!expanded[x.key];

                return (
                  <React.Fragment key={x.key || idx}>
                    <tr
                      className="clk"
                      onClick={() => onOpenCustomer?.(x.key || x.kode)}
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
                              setExpanded(prev => ({ ...prev, [x.key]: !isOpen }));
                            }}
                          >
                            {isOpen ? '▼' : '▶'}
                          </button>
                        )}
                        <b>{x.nama}</b>
                        {multi && <span className="fmc-badge">{x.nFm} FM</span>}
                        <small>{x.zona}{x.kode ? ` · kode ${x.kode}` : ''}</small>
                      </td>
                      <td className="n">{x.n}</td>
                      <td className="n">{N(x.sa)}</td>
                      <td className="n">{N(x.se)}</td>
                      <td className="n">
                        {x.bias == null
                          ? '–'
                          : `${x.bias >= 0 ? '+' : '−'}${P(Math.abs(x.bias))}`}
                      </td>
                      <td className="n">{x.wape == null ? '–' : P(x.wape)}</td>
                      <td className="n">{x.r == null ? '–' : nf3.format(x.r)}</td>
                      <td>
                        <GradePill grade={x.grade} />
                      </td>
                    </tr>

                    {/* Sub-rows for child flowmeters */}
                    {isOpen &&
                      multi &&
                      x.fms.map(fm => (
                        <tr key={`${x.key}-${fm.nama}`} className="sub-row">
                          <td className="name" style={{ paddingLeft: 28 }}>
                            <span>{fm.nama}</span>
                            <small>Flowmeter</small>
                          </td>
                          <td className="n">{fm.n}</td>
                          <td className="n">{N(fm.sa)}</td>
                          <td className="n">{N(fm.se)}</td>
                          <td className="n">
                            {fm.bias == null
                              ? '–'
                              : `${fm.bias >= 0 ? '+' : '−'}${P(Math.abs(fm.bias))}`}
                          </td>
                          <td className="n">{fm.wape == null ? '–' : P(fm.wape)}</td>
                          <td className="n">{fm.r == null ? '–' : nf3.format(fm.r)}</td>
                          <td>
                            <GradePill grade={fm.grade} />
                          </td>
                        </tr>
                      ))}
                  </React.Fragment>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty">
                    Tidak ada pelanggan yang cocok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
};
