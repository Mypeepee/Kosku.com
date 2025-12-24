import { DM_Sans } from "next/font/google";
import "./globals.css";
import Header from "@/components/Layout/Header";
import Footer from "@/components/Layout/Footer";
import { ThemeProvider } from "next-themes";
import ScrollToTop from "@/components/ScrollToTop";
import Aoscompo from "@/utils/aos";

const font = DM_Sans({ subsets: ["latin"] });

// --- BAGIAN INI YANG MENGUBAH JUDUL TAB BROWSER ---
export const metadata = {
  title: "Kosku.com - Solusi Pencari Kos Terbaik",
  description: "Temukan kos impian atau kelola bisnis kos Anda dengan mudah di Kosku.",
  icons: {
    // Pastikan Anda sudah menaruh file 'icon.svg' di folder src/app sesuai instruksi sebelumnya
    // Jika belum, kode ini akan mencari favicon default
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
          <Aoscompo>
            <Header />
            {children}
            <Footer />
          </Aoscompo>
          <ScrollToTop />
        </ThemeProvider>
      </body>
    </html>
  );
}