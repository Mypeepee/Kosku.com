import React from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { ambilLimitLelangSebelumnya } from "@/lib/auctionDiscount";
import {
  buildListingWhere,
  jadwalMenimpaSort,
  konteksDariTab,
  parseFilters,
} from "@/lib/listingFilters";
import {
  buildOrderBy,
  buildSortWhere,
  parseHalaman,
  parseSort,
  urlHalamanTerakhir,
} from "@/lib/listingSort";
import KategoriPageClient from "./KategoriPageClient";
import {
  ambilJarakKeTempat,
  buildTempatWhere,
  siapkanTempat,
  urutkanTerdekat,
} from "@/lib/listingTempatFilter";
import { KATEGORI_TO_SLUG, SLUG_TO_KATEGORI } from "./constants";

const KATEGORI_LABEL: Record<string, string> = {
  "rumah":          "Rumah",
  "apartemen":      "Apartemen",
  "ruko":           "Ruko",
  "tanah":          "Tanah",
  "gudang":         "Gudang",
  "hotel-dan-villa":"Hotel & Villa",
  "toko":           "Kios / Toko",
  "pabrik":         "Pabrik",
};

const TIPE_FOR_JENIS: Record<string, string> = {
  PRIMARY:   "jual",
  SECONDARY: "jual",
  LELANG:    "lelang",
  SEWA:      "sewa",
};

const KATEGORI_DESC: Record<string, string> = {
  "rumah":          "hunian nyaman untuk keluarga",
  "apartemen":      "hunian vertikal modern",
  "ruko":           "rumah toko dan properti bisnis",
  "tanah":          "investasi tanah strategis",
  "gudang":         "properti logistik dan penyimpanan",
  "hotel-dan-villa":"properti akomodasi dan wisata",
  "toko":           "ruang usaha dan kios ritel",
  "pabrik":         "properti industri dan produksi",
};

type Props = {
  params: { slug: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const slug = params.slug;
  const label = slug === "semua" ? "Semua Kategori" : KATEGORI_LABEL[slug];
  if (!label) return { title: "Kategori Properti | Kosku" };

  const tipe = typeof searchParams.tipe === "string" ? searchParams.tipe : undefined;
  const kota = typeof searchParams.kota === "string" ? searchParams.kota : undefined;

  const tipeLabel: Record<string, string> = {
    jual: "Dijual",
    lelang: "Lelang",
    sewa: "Disewa",
  };

  const tipeSuffix = tipe && tipeLabel[tipe] ? ` ${tipeLabel[tipe]}` : "";
  const kotaSuffix = kota ? ` di ${kota.charAt(0).toUpperCase() + kota.slice(1)}` : "";

  const title = `${label}${tipeSuffix}${kotaSuffix} - Jual, Sewa & Lelang | Kosku`;
  const description = `Temukan ${label.toLowerCase()} ${KATEGORI_DESC[slug] || ""} terbaik${kotaSuffix}. Tersedia pilihan dijual, disewa, maupun lelang dengan legalitas terjamin.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/properti/${slug}${tipe ? `?tipe=${tipe}` : ""}`,
    },
    openGraph: {
      title,
      description,
      type: "website",
    },
  };
}

// --- IMAGE HELPERS ---
function isValidImageUrl(url: string): boolean {
  if (!url || url.trim() === "") return false;
  const t = url.trim().toLowerCase();
  return t.startsWith("http://") || t.startsWith("https://") || t.startsWith("/");
}

function normalizeListingImages(raw: string | null | undefined): string[] {
  if (!raw || raw.trim() === "") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => (isValidImageUrl(s) ? s : `https://drive.google.com/thumbnail?id=${s}`));
}

function normalizeAgentPhoto(fileId: string | null | undefined): string {
  if (!fileId || fileId.trim() === "") return "/images/default-profile.png";
  const t = fileId.trim();
  if (t.startsWith("http://") || t.startsWith("https://") || t.startsWith("/")) return t;
  return `https://drive.google.com/thumbnail?id=${t}&sz=w64`;
}

