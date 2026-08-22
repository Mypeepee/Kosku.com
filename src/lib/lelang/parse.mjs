// src/lib/lelang/parse.mjs
//
// ═══════════════════════════════════════════════════════════════════════════
// MESIN BACA DATA LELANG — satu sumber kebenaran untuk mengubah teks/JSON
// mentah dari lelang.go.id menjadi kolom `listing` yang siap disimpan.
// ═══════════════════════════════════════════════════════════════════════════
//
// KENAPA MODUL INI ADA
// Ada DUA scraper (scripts/scrape-lelang.mjs lewat API JSON, dan
// src/app/api/scrape/lelang/route.ts lewat DOM Puppeteer) yang masing-masing
// menyalin helper yang sama: mapLegalitas, extractKota, parseWilayah,
// extractLuas, parse tanggal. Salinan itu sudah berbeda satu sama lain
// (`mapLegalitas` versi .mjs mengenal SHGB, versi route.ts tidak). Setiap
// perbaikan hanya menyembuhkan satu sisi, dan sisi lain diam-diam tetap salah.
// Ditulis .mjs supaya Node (script) dan Next (route TS) sama-sama bisa
// mengimpornya tanpa langkah build.
//
// ── TIGA CACAT YANG DIPERBAIKI DI SINI ────────────────────────────────────
//
// 1. HANYA SATU NOMOR SERTIFIKAT YANG PERNAH TERSIMPAN.
//    Bukan karena datanya tidak ada. `parseCertText()` lama memakai
//    `text.match(...)` TANPA flag /g — secara definisi hanya cocok SEKALI per
//    blok teks — lalu `return true`, dan pemanggilnya (`if (parseCertText(raw))
//    break;`) berhenti di kolom pertama. Di atasnya, setiap strategi DOM
//    melakukan `return` begitu dapat satu hasil, sehingga sumber yang lebih
//    lengkap di bawahnya tidak pernah dibaca. Lot 10 bidang pun pulang bawa
//    satu nomor.
//    → Di sini semua sumber DIKUMPULKAN (union), tidak ada yang berhenti dini.
//
// 2. JENIS SERTIFIKAT JATUH KE "LAINNYA".
//    Urutan tebakan lama salah: `u.includes("HP")` diperiksa setelah HGB tapi
//    sebelum ejaan panjang, jadi "HPL" terbaca "HP"; dan ejaan resmi yang
//    dipakai KPKNL — "Sertipikat Hak Milik" (ejaan lama, dengan P), "SHMSRS",
//    "Hak Milik Atas Satuan Rumah Susun" — tidak dikenali sama sekali sehingga
//    jatuh ke LAINNYA. Di sini kamusnya lengkap dan diurut dari yang PALING
//    SPESIFIK, jadi "Hak Milik Atas Satuan Rumah Susun" tidak pernah tertangkap
//    lebih dulu oleh aturan "Hak Milik".
//
// 3. NOMOR PALSU IKUT TERTANGKAP.
//    Kolom "Bukti Kepemilikan" di lelang.go.id berbunyi, apa adanya:
//        "SHM No. 427 No: NIB No. 00422 19 Okt 2009"
//    Yang benar cuma 427. 00422 itu NIB (nomor identifikasi bidang), 2009 itu
//    tahun terbit. Regex lama yang menyapu angka bebas ikut menelan keduanya —
//    dan nomor sertifikat palsu lebih berbahaya daripada nomor yang hilang,
//    karena src/lib/auctionHistory.ts memakainya sebagai kunci pencocokan aset
//    dan akan mengarang riwayat lelang milik aset lain.
//    → Semua penanda bukan-sertifikat (NIB/NOP/SPPT/IMB/NPWP, tanggal, luas)
//      DITUTUP dulu sebelum angka dicari.
//
// FILOSOFI: lebih baik satu nomor hilang daripada satu nomor karangan. Semua
// aturan di bawah memilih diam ketimbang menebak.

import { KOTA_KE_PROVINSI } from "./wilayah.mjs";

/* ─────────────────────────── Util teks dasar ─────────────────────────── */

/** Rapatkan spasi & buang spasi tepi. Null-safe. */
export function rapikan(v) {
  return String(v ?? "")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** namaLotLelang mengandung HTML ("335 m<sup>2</sup>") → teks bersih. */
export function cleanJudul(s) {
  return (
    rapikan(
      String(s ?? "")
        .replace(/<sup>\s*2\s*<\/sup>/gi, "²")
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&nbsp;/gi, " "),
    ) || null
  );
}

/** "KOTA SORONG" → "Kota Sorong". */
export function titleCase(s) {
  if (!s) return null;
  return rapikan(String(s).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())) || null;
}

