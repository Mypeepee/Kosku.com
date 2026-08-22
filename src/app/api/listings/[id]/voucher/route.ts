/**
 * /api/listings/{id}/voucher — voucher potongan sewa milik satu listing.
 *
 *   GET             daftar publik (hidup hari ini, bukan rahasia, kuota tersisa)
 *   GET ?kode=X     tebus satu kode (rahasia ikut dicari)
 *   GET ?kelola=1   daftar UTUH + statistik pemakaian, untuk pemegang listing
 *   POST            tambah voucher
 *   PATCH           ubah voucher      (id di body)
 *   DELETE ?voucher=123
 *
 * Pencatatan PEMAKAIAN voucher ada di rute terpisah: ./pakai/route.ts. Sengaja
 * dipisah — yang satu dipanggil pemilik dengan izin penuh, yang satu dipanggil
 * calon penyewa tanpa sesi sama sekali, dan menggabungkan keduanya berarti satu
 * berkas yang separuh jalurnya dijaga dan separuh tidak.
 *
 * Izinnya memakai `canManageSewaAvailability` — aturan yang sama persis dengan
 * kalender ketersediaan. Sengaja bukan aturan baru: keduanya menjawab
 * pertanyaan "siapa yang boleh mengubah cara aset ini dijual", dan dua
 * himpunan izin untuk satu pertanyaan pasti akan berselisih suatu hari.
 * Identitas pemanggil dibaca ULANG dari DB lewat status-guard — jabatan di JWT
 * boleh basi sampai 5 menit, dan itu terlalu lama untuk aksi yang menulis.
 *
 * ── DUA BENTUK BALASAN GET ────────────────────────────────────────────────
 * Publik hanya menerima voucher yang benar-benar bisa dipakai. Yang tidak
 * aktif, yang belum mulai, yang sudah lewat, yang kuotanya habis, dan yang
 * rahasia TIDAK ikut — voucher rahasia yang bocor lewat tab Network bukan lagi
 * rahasia, dan itu promo tertutup yang pemiliknya bayar sendiri.
 *
 * Perhitungan potongan & penentuan status TIDAK ada di sini. Keduanya di
 * @/lib/voucher yang dipakai browser & server dari satu berkas — lihat catatan
 * di sana.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma, { petunjukClientBasi } from "@/lib/prisma";
import { canManageSewaAvailability } from "@/lib/listingStatusPermission";
import {
  KODE_VOUCHER_RE,
  kuotaHabis,
  normalisasiInput,
  validasiVoucher,
  type InputVoucher,
  type Voucher,
} from "@/lib/voucher";
import { isDurasiKey, type DurasiKey } from "@/lib/kosDetail";
import { punyaPanelPemesanan } from "@/lib/sewaKapabilitas";
import { resolveStatusActor } from "../../_lib/status-guard";

// Balasannya bergantung pada sesi pemanggil (publik vs pengelola), dan satu
// balasan pengelola yang ter-cache lalu tersaji ke pengunjung adalah kebocoran.
export const dynamic = "force-dynamic";

/**
 * Galat tak terduga → balasan JSON.
 *
 * Di PRODUKSI pesannya tetap "Internal error": isi pesan galat basis data bisa
 * memuat nama kolom, potongan query, bahkan nilai parameter, dan tidak satu pun
 * berguna bagi pengunjung.
 *
 * Di PENGEMBANGAN pesan aslinya ikut dikirim, dan itu bukan kemalasan. "Internal
 * error" di layar memaksa siapa pun yang sedang mengerjakan halaman ini pindah
 * ke terminal, mencari baris log yang benar di antara ratusan baris
 * `prisma:query`, lalu kembali — untuk sesuatu yang sudah ada di tangannya. Satu
 * putaran itu hilang dengan satu bidang tambahan yang tidak pernah sampai ke
 * pengguna sungguhan.
 */
