"use client";

/**
 * Kalender pemilih tanggal — satu tanggal (`single`) atau rentang (`range`).
 *
 * Dua mode karena dua kebutuhan berbeda di halaman ini: jadwal survei hanya
 * butuh satu tanggal, sedangkan masa sewa butuh tanggal masuk DAN keluar. Satu
 * komponen supaya perbaikan tampilan (ukuran sel, ikon panah, batas bulan) tidak
 * pernah cuma kena separuh tempat.
 *
 * Kalender ini sengaja tidak tahu apa pun soal durasi sewa maupun harga. Tanggal
 * keluar mana yang boleh dipilih — dan pembulatannya, karena sewa bulanan hanya
 * boleh berakhir di bulan penuh — datang dari parent lewat satu fungsi
 * `snapSelesai`: kembalikan tanggal keluar sah, atau null bila tanggal itu tidak
 * boleh dipakai. Konsekuensinya penting untuk UX: pratinjau saat hover memakai
 * hasil snap, jadi rentang yang tersorot adalah rentang yang benar-benar akan
 * terpakai — bukan rentang mentah yang diam-diam bergeser setelah diklik.
 */

import React, { useState } from "react";
import { Icon } from "@iconify/react";

const NAMA_BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const NAMA_HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

const awalHari = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const samaHari = (a: Date | null | undefined, b: Date | null | undefined) =>
  !!a && !!b && awalHari(a).getTime() === awalHari(b).getTime();

export type FaseRentang = "mulai" | "selesai";

interface PropsUmum {
  /** Tanggal paling awal yang boleh dipilih. Default: hari ini. */
  minDate?: Date;
  /** Jumlah bulan ke depan yang boleh dibuka. */
  maksBulanKeDepan?: number;
  /**
   * Bulan yang dirender berdampingan. Bulan kedua disembunyikan di layar sempit
   * lewat CSS (bukan pengukuran lebar) supaya render server & klien identik.
   */
  jumlahBulan?: 1 | 2;
  /**
   * Sisa kapasitas pada sebuah tanggal — dari @/lib/sewaAvailability.
   *
   * Mengembalikan `null` berarti "tidak diketahui" (di luar horizon data), dan
   * itu SENGAJA diperlakukan sebagai tersedia: mencoret tanggal yang datanya
   * belum ada sama saja mengarang penolakan. Yang tidak diketahui diserahkan ke
   * percakapan dengan agent, bukan ditebak kalender.
   */
  ketersediaan?: (d: Date) => number | null;
  /** Kapasitas penuh kantong yang sedang dilihat. >1 mengaktifkan penanda
   *  "tinggal sedikit"; untuk unit tunggal penanda itu tidak punya arti. */
  kapasitas?: number;
  /**
   * Tanggal yang penuh ikut dinonaktifkan? Default true (tampilan penyewa).
   *
   * Pengelola memakai `false`: ia justru PERLU memilih tanggal yang sudah
   * terisi — untuk memperpanjang blok, menambah kamar yang ikut terisi, atau
   * sekadar melihat periodenya. Tanggalnya tetap ditandai merah supaya
   * keadaannya terbaca, hanya kliknya yang tidak dilarang.
   */
  ketersediaanMengunci?: boolean;
}

interface PropsSatu extends PropsUmum {
  mode?: "single";
  value: Date | null;
  onSelect: (d: Date) => void;
}

interface PropsRentang extends PropsUmum {
  mode: "range";
  mulai: Date | null;
  selesai: Date | null;
  /** Field yang sedang diisi — dikendalikan parent karena ikut menyorot chip. */
  fase: FaseRentang;
  onFase: (f: FaseRentang) => void;
  onMulai: (d: Date) => void;
  /** Dipanggil dengan tanggal hasil `snapSelesai`, bukan tanggal yang diklik. */
  onSelesai: (d: Date) => void;
  /** Tanggal keluar sah untuk `d`, atau null bila `d` tidak boleh dipilih. */
  snapSelesai: (d: Date) => Date | null;
}

type Props = PropsSatu | PropsRentang;

