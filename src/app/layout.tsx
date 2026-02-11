import { DM_Sans } from "next/font/google";
import "./globals.css";
import Header from "@/components/Layout/Header";
import FooterWrapper from "@/components/Layout/Footer/FooterWrapper";

import { ThemeProvider } from "next-themes";
import ScrollToTop from "@/components/ScrollToTop";
import Aoscompo from "@/utils/aos";

import type { Metadata } from "next";

import ChatWidget from "@/components/Chat/ChatWidget";
import { ChatProvider } from "@/context/ChatContext";
import NextAuthProvider from "@/providers/NextAuthProvider";
import { Toaster } from "sonner"; // ✅ Ganti dari react-hot-toast ke sonner
import LoadingBar from "@/components/LoadingBar";

import "@/lib/cron";

const font = DM_Sans({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
  ),
  title:
    "Premier Asset - Satu Aplikasi untuk Semua Kebutuhan Properti Anda",
  description:
    "Platform terintegrasi untuk jual beli properti Primary, Secondary, dan Aset Lelang. Temukan investasi properti terbaik dan aman bersama Premier Asset.",
  icons: {
    icon: "/images/logo/logopremier.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={font.className}>
        {/* Global loading bar */}
        <LoadingBar />

        <ThemeProvider
          attribute="class"
          enableSystem={true}
          defaultTheme="system"
        >
          <NextAuthProvider>
            <ChatProvider>
              <Aoscompo>
                <Header />
                {children}
                {/* Footer tidak muncul di /dashboard/* */}
                <FooterWrapper />
              </Aoscompo>

              <ScrollToTop />
              <ChatWidget />
              
              {/* ✅ Sonner Toaster - Modern & Beautiful */}
              <Toaster 
                position="top-right"
                expand={false}
                richColors
                closeButton
                theme="system" // Ikut theme (dark/light)
                toastOptions={{
                  style: {
                    background: 'rgba(15, 23, 42, 0.95)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#e2e8f0',
                    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
                  },
                  className: 'group',
                  duration: 4000,
                }}
              />
            </ChatProvider>
          </NextAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
