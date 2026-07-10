import type { Metadata } from "next";
import BlogIndex from "./BlogIndex";
import {
  BERITA_KATEGORI,
  getFeatured,
  getPublishedList,
  getCategoryCounts,
} from "@/lib/berita";

// ISR: konten awal (featured + halaman 1 + jumlah kategori) di-cache & di-refresh
// tiap 5 menit. Pencarian/pagination tetap real-time lewat API di BlogIndex.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Berita & Insight Pasar Properti Indonesia | Solusindo Aset",
  description:
    "Strategi investasi, panduan lelang, analisa pasar, hingga legalitas properti — wawasan editorial untuk keputusan properti yang lebih cerdas.",
  openGraph: {
    title: "Berita & Insight Pasar Properti Indonesia",
    description:
      "Wawasan editorial properti: lelang, KPR, analisa pasar, dan legalitas.",
    type: "website",
  },
};

const PAGE_SIZE = 9;

export default async function BlogPage() {
  let featured: Awaited<ReturnType<typeof getFeatured>> = null;
  let initial: Awaited<ReturnType<typeof getPublishedList>> = {
    items: [], total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1,
  };
  let counts: Awaited<ReturnType<typeof getCategoryCounts>> = {};
  try {
    [featured, initial, counts] = await Promise.all([
      getFeatured(),
      getPublishedList({ page: 1, pageSize: PAGE_SIZE }),
      getCategoryCounts(),
    ]);
  } catch {
    // DB sempat tak terjangkau (mis. saat build) → render kosong, ISR akan
    // mengisi ulang pada revalidate berikutnya. Build tidak gagal.
  }

  // Keep the featured article out of the page-1 grid to avoid duplication.
  const gridItems = featured
    ? initial.items.filter((i) => i.slug !== featured.slug)
    : initial.items;

  const totalPublished = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <BlogIndex
      featured={featured}
      initialItems={gridItems}
      initialTotalPages={initial.totalPages}
      categories={[...BERITA_KATEGORI]}
      categoryCounts={counts}
      totalPublished={totalPublished}
      pageSize={PAGE_SIZE}
    />
  );
}
