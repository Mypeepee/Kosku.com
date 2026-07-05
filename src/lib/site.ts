// src/lib/site.ts
// URL kanonik situs untuk metadata & share link. Override via env kalau perlu
// (mis. staging). metadataBase di root layout tetap pakai NEXT_PUBLIC_BASE_URL.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://solusindoaset.com"
).replace(/\/+$/, "");

// URL gambar Open Graph yang dibaca crawler WhatsApp/Facebook. Sengaja disajikan
// dari domain sendiri lewat proxy /api/og supaya crawler tak perlu mengambil
// foto dari host pihak ketiga (Google Drive / file.lelang.go.id) yang sering
// lambat, di-block hotlink, atau menolak koneksi dari luar negeri — sehingga
// preview di WhatsApp muncul TANPA gambar.
export function lelangOgImageUrl(id: string | number | bigint): string {
  return `${SITE_URL}/api/og/lelang/${id}`;
}
