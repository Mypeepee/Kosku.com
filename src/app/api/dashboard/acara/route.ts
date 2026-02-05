import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const prisma = new PrismaClient();

function serializeBigInt(data: any) {
  return JSON.parse(
    JSON.stringify(data, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");
    const month = searchParams.get("month");

    const where: any = {};

    if (year && month) {
      const start = new Date(Number(year), Number(month) - 1, 1);
      const end = new Date(Number(year), Number(month), 0, 23, 59, 59);
      where.tanggal_mulai = { gte: start, lte: end };
    }

    const acara = await prisma.acara.findMany({
      where,
      include: {
        agent: {
          select: {
            id_agent: true,
            pengguna: {
              select: { nama_lengkap: true },
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
      orderBy: { tanggal_mulai: "asc" },
    });

    return NextResponse.json(serializeBigInt(acara), { status: 200 });
  } catch (error) {
    console.error("Error fetching acara:", error);
    return NextResponse.json({ error: "Gagal mengambil data acara" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.judul_acara || !body.tipe_acara || !body.tanggal_mulai || !body.tanggal_selesai) {
      return NextResponse.json(
        { error: "Judul, tipe acara, tanggal mulai & selesai wajib diisi." },
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

    const agent = await prisma.agent.findFirst({
      where: { id_pengguna: session.user.id },
      select: { id_agent: true },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent tidak ditemukan untuk user ini." },
        { status: 404 }
      );
    }

    const tanggalMulai = new Date(body.tanggal_mulai);
    const tanggalSelesai = new Date(body.tanggal_selesai);

    if (tanggalSelesai < tanggalMulai) {
      return NextResponse.json(
        { error: "Tanggal selesai tidak boleh lebih awal dari tanggal mulai." },
        { status: 400 }
      );
    }

    const now = new Date();

    const acara = await prisma.acara.create({
      data: {
        id_agent: agent.id_agent,
        id_property: body.id_property ? BigInt(body.id_property) : null,
        judul_acara: body.judul_acara.trim(),
        deskripsi: body.deskripsi || null,
        tipe_acara: body.tipe_acara,
        tanggal_mulai: tanggalMulai,
        tanggal_selesai: tanggalSelesai,
        lokasi: body.lokasi || null,
        durasi_pilih: body.tipe_acara === "PEMILU" ? body.durasi_pilih || 60 : null,
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
              select: { nama_lengkap: true },
            },
          },
        },
      },
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

    if (error.code === "P2003") {
      return NextResponse.json(
        { error: "Agent atau property tidak ditemukan." },
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

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id_acara, ...updateData } = body;

    if (!id_acara) {
      return NextResponse.json({ error: "ID acara wajib diisi." }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized. Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    const acaraId = BigInt(id_acara);

    const existing = await prisma.acara.findUnique({
      where: { id_acara: acaraId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Acara tidak ditemukan." }, { status: 404 });
    }

    const dataToUpdate: any = {
      tanggal_diupdate: new Date(),
    };

    if (updateData.judul_acara) dataToUpdate.judul_acara = updateData.judul_acara.trim();
    if (updateData.deskripsi !== undefined) dataToUpdate.deskripsi = updateData.deskripsi || null;
    if (updateData.tipe_acara) dataToUpdate.tipe_acara = updateData.tipe_acara;
    if (updateData.lokasi !== undefined) dataToUpdate.lokasi = updateData.lokasi || null;
    if (updateData.status_acara) dataToUpdate.status_acara = updateData.status_acara;

    if (updateData.tanggal_mulai) dataToUpdate.tanggal_mulai = new Date(updateData.tanggal_mulai);
    if (updateData.tanggal_selesai) dataToUpdate.tanggal_selesai = new Date(updateData.tanggal_selesai);

    if (updateData.durasi_pilih !== undefined) dataToUpdate.durasi_pilih = updateData.durasi_pilih;

    if (updateData.id_property !== undefined)
      dataToUpdate.id_property = updateData.id_property ? BigInt(updateData.id_property) : null;

    const updated = await prisma.acara.update({
      where: { id_acara: acaraId },
      data: dataToUpdate,
      include: {
        agent: {
          select: {
            id_agent: true,
            pengguna: {
              select: { nama_lengkap: true },
            },
          },
        },
      },
    });

    return NextResponse.json(
      {
        message: "Acara berhasil diperbarui",
        data: serializeBigInt(updated),
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error updating acara:", error);
    return NextResponse.json({ error: "Gagal memperbarui acara." }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID acara wajib diisi." }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized. Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    const acaraId = BigInt(id);

    const existing = await prisma.acara.findUnique({
      where: { id_acara: acaraId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Acara tidak ditemukan." }, { status: 404 });
    }

    await prisma.acara.delete({
      where: { id_acara: acaraId },
    });

    return NextResponse.json({ message: "Acara berhasil dihapus" }, { status: 200 });
  } catch (error: any) {
    console.error("Error deleting acara:", error);
    return NextResponse.json({ error: "Gagal menghapus acara." }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
