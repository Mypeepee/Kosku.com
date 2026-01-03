import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, password, email, phone, login_mode } = body;

    // 1. Validasi Dasar
    if (!name || !password) {
      return NextResponse.json(
        { message: "Nama dan Password wajib diisi" },
        { status: 400 }
      );
    }

    // 2. Cek apakah user sudah ada (berdasarkan mode login)
    // Jika daftar pakai email, cek email. Jika hp, cek hp.
    let existingUser = null;

    if (login_mode === "email") {
      if (!email) {
        return NextResponse.json({ message: "Email wajib diisi" }, { status: 400 });
      }
      existingUser = await prisma.pengguna.findUnique({
        where: { email: email },
      });
    } else if (login_mode === "phone") {
      if (!phone) {
        return NextResponse.json({ message: "Nomor HP wajib diisi" }, { status: 400 });
      }
      existingUser = await prisma.pengguna.findUnique({
        where: { nomor_telepon: phone },
      });
    }

    if (existingUser) {
      return NextResponse.json(
        { message: "User dengan data tersebut sudah terdaftar" },
        { status: 409 } // 409 Conflict
      );
    }

    // 3. Hash Password (Enkripsi)
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Simpan ke Database
    // Kita gunakan data yang sesuai mode, sisanya biarkan null (undefined)
    const newUser = await prisma.pengguna.create({
      data: {
        nama_lengkap: name,
        kata_sandi: hashedPassword,
        email: login_mode === "email" ? email : null,
        nomor_telepon: login_mode === "phone" ? phone : null,
        peran: "penyewa", // Default sesuai database
        status_akun: "aktif",
      },
    });

    return NextResponse.json(
      { message: "Pendaftaran berhasil", user: newUser },
      { status: 201 }
    );

  } catch (error: any) {
    console.error("Register Error:", error);
    return NextResponse.json(
      { message: "Terjadi kesalahan server", error: error.message },
      { status: 500 }
    );
  }
}