/* ══════════════════════ 1. JENIS SERTIFIKAT ══════════════════════════════ */

/**
 * Kamus jenis sertifikat → nilai `sertifikat_enum` di Prisma.
 *
 * URUTAN ADALAH BAGIAN DARI KEBENARANNYA, bukan selera: yang lebih panjang &
 * lebih spesifik harus diperiksa lebih dulu. "Hak Milik Atas Satuan Rumah
 * Susun" mengandung "Hak Milik"; "HPL" mengandung "HP"; "SHGB" mengandung
 * "HGB". Membalik urutannya menghasilkan salah klasifikasi yang senyap.
 *
 * `enumValue` null artinya jenisnya dikenali tapi belum ada di enum Prisma
 * (HPL, Girik, Letter C). Itu tetap DIKENALI supaya tulisan aslinya bisa
 * dilaporkan — bukan dibuang jadi "LAINNYA" tanpa jejak.
 */
const KAMUS_SERTIFIKAT = [
  {
    kanon: "STRATA_TITLE",
    enumValue: "STRATA_TITLE",
    label: "Strata Title",
    re: /\b(?:S\s*\.?\s*H\s*\.?\s*M\s*\.?\s*S\s*\.?\s*R\s*\.?\s*S|H\s*\.?\s*M\s*\.?\s*S\s*\.?\s*R\s*\.?\s*S|(?:SERTI[FP]IKAT\s+)?HAK\s+MILIK\s+ATAS\s+SATUAN\s+RUMAH\s+SUSUN|STRATA(?:\s+TITLE)?)\b/i,
  },
  {
    kanon: "HGB",
    enumValue: "HGB",
    label: "HGB",
    re: /\b(?:S\s*\.?\s*H\s*\.?\s*G\s*\.?\s*B|H\s*\.?\s*G\s*\.?\s*B|(?:SERTI[FP]IKAT\s+)?HAK\s+GUNA\s+BANGUNAN)\b/i,
  },
  {
    kanon: "HGU",
    enumValue: "HGU",
    label: "HGU",
    re: /\b(?:S?\s*\.?\s*H\s*\.?\s*G\s*\.?\s*U|(?:SERTI[FP]IKAT\s+)?HAK\s+GUNA\s+USAHA)\b/i,
  },
  {
    // HPL belum ada di sertifikat_enum → disimpan LAINNYA, tapi tetap dikenali
    // supaya laporan audit bisa menunjukkan berapa banyak yang sebenarnya HPL.
    kanon: "HPL",
    enumValue: null,
    label: "HPL (Hak Pengelolaan)",
    re: /\b(?:H\s*\.?\s*P\s*\.?\s*L|(?:SERTI[FP]IKAT\s+)?HAK\s+PENGELOLAAN)\b/i,
  },
  {
    kanon: "HP",
    enumValue: "HP",
    label: "Hak Pakai",
    re: /\b(?:S?\s*\.?\s*H\s*\.?\s*P(?![A-Z])|(?:SERTI[FP]IKAT\s+)?HAK\s+PAKAI)\b/i,
  },
  {
    kanon: "SHM",
    enumValue: "SHM",
    label: "SHM",
    re: /\b(?:S\s*\.?\s*H\s*\.?\s*M(?![A-Z])|(?:SERTI[FP]IKAT\s+)?HAK\s+MILIK)\b/i,
  },
  { kanon: "PPJB", enumValue: "PPJB", label: "PPJB", re: /\bP\s*\.?\s*P\s*\.?\s*J\s*\.?\s*B\b/i },
  { kanon: "AJB", enumValue: "AJB", label: "AJB", re: /\b(?:A\s*\.?\s*J\s*\.?\s*B|AKTA\s+JUAL\s+BELI)\b/i },
  {
    kanon: "GIRIK",
    enumValue: null,
    label: "Girik / Letter C",
    re: /\b(?:GIRIK|LETTER\s*C|PETOK\s*D|VERPONDING|EIGENDOM)\b/i,
  },
];

/**
 * Teks bebas → jenis sertifikat.
 *
 * @returns {{kanon: string, enumValue: string|null, label: string}|null}
 *   null bila tidak ada jenis apa pun yang dikenali (BUKAN "LAINNYA" —
 *   pemanggil yang memutuskan apakah itu layak jadi LAINNYA atau tetap kosong).
 */
export function bacaJenisSertifikat(teks) {
  const s = rapikan(teks);
  if (!s) return null;
  for (const item of KAMUS_SERTIFIKAT) {
    if (item.re.test(s)) {
      return { kanon: item.kanon, enumValue: item.enumValue, label: item.label };
    }
  }
  return null;
}

