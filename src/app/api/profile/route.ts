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

  // 3) Format tanggal_lahir
  const formattedPengguna = {
    ...pengguna,
    tanggal_lahir: pengguna.tanggal_lahir
      ? new Date(pengguna.tanggal_lahir).toISOString().split("T")[0]
      : "",
  };

  // 4) Contoh stats: bisa kamu hitung dari tabel lain
  // Di sini dummy dulu untuk struktur, nanti tinggal ganti query-nya
  const stats = {
    premierPoin: 0,          // nanti ambil dari tabel premier_poin (kalau sudah dibuat)
    listingAktif: 0,         // hitung dari tabel listing
    transaksiBerhasil: 0,    // hitung dari tabel transaksi
    totalWishlist: 0,        // untuk USER biasa
    totalTransaksi: 0,
    totalReferral: 0,
  };

  return NextResponse.json({
    pengguna: formattedPengguna,
    agent,     // bisa null kalau bukan agent
    stats,
  });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

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
        kota_asal: body.kota_asal,
        pekerjaan: body.pekerjaan,
        jenis_kelamin: body.jenis_kelamin,
        tanggal_lahir: tanggalLahirFixed,
        // kalau kamu mau simpan foto_profil_url di tabel pengguna juga,
        // tambahkan di sini:
        // foto_profil_url: body.foto_profil_url,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error: any) {
    console.error("🔥 ERROR PRISMA:", error);

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