// --- SERVER COMPONENT ---
export default async function KategoriPage({ params, searchParams }: Props) {
  const slug = params.slug;
  const isSemua = slug === "semua";
  const kategori = SLUG_TO_KATEGORI[slug];
  if (!kategori && !isSemua) notFound();

  const label = isSemua ? "Semua Kategori" : KATEGORI_LABEL[slug];

  // Parse searchParams.
  //
  // Seluruh kriteria dibaca lewat mesin filter bersama (@/lib/listingFilters):
  // ia yang menjinakkan angka rusak, menukar min/max yang terbalik, membuang
  // nilai enum yang tidak dikenal, dan memutuskan bidang mana yang berlaku di
  // tab ini. Sebelumnya halaman ini memarsing sendiri dan diam-diam MENGABAIKAN
  // delapan parameter yang dikirim search bar (durasi, gender, minKT, minKM,
  // lantai, kondisi, hadap, legalitas) — filternya terlihat aktif di URL tapi
  // tidak menyaring apa pun.
  const page = parseHalaman(searchParams.page);
  const tipe = typeof searchParams.tipe === "string" ? searchParams.tipe : "semua";
  const konteks = konteksDariTab(tipe);
  const filters = parseFilters(searchParams);
  const idPropertyRaw = filters.idProperty;

  // Satu titik waktu untuk seluruh permintaan. Kalau filter jadwal dan batasan
  // jadwal milik urutan masing-masing memanggil `new Date()`, lelang yang
  // jadwalnya persis di pergantian hari bisa lolos di satu klausa dan tidak di
  // klausa lain — dan `count` bisa tidak cocok dengan `findMany`.
  const sekarang = new Date();

  // Pencarian by ID: cari listing-nya dulu (tanpa filter kategori/tipe) lalu
  // arahkan ke tab & kategori yang sesuai dengan data aslinya, supaya hasil
  // pencarian selalu ketemu di tab yang benar (mis. Lelang) dari manapun
  // pencarian dilakukan (Home, Semua, Primary/Secondary, dll).
  if (idPropertyRaw) {
    const found = await prisma.listing.findFirst({
      where: { id_property: BigInt(idPropertyRaw), status_tayang: "TERSEDIA" },
      select: { kategori: true, jenis_transaksi: true },
    });
    if (found) {
      const canonicalTipe = TIPE_FOR_JENIS[found.jenis_transaksi] ?? "semua";
      const canonicalSlug =
        slug !== "semua" && SLUG_TO_KATEGORI[slug] === found.kategori
          ? slug
          : KATEGORI_TO_SLUG[found.kategori] ?? "semua";

      if (slug !== canonicalSlug || tipe !== canonicalTipe) {
        const redirectParams = new URLSearchParams();
        redirectParams.set("idProperty", idPropertyRaw);
        redirectParams.set("tipe", canonicalTipe);
        redirect(`/properti/${canonicalSlug}?${redirectParams.toString()}`);
      }
    }
  }

  // Urutan dinormalkan lewat katalog bersama (@/lib/listingSort): nilai lama
  // yang beredar di tautan ("luas-desc", "asc") tetap dikenali lewat alias,
  // nilai asing jatuh ke default, dan kolom yang dipakai adalah `harga_efektif`
  // — angka yang sama dengan yang dicetak kartu & dipakai filter harga.
  const limit = 30;
  const skip = (page - 1) * limit;

  // jenis_transaksi filter berdasarkan tab
  const transaksiFilter = (): Prisma.ListingWhereInput["jenis_transaksi"] => {
    if (tipe === "jual")   return { in: ["PRIMARY", "SECONDARY"] };
    if (tipe === "lelang") return "LELANG";
    if (tipe === "sewa")   return "SEWA";
    return { in: ["PRIMARY", "SECONDARY", "LELANG", "SEWA"] };
  };

  // Kategori: param `kategori` (daftar enum, multi) MENGGANTIKAN kategori slug.
  // Saat param terisi, klausanya disusun mesin filter — di sini cukup kosong.
  const kategoriWhere: Prisma.ListingWhereInput =
    filters.kategori.length > 0
      ? {}
      : kategori
      ? { kategori: kategori as Prisma.ListingWhereInput["kategori"] }
      : {};

  // Sebagian pilihan urut di lelang ikut MENYARING jadwal ("jadwal terdekat"
  // hanya menampilkan yang belum berlangsung). Kalau pemakai sudah memilih
  // filter jadwal sendiri, filternyalah yang menang — kalau tidak, irisan
  // "sudah berlalu" × "jadwal terdekat" selalu nol tanpa sebab yang terlihat.
  // Aturan yang sama dipakai /api/listings/count.
  /**
   * Filter "dekat X". Halaman inilah tujuan bawaan kotak pencarian di beranda
   * (tab "Semua" → /properti/semua), jadi di sinilah "deket unesa" paling
   * sering mendarat.
   *
   * Ikut masuk `baseWhere` — bukan hanya `whereClause` — supaya angka di
   * segmen tab (Jual 12 · Lelang 3 · Sewa 8) ikut menyusut sesuai tempat yang
   * dipilih. Kalau tidak, tabnya menjanjikan hasil yang tidak akan ditemukan
   * pemakai saat ia mengklik.
   */
  const siapTempat = await siapkanTempat(searchParams, {
    q: filters.q,
    kota: filters.lokasi.kota[0] ?? null,
  });
  const tempatWhere = buildTempatWhere(siapTempat.tempat);

  // Urutan dihitung SETELAH tempatnya diketahui: "terdekat" hanya sah kalau
  // ada titik acuannya (lihat parseSort).
  const sort = parseSort(searchParams.sort, konteks, siapTempat.chip?.nama);
  const sortWhere = jadwalMenimpaSort(filters, konteks)
    ? undefined
    : buildSortWhere(sort, konteks, sekarang);

  // `baseWhere` = semua kriteria KECUALI jenis_transaksi (tab). Dipakai bersama
  // oleh daftar listing & perhitungan angka tiap tab, supaya angka di segmen
  // tab ikut menyesuaikan filter pemakai — bukan total isi database.
  const baseWhere: Prisma.ListingWhereInput = {
    AND: [
      { status_tayang: "TERSEDIA" },
      kategoriWhere,
      buildListingWhere(
        // Teks yang sudah ditafsirkan jadi tempat tidak boleh ikut dicari
        // sebagai alamat — "deket unesa" dijamin nol hasil di kolom alamat,
        // dan menahannya berarti membatalkan pencarian yang sudah benar.
        siapTempat.tempat ? { ...filters, q: siapTempat.q } : filters,
        konteks,
        sekarang,
      ),
      ...(tempatWhere ? [tempatWhere] : []),
      ...(sortWhere ? [sortWhere] : []),
    ],
  };

  const whereClause: Prisma.ListingWhereInput = {
    AND: [baseWhere, { jenis_transaksi: transaksiFilter() }],
  };

  // Urutan inti dari mesin bersama: status → kunci pilihan pemakai → pemecah
  // seri `id_property` (yang membuat paginasi tidak pernah bocor).
  //
  // Satu tambahan khas halaman ini yang sengaja DIPERTAHANKAN: hot deal
  // mengapung, TAPI hanya pada urutan bawaan "terbaru". Pada urutan eksplisit
  // ia tidak boleh ikut campur — kartu pertama daftar "harga terendah" harus
  // benar-benar yang termurah, bukan hot deal yang kebetulan lebih mahal.
  const orderBy: Prisma.ListingOrderByWithRelationInput[] = (() => {
    const inti = buildOrderBy(sort, konteks);
    if (sort !== "terbaru") return inti;
    const [status, ...sisa] = inti;
    return [status, { is_hot_deal: "desc" }, ...sisa];
  })();

  const sertakan = {
    agent: {
      select: {
        nama_kantor: true,
        foto_profil_url: true,
        pengguna: { select: { nama_lengkap: true } },
      },
    },
    // Halaman ini memakai kartu yang sama dengan /Sewa & /Jual, dan untuk
    // listing KOS kartu itu menampilkan sisa kamar, gender, kamar mandi
    // dalam/luar & fasilitas — semuanya hidup di listing_sewa_detail.
    // Tanpa include ini, kos di sini akan tampil dengan grid KT/KM/LT/LB
    // yang seluruhnya "-", persis keluhan yang bikin kartunya disatukan.
    sewaDetail: true,
    _count: { select: { kamarTipe: true } },
  } as const;

  // "Terdekat" diurut di luar `orderBy` — jaraknya ada di relasi to-many dan
  // berbeda per tempat yang dicari. Lihat urutkanTerdekat().
  const urutJarak =
    sort === "terdekat" && siapTempat.tempat
      ? await urutkanTerdekat(siapTempat.tempat, whereClause, page, limit)
      : null;

  const [totalItems, propertiesRaw] = urutJarak
    ? [
        urutJarak.total,
        await prisma.listing
          .findMany({
            where: { id_property: { in: urutJarak.ids } },
            include: sertakan,
          })
          .then((baris) => {
            // findMany tidak menjamin urutan daftar `in` — disusun ulang
            // mengikuti jarak yang sudah dihitung.
            const peta = new Map(baris.map((b) => [String(b.id_property), b]));
            return urutJarak.ids
              .map((id) => peta.get(String(id)))
              .filter(Boolean) as typeof baris;
          }),
      ]
    : await prisma.$transaction([
        prisma.listing.count({ where: whereClause }),
        prisma.listing.findMany({
          where: whereClause,
          take: limit,
          skip,
          orderBy,
          include: sertakan,
        }),
      ]);

  const petaJarak = await ambilJarakKeTempat(
    siapTempat.tempat,
    propertiesRaw.map((p) => p.id_property),
  );

  const totalPages = Math.ceil(totalItems / limit);

  // Halaman di luar jangkauan → pindahkan ke halaman terakhir. Ini yang terjadi
  // setiap kali pemakai mempersempit filter selagi berada di halaman jauh:
  // sebelumnya ia mendarat di grid kosong bertuliskan "Belum ada listing"
  // padahal hasilnya ada, hanya tidak sebanyak itu.
  const tujuan = urlHalamanTerakhir(`/properti/${slug}`, searchParams, page, totalPages);
  if (tujuan) redirect(tujuan);

  // Satu query terindeks untuk seluruh halaman (halaman ini mayoritas isinya
  // lelang), bukan dua query per card. Listing non-lelang tersaring di dalam.
  const limitAwalPerListing = await ambilLimitLelangSebelumnya(propertiesRaw);

  const properties = propertiesRaw.map((item) => {
    const foto_list = normalizeListingImages(item.gambar);
    return {
      id_property:     String(item.id_property),
      slug:            item.slug,
      judul:           item.judul,
      kota:            item.kota,
      kecamatan:       item.kecamatan,
      kelurahan:       item.kelurahan,
      alamat_lengkap:  item.alamat_lengkap ?? "",
      harga:           item.nilai_limit_lelang
                         ? Number(item.nilai_limit_lelang)
                         : Number(item.harga),
      harga_promo:     item.harga_promo != null ? Number(item.harga_promo) : null,
      jenis_transaksi: item.jenis_transaksi,
      kategori:        item.kategori,
      status_tayang:   item.status_tayang,
      gambar:          foto_list[0] || "/images/hero/banner.jpg",
      foto_list,
      luas_tanah:      Number(item.luas_tanah ?? 0),
      luas_bangunan:   Number(item.luas_bangunan ?? 0),
      kamar_tidur:     item.kamar_tidur ?? 0,
      kamar_mandi:     item.kamar_mandi ?? 0,
      tanggal_lelang:  item.tanggal_lelang ? item.tanggal_lelang.toISOString() : null,
      lelang_limit_awal: limitAwalPerListing.get(String(item.id_property)) ?? null,
      // Field kos — dipakai kartu bersama untuk listing KOS/SEWA.
      durasi_sewa:        item.sewaDetail?.durasi_sewa ?? null,
      kamar_mandi_tipe:   item.sewaDetail?.kamar_mandi_tipe ?? null,
      kos_gender:         item.sewaDetail?.kos_gender ?? null,
      kamar_tersedia:     item.sewaDetail?.kamar_tersedia ?? null,
      tipe_unit:          item.sewaDetail?.tipe_unit ?? null,
      lantai_unit:        item.sewaDetail?.lantai_unit ?? null,
      kapasitas_penghuni: item.sewaDetail?.kapasitas_penghuni ?? null,
      kondisi_interior:   item.kondisi_interior ?? null,
      jumlah_tipe_kamar:  item._count?.kamarTipe ?? 0,
      fasilitas_kamar:    item.sewaDetail?.fasilitas_kamar ?? null,
      fasilitas_bersama:  item.sewaDetail?.fasilitas_bersama ?? null,
      akses_terdekat:     Array.isArray(item.akses_terdekat)
                            ? (item.akses_terdekat as any[])
                            : [],
      agent_name:      item.agent?.pengguna?.nama_lengkap || "Agent Kosku",
      agent_photo:     normalizeAgentPhoto(item.agent?.foto_profil_url),
      agent_office:    item.agent?.nama_kantor || "Kosku",
      is_hot_deal:     !!item.is_hot_deal,
      // Nama tempatnya yang dicetak, bukan nama filternya: "152 m dari
      // Universitas Ciputra" menjawab pertanyaan pembaca, "152 m dari Semua
      // kampus" mengulang apa yang sudah ia ketik sendiri.
      jarak_tempat: petaJarak.get(String(item.id_property)) ?? null,
    };
  });

  // Hitung tab counts — pakai baseWhere (semua filter user kecuali tab),
  // supaya angka pill menyesuaikan hasil pencarian, bukan total keseluruhan.
  const tabCounts = await prisma.listing.groupBy({
    by: ["jenis_transaksi"],
    where: baseWhere,
    _count: { jenis_transaksi: true },
  });

  const countMap: Record<string, number> = {};
  tabCounts.forEach((t) => { countMap[t.jenis_transaksi] = t._count.jenis_transaksi; });
  const totalCount =
    (countMap["PRIMARY"] ?? 0) +
    (countMap["SECONDARY"] ?? 0) +
    (countMap["LELANG"] ?? 0) +
    (countMap["SEWA"] ?? 0);
  const jualCount  = (countMap["PRIMARY"] ?? 0) + (countMap["SECONDARY"] ?? 0);

  return (
    <KategoriPageClient
      slug={slug}
      label={label}
      initialData={properties}
      tempat={siapTempat.chip}
      radiusTempat={siapTempat.tempat?.radius ?? null}
      tempatDitebak={siapTempat.ditebak}
      kueriAsli={filters.q ?? null}
      catatanTempat={siapTempat.catatan}
      pagination={{ currentPage: page, totalPages, totalItems }}
      activeTipe={tipe}
      konteks={konteks}
      tabCounts={{
        semua:  totalCount,
        jual:   jualCount,
        lelang: countMap["LELANG"] ?? 0,
        sewa:   countMap["SEWA"] ?? 0,
      }}
    />
  );
}