/**
 * Jenis sertifikat → nilai enum siap simpan.
 *
 * Mengembalikan null (BUKAN "LAINNYA") kalau teksnya kosong: kolom yang jujur
 * kosong lebih berguna daripada kolom berisi "LAINNYA" yang tidak bisa
 * dibedakan dari "sudah dicek, memang bukan jenis standar". "LAINNYA" hanya
 * untuk jenis yang DIKENALI tapi belum punya slot enum (HPL, Girik).
 */
export function mapLegalitas(raw) {
  const hasil = bacaJenisSertifikat(raw);
  if (!hasil) return null;
  return hasil.enumValue ?? "LAINNYA";
}

/* ══════════════════════ 2. NOMOR SERTIFIKAT ══════════════════════════════ */

/**
 * Penanda angka yang BUKAN nomor sertifikat, ditutup sebelum pencarian.
 *
 * Contoh nyata satu sel "Bukti Kepemilikan":
 *   "SHM No. 427 No: NIB No. 00422 19 Okt 2009"
 * Tanpa penutupan ini, 00422 (NIB) dan 2009 (tahun) ikut tersimpan sebagai
 * nomor sertifikat — dan nomor karangan merusak pencocokan riwayat lelang.
 */
const POLA_BUKAN_NOMOR = [
  // NIB/NOP/SPPT/IMB/NPWP + nomornya
  /\b(?:N\.?I\.?B|N\.?O\.?P|S\.?P\.?P\.?T|I\.?M\.?B|N\.?P\.?W\.?P)\b\s*(?:No\.?|Nomor)?\s*[:.]?\s*[\d][\d.\-/]*/gi,
  // Tanggal Indonesia: "19 Okt 2009", "04 Mei 2007", "1 September 1998"
  /\b\d{1,2}\s+(?:jan|feb|peb|mar|apr|mei|jun|jul|agu|ags|agt|sep|okt|okt|nov|nop|des)[a-z]*\.?\s+\d{2,4}\b/gi,
  // Tanggal berpemisah: 19/10/2009, 19-10-2009
  /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g,
  // "Tahun 2009"
  /\bTAHUN\s+\d{4}\b/gi,
  // "Luas: 147 M2" / "147 m²"
  /\bLUAS\s*[:.]?\s*[\d.,]+\s*m\s*[²2]?\b/gi,
  /\b[\d.,]+\s*m\s*[²2]\b/gi,
  // Nominal rupiah
  /\bRp\.?\s*[\d.,]+/gi,
];

/** Token pengganti — sengaja tanpa angka & tanpa huruf tipe sertifikat. */
const TUTUP = " ■ ";

function tutupiBukanNomor(teks) {
  let s = rapikan(teks);
  for (const re of POLA_BUKAN_NOMOR) s = s.replace(re, TUTUP);
  return s;
}

/**
 * Satu nomor mentah → bentuk simpan.
 *
 * Akhiran kode kelurahan dibuang ("09/WGb" → "09", "00254/Belimbing" → "00254")
 * mengikuti perilaku yang sudah dipakai data lama, supaya nomor hasil scrape
 * baru dan lama tetap bisa dibandingkan. Leading zero DIPERTAHANKAN — itu
 * tulisan resmi di sertifikat; penormalannya urusan certNumbers() di
 * src/lib/nomorLegalitas.ts saat mencocokkan, bukan urusan penyimpanan.
 */
function bersihkanNomor(raw) {
  let c = rapikan(raw).replace(/[.,;:]+$/, "");
  const garis = c.indexOf("/");
  if (garis >= 0) c = c.slice(0, garis).trim();
  c = c.replace(/[^0-9]/g, "");
  if (!c) return null;
  // >7 digit bukan nomor sertifikat (itu NIB/NOP yang lolos penutupan).
  if (c.length > 7) return null;
  return c;
}

// Setelah tipe: "No." / "Nomor" / ":" opsional, lalu angka (boleh berakhiran
// "/KodeKelurahan"). Nomor tambahan HANYA lewat pemisah eksplisit (koma / "dan"
// / "&") — sengaja TIDAK lewat "No:", karena template situs menulis
// "SHM No. 427 No: NIB No. 00422" dan "No:" di situ memperkenalkan NIB.
const NOMOR = String.raw`(\d{1,7}(?:\/[A-Za-z0-9.\-]+)?)`;

/**
 * Token penanda jenis sertifikat, satu huruf per entri KAMUS_SERTIFIKAT.
 * Sengaja huruf tunggal di dalam «»: tidak ada pola jenis yang bisa cocok
 * dengannya (semua butuh ≥2 huruf), jadi penandaan tidak pernah menandai
 * hasil penandaan sebelumnya.
 */
