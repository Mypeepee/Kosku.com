import React from "react";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import SearchHero from "./SearchHero";
import ProductList from "./produklist";
import FilterCommandBar from "@/components/listing/filterbar/FilterCommandBar";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { buildLocationWhere } from "@/lib/listingLocationFilter";
import { buildKataKunciWhere } from "@/lib/listingKataKunci";
import {
  ambilJarakKeTempat,
  buildTempatWhere,
  siapkanTempat,
  urutkanTerdekat,
} from "@/lib/listingTempatFilter";
import TempatAktifBar from "@/components/listing/TempatAktifBar";
import { parseCategoryDbList } from "@/lib/propertyType";
import { OPSI_JADWAL, whereJadwal, type JadwalLelang } from "@/lib/listingFilters";
import {
  buildSortWhere,
  parseHalaman,
  parseSort,
  urlHalamanTerakhir,
} from "@/lib/listingSort";
import { orderByListing, whereHargaListing } from "@/lib/listingSortRuntime";
import { ambilLimitLelangSebelumnya } from "@/lib/auctionDiscount";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";

type Props = {
  searchParams: { [key: string]: string | string[] | undefined };
};

// ✅ mapping string dari URL -> enum kategori_properti_enum di Prisma
const KATEGORI_MAP: Record<string, Prisma.kategori_properti_enum> = {
  RUMAH: "RUMAH",
  TANAH: "TANAH",
  GUDANG: "GUDANG",
  APARTEMEN: "APARTEMEN",
  PABRIK: "PABRIK",
  RUKO: "RUKO",
  TOKO: "TOKO",
  HOTEL_DAN_VILLA: "HOTEL_DAN_VILLA",
};

// ✅ Format kategori untuk display (HOTEL_DAN_VILLA → HOTEL DAN VILLA)
const formatKategoriDisplay = (kategori: string): string => {
  return kategori.replace(/_/g, " ");
};

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const kota =
    typeof searchParams.kota === "string" ? searchParams.kota : undefined;

  const formatText = (text?: string) =>
    text ? text.charAt(0).toUpperCase() + text.slice(1) : "";

  let title = "Lelang Properti Terpercaya | Premier";
  if (kota)
    title = `Lelang Properti di ${formatText(kota)} Harga Terbaik | Premier`;

  return {
    title,
    description: `Ikuti lelang properti di ${
      kota || "Indonesia"
    } dengan proses aman dan transparan. Temukan rumah, tanah, dan aset komersial dengan harga di bawah pasaran.`,
    alternates: {
      canonical: `/Lelang${kota ? `?kota=${kota}` : ""}`,
    },
  };
}

// helper: validasi URL gambar listing
function isValidImageUrl(url: string): boolean {
  if (!url || url.trim() === "") return false;
  return (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("/")
  );
}

// helper: normalisasi foto agent dari Google Drive ID
function normalizeAgentPhoto(fileId: string | null | undefined): string {
  if (!fileId || fileId.trim() === "") {
    return "/images/default-profile.png";
  }

  const trimmed = fileId.trim();

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/")
  ) {
    return trimmed;
  }

  return `https://drive.google.com/thumbnail?id=${trimmed}&sz=w64`;
}

// MONOPOLI LELANG: data publik agent perujuk untuk klien referral.
// Mengembalikan null bila kode tidak valid / agent tidak AKTIF (fallback ke owner).
async function getReferralPresenter(code: string | null | undefined) {
  if (!code || !/^AG\d+$/i.test(code)) return null;
  const agent = await prisma.agent.findFirst({
    where: { id_agent: code, status_keanggotaan: "AKTIF" },
    select: {
      id_agent: true,
      nama_kantor: true,
      foto_profil_url: true,
      pengguna: { select: { nama_lengkap: true } },
    },
  });
  if (!agent) return null;
  return {
    id_agent: agent.id_agent,
    nama: agent.pengguna?.nama_lengkap || "Agent Premier",
    kantor: agent.nama_kantor || "Solusindo Aset",
    foto: normalizeAgentPhoto(agent.foto_profil_url),
  };
}