export default function Kalender(props: Props) {
  const {
    minDate,
    maksBulanKeDepan = 12,
    jumlahBulan = 1,
    ketersediaan,
    kapasitas = 1,
    ketersediaanMengunci = true,
  } = props;
  const rentang = props.mode === "range";

  const batasBawah = awalHari(minDate ?? new Date());
  const acuanAwal = rentang ? props.mulai : props.value;

  const [bulanTampil, setBulanTampil] = useState<Date>(() => {
    const d = new Date(acuanAwal ?? batasBawah);
    d.setDate(1);
    return d;
  });
  const [hover, setHover] = useState<Date | null>(null);

  const tahun = bulanTampil.getFullYear();
  const bulan = bulanTampil.getMonth();

  const batasAtas = new Date(batasBawah);
  batasAtas.setMonth(batasAtas.getMonth() + maksBulanKeDepan);

  const diAwal =
    tahun === batasBawah.getFullYear() && bulan === batasBawah.getMonth();
  // Bulan terakhir yang tampil, bukan yang pertama: dengan dua bulan
  // berdampingan panah kanan harus mati satu langkah lebih cepat.
  const diAkhir =
    new Date(tahun, bulan + jumlahBulan - 1, 1).getTime() >=
    new Date(batasAtas.getFullYear(), batasAtas.getMonth(), 1).getTime();

  const geser = (arah: -1 | 1) => {
    if ((arah === -1 && diAwal) || (arah === 1 && diAkhir)) return;
    setBulanTampil(new Date(tahun, bulan + arah, 1));
    setHover(null);
  };

  /**
   * Ujung rentang yang sedang digambar. Saat mengisi tanggal keluar, hover ikut
   * menggambar rentang — tapi lewat hasil snap, supaya sorotan tidak menjanjikan
   * tanggal yang bukan tanggal keluarnya.
   */
  const akhirTampil: Date | null = (() => {
    if (!rentang) return null;
    const { mulai, selesai, fase, snapSelesai } = props;
    if (
      fase === "selesai" &&
      mulai &&
      hover &&
      hover.getTime() > awalHari(mulai).getTime()
    ) {
      return snapSelesai(hover) ?? selesai;
    }
    return selesai;
  })();

  /** Sisa kamar pada `d`; null (tidak diketahui) dianggap tersedia. */
  const sisaPada = (d: Date): number | null =>
    ketersediaan ? ketersediaan(d) : null;

  /** Benar-benar tidak ada sisa pada `d`. Dipakai untuk warna DAN penguncian. */
  const habisPada = (d: Date): boolean => {
    const sisa = sisaPada(d);
    return sisa !== null && sisa <= 0;
  };

  /** Versi yang menonaktifkan sel — tunduk pada `ketersediaanMengunci`. */
  const habis = (d: Date): boolean =>
    ketersediaanMengunci && habisPada(d);

  const nonaktif = (d: Date): boolean => {
    // Tanggal yang SEDANG terpilih tidak pernah nonaktif. Lama sewa bisa disetel
    // lewat stepper sampai melewati batas jelajah kalender; tanpa pengecualian ini
    // tanggal keluar yang sedang berlaku tampil tercoret seolah tidak sah.
    if (rentang && (samaHari(d, props.mulai) || samaHari(d, props.selesai)))
      return false;
    if (d.getTime() < batasBawah.getTime()) return true;
    if (d.getTime() > batasAtas.getTime()) return true;
    if (!rentang) return habis(d);
    const { mulai, fase, snapSelesai } = props;
    // Di fase tanggal keluar, tanggal sebelum/sama dengan tanggal masuk tetap
    // bisa diklik: klik di situ berarti "ganti tanggal masuk", perilaku yang
    // sama seperti Airbnb dan jauh lebih cepat daripada memaksa kembali ke chip.
    if (fase !== "selesai" || !mulai) return habis(d);
    if (d.getTime() <= awalHari(mulai).getTime()) return habis(d);
    // Fase tanggal keluar sengaja TIDAK memeriksa `habis` sendiri.
    //
    // Rentang sewa setengah terbuka: hari check-out tidak ditempati, jadi
    // tanggal yang penuh tetap sah sebagai tanggal keluar — persis seperti
    // Airbnb, dan persis yang membuat kamar bisa berganti penghuni di hari yang
    // sama. Yang menilai boleh-tidaknya adalah `snapSelesai`, yang memeriksa
    // ketersediaan SELURUH rentang [masuk, keluar) sekaligus.
    return snapSelesai(d) == null;
  };

  const klik = (d: Date) => {
    if (nonaktif(d)) return;
    if (!rentang) {
      props.onSelect(d);
      return;
    }
    const { mulai, fase, onMulai, onFase, onSelesai, snapSelesai } = props;
    if (fase === "mulai" || !mulai || d.getTime() <= awalHari(mulai).getTime()) {
      onMulai(d);
      onFase("selesai");
      setHover(null);
      return;
    }
    const akhir = snapSelesai(d);
    if (!akhir) return;
    onSelesai(akhir);
    onFase("mulai");
    setHover(null);
  };

  const renderBulan = (offset: number) => {
    const y = new Date(tahun, bulan + offset, 1).getFullYear();
    const m = new Date(tahun, bulan + offset, 1).getMonth();
    const hariPertama = new Date(y, m, 1).getDay();
    const jumlahHari = new Date(y, m + 1, 0).getDate();

    return (
      <div key={`${y}-${m}`} className={offset > 0 ? "hidden sm:block" : ""}>
        <p className="mb-3 text-center text-sm font-extrabold text-white">
          {NAMA_BULAN[m]} {y}
        </p>

        <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-black uppercase tracking-wider text-white/25">
          {NAMA_HARI.map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {Array.from({ length: hariPertama }).map((_, i) => (
            <div key={`kosong-${i}`} className="h-10" />
          ))}
          {Array.from({ length: jumlahHari }).map((_, i) => {
            const tanggal = new Date(y, m, i + 1);
            const mati = nonaktif(tanggal);
            const hariIni = samaHari(tanggal, new Date());

            // "Tinggal sedikit" hanya berarti kalau ada lebih dari satu kamar
            // untuk diperebutkan. Pada unit tunggal, sisa 1 adalah keadaan
            // normal — mewarnainya kuning tiap hari cuma melatih mata
            // mengabaikan warna itu.
            const sisa = sisaPada(tanggal);
            const menipis =
              !mati && kapasitas > 1 && sisa !== null && sisa > 0 && sisa <= 2;
            // Penuh tapi tetap bisa diklik — hanya terjadi di kalender
            // pengelola (`ketersediaanMengunci={false}`).
            const penuhTerbuka = !mati && habisPada(tanggal);

            const awal = rentang ? props.mulai : props.value;
            const isAwal = samaHari(tanggal, awal);
            const isAkhir = rentang && samaHari(tanggal, akhirTampil);
            const dalam =
              rentang &&
              !!awal &&
              !!akhirTampil &&
              tanggal.getTime() > awalHari(awal).getTime() &&
              tanggal.getTime() < awalHari(akhirTampil).getTime();
            const terpilih = isAwal || isAkhir;

            // Batang penghubung digambar per sel dan dibiarkan menempel ke tepi
            // sel tetangga; pil bulat tanggal ujung menutupi sisanya.
            const punyaAkhir = rentang && !!akhirTampil && !samaHari(awal, akhirTampil);
            const batang =
              dalam || (punyaAkhir && (isAwal || isAkhir))
                ? isAwal
                  ? "inset-y-1 left-1/2 right-0"
                  : isAkhir
                    ? "inset-y-1 left-0 right-1/2"
                    : "inset-y-1 inset-x-0"
                : null;

            return (
              <div
                key={i}
                className="relative flex h-10 items-center justify-center"
              >
                {batang && (
                  <span
                    className={`pointer-events-none absolute ${batang} bg-sky-400/[0.12]`}
                  />
                )}
                <button
                  onClick={() => klik(tanggal)}
                  onMouseEnter={() => !mati && setHover(tanggal)}
                  // Hanya membersihkan hover-nya sendiri: saat kursor berpindah ke
                  // sel tetangga, mouseleave sel lama menyusul mouseenter sel baru
                  // dan setHover(null) tanpa syarat membuat pratinjau berkedip.
                  onMouseLeave={() =>
                    setHover((h) => (samaHari(h, tanggal) ? null : h))
                  }
                  disabled={mati}
                  aria-pressed={terpilih}
                  aria-label={[
                    tanggal.toLocaleDateString("id-ID", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    }),
                    // Pembaca layar tidak bisa melihat coretan maupun warna
                    // kuning, jadi keduanya diucapkan.
                    habisPada(tanggal) ? "penuh" : null,
                    menipis ? `sisa ${sisa} kamar` : null,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                  className={`relative flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    mati
                      ? "cursor-not-allowed text-white/15 line-through decoration-white/10"
                      : terpilih
                        ? "scale-105 bg-sky-400 text-[#06131f] shadow-lg shadow-sky-400/25"
                        : dalam
                          ? "text-sky-200 hover:bg-white/10"
                          : penuhTerbuka
                            ? "bg-rose-400/[0.12] text-rose-300 hover:bg-rose-400/20"
                            : menipis
                              ? "text-amber-300 hover:bg-white/10"
                              : "text-white/80 hover:bg-white/10"
                  }`}
                >
                  {i + 1}
                  {hariIni && !terpilih && (
                    <span className="absolute bottom-1 h-1 w-1 rounded-full bg-sky-300" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="relative w-full">
      <button
        onClick={() => geser(-1)}
        disabled={diAwal}
        className="absolute left-0 top-0 z-10 rounded-lg p-1.5 text-white transition-colors hover:bg-white/10 disabled:opacity-20"
        aria-label="Bulan sebelumnya"
      >
        <Icon icon="solar:alt-arrow-left-linear" />
      </button>
      <button
        onClick={() => geser(1)}
        disabled={diAkhir}
        className="absolute right-0 top-0 z-10 rounded-lg p-1.5 text-white transition-colors hover:bg-white/10 disabled:opacity-20"
        aria-label="Bulan berikutnya"
      >
        <Icon icon="solar:alt-arrow-right-linear" />
      </button>

      <div
        className={`grid gap-x-7 gap-y-5 ${
          jumlahBulan === 2 ? "sm:grid-cols-2" : ""
        }`}
      >
        {Array.from({ length: jumlahBulan }).map((_, i) => renderBulan(i))}
      </div>
    </div>
  );
}
