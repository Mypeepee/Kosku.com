// src/lib/fotoListing.ts
// ---------------------------------------------------------------------------
// MENGAMBIL FOTO LISTING DARI HOST PIHAK KETIGA.
//
// Diangkat dari src/app/api/og/lelang/[id]/route.ts supaya dipakai bersama
// dengan proxy foto untuk email. Keduanya menghadapi persoalan yang sama
// persis, dan begitu tekniknya disalin ke tempat kedua, satu di antaranya akan
// tertinggal saat host sumbernya mengubah aturannya — lalu separuh gambar
// menghilang di satu permukaan saja, tanpa ada yang tahu kenapa.
//
// ── PERSOALANNYA ──────────────────────────────────────────────────────────
// 120.007 dari 120.393 foto listing dilayani file.lelang.go.id, dan host itu
// MEMBLOKIR HOTLINK: permintaan tanpa `Referer` yang benar ditolak. Sisanya di
// Google Drive, yang butuh bentuk URL khusus.
//
// Akibatnya di luar dugaan sampai dialami: klien email (Gmail, Outlook) tidak
// memuat gambar langsung dari perangkat penerima — mereka mem-proxy-nya lewat
// server sendiri, dan proxy itu TIDAK mengirim Referer apa pun. Jadi <img> yang
// menunjuk langsung ke file.lelang.go.id akan kosong di hampir setiap email.
// Server kita bisa menjangkaunya; penerima email tidak.
// ---------------------------------------------------------------------------

const FETCH_TIMEOUT_MS = 8000;
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Ubah nilai kolom `gambar` (URL penuh, atau Google Drive file-id, dipisah
 *  koma) jadi URL yang bisa di-fetch server-side.
 *  null → tidak ada sumber yang bisa diambil; pemanggil memakai cadangan. */
export function resolveFetchableImage(
  gambar: string | null | undefined,
  lebar = 1200,
): string | null {
  if (!gambar) return null;
  const first = gambar.split(",").map(s => s.trim()).filter(Boolean)[0];
  if (!first) return null;
  if (first.startsWith("http://") || first.startsWith("https://")) return first;
  if (first.startsWith("/")) return null; // aset lokal → cadangan
  return `https://drive.google.com/thumbnail?id=${first}&sz=w${lebar}`;
}

/** Ambil byte gambarnya. Mengembalikan null pada kegagalan APA PUN — pemanggil
 *  wajib menyiapkan cadangan, karena gambar rusak di tengah email lebih buruk
 *  daripada tidak ada gambar. */
export async function fetchImageBytes(src: string): Promise<Buffer | null> {
  const headers: Record<string, string> = { "User-Agent": BROWSER_UA };
  try {
    /* Referer dipalsukan seakan-akan permintaan datang dari host itu sendiri —
       inilah satu-satunya cara melewati proteksi hotlink file.lelang.go.id. */
    const u = new URL(src);
    headers["Referer"] = `${u.protocol}//${u.host}/`;
  } catch {}
  try {
    const res = await fetch(src, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (ct && !ct.startsWith("image/")) return null; // halaman galat HTML, dll.
    const ab = await res.arrayBuffer();
    if (ab.byteLength === 0) return null;
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

/**
 * Siapkan foto listing sebagai LAMPIRAN INLINE untuk email.
 *
 * ── KENAPA DILAMPIRKAN, BUKAN DITAUTKAN ───────────────────────────────────
 * Foto yang ditautkan hanya muncul bila SEMUA syarat ini terpenuhi: rutenya
 * sudah ter-deploy di domain publik, listing-nya ada di database produksi,
 * host sumbernya mengizinkan, dan klien emailnya tidak memblokir gambar jarak
 * jauh. Empat syarat, dan cukup satu gagal untuk membuat seluruh email jadi
 * deretan kotak kosong — yang persis terjadi saat email dikirim dari mesin
 * pengembangan, karena Gmail tidak bisa menjangkau localhost.
 *
 * Dilampirkan, fotonya ikut di dalam suratnya. Tidak ada permintaan jaringan
 * yang bisa gagal, tidak ada host yang bisa menolak, tidak ada yang bergantung
 * pada deployment. Untuk email properti ini bukan kemewahan: aset tanpa foto
 * praktis tidak bisa ditawarkan, dan foto pula yang diberi bobot terbesar di
 * mesin peringkat.
 *
 * Harganya ukuran surat. Karena itu ada batas, dan yang melewatinya jatuh
 * kembali ke tautan proxy — bukan hilang.
 */
export type FotoInline = { cid: string; content: Buffer };

/** Ukuran yang benar-benar dipakai kartu email (118px) dikali dua untuk layar
 *  retina. Lebih besar dari ini hanya menambah berat surat tanpa terlihat. */
const LEBAR_INLINE = 236;
const TINGGI_INLINE = 296;

export async function siapkanFotoInline(
  daftar: { id_property: bigint | string; gambar: string | null }[],
  maks: number,
): Promise<Map<string, FotoInline>> {
  const hasil = new Map<string, FotoInline>();
  if (maks <= 0) return hasil;

  /* Diambil berurutan, bukan Promise.all: tiap pengambilan menembak host pihak
     ketiga yang lambat, dan dua belas permintaan serentak ke file.lelang.go.id
     adalah cara yang bagus untuk diblokir. */
  const sharp = (await import("sharp")).default;
  for (const l of daftar) {
    if (hasil.size >= maks) break;
    const id = l.id_property.toString();
    if (hasil.has(id)) continue;
    const src = resolveFetchableImage(l.gambar, LEBAR_INLINE * 2);
    if (!src) continue;
    const byte = await fetchImageBytes(src);
    if (!byte) continue;
    try {
      const kecil = await sharp(byte)
        .resize(LEBAR_INLINE, TINGGI_INLINE, { fit: "cover", position: "attention" })
        .jpeg({ quality: 72, mozjpeg: true })
        .toBuffer();
      hasil.set(id, { cid: `aset-${id}`, content: kecil });
    } catch {
      /* Sumber korup / format tak didukung → lewati. Kartu itu jatuh ke tautan
         proxy seperti sebelumnya; satu foto hilang jauh lebih ringan daripada
         seluruh email gagal terkirim. */
    }
  }
  return hasil;
}
