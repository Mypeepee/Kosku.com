// scripts/test-lelang-parse.mjs
//
// Uji mesin baca data lelang TANPA jaringan — jalankan: node scripts/test-lelang-parse.mjs
//
// Kenapa ada: scraper hanya bisa diuji sungguhan dengan menembak lelang.go.id,
// dan itu lambat, tidak deterministik, serta tidak bisa dijalankan saat sumbernya
// down. Semua keputusan parsing yang menentukan isi kolom `legalitas` dan
// `nomor_legalitas` justru murni fungsi teks → bisa dikunci di sini.
//
// Contoh di bawah BUKAN karangan: string "SHM No. 427 No: NIB No. 00422 19 Okt
// 2009" disalin apa adanya dari kolom "Bukti Kepemilikan" lelang.go.id
// (lot 556287dd-817f-4f25-9cbe-deec414c67c2, 2 bidang).

import {
  bacaBukti,
  bacaJenisSertifikat,
  certFromBarangs,
  extractKota,
  extractLuas,
  gabungBukti,
  mapLegalitas,
  parseTanggalId,
  parseWilayahFromAlamat,
  potongNomorLegalitas,
  tebakProvinsi,
  buildLink,
} from "../src/lib/lelang/parse.mjs";

let lulus = 0;
let gagal = 0;

const cek = (nama, aktual, harapan) => {
  const a = JSON.stringify(aktual);
  const h = JSON.stringify(harapan);
  if (a === h) {
    lulus++;
    console.log(`  ✅ ${nama}`);
  } else {
    gagal++;
    console.log(`  ❌ ${nama}\n       harap: ${h}\n       dapat: ${a}`);
  }
};

const bagian = (judul) => console.log(`\n── ${judul} ──`);

/* ══════════════ 1. Jenis sertifikat — tidak boleh jatuh ke LAINNYA ══════ */
bagian("Jenis sertifikat");

cek("SHM", mapLegalitas("SHM No. 427"), "SHM");
cek("Sertipikat Hak Milik (ejaan lama)", mapLegalitas("Sertipikat Hak Milik No. 12"), "SHM");
cek("Sertifikat Hak Milik", mapLegalitas("Sertifikat Hak Milik"), "SHM");
cek("Hak Milik polos", mapLegalitas("Hak Milik"), "SHM");
cek("S.H.M bertitik", mapLegalitas("S.H.M No 05"), "SHM");
cek("SHGB → HGB", mapLegalitas("SHGB No. 1234"), "HGB");
cek("HGB", mapLegalitas("HGB No. 1234"), "HGB");
cek("Hak Guna Bangunan", mapLegalitas("Hak Guna Bangunan No. 9"), "HGB");
cek("HGU", mapLegalitas("HGU No. 3"), "HGU");
cek("Hak Pakai", mapLegalitas("Hak Pakai No. 7"), "HP");
cek("HP", mapLegalitas("HP No. 7"), "HP");
// Cacat lama: `u.includes("HP")` membuat HPL terbaca HP.
cek("HPL BUKAN HP", bacaJenisSertifikat("HPL No. 2")?.kanon, "HPL");
cek("HPL → enum LAINNYA", mapLegalitas("HPL No. 2"), "LAINNYA");
// Cacat lama: "Hak Milik Atas Satuan Rumah Susun" tertangkap aturan "Hak Milik".
cek("Strata (ejaan panjang)", mapLegalitas("Hak Milik Atas Satuan Rumah Susun No. 21"), "STRATA_TITLE");
cek("SHMSRS", mapLegalitas("SHMSRS No. 21"), "STRATA_TITLE");
cek("AJB", mapLegalitas("AJB"), "AJB");
cek("PPJB", mapLegalitas("PPJB"), "PPJB");
cek("Girik → LAINNYA", mapLegalitas("Girik C 123"), "LAINNYA");
cek("kosong → null (bukan LAINNYA)", mapLegalitas(""), null);
cek("teks tak dikenal → null", mapLegalitas("Tidak Bergerak Tanah Berikut Bangunan"), null);