const TOKEN_HURUF = "abcdefghijklmnopqrstuvwxyz".split("");
const LANJUTAN = new RegExp(String.raw`^\s*(?:,|;|&|\bdan\b)\s*(?:No\.?|Nomor)?\s*[:.]?\s*${NOMOR}`, "i");

/**
 * Satu blok teks → semua pasangan (jenis, nomor) di dalamnya.
 *
 * Berbeda dari versi lama yang memakai `String.match` tanpa /g dan berhenti di
 * kecocokan pertama, ini menyapu SELURUH teks. Satu sel tabel yang memuat dua
 * bidang ("SHM No. 427 … SHM No. 382") menghasilkan dua nomor.
 *
 * @returns {{tipe: string|null, nomor: string[], pasangan: Array<{tipe: string|null, nomor: string}>}}
 */
export function bacaBukti(teks) {
  const kosong = { tipe: null, nomor: [], pasangan: [] };
  const asli = rapikan(teks);
  if (!asli) return kosong;

  // Tahap 1: tutup angka yang bukan nomor sertifikat, lalu ganti setiap ejaan
  // jenis sertifikat dengan token satu huruf. Penandaan lebih dulu inilah yang
  // memungkinkan tahap 2 menyapu teks SEKALI dari kiri ke kanan — kalau tiap
  // jenis disapu dengan regex-nya sendiri, hasilnya terkelompok per jenis dan
  // urutan bidang di halaman ("SHM 5, lalu HGB 6") jadi teracak.
  let bersih = tutupiBukanNomor(asli);
  KAMUS_SERTIFIKAT.forEach((item, i) => {
    bersih = bersih.replace(new RegExp(item.re.source, "gi"), `«${TOKEN_HURUF[i]}»`);
  });

  const pasangan = [];
  const nomor = [];
  const terlihat = new Set();
  let tipeUtama = null;

  const tambah = (tipe, mentah) => {
    const n = bersihkanNomor(mentah);
    if (!n) return;
    // Dedup memakai bentuk kanonik (tanpa leading zero) supaya "427" dan
    // "0427" di satu lot tidak jadi dua bidang.
    const kunci = n.replace(/^0+/, "") || n;
    if (terlihat.has(kunci)) return;
    terlihat.add(kunci);
    nomor.push(n);
    pasangan.push({ tipe: tipe ?? null, nomor: n });
  };

  // Tahap 2: satu sapuan, urut posisi.
  const re = new RegExp(
    String.raw`«([a-z])»\s*(?:No\.?|Nomor)?\s*[:.]?\s*` + NOMOR + "?",
    "gi",
  );
  let m;
  while ((m = re.exec(bersih)) !== null) {
    const item = KAMUS_SERTIFIKAT[TOKEN_HURUF.indexOf(m[1].toLowerCase())];
    if (!item) continue;
    if (!tipeUtama) tipeUtama = item;
    if (!m[2]) continue;

    tambah(item.kanon, m[2]);

    // Deret lanjutan: "SHM No. 427, 382 dan 390".
    let sisa = bersih.slice(re.lastIndex);
    let lanjut;
    while ((lanjut = sisa.match(LANJUTAN)) !== null) {
      tambah(item.kanon, lanjut[1]);
      sisa = sisa.slice(lanjut[0].length);
      re.lastIndex += lanjut[0].length;
    }
  }

  return {
    tipe: tipeUtama ? tipeUtama.kanon : (bacaJenisSertifikat(asli)?.kanon ?? null),
    nomor,
    pasangan,
  };
}

/**
 * Gabungkan banyak hasil `bacaBukti()` dari sumber berbeda (kolom tabel, teks
 * halaman, JSON API) jadi satu.
 *
 * Semua sumber DIPAKAI — tidak ada "yang pertama berhasil menang". Sumber DOM
 * bisa punya bidang ke-3 yang tidak ada di JSON dan sebaliknya; menghentikan
 * pencarian di sumber pertama persis itulah sebab lot 10 bidang cuma menyimpan
 * satu nomor.
 *
 * Jenis sertifikat diambil dari suara terbanyak: satu lot campuran (SHM +
 * HGB) tetap harus punya satu nilai enum, dan yang paling mewakili adalah yang
 * paling sering muncul.
 */
