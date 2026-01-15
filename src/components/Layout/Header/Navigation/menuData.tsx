import { HeaderItem } from "@/types/menu";

export const headerData: HeaderItem[] = [
  // 1. CARI PROPERTI (Pintu Gerbang Utama)
  {
    label: "Cari Properti",
    href: "/search", // Fallback link
    submenu: [
      {
        label: "Proyek Baru (Primary)", 
        href: "/search/primary", // ✅ Arahkan ke Landing Page Primary
        description: "Project baru & indent dari developer",
        icon: "solar:city-bold",
      },
      {
        label: "Properti Second",
        href: "/search/secondary", // ✅ Arahkan ke Landing Page Secondary
        description: "Rumah siap huni & resale",
        icon: "solar:home-2-bold", 
      },
      {
        label: "Aset Lelang",
        href: "/search/lelang", // ✅ Arahkan ke Landing Page Lelang
        description: "Aset investasi di bawah harga pasar",
        icon: "solar:tag-price-bold",
      },
      {
        label: "Sewa & Kos",
        href: "/sewa",
        description: "Pilihan sewa harian hingga tahunan",
        icon: "solar:key-minimalistic-square-bold",
      },
    ],
  },

  // ... (Menu Agent, Tentang Kami, dll tetap sama)
  {
    label: "Agent Kami",
    href: "/agents",
  },
  {
    label: "Tentang Kami",
    href: "/about",
    submenu: [
      {
        label: "Profil Perusahaan",
        href: "/about/profile",
        icon: "solar:buildings-2-bold",
      },
      {
        label: "Gabung Jadi Agent",
        href: "/careers/join-agent",
        icon: "solar:user-hand-up-bold",
      },
      {
        label: "Titip Jual Properti",
        href: "/titip-jual",
        icon: "solar:hand-shake-bold",
      },
    ],
  },
  {
    label: "Blog",
    href: "/blog",
  },
  {
    label: "Bantuan",
    href: "/help",
  },
];