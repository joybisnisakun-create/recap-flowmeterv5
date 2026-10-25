import React from 'react';
import { AnalysisResult, WeeklyAnalysis } from '../types';
import * as FM from '../lib/fm';
import { N, P, DL, zc, KPI, Panel } from '../lib/format';
import { Sparkline, LineChart, BarChart } from './Charts';

export interface ZoneInfoModalProps {
  zonaName: string;
  A: AnalysisResult;
  weeklyAnalysis?: WeeklyAnalysis | null;
  lastSyncTime?: string | null;
  onClose: () => void;
  onSelectZona?: (zona: string) => void;
  onOpenCustomer?: (key: string) => void;
}

export const ZoneInfoModal: React.FC<ZoneInfoModalProps> = ({
  zonaName,
  A,
  weeklyAnalysis,
  lastSyncTime,
  onClose,
  onSelectZona,
  onOpenCustomer
}) => {
  const zonaList = A.Z.map(z => z.zona);
  const zData = A.Z.find(z => z.zona === zonaName);
  const zoneColor = zc(zonaName, zonaList);

  // Customers belonging to this zone
  const customersInZone = A.G.filter(g => g.zona === zonaName)
    .sort((a, b) => b.ytd - a.ytd);

  const nCust = zData?.nCust || customersInZone.length;
  const nFm = zData?.nFm || customersInZone.reduce((acc, g) => acc + (g.nFm || 1), 0);
  const totalVolume = zData?.vR || 0;
  const totalYtd = zData?.ytd || 0;
  const share = zData?.share || 0;

  // Contract analysis within this zone
  const contractedCust = customersInZone.filter(g => g.contract);
  const totalContract = contractedCust.reduce((acc, g) => acc + (g.contract?.c || 0), 0);
  const contractedUsage = contractedCust.reduce((acc, g) => acc + g.vR, 0);
  const zoneContractUtil = totalContract > 0 ? (contractedUsage / totalContract) * 100 : null;

  const nAbove = customersInZone.filter(g => g.st === 'above').length;
  const nBelow = customersInZone.filter(g => g.st === 'below').length;
  const nNormal = contractedCust.length - nAbove - nBelow;

  // Monthly trend series for this zone
  const monthLabels = A.months.map(FM.ymShort);
  const zoneMonthlyNums = zData?.nums || [];

  // Top 5 customers contribution
  const top5 = customersInZone.slice(0, 5);

  // Weekly data for this zone if available
  const weeklyZoneData = weeklyAnalysis?.Z.find(wz => wz.zona === zonaName);

  return (
    <div
      className="dialog-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(3px)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12
      }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="dlg"
        style={{
          background: 'var(--bg)',
          color: 'var(--fg)',
          border: '1px solid var(--line)',
          borderRadius: 12,
          width: 'min(980px, calc(100vw - 24px))',
          maxHeight: 'calc(100vh - 24px)',
          overflowY: 'auto',
          padding: 22,
          boxShadow: '0 12px 40px rgba(0,0,0,0.32)'
        }}
      >
        {/* Modal Header */}
        <div className="dlg-h" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: zoneColor,
                boxShadow: `0 0 10px ${zoneColor}`,
                flexShrink: 0
              }}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontSize: 22, margin: 0 }}>Profil Interaktif: {zonaName}</h2>
                <span
                  className="pill"
                  style={{
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    fontWeight: 600
                  }}
                >
                  {nCust} Pelanggan · {nFm} Flowmeter
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>
                Wilayah distribusi aliran air · Terakhir disinkronkan:{' '}
                <b>{lastSyncTime || 'Langsung dari spreadsheet'}</b>
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {onSelectZona && (
              <button
                className="btn pri"
                onClick={() => {
                  onSelectZona(zonaName);
                  onClose();
                }}
                style={{ fontSize: 12.5 }}
                title="Terapkan filter utama ke zona ini"
              >
                Fokuskan ke Zona Ini
              </button>
            )}
            <button className="btn" onClick={onClose} aria-label="Tutup dialog" style={{ fontSize: 12.5 }}>
              ✕ Tutup
            </button>
          </div>
        </div>

        {/* 4 Primary KPIs */}
        <section className="kpis" style={{ marginTop: 6 }}>
          <KPI
            label={`Pemakaian ${FM.ymShort(A.ref)}`}
            value={N(totalVolume)}
            unit="m³"
            sub={
              <>
                Pangsa {P(share)} dari total sistem
                <br />
                MoM: {DL(zData?.mom ?? null)}
              </>
            }
          />
          <KPI
            label={`Kumulatif ${A.year} (YTD)`}
            value={N(totalYtd)}
            unit="m³"
            sub={
              <>
                YoY: {zData?.yoy != null ? DL(zData.yoy) : '–'}
                <br />
                Rata-rata/pelanggan: {N(nCust > 0 ? Math.round(totalYtd / nCust) : 0)} m³
              </>
            }
          />
          <KPI
            label="Kepatuhan Kontrak Zona"
            value={zoneContractUtil != null ? `${Math.round(zoneContractUtil)}%` : '–'}
            sub={
              contractedCust.length > 0 ? (
                <>
                  ▲ {nAbove} melebihi · ▼ {nBelow} kurang
                  <br />
                  Total kuota: {N(totalContract)} m³/bln
                </>
              ) : (
                'Tidak ada kontrak di zona ini'
              )
            }
          />
          <KPI
            label="Dinamika Pekanan (Terakhir)"
            value={weeklyZoneData ? `${N(weeklyZoneData.last)} m³` : '–'}
            sub={
              weeklyZoneData ? (
                <>
                  WoW: {DL(weeklyZoneData.wow)}
                  <br />
                  Rata-rata 8 pekan: {N(weeklyZoneData.avg8)} m³
                </>
              ) : (
                'Data mingguan sedang dimuat'
              )
            }
          />
        </section>

        {/* Charts Grid */}
        <div className="grid2" style={{ marginTop: 8 }}>
          <Panel
            title={`Tren Pemakaian Bulanan (${zonaName})`}
            sub="Riwayat pemakaian bulanan m³ di zona ini"
          >
            <LineChart
              labels={monthLabels}
              series={[
                {
                  name: zonaName,
                  color: zoneColor,
                  data: zoneMonthlyNums
                }
              ]}
              height={240}
              aria={`Tren ${zonaName}`}
            />
          </Panel>

          <Panel
            title={`Top Kontributor Pemakaian (${zonaName})`}
            sub={`5 pelanggan penyumbang terbesar pada kumulatif ${A.year}`}
          >
            <BarChart
              labels={top5.map(g => (g.name.length > 20 ? g.name.slice(0, 19) + '…' : g.name))}
              series={[
                {
                  name: 'YTD (m³)',
                  color: zoneColor,
                  data: top5.map(g => g.ytd)
                }
              ]}
              height={240}
              valueLabels={true}
              labelFmt={N}
              aria={`Top pelanggan di ${zonaName}`}
            />
          </Panel>
        </div>

        {/* Customer List in this Zone */}
        <Panel
          title={`Daftar Pelanggan di ${zonaName} (${customersInZone.length} Pelanggan)`}
          sub="Klik pada nama pelanggan untuk melihat grafik & riwayat lengkap pemakaian"
        >
          <div className="scroll tall" style={{ maxHeight: 340 }}>
            <table>
              <thead>
                <tr>
                  <th>No</th>
                  <th>Nama Pelanggan</th>
                  <th className="n">Flowmeter</th>
                  <th className="n">Bulan Ini ({FM.ymShort(A.ref)})</th>
                  <th className="n">MoM</th>
                  <th className="n">Kumulatif {A.year}</th>
                  <th className="n">Kontrak (m³)</th>
                  <th>Status Kontrak</th>
                </tr>
              </thead>
              <tbody>
                {customersInZone.map((g, idx) => {
                  const c = g.contract;
                  const ratio = g.ratio != null ? Math.round(g.ratio * 100) : null;
                  return (
                    <tr
                      key={g.key || idx}
                      className="clk"
                      onClick={() => onOpenCustomer?.(g.key)}
                      title="Klik untuk membuka riwayat pemakaian pelanggan"
                    >
                      <td className="muted" style={{ width: 36 }}>{idx + 1}</td>
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
                {customersInZone.length === 0 && (
                  <tr>
                    <td colSpan={8} className="empty">
                      Tidak ada pelanggan tercatat di {zonaName}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
};
