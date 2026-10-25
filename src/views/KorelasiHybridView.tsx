import React, { useState, useMemo } from 'react';
import { WeeklyAnalysis, AnalysisModel, AnalysisResult } from '../types';
import * as FM from '../lib/fm';
import { N, SG, P, DL, list, zc, nf3, GradePill, KPI, Panel } from '../lib/format';
import { LineChart, BarChart, ScatterPlot } from '../components/Charts';

function rLabel(r: number | null): string {
  return r == null ? '–' : r >= 0.95 ? 'sangat kuat' : r >= 0.85 ? 'kuat' : r >= 0.6 ? 'sedang' : 'lemah';
}

export const KorelasiHybridView: React.FC<{
  A: WeeklyAnalysis | null;
  monthlyAnalysis: AnalysisResult | null;
  model: AnalysisModel;
  zona?: string;
  onSelectZona?: (zona: string) => void;
  onOpenCustomer?: (key: string) => void;
}> = ({ A, monthlyAnalysis, model, zona = '', onSelectZona, onOpenCustomer }) => {
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [sortKey, setSortKey] = useState<string>('wape');
  const [sortDir, setSortDir] = useState<number>(-1);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (!A || !monthlyAnalysis) {
    return (
      <div className="banner warn">
        <span>
          <b>Data belum lengkap untuk korelasi.</b> Pastikan data pemakaian bulanan dan mingguan
          telah dimuat.
        </span>
      </div>
    );
  }

  const c = A.corr;
  const p = A.proj;
  const T = monthlyAnalysis.total;

  // Monthly model forecast for the current month p.ym
  const fIdx = monthlyAnalysis.fmonths.indexOf(p.ym);
  const monthlyFcVal = fIdx >= 0 ? T.fc.fc[fIdx] : T.vR;
  const weeklyProjVal = p.total;

  // Hybrid ensemble: Weighted blend based on WAPE error
  const wapeWeight = Math.min(0.85, Math.max(0.15, 1 - (c.wape || 15) / 100));
  const hybridVal = Math.round(weeklyProjVal * wapeWeight + monthlyFcVal * (1 - wapeWeight));
  const diffHybridVsMonthly = monthlyFcVal > 0 ? ((hybridVal - monthlyFcVal) / monthlyFcVal) * 100 : null;

  // Per-zone hybrid comparison and stats
  const zKeys = model.zonas.filter(z => z && z.trim().toLowerCase() !== 'tanpa zona');
  const zoneStats = useMemo(() => {
    return zKeys.map(z => {
      const zMonthly = monthlyAnalysis.Z.find(za => za.zona === z);
      const zWeekly = A.Z.find(za => za.zona === z);
      const mVal = zMonthly ? (fIdx >= 0 ? zMonthly.fc.fc[fIdx] : zMonthly.vR) : 0;
      const wVal = p.rows
        .filter(r => r.x.zona === z)
        .reduce((sum, r) => sum + r.proj, 0);
      const hVal = Math.round(wVal * wapeWeight + mVal * (1 - wapeWeight));

      // Zone customer correlations
      const zCustomers = A.perC.filter(pc => pc.zona === z);
      const rVals = zCustomers.map(zc => zc.r).filter((v): v is number => v != null);
      const medianR = rVals.length ? FM.median(rVals) : null;
      const wapeVals = zCustomers.map(zc => zc.wape).filter((v): v is number => v != null);
      const avgWape = wapeVals.length ? FM.sum(wapeVals) / wapeVals.length : null;

      const selarasCount = zCustomers.filter(zc => zc.grade === 'selaras').length;
      const cukupCount = zCustomers.filter(zc => zc.grade === 'cukup').length;
      const selisihCount = zCustomers.filter(zc => zc.grade === 'selisih').length;

      return {
        zona: z,
        monthly: mVal,
        weekly: wVal,
        hybrid: hVal,
        customerCount: zCustomers.length,
        medianR,
        avgWape,
        selarasCount,
        cukupCount,
        selisihCount,
        color: zc(z, zKeys)
      };
    });
  }, [zKeys, monthlyAnalysis, A, p, wapeWeight, fIdx]);

  // Filter & sort customer correlation
  let rows = A.perC.filter(x => {
    if (zona && x.zona !== zona) return false;
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

  const chartLabels = A.perMonth.map(pm => FM.ymShort(pm.ym));

  // Scatter points filtered by zone if active
  const scatterPoints = useMemo(() => {
    const list = zona ? A.pairs.filter(pair => pair.x.zona === zona) : A.pairs;
    return list.map(pair => ({
      x: pair.a,
      y: pair.e,
      c: zc(pair.x.zona, model.zonas),
      t: `${pair.x.nama} (${pair.x.zona}) ${FM.ymShort(pair.ym)}`
    }));
  }, [A.pairs, zona, model.zonas]);

  return (
    <>
      {/* Executive KPIs */}
      <section className="kpis">
        <KPI
          label={`Proyeksi Hybrid ${FM.ymFull(p.ym)}`}
          value={N(hybridVal)}
          unit="m³"
          sub={`Memadukan model ${T.fc.method} dengan laju mingguan`}
        />
        <KPI
          label="Pengaruh laju mingguan"
          value={
            diffHybridVsMonthly != null
              ? `${diffHybridVsMonthly >= 0 ? '+' : '−'}${P(Math.abs(diffHybridVsMonthly))}`
              : '–'
          }
          sub={`vs Model bulanan murni (${N(monthlyFcVal)} m³)`}
        />
        <KPI
          label="Korelasi Pearson (r)"
          value={c.pearson != null ? nf3.format(c.pearson) : '–'}
          sub={`${rLabel(c.pearson)} · ${c.n} pasang data`}
        />
        <KPI
          label="Korelasi Spearman (ρ)"
          value={c.spearman != null ? nf3.format(c.spearman) : '–'}
          sub="Tahan terhadap pencilan besar"
        />
        <KPI
          label="WAPE tracking error"
          value={P(c.wape)}
          sub={`Bias rata-rata: ${c.bias != null ? (c.bias >= 0 ? '+' : '−') + P(Math.abs(c.bias)) : '–'}`}
        />
        <KPI
          label="Keselarasan Pelanggan"
          value={
            <>
              {A.perC.filter(x => (!zona || x.zona === zona) && x.grade === 'selaras').length}
              <small> dari {rows.length}</small>
            </>
          }
          sub={zona ? `Hanya zona ${zona}` : 'Seluruh wilayah'}
        />
      </section>

      {/* Zone Correlation & Alignment Cards */}
      <Panel
        title="Keselarasan Bulanan × Mingguan per Zona Distribusi"
        sub="Performa sinkronisasi volume pemakaian antara laporan bulanan resmi dan catatan operasional mingguan per zona"
      >
        <div
          className="zcards"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 14
          }}
        >
          {zoneStats.map(zs => {
            const isSelected = zona === zs.zona;
            return (
              <div
                key={zs.zona}
                className="zc clk"
                style={{
                  borderTopColor: zs.color,
                  borderWidth: isSelected ? 2 : 1,
                  boxShadow: isSelected ? `0 0 0 2px ${zs.color}` : undefined,
                  cursor: 'pointer'
                }}
                onClick={() => onSelectZona?.(isSelected ? '' : zs.zona)}
                title={`Klik untuk memfilter analisis korelasi khusus ${zs.zona}`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: '50%',
                        background: zs.color
                      }}
                    />
                    <h3 style={{ margin: 0, fontSize: 16 }}>{zs.zona}</h3>
                  </div>
                  {isSelected && <span className="pill ok" style={{ fontSize: 10 }}>Aktif</span>}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', marginTop: 4, fontSize: 12.5 }}>
                  <div>
                    <span className="muted" style={{ display: 'block', fontSize: 11 }}>Korelasi (r)</span>
                    <b>{zs.medianR != null ? nf3.format(zs.medianR) : '–'}</b>
                  </div>
                  <div>
                    <span className="muted" style={{ display: 'block', fontSize: 11 }}>Akurasi (WAPE)</span>
                    <b>{zs.avgWape != null ? `${Math.round(zs.avgWape)}%` : '–'}</b>
                  </div>
                  <div>
                    <span className="muted" style={{ display: 'block', fontSize: 11 }}>Est. Hybrid</span>
                    <b>{N(zs.hybrid)} m³</b>
                  </div>
                  <div>
                    <span className="muted" style={{ display: 'block', fontSize: 11 }}>Pelanggan</span>
                    <b>{zs.selarasCount}/{zs.customerCount} Selaras</b>
                  </div>
                </div>

                <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>
                  {isSelected ? '✓ Menampilkan data zona ini (Klik untuk lepas)' : '🔍 Klik untuk fokus ke zona ini'}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* Hybrid Method Comparison Panel */}
      <Panel
        title={`Perbandingan metode proyeksi bulan berjalan (${FM.ymFull(p.ym)})`}
        sub="Mengevaluasi proyeksi bulanan murni, laju mingguan murni, dan model ensemble hybrid terbobot akurasi"
      >
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Metode Proyeksi</th>
                <th>Dasar Perhitungan</th>
                <th className="n">Estimasi Total {FM.ymShort(p.ym)}</th>
                <th className="n">Selisih vs Model Bulanan</th>
                <th>Karakteristik & Kegunaan</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <b>1. Model Bulanan Murni</b>
                </td>
                <td>{T.fc.method} (deret waktu bulanan)</td>
                <td className="n">{N(monthlyFcVal)} m³</td>
                <td className="n">Acuan dasar (0%)</td>
                <td>Cocok untuk pola tren makro jangka menengah tanpa noise pekanan</td>
              </tr>
              <tr>
                <td>
                  <b>2. Laju Mingguan Murni</b>
                </td>
                <td>Run-rate harian 4 pekan terakhir × {p.days} hari</td>
                <td className="n">{N(weeklyProjVal)} m³</td>
                <td className="n">
                  {monthlyFcVal > 0
                    ? `${weeklyProjVal >= monthlyFcVal ? '+' : '−'}${P(
                        Math.abs(((weeklyProjVal - monthlyFcVal) / monthlyFcVal) * 100)
                      )}`
                    : '–'}
                </td>
                <td>Responsif terhadap perubahan produksi atau perbaikan kebocoran terkini</td>
              </tr>
              <tr style={{ fontWeight: 600, background: 'var(--accent-soft)' }}>
                <td>
                  <b>3. Model Hybrid Terpadu (Rekomendasi)</b>
                </td>
                <td>Ensemble terbobot inversi galat WAPE ({Math.round(wapeWeight * 100)}% mingguan)</td>
                <td className="n">
                  <b>{N(hybridVal)} m³</b>
                </td>
                <td className="n">
                  {diffHybridVsMonthly != null
                    ? `${diffHybridVsMonthly >= 0 ? '+' : '−'}${P(Math.abs(diffHybridVsMonthly))}`
                    : '–'}
                </td>
                <td>Optimal: Menyeimbangkan stabilitas historis dengan dinamika realisasi riil</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Zone Comparison Grid */}
      <div className="grid2">
        <Panel
          title="Perbandingan proyeksi 3 metode per zona"
          sub="Estimasi pemakaian air m³ untuk masing-masing zona distribusi"
        >
          <BarChart
            labels={zoneStats.map(z => z.zona)}
            series={[
              {
                name: 'Model Bulanan',
                color: 'var(--s1)',
                data: zoneStats.map(z => z.monthly)
              },
              {
                name: 'Laju Mingguan',
                color: 'var(--s2)',
                data: zoneStats.map(z => z.weekly)
              },
              {
                name: 'Model Hybrid',
                color: 'var(--s3)',
                data: zoneStats.map(z => z.hybrid)
              }
            ]}
            height={300}
            aria="Proyeksi metode per zona"
          />
        </Panel>

        <Panel
          title="Tingkat akurasi pelacakan per zona (WAPE)"
          sub="Persentase galat pelacakan mingguan vs realisasi bulanan (semakin rendah = semakin akurat)"
        >
          <BarChart
            labels={zoneStats.map(z => z.zona)}
            series={[
              {
                name: 'WAPE (%)',
                color: 'var(--s1)',
                colors: zoneStats.map(z => (z.avgWape != null && z.avgWape <= 20 ? '#1baf7a' : '#eb6834')),
                data: zoneStats.map(z => z.avgWape ?? 0)
              }
            ]}
            height={300}
            valueLabels={true}
            labelFmt={v => `${Math.round(v)}%`}
            yFmt={v => `${Math.round(v)}%`}
            aria="WAPE per zona"
          />
        </Panel>
      </div>

      <div className="grid2">
        <Panel
          title={zona ? `Sebaran korelasi pelanggan di ${zona}` : 'Sebaran korelasi pelanggan seluruh zona'}
          sub="Setiap titik = 1 flowmeter pada 1 bulan kalender. Garis putus-putus = keselarasan sempurna."
        >
          <ScatterPlot
            points={scatterPoints}
            xLabel="Pemakaian Bulanan Resmi (m³)"
            yLabel="Akumulasi Mingguan Harian (m³)"
            aria="Sebaran bulanan vs mingguan"
          />
        </Panel>

        <Panel
          title="Selisih deviasi per bulan (%)"
          sub="Persentase selisih (Akumulasi Mingguan − Realisasi Bulanan) ÷ Bulanan (hijau = mingguan lebih tinggi, oranye = lebih rendah)"
        >
          <BarChart
            labels={chartLabels}
            series={[
              {
                name: 'Deviasi',
                color: 'var(--s1)',
                colorFn: v => (v >= 0 ? '#1baf7a' : '#eb6834'),
                data: A.perMonth.map(pm => pm.diff),
                tipFmt: v => P(v)
              }
            ]}
            height={300}
            valueLabels={true}
            labelFmt={v => P(v).replace('%', '')}
            yFmt={v => `${Math.round(v)}%`}
            aria="Selisih deviasi per bulan"
          />
        </Panel>
      </div>

      {/* Customer Correlation Table */}
      <Panel
        title={`Evaluasi keselarasan per pelanggan${zona ? ` (${zona})` : ''}`}
        sub="Dikelompokkan per Pelanggan (Group). Multi-flowmeter dijumlahkan ke tingkat pelanggan. Klik baris untuk detail lengkap."
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
            aria-label="Filter status"
          >
            <option value="all">Semua keselarasan</option>
            <option value="selisih">Selisih besar (WAPE &gt; 35%)</option>
            <option value="cukup">Cukup (WAPE 15%–35%)</option>
            <option value="selaras">Selaras (WAPE ≤ 15%)</option>
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
                <th>Zona</th>
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
                        {x.kode && <small>Kode {x.kode}</small>}
                      </td>
                      <td>
                        <span
                          className="pill"
                          style={{
                            background: `${zc(x.zona, model.zonas)}20`,
                            color: zc(x.zona, model.zonas),
                            fontWeight: 600
                          }}
                        >
                          {x.zona}
                        </span>
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
                          <td><small className="muted">{x.zona}</small></td>
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
                  <td colSpan={9} className="empty">
                    Tidak ada pelanggan yang cocok dengan filter.
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
