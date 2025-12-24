import { HeaderItem } from "@/types/menu";

export const headerData: HeaderItem[] = [
  // 1. UTAMA: Pencarian (Bisa dipecah jika nanti ada Apartemen/Rumah)
  {
    label: "Cari Sewa",
    href: "/search", // Atau tetap /Carikos jika belum ada kategori lain
    submenu: [
      {
        label: "Cari Kos",
        href: "/Carikos",
      },
      {
        label: "Sewa Apartemen", // Persiapan masa depan
        href: "/apartemen",
      },
    ],
  },

  // 3. EDUKASI & SEO: Konten menarik untuk user
  {
    label: "Blog",
    href: "/blog",
  },

  // 4. TRUST: Agar user merasa aman
  {
    label: "Bantuan",
    href: "/help",
  },

  // 5. SUPPLY SIDE: Menu untuk pemilik (Dipisah agar eksklusif)
  {
    label: "Jadi Juragan", // Wording lebih menarik daripada "Pemilik Kos"
    href: "/owner",
    submenu: [
      {
        label: "Sewakan Properti",
        href: "/owner/register",
      },
      {
        label: "Kenapa Kosku?",
        href: "/kenapa-kosku",
      },
      {
        label: "Manajemen Kos (AI)",
        href: "/owner/management",
      },
      {
        label: "Auto Tagih",
        href: "/owner/billing",
      },
    ],
  },
];