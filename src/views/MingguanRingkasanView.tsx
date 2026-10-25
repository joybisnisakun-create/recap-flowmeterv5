import React from 'react';
import { WeeklyAnalysis, AnalysisModel, AppConfig } from '../types';
import * as FM from '../lib/fm';
import * as W from '../lib/weekly';
import { N, SG, P, DL, list, zc, Pill, KPI, Panel } from '../lib/format';
import { LineChart, BarChart } from '../components/Charts';

function sevW(c: any): number {
  return c.flags.length ? (c.flags[0] === 'diam' || c.flags[0] === 'nol' ? 0 : 1) : 2;
}

export const MingguanRingkasanView: React.FC<{
  A: WeeklyAnalysis | null;
  model: AnalysisModel;
  cfg: AppConfig;
  zona: string;
  contracts: any[];
  simActive: boolean;
  onOpenCustomer?: (key: string) => void;
}> = ({ A, model, cfg, zona, contracts, simActive, onOpenCustomer }) => {
  if (!A) {
    return (
      <div className="banner warn">
        <span>
          <b>Data mingguan belum tersedia.</b> Unggah atau letakkan file{' '}
          <span className="mono">data/mingguan.csv</span> atau <span className="mono">Pemakaian Mingguan.xlsx</span>.
        </span>
      </div>
    );
  }

  const li = A.li;
  const tot = A.total;
  const p = A.proj;

  // Weekly Automated Insights
  const it: { tag: string; cls: string; tx: string }[] = [];
  const m4 = A.ma4[li];
  const m4p = li >= 4 ? A.ma4[li - 4] : null;
  const dd = m4 != null && m4p != null && m4p > 0 ? ((m4 - m4p) / m4p) * 100 : null;

  it.push({
    tag: 'Tren 4 minggu',
    cls: dd != null && Math.abs(dd) >= 5 ? 'warn' : 'ok',
    tx: `Rata-rata 4 minggu terakhir ${N(m4)} m³ per minggu, ${
      dd == null ? '' : `${dd >= 0 ? 'naik ' : 'turun '}${P(Math.abs(dd))} dibanding 4 minggu sebelumnya. `
    }Minggu berakhir ${W.fmtShort(A.weeks[li])}: ${N(tot[li])} m³ (${
      A.wow[li] == null ? '–' : `${A.wow[li]! >= 0 ? '+' : '−'}${P(Math.abs(A.wow[li]!))}`
    } WoW).`
  });

  const z = A.Z.filter(x => x.wow != null).sort(
    (a, b) => Math.abs(b.last - (b.prev || 0)) - Math.abs(a.last - (a.prev || 0))
  )[0];
  if (!zona && z) {
    it.push({
      tag: 'Zona paling bergerak',
      cls: 'info',
      tx: `${z.zona} berubah ${SG(z.last - (z.prev || 0))} m³ (${
        z.wow! >= 0 ? '+' : '−'
      }${P(Math.abs(z.wow!))}) dibanding minggu sebelumnya.`
    });
  }

  const up = A.C.filter(c => c.d != null && c.d > 0)
    .sort((a, b) => b.d! - a.d!)
    .slice(0, 3);
  const dn = A.C.filter(c => c.d != null && c.d < 0)
    .sort((a, b) => a.d! - b.d!)
    .slice(0, 3);
  it.push({
    tag: 'Pergerakan pelanggan',
    cls: 'info',
    tx:
      (up.length ? 'Naik terbesar: ' + list(up.map(c => `${c.nama} (${SG(c.d)})`)) + '. ' : '') +
      (dn.length ? 'Turun terbesar: ' + list(dn.map(c => `${c.nama} (${SG(c.d)})`)) + '.' : '')
  });

  const fl = A.C.filter(c => c.flags.length).sort(
    (a, b) => sevW(a) - sevW(b) || Math.abs(b.dev || 0) - Math.abs(a.dev || 0)
  );
  if (fl.length) {
    it.push({
      tag: 'Perlu dicek',
      cls: 'warn',
      tx: `${fl.length} pelanggan menyimpang dari pola 8 minggu terakhir: ${list(
        fl.slice(0, 5).map(c => `${c.nama} (${c.flags.join(', ')})`)
      )}${fl.length > 5 ? `, dan ${fl.length - 5} lainnya` : ''}.`
    });
  } else {
    it.push({
      tag: 'Perlu dicek',
      cls: 'ok',
      tx: 'Tidak ada pelanggan yang menyimpang tajam dari pola 8 minggu terakhir.'
    });
  }

  const prevYm = FM.ymAdd(p.ym, -1);
  const lyYm = FM.ymAdd(p.ym, -12);
  const prevV = FM.sum(
    model.groups
      .filter(g => !zona || g.zona === zona)
      .map(g => g.v[prevYm] || 0)
  );
  const lyV = FM.sum(
    model.groups
      .filter(g => !zona || g.zona === zona)
      .map(g => g.v[lyYm] || 0)
  );

  it.push({
    tag: `Proyeksi ${FM.ymFull(p.ym)}`,
    cls: 'info',
    tx: `${
      p.full
        ? 'Bulan sudah lengkap: '
        : `Baru ${p.mtdDays} dari ${p.days} hari terisi (${N(
            p.mtd
          )} m³). Dengan laju harian 4 minggu terakhir, perkiraan akhir bulan `
    }${N(p.total)} m³${
      prevV > 0
        ? `, ${p.total >= prevV ? '+' : '−'}${P(Math.abs(((p.total - prevV) / prevV) * 100))} dari ${FM.ymShort(
            prevYm
          )} (data bulanan)`
        : ''
    }${lyV > 0 ? ` dan ${p.total >= lyV ? '+' : '−'}${P(Math.abs(((p.total - lyV) / lyV) * 100))} YoY` : ''}.`
  });

  const lab = A.weeks.map(W.fmtShort);
  const ytdYear = A.weeks[li].slice(0, 4);
  const ytdVal = FM.sum(
    tot.filter((_, i) => A.weeks[i].slice(0, 4) === ytdYear)
  );

  const mv = A.C.filter(c => c.d != null && c.d !== 0)
    .sort((a, b) => Math.abs(b.d!) - Math.abs(a.d!))
    .slice(0, 8);

  return (
    <>
      {/* 6 KPIs */}
      <section className="kpis">
        <KPI
          label={`Minggu berakhir ${W.fmtShort(A.weeks[li])}`}
          value={N(tot[li])}
          unit="m³"
          sub={
            <>
              WoW {DL(A.wow[li])} ({SG(tot[li] - (tot[li - 1] || 0))} m³)
            </>
          }
        />
        <KPI
          label="Rata-rata 4 minggu"
          value={N(A.ma4[li])}
          unit="m³/mgg"
          sub={
            li >= 4 && A.ma4[li - 4] ? (
              <>vs 4 mgg lalu {DL(((A.ma4[li]! - A.ma4[li - 4]!) / A.ma4[li - 4]!) * 100)}</>
            ) : (
              '–'
            )
          }
        />
        <KPI
          label={`Kumulatif ${ytdYear}`}
          value={N(ytdVal)}
          unit="m³"
          sub={`${A.n} minggu terbaca`}
        />
        <KPI
          label={`Proyeksi ${FM.ymShort(p.ym)}`}
          value={N(p.total)}
          unit="m³"
          sub={
            p.full
              ? 'bulan lengkap'
              : `terisi ${p.mtdDays}/${p.days} hari · ${N(p.mtd)} m³ s.d. kini`
          }
        />
        <KPI
          label="Perlu dicek"
          value={
            <>
              {A.C.filter(c => c.flags.length).length}
              <small>dari {A.C.length}</small>
            </>
          }
          sub={`deviasi ±${A.th}% dari median 8 mgg`}
        />
        <KPI
          label="Konvensi tanggal"
          value={A.mode === 'akhir' ? 'Akhir pekan' : 'Awal pekan'}
          sub="sinkron otomatis dengan data bulanan"
        />
      </section>

      {/* Automated Analysis */}
      <Panel
        title="Analisis otomatis mingguan"
        sub="Dihitung ulang dari data dan filter saat ini."
      >
        <div className="ins-grid">
          {it.map((item, idx) => (
            <article key={idx} className="ins">
              <span className={`pill ${item.cls}`}>{item.tag}</span>
              <p>{item.tx}</p>
            </article>
          ))}
        </div>
      </Panel>

      {/* Charts Grid */}
      <div className="grid2">
        <Panel
          title="Pemakaian mingguan total"
          sub="m³ per minggu dengan rata-rata bergerak 4 minggu"
        >
          <LineChart
            labels={lab}
            series={[
              { name: 'Mingguan', color: 'var(--s1)', data: A.total },
              {
                name: 'Rata-rata 4 minggu',
                color: 'var(--s2)',
                dash: true,
                data: A.ma4
              }
            ]}
            height={300}
            aria="Pemakaian mingguan total"
          />
        </Panel>

        <Panel
          title={zona ? 'Pertumbuhan mingguan (WoW)' : 'Pemakaian mingguan per zona'}
          sub={
            zona
              ? 'Persentase perubahan dibanding minggu sebelumnya'
              : 'Ditumpuk per zona, m³'
          }
        >
          {!zona ? (
            <BarChart
              labels={lab}
              series={A.Z.map(z => ({
                name: z.zona,
                color: zc(z.zona, model.zonas),
                data: z.v
              }))}
              stacked={true}
              height={300}
              aria="Pemakaian mingguan per zona"
            />
          ) : (
            <BarChart
              labels={lab}
              series={[
                {
                  name: 'WoW',
                  color: 'var(--s1)',
                  data: A.wow,
                  tipFmt: v => P(v)
                }
              ]}
              height={300}
              yFmt={v => `${Math.round(v)}%`}
              aria="Pertumbuhan mingguan"
            />
          )}
        </Panel>

        <Panel
          title="Pertumbuhan mingguan (WoW)"
          sub="Persentase perubahan total dibanding minggu sebelumnya (hijau = naik, oranye = turun)"
        >
          <BarChart
            labels={lab}
            series={[
              {
                name: 'WoW',
                color: 'var(--s1)',
                colorFn: v => (v >= 0 ? '#1baf7a' : '#eb6834'),
                data: A.wow,
                tipFmt: v => P(v)
              }
            ]}
            height={300}
            yFmt={v => `${Math.round(v)}%`}
            aria="Pertumbuhan mingguan"
          />
        </Panel>

        <Panel
          title="Perubahan terbesar minggu ini"
          sub="Selisih minggu terakhir terhadap minggu sebelumnya per pelanggan, m³"
        >
          <BarChart
            labels={mv.map(c => c.nama)}
            series={[
              {
                name: 'Selisih',
                color: 'var(--s1)',
                colorFn: v => (v >= 0 ? '#1baf7a' : '#eb6834'),
                data: mv.map(c => c.d)
              }
            ]}
            horizontal={true}
            valueLabels={true}
            labelFmt={SG}
            tipFmt={SG}
            aria="Perubahan terbesar minggu ini"
          />
        </Panel>
      </div>

      {/* Zone Summary Table */}
      <Panel title="Rekap per zona" sub={`Minggu berakhir ${W.fmtShort(A.weeks[li])}`}>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Zona</th>
                <th className="n">Minggu terakhir</th>
                <th className="n">Minggu lalu</th>
                <th className="n">WoW</th>
                <th className="n">Rata-rata 8 minggu</th>
                <th className="n">vs rata-rata</th>
              </tr>
            </thead>
            <tbody>
              {A.Z.slice()
                .sort((a, b) => b.last - a.last)
                .map(z => (
                  <tr key={z.zona}>
                    <td>
                      <i
                        className="sw"
                        style={{
                          background: zc(z.zona, model.zonas),
                          marginRight: 6
                        }}
                      />
                      {z.zona}
                    </td>
                    <td className="n">{N(z.last)}</td>
                    <td className="n">{N(z.prev)}</td>
                    <td className="n">{DL(z.wow)}</td>
                    <td className="n">{N(z.avg8)}</td>
                    <td className="n">
                      {DL(z.avg8 > 0 ? ((z.last - z.avg8) / z.avg8) * 100 : null)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
};
