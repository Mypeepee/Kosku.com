// app/dashboard/listings/page.tsx
import prisma from "@/lib/prisma";
import ListingsPage from "./components/listings-page";
import { fetchListingHeaderStats } from "./lib/property-stats";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export default async function DashboardListingsPage() {
  const session = await getServerSession(authOptions);
  const agentId = (session?.user as any)?.agentId as string | undefined;
  const userRole = (session?.user as any)?.role as string | undefined;

  // Jika belum login atau role tidak ada
  if (!session || !userRole) {
    return (
      <div className="p-6 text-sm text-slate-200">
        Anda belum login atau session tidak valid.
      </div>
    );
  }

  // Jika role AGENT tapi tidak punya agentId
  if (userRole === "AGENT" && !agentId) {
    return (
      <div className="p-6 text-sm text-slate-200">
        Anda terdaftar sebagai agent, tetapi data agent belum terhubung ke akun ini.
      </div>
    );
  }

  // Filter berdasarkan role + status_tayang TERSEDIA
  const baseWhere = {
    status_tayang: "TERSEDIA" as const,
  };

  const whereClause =
    userRole === "OWNER"
      ? baseWhere                         // OWNER: semua listing TERSEDIA
      : { ...baseWhere, id_agent: agentId }; // AGENT: listing TERSEDIA miliknya

  // Stats header (gunakan baseWhere yang sama di property-stats)
  const headerStats = await fetchListingHeaderStats(userRole, agentId);

  // Data untuk tabel
  const properties = await prisma.listing.findMany({
    where: whereClause,
    orderBy: { tanggal_diupdate: "desc" },
    take: 50,
  });

  const listings = properties.map((p) => {
    const idStr = String(p.id_property);
    const slugId = `${p.slug}-${idStr}`; // ✅ bentuk slugId = slug + "-" + id_property

    return {
      id: idStr,                    // ID Listing
      slug: slugId,                 // slugId untuk route detail
      title: p.judul,
      status: p.status_tayang ?? "",   // TERSEDIA (karena sudah difilter)
      category: p.kategori,
      transactionType: p.jenis_transaksi, // "LELANG" | "PRIMARY" | ...
      city: p.kota,
      area: (p as any).area_lokasi ?? "",
      address: p.alamat_lengkap ?? "",
      price: formatRupiah(Number(p.harga)),
      thumbnailUrl: p.gambar
        ? p.gambar.split(",")[0].trim()
        : undefined,
      views: p.dilihat ?? 0,
    };
  });

  return (
    <ListingsPage
      headerStats={headerStats}
      listings={listings}
      currentAgentId={agentId}
      userRole={userRole}
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
