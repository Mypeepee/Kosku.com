// app/dashboard/listings/page.tsx
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import ListingsPage from "./components/listings-page";
import { fetchListingHeaderStats } from "./lib/property-stats";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { listingScopeWhere } from "@/lib/listingStatusPermission";
import { ambilLimitLelangSebelumnya } from "@/lib/auctionDiscount";
import {
  buildListingWhere,
  orderByDasbor,
  parseListingFilters,
  JENIS_OPTIONS,
  KATEGORI_OPTIONS,
} from "./lib/filters";
import {
  DASHBOARD_LISTING_INCLUDE,
  toDashboardListing,
  type DashboardListing,
} from "./lib/listing-item";

const PAGE_SIZE = 27;

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function DashboardListingsPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  const agentId = (session?.user as any)?.agentId as string | undefined;
  const userRole = (session?.user as any)?.role as string | undefined;
  // Wewenang OWNER/STOKER ada di `jabatan` (jabatan_agent_enum), BUKAN di
  // `role` — `role` isinya `peran_enum` yang cuma USER|AGENT, sehingga
  // perbandingan `role === "OWNER"` di sini dulu tidak pernah benar dan owner
  // diam-diam hanya melihat listingnya sendiri.
  const jabatan = (session?.user as any)?.jabatan as string | undefined;

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

  // ── Filter & urutan: satu kontrak dipakai server + UI (./lib/filters) ──
  const filters = parseListingFilters(searchParams);
  const pageRaw = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page;
  const page = Math.max(1, Number(pageRaw) || 1);

  // Cakupannya diturunkan dari mesin izin yang sama dengan tombol "Tandai
  // Terjual" (@/lib/listingStatusPermission): kamu melihat apa yang boleh kamu
  // kelola. OWNER → semua; STOKER → miliknya + seluruh aset LELANG; agent →
  // miliknya sendiri.
  const scope = listingScopeWhere({ idAgent: agentId, jabatan });

  if (!scope) {
    return (
      <div className="p-6 text-sm text-slate-200">
        Akun ini belum terhubung sebagai agent, jadi belum ada listing yang bisa
        ditampilkan.
      </div>
    );
  }

  // `sekarang` dihitung SEKALI lalu dipakai ulang: `count` dan `findMany`
  // dengan urutan "jadwal terdekat" harus memakai batas waktu yang sama persis,
  // kalau tidak jumlah di header bisa berbeda satu dari isi halamannya.
  const sekarang = new Date();
  const scopeWhere = scope as Prisma.ListingWhereInput;
  const where = buildListingWhere({ filters, scope: scopeWhere, sekarang });

  const [headerStats, totalItems, properties, facetJenis, facetKategori] =
    await Promise.all([
      fetchListingHeaderStats(scope),
      prisma.listing.count({ where }),
      prisma.listing.findMany({
        where,
        orderBy: orderByDasbor(filters.sort, filters.jenis),
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: DASHBOARD_LISTING_INCLUDE,
      }),
      // Facet: berapa hasilnya kalau dimensi ini yang diganti, filter lain
      // tetap. Angka inilah yang membuat dropdown berguna sebelum diklik.
      prisma.listing.groupBy({
        by: ["jenis_transaksi"],
        _count: { _all: true },
        where: buildListingWhere({ filters, scope: scopeWhere, abaikan: "jenis", sekarang }),
      }),
      prisma.listing.groupBy({
        by: ["kategori"],
        _count: { _all: true },
        where: buildListingWhere({ filters, scope: scopeWhere, abaikan: "kategori", sekarang }),
      }),
    ]);

  // Satu query terindeks untuk seluruh halaman, bukan dua query per kartu.
  // Listing non-lelang tersaring di dalam fungsinya.
  const limitAwalPerListing = await ambilLimitLelangSebelumnya(properties);

  const listings: DashboardListing[] = properties.map((p) =>
    toDashboardListing(p, limitAwalPerListing.get(String(p.id_property)))
  );

  // Semua pilihan diberi angka, termasuk yang nol. `groupBy` hanya mengembalikan
  // nilai yang ada barisnya, dan pilihan tanpa angka terbaca sebagai "belum
  // dihitung" — padahal jawabannya justru yang paling berguna: kosong.
  const jenisCounts: Record<string, number> = Object.fromEntries(
    JENIS_OPTIONS.map((o) => [o.value, 0])
  );
  let totalSemuaJenis = 0;
  facetJenis.forEach((row) => {
    jenisCounts[row.jenis_transaksi] = row._count._all;
    totalSemuaJenis += row._count._all;
  });
  jenisCounts.ALL = totalSemuaJenis;

  const kategoriCounts: Record<string, number> = Object.fromEntries(
    KATEGORI_OPTIONS.map((o) => [o.value, 0])
  );
  let totalSemuaKategori = 0;
  facetKategori.forEach((row) => {
    kategoriCounts[row.kategori] = row._count._all;
    totalSemuaKategori += row._count._all;
  });
  kategoriCounts.ALL = totalSemuaKategori;

  return (
    <ListingsPage
      headerStats={headerStats}
      listings={listings}
      currentAgentId={agentId}
      userRole={userRole}
      currentJabatan={jabatan}
      currentPage={page}
      totalItems={totalItems}
      pageSize={PAGE_SIZE}
      initialFilters={filters}
      jenisCounts={jenisCounts}
      kategoriCounts={kategoriCounts}
    />
  );
}
