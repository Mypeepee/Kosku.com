// src/lib/klienPesan.ts
// ---------------------------------------------------------------------------
// PENYUSUN PESAN UNTUK KLIEN — draf yang tinggal diketuk agent.
//
// Keputusan produk yang mendasari berkas ini: sistem TIDAK mengirim WhatsApp
// sendiri. Ia menyusun pesannya sampai selesai, lalu menyerahkan satu tautan
// wa.me; agent mengetuk sekali dan WhatsApp terbuka dengan teks siap kirim.
//
// Kenapa begitu, bukan gateway otomatis:
//   • Tidak ada satu pun integrasi WhatsApp di kode ini — semua lewat wa.me.
//   • Nomor WhatsApp pribadi agent yang dipakai mengirim blasting otomatis
//     adalah nomor yang cepat atau lambat diblokir; yang hilang bukan cuma
//     fitur ini, tapi seluruh riwayat percakapan kerjanya.
//   • Klien properti membalas manusia. Pesan yang jelas-jelas robot menurunkan
//     tingkat balasan justru pada pekerjaan yang seluruh gunanya ada di balasan.
// Yang diotomatiskan adalah bagian yang membosankan — menyusun daftar, menulis
// harga, menempel tautan — bukan bagian yang butuh penilaian manusia.
//
// Seluruh fungsi di sini MURNI (tanpa I/O) supaya bisa diuji dan dipakai baik
// dari server maupun browser.
// ---------------------------------------------------------------------------

import { SITE_URL } from "@/lib/site";

export type AsetPesan = {
  id_property: string;
  slug: string;
  judul: string;
  jenis_transaksi: string;
  kategori: string;
  harga: number;
  kota: string;
  kecamatan?: string | null;
  luas_tanah?: number | null;
  luas_bangunan?: number | null;
  kamar_tidur?: number | null;
  kamar_mandi?: number | null;
};

/** Jalur detail properti, TANPA nama domain — harus persis sama dengan
 *  getPropertyUrl di sisi publik, kalau tidak tautannya berujung 404.
 *
 *  Dipisah dari `urlListing()` karena keduanya dipakai untuk dua hal yang
 *  berbeda: pesan ke klien WAJIB memuat domain, sedangkan tautan di dalam
 *  dashboard TIDAK BOLEH — SITE_URL menunjuk ke solusindoaset.com, jadi agent
 *  yang mengetuk "Lihat detail" saat mengembangkan di localhost akan
 *  terlempar ke situs produksi. Pemetaan rutenya tetap satu tempat.
 *
 *  ── KODE AGENT DI EKOR URL ────────────────────────────────────────────────
 *  `…/Lelang/rumah-wiyung-153266/AG108` membuka halaman yang sama, tapi dengan
 *  AG108 sebagai AGENT PENYAJI: tombol "hubungi agent" di situ menunjuk
 *  kepadanya, bukan kepada pemilik listing.
 *
 *  Ini yang membuat asisten aset bisa menawarkan SELURUH persediaan kantor,
 *  bukan cuma listing milik agent itu sendiri. Tanpa kode itu, agent yang
 *  mengirimkan rumah milik rekannya sedang menyerahkan kliennya — klien
 *  membuka tautan, menekan "hubungi", dan sampai ke orang lain.
 *
 *  HANYA untuk Jual & Lelang. Rute Sewa TIDAK punya segmen agent
 *  (src/app/Sewa/[id] tanpa [agentId]), jadi menempelkannya di sana
 *  menghasilkan 404 — kegagalan yang mendarat di tangan KLIEN, bukan agent.
 *  Kode yang tidak sah atau agent non-aktif pun aman: halaman detailnya
 *  memvalidasi `^AG\d+$` lalu jatuh ke pemilik listing. */
export function pathListing(
  a: { slug: string; id_property: string; jenis_transaksi: string },
  idAgent?: string | null,
): string {
  const id = `${a.slug}-${a.id_property}`;
  const kode = (idAgent || "").trim();
  const ekor = /^AG\d+$/i.test(kode) ? `/${kode.toUpperCase()}` : "";
  switch ((a.jenis_transaksi || "").toUpperCase()) {
    case "SEWA":   return `/Sewa/${id}`;            // tanpa segmen agent
    case "LELANG": return `/Lelang/${id}${ekor}`;
    default:       return `/Jual/${id}${ekor}`;
  }
}

/** URL detail properti lengkap dengan domain — untuk pesan yang keluar dari
 *  aplikasi (WhatsApp, email). Sertakan `idAgent` pada apa pun yang sampai ke
 *  KLIEN, supaya tombol hubungi di halaman detail kembali ke agent pengirim. */
export function urlListing(
  a: { slug: string; id_property: string; jenis_transaksi: string },
  idAgent?: string | null,
): string {
  return `${SITE_URL}${pathListing(a, idAgent)}`;
}

