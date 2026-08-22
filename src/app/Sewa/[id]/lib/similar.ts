/**
 * Rekomendasi "Kos Serupa" untuk halaman detail sewa.
 *
 * Bobotnya sengaja berbeda dari versi Jual ([Jual]/[slug]/lib/similar.ts).
 * Pembeli rumah membandingkan luas tanah & jumlah kamar tidur; pencari kos
 * tidak — dia membandingkan JARAK ke tempat aktivitas hariannya dan harga
 * bulanannya. Karena itu:
 *
 *   • kecamatan/kelurahan bernilai jauh lebih besar daripada kota (kos beda
 *     kecamatan praktis bukan pengganti — jaraknya ke kampus berubah total),
 *   • patokan terdekat yang sama (mis. sama-sama dekat UNAIR) diberi bonus,
 *   • gender kos jadi penyaring lunak: kos putri bukan alternatif buat pencari
 *     kos putra, tapi kos campur masih bisa dilirik keduanya.
 */

import prisma from "@/lib/prisma";
import {
  DURASI_META,
  DURASI_URUT,
  isDurasiKey,
  type AksesTerdekat,
  type DurasiKey,
} from "@/lib/kosDetail";
import type { SewaSimilarItem } from "../types";

const MAX_HASIL = 10;
/** Ambang relevansi: kota sama + kategori sama ≈ 50. */
const RELEVANSI_MIN = 45;

