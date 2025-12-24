import { DM_Sans } from "next/font/google";
import "./globals.css";
import Header from "@/components/Layout/Header";
import Footer from "@/components/Layout/Footer";
import { ThemeProvider } from "next-themes";
import ScrollToTop from "@/components/ScrollToTop";
import Aoscompo from "@/utils/aos";

// 1. IMPORT CHAT WIDGET
import ChatWidget from "@/components/Chat/ChatWidget";

// 2. IMPORT CHAT PROVIDER (Wajib ada agar Context berfungsi)
import { ChatProvider } from "@/context/ChatContext"; 

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
          {/* 3. BUNGKUS APLIKASI DENGAN CHAT PROVIDER */}
          <ChatProvider>
            <Aoscompo>
              <Header />
              {children}
              <Footer />
            </Aoscompo>
            
            <ScrollToTop />
            
            {/* Widget sekarang bisa dikontrol dari mana saja (Header/Sidebar/Footer) */}
            <ChatWidget />
          </ChatProvider>
          
        </ThemeProvider>
      </body>
    </html>
  );
}