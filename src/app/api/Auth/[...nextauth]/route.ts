import NextAuth, { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

// Setup Prisma Client (Singleton Pattern)
const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export const authOptions: AuthOptions = {
  providers: [
    // 1. LOGIN GOOGLE
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),

    // 2. LOGIN MANUAL (Credentials)
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        phone: { label: "Phone", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.password) {
          throw new Error("Password wajib diisi");
        }

        // Cari user di database (Email ATAU No HP)
        const user = await prisma.pengguna.findFirst({
          where: {
            OR: [
              { email: credentials.email || undefined },
              { nomor_telepon: credentials.phone || undefined },
            ],
          },
        });

        if (!user) {
          throw new Error("Akun tidak ditemukan.");
        }

        // Jika user ini user Google (password null), tolak login manual
        if (!user.kata_sandi) {
          throw new Error("Akun terdaftar via Google. Silakan login dengan tombol Google.");
        }

        // Cek Password
        const isPasswordCorrect = await bcrypt.compare(
          credentials.password,
          user.kata_sandi
        );

        if (!isPasswordCorrect) {
          throw new Error("Kata sandi salah.");
        }

        // Return Data User Manual (Convert BigInt to String)
        return {
          id: user.id_pengguna.toString(),
          name: user.nama_lengkap,
          email: user.email,
          image: user.foto_profil_url,
          role: user.peran,
        };
      },
    }),
  ],

  pages: {
    signIn: "/signin",
    error: "/signin",
  },

  session: {
    strategy: "jwt",
  },

  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    // === CALLBACK 1: SIGN IN (Logika Simpan User Google) ===
    async signIn({ user, account, profile }: any) {
      if (account?.provider === "google") {
        try {
          if (!profile?.email) throw new Error("Google tidak memberikan email.");

          // 1. Cek apakah user sudah ada (Cek Google ID ATAU Email)
          const existingUser = await prisma.pengguna.findFirst({
            where: {
              OR: [
                { google_id: account.providerAccountId },
                { email: profile.email },
              ],
            },
          });

          // 2. JIKA BELUM ADA -> Buat User Baru
          if (!existingUser) {
            const newUser = await prisma.pengguna.create({
              data: {
                nama_lengkap: profile.name || "Pengguna Google",
                email: profile.email,
                google_id: account.providerAccountId,
                foto_profil_url: profile.picture,
                kata_sandi: null,
                peran: "USER",
                status_akun: "AKTIF",
                wa_terverifikasi: true,
              },
            });

            console.log("✅ New Google user created:", {
              id: newUser.id_pengguna.toString(),
              email: newUser.email,
            });
          }
          // 3. JIKA SUDAH ADA (tapi belum link Google ID) -> Update
          else if (!existingUser.google_id) {
            await prisma.pengguna.update({
              where: { id_pengguna: existingUser.id_pengguna },
              data: {
                google_id: account.providerAccountId,
                foto_profil_url: existingUser.foto_profil_url || profile.picture,
              },
            });

            console.log("✅ Google ID linked to existing user:", existingUser.email);
          }

          return true;
        } catch (error) {
          console.error("❌ Error saving Google user:", error);
          return false;
        }
      }
      return true;
    },

    // === CALLBACK 2: JWT ===
    async jwt({ token, user, account }: any) {
      // Saat pertama kali login (credentials)
      if (user) {
        token.id = user.id; // Sudah string dari authorize
        token.role = user.role;
      }

      // Khusus Google: ambil id_pengguna & peran dari DB
      if (account?.provider === "google" && token.email) {
        const dbUser = await prisma.pengguna.findUnique({
          where: { email: token.email },
          select: { id_pengguna: true, peran: true },
        });

        if (dbUser) {
          token.id = dbUser.id_pengguna.toString();
          token.role = dbUser.peran;
          console.log("✅ JWT updated for Google user:", token.id);
        }
      }

      // ✅ FIX: Tambahkan lookup agent berdasarkan id_pengguna
      if (token.id && !token.agentId) {
        try {
          const agent = await prisma.agent.findFirst({
            where: { id_pengguna: token.id }, // ✅ FIXED: id_pengguna (STRING)
            select: { id_agent: true },
          });

          if (agent) {
            // Handle BigInt conversion
            token.agentId = typeof agent.id_agent === 'bigint' 
              ? agent.id_agent.toString() 
              : agent.id_agent;
            
            console.log("✅ Agent found:", {
              userId: token.id,
              agentId: token.agentId,
            });
          } else {
            token.agentId = null;
            console.log("⚠️ No agent found for user:", token.id);
          }
        } catch (error) {
          console.error("❌ Error fetching agent:", error);
          token.agentId = null;
        }
      }

      return token;
    },

    // === CALLBACK 3: SESSION ===
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.agentId = token.agentId || null;
        
        console.log("✅ Session created:", {
          id: session.user.id,
          role: session.user.role,
          agentId: session.user.agentId,
        });
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
