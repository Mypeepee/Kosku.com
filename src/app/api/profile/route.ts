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

  const user = await prisma.pengguna.findUnique({
    where: { 
      id_pengguna: session.user.id 
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const formattedUser = {
    ...user,
    // Pastikan konversi tanggal aman
    tanggal_lahir: user.tanggal_lahir 
      ? new Date(user.tanggal_lahir).toISOString().split("T")[0] 
      : "",
  };

  return NextResponse.json(formattedUser);
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  // --- VALIDASI TANGGAL (PENTING) ---
  // Jika string kosong "", jangan new Date(""), tapi set null
  let tanggalLahirFixed = null;
  if (body.tanggal_lahir && body.tanggal_lahir !== "") {
    const dateObj = new Date(body.tanggal_lahir);
    // Cek apakah valid date
    if (!isNaN(dateObj.getTime())) {
      tanggalLahirFixed = dateObj;
    }
  }

  try {
    const updatedUser = await prisma.pengguna.update({
      where: { 
        id_pengguna: session.user.id 
      },
      data: {
        nama_lengkap: body.nama_lengkap,
        email: body.email, 
        kota_asal: body.kota_asal,
        pekerjaan: body.pekerjaan, // Pastikan value "mahasiswa" (kecil), bukan "Mahasiswa"
        jenis_kelamin: body.jenis_kelamin, // Pastikan value "pria" (kecil), bukan "Pria"
        tanggal_lahir: tanggalLahirFixed,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error: any) {
    // --- DEBUGGING (PENTING) ---
    // Lihat error detailnya di Terminal VS Code Anda
    console.error("🔥 ERROR PRISMA:", error);

    if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
      return NextResponse.json({ error: "Email sudah digunakan oleh akun lain." }, { status: 400 });
    }

    return NextResponse.json({ error: "Gagal update profile" }, { status: 500 });
  }
}