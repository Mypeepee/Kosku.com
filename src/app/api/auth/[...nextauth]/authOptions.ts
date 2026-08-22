// src/app/api/auth/[...nextauth]/authOptions.ts
import { type AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcrypt";
import { cookies } from "next/headers";
import { attributeReferral } from "@/lib/referral";
import prisma from "@/lib/prisma";

function toPublicPhotoUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;
  // Sudah URL (http/https)
  if (v.startsWith("http://") || v.startsWith("https://")) {
    try {
      const u = new URL(v);
      const idFromQuery = u.searchParams.get("id");
      if (idFromQuery) {
        return `https://drive.google.com/uc?export=view&id=${idFromQuery}`;
      }
      const m = v.match(/\/d\/([^/]+)/);
      if (m?.[1]) {
        return `https://drive.google.com/uc?export=view&id=${m[1]}`;
      }
      return v;
    } catch {
      return null;
    }
  }
  // Anggap raw Google Drive file ID
  return `https://drive.google.com/uc?export=view&id=${v}`;
}

function normalizeEmail(raw: string) {
  return (raw || "").trim().toLowerCase();
}

function normalizePhoneToLocalDigits(raw: string) {
  let digits = (raw || "").replace(/\D/g, "");
  if (digits.startsWith("62")) digits = digits.slice(2);
  digits = digits.replace(/^0+/, "");
  return digits;
}

function buildPhoneCandidates(rawPhone: string) {
  const d = normalizePhoneToLocalDigits(rawPhone);
  if (!d) return [];
  return [`0${d}`, d, `62${d}`, `+62${d}`];
}

