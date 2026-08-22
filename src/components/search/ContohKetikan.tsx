"use client";

/**
 * Contoh pencarian yang MENGETIK DIRINYA SENDIRI di kolom yang masih kosong.
 *
 * ── APA YANG DIAJARKANNYA ───────────────────────────────────────────────────
 * Kolom ini menerima TIGA hal yang sangat berbeda, dan tidak satu pun terlihat
 * dari kotak kosong:
 *
 *   TEMPAT  — "deket UNESA", "deket kampus" → aset di sekitar tempat itu.
 *   ALAMAT  — "Dukuh Kupang", "Jl. Mastrip" → dicari di alamat, kelurahan,
 *             kecamatan, judul.
 *   ID      — angka murni → satu properti tertentu.
 *
 * Versi pertama mengunci awalannya jadi "deket ", jadi ia cuma bisa
 * mengajarkan yang pertama — dua kemampuan lain tetap tersembunyi. Sekarang
 * contohnya berselang-seling di antara ketiganya, dan tiap contoh melaporkan
 * JENISNYA ke pemanggil supaya lencana di sudut kolom ikut berganti
 * ("Tempat" / "Alamat" / "ID"). Lencana itu memakai ruang yang memang kosong
 * saat kolomnya kosong, dan menampilkan persis umpan balik yang akan muncul
 * setelah user benar-benar mengetik.
 *
 * ── KENAPA MENGETIK, BUKAN SEKADAR BERGANTI ─────────────────────────────────
 * Menukar seluruh baris sekaligus memaksa mata membaca ulang dari huruf
 * pertama setiap kali. Mengetik huruf-per-huruf adalah bentuk gerak yang tidak
 * bisa disalahartikan sebagai apa pun selain "kolom ini diketik" — dan kata
 * "deket" yang ikut diketik adalah instruksinya itu sendiri.
 *
 * ── KENAPA KOMPONEN SENDIRI ─────────────────────────────────────────────────
 * Mengetik berarti satu render per huruf. Ditaruh di dalam KeywordField, tiap
 * huruf ikut me-render ulang kotak pencarian beserta panel sarannya — biaya
 * yang dibayar terus-menerus untuk hiasan. Sebagai daun tersendiri, yang
 * ter-render ulang hanya satu <span>.
 */

import { memo, useEffect, useRef, useState } from "react";

export type JenisContoh = "tempat" | "alamat" | "id";

interface Contoh {
  teks: string;
  jenis: JenisContoh;
}

/**
 * Berselang-seling, bukan dikelompokkan.
 *
 * Dikelompokkan (tiga tempat, lalu tiga alamat), orang yang cuma melirik lima
 * detik akan menyimpulkan kolom ini hanya menerima satu jenis. Berselang-seling,
 * lirikan sependek apa pun kemungkinan besar menangkap dua jenis yang berbeda —
 * dan dua sudah cukup untuk menyadari bahwa kolomnya menerima lebih dari satu
 * macam isi.
 *
 * Contoh tempat & alamat sengaja nyata (UNESA, Dukuh Kupang) — nama sungguhan
 * langsung dikenali sebagai kemampuan. Contoh ID sengaja TIDAK nyata: nomor
 * yang tampak seperti format tidak menjanjikan apa-apa, sedangkan nomor
 * sungguhan akan berbohong pada hari properti itu dihapus.
 */
const CONTOH: Contoh[] = [
  { teks: "deket UNESA", jenis: "tempat" },
  { teks: "Dukuh Kupang", jenis: "alamat" },
  // ID ditaruh KETIGA, bukan di tengah daftar: dengan urutan ini ketiga
  // kemampuan sudah lewat dalam ±5,5 detik — kira-kira selama orang menatap
  // kotak pencarian sebelum memutuskan apa yang mau diketik. Ditaruh
  // belakangan, yang paling tidak terduga justru yang paling sering terlewat.
  { teks: "123456", jenis: "id" },
  { teks: "deket kampus", jenis: "tempat" },
  { teks: "Jl. Mastrip", jenis: "alamat" },
  { teks: "deket rumah sakit", jenis: "tempat" },
];

/** Bagian yang tidak pernah berubah — jangkar buat mata. */
const AWAL_TETAP = "Coba: ";

const KETIK_MS = 55;
const HAPUS_MS = 26;
/** Jeda saat contoh selesai diketik. Cukup lama untuk dibaca sekali penuh. */
const TAHAN_MS = 1_500;
/** Jeda saat menampilkan konteks halaman (dipakai command bar mobile). */
const AWALAN_MS = 2_600;

type Fase = "awalan" | "ketik" | "hapus";

export interface ContohKetikanProps {
  /**
   * Kalimat konteks halaman ("Cari properti disewakan"). Bila ada, ia tampil
   * DIAM di antara siklus — konteks halaman tidak boleh hilang hanya karena
   * kolomnya ingin mengajarkan sesuatu.
   */
  awalan?: string;
  /** Dipanggil saat contoh berganti jenis — untuk lencana di sudut kolom. */
  onJenis?: (jenis: JenisContoh | null) => void;
  className?: string;
  /** Kelas untuk bagian yang diam. */
  kelasAwal?: string;
  /** Kelas untuk bagian yang diketik — sengaja lebih terang. */
  kelasInti?: string;
}

