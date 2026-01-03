import NextAuth, { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import GoogleProvider from "next-auth/providers/google";

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export const authOptions: AuthOptions = {
  providers: [
    // 1. Login Manual (Email ATAU No HP)
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        phone: { label: "Phone", type: "text" }, // Kita tangkap data HP disini
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.password) {
          throw new Error("Password wajib diisi");
        }

        let user = null;

        // LOGIKA PENTING: Cek Email ATAU No HP
        if (credentials?.email) {
          // Kalau login pakai Email
          user = await prisma.pengguna.findUnique({
            where: { email: credentials.email },
          });
        } else if (credentials?.phone) {
          // Kalau login pakai No HP
          user = await prisma.pengguna.findUnique({
            where: { nomor_telepon: credentials.phone },
          });
        }

        // Kalau user tidak ketemu di database
        if (!user) {
          throw new Error("Akun tidak ditemukan. Pastikan data benar.");
        }

        // Cek Password
        const isPasswordCorrect = await bcrypt.compare(
          credentials.password,
          user.kata_sandi
        );

        if (!isPasswordCorrect) {
          throw new Error("Kata sandi salah.");
        }

        // Login Sukses! Kembalikan data user
        return {
          id: user.id_pengguna,
          name: user.nama_lengkap,
          email: user.email,
          image: user.foto_profil_url,
        };
      },
    }),

    // 2. Login Google (Opsional, biar gak error kalau env kosong)
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  pages: {
    signIn: "/signin", // Halaman login kamu
    error: "/signin",  // Kalau error, balik ke login aja (jangan ke halaman error aneh)
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET, // Wajib ada di .env
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) session.user.id = token.id;
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };