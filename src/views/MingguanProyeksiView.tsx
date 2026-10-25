import React, { useState } from 'react';
import { WeeklyAnalysis, AnalysisModel, AppConfig } from '../types';
import * as FM from '../lib/fm';
import { N, P, DL, Pill, KPI, Panel } from '../lib/format';
import { LineChart, BarChart } from '../components/Charts';

export const MingguanProyeksiView: React.FC<{
  A: WeeklyAnalysis | null;
  model: AnalysisModel;
  cfg: AppConfig;
  contracts: any[];
  simActive: boolean;
  onOpenCustomer?: (key: string) => void;
}> = ({ A, model, cfg, contracts, simActive, onOpenCustomer }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (!A) {
    return (
      <div className="banner warn">
        <span><b>Data mingguan belum tersedia.</b></span>
      </div>
    );
  }

  const p = A.proj;
  const li = A.li;
  const cRows = contracts.length
    ? contracts
    : simActive
    ? FM.simulateContracts(model)
    : [];

  const yr = FM.yearOf(p.ym);
  const gObj: Record<string, any> = {};
  p.rows.forEach(pr => {
    const k = pr.kode || pr.group;
    gObj[k] = gObj[k] || {
      kode: k,
      name: pr.group,
      zona: pr.zona,
      proj: 0,
      mtd: 0,
      nFm: pr.nFm,
      fms: pr.fms
    };
    gObj[k].proj += pr.proj;
    gObj[k].mtd += pr.mtd;
  });

  const contractEvaluations: any[] = [];
  Object.keys(gObj).forEach(k => {
    const o = gObj[k];
    const c = FM.contractFor(cRows, k, yr, o.name);
    if (c && c.c) {
      o.c = c.c;
      o.ratio = o.proj / c.c;
      o.st = FM.statusOf(o.ratio, cfg);
      o.gap = o.st === 'above'
        ? o.proj - (cfg.batas_atas / 100) * c.c
        : o.st === 'below'
        ? (cfg.batas_bawah / 100) * c.c - o.proj
        : 0;
      contractEvaluations.push(o);
    }
  });

  const earlyRisks = contractEvaluations
    .filter(x => x.st === 'above' || x.st === 'below')
    .sort((a, b) => Math.abs(b.ratio - 1) - Math.abs(a.ratio - 1));

  const prevYm = FM.ymAdd(p.ym, -1);
  const prevV = FM.sum(model.groups.map(g => g.v[prevYm] || 0));
  const diffPrev = prevV > 0 ? ((p.total - prevV) / prevV) * 100 : null;

  const runRateDaily = p.days > p.mtdDays ? (p.total - p.mtd) / (p.days - p.mtdDays) : 0;

  // Filtered customer list
  let customerList = p.rows.map(pr => {
    const c = contractEvaluations.find(ce => ce.kode === pr.kode || ce.name === pr.group);
    return {
      kode: pr.kode,
      nama: pr.nama,
      group: pr.group,
      zona: pr.zona,
      nFm: pr.nFm,
      fms: pr.fms,
      mtd: pr.mtd,
      proj: pr.proj,
      c: c?.c || null,
      ratio: c?.c ? pr.proj / c.c : null,
      st: c?.c ? FM.statusOf(pr.proj / c.c, cfg) : 'none'
    };
  });

  if (search) {
    const q = search.toLowerCase();
    customerList = customerList.filter(
      c => c.nama.toLowerCase().includes(q) || c.group.toLowerCase().includes(q)
    );
  }

  if (statusFilter === 'out') {
    customerList = customerList.filter(c => c.st === 'above' || c.st === 'below');
  } else if (statusFilter === 'ok') {
    customerList = customerList.filter(c => c.st === 'ok');
  }

  // Zone projections
  const zoneProj: Record<string, { mtd: number; proj: number }> = {};
  p.rows.forEach(pr => {
    const z = pr.x.zona;
    zoneProj[z] = zoneProj[z] || { mtd: 0, proj: 0 };
    zoneProj[z].mtd += pr.mtd;
    zoneProj[z].proj += pr.proj;
  });

  const zKeys = Object.keys(zoneProj).sort();

  return (
    <>
      {/* 4 KPIs */}
      <section className="kpis">
        <KPI
          label={`Proyeksi total ${FM.ymFull(p.ym)}`}
          value={N(p.total)}
          unit="m³"
          sub={
            p.full
              ? 'Bulan kalender sudah lengkap'
              : `Terisi ${p.mtdDays}/${p.days} hari · ${N(p.mtd)} m³ s.d. pekan terakhir`
          }
        />
        <KPI
          label={`vs Realisasi ${FM.ymShort(prevYm)}`}
          value={diffPrev != null ? `${diffPrev >= 0 ? '+' : '−'}${P(Math.abs(diffPrev))}` : '–'}
          sub={`Bulan sebelumnya: ${N(prevV)} m³`}
        />
        <KPI
          label="Risiko batas kontrak dini"
          value={
            <>
              {earlyRisks.length}
              <small>pelanggan</small>
            </>
          }
          sub={
            cRows.length
              ? `di luar batas ${cfg.batas_bawah}–${cfg.batas_atas}%`
              : 'Kontrak belum diisi'
          }
        />
        <KPI
          label="Laju harian rata-rata 4 pekan"
          value={N(runRateDaily)}
          unit="m³/hari"
          sub={`Sisa ${Math.max(0, p.days - p.mtdDays)} hari kalender`}
        />
      </section>

      {/* Early Contract Warning Panel */}
      <Panel
        title={`Peringatan dini kontrak ${FM.ymFull(p.ym)}`}
        sub={`Estimasi capaian akhir bulan berdasarkan laju harian 4 pekan terakhir dibanding batas kontrak (${
          cfg.batas_bawah
        }–${cfg.batas_atas}%).${simActive ? ' (Simulasi)' : ''}`}
      >
        {earlyRisks.length > 0 ? (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Pelanggan</th>
                  <th>Zona</th>
                  <th className="n">Kontrak (m³)</th>
                  <th className="n">Terpakai s.d. kini</th>
                  <th className="n">Proyeksi akhir bulan</th>
                  <th className="n">% kontrak</th>
                  <th>Status</th>
                  <th className="n">Deviasi dari batas</th>
                </tr>
              </thead>
              <tbody>
                {earlyRisks.map(x => (
                  <tr key={x.kode}>
                    <td>
                      <b>{x.name}</b>
                    </td>
                    <td>{x.zona}</td>
                    <td className="n">{N(x.c)}</td>
                    <td className="n">{N(x.mtd)}</td>
                    <td className="n">
                      <b>{N(x.proj)}</b>
                    </td>
                    <td className="n">{P(x.ratio * 100)}</td>
                    <td>
                      <Pill status={x.st} />
                    </td>
                    <td className="n">
                      {x.st === 'above' ? (
                        <span style={{ color: 'var(--critical-tx)' }}>+{N(x.gap)} m³</span>
                      ) : (
                        <span style={{ color: 'var(--serious-tx)' }}>−{N(x.gap)} m³</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">
            Semua {contractEvaluations.length} pelanggan berkontrak diproyeksikan berada dalam batas
            kepatuhan {cfg.batas_bawah}–{cfg.batas_atas}%.
          </p>
        )}
      </Panel>

      {/* Grid: Zone Breakdown */}
      <div className="grid2">
        <Panel
          title="Proyeksi bulan berjalan per zona"
          sub="Realisasi s.d. pekan terakhir dan estimasi total akhir bulan (m³)"
        >
          <BarChart
            labels={zKeys}
            series={[
              {
                name: 'Terpakai s.d. kini',
                color: 'var(--s1)',
                data: zKeys.map(z => zoneProj[z].mtd)
              },
              {
                name: 'Proyeksi total',
                color: 'var(--s2)',
                data: zKeys.map(z => zoneProj[z].proj)
              }
            ]}
            height={280}
            aria="Proyeksi per zona"
          />
        </Panel>

        <Panel title="Metode proyeksi berbasis laju mingguan">
          <ul className="dl-list">
            <li>
              <b>Dekomposisi Harian</b>: Total pemakaian setiap pekan dibagi rata ke 7 hari
              kalender untuk mengidentifikasi volume yang jatuh di bulan {FM.ymFull(p.ym)}.
            </li>
            <li>
              <b>Run-Rate 4 Pekan</b>: Laju harian dari 4 pekan terakhir digunakan untuk
              memproyeksikan sisa {Math.max(0, p.days - p.mtdDays)} hari kalender hingga akhir bulan.
            </li>
            <li>
              <b>Peringatan Dini</b>: Hasil nowcasting dibandingkan langsung dengan batas atas (
              {cfg.batas_atas}%) dan batas bawah ({cfg.batas_bawah}%) kontrak pelanggan untuk mitigasi
              dini.
            </li>
          </ul>
        </Panel>
      </div>

      {/* Customer Projection Table */}
      <Panel
        title="Rincian proyeksi per pelanggan"
        sub="Estimasi total volume bulan berjalan per pelanggan berdasarkan laju pemakaian mingguan"
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
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            aria-label="Filter status"
          >
            <option value="all">Semua pelanggan</option>
            <option value="out">Di luar batas kontrak</option>
            <option value="ok">Sesuai kontrak</option>
          </select>
          <span className="muted">{customerList.length} pelanggan</span>
        </div>

        <div className="scroll tall">
          <table className="stick">
            <thead>
              <tr>
                <th>Pelanggan</th>
                <th>Zona</th>
                <th className="n">Terpakai s.d. kini (m³)</th>
                <th className="n">Proyeksi akhir bulan (m³)</th>
                <th className="n">Kontrak (m³)</th>
                <th className="n">% kontrak</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {customerList.map((c, i) => {
                const multi = c.nFm > 1;
                const isOpen = !!expanded[c.kode || c.nama];

                return (
                  <React.Fragment key={c.kode || i}>
                    <tr
                      className="clk"
                      onClick={() => onOpenCustomer?.(c.kode || c.nama)}
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
                              setExpanded(prev => ({ ...prev, [c.kode || c.nama]: !isOpen }));
                            }}
                          >
                            {isOpen ? '▼' : '▶'}
                          </button>
                        )}
                        <b>{c.nama}</b>
                        {multi && <span className="fmc-badge">{c.nFm} FM</span>}
                        <small>{c.zona}{c.kode ? ` · kode ${c.kode}` : ''}</small>
                      </td>
                      <td>{c.zona}</td>
                      <td className="n">{N(c.mtd)}</td>
                      <td className="n">
                        <b>{N(c.proj)}</b>
                      </td>
                      <td className="n">{c.c ? N(c.c) : '–'}</td>
                      <td className="n">{c.ratio != null ? P(c.ratio * 100) : '–'}</td>
                      <td>{c.st !== 'none' ? <Pill status={c.st} /> : <span className="muted">–</span>}</td>
                    </tr>

                    {/* Sub-rows for child flowmeters */}
                    {isOpen &&
                      multi &&
                      c.fms.map(fm => (
                        <tr key={`${c.kode}-${fm.nama}`} className="sub-row">
                          <td className="name" style={{ paddingLeft: 28 }}>
                            <span>{fm.nama}</span>
                            <small>Flowmeter</small>
                          </td>
                          <td>{c.zona}</td>
                          <td className="n">{N(fm.mtd)}</td>
                          <td className="n">{N(fm.proj)}</td>
                          <td className="n muted">–</td>
                          <td className="n muted">–</td>
                          <td><span className="muted">–</span></td>
                        </tr>
                      ))}
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
