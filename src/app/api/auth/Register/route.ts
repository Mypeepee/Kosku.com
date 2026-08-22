import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { attributeReferral } from "@/lib/referral";
import { notifyNewUserRegistration } from "@/lib/notifications";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LoginMode = "email" | "phone";

function normalizeEmail(raw: string) {
  return (raw || "").trim().toLowerCase();
}

/**
 * Terima input:
 *  - "8123..." (tanpa 0) ✅ sesuai UI +62|
 *  - "08123..."
 *  - "+628123..."
 *  - "628123..."
 * Output: "8123..." (tanpa 0 tanpa 62)
 */
function normalizePhoneLocalDigits(raw: string) {
  let digits = (raw || "").replace(/\D/g, "");
  if (digits.startsWith("62")) digits = digits.slice(2);
  digits = digits.replace(/^0+/, "");
  return digits; // "8123..."
}

/**
 * Penyimpanan khusus tabel pengguna: "08..."
 */
function toPenggunaPhoneFormat(raw: string) {
  const d = normalizePhoneLocalDigits(raw);
  return d ? `0${d}` : ""; // "08123..."
}

/**
 * Kandidat untuk match data lama campur-campur
 */
function buildPhoneCandidates(raw: string) {
  const d = normalizePhoneLocalDigits(raw);
  if (!d) return [];
  return [`0${d}`, d, `62${d}`, `+62${d}`];
}

