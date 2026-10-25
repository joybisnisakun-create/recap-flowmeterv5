import React, { useState } from 'react';
import { WeeklyAnalysis, AnalysisModel, AnalysisResult } from '../types';
import * as FM from '../lib/fm';
import * as W from '../lib/weekly';
import { N, P, DL, SG, zc, Panel, FlagPills } from '../lib/format';
import { Sparkline, LineChart, BarChart } from '../components/Charts';
import { ZoneInfoModal } from '../components/ZoneInfoModal';

export const MingguanZonaView: React.FC<{
  A: WeeklyAnalysis | null;
  model: AnalysisModel;
  zona?: string;
  onSelectZona?: (zona: string) => void;
  onOpenCustomer?: (key: string) => void;
  monthlyAnalysis?: AnalysisResult | null;
  lastSyncTime?: string | null;
}> = ({
  A,
  model,
  zona,
  onSelectZona,
  onOpenCustomer,
  monthlyAnalysis,
  lastSyncTime
}) => {
  const [modalZone, setModalZone] = useState<string | null>(null);

  if (!A) {
    return (
      <div className="banner warn">
        <span><b>Data mingguan belum tersedia.</b></span>
      </div>
    );
  }

  const li = A.li;
  const lab = A.weeks.map(W.fmtShort);
  // Filter out any invalid / "Tanpa Zona"
  const validZones = A.Z.filter(
    z => z.zona && z.zona.trim() && z.zona.toLowerCase() !== 'tanpa zona'
  );
  const zonaList = validZones.map(z => z.zona);

  const last8Idx: number[] = [];
  for (let i = Math.max(0, A.n - 8); i < A.n; i++) last8Idx.push(i);

  // If a single zone is selected
  const isSingle = Boolean(zona && validZones.some(z => z.zona === zona));
  const singleZone = isSingle ? validZones.find(z => z.zona === zona) : null;

  // Customers in current selected zone
  const customersInZone = isSingle && singleZone
    ? A.C.filter(c => c.zona === singleZone.zona)
        .sort((a, b) => (b.last || 0) - (a.last || 0))
    : [];

  const topWeeklyMoversInZone = customersInZone
    .filter(c => c.d != null && c.d !== 0)
    .sort((a, b) => Math.abs(b.d!) - Math.abs(a.d!))
    .slice(0, 8);

  return (
    <>
      {/* Zone Detail Modal */}
      {modalZone && monthlyAnalysis && (
        <ZoneInfoModal
          zonaName={modalZone}
          A={monthlyAnalysis}
          weeklyAnalysis={A}
          lastSyncTime={lastSyncTime}
          onClose={() => setModalZone(null)}
          onSelectZona={onSelectZona}
          onOpenCustomer={onOpenCustomer}
        />
      )}

      {/* Single Zone Mode */}
      {isSingle && singleZone ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Header Profile for Selected Zone */}
          <div
            className="panel"
            style={{
              borderLeft: `6px solid ${zc(singleZone.zona, zonaList)}`,
              background: 'var(--surface)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: zc(singleZone.zona, zonaList),
                      boxShadow: `0 0 8px ${zc(singleZone.zona, zonaList)}`
                    }}
                  />
                  <h2 style={{ fontSize: 24, margin: 0 }}>Profil Mingguan: {singleZone.zona}</h2>
                  <span className="pill ok">Filter Aktif</span>
                </div>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
                  Dinamika pemakaian per pekan dan deteksi pergerakan pelanggan di {singleZone.zona}.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {monthlyAnalysis && (
                  <button
                    className="btn"
                    onClick={() => setModalZone(singleZone.zona)}
                    style={{ fontSize: 13 }}
                  >
                    🔍 Buka Popup Detail
                  </button>
                )}
                {onSelectZona && (
                  <button
                    className="btn"
                    onClick={() => onSelectZona('')}
                    style={{ fontSize: 13 }}
                  >
                    Tampilkan Semua Zona
                  </button>
                )}
              </div>
            </div>

            {/* 4 Informative KPIs for the weekly zone */}
            <div className="tiles" style={{ marginTop: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <div className="tile ok">
                <div className="t-l">Volume Minggu Ini ({W.fmtShort(A.weeks[li])})</div>
                <div className="t-v">{N(singleZone.last)} <small style={{ fontSize: 13, fontWeight: 400 }}>m³</small></div>
                <div className="t-s">WoW: {DL(singleZone.wow)} · Pangsa: {P(A.total[li] > 0 ? (singleZone.last / A.total[li]) * 100 : 0)}</div>
              </div>

              <div className="tile ok">
                <div className="t-l">Rata-rata 8 Pekan</div>
                <div className="t-v">{N(singleZone.avg8)} <small style={{ fontSize: 13, fontWeight: 400 }}>m³/mgg</small></div>
                <div className="t-s">vs Rata-rata: {DL(singleZone.avg8 > 0 ? ((singleZone.last - singleZone.avg8) / singleZone.avg8) * 100 : null)}</div>
              </div>

              <div className="tile ok">
                <div className="t-l">Akumulasi Pekanan {A.weeks[li].slice(0, 4)}</div>
                <div className="t-v">{N(FM.sum(singleZone.v.filter((_, i) => A.weeks[i].slice(0, 4) === A.weeks[li].slice(0, 4))))} <small style={{ fontSize: 13, fontWeight: 400 }}>m³</small></div>
                <div className="t-s">Total pemakaian pekanan tahun berjalan</div>
              </div>

              <div className="tile nearHigh">
                <div className="t-l">Pelanggan Aktif Terpantau</div>
                <div className="t-v">{customersInZone.length} <small style={{ fontSize: 13, fontWeight: 400 }}>Pelanggan</small></div>
                <div className="t-s">{customersInZone.filter(c => c.flags.length > 0).length} Pelanggan terdeteksi anomali</div>
              </div>
            </div>
          </div>

          {/* Interactive Charts for this Zone */}
          <div className="grid2">
            <Panel
              title={`Tren Pemakaian Mingguan: ${singleZone.zona} (52 Pekan)`}
              sub="Deret pemakaian m³ per pekan di zona ini"
            >
              <LineChart
                labels={lab}
                series={[
                  {
                    name: singleZone.zona,
                    color: zc(singleZone.zona, zonaList),
                    data: singleZone.v
                  }
                ]}
                height={290}
                aria={`Tren mingguan ${singleZone.zona}`}
              />
            </Panel>

            <Panel
              title={`Pergerakan Pelanggan Terbesar di ${singleZone.zona}`}
              sub="Selisih volume vs minggu sebelumnya (m³), hijau = naik, oranye = turun"
            >
              <BarChart
                labels={topWeeklyMoversInZone.map(c => (c.nama.length > 20 ? c.nama.slice(0, 19) + '…' : c.nama))}
                series={[
                  {
                    name: 'Selisih (m³)',
                    color: 'var(--s1)',
                    colorFn: v => (v >= 0 ? '#1baf7a' : '#eb6834'),
                    data: topWeeklyMoversInZone.map(c => c.d || 0)
                  }
                ]}
                height={290}
                valueLabels={true}
                labelFmt={N}
                aria={`Pergerakan pelanggan di ${singleZone.zona}`}
              />
            </Panel>
          </div>

          {/* Customer Weekly Table in Selected Zone */}
          <Panel
            title={`Daftar Pelanggan Mingguan di ${singleZone.zona} (${customersInZone.length} Pelanggan)`}
            sub="Klik baris pelanggan untuk membuka riwayat pemakaian lengkap"
          >
            <div className="scroll tall" style={{ maxHeight: 420 }}>
              <table>
                <thead>
                  <tr>
                    <th>Pelanggan</th>
                    <th className="n">Minggu Lalu</th>
                    <th className="n">Minggu Ini ({W.fmtShort(A.weeks[li])})</th>
                    <th className="n">Selisih</th>
                    <th className="n">WoW</th>
                    <th className="n">Median 8 Mgg</th>
                    <th>Status / Anomali</th>
                  </tr>
                </thead>
                <tbody>
                  {customersInZone.map(c => (
                    <tr
                      key={c.key}
                      className="clk"
                      onClick={() => onOpenCustomer?.(c.key)}
                      title="Klik untuk melihat detail pelanggan"
                    >
                      <td className="name">
                        <b>{c.nama}</b>
                        {c.kode && <small>Kode: {c.kode}</small>}
                      </td>
                      <td className="n">{N(c.prev)}</td>
                      <td className="n"><b>{N(c.last)}</b></td>
                      <td className="n">{c.d != null ? SG(c.d) : '–'}</td>
                      <td className="n">{DL(c.wow)}</td>
                      <td className="n">{N(c.med8)}</td>
                      <td>
                        {c.flags.length > 0 ? (
                          <FlagPills flags={c.flags} />
                        ) : (
                          <span className="pill ok">Stabil</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      ) : (
        /* All Zones View */
        <section
          className="zcards"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 16,
            marginBottom: 8
          }}
        >
          {validZones.map(z => {
            const ytdZ = FM.sum(
              z.v.filter((_, i) => A.weeks[i].slice(0, 4) === A.weeks[li].slice(0, 4))
            );
            const share = A.total[li] > 0 ? (z.last / A.total[li]) * 100 : 0;
            const color = zc(z.zona, zonaList);
            const vsAvg = z.avg8 > 0 ? ((z.last - z.avg8) / z.avg8) * 100 : null;

            return (
              <div
                key={z.zona}
                className="zc zc-premium clk"
                style={{
                  borderTopColor: color,
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'pointer'
                }}
                onClick={() => setModalZone(z.zona)}
                title={`Klik untuk melihat profil interaktif ${z.zona}`}
              >
                {/* Header: Zone and WoW pill */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: color,
                          boxShadow: `0 0 8px ${color}`,
                          display: 'inline-block'
                        }}
                      />
                      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>
                        {z.zona}
                      </h2>
                    </div>
                    <span className="muted" style={{ fontSize: 11.5, display: 'block', marginTop: 2 }}>
                      Zona Distribusi Air
                    </span>
                  </div>

                  {z.wow != null && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 7px',
                        borderRadius: 6,
                        background: z.wow > 0 ? 'rgba(34, 197, 94, 0.12)' : z.wow < 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(156, 163, 175, 0.12)',
                        color: z.wow > 0 ? '#16a34a' : z.wow < 0 ? '#dc2626' : 'var(--muted)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        fontVariantNumeric: 'tabular-nums'
                      }}
                      title="Perubahan dibanding minggu lalu (Week-over-Week)"
                    >
                      {z.wow > 0 ? '▲ +' : z.wow < 0 ? '▼ ' : ''}
                      {Math.abs(z.wow).toFixed(1)}%
                    </span>
                  )}
                </div>

                {/* Big Volume Metric */}
                <div className="big" style={{ margin: '4px 0 2px' }}>
                  {N(z.last)}{' '}
                  <small className="muted" style={{ fontSize: 12, fontWeight: 400 }}>
                    m³ ({W.fmtShort(A.weeks[li])})
                  </small>
                </div>

                {/* Trend Sparkline */}
                <div style={{ background: 'var(--bg)', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--muted)', marginBottom: 2 }}>
                    <span>Tren 52 pekan</span>
                    <span>{W.fmtShort(A.weeks[li])}</span>
                  </div>
                  <Sparkline values={z.v} width={220} height={32} />
                </div>

                {/* KPI Details */}
                <dl style={{ marginTop: 4 }}>
                  <dt>Pangsa minggu ini</dt>
                  <dd><b>{P(share)}</b></dd>

                  <dt>WoW</dt>
                  <dd>{DL(z.wow)}</dd>

                  <dt>Rata-rata 8 minggu</dt>
                  <dd>{N(z.avg8)} m³</dd>

                  <dt>vs Rata-rata</dt>
                  <dd>{DL(vsAvg)}</dd>

                  <dt>Kumulatif {A.weeks[li].slice(0, 4)}</dt>
                  <dd><b>{N(ytdZ)} m³</b></dd>
                </dl>

                <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500, marginTop: 4 }}>
                  <span>🔍 Klik kartu untuk profil zona & pelanggan</span>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* 2 Interactive Charts */}
      <div className="grid2">
        <Panel title="Tren pemakaian mingguan per zona" sub="Satuan m³ per pekan (52 pekan terakhir)">
          <LineChart
            labels={lab}
            series={validZones.map(z => ({
              name: z.zona,
              color: zc(z.zona, zonaList),
              data: z.v
            }))}
            height={290}
            aria="Tren pemakaian mingguan per zona"
          />
        </Panel>

        <Panel
          title="Perbandingan volume minggu terakhir per zona"
          sub={`Minggu berakhir ${W.fmtShort(A.weeks[li])}, m³`}
        >
          <BarChart
            labels={validZones.map(z => z.zona)}
            series={[
              {
                name: 'Minggu terakhir',
                color: 'var(--s1)',
                colors: validZones.map(z => zc(z.zona, zonaList)),
                data: validZones.map(z => z.last)
              }
            ]}
            height={290}
            valueLabels={true}
            labelFmt={N}
            aria="Perbandingan volume per zona"
          />
        </Panel>
      </div>

      {/* Additional Interactive Chart: WoW Growth Per Zone */}
      <Panel
        title="Pertumbuhan volume per zona (Week-over-Week)"
        sub={`Persentase perubahan minggu terakhir dibanding minggu sebelumnya. Hijau = naik, oranye = turun.`}
      >
        <BarChart
          labels={validZones.map(z => z.zona)}
          series={[
            {
              name: 'WoW (%)',
              color: 'var(--s1)',
              colorFn: v => (v >= 0 ? '#1baf7a' : '#eb6834'),
              data: validZones.map(z => z.wow ?? 0)
            }
          ]}
          height={240}
          valueLabels={true}
          labelFmt={v => `${P(v)}`}
          aria="Pertumbuhan WoW per zona"
        />
      </Panel>

      {/* Weekly Matrix per Zone */}
      <Panel
        title="Pemakaian mingguan per zona (8 pekan terakhir)"
        sub="m³. Menempel saat digulir horizontal. Klik nama zona untuk membuka profil zona."
      >
        <div className="scroll tall">
          <table className="stick">
            <thead>
              <tr>
                <th>Zona</th>
                {last8Idx.map(i => (
                  <th key={i} className="n">
                    {W.fmtShort(A.weeks[i])}
                  </th>
                ))}
                <th className="n">Total 8 mgg</th>
              </tr>
            </thead>
            <tbody>
              {validZones.map(z => (
                <tr
                  key={z.zona}
                  className="clk"
                  onClick={() => setModalZone(z.zona)}
                  title="Klik untuk melihat profil zona"
                >
                  <td>
                    <i
                      className="sw"
                      style={{
                        background: zc(z.zona, zonaList),
                        marginRight: 6
                      }}
                    />
                    <b>{z.zona}</b>
                  </td>
                  {last8Idx.map(i => (
                    <td key={i} className="n">
                      {N(z.v[i])}
                    </td>
                  ))}
                  <td className="n">
                    <b>{N(FM.sum(last8Idx.map(i => z.v[i])))}</b>
                  </td>
                </tr>
              ))}
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
