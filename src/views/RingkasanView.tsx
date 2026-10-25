import React from 'react';
import { AnalysisResult } from '../types';
import * as FM from '../lib/fm';
import { N, SG, P, DL, list, zc, KPI, Panel } from '../lib/format';
import { BarChart } from '../components/Charts';

export const RingkasanView: React.FC<{
  A: AnalysisResult;
  zona: string;
  simActive: boolean;
  onOpenCustomer: (key: string) => void;
}> = ({ A, zona, simActive, onOpenCustomer }) => {
  const T = A.total;
  const ref = A.ref;
  const G = A.G;
  const pr = A.port[A.ri];

  // Automated Insights Generation
  const items: { tag: string; cls: string; txt: string }[] = [];
  const recs: string[] = [];

  const scope = zona ? `zona ${zona}` : 'seluruh zona';
  let t = `Pemakaian ${scope} pada ${FM.ymFull(ref)} sebesar ${N(T.vR)} m³`;
  if (T.vP != null) {
    t += `, ${T.d! >= 0 ? 'naik ' : 'turun '}${P(Math.abs(T.mom!))} (${SG(T.d)}) dari bulan sebelumnya (MoM)`;
  }
  t +=
    T.yoy != null
      ? ` dan ${T.yoy >= 0 ? 'naik ' : 'turun '}${P(Math.abs(T.yoy))} dari ${FM.ymFull(FM.ymAdd(ref, -12))} (YoY).`
      : '. Perbandingan YoY akan muncul setelah data tahun lalu untuk bulan yang sama tersedia.';
  items.push({ tag: 'Ringkasan', cls: 'info', txt: t });

  const n6 = T.nums.slice(Math.max(0, A.ri - 5), A.ri + 1);
  const sl = FM.slopePct(n6);
  let mx = 0;
  let mn = 0;
  T.nums.forEach((v, i) => {
    if (v > T.nums[mx]) mx = i;
    if (v < T.nums[mn]) mn = i;
  });
  if (n6.length >= 3) {
    items.push({
      tag: 'Arah tren',
      cls: Math.abs(sl) < 1 ? 'ok' : 'info',
      txt: `Dalam ${n6.length} bulan terakhir pemakaian ${
        Math.abs(sl) < 1
          ? 'relatif stabil (perubahan di bawah 1% per bulan)'
          : `${sl > 0 ? 'cenderung naik' : 'cenderung turun'} sekitar ${P(Math.abs(sl))} per bulan menurut garis tren`
      }. Tertinggi ${FM.ymShort(A.months[mx])} (${N(T.nums[mx])} m³), terendah ${FM.ymShort(A.months[mn])} (${N(T.nums[mn])} m³).`
    });
  }

  if (!zona && A.Z.length > 1) {
    const big = A.Z.slice().sort((a, b) => b.vR - a.vR)[0];
    const grow = A.Z.filter(z => z.mom != null).sort((a, b) => b.mom! - a.mom!)[0];
    items.push({
      tag: 'Komposisi zona',
      cls: 'info',
      txt: `${big.zona} terbesar dengan ${N(big.vR)} m³ (${P(big.share)} dari total bulan ini).${
        grow ? ` Pertumbuhan MoM tertinggi di ${grow.zona} (${P(grow.mom)}).` : ''
      }`
    });
  }

  if (G.length >= 5 && T.ytd) {
    items.push({
      tag: 'Konsentrasi',
      cls: A.top10Share > 80 ? 'warn' : 'info',
      txt: `10 pelanggan terbesar menyumbang ${P(A.top10Share)} dari pemakaian ${A.year} sampai bulan ini. Hanya ${A.k80} pelanggan sudah mencakup 80%. ${A.sorted[0].name} paling besar (${P((A.sorted[0].ytd / T.ytd) * 100)}).`
    });
  }

  if (T.vP != null) {
    const up = G.filter(g => g.d != null && g.d > 0)
      .sort((a, b) => b.d! - a.d!)
      .slice(0, 3);
    const dn = G.filter(g => g.d != null && g.d < 0)
      .sort((a, b) => a.d! - b.d!)
      .slice(0, 3);
    let tx = '';
    if (up.length) {
      tx += 'Kenaikan terbesar: ' + list(up.map(g => `${g.name} (${SG(g.d)} m³)`)) + '. ';
    }
    if (dn.length) {
      tx += 'Penurunan terbesar: ' + list(dn.map(g => `${g.name} (${SG(g.d)} m³)`)) + '.';
    }
    if (tx) items.push({ tag: 'Penggerak perubahan', cls: 'info', txt: tx });
  }

  if (A.hasContract) {
    const c = A.cnt;
    const out = G.filter(g => g.st === 'above' || g.st === 'below');
    const tt = `${simActive ? '(Simulasi) ' : ''}Dari ${
      A.G.filter(g => g.contract).length
    } pelanggan berkontrak, ${c.above} melebihi ${A.cfg.batas_atas}% kontrak dan ${c.below} di bawah ${
      A.cfg.batas_bawah
    }%; ${c.nearHigh + c.nearLow} mendekati batas. Total volume di atas batas ${N(
      pr.ex
    )} m³, kekurangan terhadap minimum ${N(pr.sh)} m³. Utilisasi gabungan ${P((pr.ratio || 0) * 100)}.`;
    items.push({ tag: 'Kepatuhan kontrak', cls: c.above || c.below ? 'warn' : 'ok', txt: tt });

    const rep = G.filter(g => g.outCount >= 2).sort((a, b) => b.outCount - a.outCount).slice(0, 4);
    if (rep.length) {
      items.push({
        tag: 'Langganan di luar batas',
        cls: 'warn',
        txt: `${list(rep.map(g => `${g.name} (${g.outCount} bulan)`))} berulang di luar batas kontrak sepanjang ${A.year}. Layak ditinjau ulang volume kontraknya.`
      });
    }
    if (out.length) {
      recs.push(`Tindak lanjuti ${out.length} pelanggan di luar batas kontrak pada ${FM.ymFull(ref)} (lihat tab Kontrak).`);
    }
  }

  const fl = G.filter(g => g.flagged);
  if (fl.length) {
    items.push({
      tag: 'Perlu dicek',
      cls: 'warn',
      txt: `${fl.length} pelanggan memerlukan pemeriksaan data pemakaian: ${list(
        fl.slice(0, 5).map(g => `${g.name} (${g.flags.join(', ')})`)
      )}${fl.length > 5 ? `, dan ${fl.length - 5} lainnya` : ''}.`
    });
  } else {
    items.push({
      tag: 'Perlu dicek',
      cls: 'ok',
      txt: `Tidak ada pemakaian yang melewati ambang ±${A.cfg.ambang_perubahan}% atau bernilai nol mendadak pada ${FM.ymFull(ref)}.`
    });
  }

  const f = T.fc;
  items.push({
    tag: 'Proyeksi',
    cls: 'info',
    txt: `Metode terpilih untuk total: ${f.method}${
      f.wape != null ? ` (galat uji mundur WAPE ${P(f.wape * 100)})` : ''
    }. Proyeksi ${FM.ymFull(A.fmonths[0])} sekitar ${N(f.fc[0])} m³ (rentang 80%: ${N(f.lo[0])} – ${N(
      f.hi[0]
    )}). Perkiraan total ${A.year}: ${N(T.annualFc)} m³.`
  });

  const blanks = G.filter(g => g.flags.indexOf('blank') > -1).length;
  if (blanks) recs.push(`Lengkapi sel kosong bulan ${FM.ymFull(ref)} pada ${blanks} pelanggan sebelum rekap dipakai untuk laporan.`);
  if (G.some(g => g.flags.indexOf('nol') > -1 || g.flags.indexOf('diam') > -1)) {
    recs.push('Periksa flowmeter yang berhenti mencatat (nol atau diam beberapa bulan): apakah tidak ada pemakaian atau meter rusak.');
  }
  if (G.some(g => g.flags.indexOf('naik') > -1)) {
    recs.push('Telusuri penyebab kenaikan tajam: aktivitas baru, kebocoran, atau salah catat.');
  }
  if (G.some(g => g.flags.indexOf('turun') > -1)) {
    recs.push('Konfirmasi penurunan tajam: pengurangan produksi, gangguan pasokan, atau meter bermasalah.');
  }
  if (!A.hasContract) {
    recs.push(`Isi data/kontrak.csv agar analisis kepatuhan kontrak (batas ${A.cfg.batas_bawah}–${A.cfg.batas_atas}%) aktif.`);
  }
  if (!recs.length) {
    recs.push('Tidak ada temuan mendesak. Lanjutkan pemantauan bulanan.');
  }

  // Chart data setup
  const lab = A.months.map(FM.ymShort);
  const zonaList = A.Z.map(z => z.zona);
  let stackSeries: any[];
  if (!zona) {
    stackSeries = A.Z.map(z => ({
      name: z.zona,
      color: zc(z.zona, zonaList),
      data: z.nums
    }));
  } else {
    const top = A.sorted.slice(0, 6);
    stackSeries = top.map((g, i) => ({
      name: g.name.length > 26 ? g.name.slice(0, 25) + '…' : g.name,
      color: `var(--s${i + 1})`,
      data: g.nums
    }));
    stackSeries.push({
      name: 'Lainnya',
      color: 'var(--s-other)',
      data: A.months.map((_, i) => A.total.nums[i] - top.reduce((a, g) => a + g.nums[i], 0))
    });
  }

  const momData = A.total.nums.map((v, i) =>
    i === 0 || !A.total.nums[i - 1]
      ? null
      : ((v - A.total.nums[i - 1]) / A.total.nums[i - 1]) * 100
  );

  let deltaLabels: string[] = [];
  let deltaSeries: any[] = [];
  if (!zona) {
    deltaLabels = A.Z.map(z => z.zona);
    deltaSeries = [
      {
        name: 'Selisih',
        color: 'var(--s1)',
        colors: A.Z.map(z => zc(z.zona, zonaList)),
        data: A.Z.map(z => z.d)
      }
    ];
  } else {
    const mv = A.G.filter(g => g.d != null && g.d !== 0)
      .sort((a, b) => Math.abs(b.d!) - Math.abs(a.d!))
      .slice(0, 8);
    deltaLabels = mv.map(g => g.name);
    deltaSeries = [
      {
        name: 'Selisih',
        color: 'var(--s1)',
        colorFn: (v: number) => (v >= 0 ? '#1baf7a' : '#eb6834'),
        data: mv.map(g => g.d)
      }
    ];
  }

  const t10 = A.sorted.slice(0, 10);
  const topSeries = [
    {
      name: 'Kumulatif',
      color: 'var(--s1)',
      colors: zona ? undefined : t10.map(g => zc(g.zona, zonaList)),
      data: t10.map(g => g.ytd)
    }
  ];

  return (
    <>
      {/* 8 KPIs */}
      <section className="kpis">
        <KPI
          label={`Pemakaian ${FM.ymShort(ref)}`}
          value={N(T.vR)}
          unit="m³"
          sub={
            <>
              MoM {DL(T.mom)} ({SG(T.d)} m³)
              <br />
              YoY {T.yoy != null ? DL(T.yoy) : <span className="muted">belum ada data tahun lalu</span>}
            </>
          }
        />
        <KPI
          label={`Kumulatif ${A.year} (YTD)`}
          value={N(T.ytd)}
          unit="m³"
          sub={
            A.hasLY && T.ytdL ? (
              <>vs YTD tahun lalu {DL(((T.ytd - T.ytdL) / T.ytdL) * 100)}</>
            ) : (
              `${A.ytdIdx.length} bulan berjalan`
            )
          }
        />
        <KPI
          label="Rata-rata per bulan"
          value={N(T.avg)}
          unit="m³"
          sub={
            T.avg
              ? `Bulan ini ${T.vR >= T.avg ? '+' : '−'}${P(Math.abs(((T.vR - T.avg) / T.avg) * 100))} dari rata-rata`
              : '–'
          }
        />
        <KPI
          label="Pelanggan aktif"
          value={
            <>
              {A.nActive}
              <small>dari {A.nCust}</small>
            </>
          }
          sub={`${A.nFmActive} dari ${A.nFm} flowmeter mencatat pemakaian`}
        />
        <KPI
          label={simActive ? 'Utilisasi (simulasi)' : 'Utilisasi kontrak'}
          value={A.hasContract && pr.ratio != null ? P(pr.ratio * 100) : '–'}
          sub={
            A.hasContract
              ? `Pemakaian dibanding total kontrak, ${pr.n} pelanggan berkontrak`
              : 'Kontrak belum diisi'
          }
        />
        <KPI
          label="Di luar batas kontrak"
          value={
            A.hasContract ? (
              <>
                <span title="melebihi">▲ {A.cnt.above}</span> &nbsp;{' '}
                <span title="di bawah">▼ {A.cnt.below}</span>
              </>
            ) : (
              '–'
            )
          }
          sub={
            A.hasContract
              ? `melebihi ${A.cfg.batas_atas}% · di bawah ${A.cfg.batas_bawah}% kontrak`
              : 'Aktif setelah kontrak diisi'
          }
        />
        <KPI
          label={`Proyeksi total ${A.year}`}
          value={N(T.annualFc)}
          unit="m³"
          sub={`${T.fc.method}${T.fc.wape != null ? ` · WAPE ${P(T.fc.wape * 100)}` : ''}`}
        />
        <KPI
          label="Konsentrasi"
          value={P(A.top10Share)}
          sub={`10 pelanggan terbesar dari YTD · ${A.k80} pelanggan = 80%`}
        />
      </section>

      {/* Automated Analysis */}
      <Panel
        title="Analisis otomatis"
        sub="Dihitung ulang dari data dan filter saat ini."
      >
        <div className="ins-grid">
          {items.map((it, idx) => (
            <article key={idx} className="ins">
              <span className={`pill ${it.cls}`}>{it.tag}</span>
              <p>{it.txt}</p>
            </article>
          ))}
        </div>
        <h3 style={{ marginTop: 8 }}>Tindak lanjut yang disarankan</h3>
        <ul className="rec">
          {recs.map((r, idx) => (
            <li key={idx}>{r}</li>
          ))}
        </ul>
      </Panel>

      {/* Charts Grid */}
      <div className="grid2">
        <Panel
          title={zona ? 'Pemakaian bulanan per pelanggan' : 'Pemakaian bulanan per zona'}
          sub={zona ? '6 pelanggan terbesar, sisanya digabung' : 'Ditumpuk per zona, satuan m³'}
        >
          <BarChart
            labels={lab}
            series={stackSeries}
            stacked={true}
            height={300}
            aria="Pemakaian bulanan ditumpuk"
          />
        </Panel>

        <Panel
          title="Pertumbuhan bulanan (MoM)"
          sub="Persentase perubahan total dibanding bulan sebelumnya"
        >
          <BarChart
            labels={lab}
            series={[
              {
                name: 'MoM',
                color: 'var(--s1)',
                data: momData,
                tipFmt: v => P(v)
              }
            ]}
            height={300}
            yFmt={v => `${FM.parseNum(v) != null ? Math.round(v) : v}%`}
            valueLabels={true}
            labelFmt={v => P(v).replace('%', '')}
            aria="Pertumbuhan MoM"
          />
        </Panel>

        <Panel
          title={zona ? 'Perubahan terbesar pelanggan' : 'Kontribusi perubahan per zona'}
          sub={`Selisih ${FM.ymShort(A.ref)} terhadap bulan sebelumnya, m³`}
        >
          <BarChart
            labels={deltaLabels}
            series={deltaSeries}
            horizontal={!!zona}
            height={300}
            valueLabels={true}
            labelFmt={SG}
            tipFmt={SG}
            aria={zona ? 'Perubahan terbesar pelanggan' : 'Kontribusi perubahan per zona'}
          />
        </Panel>

        <Panel
          title="10 pelanggan terbesar"
          sub={`Kumulatif ${A.year} sampai ${FM.ymShort(A.ref)}, m³${
            zona ? '' : '. Warna batang = zona'
          }`}
        >
          <BarChart
            labels={t10.map(g => g.name)}
            series={topSeries}
            horizontal={true}
            height={300}
            valueLabels={true}
            labelFmt={N}
            tipExtra={k => (
              <div className="tt-r tt-s">
                <span className="tt-n">
                  {t10[k].zona} · pangsa{' '}
                  {P(A.total.ytd ? (t10[k].ytd / A.total.ytd) * 100 : 0)}
                </span>
              </div>
            )}
            aria="10 pelanggan terbesar"
          />
        </Panel>
      </div>
    </>
  );
};
