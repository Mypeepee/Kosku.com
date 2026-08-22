// src/lib/site.ts
// URL kanonik situs untuk metadata & share link. Override via env kalau perlu
// (mis. staging). metadataBase di root layout tetap pakai NEXT_PUBLIC_BASE_URL.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://solusindoaset.com"
).replace(/\/+$/, "");

/**
 * URL yang HARUS bisa dijangkau dari luar jaringan kita — dipakai email.
 *
 * `NEXT_PUBLIC_BASE_URL` di mesin pengembangan berisi `http://localhost:3000`,
 * dan itu benar untuk halaman web: peramban agent memang berada di mesin yang
 * sama. Tapi email dibaca di Gmail, dan server Gmail yang mengambil gambarnya
 * TIDAK berada di mesin itu. Setiap <img> yang menunjuk ke localhost muncul
 * sebagai kotak rusak di kotak masuk — logo dan foto aset sekaligus.
 *
 * Kegagalannya diam: pengirimannya sukses, HTML-nya benar, hanya gambarnya yang
 * tidak pernah ada. Maka alamat lokal ditolak di sini, bukan diteruskan.
 */
export const URL_PUBLIK: string = (() => {
  const lokal = /localhost|127\.0\.0\.1|0\.0\.0\.0|::1|\.local(:|$)/i;
  const kandidat = [process.env.NEXT_PUBLIC_SITE_URL, process.env.NEXT_PUBLIC_BASE_URL]
    .map(v => (v || "").trim().replace(/\/+$/, ""))
    .filter(Boolean);

  for (const u of kandidat) if (!lokal.test(u)) return u;

  if (kandidat.length > 0 && process.env.NODE_ENV !== "production") {
    console.warn(
      "[site] URL publik hanya menunjuk ke alamat lokal (" + kandidat.join(", ") + "). " +
      "Email memakai https://solusindoaset.com supaya gambarnya tidak jadi kotak rusak — " +
      "tapi aset yang belum ter-deploy di sana tetap tidak akan tampil.",
    );
  }
  return "https://solusindoaset.com";
})();

// URL gambar Open Graph yang dibaca crawler WhatsApp/Facebook. Sengaja disajikan
// dari domain sendiri lewat proxy /api/og supaya crawler tak perlu mengambil
// foto dari host pihak ketiga (Google Drive / file.lelang.go.id) yang sering
// lambat, di-block hotlink, atau menolak koneksi dari luar negeri — sehingga
// preview di WhatsApp muncul TANPA gambar.
export function lelangOgImageUrl(id: string | number | bigint): string {
  return `${SITE_URL}/api/og/lelang/${id}`;
}
