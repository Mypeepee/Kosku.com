// src/app/api/auth/register/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nama_lengkap, identifier, kata_sandi } = body; 
    // 'identifier' adalah input gabungan (bisa email / hp)

    if (!nama_lengkap || !identifier || !kata_sandi) {
      return NextResponse.json({ message: "Data tidak lengkap" }, { status: 400 });
    }

    // --- DETEKSI TIPE INPUT ---
    const isEmail = identifier.includes("@");
    
    let emailFinal = "";
    let phoneFinal = "";

    if (isEmail) {
      // Jika user daftar pakai EMAIL
      emailFinal = identifier;
      // Generate HP dummy random agar unik (karena db mewajibkan unique)
      phoneFinal = `000-${Date.now()}`; 
    } else {
      // Jika user daftar pakai HP
      phoneFinal = identifier;
      // Generate Email dummy
      emailFinal = `${identifier}@kosku.com`;
    }

    // --- CEK DUPLIKASI ---
    // Kita cek apakah identifier ini sudah pernah dipakai
    const existingUser = await db.pengguna.findFirst({
      where: {
        OR: [
          { email: emailFinal },
          { nomor_telepon: phoneFinal }
        ]
      }
    });

    if (existingUser) {
      return NextResponse.json(
        { message: isEmail ? "Email sudah terdaftar" : "Nomor HP sudah terdaftar" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(kata_sandi, 10);

    const newUser = await db.pengguna.create({
      data: {
        nama_lengkap,
        email: emailFinal,
        nomor_telepon: phoneFinal,
        kata_sandi: hashedPassword,
        peran: "penyewa", // Default
      },
    });

    return NextResponse.json(
      { message: "Registrasi Berhasil!", user: newUser },
      { status: 201 }
    );

  } catch (error) {
    console.error("Register Error:", error);
    return NextResponse.json(
      { message: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}