/* ══════════════ 2. Nomor sertifikat — kasus nyata dari layar ═══════════ */
bagian("Nomor sertifikat (data nyata lelang.go.id)");

const BIDANG_1 = "SHM No. 427 No: NIB No. 00422 19 Okt 2009";
const BIDANG_2 = "SHM No. 382 No: NIB No. 00388 04 Mei 2007";

// NIB (00422) dan tahun (2009) TIDAK boleh ikut.
cek("bidang 1 → hanya 427", bacaBukti(BIDANG_1).nomor, ["427"]);
cek("bidang 2 → hanya 382", bacaBukti(BIDANG_2).nomor, ["382"]);

// Inti perbaikannya: dua bidang → dua nomor, bukan satu.
const duaBidang = gabungBukti([bacaBukti(BIDANG_1), bacaBukti(BIDANG_2)]);
cek("dua bidang digabung", duaBidang.nomorGabungan, "427,382");
cek("jumlah bidang", duaBidang.jumlahBidang, 2);
cek("legalitas hasil gabung", duaBidang.legalitas, "SHM");

// Satu SEL berisi dua bidang sekaligus (penyebab utama versi lama cuma dapat 1:
// `String.match` tanpa /g).
cek(
  "satu blok teks, dua bidang",
  bacaBukti(`${BIDANG_1} ${BIDANG_2}`).nomor,
  ["427", "382"],
);

cek("deret koma", bacaBukti("SHM No. 427, 382 dan 390").nomor, ["427", "382", "390"]);
cek("akhiran kode kelurahan dibuang", bacaBukti("SHM No: 09/WGb").nomor, ["09"]);
cek("leading zero dipertahankan", bacaBukti("SHM No. 02007 No:").nomor, ["02007"]);
cek("0427 dan 427 dianggap sama", bacaBukti("SHM No. 427 SHM No. 0427").nomor, ["427"]);
cek("tipe tanpa nomor tetap kasih jenis", bacaBukti("Sertipikat Hak Milik").tipe, "SHM");
cek("tanpa sertifikat → kosong", bacaBukti("Tidak Bergerak Tanah Berikut Bangunan").nomor, []);
cek("angka telanjang tanpa jenis diabaikan", bacaBukti("Luas: 147 M2 NIB 00422").nomor, []);
cek("campur SHM + HGB", gabungBukti([bacaBukti("SHM No. 5 HGB No. 6")]).nomorGabungan, "5,6");

// 10 bidang — lot "121797" yang memicu seluruh investigasi ini.
const sepuluh = Array.from({ length: 10 }, (_, i) => bacaBukti(`SHM No. ${1538 + i} No: NIB No. 0${i}`));
cek("10 bidang", gabungBukti(sepuluh).jumlahBidang, 10);

/* ══════════════ 3. Bentuk JSON API ═════════════════════════════════════ */
bagian("certFromBarangs (bentuk JSON)");

cek(
  "field standar, 2 barang",
  certFromBarangs([
    { buktiKepemilikan: "SHM No. 427", buktiKepemilikanNo: "NIB No. 00422" },
    { buktiKepemilikan: "SHM No. 382", buktiKepemilikanNo: "NIB No. 00388" },
  ]).nomorGabungan,
  "427,382",
);
cek(
  "tipe & nomor di kolom terpisah",
  certFromBarangs([{ buktiKepemilikan: "SHM", buktiKepemilikanNo: "427" }]).nomorGabungan,
  "427",
);
cek(
  "nama field varian (noBuktiKepemilikan)",
  certFromBarangs([{ jenisHak: "SHGB", noBuktiKepemilikan: "1234" }]).legalitas,
  "HGB",
);
cek(
  "nomor hanya ada di uraian",
  certFromBarangs([{ uraian: "SHM No. 987 Luas: 100 M2" }]).nomorGabungan,
  "987",
);
cek("barangs kosong", certFromBarangs([]).nomorGabungan, null);
cek("barangs null", certFromBarangs(null).legalitas, null);

