import { DM_Sans } from "next/font/google";
import "./globals.css";
import Header from "@/components/Layout/Header";
import Footer from "@/components/Layout/Footer";
import { ThemeProvider } from "next-themes";
import ScrollToTop from "@/components/ScrollToTop";
import Aoscompo from "@/utils/aos";

// 1. IMPORT CHAT WIDGET
import ChatWidget from "@/components/Chat/ChatWidget";

// 2. IMPORT PROVIDERS
import { ChatProvider } from "@/context/ChatContext"; 
import NextAuthProvider from "@/providers/NextAuthProvider"; // 👈 IMPORT INI (Sesuaikan lokasi file Langkah 1)
import { Toaster } from "react-hot-toast"; // (Opsional: Agar toast muncul di semua halaman)

const font = DM_Sans({ subsets: ["latin"] });

export const metadata = {
  title: "Kosku.com - Solusi Pencari Kos Terbaik",
  description: "Temukan kos impian atau kelola bisnis kos Anda dengan mudah di Kosku.",
  icons: {
    icon: "/images/logo/logokosku.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${font.className}`}>
        <ThemeProvider
          attribute="class"
          enableSystem={true}
          defaultTheme="system"
        >
          {/* 3. BUNGKUS DENGAN SESSION PROVIDER */}
          <NextAuthProvider>
            
            {/* 4. CHAT PROVIDER */}
            <ChatProvider>
              <Aoscompo>
                <Header /> {/* Header sekarang bisa akses session login */}
                {children}
                <Footer />
              </Aoscompo>
              
              <ScrollToTop />
              <ChatWidget />
              <Toaster position="top-center" /> {/* Tambahan agar notifikasi toast muncul */}
              
            </ChatProvider>
            
          </NextAuthProvider>
          
        </ThemeProvider>
      </body>
    </html>
  );
}