function galatInternal(konteks: string, error: unknown) {
  console.error(`❌ ${konteks}:`, error);

  // Sebab yang paling sering, dan paling menyamar: client Prisma yang sudah
  // di-generate ulang tapi prosesnya belum pernah dimatikan. Galatnya berbunyi
  // seperti kesalahan kode ("Unknown field `x`"), jadi kalimat ini disisipkan
  // di depan supaya yang dicurigai lebih dulu adalah umur proses, bukan query
  // yang barusan ditulis.
  const basi = petunjukClientBasi();
  const pesan = error instanceof Error ? error.message : String(error);

  return NextResponse.json(
    {
      error: "Internal error",
      ...(process.env.NODE_ENV === "production"
        ? {}
        : { detail: basi ? `${basi}\n\n(galat asli: ${pesan})` : pesan }),
    },
    { status: 500 },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSER
// ─────────────────────────────────────────────────────────────────────────────

function parseId(raw: string): bigint | null {
  const trimmed = String(raw ?? "").trim();
  if (!/^\d+$/.test(trimmed)) return null;
  try {
    return BigInt(trimmed);
  } catch {
    return null;
  }
}

/** "YYYY-MM-DD" waktu lokal server — sama dengan yang dipakai @/lib/voucher. */
const kunciHariIni = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
};

/** Baris DB → bentuk yang dimakan @/lib/voucher & seluruh UI. */
type BarisVoucher = {
  id: bigint;
  kode: string;
  nama: string;
  deskripsi: string | null;
  jenis: "PERSEN" | "NOMINAL";
  nilai: unknown;
  potongan_maks: bigint | null;
  min_transaksi: bigint | null;
  durasi_berlaku: string[];
  tipe_berlaku: bigint[];
  lama_min: number | null;
  berlaku_mulai: Date | null;
  berlaku_sampai: Date | null;
  kuota_total: number | null;
  kuota_terpakai: number;
  aktif: boolean;
  rahasia: boolean;
};

/**
 * Kolomnya DATE, jadi jam-nya 00:00 UTC. Diformat dari komponen UTC — memakai
 * getFullYear() lokal akan memundurkannya satu hari di zona waktu barat UTC.
 */
const tanggalKeKunci = (d: Date | null): string | null =>
  d ? d.toISOString().slice(0, 10) : null;

function toView(r: BarisVoucher): Voucher {
  return {
    id: r.id.toString(),
    kode: r.kode,
    nama: r.nama,
    deskripsi: r.deskripsi ?? "",
    jenis: r.jenis,
    nilai: Number(r.nilai),
    potonganMaks: r.potongan_maks != null ? Number(r.potongan_maks) : null,
    minTransaksi: r.min_transaksi != null ? Number(r.min_transaksi) : null,
    // Array kosong di DB berarti "semua durasi"; di UI itu diwakili null,
    // supaya `durasiBerlaku && !includes(...)` tidak perlu tahu bedanya.
    durasiBerlaku: r.durasi_berlaku.length
      ? (r.durasi_berlaku.filter(isDurasiKey) as DurasiKey[])
      : null,
    // Kosong di DB = "semua tipe"; di UI itu diwakili null, seperti
    // durasi_berlaku, supaya pemeriksaannya jadi satu bentuk yang sama.
    tipeBerlaku: r.tipe_berlaku.length
      ? r.tipe_berlaku.map((t) => t.toString())
      : null,
    lamaMin: r.lama_min,
    berlakuMulai: tanggalKeKunci(r.berlaku_mulai),
    berlakuSampai: tanggalKeKunci(r.berlaku_sampai),
    kuotaTotal: r.kuota_total,
    kuotaTerpakai: r.kuota_terpakai ?? 0,
    aktif: r.aktif,
    rahasia: r.rahasia,
  };
}

const PILIH = {
  id: true,
  kode: true,
  nama: true,
  deskripsi: true,
  jenis: true,
  nilai: true,
  potongan_maks: true,
  min_transaksi: true,
  durasi_berlaku: true,
  tipe_berlaku: true,
  lama_min: true,
  berlaku_mulai: true,
  berlaku_sampai: true,
  kuota_total: true,
  kuota_terpakai: true,
  aktif: true,
  rahasia: true,
} as const;

/**
 * Body mentah → InputVoucher. Angka kosong ("" atau null) menjadi null, BUKAN
 * 0: "minimal transaksi 0" dan "tanpa minimal transaksi" adalah dua syarat
 * yang berbeda, dan Number("") yang menghasilkan 0 diam-diam menukar keduanya.
 */
function bacaInput(body: any): InputVoucher {
  const angka = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const durasi = Array.isArray(body?.durasiBerlaku) ? body.durasiBerlaku : [];
  const tipe = Array.isArray(body?.tipeBerlaku) ? body.tipeBerlaku : [];

  return {
    kode: String(body?.kode ?? ""),
    nama: String(body?.nama ?? ""),
    deskripsi: body?.deskripsi ? String(body.deskripsi) : null,
    jenis: body?.jenis === "PERSEN" ? "PERSEN" : "NOMINAL",
    nilai: angka(body?.nilai) ?? 0,
    potonganMaks: angka(body?.potonganMaks),
    minTransaksi: angka(body?.minTransaksi),
    durasiBerlaku: durasi.filter(isDurasiKey) as DurasiKey[],
    tipeBerlaku: tipe.map((t: unknown) => String(t)),
    lamaMin: angka(body?.lamaMin),
    berlakuMulai: body?.berlakuMulai ? String(body.berlakuMulai) : null,
    berlakuSampai: body?.berlakuSampai ? String(body.berlakuSampai) : null,
    kuotaTotal: angka(body?.kuotaTotal),
    aktif: body?.aktif !== false,
    rahasia: body?.rahasia === true,
  };
}

/**
 * InputVoucher yang SUDAH sah → kolom DB.
 *
 * `kuota_terpakai` sengaja TIDAK ada di sini. Ia hanya boleh naik lewat rute
 * ./pakai yang memakai UPDATE bersyarat; membiarkan form menuliskannya berarti
 * satu penyimpanan biasa bisa mengembalikan counter ke angka lama dan
 * menghidupkan kembali kuota yang sudah tandas.
 */
function toKolom(v: InputVoucher, idAgent: string) {
  return {
    kode: v.kode,
    nama: v.nama,
    deskripsi: v.deskripsi,
    jenis: v.jenis,
    nilai: v.nilai,
    potongan_maks: v.potonganMaks != null ? BigInt(Math.round(v.potonganMaks)) : null,
    min_transaksi: v.minTransaksi != null ? BigInt(Math.round(v.minTransaksi)) : null,
    durasi_berlaku: v.durasiBerlaku,
    // Sudah dipastikan berupa angka oleh `validasiVoucher`; BigInt() di sini
    // tidak bisa melempar.
    tipe_berlaku: v.tipeBerlaku.map((t) => BigInt(t)),
    lama_min: v.lamaMin,
    // `T00:00:00.000Z` eksplisit: tanpa jam, Date("2026-09-30") memang UTC,
    // tapi Date("2026-9-30") tidak — dan kolomnya DATE, jadi pergeseran satu
    // jam pun bisa memundurkan tanggalnya sehari.
    berlaku_mulai: v.berlakuMulai ? new Date(`${v.berlakuMulai}T00:00:00.000Z`) : null,
    berlaku_sampai: v.berlakuSampai ? new Date(`${v.berlakuSampai}T00:00:00.000Z`) : null,
    kuota_total: v.kuotaTotal,
    aktif: v.aktif,
    rahasia: v.rahasia,
    dibuat_oleh: idAgent,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PENJAGA
// ─────────────────────────────────────────────────────────────────────────────

type Dijaga =
  | { ok: true; idProperty: bigint; idAgent: string }
  | { ok: false; response: NextResponse };

/** Memuat listing + menegakkan izin. Dipakai semua jalur yang MENULIS. */
async function jagaMutasi(idRaw: string): Promise<Dijaga> {
  const idProperty = parseId(idRaw);
  if (idProperty === null) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Id listing tidak valid." }, { status: 400 }),
    };
  }

  const resolved = await resolveStatusActor();
  if (!resolved.ok) return { ok: false, response: resolved.response };

  const listing = await prisma.listing.findUnique({
    where: { id_property: idProperty },
    select: { id_agent: true, jenis_transaksi: true, kategori: true },
  });

  if (!listing) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Listing tidak ditemukan." }, { status: 404 }),
    };
  }

  // Voucher memotong harga SEWA. Pada listing jual/lelang ia tidak punya
  // subtotal untuk digigit, dan panelnya pun tidak pernah memintanya.
  if (listing.jenis_transaksi !== "SEWA") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Voucher hanya berlaku untuk listing sewa." },
        { status: 400 },
      ),
    };
  }

  /**
   * …dan bahkan di dalam SEWA, hanya kategori yang punya panel pemesanan.
   *
   * Voucher ditebus di langkah memilih tanggal & durasi. Kategori bermode
   * NEGOSIASI (gudang, ruko, pabrik, tanah, rumah) tidak melewati langkah itu
   * sama sekali — harganya dirundingkan langsung dengan agent. Voucher di sana
   * bukan fitur yang mubazir, melainkan promo yang mustahil ditebus siapa pun,
   * dan pemiliknya baru menyadarinya setelah menunggu berminggu-minggu.
   */
  if (!punyaPanelPemesanan(listing.kategori)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            "Voucher hanya berlaku untuk kategori yang punya panel pemesanan (kos, apartemen, hotel & villa). Untuk kategori lain, potongan harga dirundingkan langsung dengan calon penyewa.",
        },
        { status: 400 },
      ),
    };
  }

  const izin = canManageSewaAvailability(resolved.actor, {
    idAgent: listing.id_agent,
    jenisTransaksi: listing.jenis_transaksi,
  });

  if (!izin.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            izin.reason === "BUKAN_PEMILIK"
              ? "Listing ini dipegang agent lain, jadi vouchernya hanya bisa diatur oleh pemegangnya."
              : izin.message,
        },
        { status: 403 },
      ),
    };
  }

  return { ok: true, idProperty, idAgent: resolved.actor.idAgent };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const idProperty = parseId(params.id);
    if (idProperty === null) {
      return NextResponse.json({ error: "Id listing tidak valid." }, { status: 400 });
    }

    const url = new URL(request.url);
    const kode = url.searchParams.get("kode")?.trim().toUpperCase();
    const kelola = url.searchParams.get("kelola") === "1";
    const hariIni = new Date(`${kunciHariIni()}T00:00:00.000Z`);

    // ── Daftar pengelola ──────────────────────────────────────────────────
    if (kelola) {
      const dijaga = await jagaMutasi(params.id);
      if (!dijaga.ok) return dijaga.response;

      // Urutan daftar SENGAJA tidak menaruh yang aktif di atas lewat SQL:
      // "aktif" di kolom itu hanya berarti pemiliknya belum mematikannya, dan
      // status sesungguhnya (kedaluwarsa, kuota habis, terjadwal) baru
      // dihitung di @/lib/voucher. Pengurutan tampilan dilakukan di panel
      // dengan status yang sudah lengkap; di sini cukup yang terbaru dulu.
      const [rows, agregat] = await Promise.all([
        prisma.listingVoucher.findMany({
          where: { id_property: idProperty },
          orderBy: [{ dibuat_pada: "desc" }],
          select: PILIH,
        }),
        // Riwayat pemakaian diringkas dalam SATU query untuk seluruh listing,
        // bukan satu query per voucher: daftar dengan 12 promo tidak boleh
        // berarti 13 perjalanan ke database.
        prisma.listingVoucherPakai.groupBy({
          by: ["id_voucher"],
          where: { id_property: idProperty },
          _count: { _all: true },
          _sum: { potongan: true },
        }),
      ]);

      const statistik: Record<string, { dipakai: number; totalPotongan: number }> =
        {};
      for (const a of agregat) {
        statistik[a.id_voucher.toString()] = {
          dipakai: a._count._all,
          totalPotongan: Number(a._sum.potongan ?? 0),
        };
      }

      return NextResponse.json({
        ok: true,
        vouchers: rows.map(toView),
        statistik,
      });
    }

    // Hanya voucher yang benar-benar bisa dipakai hari ini. Jadwal & tanggal
    // akhir disaring di SQL; kuota disaring di JS karena membandingkan dua
    // kolom dalam satu WHERE tidak bisa dinyatakan dengan aman lintas versi
    // Prisma — dan jumlah barisnya per listing memang segelintir.
    const dasar = {
      id_property: idProperty,
      aktif: true,
      AND: [
        { OR: [{ berlaku_sampai: null }, { berlaku_sampai: { gte: hariIni } }] },
        { OR: [{ berlaku_mulai: null }, { berlaku_mulai: { lte: hariIni } }] },
      ],
    };

    // ── Penebusan kode ────────────────────────────────────────────────────
    // Voucher rahasia ikut dicari DI SINI SAJA. Jawaban "tidak ditemukan"
    // sengaja sama persis untuk kode yang salah ketik, yang sudah lewat, yang
    // kuotanya habis, dan yang dimatikan — membedakannya akan memberi tahu
    // penebak kode mana yang pernah ada.
    if (kode) {
      const tidakKetemu = NextResponse.json(
        { error: "Kode voucher tidak ditemukan atau sudah tidak berlaku" },
        { status: 404 },
      );

      if (!KODE_VOUCHER_RE.test(kode)) return tidakKetemu;

      const row = await prisma.listingVoucher.findFirst({
        where: { ...dasar, kode },
        select: PILIH,
      });
      if (!row) return tidakKetemu;

      const view = toView(row);
      if (kuotaHabis(view)) return tidakKetemu;

      return NextResponse.json({ ok: true, voucher: view });
    }

    // ── Daftar publik ─────────────────────────────────────────────────────
    const rows = await prisma.listingVoucher.findMany({
      where: { ...dasar, rahasia: false },
      orderBy: [{ dibuat_pada: "desc" }],
      select: PILIH,
    });

    return NextResponse.json({
      ok: true,
      vouchers: rows.map(toView).filter((v) => !kuotaHabis(v)),
    });
  } catch (error) {
    return galatInternal("/api/listings/[id]/voucher GET", error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const dijaga = await jagaMutasi(params.id);
    if (!dijaga.ok) return dijaga.response;

    const body = await request.json().catch(() => null);
    const input = normalisasiInput(bacaInput(body));

    const galat = validasiVoucher(input);
    if (galat) return NextResponse.json({ error: galat }, { status: 400 });

    const row = await prisma.listingVoucher.create({
      data: { id_property: dijaga.idProperty, ...toKolom(input, dijaga.idAgent) },
      select: PILIH,
    });

    return NextResponse.json({ ok: true, voucher: toView(row) }, { status: 201 });
  } catch (error: any) {
    // P2002 = tabrakan indeks unik (id_property, kode). Diterjemahkan supaya
    // pemilik tahu apa yang harus diubah, bukan menerima "Internal error".
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "Kode itu sudah dipakai di listing ini. Pakai kode lain." },
        { status: 409 },
      );
    }
    return galatInternal("/api/listings/[id]/voucher POST", error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH
// ─────────────────────────────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const dijaga = await jagaMutasi(params.id);
    if (!dijaga.ok) return dijaga.response;

    const body = await request.json().catch(() => null);
    const idVoucher = String(body?.id ?? "").trim();
    if (!/^\d+$/.test(idVoucher)) {
      return NextResponse.json({ error: "Id voucher tidak valid." }, { status: 400 });
    }

    // Kepemilikan diperiksa lewat id_property pada WHERE, bukan hanya lewat id.
    // Tanpa itu, pemegang listing A bisa menyunting voucher listing B hanya
    // dengan menebak angka — izin di atas hanya membuktikan dia berhak atas A.
    const milik = await prisma.listingVoucher.findFirst({
      where: { id: BigInt(idVoucher), id_property: dijaga.idProperty },
      select: { id: true, kuota_terpakai: true },
    });
    if (!milik) {
      return NextResponse.json(
        { error: "Voucher tidak ditemukan di listing ini." },
        { status: 404 },
      );
    }

    const input = normalisasiInput(bacaInput(body));
    // Pemakaian yang sudah tercatat ikut divalidasi: kuota baru yang lebih
    // kecil daripadanya akan menghasilkan "12 / 10 terpakai" di panel, dan
    // tidak ada cara menjelaskan angka itu kepada siapa pun.
    const galat = validasiVoucher(input, milik.kuota_terpakai);
    if (galat) return NextResponse.json({ error: galat }, { status: 400 });

    const { dibuat_oleh: _abaikan, ...kolom } = toKolom(input, dijaga.idAgent);

    const row = await prisma.listingVoucher.update({
      where: { id: milik.id },
      // `dibuat_oleh` sengaja TIDAK ditimpa: kolom itu mencatat siapa yang
      // membuat, dan menimpanya dengan penyunting terakhir menghapus satu-
      // satunya jejak bahwa OWNER pernah membuat voucher di listing agent lain.
      data: { ...kolom, diperbarui_pada: new Date() },
      select: PILIH,
    });

    return NextResponse.json({ ok: true, voucher: toView(row) });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "Kode itu sudah dipakai di listing ini. Pakai kode lain." },
        { status: 409 },
      );
    }
    return galatInternal("/api/listings/[id]/voucher PATCH", error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const dijaga = await jagaMutasi(params.id);
    if (!dijaga.ok) return dijaga.response;

    const url = new URL(request.url);
    const idVoucher = String(url.searchParams.get("voucher") ?? "").trim();
    if (!/^\d+$/.test(idVoucher)) {
      return NextResponse.json({ error: "Id voucher tidak valid." }, { status: 400 });
    }

    // deleteMany, bukan delete: id_property ikut jadi syarat, jadi satu query
    // sekaligus membuktikan vouchernya memang milik listing ini.
    // Riwayat pemakaiannya ikut terhapus lewat ON DELETE CASCADE — itu memang
    // yang diinginkan: riwayat promo yang sudah tidak ada tidak punya pembaca.
    const hasil = await prisma.listingVoucher.deleteMany({
      where: { id: BigInt(idVoucher), id_property: dijaga.idProperty },
    });

    if (hasil.count === 0) {
      return NextResponse.json(
        { error: "Voucher tidak ditemukan di listing ini." },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return galatInternal("/api/listings/[id]/voucher DELETE", error);
  }
}
