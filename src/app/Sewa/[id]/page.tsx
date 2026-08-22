/**
 * Detail listing SEWA — /Sewa/{slug}-{id_property}
 *
 * Bentuk URL-nya sama persis dengan Jual & Lelang (slug diakhiri id_property)
 * supaya satu fungsi pembuat URL di card listing melayani ketiganya, dan link
 * lama tetap hidup saat judul (dan karenanya slug) diubah agent — id di ujung
 * yang jadi pegangan, slug di depannya hanya untuk mesin pencari & manusia.
 */

import React, { cache } from "react";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";
import { bacaSekitarTersimpan } from "@/lib/nearbyPlaces.server";
import {
  DURASI_META,
  DURASI_URUT,
  formatRupiah,
  gabungFasilitas,
  isDurasiKey,
  parseFasilitas,
  type AksesTerdekat,
  type DurasiKey,
  type TipeKamarView,
} from "@/lib/kosDetail";
import {
  horizonKetersediaan,
  kunciDariDbDate,
  kunciHariIni,
  sisaPadaTanggal,
  type BlokirView,
  type InventarisView,
} from "@/lib/sewaAvailability";
import { durasiSewaSah, kapabilitasSewa } from "@/lib/sewaKapabilitas";
import DetailClient from "./DetailClient";
import { SURFACE } from "./components/sewaTheme";
import { getSimilarSewa } from "./lib/similar";
import type {
  BiayaTambahanView,
  KetersediaanPublik,
  ModelInventaris,
  SewaDetailData,
} from "./types";
import { TIPE_UNIT_LABEL } from "@/app/tambah-property/types/listing";

interface Props {
  params: { id: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** "kos-mewah-dharmahusada-121827" → 121827n */
function extractIdProperty(slugWithId: string): bigint | null {
  const last = slugWithId.split("-").pop();
  if (!last || !/^\d+$/.test(last)) return null;
  try {
    return BigInt(last);
  } catch {
    return null;
  }
}

const angka = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number(v);

/**
 * Kolom `gambar` menyimpan CSV — bisa berisi URL penuh (hasil form) atau file
 * id Google Drive telanjang (data lama/impor). Keduanya dinormalkan ke URL
 * supaya komponen gambar tidak perlu tahu asal-usulnya.
 */
function buildFotoList(gambar: string | null): string[] {
  if (!gambar || gambar.trim() === "") return [];
  return gambar
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) =>
      s.startsWith("http://") || s.startsWith("https://") || s.startsWith("/")
        ? s
        : `https://drive.google.com/thumbnail?id=${s}&sz=w1600`,
    );
}

function normalizeAgentPhoto(v: string | null | undefined): string {
  if (!v || v.trim() === "") return "";
  const t = v.trim();
  if (t.startsWith("http://") || t.startsWith("https://") || t.startsWith("/")) {
    return t;
  }
  return `https://drive.google.com/thumbnail?id=${t}&sz=w200`;
}

// ─────────────────────────────────────────────────────────────────────────────
// DB
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `cache` supaya generateMetadata & komponen halaman berbagi satu query —
 * keduanya dijalankan Next di request yang sama.
 */
const getListing = cache(async (id: bigint) => {
  const listing = await prisma.listing.findUnique({
    where: { id_property: id },
    include: {
      sewaDetail: true,
      // Urutan tipe adalah urutan yang disusun agent di wizard; `id` jadi
      // pemutus supaya dua tipe dengan urutan sama tidak bertukar posisi
      // antar-request (Postgres tidak menjamin urutan tanpa ORDER BY).
      kamarTipe: { orderBy: [{ urutan: "asc" }, { id: "asc" }] },
      // SEMUA blok, bukan hanya yang di dalam horizon: blok terbuka bisa mulai
      // jauh di masa lalu dan tetap menentukan sisa kamar hari ini. Memfilter
      // di SQL justru membuang baris yang paling menentukan. Jumlahnya puluhan.
      ketersediaan: {
        select: {
          id: true,
          id_tipe: true,
          tanggal_mulai: true,
          tanggal_selesai: true,
          jumlah_kamar: true,
        },
        orderBy: [{ tanggal_mulai: "asc" }, { id: "asc" }],
      },
      agent: {
        select: {
          id_agent: true,
          nama_kantor: true,
          jabatan: true,
          kota_area: true,
          rating: true,
          jumlah_closing: true,
          nomor_whatsapp: true,
          foto_profil_url: true,
          tanggal_gabung: true,
          pengguna: { select: { nama_lengkap: true, nomor_telepon: true } },
        },
      },
    },
  });

  if (!listing) return null;
  if (listing.jenis_transaksi !== "SEWA") return null;
  // Listing yang ditarik agent tidak boleh lagi punya halaman publik — tapi
  // yang sudah TERJUAL/tersewa tetap tampil (dengan penanda) karena link-nya
  // sudah beredar dan halaman kosong lebih membingungkan daripada status.
  if (listing.status_tayang === "TARIK_LISTING") return null;

  return listing;
});

