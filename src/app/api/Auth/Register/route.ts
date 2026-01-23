import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, password, email, phone, login_mode } = body;

    if (!name || !password) {
      return NextResponse.json(
        { message: "Nama dan Password wajib diisi" },
        { status: 400 }
      );
    }

    let existingUser = null;

    if (login_mode === "email") {
      if (!email) {
        return NextResponse.json(
          { message: "Email wajib diisi" },
          { status: 400 }
        );
      }
      existingUser = await prisma.pengguna.findUnique({
        where: { email },
      });
    } else if (login_mode === "phone") {
      if (!phone) {
        return NextResponse.json(
          { message: "Nomor HP wajib diisi" },
          { status: 400 }
        );
      }
      existingUser = await prisma.pengguna.findUnique({
        where: { nomor_telepon: phone },
      });
    } else {
      return NextResponse.json(
        { message: "Mode login tidak valid" },
        { status: 400 }
      );
    }

    if (existingUser) {
      return NextResponse.json(
        { message: "User dengan data tersebut sudah terdaftar" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.pengguna.create({
      data: {
        nama_lengkap: name,
        kata_sandi: hashedPassword,
        email: login_mode === "email" ? email : null,
        nomor_telepon: login_mode === "phone" ? phone : null,
        peran: "USER",        // sesuai enum
        status_akun: "AKTIF", // sesuai enum
      },
    });

    return NextResponse.json(
      { message: "Pendaftaran berhasil", user: newUser },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Register Error RAW:", error);
    return NextResponse.json(
      {
        message: "Terjadi kesalahan server",
        error: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