export function gabungBukti(hasilList) {
  const nomor = [];
  const terlihat = new Set();
  const suara = new Map();

  for (const h of hasilList) {
    if (!h) continue;
    if (h.tipe) suara.set(h.tipe, (suara.get(h.tipe) ?? 0) + 1);
    for (const p of h.pasangan ?? []) {
      if (p.tipe) suara.set(p.tipe, (suara.get(p.tipe) ?? 0) + 1);
    }
    for (const n of h.nomor ?? []) {
      const kunci = String(n).replace(/^0+/, "") || String(n);
      if (terlihat.has(kunci)) continue;
      terlihat.add(kunci);
      nomor.push(n);
    }
  }

  let tipe = null;
  let tertinggi = 0;
  for (const [k, v] of suara) {
    if (v > tertinggi) {
      tertinggi = v;
      tipe = k;
    }
  }

  const item = KAMUS_SERTIFIKAT.find((x) => x.kanon === tipe) ?? null;
  return {
    tipe,
    legalitas: item ? (item.enumValue ?? "LAINNYA") : null,
    nomor,
    nomorGabungan: potongNomorLegalitas(nomor.join(",")),
    jumlahBidang: nomor.length,
  };
}

/**
 * Potong daftar nomor sertifikat agar muat di listing.nomor_legalitas
 * (varchar 250) TANPA PERNAH memotong satu nomor di tengah.
 *
 * Lot dengan puluhan bidang bisa melebihi 250 karakter. `substring(0, 250)`
 * polos bisa menyisakan "…,12345" jadi "…,123" — itu nomor sertifikat yang
 * SALAH, dan mesin riwayat lelang (src/lib/auctionHistory.ts) akan memakainya
 * sebagai kunci pencocokan, sehingga aset asing bisa ikut tercantum di riwayat.
 * Lebih baik kehilangan bidang terakhir daripada menyimpan nomor palsu.
 */
export function potongNomorLegalitas(nomor, maks = 250) {
  const s = rapikan(nomor);
  if (!s) return null;
  if (s.length <= maks) return s;
  const batas = s.lastIndexOf(",", maks);
  // Tanpa batas koma, satu "nomor" saja sudah >250 karakter — itu bukan nomor
  // sertifikat yang masuk akal, jadi lebih jujur dikosongkan.
  return batas > 0 ? s.slice(0, batas) : null;
}

/**
 * Bukti kepemilikan dari `content.barangs[]` (endpoint landing-page/info).
 *
 * Nama fieldnya tidak stabil antar versi API, dan yang lama hanya membaca
 * `buktiKepemilikanNo` — kalau situs mengganti namanya jadi `noBuktiKepemilikan`
 * hasilnya null tanpa satu pun pesan error. Di sini SEMUA varian yang masuk akal
 * dicoba, lalu teks bebasnya (`uraian`) ikut dibaca sebagai jaring terakhir.
 */
export function certFromBarangs(barangs) {
  const hasil = [];
  for (const b of barangs ?? []) {
    if (!b || typeof b !== "object") continue;

    const tipeTeks = [b.buktiKepemilikan, b.jenisBuktiKepemilikan, b.jenisHak, b.namaBuktiKepemilikan]
      .map(rapikan)
      .filter(Boolean)
      .join(" ");

    const nomorTeks = [b.buktiKepemilikanNo, b.noBuktiKepemilikan, b.nomorBuktiKepemilikan, b.noHak, b.nomorHak]
      .map(rapikan)
      .filter(Boolean)
      .join(" ");

    // Digabung supaya "SHM" (kolom tipe) + "427" (kolom nomor) yang terpisah
    // tetap terbaca sebagai satu pasangan.
    const gabungan = rapikan(`${tipeTeks} ${nomorTeks}`);
    let baca = bacaBukti(gabungan);

    // Kolom nomor berisi angka telanjang (tanpa kata "SHM" di depannya) —
    // pasangkan manual dengan jenis dari kolom tipe.
    if (baca.nomor.length === 0 && nomorTeks) {
      const jenis = bacaJenisSertifikat(tipeTeks);
      const n = bersihkanNomor(tutupiBukanNomor(nomorTeks));
      if (n) {
        baca = {
          tipe: jenis?.kanon ?? null,
          nomor: [n],
          pasangan: [{ tipe: jenis?.kanon ?? null, nomor: n }],
        };
      }
    }

    hasil.push(baca);
    if (b.uraian || b.keterangan) hasil.push(bacaBukti(`${b.uraian ?? ""} ${b.keterangan ?? ""}`));
  }
  return gabungBukti(hasil);
}

/* ══════════════════════ 3. ANGKA & TANGGAL ═══════════════════════════════ */

