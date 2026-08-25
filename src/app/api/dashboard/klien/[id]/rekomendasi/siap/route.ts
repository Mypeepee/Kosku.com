// GET /api/dashboard/klien/[id]/rekomendasi/siap
// ---------------------------------------------------------------------------
// Aset yang siap dikirim ke seorang klien — GABUNGAN seluruh preferensinya.
//
// KENAPA GABUNGAN, BUKAN SATU PREFERENSI.
// Agent tidak pernah berpikir "saya mau kirim aset dari preferensi kedua
// Budi"; ia berpikir "kirimkan sesuatu untuk Budi". Memaksanya memilih
// preferensi dulu menambah satu ketukan dan satu keputusan yang tidak berarti
// apa-apa baginya — dan klien dengan tiga preferensi membuat agent harus
// membuka tiga layar untuk melihat pilihan yang lengkap. Di kehidupan nyata
// klien yang serius HAMPIR SELALU punya lebih dari satu kriteria ("rumah di
// Gresik ≤ 500jt, atau ruko di Surabaya ≤ 1M"), jadi satu-preferensi-satu-
// layar bukan penyederhanaan, ia kehilangan data.
//
// Seluruh preferensi dijalankan sekaligus, hasilnya digabung dan dibuang
// duplikatnya (satu aset bisa cocok dengan dua preferensi), lalu diperingkat
// sebagai satu daftar. Tiap baris hasil MEMBAWA preferensi asalnya, supaya
// layar bisa memberi label & menyaring, dan supaya pencatatan kiriman tahu
// kriteria mana yang sebenarnya menghasilkan.
//
// ?pref=12,13   → batasi ke preferensi tertentu (dipakai tombol "Cari Aset"
//                 di dalam satu kartu preferensi). Tanpa parameter = semua.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";
import {
  cariCocok, skorListing, alasanCocok, diagnosaKosong, fotoPertama, hargaEfektif,
  type KriteriaMatch, type Diagnosa,
} from "@/lib/klienMatch";
import { ringkasGrup, kunciGrup, bagiSlot } from "@/lib/klienRingkas";
import { siapkanDekat, dekatUntuk } from "@/lib/klienDekat";
import { muatPengecualian, gabung } from "@/lib/klienPengecualian";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/** Berapa aset yang otomatis TERPILIH saat layar terbuka.
 *  Tiga, bukan nol: layar yang terbuka dengan nol pilihan memaksa agent
 *  memutuskan sesuatu sebelum bisa bertindak, dan keputusan itulah gesekan
 *  yang sebenarnya. Tiga aset terbaik adalah tebakan yang hampir selalu benar,
 *  dan mencabut centang jauh lebih murah daripada memasangnya. */
const PILIH_AWAL = 3;

/** Berapa preferensi yang ikut didiagnosa saat hasilnya nol. Diagnosa itu
 *  tiga query per preferensi; menjalankannya untuk kesepuluh preferensi demi
 *  satu layar kosong adalah harga yang tidak sebanding. Tiga sudah cukup
 *  untuk menemukan gerbang mana yang paling mudah digeser. */
const MAKS_DIAGNOSA = 3;

const SELECT_ASET = {
  id_property: true, slug: true, judul: true,
  kota: true, provinsi: true, kecamatan: true, kelurahan: true, alamat_lengkap: true,
  jenis_transaksi: true, kategori: true,
  harga: true, harga_promo: true, harga_efektif: true, nilai_limit_lelang: true,
  gambar: true, luas_tanah: true, luas_bangunan: true,
  kamar_tidur: true, kamar_mandi: true,
  is_hot_deal: true, tanggal_dibuat: true, tanggal_lelang: true,
} as const;