function ContohKetikanDasar({
  awalan,
  onJenis,
  className = "",
  kelasAwal = "",
  kelasInti = "",
}: ContohKetikanProps) {
  const [diam, setDiam] = useState(false);
  const [fase, setFase] = useState<Fase>(awalan ? "awalan" : "ketik");
  const [indeks, setIndeks] = useState(0);
  const [huruf, setHuruf] = useState(0);

  // Gerakan yang tidak diminta adalah gerakan yang mengganggu. Sebagian orang
  // memang tidak bisa membaca sambil ada yang bergerak di dekat teksnya.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const setel = () => setDiam(mq.matches);
    setel();
    mq.addEventListener("change", setel);
    return () => mq.removeEventListener("change", setel);
  }, []);

  const contoh = CONTOH[indeks % CONTOH.length];

  /**
   * Jenis dilaporkan hanya SAAT BERUBAH, bukan tiap huruf.
   *
   * Tanpa penjaga ini, pemanggilnya ikut me-render ulang lima puluh kali per
   * contoh — persis biaya yang komponen ini dipisah untuk menghindarinya.
   */
  const jenisTerakhir = useRef<JenisContoh | null>(null);
  useEffect(() => {
    const jenis = diam || fase !== "awalan" ? contoh.jenis : null;
    if (jenisTerakhir.current === jenis) return;
    jenisTerakhir.current = jenis;
    onJenis?.(jenis);
  }, [contoh.jenis, diam, fase, onJenis]);

  // Saat komponen dilepas (user mulai mengetik), lencana contoh harus ikut
  // hilang — kalau tidak ia menggantung sebagai keadaan yang tidak lagi benar.
  useEffect(() => () => onJenis?.(null), [onJenis]);

  useEffect(() => {
    if (diam) return;

    // Satu timeout per langkah, dijadwalkan ulang oleh perubahan state itu
    // sendiri. Tidak ada interval yang harus disinkronkan, jadi tidak ada
    // keadaan di mana penghapusan dan pengetikan berjalan bersamaan.
    const jadwal = (ms: number, lakukan: () => void) => {
      const id = setTimeout(lakukan, ms);
      return () => clearTimeout(id);
    };

    if (fase === "awalan") return jadwal(AWALAN_MS, () => setFase("ketik"));
    if (fase === "ketik") {
      if (huruf < contoh.teks.length) {
        return jadwal(KETIK_MS, () => setHuruf((h) => h + 1));
      }
      return jadwal(TAHAN_MS, () => setFase("hapus"));
    }
    if (huruf > 0) return jadwal(HAPUS_MS, () => setHuruf((h) => h - 1));

    const berikut = indeks + 1;
    const habis = berikut % CONTOH.length === 0;
    return jadwal(120, () => {
      setIndeks(berikut);
      // Setelah satu putaran penuh, konteks halaman ditampilkan lagi.
      setFase(awalan && habis ? "awalan" : "ketik");
    });
  }, [diam, fase, huruf, indeks, awalan, contoh.teks.length]);

  if (diam) {
    return (
      <span className={className}>
        <span className={`whitespace-pre ${kelasAwal}`}>{AWAL_TETAP}</span>
        <span className={kelasInti}>{CONTOH[0].teks}</span>
      </span>
    );
  }

  if (fase === "awalan" && awalan) {
    return <span className={`${className} ${kelasAwal}`}>{awalan}</span>;
  }

  return (
    <span className={className}>
      {/* whitespace-pre: spasi di ujung "Coba: " harus bertahan. Tanpa itu
          contohnya menempel ke katanya ("Coba:deket"). */}
      <span className={`whitespace-pre ${kelasAwal}`}>{AWAL_TETAP}</span>
      <span className={kelasInti}>{contoh.teks.slice(0, huruf)}</span>
      {/* Kursor menempel di ujung teks yang diketik, bukan di ujung kotak —
          itulah yang membuatnya terbaca sebagai "sedang mengetik".

          Digambar sebagai BATANG, bukan huruf "|": lebar huruf itu berbeda di
          tiap fonta, dan di beberapa fonta ia terlalu tinggi sehingga terpotong
          pembungkusnya yang ber-overflow-hidden. `bg-current` membuatnya
          mewarisi warna teks yang sedang diketik tanpa perlu prop warna kedua. */}
      <span
        aria-hidden="true"
        className={`kursor-ketik ml-[2px] inline-block h-[0.95em] w-[2px] translate-y-[1px] rounded-[1px] bg-current ${kelasInti}`}
      />
    </span>
  );
}

/**
 * Di-memo karena propsnya praktis tidak pernah berubah: satu-satunya alasan ia
 * boleh render ulang adalah detak animasinya sendiri.
 */
export const ContohKetikan = memo(ContohKetikanDasar);
export default ContohKetikan;
