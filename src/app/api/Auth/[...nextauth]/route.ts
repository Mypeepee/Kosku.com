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
    // 1. LOGIN MANUAL (Credentials)
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

        let user = null;

        // Cek Login via Email atau No HP
        if (credentials?.email) {
          user = await prisma.pengguna.findUnique({
            where: { email: credentials.email },
          });
        } else if (credentials?.phone) {
          user = await prisma.pengguna.findUnique({
            where: { nomor_telepon: credentials.phone },
          });
        }

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

        // Return Data User Manual
        return {
          id: user.id_pengguna, // UUID Database
          name: user.nama_lengkap,
          email: user.email,
          image: user.foto_profil_url,
        };
      },
    }),

    // 2. LOGIN GOOGLE
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
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
    // === CALLBACK 1: SIGN IN (Dijalankan saat tombol Login ditekan) ===
    async signIn({ user, account }: any) {
      // Jika login pakai Google
      if (account?.provider === "google") {
        const { email, name, image } = user;

        try {
          // Cek apakah user sudah ada di database?
          const existingUser = await prisma.pengguna.findUnique({
            where: { email: email },
          });

          // JIKA BELUM ADA, BUAT USER BARU (Auto Register)
          if (!existingUser) {
            await prisma.pengguna.create({
              data: {
                nama_lengkap: name || "Pengguna Google",
                email: email,
                foto_profil_url: image,
                // Password diisi random/kosong karena login via Google
                kata_sandi: "GOOGLE_AUTH_NO_PASS", 
                nomor_telepon: null, 
                status_akun: "aktif",
                wa_terverifikasi: true, // Asumsi email google valid
                peran: "penyewa",
              },
            });
          }
          return true; // Lanjut login
        } catch (error) {
          console.error("Error saving Google user:", error);
          return false; // Gagal login
        }
      }
      return true; // Untuk credentials, lanjut saja
    },

    // === CALLBACK 2: JWT (Memasukkan ID Database ke Token) ===
    async jwt({ token, user, account }: any) {
      if (user) {
        // Jika login via Google, 'user.id' isinya ID Google (angka panjang).
        // Kita harus cari UUID dari database kita sendiri.
        if (account?.provider === "google") {
          const dbUser = await prisma.pengguna.findUnique({
            where: { email: user.email },
          });
          if (dbUser) {
            token.id = dbUser.id_pengguna; // Pakai UUID Database
            token.picture = dbUser.foto_profil_url;
          }
        } else {
          // Jika login manual, 'user.id' sudah UUID (dari authorize)
          token.id = user.id;
        }
      }
      return token;
    },

    // === CALLBACK 3: SESSION (Agar Frontend bisa baca ID) ===
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.id; // ID ini sekarang pasti UUID Database
        session.user.name = token.name;
        session.user.image = token.picture;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };