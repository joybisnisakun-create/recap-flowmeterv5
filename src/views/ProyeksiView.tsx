import React from 'react';
import { AnalysisResult } from '../types';
import * as FM from '../lib/fm';
import { N, P, Panel } from '../lib/format';
import { LineChart } from '../components/Charts';

export const ProyeksiView: React.FC<{
  A: AnalysisResult;
  simActive: boolean;
  contracts: any[];
  onOpenCustomer: (key: string) => void;
}> = ({ A, simActive, contracts, onOpenCustomer }) => {
  const T = A.total;
  const f = T.fc;
  const hz = A.fmonths.length;
  const n = A.months.length;

  const lab = A.months.concat(A.fmonths).map(FM.ymShort);
  const nulls = (k: number) => {
    const a: (number | null)[] = [];
    for (let i = 0; i < k; i++) a.push(null);
    return a;
  };

  const actualData = T.nums.concat(nulls(hz));
  const fcData = nulls(n - 1)
    .concat([T.nums[n - 1]])
    .concat(T.fc.fc);
  const loData = nulls(n - 1)
    .concat([T.nums[n - 1]])
    .concat(T.fc.lo);
  const hiData = nulls(n - 1)
    .concat([T.nums[n - 1]])
    .concat(T.fc.hi);

  // Utilization Projection chart
  let actUtil: (number | null)[] = [];
  let frUtil: (number | null)[] = [];
  let lo2 = 80;
  let hi2 = 110;

  if (A.hasContract) {
    actUtil = A.port.map(p => (p.n ? p.ratio! * 100 : null));
    frUtil = A.fmonths.map((m, i) => {
      let U = 0;
      let Cc = 0;
      A.G.forEach(g => {
        const c = FM.contractFor(contracts, g.key, FM.yearOf(m));
        if (c) {
          U += g.fc.fc[i];
          Cc += c.c;
        }
      });
      return Cc ? (U / Cc) * 100 : null;
    });

    const all = actUtil.concat(frUtil).filter((v): v is number => v != null);
    lo2 = Math.min(...all, A.cfg.batas_bawah);
    hi2 = Math.max(...all, A.cfg.batas_atas);
  }

  // Risk customers
  const rs = A.hasContract
    ? A.G.filter(
        g =>
          g.contract &&
          g.fStat.some(s => s === 'above' || s === 'below')
      ).sort((a, b) => {
        const ia = a.fStat.findIndex(s => s === 'above' || s === 'below');
        const ib = b.fStat.findIndex(s => s === 'above' || s === 'below');
        return ia - ib || (b.ratio || 0) - (a.ratio || 0);
      })
    : [];

  return (
    <>
      {/* Total Forecast Chart */}
      <Panel
        title="Proyeksi total pemakaian"
        sub={`Garis putus-putus dan pita 80% = proyeksi ${hz} bulan sampai ${FM.ymFull(
          A.fmonths[hz - 1]
        )}. Metode dipilih otomatis berdasarkan uji mundur.`}
      >
        <LineChart
          labels={lab}
          series={[
            { name: 'Aktual', color: 'var(--s1)', data: actualData },
            {
              name: 'Proyeksi',
              color: 'var(--s2)',
              dash: true,
              data: fcData,
              lo: loData,
              hi: hiData,
              markFrom: n
            }
          ]}
          forecastFrom={n}
          height={320}
          legendExtra={['Pita = rentang 80%']}
          aria="Proyeksi total pemakaian"
        />
      </Panel>

      {/* Utilization Forecast Chart */}
      {A.hasContract && (
        <Panel
          title="Proyeksi utilisasi kontrak gabungan"
          sub={`Jumlah proyeksi pelanggan berkontrak dibanding total kontrak${
            simActive ? ' (simulasi)' : ''
          }`}
        >
          <LineChart
            labels={lab}
            series={[
              { name: 'Aktual', color: 'var(--s1)', data: actUtil.concat(nulls(hz)) },
              {
                name: 'Proyeksi',
                color: 'var(--s2)',
                dash: true,
                data: nulls(n - 1)
                  .concat([actUtil[n - 1]])
                  .concat(frUtil),
                markFrom: n
              }
            ]}
            forecastFrom={n}
            yMin={Math.floor((lo2 - 8) / 10) * 10}
            yMax={Math.ceil((hi2 + 8) / 10) * 10}
            yFmt={v => `${Math.round(v)}%`}
            tipFmt={v => P(v)}
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
              },
              ...(frUtil[frUtil.length - 1] != null ? [{
                y: frUtil[frUtil.length - 1],
                label: `Proyeksi (${Math.round(frUtil[frUtil.length - 1])}%)`,
                color: 'var(--accent)'
              }] : [])
            ]}
            height={280}
            aria="Proyeksi utilisasi kontrak"
          />
        </Panel>
      )}

      {/* Grid: Candidates & Guide */}
      <div className="grid2">
        <Panel
          title="Perbandingan metode (total)"
          sub={`Uji mundur: tiap metode memprediksi ${
            f.k || 0
          } bulan terakhir hanya dari data sebelumnya, lalu dibandingkan dengan nilai sebenarnya.`}
        >
          {f.cands.length > 0 ? (
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>Metode</th>
                    <th className="n">Galat rata-rata (MAE, m³)</th>
                    <th className="n">WAPE</th>
                    <th className="n">Proyeksi {FM.ymShort(A.fmonths[0])}</th>
                  </tr>
                </thead>
                <tbody>
                  {f.cands.map(c => (
                    <tr key={c.id}>
                      <td>
                        {c.name}
                        {c.id === f.methodId && (
                          <span className="pill ok" style={{ marginLeft: 6 }}>
                            Dipilih
                          </span>
                        )}
                      </td>
                      <td className="n">{N(c.mae)}</td>
                      <td className="n">{c.wape != null ? P(c.wape * 100) : '–'}</td>
                      <td className="n">{N(c.fc[0])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">
              {f.note || 'Data belum cukup untuk perbandingan metode.'}
            </p>
          )}
        </Panel>

        <Panel title="Cara membaca">
          <ul className="dl-list">
            <li>
              <b>MAE</b>: rata-rata selisih mutlak proyeksi dan aktual (m³).{' '}
              <b>WAPE</b>: jumlah selisih dibagi jumlah aktual, semakin kecil semakin akurat.
            </li>
            <li>
              Pita 80% memakai ±1,28 kali galat uji mundur (RMSE), melebar seiring jarak bulan.
            </li>
            <li>
              Dengan data {A.months.length} bulan, pola musiman belum bisa dipelajari. Setelah data
              lebih dari 15 bulan, metode rasio YoY otomatis ikut dibandingkan.
            </li>
          </ul>
        </Panel>
      </div>

      {/* Zone and Total Projection Table */}
      <Panel
        title="Proyeksi per zona dan total"
        sub={`m³. Total ${A.year} = aktual sampai ${FM.ymShort(
          A.months[A.months.length - 1]
        )} ditambah proyeksi sisa tahun.`}
      >
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Zona</th>
                <th>Metode</th>
                <th className="n">WAPE</th>
                <th className="n">Aktual YTD</th>
                {A.fmonths.map(m => (
                  <th key={m} className="n">
                    {FM.ymShort(m)}
                  </th>
                ))}
                <th className="n">Total {A.year}</th>
              </tr>
            </thead>
            <tbody>
              {A.Z.concat([
                {
                  zona: 'Total',
                  fc: T.fc,
                  ytd: T.ytd,
                  isT: true
                } as any
              ]).map((z: any) => {
                const inY = z.fc.fc.reduce(
                  (acc: number, v: number, i: number) =>
                    acc + (FM.yearOf(A.fmonths[i]) === A.year ? v : 0),
                  0
                );
                return (
                  <tr
                    key={z.zona}
                    style={z.isT ? { fontWeight: 600 } : undefined}
                  >
                    <td>{z.zona}</td>
                    <td>{z.fc.method}</td>
                    <td className="n">
                      {z.fc.wape != null ? P(z.fc.wape * 100) : '–'}
                    </td>
                    <td className="n">{N(z.ytd)}</td>
                    {z.fc.fc.map((v: number, i: number) => (
                      <td key={i} className="n">
                        {N(v)}
                      </td>
                    ))}
                    <td className="n">
                      <b>{N(z.ytd + inY)}</b>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Contract Risk */}
      {A.hasContract && (
        <Panel
          title="Risiko kontrak ke depan"
          sub={`Pelanggan berkontrak yang proyeksinya keluar dari batas ${A.cfg.batas_bawah}–${
            A.cfg.batas_atas
          }%. Persentase terhadap kontrak bulanan.${simActive ? ' (Simulasi)' : ''}`}
        >
          {rs.length > 0 ? (
            <div className="scroll tall">
              <table>
                <thead>
                  <tr>
                    <th>Pelanggan</th>
                    <th className="n">Kontrak</th>
                    <th className="n">Bulan ini</th>
                    {A.fmonths.map(m => (
                      <th key={m} className="n">
                        {FM.ymShort(m)}
                      </th>
                    ))}
                    <th>Metode</th>
                  </tr>
                </thead>
                <tbody>
                  {rs.slice(0, 40).map(g => (
                    <tr
                      key={g.key}
                      className="clk"
                      onClick={() => onOpenCustomer(g.key)}
                    >
                      <td className="name">
                        <b>{g.name}</b>
                        <small>{g.zona}</small>
                      </td>
                      <td className="n">{N(g.contract?.c)}</td>
                      <td className="n">{P(g.ratio !== null ? g.ratio * 100 : null)}</td>
                      {g.fc.fc.map((v, i) => {
                        const s = g.fStat[i];
                        const c = g.contract;
                        return (
                          <td key={i} className="n">
                            <span
                              className={`mcell ${s}`}
                              style={{ width: 'auto', padding: '2px 7px' }}
                              title={`${N(v)} m³`}
                            >
                              {c ? Math.round((v / c.c) * 100) : 0}%
                            </span>
                          </td>
                        );
                      })}
                      <td className="muted">{g.fc.method}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">
              Tidak ada pelanggan berkontrak yang diproyeksikan keluar batas pada {hz} bulan ke depan.
            </p>
          )}
        </Panel>
      )}
    </>
  );
};
