import { PrismaClient } from "@prisma/client";

/**
 * Satu PrismaClient untuk seluruh proses.
 *
 * Disimpan di `globalThis` — pola baku Next.js. Tanpa itu, setiap hot reload
 * membuat client baru sementara yang lama tetap memegang koneksinya, dan satu
 * sesi pengembangan yang panjang berakhir dengan Postgres menolak koneksi.
 *
 * ── EFEK SAMPINGNYA, DAN KENAPA ADA PENJAGA DI BAWAH ──────────────────────
 * Client itu bertahan selama PROSESNYA hidup, bukan selama kodenya tidak
 * berubah. Hot reload memuat ulang berkas rute, tapi tidak pernah membuang
 * objek di `globalThis` maupun isi `require.cache` Node.
 *
 * Akibatnya muncul tepat sesudah `prisma generate` menambah model baru:
 * berkas hasil generate di disk sudah benar, kode rute yang berjalan sudah
 * versi terbaru, log pun terlihat baru — tetapi `prisma.modelBaru` undefined,
 * karena client di memori dibuat sebelum model itu ada. Yang terbaca di
 * terminal hanyalah:
 *
 *     TypeError: Cannot read properties of undefined (reading 'groupBy')
 *
 * Pesan itu menunjuk ke gejala yang salah. Ia terbaca sebagai kesalahan kode —
 * dan yang dicurigai lebih dulu selalu query yang baru ditulis, bukan umur
 * proses yang sedang berjalan. Satu-satunya obatnya memang restart dev server,
 * dan penjaga di bawah memastikan kalimat itulah yang muncul.
 */

const globalForPrisma = global as unknown as { prisma: PrismaClient };

/**
 * Apakah client Prisma di memori sudah ketinggalan dari yang ada di disk?
 *
 * Membandingkan waktu proses ini MULAI dengan waktu berkas hasil
 * `prisma generate` terakhir ditulis. Kalau berkasnya lebih baru, apa pun yang
 * ada di memori dibuat sebelum model/kolom terakhir ada — dan tidak ada hot
 * reload yang bisa memperbaikinya, karena modul `@prisma/client` sudah terkunci
 * di `require.cache` Node sejak permintaan pertama.
 *
 * Penjaga Proxy di bawah hanya menangkap MODEL yang hilang (`prisma.modelBaru`
 * undefined). Ia buta terhadap KOLOM yang hilang — di situ modelnya ada, dan
 * yang muncul adalah "Unknown field `x` for select statement", galat yang
 * terbaca seperti salah ketik di kode padahal sebabnya sama persis. Fungsi ini
 * menutup celah itu.
 *
 * Mengembalikan kalimat siap tampil, atau null kalau memang tidak basi.
 * Sengaja TIDAK melempar: satu `touch` yang tidak disengaja tidak boleh
 * mematikan aplikasi, dan kalimat tambahan pada galat yang memang sedang
 * terjadi sudah cukup untuk mengarahkan.
 */
export function petunjukClientBasi(): string | null {
  if (process.env.NODE_ENV === "production") return null;
  try {
    // require dipanggil di dalam fungsi supaya `fs` tidak pernah ikut terbawa
    // ke bundel mana pun yang kebetulan menyentuh berkas ini.
    //
    // Dan diambil lewat eval, bukan dipakai langsung. Ini bukan gaya-gayaan:
    // `require.resolve(".prisma/client/index.js")` dengan string literal
    // dianalisis webpack secara statis, sehingga client Prisma hasil generate
    // IKUT DIBUNDEL ke setiap rute yang menyentuh berkas ini. Daftar
    // `serverComponentsExternalPackages` di next.config.mjs tidak menolong —
    // externals hanya berlaku untuk `require`/`import`, tidak untuk dependensi
    // `require.resolve`. Akibatnya `next build` gagal total dengan:
    //
    //     ./node_modules/.prisma/client/index.js
    //     Self-reference dependency has unused export name: This should not happen
    //
    // karena package.json hasil generate Prisma punya field `exports` dengan
    // `name` berbasis hash skema. Membungkusnya dengan eval memutus analisis
    // statis itu tanpa mengubah perilaku saat dijalankan: di Node ia tetap
    // `require` yang asli.
    const req = eval("require") as NodeRequire;
    const fs = req("fs") as typeof import("fs");
    const jalur = req.resolve(".prisma/client/index.js");
    const ditulis = fs.statSync(jalur).mtimeMs;
    const prosesMulai = Date.now() - process.uptime() * 1000;
    if (ditulis <= prosesMulai) return null;

    const menit = Math.max(1, Math.round((Date.now() - ditulis) / 60_000));
    return (
      `Client Prisma di-generate ulang ${menit} menit lalu, SESUDAH dev server ini mulai — ` +
      `jadi model & kolom terbaru belum ada di proses yang sedang berjalan. ` +
      `Hot reload tidak memperbaikinya. Hentikan dev server (Ctrl+C) lalu jalankan lagi.`
    );
  } catch {
    // Tidak bisa dibaca (bundel lain, jalur berbeda) → jangan menebak.
    return null;
  }
}

function buatClient(): PrismaClient {
  // Dua pemanggilan terpisah, bukan satu dengan opsi ternary. Ternary-nya
  // menghasilkan tipe gabungan `{log} | {}` yang tidak cocok dengan parameter
  // generik PrismaClient, dan TypeScript sudah lama mengeluhkannya di berkas
  // ini. Memisahkannya menghilangkan keluhan itu tanpa satu pun `as`.
  const client =
    process.env.NODE_ENV !== "production"
      ? new PrismaClient({ log: ["query"] })
      : new PrismaClient();

  // Di produksi client tidak pernah basi: prosesnya selalu dimulai sesudah
  // `prisma generate`. Pembungkus ini murni alat bantu pengembangan, dan tidak
  // ada gunanya membayar satu lapis Proxy di setiap query produksi.
  if (process.env.NODE_ENV === "production") return client;

  return new Proxy(client, {
    get(target, prop, receiver) {
      const nilai = Reflect.get(target, prop, receiver);
      if (nilai !== undefined) return nilai;

      // HANYA properti yang berbentuk nama model Prisma (camelCase, diawali
      // huruf kecil) yang dianggap kekeliruan. Sisanya dibiarkan undefined apa
      // adanya: `then` dipakai JavaScript untuk menebak apakah sebuah objek
      // adalah Promise, `$…` milik API internal Prisma, dan Symbol dipakai
      // util.inspect. Melemparkan galat pada salah satunya akan merusak client
      // yang sebenarnya sehat — penjaga yang lebih berisik daripada masalah
      // yang dijaganya.
      if (
        typeof prop !== "string" ||
        prop.startsWith("$") ||
        prop.startsWith("_") ||
        !/^[a-z][A-Za-z0-9]*$/.test(prop) ||
        prop === "then" ||
        prop === "toJSON" ||
        prop === "inspect"
      ) {
        return nilai;
      }

      throw new Error(
        `Model Prisma "${String(prop)}" tidak ada di client yang sedang berjalan. ` +
          `Hampir selalu ini berarti skema sudah ditambah & \`prisma generate\` sudah jalan, ` +
          `tapi proses dev server belum pernah dimatikan sejak itu — client di memori masih yang lama. ` +
          `Hot reload TIDAK memperbaikinya. Hentikan dev server (Ctrl+C) lalu jalankan lagi.`,
      );
    },
  });
}

export const prisma = globalForPrisma.prisma || buatClient();

globalForPrisma.prisma = prisma;

export default prisma;
