import { NextResponse } from "next/server";
import { cariTempat, tempatPopuler } from "@/lib/tempat/cari";
import { adalahKonteksTransaksi } from "@/lib/listingKataKunci";
import { hitungKataKunci } from "@/lib/listingKataKunci.server";
import { bacaKueriDekat } from "@/lib/tempat/normalisasi";

export const runtime = "nodejs";
/**
 * Saran berubah begitu ada aset baru dipindai di dekat sebuah tempat, jadi
 * jawabannya tidak boleh dibekukan di build. Tapi ia juga dipanggil pada
 * hampir setiap ketukan tombol, jadi ia di-cache pendek di tepi: 60 detik
 * cukup untuk menyerap satu orang yang mengetik satu nama, dan terlalu pendek
 * untuk menyembunyikan aset baru dari siapa pun.
 */
export const dynamic = "force-dynamic";

/**
 * GET /api/tempat/cari?q=deket+unesa&kota=Kota+Surabaya&batas=8
 *
 * Menjawab kotak pencarian: "tempat apa saja yang namanya seperti ini, dan
 * berapa aset ada di dekat masing-masing".
 *
 * Kata "deket"/"sekitar" boleh ikut terkirim apa adanya — pemisahnya ada di
 * server (bacaKueriDekat), bukan di browser, supaya satu-satunya aturan soal
 * "apa yang dianggap kata dekat" hidup di satu tempat.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").slice(0, 120);
    const kota = searchParams.get("kota");

    /**
     * Tanpa kueri, jawab dengan apa yang MUNGKIN — bukan daftar kosong.
     *
     * Inilah yang membuat fiturnya ditemukan: menyentuh kotak pencarian
     * langsung memperlihatkan "Semua kampus · 10 kampus" dan tempat-tempat
     * terpopuler, jadi kemampuan mencari per tempat dipelajari lewat memakai.
     */
    if (searchParams.get("populer") === "1" || q.trim().length === 0) {
      const items = await tempatPopuler({ kota });
      return NextResponse.json(
        { ok: true, populer: true, items },
        { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" } },
      );
    }

    if (q.trim().length < 2) {
      return NextResponse.json({ ok: true, items: [] });
    }

    /**
     * Dua jawaban sekaligus, karena kotak pencarian harus menawarkan DUA hal
     * yang berbeda dan sama-sama sah:
     *
     *   items  — tempat & kawasan ("UNESA", "semua kampus").
     *   alamat — berapa properti yang alamatnya memuat teks ini.
     *
     * Yang kedua ada supaya orang yang mengetik nama jalan atau kelurahan
     * ("Dukuh Kupang") melihat angka nyata, bukan pesan yang terbaca seperti
     * "tidak ada apa-apa di sini". Dulu panelnya cuma bisa berkata "tidak ada
     * TEMPAT bernama itu" — kalimat yang benar tapi menyesatkan, karena
     * asetnya ada dan yang tidak ada cuma landmark-nya.
     */
    const tx = searchParams.get("tx");
    const konteks = adalahKonteksTransaksi(tx) ? tx : "semua";

    const [items, jumlahAlamat] = await Promise.all([
      cariTempat(q, { kota, batas: Number(searchParams.get("batas")) || 8 }),
      hitungKataKunci(q, konteks),
    ]);

    /**
     * Baris alamat DISEMBUNYIKAN pada dua keadaan, dan keduanya soal kejujuran
     * tentang apa yang akan terjadi kalau Enter ditekan:
     *
     *   1. User menulis "deket …" DAN ada tempat yang cocok. Enter akan
     *      menafsirkannya sebagai tempat, bukan mencari teksnya di alamat —
     *      jadi menawarkan "cari 'deket kampus' sebagai alamat · 0 properti"
     *      adalah menjanjikan sesuatu yang bahkan tidak akan dijalankan.
     *   2. Alamatnya nol DAN sudah ada tempat yang cocok. Menawarkan pilihan
     *      yang pasti kosong di bawah pilihan yang berisi cuma menambah
     *      keraguan.
     *
     * Yang TIDAK disembunyikan: nol tanpa tempat yang cocok. Justru itu yang
     * harus terlihat — pemakainya berhak tahu sebelum mengklik, bukan sesudah.
     */
    const { niatDekat } = bacaKueriDekat(q);
    const adaTempat = items.length > 0;
    const alamat =
      jumlahAlamat === null || (adaTempat && (niatDekat || jumlahAlamat === 0))
        ? null
        : { teks: q.trim(), jumlah: jumlahAlamat };

    return NextResponse.json(
      { ok: true, items, alamat },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch (err: any) {
    // Kotak pencarian tetap bisa dipakai untuk kata kunci alamat — kegagalan
    // di sini tidak boleh terlihat sebagai kotak yang rusak.
    return NextResponse.json({ ok: false, items: [], message: err?.message ?? "Server error" });
  }
}