export default async function SearchPage({ searchParams }: Props) {
  // Divalidasi, bukan Number() mentah: "?page=abc" dulu jadi NaN → skip NaN →
  // Prisma error → halaman 500.
  const page = parseHalaman(searchParams.page);
  const kota =
    typeof searchParams.kota === "string" ? searchParams.kota : undefined;
  const tipe =
    typeof searchParams.tipe === "string" ? searchParams.tipe : undefined;

  // Keyword pencarian: q (alamat) / idProperty (eksak)
  const q =
    typeof searchParams.q === "string" && searchParams.q.trim().length > 0
      ? searchParams.q.trim()
      : undefined;
  const idPropertyRaw =
    typeof searchParams.idProperty === "string" && /^\d+$/.test(searchParams.idProperty.trim())
      ? searchParams.idProperty.trim()
      : undefined;

  const minKT =
    typeof searchParams.minKT === "string"
      ? Number(searchParams.minKT)
      : undefined;
  const minKM =
    typeof searchParams.minKM === "string"
      ? Number(searchParams.minKM)
      : undefined;
  const lantai =
    typeof searchParams.lantai === "string"
      ? Number(searchParams.lantai)
      : undefined;
  const hadap =
    typeof searchParams.hadap === "string" ? searchParams.hadap : undefined;
  const kondisi =
    typeof searchParams.kondisi === "string"
      ? searchParams.kondisi
      : undefined;
  const legalitas =
    typeof searchParams.legalitas === "string"
      ? searchParams.legalitas
      : undefined;
  const hotDeal = searchParams.hotDeal === "1";
  const jadwalRaw =
    typeof searchParams.jadwal === "string" ? searchParams.jadwal : undefined;
  const jadwal: JadwalLelang | undefined =
    jadwalRaw && OPSI_JADWAL.some((o) => o.value === jadwalRaw)
      ? (jadwalRaw as JadwalLelang)
      : undefined;

  // ✅ Filter harga, luas tanah, dan luas bangunan dari SearchHero
  const minHarga =
    typeof searchParams.minHarga === "string"
      ? Number(searchParams.minHarga)
      : undefined;
  const maxHarga =
    typeof searchParams.maxHarga === "string"
      ? Number(searchParams.maxHarga)
      : undefined;
  const minLT =
    typeof searchParams.minLT === "string"
      ? Number(searchParams.minLT)
      : undefined;
  const maxLT =
    typeof searchParams.maxLT === "string"
      ? Number(searchParams.maxLT)
      : undefined;
  const minLB =
    typeof searchParams.minLB === "string"
      ? Number(searchParams.minLB)
      : undefined;
  const maxLB =
    typeof searchParams.maxLB === "string"
      ? Number(searchParams.maxLB)
      : undefined;

  // ✅ Sort parameter (default: terbaru — TANPA filter tanggal otomatis).
  //    Filter waktu lelang (terdekat/terjauh/berlalu) hanya aktif jika user
  //    memilihnya sendiri lewat Urutkan di FilterCommandBar. Dinormalkan
  //    lewat katalog bersama (@/lib/listingSort) supaya nilai asing tidak
  //    lolos jadi orderBy kosong.
  // Dihitung setelah tempatnya diketahui — "terdekat" hanya sah bila ada titik
  // acuannya (lihat parseSort).
  const sortMentah = searchParams.sort;

  const limit = 30;
  const skip = (page - 1) * limit;

  // ✅ Tipe aset multi-kategori (param `tipe` = daftar enum dipisah koma)
  const kategoriList = parseCategoryDbList(searchParams.tipe);

  // Filter lokasi multi-wilayah (provinsi/kota/kecamatan/kelurahan) → grup OR.
  const locationWhere = buildLocationWhere(searchParams);

  // Filter "dekat X" — menangani `?dekat=…` maupun `?q=deket unesa`.
  const siapTempat = await siapkanTempat(searchParams, { q, kota });
  const tempatWhere = buildTempatWhere(siapTempat.tempat);
  const sort = parseSort(sortMentah, "LELANG", siapTempat.chip?.nama);

  // ✅ Tanggal hari ini (awal hari untuk comparison yang fair)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Rentang harga dibangun di sisi server karena kolomnya bisa berbeda per
  // database (lihat catatan di blok filter harga di bawah).
  const hargaWhere = await whereHargaListing("LELANG", minHarga, maxHarga);

  // Pencarian by ID bersifat eksak — filter sekunder (kategori, lokasi,
  // harga, dimensi, dll) tidak ikut membatasi supaya properti yang dicari
  // pasti tampil selama jenis_transaksi-nya memang LELANG.
  const whereClause: Prisma.ListingWhereInput = {
    jenis_transaksi: "LELANG",
    status_tayang: { in: ["TERSEDIA", "TERJUAL"] },

    ...(idPropertyRaw && { id_property: BigInt(idPropertyRaw) }),


    // Digabung dalam SATU daftar AND — dua kunci `AND` di objek yang sama akan
    // saling menimpa, dan filter yang hilang diam-diam adalah kerusakan yang
    // tidak terlihat sebagai kerusakan.
    // Kata kunci, lokasi administratif, dan "dekat tempat" digabung dalam SATU
    // daftar AND — dua kunci `AND` di objek yang sama akan saling menimpa, dan
    // filter yang hilang diam-diam adalah kerusakan yang tidak terlihat
    // sebagai kerusakan.
    //
    // Kata kunci memakai pembangun bersama (src/lib/listingKataKunci.ts): ia
    // mencari lintas kolom, bukan cuma `alamat_lengkap`. "Dukuh Kupang" adalah
    // nama KELURAHAN dan sering tidak tertulis ulang di dalam alamat — dicari
    // di satu kolom saja, orang mengetik nama yang benar lalu mendapat nol.
    ...(() => {
      const and = [
        buildKataKunciWhere(siapTempat.q),
        locationWhere,
        tempatWhere,
      ].filter(Boolean) as Prisma.ListingWhereInput[];
      return !idPropertyRaw && and.length ? { AND: and } : {};
    })(),

    ...(!idPropertyRaw && kategoriList.length > 0 && {
      kategori: { in: kategoriList as any },
    }),

    ...(!idPropertyRaw && minKT && {
      kamar_tidur: { gte: minKT },
    }),

    ...(!idPropertyRaw && minKM && {
      kamar_mandi: { gte: minKM },
    }),

    ...(!idPropertyRaw && lantai && {
      jumlah_lantai: { gte: lantai },
    }),

    ...(!idPropertyRaw && hadap && {
      hadap_bangunan: { contains: hadap, mode: "insensitive" },
    }),

    ...(!idPropertyRaw && kondisi && {
      kondisi_interior: { contains: kondisi, mode: "insensitive" },
    }),

    ...(!idPropertyRaw && legalitas && {
      legalitas: { equals: legalitas as any },
    }),

    ...(!idPropertyRaw && hotDeal && { is_hot_deal: true }),

    // ✅ Filter JADWAL LELANG — pilihan eksplisit pemakai, menang atas batasan
    //    implisit dari "Urutkan → jadwal terdekat" (lihat di bawah): kalau
    //    tidak, memilih jadwal "Sudah berlalu" bertabrakan dengan urutan yang
    //    diam-diam menyaring `tanggal_lelang >= hari ini` dan hasilnya nol
    //    tanpa sebab yang terlihat.
    ...(!idPropertyRaw && jadwal && whereJadwal(jadwal, today)),

    // ✅ Filter HARGA memakai kolom YANG SAMA dengan "Urutkan → harga terendah"
    //    — keduanya lewat satu pintu (whereHargaListing/orderByListing) supaya
    //    mustahil berselisih. Normalnya `harga_efektif`; kalau kolom turunan
    //    itu belum terisi di database ini, keduanya sama-sama pindah ke kolom
    //    cadangan. Lihat src/lib/listingSortRuntime.ts.
    ...(!idPropertyRaw && hargaWhere ? hargaWhere : {}),

    // ✅ Filter LUAS TANAH
    ...(!idPropertyRaw && (minLT !== undefined || maxLT !== undefined) && {
      luas_tanah: {
        ...(minLT !== undefined && { gte: minLT }),
        ...(maxLT !== undefined && { lte: maxLT }),
      },
    }),

    // ✅ Filter LUAS BANGUNAN
    ...(!idPropertyRaw && (minLB !== undefined || maxLB !== undefined) && {
      luas_bangunan: {
        ...(minLB !== undefined && { gte: minLB }),
        ...(maxLB !== undefined && { lte: maxLB }),
      },
    }),

    // ✅ FILTER berdasarkan waktu lelang — menempel pada pilihan urut
    //    ("jadwal terdekat" tidak masuk akal kalau lelang tahun lalu ikut
    //    tampil). Aturannya ada di buildSortWhere supaya count & findMany
    //    memakai batas waktu yang sama persis. Dilewati kalau pemakai SUDAH
    //    memilih jadwal secara eksplisit di atas — filter eksplisit menang,
    //    urutannya tetap dipakai (aturan yang sama dipakai /properti/[slug]).
    ...(!idPropertyRaw && !jadwal
      ? (buildSortWhere(sort, "LELANG", today) ?? {})
      : {}),
  };

  // ✅ Urutan dari katalog bersama, lewat lapis sisi-server yang memastikan
  //    kolom harganya benar-benar terisi di database ini — di server yang
  //    belum menjalankan prisma/migration_harga_efektif.sql, `harga_efektif`
  //    ada tapi NULL, dan ORDER BY di atasnya diam-diam tidak mengurutkan apa
  //    pun. Setiap urutan ditutup pemecah seri `id_property` supaya paginasi
  //    tidak pernah bocor.
  const orderBy = await orderByListing(sort, "LELANG");

  const sertakanAgent = {
    agent: {
      select: {
        nama_kantor: true,
        foto_profil_url: true,
        pengguna: { select: { nama_lengkap: true } },
      },
    },
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
            include: sertakanAgent,
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
    : await prisma
        .$transaction([
          prisma.listing.count({ where: whereClause }),
          prisma.listing.findMany({
            where: whereClause,
            take: limit,
            skip,
            orderBy,
            include: sertakanAgent,
          }),
        ])
        .catch((error) => {
          console.error("Prisma Error:", error);
          throw error;
        });

  const petaJarak = await ambilJarakKeTempat(
    siapTempat.tempat,
    propertiesRaw.map((p) => p.id_property),
  );

  const totalPages = Math.ceil(totalItems / limit);

  // Halaman di luar jangkauan → geser ke halaman terakhir. Lazim terjadi di
  // /Lelang: pilihan urut "Sudah berlalu" sekaligus menyaring hasil, jadi
  // jumlah halamannya menyusut drastis sementara ?page= masih tertinggal.
  const tujuan = urlHalamanTerakhir("/Lelang", searchParams, page, totalPages);
  if (tujuan) redirect(tujuan);

  // MONOPOLI LELANG: hanya untuk KLIEN referral (yang masih punya atensi beli),
  // BUKAN agent. Begitu user jadi agent (punya agentId / peran AGENT), monopoli
  // mati & list kembali normal (menampilkan owner tiap listing).
  const session = await getServerSession(authOptions);
  const role =
    (session?.user as any)?.role || (session?.user as any)?.peran || null;
  const agentId = (session?.user as any)?.agentId || null;
  const referralCode = (session?.user as any)?.kode_referral || null;
  const isAgentUser = Boolean(agentId) || role === "AGENT";
  const presenter =
    !isAgentUser && referralCode
      ? await getReferralPresenter(referralCode)
      : null;

  // Limit lelang sebelumnya untuk SELURUH halaman sekaligus — satu query
  // terindeks (~2,5 ms untuk 12 listing), bukan dua query per card.
  const limitAwalPerListing = await ambilLimitLelangSebelumnya(propertiesRaw);

  const formattedData = propertiesRaw.map((item) => {
    const rawGambar = item.gambar || "";
    const foto_list =
      rawGambar.trim().length > 0
        ? rawGambar
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0 && isValidImageUrl(s))
        : [];

    const agentPhotoUrl = normalizeAgentPhoto(item.agent.foto_profil_url);

    return {
      // BigInt Prisma tidak bisa diserialisasi ke Client Component — dan kartu
      // memang hanya menampilkannya. Dikonversi di sini, sama seperti halaman
      // daftar lain, supaya bentuknya seragam di semua sumber data.
      id_property: String(item.id_property),
      slug: item.slug,
      judul: item.judul,
      kota: item.kota,
      alamat_lengkap: item.alamat_lengkap ?? "",

      // ✅ Display harga pakai nilai_limit_lelang
      harga: item.nilai_limit_lelang
        ? Number(item.nilai_limit_lelang)
        : Number(item.harga),

      jenis_transaksi: item.jenis_transaksi,
      status_tayang: item.status_tayang,

      // ✅ Format kategori untuk display (HOTEL_DAN_VILLA → HOTEL DAN VILLA)
      kategori: formatKategoriDisplay(item.kategori),

      gambar: foto_list[0] || "/images/hero/banner.jpg",
      foto_list,

      luas_tanah: Number(item.luas_tanah ?? 0),
      luas_bangunan: Number(item.luas_bangunan ?? 0),
      kamar_tidur: item.kamar_tidur ?? 0,
      kamar_mandi: item.kamar_mandi ?? 0,

      agent_name: presenter ? presenter.nama : item.agent.pengguna.nama_lengkap,
      agent_photo: presenter ? presenter.foto : agentPhotoUrl,
      agent_office: presenter ? presenter.kantor : item.agent.nama_kantor,

      tanggal_lelang: item.tanggal_lelang
        ? item.tanggal_lelang.toISOString()
        : null,
      lelang_limit_awal:
        limitAwalPerListing.get(String(item.id_property)) ?? null,
      is_hot_deal: !!item.is_hot_deal,
      // Nama tempatnya yang dicetak, bukan nama filternya: "152 m dari
      // Universitas Ciputra" menjawab pertanyaan pembaca, "152 m dari Semua
      // kampus" mengulang apa yang sudah ia ketik sendiri.
      jarak_tempat: petaJarak.get(String(item.id_property)) ?? null,
    };
  });

  return (
    <main className="bg-[#0F0F0F] min-h-screen pb-20">
      <SearchHero
        key={`${q ?? ""}_${siapTempat.chip?.nilai ?? ""}_${idPropertyRaw ?? ""}_${kota ?? ""}_${tipe ?? ""}_${minHarga ?? ""}_${maxHarga ?? ""}_${minLT ?? ""}_${maxLT ?? ""}_${minLB ?? ""}_${maxLB ?? ""}`}
        initial={{
          q: siapTempat.q,
          dekat: siapTempat.chip,
          radius: siapTempat.tempat?.radius,
          idProperty: idPropertyRaw,
          kota: kota,
          tipe: tipe,
          minHarga: minHarga,
          maxHarga: maxHarga,
          minLT: minLT,
          maxLT: maxLT,
          minLB: minLB,
          maxLB: maxLB,
        }}
      />

      <FilterCommandBar
        konteks="LELANG"
        tabAktif="lelang"
        totalHasil={totalItems}
        namaTempat={siapTempat.chip?.nama ?? null}
        showSegments={false}
      />

      <section className="container mx-auto px-4 mt-6">
        {(siapTempat.chip || siapTempat.catatan) && (
          <TempatAktifBar
            tempat={siapTempat.chip}
            radius={siapTempat.tempat?.radius}
            jumlah={totalItems}
            ditebak={siapTempat.ditebak}
            kueriAsli={q}
            catatan={siapTempat.catatan}
          />
        )}

        <div className="mb-4">
          <h2 className="text-white text-2xl md:text-3xl font-black">
            Listing Lelang Properti
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {totalItems} properti ditemukan
          </p>
        </div>

        <ProductList
          initialData={formattedData}
          pagination={{
            currentPage: page,
            totalPages,
            totalItems,
          }}
          presentingAgentId={presenter?.id_agent ?? null}
        />
      </section>
    </main>
  );
}