export function rupiah(n: number): string {
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

/** Rupiah pendek untuk badan pesan. WhatsApp di ponsel memecah baris panjang;
 *  "Rp 1,25 M" terbaca sekali lihat, "Rp 1.250.000.000" tidak. */
export function rupiahRingkas(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e12) return `Rp ${(n / 1e12).toFixed(a >= 1e13 ? 0 : 1).replace(".", ",")} T`;
  if (a >= 1e9)  return `Rp ${(n / 1e9).toFixed(a >= 1e10 ? 0 : 1).replace(".", ",")} M`;
  if (a >= 1e6)  return `Rp ${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(".", ",")} jt`;
  return rupiah(n);
}

const sapaan = (nama: string) => `Halo ${nama.trim().split(/\s+/)[0] || "Bapak/Ibu"}`;

/** Nama panggilan kategori untuk kalimat pembuka ("2 rumah", "3 kos"). */
function sebutKategori(kategori: string, jumlah: number): string {
  const k = kategori.toUpperCase();
  const kata: Record<string, string> = {
    RUMAH: "rumah", APARTEMEN: "apartemen", RUKO: "ruko", TANAH: "tanah",
    GUDANG: "gudang", HOTEL_DAN_VILLA: "villa", TOKO: "toko", PABRIK: "pabrik", KOS: "kos",
  };
  return `${jumlah} ${kata[k] ?? "properti"}`;
}

/* ── 1. Kiriman rekomendasi ────────────────────────────────────────────── */

export function pesanRekomendasi(opsi: {
  namaKlien: string;
  namaAgent?: string | null;
  /** Kode agent PENGIRIM (mis. "AG108"). Ditempelkan di ekor tiap tautan
   *  supaya tombol "hubungi agent" di halaman detail kembali kepadanya —
   *  termasuk saat asetnya milik agent lain. Tanpa ini, agent yang menawarkan
   *  listing rekannya sedang menyerahkan kliennya. */
  idAgent?: string | null;
  aset: AsetPesan[];
  maksud: "BELI" | "SEWA";
}): string {
  const { namaKlien, namaAgent, idAgent, aset, maksud } = opsi;
  if (aset.length === 0) return "";

  const kerja = maksud === "SEWA" ? "disewa" : "dibeli";
  const seragam = aset.every(a => a.kategori === aset[0].kategori);
  const sebutan = seragam ? sebutKategori(aset[0].kategori, aset.length) : `${aset.length} properti`;

  const baris: string[] = [
    `${sapaan(namaKlien)}, saya ada ${sebutan} yang sepertinya cocok dengan kriteria yang Bapak/Ibu cari untuk ${kerja}:`,
    "",
  ];

  aset.forEach((a, i) => {
    /* Penomoran hanya bila lebih dari satu. Satu aset yang diberi nomor "1."
       terbaca seperti potongan katalog, bukan seperti orang yang memang
       memikirkan Anda. */
    const kepala = aset.length > 1 ? `${i + 1}. *${a.judul}*` : `*${a.judul}*`;
    baris.push(kepala);
    baris.push(`   ${rupiahRingkas(a.harga)}`);

    const lokasi = [a.kecamatan, a.kota].filter(Boolean).join(", ");
    if (lokasi) baris.push(`   📍 ${lokasi}`);

    const spek: string[] = [];
    if (a.luas_tanah)    spek.push(`LT ${a.luas_tanah} m²`);
    if (a.luas_bangunan) spek.push(`LB ${a.luas_bangunan} m²`);
    if (a.kamar_tidur)   spek.push(`${a.kamar_tidur} KT`);
    if (a.kamar_mandi)   spek.push(`${a.kamar_mandi} KM`);
    if (spek.length) baris.push(`   ${spek.join(" · ")}`);

    baris.push(`   ${urlListing(a, idAgent)}`);
    baris.push("");
  });

  baris.push(
    aset.length > 1
      ? "Kalau ada yang menarik, saya bisa aturkan jadwal survei. Ada yang ingin dilihat lebih dulu?"
      : "Kalau berkenan, saya bisa aturkan jadwal survei. Kapan waktu yang pas untuk Bapak/Ibu?",
  );
  if (namaAgent) baris.push("", `— ${namaAgent}`);

  return baris.join("\n");
}

/* ── 2. Kabar perubahan pada aset yang sudah dikirim ───────────────────── */

export type JenisPerubahan = "HARGA_TURUN" | "HARGA_NAIK" | "TERJUAL" | "DITARIK" | "LELANG_DEKAT";

