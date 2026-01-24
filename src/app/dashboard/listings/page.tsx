// app/dashboard/listings/page.tsx
import { prisma } from "@/lib/prisma";
import ListingsPage from "./components/listings-page";
import { fetchListingHeaderStats } from "./lib/property-stats";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export default async function DashboardListingsPage() {
  const session = await getServerSession(authOptions);
  const agentId = (session?.user as any)?.agentId as string | undefined;

  if (!agentId) {
    return (
      <div className="p-6 text-sm text-slate-200">
        Anda belum terdaftar sebagai agent atau data agent belum terhubung ke akun ini.
      </div>
    );
  }

  const headerStats = await fetchListingHeaderStats(agentId);

  const properties = await prisma.property.findMany({
    where: { id_agent: agentId },
    orderBy: { tanggal_diupdate: "desc" },
    take: 50,
  });

  const listings = properties.map((p) => ({
    id: p.kode_properti,
    title: p.judul,
    status: mapStatus(p.status_tayang),
    category: p.kategori,                     // ✅ cocok dengan Listing.category
    transactionType: p.jenis_transaksi,       // ✅ isi transaksi
    city: p.kota,
    area: p.area_lokasi ?? "",
    address: p.alamat_lengkap ?? "",          // ✅ alamat lengkap
    price: formatRupiah(Number(p.harga)),
    thumbnailUrl: p.gambar
      ? p.gambar.split(",")[0]                // ✅ ambil URL pertama dari kolom text
      : undefined,
    views: p.dilihat ?? 0, // ✅ tambahan
  }));

  return <ListingsPage headerStats={headerStats} listings={listings} />;
}

function mapStatus(status?: string | null): string {
  if (!status) return "Draft";
  if (status === "TERSEDIA") return "For Sale";
  if (status === "TERJUAL") return "Archived";
  if (status === "TARIK_LISTING") return "Draft";
  return status;
}

function formatRupiah(value: number) {
  if (!value) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}