function looksLikePhone(raw: string) {
  const digits = (raw || "").replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          // "select_account" membiarkan user memilih/ganti akun Google tanpa
          // memaksa consent ulang tiap login. Sebelumnya "consent" + "offline"
          // memicu Google mengirim email "info yang kamu bagikan" setiap login,
          // padahal app ini hanya butuh identitas (tidak memakai token Google).
          prompt: "select_account",
          response_type: "code",
        },
      },
    }),

    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        phone: { label: "Phone", type: "text" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        try {
          const password = credentials?.password;
          if (!password) throw new Error("Password wajib diisi.");

          const emailRaw = String(credentials?.email || "");
          const phoneRaw = String(credentials?.phone || "");

          const email = normalizeEmail(emailRaw);

          // kalau user isi email dengan angka, treat as phone
          const mergedPhoneRaw =
            phoneRaw?.trim() || (looksLikePhone(emailRaw) ? emailRaw.trim() : "");

          const phoneCandidates = buildPhoneCandidates(mergedPhoneRaw);

          if (!email && phoneCandidates.length === 0) {
            throw new Error("Email atau No. HP wajib diisi.");
          }

          const OR: any[] = [];

          // kalau email field berisi phone, jangan treat sebagai email
          if (email && !looksLikePhone(emailRaw)) {
            OR.push({ email: { equals: email, mode: "insensitive" } });
          }

          if (phoneCandidates.length) {
            OR.push(...phoneCandidates.map((p) => ({ nomor_telepon: p })));
          }

          if (OR.length === 0) throw new Error("Email atau No. HP wajib diisi.");

          const user = await prisma.pengguna.findFirst({
            where: { OR },
            select: {
              id_pengguna: true,
              nama_lengkap: true,
              email: true,
              nomor_telepon: true,
              kata_sandi: true,
              peran: true,
              status_akun: true,
              google_id: true,
            },
          });

          if (!user) throw new Error("Akun tidak ditemukan.");

          if (user.status_akun && user.status_akun !== "AKTIF") {
            throw new Error("Akun kamu sedang tidak aktif. Hubungi admin.");
          }

          if (!user.kata_sandi) {
            throw new Error(
              "Akun terdaftar via Google. Silakan login dengan tombol Google."
            );
          }

          // guard bcrypt hash
          if (
            typeof user.kata_sandi === "string" &&
            !user.kata_sandi.startsWith("$2")
          ) {
            throw new Error(
              "Password di database belum bcrypt. Silakan reset password / migrasi hash."
            );
          }

          const ok = await bcrypt.compare(password, user.kata_sandi);
          if (!ok) throw new Error("Kata sandi salah.");

          // ✅ Kembalikan minimal payload yang dibutuhkan JWT
          return {
            id: user.id_pengguna,
            name: user.nama_lengkap,
            email: user.email,
            image: null,
          } as any;
        } catch (err) {
          console.error("❌ AUTHORIZE ERROR:", err);
          throw err;
        }
      },
    }),
  ],

  pages: {
    signIn: "/signin",
    error: "/signin",
  },

  session: { strategy: "jwt" },

  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    /**
     * ✅ Google sign-in: upsert user
     */
    async signIn({ account, profile }: any) {
      if (account?.provider !== "google") return true;

      try {
        const email = normalizeEmail(profile?.email || "");
        if (!email) throw new Error("Google tidak memberikan email.");

        const providerAccountId = account.providerAccountId;

        const existingUser = await prisma.pengguna.findFirst({
          where: {
            OR: [
              { google_id: providerAccountId },
              { email: { equals: email, mode: "insensitive" } },
            ],
          },
          select: { id_pengguna: true, google_id: true },
        });

        if (!existingUser) {
          const createdGoogleUser = await prisma.pengguna.create({
            data: {
              nama_lengkap: profile?.name || "Pengguna Google",
              email,
              google_id: providerAccountId,
              kata_sandi: null,
              peran: "USER",
              status_akun: "AKTIF",
              wa_terverifikasi: true,
            },
            select: { id_pengguna: true, nama_lengkap: true, email: true },
          });

          // ── ATRIBUSI REFERRAL untuk pendaftar via Google ──
          // Kode disimpan di cookie `ref_code` saat klien membuka link /r/AG###.
          // Best-effort: tidak menggagalkan login bila gagal.
          try {
            const refCode = cookies().get("ref_code")?.value || "";
            if (refCode) {
              await attributeReferral({
                penggunaId: createdGoogleUser.id_pengguna,
                code: refCode,
                nama: createdGoogleUser.nama_lengkap,
                email: createdGoogleUser.email,
              });
            }
          } catch (e) {
            console.warn("Google referral attribution failed:", e);
          }
        } else if (!existingUser.google_id) {
          await prisma.pengguna.update({
            where: { id_pengguna: existingUser.id_pengguna },
            data: { google_id: providerAccountId },
          });
        }

        return true;
      } catch (error) {
        console.error("❌ Google signIn error:", error);
        return false;
      }
    },

    /**
     * ✅ JWT: SINGLE SOURCE OF TRUTH dari DB
     * Ini yang bikin suspend/aktif langsung ngaruh ke header + middleware.
     */
    async jwt({ token, user, account }: any) {
      // 1) Saat login pertama, set identitas awal.
      //    Untuk Google OAuth, user.id adalah Google's ID (bukan id_pengguna DB),
      //    jadi skip — biarkan step 2 lookup by email untuk dapat DB ID yang benar.
      if (user?.id && account?.provider === "credentials") token.id = user.id;
      if (user?.email) token.email = user.email;

      // 2) Pastikan token.id ada untuk google (kadang cuma email)
      //    -> cari user by email kalau belum kebentuk id
      if (!token.id && token.email) {
        const db = await prisma.pengguna.findFirst({
          where: { email: { equals: String(token.email), mode: "insensitive" } },
          select: { id_pengguna: true },
        });
        if (db) token.id = db.id_pengguna;
      }

      // 3) Refresh peran + agentId dari DB — hanya saat login pertama ATAU token sudah
      //    lebih dari 5 menit. Sebelumnya query ini jalan setiap request (71 route ×
      //    N fetch per page load = N extra DB hit per detik). Dengan TTL 5 menit,
      //    perubahan status_akun/peran berlaku dalam max 5 menit — trade-off yang wajar.
      const REFRESH_INTERVAL = 5 * 60 * 1000;
      const isLogin = !!user; // user hanya ada saat sign-in event
      const isStale = Date.now() - ((token._refreshedAt as number) || 0) > REFRESH_INTERVAL;

      if (token.id && (isLogin || isStale)) {
        const dbUser = await prisma.pengguna.findUnique({
          where: { id_pengguna: String(token.id) },
          select: {
            id_pengguna: true,
            nama_lengkap: true,
            email: true,
            peran: true,
            status_akun: true,
            kode_referral: true,
            agent: { select: { id_agent: true, status_keanggotaan: true, foto_profil_url: true, jabatan: true } },
          },
        });

        if (dbUser) {
          token.id = dbUser.id_pengguna;
          token.name = dbUser.nama_lengkap || token.name;
          token.email = dbUser.email || token.email;

          // kode referral agent perujuk (untuk monopoli Lelang sisi klien)
          token.kode_referral = dbUser.kode_referral ?? null;

          // ✅ pakai peran sebagai patokan utama
          token.peran = dbUser.peran;

          // kompatibilitas dengan kode lama yang masih baca token.role
          token.role = dbUser.peran;

          // agent id (boleh null)
          token.agentId = dbUser.agent?.id_agent ?? null;
          token.jabatan = dbUser.agent?.jabatan ?? null;

          // optional: bisa dipakai UI
          token.agentStatus = dbUser.agent?.status_keanggotaan ?? null;
          token.status_akun = dbUser.status_akun ?? null;

          // foto profil dari tabel agent (kalau ada) — normalisasi ke URL publik
          const photoUrl = toPublicPhotoUrl(dbUser.agent?.foto_profil_url);
          if (photoUrl) token.picture = photoUrl;
        } else {
          // user hilang dari DB
          token.peran = "USER";
          token.role = "USER";
          token.agentId = null;
          token.agentStatus = null;
          token.kode_referral = null;
        }
        token._refreshedAt = Date.now();
      } else if (!token.id) {
        token.peran = token.peran ?? token.role ?? "USER";
        token.role = token.role ?? token.peran ?? "USER";
        token.agentId = token.agentId ?? null;
        token.agentStatus = token.agentStatus ?? null;
      }

      return token;
    },

    /**
     * ✅ Session: expose fields ke client
     * Mulai sekarang pakai session.user.peran di FE.
     */
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.id;
        session.user.name = session.user.name ?? token.name ?? null;
        session.user.email = session.user.email ?? token.email ?? null;

        // ✅ field utama
        session.user.peran = token.peran ?? token.role ?? "USER";

        // ✅ kompatibilitas lama
        session.user.role = token.role ?? token.peran ?? "USER";

        session.user.agentId = token.agentId ?? null;
        session.user.jabatan = token.jabatan ?? null;

        // kode referral agent perujuk (monopoli Lelang sisi klien)
        session.user.kode_referral = token.kode_referral ?? null;

        // optional untuk UI
        session.user.agentStatus = token.agentStatus ?? null;
        session.user.status_akun = token.status_akun ?? null;

        // foto profil: DB > Google OAuth > null
        session.user.image = token.picture ?? session.user.image ?? null;
      }
      return session;
    },
  },

  events: {
    async error(message) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ NextAuth event error:", message);
      }
    },
  },

  debug: process.env.NODE_ENV === "development",
};
