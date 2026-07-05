// app/dashboard/listings/page.tsx
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import ListingsPage from "./components/listings-page";
import { fetchListingHeaderStats } from "./lib/property-stats";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";

const PAGE_SIZE = 27;

const VALID_JENIS = ["PRIMARY", "SECONDARY", "LELANG", "SEWA"] as const;
const VALID_KATEGORI = [
  "RUMAH",
  "APARTEMEN",
  "RUKO",
  "TANAH",
  "GUDANG",
  "HOTEL_DAN_VILLA",
  "TOKO",
  "PABRIK",
] as const;

function isValidImageUrl(s: string): boolean {
  return s.startsWith("http://") || s.startsWith("https://") || s.startsWith("/");
}
function normalizeListingImages(raw: string | null | undefined): string[] {
  if (!raw || raw.trim() === "") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => (isValidImageUrl(s) ? s : `/api/drive-image?id=${s}&sz=w400`));
}
function normalizeAgentPhoto(fileId: string | null | undefined): string {
  if (!fileId || fileId.trim() === "") return "/images/default-profile.png";
  const t = fileId.trim();
  if (t.startsWith("http://") || t.startsWith("https://") || t.startsWith("/")) return t;
  return `/api/drive-image?id=${t}&sz=w64`;
}

type RawSearch = string | string[] | undefined;
const str = (v: RawSearch): string => (Array.isArray(v) ? v[0] : v ?? "").trim();

type Props = {
  searchParams: {
    page?: string;
    q?: string;
    jenis?: string;
    kategori?: string;
    provinsi?: string;
    kota?: string;
    kecamatan?: string;
    kelurahan?: string;
  };
};

export default async function DashboardListingsPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  const agentId = (session?.user as any)?.agentId as string | undefined;
  const userRole = (session?.user as any)?.role as string | undefined;

  if (!session || !userRole) {
    return (
      <div className="p-6 text-sm text-slate-200">
        Anda belum login atau session tidak valid.
      </div>
    );
  }

  if (userRole === "AGENT" && !agentId) {
    return (
      <div className="p-6 text-sm text-slate-200">
        Anda terdaftar sebagai agent, tetapi data agent belum terhubung ke akun ini.
      </div>
    );
  }

  // ── Parse search params ──
  const page = Math.max(1, Number(str(searchParams.page)) || 1);
  const q = str(searchParams.q);
  const jenisRaw = str(searchParams.jenis).toUpperCase();
  const kategoriRaw = str(searchParams.kategori).toUpperCase();
  const provinsi = str(searchParams.provinsi);
  const kota = str(searchParams.kota);
  const kecamatan = str(searchParams.kecamatan);
  const kelurahan = str(searchParams.kelurahan);

  const jenis =
    (VALID_JENIS as readonly string[]).includes(jenisRaw) ? (jenisRaw as Prisma.jenis_transaksi_enum) : undefined;
  const kategori =
    (VALID_KATEGORI as readonly string[]).includes(kategoriRaw) ? (kategoriRaw as Prisma.kategori_properti_enum) : undefined;

  // ── Build Prisma where ──
  const isPrivileged = userRole === "OWNER" || userRole === "STOKER";

  const where: Prisma.ListingWhereInput = {
    status_tayang: "TERSEDIA",
    ...(!isPrivileged && { id_agent: agentId }),
    ...(jenis && { jenis_transaksi: jenis }),
    ...(kategori && { kategori }),
    ...(provinsi && { provinsi: { contains: provinsi, mode: "insensitive" } }),
    ...(kota && { kota: { contains: kota, mode: "insensitive" } }),
    ...(kecamatan && { kecamatan: { contains: kecamatan, mode: "insensitive" } }),
    ...(kelurahan && { kelurahan: { contains: kelurahan, mode: "insensitive" } }),
    ...(q && {
      OR: [
        { judul: { contains: q, mode: "insensitive" } },
        { alamat_lengkap: { contains: q, mode: "insensitive" } },
        // id_property contains — convert to string for partial match
        ...(/^\d+$/.test(q)
          ? [{ id_property: { equals: BigInt(q) } } as Prisma.ListingWhereInput]
          : []),
      ],
    }),
  };

  // ── Parallel: header stats + count + data ──
  const [headerStats, totalItems, properties] = await Promise.all([
    fetchListingHeaderStats(userRole, agentId),
    prisma.listing.count({ where }),
    prisma.listing.findMany({
      where,
      orderBy: { tanggal_diupdate: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        agent: {
          select: {
            nama_kantor: true,
            foto_profil_url: true,
            pengguna: { select: { nama_lengkap: true } },
          },
        },
      },
    }),
  ]);

  const listings = properties.map((p) => {
    const idStr = String(p.id_property);
    const slugId = `${p.slug}-${idStr}`;
    const fotoList = normalizeListingImages(p.gambar);

    return {
      id: idStr,
      slug: slugId,
      rawSlug: p.slug,
      title: p.judul,
      status: p.status_tayang ?? "",
      category: p.kategori,
      transactionType: p.jenis_transaksi,
      city: p.kota,
      area: (p as any).area_lokasi ?? "",
      address: p.alamat_lengkap ?? "",
      provinsi: p.provinsi ?? "",
      kecamatan: p.kecamatan ?? "",
      kelurahan: p.kelurahan ?? "",
      price: formatRupiah(Number(p.harga)),
      thumbnailUrl: fotoList[0] || undefined,
      views: p.dilihat ?? 0,
      priceRaw: p.nilai_limit_lelang ? Number(p.nilai_limit_lelang) : Number(p.harga),
      pricePromo: p.harga_promo != null ? Number(p.harga_promo) : null,
      photos: fotoList,
      luasTanah: Number(p.luas_tanah ?? 0),
      luasBangunan: Number(p.luas_bangunan ?? 0),
      kamarTidur: p.kamar_tidur ?? 0,
      kamarMandi: p.kamar_mandi ?? 0,
      tanggalLelang: p.tanggal_lelang ? p.tanggal_lelang.toISOString() : null,
      agentName: p.agent?.pengguna?.nama_lengkap || "Agent Kosku",
      agentPhoto: normalizeAgentPhoto(p.agent?.foto_profil_url),
      agentOffice: p.agent?.nama_kantor || "Kosku",
      isHotDeal: !!(p as any).is_hot_deal,
    };
  });

  return (
    <ListingsPage
      headerStats={headerStats}
      listings={listings}
      currentAgentId={agentId}
      userRole={userRole}
      currentPage={page}
      totalItems={totalItems}
      pageSize={PAGE_SIZE}
      initialFilters={{
        q,
        vendor: "",
        jenis: (jenisRaw && (VALID_JENIS as readonly string[]).includes(jenisRaw)
          ? jenisRaw
          : "ALL") as any,
        kategori: (kategoriRaw && (VALID_KATEGORI as readonly string[]).includes(kategoriRaw)
          ? kategoriRaw
          : "ALL") as any,
        provinsi,
        kota,
        kecamatan,
        kelurahan,
      }}
    />
  );
}

function formatRupiah(value: number) {
  if (!value) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}
