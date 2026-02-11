import NextAuth, { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export const authOptions: AuthOptions = {
  providers: [
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

        if (!user.kata_sandi) {
          throw new Error("Akun terdaftar via Google. Silakan login dengan tombol Google.");
        }

        const isPasswordCorrect = await bcrypt.compare(
          credentials.password,
          user.kata_sandi
        );

        if (!isPasswordCorrect) {
          throw new Error("Kata sandi salah.");
        }

        return {
          id: user.id_pengguna,
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
    async signIn({ user, account, profile }: any) {
      if (account?.provider === "google") {
        try {
          if (!profile?.email) throw new Error("Google tidak memberikan email.");

          const existingUser = await prisma.pengguna.findFirst({
            where: {
              OR: [
                { google_id: account.providerAccountId },
                { email: profile.email },
              ],
            },
          });

          if (!existingUser) {
            await prisma.pengguna.create({
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
          } else if (!existingUser.google_id) {
            await prisma.pengguna.update({
              where: { id_pengguna: existingUser.id_pengguna },
              data: {
                google_id: account.providerAccountId,
                foto_profil_url: existingUser.foto_profil_url || profile.picture,
              },
            });
          }

          return true;
        } catch (error) {
          console.error("Error saving Google user:", error);
          return false;
        }
      }
      return true;
    },

    async jwt({ token, user, account }: any) {
      // Saat pertama login (credentials)
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }

      // Khusus Google: ambil id & role dari DB
      if (account?.provider === "google" && token.email) {
        const dbUser = await prisma.pengguna.findUnique({
          where: { email: token.email },
          select: { id_pengguna: true, peran: true },
        });

        if (dbUser) {
          token.id = dbUser.id_pengguna;
          token.role = dbUser.peran;
        }
      }

      // ✅ LOOKUP AGENT (SELALU, baik credentials maupun Google)
      if (token.id) {
        const agent = await prisma.agent.findUnique({
          where: { id_pengguna: token.id as string },
          select: { id_agent: true },
        });

        token.agentId = agent?.id_agent || null;
      } else {
        token.agentId = null;
      }

      return token;
    },

    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.agentId = token.agentId; // ✅ agentId masuk ke session
      }

      console.log('✅ Session created:', {
        id: session.user.id,
        role: session.user.role,
        agentId: session.user.agentId,
      });

      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