/** Harga per durasi dari kolom listing_sewa_detail (Decimal → number). */
/**
 * Harga per durasi dari baris DB, DISARING terhadap kategori.
 *
 * Penyaringan di sisi baca ini adalah lapis terakhir dan yang paling murah:
 * jalur tulis sudah tidak bisa lagi menyimpan durasi terlarang, tapi baris yang
 * ditulis SEBELUM aturan ini ada masih memegang angkanya. Tanpa saringan di
 * sini, satu gudang lama dengan tarif harian akan menampilkan tab "Harian" di
 * halaman detail — lengkap dengan kalkulasi total yang tidak pernah dimaksudkan
 * pemiliknya. Skrip pembersih di prisma/migration_sewa_durasi_kategori.sql
 * merapikan datanya; baris ini yang membuat halaman aman bahkan sebelum skrip
 * itu dijalankan di sebuah environment.
 */
function hargaDurasiDariDetail(
  detail: { [k: string]: unknown } | null,
  kategori: string,
): Partial<Record<DurasiKey, number>> {
  const out: Partial<Record<DurasiKey, number>> = {};
  if (!detail) return out;
  for (const d of DURASI_URUT) {
    if (!durasiSewaSah(kategori, d)) continue;
    const v = angka(detail[DURASI_META[d].field]);
    if (v && v > 0) out[d] = v;
  }
  return out;
}

/**
 * Susun view model tipe kamar.
 *
 * Fasilitas tiap tipe = fasilitas khas tipe itu + fasilitas yang berlaku di
 * SEMUA tipe (kolom fasilitas_kamar di listing_sewa_detail, yang isinya irisan
 * antar tipe — lihat fasilitasKamarSeragam di kosRoomTypes.ts). Digabung di
 * sini supaya kartu tipe menampilkan kenyataan lengkap: penghuni tidak peduli
 * fasilitasnya tercatat di baris mana, dia hanya ingin tahu isi kamarnya.
 */
function buildTipeKamar(
  rows: any[],
  fasilitasSemuaTipe: ReturnType<typeof parseFasilitas>,
  sisaHariIni: (idTipe: string | null) => number | null,
): TipeKamarView[] {
  return rows.map((t) => {
    const harga: Partial<Record<DurasiKey, number>> = {};
    for (const d of DURASI_URUT) {
      const v = angka(t[DURASI_META[d].field]);
      if (v && v > 0) harga[d] = v;
    }

    return {
      id: String(t.id),
      nama: t.nama,
      jumlahKamar: t.jumlah_kamar ?? 0,
      // DIHITUNG dari listing_ketersediaan, bukan dibaca dari kolom
      // t.kamar_tersedia. Kolom itu cache untuk kartu daftar yang disegarkan
      // cron harian; halaman detail memakai sumber aslinya supaya cron yang
      // terlewat tidak pernah membuat panel booking berbohong.
      kamarTersedia: sisaHariIni(String(t.id)) ?? t.kamar_tersedia ?? 0,
      luasKamar: angka(t.luas_kamar),
      kamarMandiTipe: t.kamar_mandi_tipe ?? null,
      kapasitasPenghuni: t.kapasitas_penghuni ?? null,
      lantaiKamar: t.lantai_kamar ?? null,
      nomorKamar: t.nomor_kamar ?? null,
      // Foto per tipe. Kolom `gambar` di listing_kamar_tipe BELUM ada saat baris
      // ini ditulis — form tambah/edit properti belum memintanya — jadi hasilnya
      // masih [] dan kartu tipe menampilkan penampung foto yang kosong. Begitu
      // kolomnya ditambahkan, baris ini tidak perlu diubah: query kamarTipe
      // mengambil seluruh kolom (tanpa `select`), dan formatnya disamakan
      // dengan Listing.gambar supaya satu parser saja yang dipakai.
      foto: buildFotoList(t.gambar ?? null),
      harga,
      fasilitas: gabungFasilitas(
        parseFasilitas(t.fasilitas_kamar),
        fasilitasSemuaTipe,
      ),
      catatan: t.catatan ?? null,
    };
  });
}

