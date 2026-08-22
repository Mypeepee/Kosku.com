// GET /api/dashboard/klien/statistik
// ---------------------------------------------------------------------------
// Angka ringkas untuk kartu KPI di puncak halaman CRM.
//
// KENAPA ENDPOINT SENDIRI, BUKAN DIHITUNG DI BROWSER. Daftar klien dipaginasi
// 50 baris. Menghitung "total nilai pipeline" dari 50 baris yang kebetulan
// termuat akan menampilkan angka yang berubah-ubah setiap kali agent mengetik
// di kotak pencarian — dan diam-diam salah begitu kliennya lebih dari 50.
// Statistik harus dihitung di sisi yang memegang seluruh barisnya.
//
// KENAPA NILAI PIPELINE MEMAKAI MAKS PER KLIEN, BUKAN JUMLAH SEMUA BARIS.
// Satu kartu preferensi di UI dipecah jadi satu baris per (tipe × lokasi) agar
// bisa dicocokkan mesin. Klien yang mencari "rumah atau ruko, di Gresik atau
// Driyorejo, maks 250 jt" tersimpan sebagai EMPAT baris 250 jt. Menjumlahkan
// baris akan melaporkan pipeline 1 M dari satu orang yang mau beli satu rumah.
// Maks per klien = satu orang, satu transaksi — angka yang tidak pernah
// melebihi kenyataan.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BarisTahap = {
  status: string;
  jumlah: bigint;
  nilai: string | null;
  tanpa_budget: bigint;
};

type BarisBulan = { bulan: string; jumlah: bigint };

type BarisTahunBulan = { tahun: number; bulan: number; jumlah: bigint };

type BarisFollowUp = { terlambat: bigint; hari_ini: bigint; nilai_terlambat: string | null };

/** Setiap tahap membawa DUA angka: berapa orang, dan berapa rupiah di dalamnya.
    Donut sebaran pipeline memakai keduanya — jumlah untuk besar irisan, nilai
    untuk baris legenda di sebelahnya. */