export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const agentId = (session.user as any).agentId as string | undefined;
  if (!agentId) return NextResponse.json({ ok: false }, { status: 403 });

  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 24, 1), 60);
  const saring = (url.searchParams.get("pref") || "")
    .split(",").map(s => s.trim()).filter(Boolean);

  const klien = await prisma.klien.findFirst({
    where: { id_klien: params.id, id_agent: agentId },
    select: {
      id_klien: true, nama: true, nomor_whatsapp: true, id_properti_asal: true,
      preferensi: true,
    },
  });
  if (!klien) return NextResponse.json({ ok: false }, { status: 404 });

  /* Penyaringan dilakukan di sini, SESUDAH klien diambil — bukan di klausa
     where preferensinya. Preferensi milik klien lain yang id-nya diselipkan
     ke URL jadi tidak pernah bisa ikut terpakai. */
  const semuaPref = klien.preferensi;
  const prefTerpakai = saring.length
    ? semuaPref.filter(p => saring.includes(p.id_preferensi.toString()))
    : semuaPref;

  if (prefTerpakai.length === 0) {
    return NextResponse.json({
      ok: true, items: [], total: 0, terpilih: [], diagnosa: null,
      tanpaPreferensi: semuaPref.length === 0,
      preferensi: [],
      klien: { nama: klien.nama, punyaWa: !!klien.nomor_whatsapp },
    });
  }

  /* Sudah dikirim, DISINGKIRKAN agent, dan aset milik klien itu sendiri —
     ketiganya lewat satu pintu. Merakitnya di sini berarti permukaan lain
     (panel ringkasan, cron email) bisa lupa salah satunya, dan yang lupa akan
     mengirim ulang aset yang baru saja dibuang agent. */
  const [pengecualian, jumlahDisingkirkan] = await Promise.all([
    muatPengecualian(prisma, [params.id]),
    /* Dihitung di sini, bukan dibiarkan tab "Disingkirkan" menghitungnya
       sendiri saat dibuka: lencana yang baru muncul SETELAH tabnya diketuk
       tidak pernah memberi tahu agent bahwa di sana ada sesuatu. */
    prisma.rekomendasiDisingkirkan.count({ where: { id_klien: params.id } }),
  ]);
  const kecuali = gabung(pengecualian, params.id, klien.id_properti_asal);

  /* Token "dekat X" diterjemahkan SEKALI untuk seluruh preferensi klien ini.
     Menerjemahkannya di dalam keKriteria() berarti satu query kamus tiap kali
     kriteria disusun — dan ia disusun berkali-kali per permintaan. */
  const petaDekat = await siapkanDekat(prefTerpakai);

  const keKriteria = (p: (typeof semuaPref)[number]): KriteriaMatch => ({
    id_preferensi: p.id_preferensi,
    maksud: p.maksud,
    tipe_properti: p.tipe_properti,
    jenis_transaksi: p.jenis_transaksi,
    loc_provinsi: p.loc_provinsi,
    loc_kota: p.loc_kota,
    loc_kecamatan: p.loc_kecamatan,
    loc_kelurahan: p.loc_kelurahan,
    budget_min: p.budget_min,
    budget_max: p.budget_max,
    luas_min: p.luas_min,
    luas_max: p.luas_max,
    legalitas: p.legalitas,
    dekat: dekatUntuk(p, petaDekat),
    alamat_teks: p.alamat_teks,
  });

  /* Seluruh preferensi dijalankan berbarengan. Jumlahnya kecil (satu klien
     jarang punya lebih dari empat), jadi ini tidak butuh pool pembatas. */
  const perPref = await Promise.all(
    prefTerpakai.map(p => cariCocok<any>(prisma, keKriteria(p), { kecuali, select: SELECT_ASET })),
  );

  /* ── KELOMPOKKAN JADI "PREFERENSI" YANG DIKENAL AGENT ────────────────────
     Satu baris `preferensi_klien` BUKAN satu preferensi di mata agent.
     Formulirnya menerima beberapa tipe dan beberapa lokasi sekaligus lalu
     menyimpannya sebagai perkalian keduanya — "Gudang di Surabaya, Sidoarjo,
     Gresik" jadi TIGA baris. Agent yang mengisinya merasa membuat SATU
     kriteria. Menampilkan tiga pill untuk itu adalah membocorkan bentuk
     penyimpanan ke layar. */
  type Grup = {
    id_grup: string;
    ids: string[];
    rows: (typeof semuaPref)[number][];
    /** id_property → simpul terbaik DI DALAM grup ini. */
    aset: Map<string, { l: any; skor: number; alasan: string[]; idPref: string }>;
  };

  const grupPeta = new Map<string, Grup>();
  prefTerpakai.forEach((p, i) => {
    const kunci = kunciGrup(p);
    let g = grupPeta.get(kunci);
    if (!g) {
      g = { id_grup: "", ids: [], rows: [], aset: new Map() };
      grupPeta.set(kunci, g);
    }
    g.ids.push(p.id_preferensi.toString());
    g.rows.push(p);

    const k = keKriteria(p);
    const idPref = p.id_preferensi.toString();
    for (const l of perPref[i]) {
      const id = l.id_property.toString();
      const skor = skorListing(l, k);
      const ada = g.aset.get(id);
      /* Dedup DI DALAM grup: aset yang cocok dengan "Gudang Surabaya" dan
         "Gudang Sidoarjo" sekaligus tidak mungkin ada, tapi aset yang cocok
         dengan dua tipe dalam satu grup sangat mungkin. */
      if (!ada || skor > ada.skor) g.aset.set(id, { l, skor, alasan: alasanCocok(l, k), idPref });
    }
  });

  const grup = [...grupPeta.values()];
  grup.forEach(g => { g.id_grup = [...g.ids].sort().join("-"); });

  /* ── BAGI SLOT ANTAR GRUP ────────────────────────────────────────────────
     Sebelumnya daftar dipotong "24 teratas" secara global. Skor antar kriteria
     TIDAK sebanding — rumah di Gresik mencetak 66, gudang mencetak 46 — jadi
     seluruh 24 slot habis diisi rumah, sementara pill "Gudang · 34" tetap
     menjanjikan 34 aset. Diketuk, layarnya kosong. Pembagian di bawah menjamin
     setiap grup yang punya kecocokan kebagian tempat di daftar. */
  const tersedia = grup.map(g => g.aset.size);
  const jatah = bagiSlot(tersedia, limit);

  const terpilihPerGrup = grup.map((g, i) =>
    [...g.aset.entries()]
      .sort((a, b) => b[1].skor - a[1].skor)
      .slice(0, jatah[i]),
  );

  /* Satukan untuk tampilan "Semua". Aset yang terpilih di dua grup muncul
     SEKALI, tapi membawa kedua grupnya — kalau tidak, ia akan lenyap dari
     salah satu pill tanpa alasan yang terlihat. */
  type Simpul = { l: any; skor: number; alasan: string[]; idPref: string; grup: string; cocokGrup: Set<string> };
  const peta = new Map<string, Simpul>();
  terpilihPerGrup.forEach((daftar, i) => {
    const idGrup = grup[i].id_grup;
    for (const [id, v] of daftar) {
      const ada = peta.get(id);
      if (!ada) {
        peta.set(id, { ...v, grup: idGrup, cocokGrup: new Set([idGrup]) });
      } else {
        ada.cocokGrup.add(idGrup);
        if (v.skor > ada.skor) { ada.skor = v.skor; ada.alasan = v.alasan; ada.idPref = v.idPref; ada.grup = idGrup; }
      }
    }
  });

  const items = [...peta.values()]
    .sort((a, b) => b.skor - a.skor)
    .map(({ l, skor, alasan, idPref, grup: idGrup, cocokGrup }) => ({
      id_property: l.id_property.toString(),
      id_preferensi: idPref,
      grup: idGrup,
      cocok_grup: [...cocokGrup],
      slug: l.slug,
      judul: l.judul,
      kota: l.kota ?? "",
      kecamatan: l.kecamatan ?? "",
      kelurahan: l.kelurahan ?? "",
      alamat_lengkap: l.alamat_lengkap ?? "",
      jenis_transaksi: l.jenis_transaksi,
      kategori: l.kategori,
      harga: hargaEfektif(l),
      harga_asli: Number(l.harga),
      harga_promo: l.harga_promo ? Number(l.harga_promo) : null,
      nilai_limit_lelang: l.nilai_limit_lelang ? Number(l.nilai_limit_lelang) : null,
      tanggal_lelang: l.tanggal_lelang?.toISOString() ?? null,
      gambar: fotoPertama(l.gambar),
      luas_tanah: l.luas_tanah ? Number(l.luas_tanah) : 0,
      luas_bangunan: l.luas_bangunan ? Number(l.luas_bangunan) : 0,
      kamar_tidur: l.kamar_tidur ?? 0,
      kamar_mandi: l.kamar_mandi ?? 0,
      agent_name: "", agent_office: "",
      skor,
      alasan,
    }));

  /* `ditampilkan` DIHITUNG DARI DAFTAR YANG BENAR-BENAR DIKIRIM, bukan dari
     jatah — aset yang terpilih di dua grup membuat keduanya berbeda, dan
     angka di pill harus sama persis dengan jumlah baris yang muncul ketika
     pill itu diketuk. Angka yang meleset satu pun akan terlihat. */
  const preferensi = grup.map(g => ({
    id_grup: g.id_grup,
    ids: g.ids,
    label: ringkasGrup(g.rows),
    maksud: g.rows[0].maksud,
    /** Seluruh kecocokan kriteria ini, termasuk yang tidak muat di daftar. */
    total: g.aset.size,
    /** Yang benar-benar ada di `items` untuk grup ini. */
    ditampilkan: items.filter(it => it.cocok_grup.includes(g.id_grup)).length,
  }));

  const totalSemua = new Set(grup.flatMap(g => [...g.aset.keys()])).size;

  /* Diagnosa hanya saat SELURUH kriteria nol. Dijalankan atas preferensi yang
     PALING MUNGKIN diselamatkan: tiap kandidat didiagnosa lalu dipilih yang
     punya jalan keluar terbesar — sebelumnya selalu baris pertama, yang bisa
     saja kriteria paling mustahil, dan sarannya jadi menunjuk arah yang salah. */
  let diagnosa: (Diagnosa & { id_preferensi: string; label: string }) | null = null;
  if (totalSemua === 0) {
    const kandidat = prefTerpakai.slice(0, MAKS_DIAGNOSA);
    const hasil = await Promise.all(
      kandidat.map(async p => ({ p, d: await diagnosaKosong(prisma, keKriteria(p), { kecuali }) })),
    );
    const jalanKeluar = (d: Diagnosa) => Math.max(d.jikaBudgetNaik10, d.jikaLokasiDiperluas, d.jikaLuasDiabaikan);
    const terbaik = hasil.reduce((a, b) => (jalanKeluar(b.d) > jalanKeluar(a.d) ? b : a));
    diagnosa = { ...terbaik.d, id_preferensi: terbaik.p.id_preferensi.toString(), label: ringkasGrup([terbaik.p]) };
  }

  return NextResponse.json({
    ok: true,
    items,
    total: totalSemua,
    terpilih: items.slice(0, PILIH_AWAL).map(i => i.id_property),
    diagnosa,
    tanpaPreferensi: false,
    jumlahDisingkirkan,
    preferensi,
    klien: { nama: klien.nama, punyaWa: !!klien.nomor_whatsapp },
    /* Kode agent yang sedang login. Dipakai layar untuk menempelkannya di ekor
       tautan detail — agent sering menyalin tautan dari situ untuk dibagikan
       manual, dan tanpa kodenya tombol "hubungi agent" di halaman tujuan akan
       menunjuk ke PEMILIK listing, bukan ke dirinya. */
    idAgent: agentId,
  });
}