function json(
  status: number,
  payload: {
    ok: boolean;
    code: string;
    message: string;
    field?: "email" | "phone" | "password";
    action?: "LOGIN" | "LOGIN_GOOGLE";
    next?: { href?: string; provider?: "google" };
    value?: string;
    details?: any;
    user?: any;
  }
) {
  // paksa header JSON biar frontend selalu bisa parse
  return NextResponse.json(payload, {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const name = String(body?.name || "").trim();
    const password = String(body?.password || "");
    const emailRaw = String(body?.email || "");
    const phoneRaw = String(body?.phone || "");
    const kodeReferralRaw = String(body?.kode_referral || "");

    // login_mode boleh kosong -> autodetect
    let login_mode = body?.login_mode as LoginMode | undefined;
    if (login_mode !== "email" && login_mode !== "phone") {
      // autodetect paling masuk akal
      login_mode = emailRaw ? "email" : phoneRaw ? "phone" : undefined;
    }

    if (!name || !password) {
      return json(400, {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Nama dan password wajib diisi.",
      });
    }

    // Samakan dengan UX kamu: kalau mau minimal 8, ganti 6->8
    if (password.length < 6) {
      return json(400, {
        ok: false,
        code: "WEAK_PASSWORD",
        message: "Password minimal 6 karakter.",
        field: "password",
      });
    }

    if (!login_mode) {
      return json(400, {
        ok: false,
        code: "LOGIN_MODE_REQUIRED",
        message: "Pilih metode pendaftaran: Email atau No. HP.",
      });
    }

    const email = login_mode === "email" ? normalizeEmail(emailRaw) : "";
    const phoneToSave = login_mode === "phone" ? toPenggunaPhoneFormat(phoneRaw) : "";
    const phoneCandidates = login_mode === "phone" ? buildPhoneCandidates(phoneRaw) : [];

    // =========================
    // EMAIL MODE
    // =========================
    if (login_mode === "email") {
      if (!email) {
        return json(400, {
          ok: false,
          code: "EMAIL_REQUIRED",
          message: "Email wajib diisi.",
          field: "email",
        });
      }

      const existingEmail = await prisma.pengguna.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { id_pengguna: true, email: true, google_id: true },
      });

      if (existingEmail) {
        // pesan tegas buat UX signup
        return json(409, {
          ok: false,
          code: existingEmail.google_id ? "ACCOUNT_EXISTS_GOOGLE" : "ACCOUNT_EXISTS",
          message: existingEmail.google_id
            ? "Email ini sudah terdaftar via Google. Silakan login dengan Google."
            : "Email ini sudah terdaftar. Silakan login.",
          field: "email",
          value: email,
          action: existingEmail.google_id ? "LOGIN_GOOGLE" : "LOGIN",
          next: existingEmail.google_id ? { provider: "google" } : { href: "/signin" },
        });
      }
    }

    // =========================
    // PHONE MODE (UI +62| input tanpa 0)
    // =========================
    if (login_mode === "phone") {
      // phoneRaw boleh "8123..." / "+628123..." dll
      const d = normalizePhoneLocalDigits(phoneRaw);

      if (!d) {
        return json(400, {
          ok: false,
          code: "PHONE_REQUIRED",
          message: "Nomor HP wajib diisi.",
          field: "phone",
        });
      }

      // kalau user nekat input 0 di depan (mis "0812...") masih akan dinormalisasi
      // tapi kalau kamu MAU benar-benar menolak 0 di depan sesuai UI, aktifkan blok ini:
      if (/^\s*0/.test(String(phoneRaw || ""))) {
        return json(400, {
          ok: false,
          code: "PHONE_INVALID_FORMAT",
          message: "Nomor HP tidak boleh diawali 0. Cukup masukkan tanpa 0 (contoh: 812xxxx).",
          field: "phone",
        });
      }

      const existingPhone = await prisma.pengguna.findFirst({
        where: { OR: phoneCandidates.map((p) => ({ nomor_telepon: p })) },
        select: { id_pengguna: true, nomor_telepon: true, google_id: true },
      });

      if (existingPhone) {
        return json(409, {
          ok: false,
          code: "ACCOUNT_EXISTS",
          message: "Nomor HP ini sudah terdaftar. Silakan login.",
          field: "phone",
          value: phoneToSave, // "08..."
          action: "LOGIN",
          next: { href: "/signin" },
          details:
            process.env.NODE_ENV === "development"
              ? { matchedExisting: existingPhone.nomor_telepon, candidates: phoneCandidates }
              : undefined,
        });
      }
    }

    // =========================
    // CREATE USER
    // =========================
    const hashedPassword = await bcrypt.hash(password, 10);

    const created = await prisma.pengguna.create({
      data: {
        nama_lengkap: name,
        kata_sandi: hashedPassword,
        email: login_mode === "email" ? email : null,
        nomor_telepon: login_mode === "phone" ? phoneToSave : null, // simpan konsisten "08..."
        peran: "USER",
        status_akun: "AKTIF",
      },
      select: {
        id_pengguna: true,
        nama_lengkap: true,
        email: true,
        nomor_telepon: true,
        peran: true,
        status_akun: true,
      },
    });

    // ── NOTIF EMAIL KE OWNER (best-effort, tidak menggagalkan registrasi) ──
    notifyNewUserRegistration({
      nama: created.nama_lengkap,
      email: created.email,
      phone: created.nomor_telepon,
      registeredAt: new Date(),
    }).catch((e) => console.warn("notifyNewUserRegistration failed:", e));

    // ── ATRIBUSI REFERRAL (best-effort, tidak menggagalkan registrasi) ──
    // Kalau pendaftar memakai kode referral agent yang valid & AKTIF:
    // set kode_referral, buat Klien di CRM agent, beri +10.000 poin & notif.
    if (kodeReferralRaw.trim()) {
      await attributeReferral({
        penggunaId: created.id_pengguna,
        code: kodeReferralRaw,
        nama: created.nama_lengkap,
        email: created.email,
        phone: created.nomor_telepon,
      });
    }

    return json(201, {
      ok: true,
      code: "REGISTER_SUCCESS",
      message: "Pendaftaran berhasil. Silakan login.",
      action: "LOGIN",
      next: { href: "/signin" },
      user: created,
    });
  } catch (error: any) {
    console.error("Register Error RAW:", error);
    return json(500, {
      ok: false,
      code: "SERVER_ERROR",
      message: "Terjadi kesalahan server.",
      details:
        process.env.NODE_ENV === "development"
          ? { error: error?.message || String(error) }
          : undefined,
    });
  }
}