/* ══════════════ 4. Pagar keamanan varchar(250) ═════════════════════════ */
bagian("Batas kolom");

const banyak = Array.from({ length: 80 }, (_, i) => String(10000 + i)).join(",");
const dipotong = potongNomorLegalitas(banyak);
cek("tidak melebihi 250", dipotong.length <= 250, true);
cek("tidak memotong nomor di tengah", /,\d{5}$/.test(dipotong), true);
cek("null untuk kosong", potongNomorLegalitas(""), null);

/* ══════════════ 5. Kolom lain yang sering null ═════════════════════════ */
bagian("Kolom lain");

cek("luas dari uraian", extractLuas("Luas: 147 M2"), 147);
cek("luas dengan ²", extractLuas("335 m²"), 335);
cek("luas desimal", extractLuas("Luas: 147,5 M2"), 147);
cek("tanggal Indonesia", parseTanggalId("19 Okt 2009")?.getFullYear(), 2009);
cek("tanggal + jam", parseTanggalId("4 Mei 2007 pukul 10.30 WIB")?.getHours(), 10);
cek("tanggal ejaan Nopember", parseTanggalId("1 Nopember 1998")?.getMonth(), 10);

const ALAMAT =
  "Jalan AR Hakim, Kelurahan Tegal Sari II, Kecamatan Medan Area, Kota Medan, Propinsi Sumatera Utara";
cek("kelurahan", parseWilayahFromAlamat(ALAMAT).kelurahan, "Tegal Sari II");
cek("kecamatan", parseWilayahFromAlamat(ALAMAT).kecamatan, "Medan Area");
cek("provinsi", parseWilayahFromAlamat(ALAMAT).provinsi, "Sumatera Utara");
cek("kota dari alamat", extractKota("", ALAMAT), "Kota Medan");
cek(
  "kota dari judul",
  extractKota("2 bidang tanah di Kab. Lampung Timur", ""),
  "Kab. Lampung Timur",
);

// 35% baris lelang punya alamat lengkap tapi provinsi NULL, karena aturan lama
// menuntut kata "Provinsi"/"Prov." ada di depan namanya.
cek("provinsi berlabel tetap jalan", parseWilayahFromAlamat(ALAMAT).provinsi, "Sumatera Utara");
cek(
  "provinsi telanjang di ekor alamat",
  parseWilayahFromAlamat("Jl. Merdeka, Kec. Coblong, Kota Bandung, Jawa Barat").provinsi,
  "Jawa Barat",
);
cek("alias DI Yogyakarta", tebakProvinsi("Kab. Sleman, Daerah Istimewa Yogyakarta"), "DI Yogyakarta");
cek("alias Jakarta", tebakProvinsi("Jakarta Selatan"), "DKI Jakarta");
cek("bukan provinsi → null", tebakProvinsi("Jl. Mawar No. 5"), null);

cek(
  "link lengkap",
  buildLink("67052142-f64f-11ed-b3e2-5620a0c2ec5a", "556287dd-817f-4f25-9cbe-deec414c67c2"),
  "https://lelang.go.id/kpknl/67052142-f64f-11ed-b3e2-5620a0c2ec5a/detail-auction/556287dd-817f-4f25-9cbe-deec414c67c2",
);
// Tanpa id unit kerja, tautan pendek tetap dibuat — kolom `link` adalah kunci
// anti-duplikat, jadi null di situ jauh lebih mahal daripada tautan pendek.
cek("link tanpa unit kerja", buildLink(null, "abc"), "https://lelang.go.id/detail-auction/abc");
cek("link tanpa lot → null", buildLink("x", ""), null);

/* ══════════════ Ringkasan ═════════════════════════════════════════════ */
console.log(`\n${gagal === 0 ? "✅" : "❌"} ${lulus} lulus, ${gagal} gagal\n`);
process.exit(gagal === 0 ? 0 : 1);