/**
 * Biaya tambahan datang dari kolom JSONB, jadi bentuknya tidak dijamin oleh
 * tipe apa pun — baris yang tidak berbentuk objek atau tanpa nama dibuang di
 * sini supaya komponen di bawah tidak perlu lagi berjaga-jaga.
 */
function buildBiayaTambahan(raw: unknown): BiayaTambahanView[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((b): b is Record<string, unknown> => !!b && typeof b === "object")
    .map((b) => ({
      nama: String(b.nama ?? "").trim(),
      nominal: angka(b.nominal),
      periode:
        b.periode === "SEKALI" || b.periode === "TAHUNAN"
          ? (b.periode as "SEKALI" | "TAHUNAN")
          : ("BULANAN" as const),
    }))
    .filter((b) => b.nama.length > 0);
}

/**
 * Kantong kapasitas listing ini. Bentuknya sengaja sama persis dengan yang
 * dipakai API tulis (`sewa-availability-write.ts`) — kalau keduanya menyusun
 * inventaris dengan aturan sendiri, panel penyewa dan validator server akan
 * berselisih tepat pada listing yang datanya paling tidak rapi.
 */
function buildInventaris(
  listing: any,
  modelInventaris: ModelInventaris,
): InventarisView[] {
  // Apartemen/rumah disewakan utuh: kapasitasnya 1 unit, bukan jumlah kamar
  // tidurnya.
  if (modelInventaris === "UNIT") return [{ idTipe: null, totalKamar: 1 }];

  if (listing.kamarTipe?.length > 0) {
    return listing.kamarTipe.map((t: any) => ({
      idTipe: String(t.id),
      totalKamar: t.jumlah_kamar ?? 0,
    }));
  }

  // Kos seragam yang kapasitasnya BELUM diisi tidak menghasilkan kantong sama
  // sekali — dan itu disengaja. Menebaknya 1 akan membuat halaman menyatakan
  // "sisa 1 kamar" untuk gedung yang jumlah kamarnya belum pernah dicatat;
  // menebaknya 0 akan menyatakannya penuh. Keduanya mengarang. Daftar kosong
  // berarti "tidak diketahui", dan semua pemakainya tahu artinya: jangan
  // tampilkan angka, jangan coret tanggal apa pun.
  const total = listing.sewaDetail?.total_kamar;
  return total == null ? [] : [{ idTipe: null, totalKamar: total }];
}

/**
 * Baris DB → blok siap kirim ke browser.
 *
 * `kunciDariDbDate` (getter UTC), BUKAN `kunciDariKalender`: kolomnya
 * `@db.Date` dan Prisma mengembalikannya pada tengah malam UTC. Memakai getter
 * lokal di sini akan memundurkan setiap tanggal satu hari pada server yang
 * berjalan di zona waktu barat.
 */
function buildBlok(rows: any[]): BlokirView[] {
  return (rows ?? []).map((r) => ({
    id: String(r.id),
    idTipe: r.id_tipe === null || r.id_tipe === undefined ? null : String(r.id_tipe),
    mulai: kunciDariDbDate(r.tanggal_mulai),
    selesai: r.tanggal_selesai ? kunciDariDbDate(r.tanggal_selesai) : null,
    jumlahKamar: r.jumlah_kamar ?? 1,
    // `alasan` & `catatan` sengaja tidak diambil sama sekali — bukan sekadar
    // tidak dirender. Data yang tidak pernah masuk ke payload tidak bisa bocor
    // lewat "view source".
  }));
}