/** "Luas: 147 M²" / "147 m2" → 147. Ambil kecocokan PERTAMA. */
export function extractLuas(teks) {
  const m = rapikan(teks).match(/(?:Luas\s*[:.]?\s*)?(\d+(?:[.,]\d+)?)\s*[Mm]\s*(?:2|²)/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

/** Jumlah luas semua bidang. Lot multi-bidang menyimpan TOTAL, bukan per bidang. */
export function totalLuas(barangs) {
  let sum = 0;
  let ada = false;
  for (const b of barangs ?? []) {
    const n = parseFloat(String(b?.luas ?? "").replace(",", "."));
    if (Number.isFinite(n) && n > 0) {
      sum += n;
      ada = true;
    }
    // Sebagian lot menaruh luas hanya di teks uraian.
    if (!Number.isFinite(n) && (b?.uraian || b?.keterangan)) {
      const l = extractLuas(`${b.uraian ?? ""} ${b.keterangan ?? ""}`);
      if (l) {
        sum += l;
        ada = true;
      }
    }
  }
  return ada ? Math.floor(sum) : null;
}

const BULAN_ID = {
  jan: 1, januari: 1,
  feb: 2, februari: 2, peb: 2, pebruari: 2,
  mar: 3, maret: 3,
  apr: 4, april: 4,
  mei: 5,
  jun: 6, juni: 6,
  jul: 7, juli: 7,
  agu: 8, ags: 8, agt: 8, agustus: 8,
  sep: 9, sept: 9, september: 9,
  okt: 10, oktober: 10,
  nov: 11, nop: 11, november: 11, nopember: 11,
  des: 12, desember: 12,
};

/** "19 Okt 2009 pukul 10.00 WIB" → Date. ISO juga diterima. */
export function parseTanggalId(raw) {
  if (!raw) return null;
  const s = rapikan(String(raw))
    .replace(/\b(pukul|jam|wib|wita|wit)\b\.?:?/gi, "")
    .replace(/,/g, " ");
  const m = s.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (m) {
    const bl = BULAN_ID[m[2].toLowerCase()];
    if (bl) {
      const t = s.match(/(\d{1,2})[.:](\d{2})/);
      return new Date(+m[3], bl - 1, +m[1], t ? +t[1] : 23, t ? +t[2] : 59);
    }
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

/* ══════════════════════ 4. WILAYAH ═══════════════════════════════════════ */

const KW_STOP =
  "(?=\\s*[,.(]|\\s*\\d{5}|\\s+(?:Kec(?:amatan)?|Kab(?:upaten)?|Kota\\b|Prov(?:insi)?|Propinsi|Prop\\b)|\\s*$)";

const bersihWilayah = (v) => {
  if (!v) return null;
  return (
    rapikan(
      String(v)
        .replace(/\s*\([^)]*\)/g, "")
        .replace(/\s*\d{5}\s*$/, "")
        .replace(/[,.\s]+$/, ""),
    ) || null
  );
};

/**
 * 38 provinsi Indonesia + ejaan yang benar-benar muncul di data lelang.
 *
 * Dipakai sebagai jaring kedua: 35% baris lelang punya alamat lengkap tapi
 * `provinsi` NULL, karena aturan lama menuntut kata kunci "Provinsi/Prov."
 * ada di depan namanya. Alamat KPKNL sering menutup dengan nama provinsinya
 * telanjang ("…, Kota Medan, Sumatera Utara") — tanpa daftar ini, informasi
 * yang JELAS-JELAS tertulis tetap dibuang.
 */
const PROVINSI_INDONESIA = [
  "Aceh", "Sumatera Utara", "Sumatera Barat", "Riau", "Kepulauan Riau", "Jambi",
  "Sumatera Selatan", "Kepulauan Bangka Belitung", "Bengkulu", "Lampung",
  "DKI Jakarta", "Jawa Barat", "Banten", "Jawa Tengah", "DI Yogyakarta",
  "Jawa Timur", "Bali", "Nusa Tenggara Barat", "Nusa Tenggara Timur",
  "Kalimantan Barat", "Kalimantan Tengah", "Kalimantan Selatan",
  "Kalimantan Timur", "Kalimantan Utara", "Sulawesi Utara", "Gorontalo",
  "Sulawesi Tengah", "Sulawesi Barat", "Sulawesi Selatan", "Sulawesi Tenggara",
  "Maluku", "Maluku Utara", "Papua", "Papua Barat", "Papua Barat Daya",
  "Papua Tengah", "Papua Pegunungan", "Papua Selatan",
];

/** Ejaan lain yang dipakai sumber → nama resmi. */
const ALIAS_PROVINSI = {
  "DAERAH ISTIMEWA YOGYAKARTA": "DI Yogyakarta",
  "D I YOGYAKARTA": "DI Yogyakarta",
  YOGYAKARTA: "DI Yogyakarta",
  "DAERAH KHUSUS IBUKOTA JAKARTA": "DKI Jakarta",
  "DKI JAKARTA RAYA": "DKI Jakarta",
  JAKARTA: "DKI Jakarta",
  "BANGKA BELITUNG": "Kepulauan Bangka Belitung",
  "NANGGROE ACEH DARUSSALAM": "Aceh",
  "NAD": "Aceh",
  "NTB": "Nusa Tenggara Barat",
  "NTT": "Nusa Tenggara Timur",
  "SUMATERA UTARA": "Sumatera Utara",
  "SUMUT": "Sumatera Utara",
  "JABAR": "Jawa Barat",
  "JATENG": "Jawa Tengah",
  "JATIM": "Jawa Timur",
};

/**
 * Cari nama provinsi di mana pun dalam teks, tanpa menuntut kata "Provinsi".
 *
 * Dicocokkan dari yang PALING PANJANG dulu supaya "Sumatera Utara" tidak
 * tertangkap sebagai... tidak ada tumpang tindih di daftar ini, tapi aturan itu
 * tetap dipasang karena "Papua" adalah awalan dari lima provinsi lain.
 */
export function tebakProvinsi(teks) {
  const s = rapikan(teks).toUpperCase();
  if (!s) return null;

  for (const [alias, resmi] of Object.entries(ALIAS_PROVINSI)) {
    if (new RegExp(`\\b${alias}\\b`).test(s)) return resmi;
  }
  const urut = [...PROVINSI_INDONESIA].sort((a, b) => b.length - a.length);
  for (const nama of urut) {
    if (new RegExp(`\\b${nama.toUpperCase()}\\b`).test(s)) return nama;
  }
  return null;
}

/**
 * Provinsi dari nama kabupaten/kota.
 *
 * Jaring KETIGA, dan yang paling produktif: 34.472 dari 42.539 baris tanpa
 * provinsi ternyata punya kota yang jelas — informasinya sudah ada di baris itu
 * sendiri, hanya belum dihubungkan. Petanya di wilayah.mjs, dibangkitkan dari
 * data (lihat scripts/buat-peta-wilayah.mjs), bukan diketik tangan.
 */
export function provinsiDariKota(kota) {
  const k = rapikan(kota)
    .toUpperCase()
    .replace(/^(KOTA ADM\.?|KOTA|KAB\.?|KABUPATEN)\s+/, "");
  if (k.length < 3 || k === "TIDAK DIKETAHUI") return null;
  return KOTA_KE_PROVINSI[k] ?? null;
}

/** Alamat bebas → {provinsi, kecamatan, kelurahan}. */
export function parseWilayahFromAlamat(alamat) {
  if (!alamat) return { provinsi: null, kecamatan: null, kelurahan: null };
  const s = rapikan(alamat);
  const provRe = new RegExp(
    `(?:Provinsi|Propinsi|Prov\\.?|Prop\\.?)\\s+([A-Za-z][A-Za-z\\s]+?)${KW_STOP}`,
    "i",
  );
  const kecRe = new RegExp(
    `(?:Kecamatan|Kec\\.?)\\s+([A-Za-z0-9][A-Za-z0-9\\s]+?)${KW_STOP}`,
    "i",
  );
  const kelRe = new RegExp(
    `(?:Desa\\/Kelurahan|Desa\\/Kel\\.|Kelurahan|Kel\\.?|Desa|DS\\.?)\\s+([A-Za-z0-9][A-Za-z0-9\\s]+?)${KW_STOP}`,
    "i",
  );
  // Kata kunci "Provinsi X" lebih dipercaya; kalau tidak ada, nama provinsi
  // telanjang di ekor alamat tetap dipungut daripada dibiarkan NULL.
  const berlabel = bersihWilayah(s.match(provRe)?.[1]);
  return {
    provinsi: (berlabel && tebakProvinsi(berlabel)) || berlabel || tebakProvinsi(s),
    kecamatan: bersihWilayah(s.match(kecRe)?.[1]),
    kelurahan: bersihWilayah(s.match(kelRe)?.[1]),
  };
}

/** Judul & alamat → nama kota bergaya "Kota Medan" / "Kab. Bogor". */
export function extractKota(judul, alamat) {
  const j = rapikan(judul);
  const a = rapikan(alamat);

  const jm = j.match(
    /\bdi\s+(Kota(?:\s+Adm(?:inistrasi)?\.?)?|Kab(?:\.|upaten)?)\s+([A-Za-z.\s]+?)(?=[,;.]|$)/i,
  );
  if (jm) {
    const lbl = jm[1].toLowerCase();
    const nama = rapikan(jm[2].replace(/\s+\b(Prov|Prop|Kec|Kab|Kota)\b.*/i, ""));
    if (lbl.includes("adm")) return `Kota Adm. ${nama}`;
    if (lbl.includes("kota")) return `Kota ${nama}`;
    return `Kab. ${nama}`;
  }

  const am = a.match(/\b(Kota|Kabupaten|Kab\.?)\s+([A-Za-z\s]+?)(?=,|\.|Kec|Prov|$)/i);
  if (am) return `${am[1]} ${rapikan(am[2])}`;

  const kabM = a.match(/\bKAB\s+([A-Z][A-Za-z\s]+?)(?:\s+PROV|\s*$)/i);
  if (kabM) return `Kab. ${rapikan(kabM[1])}`;

  return null;
}

/* ══════════════════════ 5. TAUTAN ════════════════════════════════════════ */

export const SITE_LELANG = "https://lelang.go.id";

/**
 * Tautan detail lelang.
 *
 * Kolom `link` adalah kunci anti-duplikat DAN satu-satunya jalan agent kembali
 * ke sumber resmi, jadi ia tidak boleh null. Kalau id unit kerja tidak ada,
 * bentuk pendek `/detail-auction/{lot}` tetap dibuat — situsnya tetap membuka
 * lot yang benar, dan tautan pendek jauh lebih baik daripada tidak ada tautan.
 */
export function buildLink(unitKerjaId, lotLelangId) {
  const lot = rapikan(lotLelangId);
  if (!lot) return null;
  const unit = rapikan(unitKerjaId);
  return unit
    ? `${SITE_LELANG}/kpknl/${unit}/detail-auction/${lot}`
    : `${SITE_LELANG}/detail-auction/${lot}`;
}

/* ══════════════════════ 6. PEMILIHAN NILAI ══════════════════════════════ */

/**
 * Ambil nilai pertama yang benar-benar ada, sambil mencatat sumbernya.
 *
 * Ini bentuk yang menggantikan `a ?? b ?? c` bertingkat di kedua scraper.
 * Bedanya bukan gaya: rantai `??` tidak meninggalkan jejak, jadi saat sebuah
 * kolom null tidak ada cara tahu apakah SEMUA sumber kosong atau sumber
 * pertamanya yang rusak. `pilih()` mencatat pemenangnya sehingga laporan akhir
 * bisa menunjukkan "alamat: 71% dari barangs, 24% dari uraian, 5% kosong".
 *
 * @param {Array<[string, any]>} kandidat pasangan [namaSumber, nilai]
 * @returns {{nilai: any, sumber: string|null}}
 */
export function pilih(kandidat) {
  for (const [sumber, nilai] of kandidat) {
    if (nilai === null || nilai === undefined) continue;
    if (typeof nilai === "string" && rapikan(nilai) === "") continue;
    if (typeof nilai === "number" && !Number.isFinite(nilai)) continue;
    return { nilai, sumber };
  }
  return { nilai: null, sumber: null };
}

/**
 * Penghitung kelengkapan kolom lintas satu proses scrape.
 *
 * Tujuan akhir yang diminta — "informasi lengkap tanpa null" — tidak bisa
 * dikejar tanpa alat ukur. Tanpa ini, satu-satunya cara tahu ada kolom yang
 * bolong adalah menemukannya di halaman detail berbulan-bulan kemudian.
 */
export function pembukuKelengkapan() {
  const kolom = new Map();

  return {
    catat(nama, hasil) {
      const k = kolom.get(nama) ?? { total: 0, terisi: 0, sumber: new Map() };
      k.total++;
      if (hasil?.nilai !== null && hasil?.nilai !== undefined) {
        k.terisi++;
        const s = hasil.sumber ?? "?";
        k.sumber.set(s, (k.sumber.get(s) ?? 0) + 1);
      }
      kolom.set(nama, k);
      return hasil?.nilai ?? null;
    },
    /** Baris laporan, urut dari yang paling banyak kosong. */
    laporan() {
      return Array.from(kolom.entries())
        .map(([nama, k]) => ({
          kolom: nama,
          total: k.total,
          terisi: k.terisi,
          kosong: k.total - k.terisi,
          persen: k.total ? Math.round((k.terisi / k.total) * 1000) / 10 : 0,
          sumber: Array.from(k.sumber.entries()).sort((a, b) => b[1] - a[1]),
        }))
        .sort((a, b) => b.kosong - a.kosong || a.kolom.localeCompare(b.kolom));
    },
  };
}
