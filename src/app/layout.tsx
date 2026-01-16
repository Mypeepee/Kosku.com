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
import NextAuthProvider from "@/providers/NextAuthProvider"; 
import { Toaster } from "react-hot-toast"; 

const font = DM_Sans({ subsets: ["latin"] });

export const metadata = {
  // REVISI: Judul Website (Akan muncul di Tab Browser & Google)
  title: "Premier Asset - Satu Aplikasi untuk Semua Kebutuhan Properti Anda",
  
  // REVISI: Deskripsi Website (Untuk SEO Google)
  description: "Platform terintegrasi untuk jual beli properti Primary, Secondary, dan Aset Lelang. Temukan investasi properti terbaik dan aman bersama Premier Asset.",
  
  icons: {
    icon: "/images/logo/logopremier.svg", // Logo di Tab Browser (Favicon)
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
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
                <Header /> 
                {children}
                <Footer />
              </Aoscompo>
              
              <ScrollToTop />
              <ChatWidget />
              <Toaster position="top-center" /> 
              
            </ChatProvider>
            
          </NextAuthProvider>
          
        </ThemeProvider>
      </body>
    </html>
  );
}