function serialize(listing: any): SewaDetailData {
  const detail = listing.sewaDetail;
  const fasilitasKamar = parseFasilitas(detail?.fasilitas_kamar);

  // Bentuk inventaris & bentuk transaksi sama-sama dibaca dari tabel
  // kapabilitas — bukan dari `kategori === "KOS"` yang dulu ditulis di sini
  // sebagai salinan kelima dari aturan yang sama.
  const kapabilitas = kapabilitasSewa(listing.kategori);
  const modelInventaris: ModelInventaris = kapabilitas.inventaris;
  const inventaris = buildInventaris(listing, modelInventaris);
  const blok = buildBlok(listing.ketersediaan);
  const hariIni = kunciHariIni();

  const sisaHariIni = (idTipe: string | null): number | null => {
    const inv = inventaris.find((i) => i.idTipe === idTipe);
    return inv ? sisaPadaTanggal(inv, blok, hariIni) : null;
  };

  const tipeKamar = buildTipeKamar(listing.kamarTipe ?? [], fasilitasKamar, sisaHariIni);

  /**
   * Sisa kamar tingkat listing. Untuk UNIT sengaja null: `PropertyCard` &
   * halaman ini hanya menampilkan angka kamar bila kos, dan "sisa 1 kamar"
   * pada sebuah apartemen adalah kalimat yang tidak punya arti.
   */
  const kamarTersedia =
    modelInventaris !== "KAMAR"
      ? null
      : tipeKamar.length > 0
        ? tipeKamar.reduce((n, t) => n + t.kamarTersedia, 0)
        : sisaHariIni(null);

  const hargaDurasi = hargaDurasiDariDetail(detail, listing.kategori);

  /**
   * Durasi utama harus SAH untuk kategorinya DAN benar-benar punya harga.
   *
   * Dua syarat, bukan satu: baris lama bisa menunjuk durasi yang barusan
   * disaring keluar, dan panel pemesanan memakai nilai ini sebagai tab yang
   * terpilih saat halaman dibuka. Menunjuk tab yang tidak ada membuat panel
   * membuka diri dalam keadaan yang tidak bisa dicapai lewat klik mana pun.
   */
  const durasiUtama: DurasiKey | null =
    isDurasiKey(detail?.durasi_sewa) &&
    durasiSewaSah(listing.kategori, detail.durasi_sewa) &&
    hargaDurasi[detail.durasi_sewa as DurasiKey] != null
      ? (detail.durasi_sewa as DurasiKey)
      : (DURASI_URUT.find((d) => hargaDurasi[d] != null) ?? null);

  return {
    idProperty: String(listing.id_property),
    slug: listing.slug,
    slugId: `${listing.slug}-${listing.id_property}`,
    judul: listing.judul,
    deskripsi: listing.deskripsi ?? null,
    kategori: listing.kategori,
    statusTayang: listing.status_tayang,
    isKos: listing.kategori === "KOS",
    modelInventaris,
    /**
     * Bentuk transaksi halaman ini. BOOKING → panel pemesanan (tanggal,
     * voucher, "Ajukan Sewa"); NEGOSIASI → panel kontak (chat, penawaran,
     * survei), sama seperti halaman detail Jual & Lelang.
     *
     * Dikirim sebagai data, bukan dihitung ulang di klien: DetailClient sudah
     * memegang `kategori`, tapi membiarkan tiap komponen menyimpulkan sendiri
     * adalah persis kebiasaan yang melahirkan lima salinan aturan di repo ini.
     */
    modeSewa: kapabilitas.mode,
    dilihat: listing.dilihat ?? 0,

    alamat: listing.alamat_lengkap ?? null,
    kota: listing.kota,
    kecamatan: listing.kecamatan ?? null,
    kelurahan: listing.kelurahan ?? null,
    provinsi: listing.provinsi ?? null,
    latitude: angka(listing.latitude),
    longitude: angka(listing.longitude),
    aksesTerdekat: Array.isArray(listing.akses_terdekat)
      ? (listing.akses_terdekat as AksesTerdekat[]).filter((a) => a?.nama)
      : [],

    fotoList: buildFotoList(listing.gambar),

    harga: Number(listing.harga ?? 0),
    hargaPromo:
      listing.harga_promo != null && Number(listing.harga_promo) > 0
        ? Number(listing.harga_promo)
        : null,
    durasiUtama,
    hargaDurasi,

    namaGedung: detail?.nama_gedung ?? null,
    lantaiUnit: detail?.lantai_unit ?? null,
    nomorUnit: detail?.nomor_unit ?? null,
    // Label pasar ("2BR"), bukan nilai enumnya ("DUA_KAMAR") — komponen di
    // bawah tidak perlu tahu bentuk penyimpanannya.
    tipeUnit: detail?.tipe_unit
      ? TIPE_UNIT_LABEL[detail.tipe_unit as keyof typeof TIPE_UNIT_LABEL] ?? null
      : null,

    deposit: angka(detail?.deposit),
    minimalSewaJumlah: detail?.minimal_sewa_jumlah ?? null,
    minimalSewaSatuan: isDurasiKey(detail?.minimal_sewa_satuan)
      ? detail.minimal_sewa_satuan
      : null,
    termasukListrik: detail?.termasuk_listrik ?? null,
    termasukAir: detail?.termasuk_air ?? null,
    akses24Jam: detail?.akses_24_jam ?? null,
    jamMalam: detail?.jam_malam ?? null,
    jamCheckIn: detail?.jam_check_in ?? null,
    jamCheckOut: detail?.jam_check_out ?? null,
    biayaTambahan: buildBiayaTambahan(detail?.biaya_tambahan),

    luasBangunan: angka(listing.luas_bangunan),
    kamarTidur: listing.kamar_tidur ?? null,
    kamarMandi: listing.kamar_mandi ?? null,
    kondisiInterior: listing.kondisi_interior ?? null,

    luasKamar: angka(detail?.luas_kamar),
    kamarMandiTipe: detail?.kamar_mandi_tipe ?? null,
    kapasitasPenghuni: detail?.kapasitas_penghuni ?? null,
    totalKamar: detail?.total_kamar ?? null,
    kamarTersedia,
    kosGender: detail?.kos_gender ?? null,

    fasilitasKamar,
    fasilitasBersama: parseFasilitas(detail?.fasilitas_bersama),
    peraturan: parseFasilitas(detail?.peraturan),

    tipeKamar,

    ketersediaan: {
      inventaris,
      blok,
      horizonSampai: horizonKetersediaan(hariIni).sampai,
    } satisfies KetersediaanPublik,

    agent: {
      idAgent: listing.agent?.id_agent ?? listing.id_agent,
      nama: listing.agent?.pengguna?.nama_lengkap || "Agent Solusindo",
      kantor: listing.agent?.nama_kantor || "Solusindo Aset",
      jabatan: listing.agent?.jabatan || "AGENT",
      kotaArea: listing.agent?.kota_area || listing.kota,
      foto: normalizeAgentPhoto(listing.agent?.foto_profil_url),
      telepon:
        listing.agent?.nomor_whatsapp ||
        listing.agent?.pengguna?.nomor_telepon ||
        "",
      rating: listing.agent?.rating != null ? Number(listing.agent.rating) : 0,
      jumlahClosing: listing.agent?.jumlah_closing ?? 0,
      tahunGabung: listing.agent?.tanggal_gabung
        ? String(new Date(listing.agent.tanggal_gabung).getFullYear())
        : null,
    },

    tanggalDiupdate: listing.tanggal_diupdate
      ? listing.tanggal_diupdate.toISOString()
      : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// METADATA
// ─────────────────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = extractIdProperty(params.id);
  const listing = id ? await getListing(id) : null;

  if (!listing) {
    return {
      title: "Properti Sewa Tidak Ditemukan | Solusindo Aset",
      description: "Halaman properti sewa yang Anda cari tidak ditemukan.",
    };
  }

  const data = serialize(listing);
  const durasi = data.durasiUtama ?? "BULANAN";
  const hargaLabel = `${formatRupiah(
    data.hargaDurasi[durasi] ?? data.harga,
  )}${DURASI_META[durasi].suffix}`;

  const lokasi = [data.kelurahan, data.kecamatan, data.kota]
    .filter(Boolean)
    .join(", ");

  const ringkas = [
    data.tipeKamar.length > 1 ? `${data.tipeKamar.length} tipe kamar` : null,
    data.kamarTersedia != null ? `${data.kamarTersedia} kamar tersedia` : null,
    data.kosGender ? `kos ${data.kosGender.toLowerCase()}` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  const description =
    data.deskripsi?.replace(/\s+/g, " ").slice(0, 155).concat("…") ||
    `Sewa ${data.kategori.toLowerCase()} di ${lokasi} mulai ${hargaLabel}. ${ringkas}.`;

  const canonical = `${SITE_URL}/Sewa/${data.slugId}`;
  const gambar = data.fotoList[0] || "/images/hero/banner.jpg";
  const tayang = data.statusTayang === "TERSEDIA";

  return {
    title: `${data.judul} — ${hargaLabel} | Solusindo Aset`,
    description,
    keywords: [
      `sewa ${data.kategori.toLowerCase()}`,
      `kos ${data.kota}`,
      data.kecamatan || "",
      data.kelurahan || "",
      "kos murah",
      "sewa kamar",
      data.agent.nama,
    ].filter(Boolean),
    openGraph: {
      type: "website",
      locale: "id_ID",
      url: canonical,
      siteName: "Solusindo Aset",
      title: `${data.judul} — ${hargaLabel}`,
      description,
      images: [{ url: gambar, width: 1200, height: 630, alt: data.judul }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${data.judul} — ${hargaLabel}`,
      description,
      images: [gambar],
    },
    robots: {
      index: tayang,
      follow: true,
      googleBot: { index: tayang, follow: true, "max-image-preview": "large" },
    },
    alternates: { canonical },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default async function SewaDetailPage({ params }: Props) {
  const id = extractIdProperty(params.id);
  if (!id) notFound();

  const listing = await getListing(id);
  if (!listing) notFound();

  // Self-healing URL: judul (dan slug) bisa diubah agent, sementara link lama
  // sudah tersebar di WhatsApp. Redirect permanen ke slug terbaru menjaga satu
  // URL kanonik untuk mesin pencari tanpa mematikan link yang sudah dibagikan.
  //
  // `permanentRedirect` (HTTP 308), BUKAN `redirect` (HTTP 307). Bedanya
  // menentukan seluruh gunanya baris ini bagi SEO: 307 memberi tahu Google
  // "URL lama masih yang benar, ini cuma pengalihan sementara", sehingga URL
  // gibberish lama tetap dipertahankan di indeks dan peringkat tidak pernah
  // pindah ke URL baru. 308 menyatakan perpindahannya tetap, dan sinyal
  // peringkat ikut dialihkan.
  const slugId = `${listing.slug}-${listing.id_property}`;
  if (params.id !== slugId) permanentRedirect(`/Sewa/${slugId}`);

  const data = serialize(listing);
  const similar = await getSimilarSewa(listing);

  // Hasil pemindaian "apa yang ada di sekitar" yang SUDAH tersimpan. Dibaca di
  // sini (bukan di browser) supaya kos yang pernah dibuka orang lain tampil
  // lengkap seketika; yang belum pernah dipindai mengembalikan null dan
  // DetailInfo yang meminta pemindaian lewat /api/listing/{id}/sekitar —
  // sekali, lalu tersimpan untuk semua pengunjung berikutnya.
  const sekitar = await bacaSekitarTersimpan(listing.id_property);

  const canonical = `${SITE_URL}/Sewa/${slugId}`;
  const durasi = data.durasiUtama ?? "BULANAN";
  const hargaTampil = data.hargaDurasi[durasi] ?? data.harga;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Accommodation",
    "@id": canonical,
    url: canonical,
    name: data.judul,
    description: data.deskripsi || `Sewa ${data.kategori} di ${data.kota}`,
    image: data.fotoList.slice(0, 6),
    address: {
      "@type": "PostalAddress",
      streetAddress: data.alamat || undefined,
      addressLocality: data.kecamatan || data.kota,
      addressRegion: data.provinsi || undefined,
      addressCountry: "ID",
    },
    ...(data.latitude && data.longitude
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: data.latitude,
            longitude: data.longitude,
          },
        }
      : {}),
    numberOfRooms: data.totalKamar || undefined,
    amenityFeature: [...data.fasilitasKamar, ...data.fasilitasBersama].map(
      (f) => ({
        "@type": "LocationFeatureSpecification",
        name: f.label,
        value: true,
      }),
    ),
    offers: {
      "@type": "Offer",
      price: hargaTampil,
      priceCurrency: "IDR",
      availability:
        data.statusTayang === "TERSEDIA" && (data.kamarTersedia ?? 1) > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/SoldOut",
      url: canonical,
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Sewa", item: `${SITE_URL}/Sewa` },
      {
        "@type": "ListItem",
        position: 3,
        name: data.kota,
        item: `${SITE_URL}/Sewa?kota=${encodeURIComponent(data.kota)}`,
      },
      { "@type": "ListItem", position: 4, name: data.judul, item: canonical },
    ],
  };

  return (
    <main
      className="min-h-screen text-white"
      style={{ background: SURFACE.canvas }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <DetailClient data={{ ...data, sekitar }} similar={similar} />
    </main>
  );
}