const TAHAP_KOSONG = () => ({
  lead_baru: { jumlah: 0, nilai: 0 },
  sudah_dikontak: { jumlah: 0, nilai: 0 },
  hot_buyer: { jumlah: 0, nilai: 0 },
  closing: { jumlah: 0, nilai: 0 },
  lost_iseng: { jumlah: 0, nilai: 0 },
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const agentId = (session.user as any).agentId as string | undefined;
  if (!agentId) return NextResponse.json({ ok: false }, { status: 403 });

  const [perTahapRows, bulanRows, tahunBulanRows, followUpRows] = await Promise.all([
    /* Satu putaran per tahap: jumlah orang, nilai budget, dan berapa yang
       budgetnya belum diisi — angka terakhir itu yang menjelaskan kenapa nilai
       pipeline terlihat lebih kecil dari dugaan agent. */
    prisma.$queryRaw<BarisTahap[]>`
      SELECT k.status::text                                    AS status,
             COUNT(*)                                          AS jumlah,
             COALESCE(SUM(b.nilai), 0)::text                   AS nilai,
             COUNT(*) FILTER (WHERE b.nilai IS NULL)           AS tanpa_budget
      FROM klien k
      LEFT JOIN LATERAL (
        SELECT MAX(COALESCE(p.budget_max, p.budget_min)) AS nilai
        FROM preferensi_klien p
        WHERE p.id_klien = k.id_klien
      ) b ON TRUE
      WHERE k.id_agent = ${agentId}
      GROUP BY k.status
    `,

    /* Dua belas bulan terakhir klien masuk — sumber sparkline & delta. Bulan
       tanpa klien tidak muncul di hasil SQL; diisi nol di bawah supaya
       garisnya tidak melompati waktu yang kosong. */
    prisma.$queryRaw<BarisBulan[]>`
      SELECT to_char(date_trunc('month', k.tanggal_masuk), 'YYYY-MM') AS bulan,
             COUNT(*)                                                 AS jumlah
      FROM klien k
      WHERE k.id_agent = ${agentId}
        AND k.tanggal_masuk >= date_trunc('month', CURRENT_DATE) - INTERVAL '11 months'
      GROUP BY 1
      ORDER BY 1
    `,

    /* Lead masuk per (tahun, bulan) untuk SELURUH riwayat agent. Diambil
       sekaligus, bukan setahun per permintaan: seorang agent punya hitungan
       tahun, bukan ratusan, dan memuat semuanya di awal membuat tombol ganti
       tahun pada grafik berganti seketika tanpa memanggil server lagi. */
    prisma.$queryRaw<BarisTahunBulan[]>`
      SELECT EXTRACT(YEAR  FROM k.tanggal_masuk)::int AS tahun,
             EXTRACT(MONTH FROM k.tanggal_masuk)::int AS bulan,
             COUNT(*)                                 AS jumlah
      FROM klien k
      WHERE k.id_agent = ${agentId}
      GROUP BY 1, 2
      ORDER BY 1, 2
    `,

    /* Klien yang sudah closing atau lost tidak dihitung: janji follow-up yang
       tertinggal di sana bukan pekerjaan yang harus dikejar hari ini.

       NILAI_TERLAMBAT ikut dihitung karena "3 follow-up telat" tidak memberi
       tahu agent apa pun tentang taruhannya. "3 follow-up telat, Rp 450 jt
       menganggur" memberi tahu — dan itulah yang membuat kartu reward di
       puncak halaman punya arti. */
    prisma.$queryRaw<BarisFollowUp[]>`
      SELECT COUNT(*) FILTER (WHERE k.tanggal_follow_up <  NOW())               AS terlambat,
             COUNT(*) FILTER (WHERE k.tanggal_follow_up >= NOW()
                                AND k.tanggal_follow_up <  NOW() + INTERVAL '1 day') AS hari_ini,
             COALESCE(SUM(b.nilai) FILTER (WHERE k.tanggal_follow_up < NOW()), 0)::text
                                                                                AS nilai_terlambat
      FROM klien k
      LEFT JOIN LATERAL (
        SELECT MAX(COALESCE(p.budget_max, p.budget_min)) AS nilai
        FROM preferensi_klien p
        WHERE p.id_klien = k.id_klien
      ) b ON TRUE
      WHERE k.id_agent = ${agentId}
        AND k.tanggal_follow_up IS NOT NULL
        AND k.status NOT IN ('closing', 'lost_iseng')
    `,
  ]);

  /* ── Rekap per tahap ─────────────────────────────────────────── */

  const perTahap = TAHAP_KOSONG() as Record<string, { jumlah: number; nilai: number }>;
  let total = 0;
  let nilaiPipeline = 0;
  let nilaiClosing = 0;
  let klienAktif = 0;
  let tanpaBudget = 0;
  let tanpaBudgetSemua = 0;

  for (const r of perTahapRows) {
    const n = Number(r.jumlah);
    const nilai = Number(r.nilai ?? 0);
    perTahap[r.status] = { jumlah: n, nilai };
    total += n;

    if (r.status !== "lost_iseng") tanpaBudgetSemua += Number(r.tanpa_budget);

    if (r.status === "closing") {
      nilaiClosing += nilai;
    } else if (r.status !== "lost_iseng") {
      // Pipeline = yang masih bisa ditutup. Yang sudah closing pindah ke kotak
      // sendiri; yang lost tidak pernah jadi uang.
      klienAktif += n;
      nilaiPipeline += nilai;
      tanpaBudget += Number(r.tanpa_budget);
    }
  }

  /* ── Tren 12 bulan ───────────────────────────────────────────── */

  const petaBulan = new Map(bulanRows.map((r) => [r.bulan, Number(r.jumlah)]));
  const sekarang = new Date();
  const tren: { bulan: string; jumlah: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(sekarang.getUTCFullYear(), sekarang.getUTCMonth() - i, 1));
    const kunci = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    tren.push({ bulan: kunci, jumlah: petaBulan.get(kunci) ?? 0 });
  }

  const bulanIni = tren[11]?.jumlah ?? 0;
  const bulanLalu = tren[10]?.jumlah ?? 0;

  /* ── Lead masuk per bulan, per tahun kalender ─────────────────── */

  /* Grafik batang membaca tahun kalender penuh — Januari sampai Desember —
     bukan dua belas bulan terakhir yang berjalan. Pertanyaan yang dijawabnya
     adalah "Agustus tahun ini dapat berapa", dan jendela berjalan membuat
     perbandingan Agustus-ke-Agustus mustahil karena sumbunya bergeser tiap
     bulan. Bulan tanpa lead tetap dikirim sebagai nol supaya lebarnya sama
     dan celahnya terbaca sebagai "sepi", bukan sebagai data yang hilang. */
  const perTahun = new Map<number, number[]>();
  for (const r of tahunBulanRows) {
    const th = Number(r.tahun);
    const bl = Number(r.bulan);
    if (!perTahun.has(th)) perTahun.set(th, Array(12).fill(0));
    perTahun.get(th)![bl - 1] = Number(r.jumlah);
  }
  /* Tahun berjalan selalu ada di daftar meski belum ada satu lead pun —
     kalau tidak, grafiknya membuka pada tahun lalu dan terlihat seperti
     salah data. */
  const tahunIni = new Date().getFullYear();
  if (!perTahun.has(tahunIni)) perTahun.set(tahunIni, Array(12).fill(0));

  const tahunan = [...perTahun.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([tahun, bulan]) => ({
      tahun,
      bulan,
      total: bulan.reduce((a, b) => a + b, 0),
    }));

  /* ── Follow-up ───────────────────────────────────────────────── */

  const fu = followUpRows[0];

  return NextResponse.json({
    ok: true,
    data: {
      total,
      klienAktif,
      perTahap,
      nilaiPipeline,
      nilaiClosing,
      tanpaBudget,
      tanpaBudgetSemua,
      jumlahClosing: perTahap.closing.jumlah,
      followUp: {
        terlambat: Number(fu?.terlambat ?? 0),
        hariIni: Number(fu?.hari_ini ?? 0),
        nilaiTerlambat: Number(fu?.nilai_terlambat ?? 0),
      },
      tren,
      tahunan,
      bulanIni,
      bulanLalu,
    },
  });
}