function normLoc(s?: string | null): string {
  return (s ?? "")
    .toString()
    .toLowerCase()
    .replace(/^(kota|kab\.?|kabupaten|kotamadya|kec\.?|kecamatan)\s+/, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function kotaTerm(s?: string | null): string {
  return (s ?? "")
    .toString()
    .toLowerCase()
    .replace(/^(kota|kab\.?|kabupaten|kotamadya)\s+/i, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

/**
 * Seluruh foto listing, bukan hanya yang pertama — kartu bersama punya slider,
 * jadi mengirim satu foto saja akan mematikan sliderrnya khusus di blok ini dan
 * kartunya jadi terasa berbeda dari yang di halaman daftar.
 *
 * Aturan penerjemahannya harus sama dengan `normalizeListingImages` di
 * /Sewa/page.tsx: ID Google Drive telanjang diubah jadi URL thumbnail, URL
 * yang sudah utuh dibiarkan.
 */
function fotoListing(gambar: string | null): string[] {
  return (gambar ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) =>
      s.startsWith("http://") || s.startsWith("https://") || s.startsWith("/")
        ? s
        : `https://drive.google.com/thumbnail?id=${s}`,
    );
}

/** Sama dengan `normalizeAgentPhoto` di /Sewa/page.tsx. */
function fotoAgent(fileId: string | null | undefined): string {
  const trimmed = (fileId ?? "").trim();
  if (!trimmed) return "/images/default-profile.png";
  return trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/")
    ? trimmed
    : `https://drive.google.com/thumbnail?id=${trimmed}`;
}

const asAkses = (v: unknown): AksesTerdekat[] =>
  Array.isArray(v) ? (v as AksesTerdekat[]).filter((a) => a?.nama) : [];

/** Harga pada durasi yang sama dengan listing yang sedang dibuka. */
function hargaPadaDurasi(
  detail: any,
  durasi: DurasiKey | null,
): { harga: number; durasi: DurasiKey | null } {
  if (durasi) {
    const v = Number(detail?.[DURASI_META[durasi].field] ?? 0);
    if (v > 0) return { harga: v, durasi };
  }
  for (const d of DURASI_URUT) {
    const v = Number(detail?.[DURASI_META[d].field] ?? 0);
    if (v > 0) return { harga: v, durasi: d };
  }
  return { harga: 0, durasi: null };
}

export async function getSimilarSewa(current: any): Promise<SewaSimilarItem[]> {
  try {
    const curId = BigInt(String(current.id_property));
    const durasiAcuan: DurasiKey | null = isDurasiKey(
      current.sewaDetail?.durasi_sewa,
    )
      ? current.sewaDetail.durasi_sewa
      : null;

    const baseWhere = {
      id_property: { not: curId },
      jenis_transaksi: "SEWA" as const,
      status_tayang: "TERSEDIA" as const,
      kategori: current.kategori,
    };

    // Agent ikut diambil karena kartu bersama menampilkan footer agent —
    // tanpa ini kartunya tampil dengan nama & foto kosong, dan justru itu yang
    // membuatnya terlihat beda dari kartu di halaman daftar.
    const include = {
      agent: {
        select: {
          nama_kantor: true,
          foto_profil_url: true,
          pengguna: { select: { nama_lengkap: true } },
        },
      },
      sewaDetail: true,
      _count: { select: { kamarTipe: true } },
    } as const;

    const term = kotaTerm(current.kota);
    let pool = term
      ? await prisma.listing.findMany({
          where: { ...baseWhere, kota: { contains: term, mode: "insensitive" } },
          include,
          take: 40,
          orderBy: [{ is_hot_deal: "desc" }, { tanggal_dibuat: "desc" }],
        })
      : [];

    // Kota sepi → melebar ke provinsi. Tetap dilewatkan ambang relevansi di
    // bawah, jadi hasilnya bukan "asal ada" melainkan yang memang masih dekat.
    if (pool.length < 6 && current.provinsi) {
      const more = await prisma.listing.findMany({
        where: {
          ...baseWhere,
          provinsi: { contains: String(current.provinsi), mode: "insensitive" },
        },
        include,
        take: 30,
        orderBy: [{ is_hot_deal: "desc" }, { tanggal_dibuat: "desc" }],
      });
      const seen = new Set(pool.map((p) => String(p.id_property)));
      pool = [...pool, ...more.filter((m) => !seen.has(String(m.id_property)))];
    }

    const acuan = hargaPadaDurasi(current.sewaDetail, durasiAcuan);
    const curKec = normLoc(current.kecamatan);
    const curKel = normLoc(current.kelurahan);
    const curKota = normLoc(current.kota);
    const curGender = current.sewaDetail?.kos_gender ?? null;
    const curAkses = new Set(
      asAkses(current.akses_terdekat).map((a) => normLoc(a.nama)),
    );

    const dinilai = pool.map((c) => {
      let skor = 20; // kategori sama (hard filter)

      const cKec = normLoc(c.kecamatan);
      const cKel = normLoc(c.kelurahan);
      if (curKel && cKel && cKel === curKel) skor += 50;
      else if (curKec && cKec && cKec === curKec) skor += 40;
      else if (curKota && normLoc(c.kota) === curKota) skor += 25;

      // Patokan yang sama = benar-benar melayani kebutuhan yang sama.
      const samaAkses = asAkses(c.akses_terdekat).filter((a) =>
        curAkses.has(normLoc(a.nama)),
      ).length;
      skor += Math.min(15, samaAkses * 8);

      const cHarga = hargaPadaDurasi(c.sewaDetail, durasiAcuan);
      if (acuan.harga > 0 && cHarga.harga > 0) {
        const beda = Math.abs(cHarga.harga - acuan.harga) / acuan.harga;
        skor += Math.max(0, 22 * (1 - beda / 0.6));
      }

      const cGender = c.sewaDetail?.kos_gender ?? null;
      if (curGender && cGender) {
        if (cGender === curGender) skor += 10;
        else if (cGender === "CAMPUR" || curGender === "CAMPUR") skor += 4;
        else skor -= 12; // putra vs putri: bukan alternatif
      }

      if ((c.sewaDetail?.kamar_tersedia ?? 1) > 0) skor += 5;
      if (c.is_hot_deal) skor += 4;

      return { c, skor, harga: cHarga };
    });

    return dinilai
      .filter((s) => s.skor >= RELEVANSI_MIN)
      .sort((a, b) => b.skor - a.skor)
      .slice(0, MAX_HASIL)
      // Bentuk hasilnya PropertyDB — bentuk yang dipakai kartu bersama, dan
      // disusun sama persis dengan /Sewa/page.tsx. Kalau di sini ada field yang
      // dilewatkan, kartunya akan kehilangan satu bagian (slider, Hot Deal,
      // sisa kamar, footer agent) dan tidak lagi "sangat persis".
      .map(({ c, harga }): SewaSimilarItem => {
        const fotoList = fotoListing(c.gambar);

        return {
          id_property: String(c.id_property),
          slug: c.slug,
          judul: c.judul,
          kota: c.kota,
          kecamatan: c.kecamatan,
          kelurahan: c.kelurahan,
          // Harga sengaja diambil pada DURASI YANG SAMA dengan listing yang
          // sedang dibuka (lihat hargaPadaDurasi), bukan `c.harga` mentah —
          // membandingkan "per bulan" dengan "per tahun" tidak ada gunanya.
          harga: harga.harga || Number(c.harga ?? 0),
          harga_promo: c.harga_promo != null ? Number(c.harga_promo) : null,
          jenis_transaksi: c.jenis_transaksi,
          kategori: c.kategori,
          status_tayang: c.status_tayang,
          gambar: fotoList[0] || "/images/hero/banner.jpg",
          foto_list: fotoList,
          luas_tanah: c.luas_tanah ? Number(c.luas_tanah) : 0,
          luas_bangunan: c.luas_bangunan ? Number(c.luas_bangunan) : 0,
          kamar_tidur: c.kamar_tidur ?? 0,
          kamar_mandi: c.kamar_mandi ?? 0,
          // Durasi yang dipakai menghitung `harga` di atas, supaya akhiran
          // "/bulan" di kartu cocok dengan angkanya.
          durasi_sewa: harga.durasi,
          kamar_mandi_tipe: c.sewaDetail?.kamar_mandi_tipe ?? null,
          kos_gender: c.sewaDetail?.kos_gender ?? null,
          kamar_tersedia: c.sewaDetail?.kamar_tersedia ?? null,
          tipe_unit: c.sewaDetail?.tipe_unit ?? null,
          lantai_unit: c.sewaDetail?.lantai_unit ?? null,
          kapasitas_penghuni: c.sewaDetail?.kapasitas_penghuni ?? null,
          kondisi_interior: c.kondisi_interior ?? null,
          jumlah_tipe_kamar: c._count?.kamarTipe ?? 0,
          fasilitas_kamar: c.sewaDetail?.fasilitas_kamar ?? null,
          fasilitas_bersama: c.sewaDetail?.fasilitas_bersama ?? null,
          akses_terdekat: asAkses(c.akses_terdekat),
          agent_name: c.agent?.pengguna?.nama_lengkap || "Agent Premier",
          agent_photo: fotoAgent(c.agent?.foto_profil_url),
          agent_office: c.agent?.nama_kantor || "Solusindo Aset",
          is_hot_deal: !!c.is_hot_deal,
        };
      });
  } catch (err) {
    console.error("getSimilarSewa error:", err);
    return [];
  }
}
