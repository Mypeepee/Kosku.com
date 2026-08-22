/**
 * POST /api/listings/{id}/voucher/pakai — catat satu pemakaian voucher.
 *
 * Dipanggil panel pemesanan SESUDAH pengajuan sewa berhasil tercatat sebagai
 * lead, bukan sebelumnya. Urutannya penting: kuota yang berkurang untuk
 * pengajuan yang ternyata gagal terkirim akan menghabiskan promo tanpa ada
 * satu pun calon penyewa di ujungnya, dan pemiliknya tidak punya cara
 * mengembalikannya.
 *
 * ── KENAPA RUTE INI TIDAK PUNYA SESI ──────────────────────────────────────
 * Calon penyewa mengajukan sewa TANPA login — itu keputusan yang sudah diambil
 * di jalur lead (lihat /api/leads/click) dan mengubahnya di sini saja berarti
 * voucher hanya bisa dipakai orang yang mendaftar akun lebih dulu, yang persis
 * membatalkan gunanya.
 *
 * Konsekuensinya diakui apa adanya, bukan ditutupi: rute ini bisa dipanggil
 * siapa saja. Yang dijaga karena itu bukan "siapa pemanggilnya" melainkan
 * "apa yang bisa dia ubah", lewat empat batas:
 *
 * 1. BESAR POTONGAN DIHITUNG ULANG DI SINI dari `subtotal` yang dikirim,
 *    memakai mesin yang sama dengan panel. Angka potongan dari klien tidak
 *    pernah dipercaya — kalau ia yang disimpan, laporan "promo ini menelan
 *    Rp 3 juta" bisa ditulis oleh siapa pun dengan satu permintaan.
 * 2. VOUCHERNYA HARUS BENAR-BENAR HIDUP menurut @/lib/voucher, bukan sekadar
 *    ada barisnya.
 * 3. SATU NOMOR HANYA MENGURANGI KUOTA SEKALI per voucher. Pengajuan kedua
 *    dari nomor yang sama tetap dijawab ok — pengiriman ulang karena jaringan
 *    putus tidak boleh terlihat sebagai kegagalan — tapi tidak menggerogoti
 *    jatah promo lagi.
 * 4. KUOTA DIKURANGI LEWAT UPDATE BERSYARAT, jadi jatah terakhir tidak bisa
 *    diberikan dua kali kepada dua orang yang menekan tombol bersamaan.
 *
 * Yang TIDAK dijaga di sini, dan disengaja: kebenaran `subtotal` terhadap
 * harga listing. Memeriksanya berarti menghitung ulang harga kamar, tipe, dan
 * promo listing di rute ini — salinan kedua dari logika panel yang akan
 * berselisih dengan aslinya. Catatan ini adalah catatan PROMOSI (berapa promo
 * dipakai), bukan faktur; angka rupiah yang mengikat tetap disepakati agent &
 * penyewa di tahap berikutnya.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { evaluasiVoucher, statusVoucher, type Voucher } from "@/lib/voucher";
import { isDurasiKey, type DurasiKey } from "@/lib/kosDetail";

export const dynamic = "force-dynamic";

function parseId(raw: string): bigint | null {
  const trimmed = String(raw ?? "").trim();
  if (!/^\d+$/.test(trimmed)) return null;
  try {
    return BigInt(trimmed);
  } catch {
    return null;
  }
}

/** Angka rupiah dari klien: bilangan bulat non-negatif, atau 0. */
function rupiah(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  // Dibatasi supaya satu permintaan iseng tidak bisa menulis angka yang
  // membuat seluruh laporan pemilik tidak terbaca.
  return Math.min(Math.floor(n), 100_000_000_000);
}

