import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const prisma = new PrismaClient();

// Helper function untuk serialize BigInt
function serializeBigInt(obj: any): any {
  return JSON.parse(
    JSON.stringify(obj, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

// Helper function untuk convert date ke UTC midnight (00:00:00)
function toUTCDate(dateString: string): Date {
  const date = new Date(dateString);
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0));
}

// GET - Ambil semua acara
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");
    const month = searchParams.get("month");

    let whereClause: any = {};

    if (year && month) {
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

      whereClause.tanggal_mulai = {
        gte: startDate,
        lte: endDate,
      };
    }

    const acara = await prisma.acara.findMany({
      where: whereClause,
      include: {
        agent: {
          select: {
            id_agent: true,
            pengguna: {
              select: {
                nama_lengkap: true,
              },
            },
          },
        },
        listing: {
          select: {
            id_property: true,
            judul: true,
            alamat_lengkap: true,
          },
        },
      },
      orderBy: {
        tanggal_mulai: "asc",
      },
    });

    return NextResponse.json(serializeBigInt(acara), { status: 200 });
  } catch (error) {
    console.error("Error fetching acara:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data acara" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// POST - Tambah acara baru
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validasi input required
    if (!body.judul_acara || !body.tipe_acara || !body.tanggal_mulai || !body.tanggal_selesai) {
      return NextResponse.json(
        { error: "Data tidak lengkap. Judul, tipe, dan tanggal wajib diisi." },
        { status: 400 }
      );
    }

    // Get session untuk id_agent
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized. Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    console.log("Session data:", {
      userId: session.user.id,
      agentId: (session.user as any).agentId,
    });

    // ✅ FIX: Field name yang benar adalah id_pengguna
    const agent = await prisma.agent.findFirst({
      where: { id_pengguna: session.user.id }, // ✅ GANTI id_user → id_pengguna
      select: { id_agent: true },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent tidak ditemukan untuk user ini. Pastikan Anda sudah terdaftar sebagai agent." },
        { status: 404 }
      );
    }

    const agentId = agent.id_agent;
    console.log("Agent ID found:", agentId);

    // Validasi tanggal (tanpa waktu, cuma date)
    const tanggalMulai = toUTCDate(body.tanggal_mulai);
    const tanggalSelesai = toUTCDate(body.tanggal_selesai);

    if (tanggalSelesai < tanggalMulai) {
      return NextResponse.json(
        { error: "Tanggal selesai tidak boleh lebih awal dari tanggal mulai" },
        { status: 400 }
      );
    }

    // Validasi tipe acara
    const validTipeAcara = [
      "BUYER_MEETING",
      "SITE_VISIT",
      "CLOSING",
      "FOLLOW_UP",
      "OPEN_HOUSE",
      "INTERNAL_MEETING",
      "TRAINING",
      "PEMILU",
      "LAINNYA",
    ];

    if (!validTipeAcara.includes(body.tipe_acara)) {
      return NextResponse.json(
        { error: "Tipe acara tidak valid" },
        { status: 400 }
      );
    }

    // Current timestamp untuk created/updated (dengan waktu)
    const now = new Date();

    // Simpan ke database
    const acara = await prisma.acara.create({
      data: {
        id_agent: agentId,
        id_property: body.id_property || null,
        judul_acara: body.judul_acara.trim(),
        deskripsi: body.deskripsi?.trim() || null,
        tipe_acara: body.tipe_acara,
        tanggal_mulai: tanggalMulai,
        tanggal_selesai: tanggalSelesai,
        waktu_mulai: body.waktu_mulai || null,
        waktu_selesai: body.waktu_selesai || null,
        lokasi: body.lokasi?.trim() || null,
        alamat_lengkap: body.alamat_lengkap?.trim() || null,
        durasi_pilih: body.tipe_acara === "PEMILU" ? (body.durasi_pilih || 60) : null,
        status_acara: "SCHEDULED",
        reminder_sent: false,
        tanggal_dibuat: now,
        tanggal_diupdate: now,
      },
      include: {
        agent: {
          select: {
            id_agent: true,
            pengguna: {
              select: {
                nama_lengkap: true,
              },
            },
          },
        },
      },
    });

    console.log("Acara created successfully:", {
      id: typeof acara.id_acara === 'bigint' ? acara.id_acara.toString() : acara.id_acara,
      id_agent: typeof acara.id_agent === 'bigint' ? acara.id_agent.toString() : acara.id_agent,
    });

    return NextResponse.json(
      {
        message: "Acara berhasil ditambahkan",
        data: serializeBigInt(acara),
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating acara:", error);

    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Data acara sudah ada" },
        { status: 409 }
      );
    }

    if (error.code === "P2003") {
      return NextResponse.json(
        { error: "Agent atau property tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Gagal menyimpan acara. Silakan coba lagi." },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// PUT - Update acara
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id_acara, ...updateData } = body;

    if (!id_acara) {
      return NextResponse.json(
        { error: "ID acara tidak ditemukan" },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized. Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    const existingAcara = await prisma.acara.findUnique({
      where: { id_acara: id_acara },
    });

    if (!existingAcara) {
      return NextResponse.json(
        { error: "Acara tidak ditemukan" },
        { status: 404 }
      );
    }

    const dataToUpdate: any = {
      tanggal_diupdate: new Date(),
    };

    if (updateData.judul_acara) dataToUpdate.judul_acara = updateData.judul_acara.trim();
    if (updateData.deskripsi !== undefined) dataToUpdate.deskripsi = updateData.deskripsi?.trim() || null;
    if (updateData.tipe_acara) dataToUpdate.tipe_acara = updateData.tipe_acara;
    if (updateData.lokasi !== undefined) dataToUpdate.lokasi = updateData.lokasi?.trim() || null;
    if (updateData.alamat_lengkap !== undefined) dataToUpdate.alamat_lengkap = updateData.alamat_lengkap?.trim() || null;
    if (updateData.status_acara) dataToUpdate.status_acara = updateData.status_acara;

    if (updateData.tanggal_mulai) {
      dataToUpdate.tanggal_mulai = toUTCDate(updateData.tanggal_mulai);
    }

    if (updateData.tanggal_selesai) {
      dataToUpdate.tanggal_selesai = toUTCDate(updateData.tanggal_selesai);
    }

    if (updateData.waktu_mulai !== undefined) dataToUpdate.waktu_mulai = updateData.waktu_mulai;
    if (updateData.waktu_selesai !== undefined) dataToUpdate.waktu_selesai = updateData.waktu_selesai;

    if (updateData.durasi_pilih !== undefined) {
      dataToUpdate.durasi_pilih = updateData.durasi_pilih;
    }

    const updatedAcara = await prisma.acara.update({
      where: { id_acara: id_acara },
      data: dataToUpdate,
      include: {
        agent: {
          select: {
            id_agent: true,
            pengguna: {
              select: {
                nama_lengkap: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(
      {
        message: "Acara berhasil diperbarui",
        data: serializeBigInt(updatedAcara),
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error updating acara:", error);
    return NextResponse.json(
      { error: "Gagal memperbarui acara" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE - Hapus acara
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id_acara = searchParams.get("id");

    if (!id_acara) {
      return NextResponse.json(
        { error: "ID acara tidak ditemukan" },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized. Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    const existingAcara = await prisma.acara.findUnique({
      where: { id_acara: id_acara },
    });

    if (!existingAcara) {
      return NextResponse.json(
        { error: "Acara tidak ditemukan" },
        { status: 404 }
      );
    }

    await prisma.acara.delete({
      where: { id_acara: id_acara },
    });

    return NextResponse.json(
      { message: "Acara berhasil dihapus" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error deleting acara:", error);
    return NextResponse.json(
      { error: "Gagal menghapus acara" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
