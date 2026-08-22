// src/lib/asistenToken.ts
// ---------------------------------------------------------------------------
// TIKET SATU KETUKAN — dari email langsung ke draf WhatsApp.
//
// Masalah yang dipecahkan: email pemberitahuan "ada 3 aset baru untuk Budi"
// tidak ada gunanya kalau menindaklanjutinya masih menuntut buka dashboard →
// cari Budi → cari aset → pilih → kirim. Yang tersisa dari otomatisasi itu
// cuma pemberitahuannya; pekerjaannya utuh.
//
// Tombol di dalam email membawa tiket ini. Endpoint /api/asisten/kirim
// memverifikasinya, MENCATAT kirimannya, lalu mengalihkan langsung ke wa.me
// dengan draf yang sudah jadi.
//
// ── KENAPA TIKET, BUKAN SESI LOGIN ────────────────────────────────────────
// Email dibuka di ponsel, dan ponsel sering belum login ke dashboard. Kalau
// tautannya menuntut sesi, tombolnya akan mendarat di halaman login — dan
// satu ketukan berubah jadi enam. Tiketnya sendiri yang membawa identitas.
//
// ── BATAS KEWENANGANNYA ───────────────────────────────────────────────────
// Tiket ini HANYA bisa melakukan satu hal: mencatat aset yang sudah tertulis
// di dalamnya untuk klien yang sudah tertulis di dalamnya, lalu menyusun draf.
// Ia tidak bisa membaca daftar klien, tidak bisa mengubah apa pun yang lain,
// dan tidak MENGIRIM pesan — WhatsApp tetap terbuka dengan tombol kirim yang
// harus ditekan manusia. Yang paling buruk yang bisa terjadi bila tautannya
// bocor adalah munculnya satu baris kiriman dan terbukanya nomor klien —
// nomor yang memang sudah tercetak di email penerima yang sama.
//
// Ditandatangani HMAC-SHA256 dan berkedaluwarsa. Tanpa tanda tangan, mengubah
// satu huruf id klien di URL akan membuat siapa pun bisa memancing nomor
// WhatsApp klien mana pun di seluruh sistem.
// ---------------------------------------------------------------------------

import { createHmac, timingSafeEqual } from "crypto";

/** Umur tiket. Tujuh hari: email dibaca hari Senin dan ditindaklanjuti hari
 *  Rabu adalah perilaku normal, tapi aset yang sudah sebulan lewat tidak boleh
 *  masih bisa dikirim dengan sekali ketuk — harganya sudah bukan harga itu. */
const UMUR_HARI = 7;

export type IsiTiket = {
  /** agent pemilik klien — kewenangan tiketnya berhenti di sini. */
  a: string;
  /** id klien tujuan. */
  k: string;
  /** id_property yang akan dicatat. */
  p: string[];
  /** id_preferensi asal tiap aset, sejajar indeks dengan `p`. Boleh kosong. */
  r?: (string | null)[];
  /** kedaluwarsa, epoch detik. */
  e: number;
};

function rahasia(): string {
  /* NEXTAUTH_SECRET lebih dulu: ia SELALU ada di lingkungan yang berjalan
     (NextAuth menolak start tanpanya), sementara CRON_SECRET opsional. Kunci
     tanda tangan yang kadang-kadang kosong adalah tanda tangan yang kadang-
     kadang bisa dipalsukan siapa saja. */
  const s = process.env.NEXTAUTH_SECRET || process.env.CRON_SECRET || "";
  if (!s) throw new Error("NEXTAUTH_SECRET / CRON_SECRET belum di-set — tiket asisten tidak bisa ditandatangani");
  return s;
}

const b64url = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const dariB64url = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

function tandaTangan(muatan: string): string {
  return b64url(createHmac("sha256", rahasia()).update(muatan).digest());
}

export function buatTiket(isi: Omit<IsiTiket, "e"> & { e?: number }): string {
  const lengkap: IsiTiket = { ...isi, e: isi.e ?? Math.floor(Date.now() / 1000) + UMUR_HARI * 86_400 };
  const muatan = b64url(Buffer.from(JSON.stringify(lengkap), "utf8"));
  return `${muatan}.${tandaTangan(muatan)}`;
}

/** Kembalikan isinya, atau null bila tanda tangannya salah / sudah lewat.
 *  Sengaja tidak membedakan keduanya di nilai kembaliannya: pesan galat yang
 *  memisahkan "tanda tangan salah" dari "kedaluwarsa" memberi tahu penebak
 *  bahwa tebakan tanda tangannya sudah benar. */
export function bacaTiket(token: string | null | undefined): IsiTiket | null {
  if (!token) return null;
  const titik = token.lastIndexOf(".");
  if (titik <= 0) return null;

  const muatan = token.slice(0, titik);
  const tanda = token.slice(titik + 1);

  let benar: string;
  try {
    benar = tandaTangan(muatan);
  } catch {
    return null;
  }

  /* timingSafeEqual, bukan `===`. Perbandingan string biasa berhenti di huruf
     pertama yang berbeda, dan selisih waktunya cukup untuk menebak tanda
     tangan satu huruf demi satu huruf. Panjangnya diperiksa dulu karena
     timingSafeEqual melempar bila panjangnya tidak sama. */
  const a = Buffer.from(tanda);
  const b = Buffer.from(benar);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const isi = JSON.parse(dariB64url(muatan).toString("utf8")) as IsiTiket;
    if (!isi?.a || !isi?.k || !Array.isArray(isi.p) || isi.p.length === 0) return null;
    if (typeof isi.e !== "number" || isi.e * 1000 < Date.now()) return null;
    return isi;
  } catch {
    return null;
  }
}

/** Peta id_property → id_preferensi, bentuk yang diminta catatKiriman(). */
export function petaPreferensi(isi: IsiTiket): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  isi.p.forEach((id, i) => { out[id] = isi.r?.[i] ?? null; });
  return out;
}
