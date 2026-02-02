// app/dashboard/listings/page.tsx
import prisma from "@/lib/prisma";
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

  const properties = await prisma.listing.findMany({
    where: { id_agent: agentId },
    orderBy: { tanggal_diupdate: "desc" },
    take: 50,
  });

  const listings = properties.map((p) => ({
    // gunakan id_property sebagai ID utama
    id: p.id_property,
    // slug untuk detail publik (slug di DB sudah mengandung teks, tidak perlu tambah id lagi)
    slug: p.slug,
    title: p.judul,
    status: mapStatus(p.status_tayang),
    category: p.kategori,
    transactionType: p.jenis_transaksi, // "LELANG" | "PRIMARY" | ...
    city: p.kota,
    area: (p as any).area_lokasi ?? "", // kalau kolom ini tidak ada di listing, boleh dihapus
    address: p.alamat_lengkap ?? "",
    price: formatRupiah(Number(p.harga)),
    thumbnailUrl: p.gambar
      ? p.gambar.split(",")[0].trim()
      : undefined,
    views: p.dilihat ?? 0,
  }));

  return (
    <ListingsPage
      headerStats={headerStats}
      listings={listings}
      currentAgentId={agentId}
    />
  );
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
