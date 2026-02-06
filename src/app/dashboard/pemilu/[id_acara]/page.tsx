// src/app/dashboard/pemilu/[id_acara]/page.tsx
import { PrismaClient, status_peserta_enum } from "@prisma/client";
import PemiluClient from "./PemiluClient";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const prisma = new PrismaClient();

interface PageProps {
  params: { id_acara: string };
}

export default async function PemiluPage({ params }: PageProps) {
  try {
    // 🔐 Ambil session dari NextAuth
    const session = await getServerSession(authOptions);
    const currentAgentId = session?.user?.agentId as string | undefined;

    // Kalau user belum punya agent, block dulu
    if (!currentAgentId) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
          <div className="text-center">
            <div className="mb-4 text-6xl">🔐</div>
            <h2 className="mb-2 text-2xl font-bold text-white">
              Agent belum terautentikasi
            </h2>
            <p className="text-slate-400">
              Silakan login sebagai agent terlebih dahulu.
            </p>
          </div>
        </div>
      );
    }

    const id_acara = BigInt(params.id_acara);

    const acara = await prisma.acara.findUnique({
      where: { id_acara },
      include: {
        pesertaAcara: {
          include: {
            agent: {
              select: {
                id_agent: true,
                foto_profil_url: true,
                pengguna: { select: { nama_lengkap: true } },
              },
            },
          },
        },
        pilihanPemilu: {
          include: {
            agent: {
              select: {
                id_agent: true,
                pengguna: { select: { nama_lengkap: true } },
              },
            },
            listing: {
              select: {
                id_property: true,
                judul: true,
                harga: true,
                alamat_lengkap: true,
              },
            },
          },
        },
      },
    });

    if (!acara) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
          <div className="text-center">
            <div className="mb-4 text-6xl">🔍</div>
            <h2 className="mb-2 text-2xl font-bold text-white">
              Acara Tidak Ditemukan
            </h2>
            <p className="text-slate-400">
              Acara dengan ID {params.id_acara} tidak ada di sistem.
            </p>
          </div>
        </div>
      );
    }

    const now = new Date();

    // ✅ FIXED: Pakai SEDANG_MEMILIH sesuai flow yang benar
    const pesertaAktif =
      acara.pesertaAcara.find(
        (p) =>
          p.status_peserta === status_peserta_enum.SEDANG_MEMILIH &&
          p.waktu_selesai_pilih
      ) ?? null;

    let activeAgentId: string | null = null;
    let activeRemainingSeconds: number | null = null;

    if (pesertaAktif && pesertaAktif.waktu_selesai_pilih) {
      const endTime = pesertaAktif.waktu_selesai_pilih.getTime();
      const diffMs = endTime - now.getTime();
      const remaining = Math.floor(diffMs / 1000);
      if (remaining > 0) {
        activeAgentId = pesertaAktif.id_agent;
        activeRemainingSeconds = remaining;
      }
    }

    // Listing tersedia
    const allListings = await prisma.listing.findMany({
      where: { status_tayang: "TERSEDIA" },
      select: {
        id_property: true,
        judul: true,
        slug: true,
        harga: true,
        nilai_limit_lelang: true,
        alamat_lengkap: true,
        kota: true,
        provinsi: true,
        kecamatan: true,
        kelurahan: true,
        kategori: true,
        jenis_transaksi: true,
        luas_tanah: true,
        luas_bangunan: true,
        kamar_tidur: true,
        kamar_mandi: true,
        gambar: true,
        tanggal_dibuat: true,
      },
      orderBy: { tanggal_dibuat: "desc" },
    });

    // ✅ Sort peserta by nomor_urut
    const sortedPeserta = [...acara.pesertaAcara].sort(
      (a, b) => (a.nomor_urut ?? 0) - (b.nomor_urut ?? 0)
    );

    const initialData = {
      id_acara: acara.id_acara.toString(),
      judul_acara: acara.judul_acara,
      tipe_acara: acara.tipe_acara,
      tanggal_mulai: acara.tanggal_mulai.toISOString(),
      tanggal_selesai: acara.tanggal_selesai.toISOString(),
      durasi_pilih: acara.durasi_pilih,
      peserta: sortedPeserta.map((p) => ({
        id_acara: p.id_acara.toString(),
        id_agent: p.id_agent,
        nomor_urut: p.nomor_urut,
        status_peserta: p.status_peserta, // ✅ Ini akan pass SEDANG_MEMILIH, MENUNGGU_GILIRAN, SUDAH_MEMILIH, dll
        nama_agent: p.agent?.pengguna?.nama_lengkap ?? p.id_agent,
        avatar_url: p.agent?.foto_profil_url ?? null,
      })),
      pilihan: acara.pilihanPemilu.map((pil) => ({
        id_acara: pil.id_acara.toString(),
        id_pilihan: pil.id_pilihan,
        id_agent: pil.id_agent,
        nama_agent: pil.agent?.pengguna?.nama_lengkap ?? pil.id_agent,
        id_listing: pil.id_listing.toString(),
        judul_listing: pil.listing.judul,
        harga: pil.listing.harga?.toString() ?? null,
        alamat: pil.listing.alamat_lengkap,
      })),
      availableListings: allListings.map((l) => ({
        id_property: l.id_property.toString(),
        judul: l.judul,
        slug: l.slug,
        harga: l.harga.toString(),
        nilai_limit_lelang: l.nilai_limit_lelang?.toString() ?? null,
        alamat_lengkap: l.alamat_lengkap,
        kota: l.kota,
        provinsi: l.provinsi,
        kecamatan: l.kecamatan,
        kelurahan: l.kelurahan,
        kategori: l.kategori,
        jenis_transaksi: l.jenis_transaksi,
        luas_tanah: l.luas_tanah?.toString() ?? null,
        luas_bangunan: l.luas_bangunan?.toString() ?? null,
        kamar_tidur: l.kamar_tidur,
        kamar_mandi: l.kamar_mandi,
        gambar: l.gambar,
      })),
      activeAgentId,
      activeRemainingSeconds,
    };

    return (
      <PemiluClient
        initialData={initialData}
        currentAgentId={currentAgentId}
      />
    );
  } catch (error) {
    console.error("Error loading pemilu page:", error);
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="text-center">
          <div className="mb-4 text-6xl">⚠️</div>
          <h2 className="mb-2 text-2xl font-bold text-white">
            Terjadi Kesalahan
          </h2>
          <p className="text-slate-400">
            Gagal memuat data pemilu. Silakan refresh halaman.
          </p>
        </div>
      </div>
    );
  } finally {
    await prisma.$disconnect();
  }
}
