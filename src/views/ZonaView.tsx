import React, { useState } from 'react';
import { AnalysisResult, WeeklyAnalysis } from '../types';
import * as FM from '../lib/fm';
import { N, P, DL, zc, Panel, KPI } from '../lib/format';
import { Sparkline, LineChart, BarChart } from '../components/Charts';
import { ZoneInfoModal } from '../components/ZoneInfoModal';

export const ZonaView: React.FC<{
  A: AnalysisResult;
  zona?: string;
  onSelectZona?: (zona: string) => void;
  onOpenCustomer?: (key: string) => void;
  weeklyAnalysis?: WeeklyAnalysis | null;
  lastSyncTime?: string | null;
}> = ({
  A,
  zona,
  onSelectZona,
  onOpenCustomer,
  weeklyAnalysis,
  lastSyncTime
}) => {
  const [modalZone, setModalZone] = useState<string | null>(null);

  const lab = A.months.map(FM.ymShort);
  const zonaList = A.Z.map(z => z.zona);

  // If a single zone is selected
  const singleZone = zona ? A.Z.find(z => z.zona === zona) || A.Z[0] : null;
  const isSingleMode = Boolean(zona && singleZone);

  // Customers in current selected zone (if single zone)
  const customersInZone = isSingleMode && singleZone
    ? A.G.filter(g => g.zona === singleZone.zona).sort((a, b) => b.ytd - a.ytd)
    : [];

  const topCustomersInZone = customersInZone.slice(0, 8);

  return (
    <>
      {/* Zone Detail Popup Modal */}
      {modalZone && (
        <ZoneInfoModal
          zonaName={modalZone}
          A={A}
          weeklyAnalysis={weeklyAnalysis}
          lastSyncTime={lastSyncTime}
          onClose={() => setModalZone(null)}
          onSelectZona={onSelectZona}
          onOpenCustomer={onOpenCustomer}
        />
      )}

      {/* When a single zone is selected: show rich dedicated interactive dashboard without empty spaces */}
      {isSingleMode && singleZone ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Hero Banner for Selected Zone */}
          <div
            className="panel"
            style={{
              borderLeft: `6px solid ${zc(singleZone.zona, zonaList)}`,
              background: 'var(--surface)',
              position: 'relative'
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
                  <h2 style={{ fontSize: 24, margin: 0 }}>Profil Interaktif: {singleZone.zona}</h2>
                  <span className="pill ok" style={{ marginLeft: 4 }}>Filter Aktif</span>
                </div>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
                  Menampilkan analisis mendalam dan profil pemakaian untuk wilayah {singleZone.zona}.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  className="btn"
                  onClick={() => setModalZone(singleZone.zona)}
                  style={{ fontSize: 13 }}
                  title="Buka ringkasan modal"
                >
                  🔍 Buka Popup Detail
                </button>
                {onSelectZona && (
                  <button
                    className="btn"
                    onClick={() => onSelectZona('')}
                    style={{ fontSize: 13 }}
                    title="Tampilkan kembali seluruh zona"
                  >
                    Tampilkan Semua Zona
                  </button>
                )}
              </div>
            </div>

            {/* 4 Informative KPIs for the selected zone */}
            <div className="tiles" style={{ marginTop: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <div className="tile ok">
                <div className="t-l">Volume Bulan Ini ({FM.ymShort(A.ref)})</div>
                <div className="t-v">{N(singleZone.vR)} <small style={{ fontSize: 13, fontWeight: 400 }}>m³</small></div>
                <div className="t-s">Pangsa: {P(singleZone.share)} · MoM: {DL(singleZone.mom)}</div>
              </div>

              <div className="tile ok">
                <div className="t-l">Kumulatif {A.year} (YTD)</div>
                <div className="t-v">{N(singleZone.ytd)} <small style={{ fontSize: 13, fontWeight: 400 }}>m³</small></div>
                <div className="t-s">YoY: {singleZone.yoy != null ? DL(singleZone.yoy) : '–'}</div>
              </div>

              <div className="tile ok">
                <div className="t-l">Populasi Pelanggan</div>
                <div className="t-v">{singleZone.nCust} <small style={{ fontSize: 13, fontWeight: 400 }}>Pelanggan</small></div>
                <div className="t-s">{singleZone.nActive} Aktif · {singleZone.nFm} Flowmeter</div>
              </div>

              <div className="tile nearHigh">
                <div className="t-l">Utilisasi Kontrak Zona</div>
                <div className="t-v">{singleZone.util != null ? `${Math.round(singleZone.util * 100)}%` : '–'}</div>
                <div className="t-s">▲ {singleZone.nAbove} Melebihi · ▼ {singleZone.nBelow} Kurang</div>
              </div>
            </div>
          </div>

          {/* Interactive Charts for the Selected Zone */}
          <div className="grid2">
            <Panel
              title={`Tren Pemakaian Bulanan: ${singleZone.zona}`}
              sub="Deret waktu pemakaian bulanan (m³) dan garis rata-rata zona"
            >
              <LineChart
                labels={lab}
                series={[
                  {
                    name: singleZone.zona,
                    color: zc(singleZone.zona, zonaList),
                    data: singleZone.nums
                  }
                ]}
                height={290}
                aria={`Tren ${singleZone.zona}`}
              />
            </Panel>

            <Panel
              title={`Top Pelanggan Terbesar di ${singleZone.zona}`}
              sub={`Kontribusi volume kumulatif ${A.year} (YTD), m³`}
            >
              <BarChart
                labels={topCustomersInZone.map(g => (g.name.length > 20 ? g.name.slice(0, 19) + '…' : g.name))}
                series={[
                  {
                    name: 'YTD (m³)',
                    color: zc(singleZone.zona, zonaList),
                    data: topCustomersInZone.map(g => g.ytd)
                  }
                ]}
                height={290}
                valueLabels={true}
                labelFmt={N}
                aria={`Top pelanggan ${singleZone.zona}`}
              />
            </Panel>
          </div>

          {/* Customer Detail Table in Selected Zone */}
          <Panel
            title={`Daftar Pelanggan di ${singleZone.zona} (${customersInZone.length} Pelanggan)`}
            sub="Rincian lengkap pelanggan di wilayah ini. Klik baris pelanggan untuk membuka riwayat pemakaian."
          >
            <div className="scroll tall" style={{ maxHeight: 420 }}>
              <table>
                <thead>
                  <tr>
                    <th>Pelanggan</th>
                    <th className="n">Flowmeter</th>
                    <th className="n">Bulan Ini ({FM.ymShort(A.ref)})</th>
                    <th className="n">MoM</th>
                    <th className="n">Kumulatif {A.year}</th>
                    <th className="n">Kontrak (m³)</th>
                    <th>Status Kontrak</th>
                  </tr>
                </thead>
                <tbody>
                  {customersInZone.map(g => {
                    const c = g.contract;
                    const ratio = g.ratio != null ? Math.round(g.ratio * 100) : null;
                    return (
                      <tr
                        key={g.key}
                        className="clk"
                        onClick={() => onOpenCustomer?.(g.key)}
                        title="Klik untuk membuka detail pelanggan"
                      >
                        <td className="name">
                          <b>{g.name}</b>
                          {g.kode && <small>Kode: {g.kode}</small>}
                        </td>
                        <td className="n">{g.nFm}</td>
                        <td className="n"><b>{N(g.vR)}</b></td>
                        <td className="n">{DL(g.mom)}</td>
                        <td className="n">{N(g.ytd)}</td>
                        <td className="n">{c ? N(c.c) : <span className="muted">–</span>}</td>
                        <td>
                          {c ? (
                            <span className={`pill ${g.st || 'ok'}`}>
                              {ratio}% ({g.st === 'above' ? 'Melebihi' : g.st === 'below' ? 'Kurang' : 'Normal'})
                            </span>
                          ) : (
                            <span className="pill none">–</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      ) : (
        /* When All Zones are shown: interactive cards with click-to-open modal */
        <section className="zcards">
          {A.Z.map(z => (
            <div
              key={z.zona}
              className="zc clk"
              style={{
                borderTopColor: zc(z.zona, zonaList),
                cursor: 'pointer'
              }}
              onClick={() => setModalZone(z.zona)}
              title={`Klik kartu untuk melihat profil interaktif lengkap ${z.zona}`}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ margin: 0 }}>{z.zona}</h2>
                  <span className="muted">
                    {z.nCust} pelanggan · {z.nFm} flowmeter
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    padding: '2px 7px',
                    borderRadius: 99,
                    fontWeight: 600
                  }}
                >
                  Detail ↗
                </span>
              </div>
              <div className="big">
                {N(z.vR)}{' '}
                <small className="muted" style={{ fontSize: 12, fontWeight: 400 }}>
                  m³ {FM.ymShort(A.ref)}
                </small>
              </div>
              <Sparkline values={z.nums} width={220} height={34} />
              <dl>
                <dt>Pangsa bulan ini</dt>
                <dd>{P(z.share)}</dd>
                <dt>MoM</dt>
                <dd>{DL(z.mom)}</dd>
                <dt>YoY</dt>
                <dd>{z.yoy != null ? DL(z.yoy) : '–'}</dd>
                <dt>Kumulatif {A.year}</dt>
                <dd>{N(z.ytd)}</dd>
                <dt>Pelanggan aktif</dt>
                <dd>
                  {z.nActive} dari {z.nCust}
                </dd>
                {A.hasContract && (
                  <>
                    <dt>Utilisasi kontrak</dt>
                    <dd>{z.util != null ? P(z.util * 100) : '–'}</dd>
                    <dt>Di luar batas</dt>
                    <dd>
                      ▲ {z.nAbove} · ▼ {z.nBelow}
                    </dd>
                  </>
                )}
                <dt>Proyeksi {FM.ymShort(A.fmonths[0])}</dt>
                <dd>{N(z.fc.fc[0])}</dd>
              </dl>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--accent)',
                  fontWeight: 500,
                  marginTop: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <span>🔍 Klik kartu untuk info interaktif & daftar pelanggan</span>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* 2 Charts (Tren & YTD) */}
      <div className="grid2">
        <Panel title="Tren pemakaian per zona" sub="Satuan m³ per bulan">
          <LineChart
            labels={lab}
            series={A.Z.map(z => ({
              name: z.zona,
              color: zc(z.zona, zonaList),
              data: z.nums
            }))}
            height={290}
            aria="Tren pemakaian per zona"
          />
        </Panel>

        <Panel
          title="Perbandingan YTD per zona"
          sub={`Kumulatif ${A.year} sampai ${FM.ymShort(A.ref)}, m³`}
        >
          <BarChart
            labels={A.Z.map(z => z.zona)}
            series={[
              {
                name: 'YTD',
                color: 'var(--s1)',
                colors: A.Z.map(z => zc(z.zona, zonaList)),
                data: A.Z.map(z => z.ytd)
              }
            ]}
            height={290}
            valueLabels={true}
            labelFmt={N}
            aria="YTD per zona"
          />
        </Panel>
      </div>

      {/* Monthly Usage Matrix */}
      <Panel title="Pemakaian bulanan per zona" sub="m³">
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Zona</th>
                {A.months.map(m => (
                  <th key={m} className="n">
                    {FM.ymShort(m)}
                  </th>
                ))}
                <th className="n">Total</th>
              </tr>
            </thead>
            <tbody>
              {A.Z.map(z => (
                <tr
                  key={z.zona}
                  className="clk"
                  onClick={() => setModalZone(z.zona)}
                  title="Klik untuk membuka profil zona"
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
                  {z.nums.map((v, i) => (
                    <td key={i} className="n">
                      {N(v)}
                    </td>
                  ))}
                  <td className="n">
                    <b>{N(FM.sum(z.nums))}</b>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                {A.total.nums.map((v, i) => (
                  <td key={i} className="n">
                    {N(v)}
                  </td>
                ))}
                <td className="n">{N(FM.sum(A.total.nums))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>

      {/* Monthly MoM Growth Matrix */}
      <Panel
        title="Pertumbuhan bulanan per zona"
        sub="Perubahan dibanding bulan sebelumnya (MoM)"
      >
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Zona (MoM)</th>
                {A.months.map(m => (
                  <th key={m} className="n">
                    {FM.ymShort(m)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {A.Z.concat([{ zona: 'Total', nums: A.total.nums } as any]).map(z => (
                <tr key={z.zona}>
                  <td>{z.zona}</td>
                  {z.nums.map((v: number, i: number) => {
                    const mom =
                      i > 0 && z.nums[i - 1] > 0
                        ? ((v - z.nums[i - 1]) / z.nums[i - 1]) * 100
                        : null;
                    return (
                      <td key={i} className="n">
                        {i === 0 ? <span className="muted">–</span> : DL(mom)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
};