/** Nomor telepon → bentuk baku untuk pembanding "sudah pernah dipakai". */
function normalTelepon(raw: unknown): string | null {
  const digit = String(raw ?? "").replace(/\D/g, "");
  if (digit.length < 7) return null;
  // 08xx dan +628xx adalah nomor yang sama; menyimpannya dalam dua bentuk
  // berarti batas "satu nomor sekali" bisa dilewati hanya dengan mengetik
  // nomor sendiri dengan awalan yang berbeda.
  return digit.startsWith("0") ? `62${digit.slice(1)}` : digit;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const idProperty = parseId(params.id);
    if (idProperty === null) {
      return NextResponse.json({ error: "Id listing tidak valid." }, { status: 400 });
    }

    const body = await request.json().catch(() => null);

    const kode = String(body?.kode ?? "").trim().toUpperCase();
    if (!kode) {
      return NextResponse.json({ error: "Kode voucher wajib diisi." }, { status: 400 });
    }

    const durasiMentah = body?.durasi;
    const durasi: DurasiKey | null = isDurasiKey(durasiMentah) ? durasiMentah : null;
    const lamaAngka = Number(body?.lama);
    const lama =
      Number.isFinite(lamaAngka) && lamaAngka >= 1 ? Math.floor(lamaAngka) : null;
    const subtotal = rupiah(body?.subtotal);
    const telepon = normalTelepon(body?.telepon);
    const nama = String(body?.nama ?? "").trim().slice(0, 160) || null;
    // Tipe kamar ikut dinilai: tanpa ini, voucher yang dibatasi ke satu tipe
    // selalu dihitung 0 di sini walau penyewa memang memilih tipe yang benar —
    // kuotanya berkurang, tapi riwayatnya mencatat potongan nol, dan laporan
    // "promo ini menelan berapa" jadi bohong ke arah yang salah.
    const idTipeMentah = String(body?.idTipe ?? "").trim();
    const idTipe = /^\d+$/.test(idTipeMentah) ? idTipeMentah : null;

    const row = await prisma.listingVoucher.findFirst({
      where: { id_property: idProperty, kode },
      select: {
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
      },
    });

    // Sebab kegagalan sengaja tidak dirinci ke klien di sini: pemakaian dicatat
    // di latar setelah pengajuan berhasil, jadi pesan sedetail apa pun tidak
    // akan dibaca siapa pun — sementara "voucher X memang ada tapi kuotanya
    // habis" adalah keterangan yang tidak perlu diberikan kepada penebak kode.
    if (!row) {
      return NextResponse.json(
        { ok: false, error: "Voucher tidak ditemukan." },
        { status: 404 },
      );
    }

    const view: Voucher = {
      id: row.id.toString(),
      kode: row.kode,
      nama: row.nama,
      deskripsi: row.deskripsi ?? "",
      jenis: row.jenis,
      nilai: Number(row.nilai),
      potonganMaks: row.potongan_maks != null ? Number(row.potongan_maks) : null,
      minTransaksi: row.min_transaksi != null ? Number(row.min_transaksi) : null,
      durasiBerlaku: row.durasi_berlaku.length
        ? (row.durasi_berlaku.filter(isDurasiKey) as DurasiKey[])
        : null,
      tipeBerlaku: row.tipe_berlaku.length
        ? row.tipe_berlaku.map((t) => t.toString())
        : null,
      lamaMin: row.lama_min,
      berlakuMulai: row.berlaku_mulai
        ? row.berlaku_mulai.toISOString().slice(0, 10)
        : null,
      berlakuSampai: row.berlaku_sampai
        ? row.berlaku_sampai.toISOString().slice(0, 10)
        : null,
      kuotaTotal: row.kuota_total,
      kuotaTerpakai: row.kuota_terpakai ?? 0,
      aktif: row.aktif,
      rahasia: row.rahasia,
    };

    const status = statusVoucher(view);
    if (!status.hidup) {
      return NextResponse.json(
        { ok: false, error: `Voucher sudah tidak berlaku (${status.label}).` },
        { status: 409 },
      );
    }

    // Potongan DIHITUNG ULANG — angka dari klien tidak ikut dibaca sama sekali.
    const hasil =
      durasi && lama
        ? evaluasiVoucher(view, {
            subtotal,
            durasi,
            lama,
            tanggalMulai: null,
            idTipe,
          })
        : null;
    const potongan = hasil?.berlaku ? hasil.potongan : 0;

    // ── Pengiriman ulang dari nomor yang sama ─────────────────────────────
    // Dijawab ok tanpa menambah apa pun. Panel memanggil rute ini sesudah lead
    // terkirim, dan pengguna yang menekan "ajukan" dua kali karena jaringan
    // lambat tidak sedang meminta dua jatah promo.
    if (telepon) {
      const pernah = await prisma.listingVoucherPakai.findFirst({
        where: { id_voucher: row.id, telepon_klien: telepon },
        select: { id: true },
      });
      if (pernah) {
        return NextResponse.json({ ok: true, dicatat: false, alasan: "SUDAH_PERNAH" });
      }
    }

    // ── Pengurangan kuota ─────────────────────────────────────────────────
    // Syarat kuota ada DI DALAM WHERE, bukan diperiksa lebih dulu dengan
    // SELECT. Itu yang membuat jatah terakhir tidak bisa diberikan dua kali
    // kepada dua orang yang menekan tombol pada detik yang sama — sesuatu yang
    // "baca lalu tulis" tidak bisa jamin tanpa mengunci seluruh tabel.
    const terpakai = await prisma.$executeRaw`
      UPDATE listing_voucher
      SET kuota_terpakai = kuota_terpakai + 1
      WHERE id = ${row.id}
        AND aktif = TRUE
        AND (kuota_total IS NULL OR kuota_terpakai < kuota_total)
    `;

    if (terpakai === 0) {
      return NextResponse.json(
        { ok: false, error: "Kuota voucher sudah habis." },
        { status: 409 },
      );
    }

    // Barisnya ditulis SESUDAH counter naik. Kalau penulisan ini gagal, yang
    // hilang cuma satu baris riwayat sementara kuotanya sudah benar-benar
    // dipakai — kebalikannya (riwayat ada, kuota tidak berkurang) akan membuat
    // promo bisa dipakai melebihi batas yang dianggarkan pemilik.
    await prisma.listingVoucherPakai.create({
      data: {
        id_voucher: row.id,
        id_property: idProperty,
        kode: row.kode,
        nama_klien: nama,
        telepon_klien: telepon,
        subtotal: BigInt(subtotal),
        potongan: BigInt(potongan),
        durasi: durasi ?? undefined,
        lama,
      },
    });

    return NextResponse.json({ ok: true, dicatat: true, potongan });
  } catch (error) {
    console.error("❌ /api/listings/[id]/voucher/pakai POST error:", error);
    return NextResponse.json(
      {
        error: "Internal error",
        ...(process.env.NODE_ENV === "production"
          ? {}
          : { detail: error instanceof Error ? error.message : String(error) }),
      },
      { status: 500 },
    );
  }
}
