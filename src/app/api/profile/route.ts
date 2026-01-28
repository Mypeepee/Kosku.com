// src/app/api/profile/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "../auth/[...nextauth]/route";

const prisma = new PrismaClient();

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1) Ambil data pengguna
  const pengguna = await prisma.pengguna.findUnique({
    where: {
      id_pengguna: session.user.id,
    },
  });

  if (!pengguna) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // 2) Ambil data agent (kalau ada)
  const agent = await prisma.agent.findUnique({
    where: {
      id_pengguna: pengguna.id_pengguna,
    },
  });

  // 3) Format tanggal_lahir ke yyyy-MM-dd agar cocok dengan ProfileForm
  const formattedPengguna = {
    ...pengguna,
    tanggal_lahir: pengguna.tanggal_lahir
      ? new Date(pengguna.tanggal_lahir).toISOString().split("T")[0]
      : "",
  };

  // 4) Stats placeholder (silakan ganti dengan query asli kalau sudah siap)
  const stats = {
    premierPoin: 0,
    listingAktif: 0,
    transaksiBerhasil: 0,
    totalWishlist: 0,
    totalTransaksi: 0,
    totalReferral: 0,
  };

  return NextResponse.json({
    pengguna: formattedPengguna,
    agent, // bisa null kalau bukan agent
    stats,
  });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  // body di sini berasal dari formData:
  // {
  //   nama_lengkap, email, nomor_telepon,
  //   kota_asal, tanggal_lahir, foto_profil_url,
  //   peran, kode_referral, id_agent
  // }

  let tanggalLahirFixed: Date | null = null;
  if (body.tanggal_lahir && body.tanggal_lahir !== "") {
    const dateObj = new Date(body.tanggal_lahir);
    if (!isNaN(dateObj.getTime())) {
      tanggalLahirFixed = dateObj;
    }
  }

  try {
    const updatedUser = await prisma.pengguna.update({
      where: {
        id_pengguna: session.user.id,
      },
      data: {
        nama_lengkap: body.nama_lengkap,
        email: body.email,
        nomor_telepon: body.nomor_telepon,
        kota_asal: body.kota_asal,
        tanggal_lahir: tanggalLahirFixed,
        kode_referral: body.kode_referral || null,
        // kalau di model pengguna ada kolom foto_profil_url dan kamu mau simpan:
        // foto_profil_url: body.foto_profil_url || null,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error: any) {
    console.error("🔥 ERROR PRISMA:", error);

    // handle unique email (P2002)
    if (error.code === "P2002" && error.meta?.target?.includes("email")) {
      return NextResponse.json(
        { error: "Email sudah digunakan oleh akun lain." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Gagal update profile" },
      { status: 500 }
    );
  }
}