export function pesanPerubahan(opsi: {
  namaKlien: string;
  namaAgent?: string | null;
  /** Kode agent pengirim — lihat catatan di pesanRekomendasi(). */
  idAgent?: string | null;
  aset: AsetPesan;
  jenis: JenisPerubahan;
  hargaLama?: number | null;
  hargaBaru?: number | null;
  tanggalLelang?: string | null;
}): string {
  const { namaKlien, namaAgent, idAgent, aset, jenis, hargaLama, hargaBaru } = opsi;
  const tautan = urlListing(aset, idAgent);
  const b: string[] = [];

  switch (jenis) {
    case "HARGA_TURUN": {
      const turun = (hargaLama ?? 0) - (hargaBaru ?? 0);
      b.push(
        `${sapaan(namaKlien)}, ada kabar baik untuk *${aset.judul}* yang saya kirim kemarin — harganya turun.`,
        "",
        `Sebelumnya: ${rupiahRingkas(hargaLama ?? 0)}`,
        `Sekarang: *${rupiahRingkas(hargaBaru ?? 0)}*`,
        turun > 0 ? `Turun ${rupiahRingkas(turun)}.` : "",
        "",
        tautan,
        "",
        "Kalau masih diminati, sebaiknya kita lihat langsung sebelum ada yang mendahului. Kapan Bapak/Ibu ada waktu?",
      );
      break;
    }
    case "HARGA_NAIK":
      b.push(
        `${sapaan(namaKlien)}, sekadar mengabari — harga *${aset.judul}* naik dari ${rupiahRingkas(hargaLama ?? 0)} menjadi ${rupiahRingkas(hargaBaru ?? 0)}.`,
        "",
        tautan,
        "",
        "Kalau masih masuk anggaran, saya bantu ajukan penawaran. Kalau tidak, saya carikan alternatif lain.",
      );
      break;
    case "TERJUAL":
      /* Kabar buruk tetap dikirim, dan dikirim lebih dulu. Klien yang
         menemukan sendiri bahwa asetnya sudah laku akan menyimpulkan agennya
         tidak memantau apa pun. */
      b.push(
        `${sapaan(namaKlien)}, sayang sekali *${aset.judul}* sudah laku.`,
        "",
        "Saya sudah cari penggantinya dengan kriteria yang sama — sebentar lagi saya kirimkan. Kalau ada yang ingin ditambah atau diubah dari kriterianya, boleh kabari saya.",
      );
      break;
    case "DITARIK":
      b.push(
        `${sapaan(namaKlien)}, *${aset.judul}* ditarik dari penawaran oleh pemiliknya.`,
        "",
        "Saya carikan alternatif dengan kriteria yang sama ya.",
      );
      break;
    case "LELANG_DEKAT":
      b.push(
        `${sapaan(namaKlien)}, pengingat — lelang *${aset.judul}* sudah dekat${opsi.tanggalLelang ? ` (${opsi.tanggalLelang})` : ""}.`,
        "",
        `Limit: ${rupiahRingkas(aset.harga)}`,
        tautan,
        "",
        "Kalau berminat ikut, dokumen dan uang jaminan perlu disiapkan dari sekarang. Saya bantu prosesnya.",
      );
      break;
  }

  if (namaAgent) b.push("", `— ${namaAgent}`);
  return b.filter(x => x !== undefined).join("\n").replace(/\n{3,}/g, "\n\n");
}

/* ── 3. Follow-up klien yang lama tidak disentuh ───────────────────────── */

export function pesanFollowUp(opsi: {
  namaKlien: string;
  namaAgent?: string | null;
  hariSejakKontak: number;
}): string {
  const { namaKlien, namaAgent, hariSejakKontak } = opsi;
  const b = [
    `${sapaan(namaKlien)}, semoga sehat selalu.`,
    "",
    hariSejakKontak >= 30
      ? "Sudah cukup lama kita tidak bertukar kabar. Apakah pencarian propertinya masih berjalan, atau kriterianya sudah berubah?"
      : "Saya mau menanyakan kelanjutan pencarian propertinya. Apakah dari yang saya kirim kemarin ada yang menarik untuk dilihat langsung?",
    "",
    "Kalau ada perubahan budget atau lokasi, kabari saja — saya sesuaikan pencariannya.",
  ];
  if (namaAgent) b.push("", `— ${namaAgent}`);
  return b.join("\n");
}

/* ── Tautan wa.me ──────────────────────────────────────────────────────── */

/** Tautan WhatsApp berisi pesan siap kirim.
 *  Nomor dibersihkan dari segala non-digit; nomor yang diawali 0 diubah ke 62
 *  karena wa.me hanya menerima format internasional tanpa tanda plus. */
export function tautanWa(nomor: string, pesan: string): string {
  let d = (nomor || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = `62${d.slice(1)}`;
  else if (d.startsWith("8")) d = `62${d}`;
  return `https://wa.me/${d}?text=${encodeURIComponent(pesan)}`;
}
