"use client";

/**
 * State pemesanan halaman detail sewa.
 *
 * Ditaruh di satu hook karena TIGA tempat harus menampilkan jawaban yang sama
 * persis: kartu tipe kamar di kolom kiri, panel booking sticky di kanan (desktop),
 * dan bottom sheet di mobile. Kalau masing-masing menyimpan "tipe terpilih" dan
 * "durasi" sendiri, user memilih tipe di kartu lalu melihat harga tipe lain di
 * panel — kesalahan yang paling mahal di halaman ini, karena angka itulah yang
 * dia kirim ke agent lewat WhatsApp.
 *
 * Aturan yang dijaga di sini:
 *   1. Durasi yang bisa dipilih hanya yang benar-benar ditawarkan (harga terisi).
 *   2. Tipe terpilih harus punya harga untuk durasi terpilih — kalau tidak,
 *      pindah otomatis ke tipe termurah yang punya, bukan menampilkan "Rp 0".
 *   3. Lama sewa tidak pernah di bawah minimal sewa untuk durasi yang sama.
 *   4. Ketersediaan dinilai atas SELURUH masa sewa, bukan hari pertamanya —
 *      lihat catatan di `sisaRentang`.
 */

import { useCallback, useMemo, useState } from "react";
import {
  DURASI_META,
  durasiTersedia,
  selisihHari,
  tambahDurasi,
  tipeDefault,
  tipeTermurah,
  unitDurasiMenutupi,
  type DurasiKey,
  type TipeKamarView,
} from "@/lib/kosDetail";
import {
  kunciDariKalender,
  kunciHariIni,
  sisaMinimumRentang,
  sisaPadaTanggal,
  type InventarisView,
} from "@/lib/sewaAvailability";
import type { SewaDetailData } from "../types";

export interface BookingState {
  /** Durasi yang bisa dipilih user (tab), urut dari terpendek. */
  durasiOpsi: DurasiKey[];
  durasi: DurasiKey;
  pilihDurasi: (d: DurasiKey) => void;

  tipeList: TipeKamarView[];
  /** null saat kos tidak memakai tipe kamar (semua kamar sama). */
  tipe: TipeKamarView | null;
  pilihTipe: (id: string) => void;
  /** Tipe ini tidak menawarkan durasi yang sedang dipilih. */
  tipeTanpaDurasi: (t: TipeKamarView) => boolean;

  tanggalMulai: Date | null;
  setTanggalMulai: (d: Date | null) => void;
  /** Selalu turunan dari tanggal masuk + lama sewa — tidak pernah state sendiri. */
  tanggalSelesai: Date | null;
  /** Tetapkan masa sewa dari tanggal keluar (kebalikan arah dari stepper). */
  setTanggalSelesai: (d: Date) => void;
  /** Tanggal keluar sah terdekat untuk `d`, atau null bila `d` tidak boleh. */
  snapTanggalSelesai: (d: Date) => Date | null;
  /** Total hari masa sewa — null bila tanggal masuk belum dipilih. */
  totalHari: number | null;
  hapusTanggal: () => void;

  lama: number;
  /** Naik/turunkan lama sewa. Delta, bukan nilai absolut — lihat catatan di
   *  implementasinya soal klik beruntun. */
  ubahLama: (delta: number) => void;
  lamaMin: number;
  lamaMaks: number;

  penghuni: number;
  ubahPenghuni: (delta: number) => void;
  penghuniMaks: number;

  /** Harga satu satuan durasi untuk tipe terpilih. 0 = tidak ditawarkan. */
  hargaSatuan: number;
  subtotal: number;
  deposit: number;
  total: number;

  /**
   * Sisa kamar pada tipe terpilih sepanjang masa sewa yang dipilih (atau hari
   * ini bila tanggal belum diisi). `null` untuk listing unit tunggal, yang
   * tidak punya konsep "sisa kamar" — pakai `penuh` untuk itu.
   */
  sisaKamar: number | null;
  penuh: boolean;
  /** Penuhnya karena tanggal yang dipilih, bukan karena memang sedang penuh. */
  penuhKarenaTanggal: boolean;
  /** Sisa kamar sebuah tipe pada masa sewa terpilih — untuk daftar pilih tipe. */
  sisaUntukTipe: (t: TipeKamarView) => number;
  /** Sisa pada satu tanggal, bentuk yang dimakan prop `ketersediaan` Kalender.
   *  null = di luar horizon data (jangan dicoret). */
  ketersediaanKalender: (d: Date) => number | null;
  /** Kapasitas kantong yang sedang dilihat — Kalender memakainya untuk
   *  memutuskan apakah penanda "tinggal sedikit" punya arti. */
  kapasitas: number;
}

/** Batas atas lama sewa per durasi — menjaga angka tetap masuk akal. */
const LAMA_MAKS: Record<DurasiKey, number> = {
  HARIAN: 30,
  MINGGUAN: 12,
  BULANAN: 24,
  TAHUNAN: 5,
};

export function useBooking(data: SewaDetailData): BookingState {
  const tipeList = data.tipeKamar;

  const durasiOpsi = useMemo<DurasiKey[]>(() => {
    if (tipeList.length > 0) return durasiTersedia(tipeList);
    const dari = Object.keys(data.hargaDurasi) as DurasiKey[];
    return dari.length > 0 ? dari : data.durasiUtama ? [data.durasiUtama] : [];
  }, [tipeList, data.hargaDurasi, data.durasiUtama]);

  const durasiAwal =
    data.durasiUtama && durasiOpsi.includes(data.durasiUtama)
      ? data.durasiUtama
      : durasiOpsi[0] ?? "BULANAN";

  const [durasi, setDurasi] = useState<DurasiKey>(durasiAwal);
  const [tipeId, setTipeId] = useState<string | null>(
    () => tipeDefault(tipeList, durasiAwal)?.id ?? null,
  );
  const [tanggalMulai, setTanggalMulai] = useState<Date | null>(null);
  const [penghuni, setPenghuni] = useState(1);

  const minimalUntukDurasi = useCallback(
    (d: DurasiKey) =>
      data.minimalSewaSatuan === d && data.minimalSewaJumlah
        ? Math.max(1, data.minimalSewaJumlah)
        : 1,
    [data.minimalSewaSatuan, data.minimalSewaJumlah],
  );

  const [lama, setLamaRaw] = useState(() => minimalUntukDurasi(durasiAwal));

  // Dihitung di sini — sebelum blok ketersediaan — karena masa sewa yang
  // sedang berlaku adalah rentang yang dipakai menilai "sisa berapa kamar".
  const lamaMin = minimalUntukDurasi(durasi);
  const lamaMaks = LAMA_MAKS[durasi];
  const lamaTerpakai = Math.min(Math.max(lama, lamaMin), lamaMaks);

  const tipe = useMemo(
    () => tipeList.find((t) => t.id === tipeId) ?? null,
    [tipeList, tipeId],
  );

  /** Masa sewa yang sedang berlaku, atau null bila tanggal masuk belum dipilih. */
  const tanggalSelesai = tanggalMulai
    ? tambahDurasi(tanggalMulai, durasi, lamaTerpakai)
    : null;

  // ── KETERSEDIAAN ──────────────────────────────────────────────────────────
  // Blok datang dari server sebagai data mentah (bukan peta tanggal→sisa yang
  // sudah jadi) dan dihitung di sini dengan modul yang SAMA PERSIS dengan yang
  // dipakai server saat memvalidasi. Itu satu-satunya cara memastikan tanggal
  // yang terlihat bisa dipilih memang tanggal yang akan diterima API.
  const blok = data.ketersediaan?.blok ?? [];
  const horizonSampai = data.ketersediaan?.horizonSampai ?? "9999-12-31";

  /**
   * Kantong kapasitas sebuah tipe, atau `null` bila kapasitasnya belum
   * diketahui (kos yang jumlah kamarnya belum pernah diisi agent).
   *
   * "Belum diketahui" sengaja dibedakan dari "nol". Menebaknya 1 membuat
   * halaman menjanjikan satu kamar yang belum tentu ada; menebaknya 0 membuat
   * kos yang sebenarnya kosong tampil penuh. Yang benar adalah diam: tidak ada
   * angka, tidak ada tanggal tercoret, dan percakapannya diserahkan ke agent.
   */
  const invUntuk = useCallback(
    (idTipe: string | null): InventarisView | null =>
      data.ketersediaan?.inventaris.find((i) => i.idTipe === idTipe) ?? null,
    [data.ketersediaan],
  );

  const invAktif = useMemo(
    () => invUntuk(tipe ? tipe.id : null),
    [invUntuk, tipe],
  );

  const ketersediaanKalender = useCallback(
    (d: Date): number | null => {
      if (!invAktif) return null;
      const k = kunciDariKalender(d);
      // Di luar horizon jawabannya bukan "penuh" melainkan "belum diketahui".
      if (k >= horizonSampai) return null;
      return sisaPadaTanggal(invAktif, blok, k);
    },
    [invAktif, blok, horizonSampai],
  );

  /**
   * Rentang yang dipakai menilai ketersediaan: masa sewa terpilih, atau hari
   * ini saja bila penyewa belum memilih tanggal.
   */
  const rentangNilai = useMemo(() => {
    if (!tanggalMulai || !tanggalSelesai) {
      return { mulai: kunciHariIni(), selesai: null as string | null };
    }
    return {
      mulai: kunciDariKalender(tanggalMulai),
      selesai: kunciDariKalender(tanggalSelesai),
    };
  }, [tanggalMulai, tanggalSelesai]);

  const sisaUntukTipe = useCallback(
    (t: TipeKamarView): number => {
      const inv = invUntuk(t.id);
      // Tipe tanpa kantong (kapasitas belum diisi) dianggap masih ada kamar —
      // menonaktifkannya di daftar akan menyembunyikan tipe yang sebenarnya
      // belum tentu penuh.
      if (!inv) return t.jumlahKamar > 0 ? t.jumlahKamar : 1;
      // Dinilai atas masa sewa yang sedang dipilih, bukan atas hari ini —
      // daftar tipe tidak boleh menjanjikan kamar untuk periode yang panelnya
      // sendiri sudah menolak.
      return sisaMinimumRentang(
        inv,
        blok,
        rentangNilai.mulai,
        rentangNilai.selesai,
      );
    },
    [invUntuk, blok, rentangNilai],
  );

  const tipeTanpaDurasi = useCallback(
    (t: TipeKamarView) => !((t.harga[durasi] ?? 0) > 0),
    [durasi],
  );

  const pilihDurasi = useCallback(
    (d: DurasiKey) => {
      setDurasi(d);
      // Lama sewa dikembalikan ke minimum, TIDAK dipertahankan: angkanya berganti
      // arti. "6" pada tab Bulanan berarti setengah tahun, pada tab Tahunan
      // berarti enam tahun — mempertahankannya membuat total melonjak belasan
      // kali lipat hanya karena user penasaran melihat harga tahunan.
      setLamaRaw(minimalUntukDurasi(d));
      // Tipe yang tidak menawarkan durasi baru tidak boleh tetap terpilih —
      // panel harga akan menampilkan angka kosong sementara tombol WA tetap
      // aktif, dan pesan yang terkirim ke agent jadi tidak masuk akal.
      setTipeId((prevId) => {
        const prev = tipeList.find((t) => t.id === prevId);
        if (prev && (prev.harga[d] ?? 0) > 0) return prevId;
        return tipeDefault(tipeList, d)?.id ?? prevId;
      });
    },
    [tipeList, minimalUntukDurasi],
  );

  const pilihTipe = useCallback(
    (id: string) => {
      const target = tipeList.find((t) => t.id === id);
      if (!target) return;
      setTipeId(id);
      // Kebalikan dari pilihDurasi: user memilih tipe lebih dulu, jadi durasi
      // yang menyesuaikan — pindah ke durasi terpendek yang ditawarkan tipe itu.
      if ((target.harga[durasi] ?? 0) <= 0) {
        const gantiDurasi = (Object.keys(target.harga) as DurasiKey[]).find(
          (d) => (target.harga[d] ?? 0) > 0,
        );
        if (gantiDurasi) {
          setDurasi(gantiDurasi);
          setLamaRaw(minimalUntukDurasi(gantiDurasi));
        }
      }
    },
    [tipeList, durasi, minimalUntukDurasi],
  );

  /**
   * Delta, bukan nilai absolut.
   *
   * Kalau tombol mengirim `lama + 1` berdasarkan angka yang sedang dirender,
   * dua klik cepat berturut-turut membaca angka lama yang sama dan hasilnya
   * hanya naik satu — hilang satu klik. Dengan updater fungsional, tiap klik
   * dihitung dari nilai terbaru walau React belum sempat me-render.
   */
  const ubahLama = useCallback(
    (delta: number) =>
      setLamaRaw((prev) => Math.min(Math.max(prev + delta, lamaMin), lamaMaks)),
    [lamaMin, lamaMaks],
  );

  /**
   * Tanggal keluar → lama sewa.
   *
   * Yang disimpan tetap `lama`, bukan tanggal keluarnya. Kalau tanggal keluar
   * ikut jadi state, ada dua sumber kebenaran yang bisa berselisih: mengganti tab
   * durasi atau menaikkan stepper akan meninggalkan tanggal lama yang tidak lagi
   * cocok dengan total harga. Dengan lama sewa sebagai satu-satunya state,
   * tanggal keluar selalu hasil hitungan `tambahDurasi` — persis angka yang
   * dipakai menghitung subtotal.
   */
  const snapTanggalSelesai = useCallback(
    (d: Date): Date | null => {
      if (!tanggalMulai) return null;
      const n = unitDurasiMenutupi(tanggalMulai, d, durasi);
      // Di luar batas sewa: dikembalikan null supaya tanggalnya tampil nonaktif
      // di kalender — lebih jelas daripada diam-diam digeser ke batas terdekat.
      if (n < lamaMin || n > lamaMaks) return null;
      const akhir = tambahDurasi(tanggalMulai, durasi, n);
      // Kapasitas belum diketahui → jangan menolak apa pun.
      if (!invAktif) return akhir;

      // Ketersediaan dinilai atas SELURUH rentang, bukan atas ujungnya.
      //
      // Ini yang membuat kalender tidak berbohong: kamar bisa saja kosong di
      // tanggal masuk DAN di tanggal keluar, tapi terisi di tengah. Menilai
      // ujungnya saja akan menawarkan masa sewa yang mustahil, dan penyewa
      // baru mengetahuinya setelah mengirim WhatsApp.
      //
      // Perhatikan rentangnya setengah terbuka — `akhir` tidak ikut diperiksa,
      // karena hari check-out memang tidak ditempati.
      const sisa = sisaMinimumRentang(
        invAktif,
        blok,
        kunciDariKalender(tanggalMulai),
        kunciDariKalender(akhir),
      );
      if (sisa <= 0) return null;

      return akhir;
    },
    [tanggalMulai, durasi, lamaMin, lamaMaks, invAktif, blok],
  );

  const setTanggalSelesai = useCallback(
    (d: Date) => {
      if (!tanggalMulai) return;
      const n = unitDurasiMenutupi(tanggalMulai, d, durasi);
      setLamaRaw(Math.min(Math.max(n, lamaMin), lamaMaks));
    },
    [tanggalMulai, durasi, lamaMin, lamaMaks],
  );

  const penghuniMaks = Math.max(
    1,
    tipe?.kapasitasPenghuni ?? data.kapasitasPenghuni ?? 2,
  );

  const hargaSatuan = tipe
    ? tipe.harga[durasi] ?? 0
    : data.hargaDurasi[durasi] ?? 0;

  const subtotal = hargaSatuan * lamaTerpakai;
  const deposit = data.deposit ?? 0;

  /**
   * Sisa kamar untuk masa sewa yang sedang dipilih — angka tunggal yang
   * menentukan seluruh keadaan panel.
   *
   * Yang terkecil sepanjang rentang, bukan yang di hari pertama: kamar yang
   * kosong hari ini tapi terisi minggu depan tidak bisa disewa sebulan, dan
   * menampilkan "sisa 3" untuk rentang itu adalah janji yang akan dibantah
   * agent di WhatsApp.
   */
  const sisaRentang = invAktif
    ? sisaMinimumRentang(invAktif, blok, rentangNilai.mulai, rentangNilai.selesai)
    : null;

  // `null` (kapasitas belum diisi) BUKAN penuh. Ini pembedaan yang menjaga
  // listing lama — yang jumlah kamarnya belum pernah dicatat — tidak mendadak
  // terkunci dari pemesanan hanya karena fitur ini dipasang.
  const penuh = sisaRentang !== null && sisaRentang <= 0;

  return {
    durasiOpsi,
    durasi,
    pilihDurasi,
    tipeList,
    tipe,
    pilihTipe,
    tipeTanpaDurasi,
    tanggalMulai,
    setTanggalMulai,
    tanggalSelesai,
    setTanggalSelesai,
    snapTanggalSelesai,
    totalHari:
      tanggalMulai && tanggalSelesai
        ? selisihHari(tanggalMulai, tanggalSelesai)
        : null,
    hapusTanggal: () => setTanggalMulai(null),
    lama: lamaTerpakai,
    ubahLama,
    lamaMin,
    lamaMaks,
    penghuni: Math.min(penghuni, penghuniMaks),
    ubahPenghuni: (delta: number) =>
      setPenghuni((prev) => Math.min(Math.max(prev + delta, 1), penghuniMaks)),
    penghuniMaks,
    hargaSatuan,
    subtotal,
    deposit,
    total: subtotal + deposit,
    // Angka kamar hanya punya arti pada kos yang kapasitasnya diketahui.
    // Unit tunggal memakai `penuh`.
    sisaKamar: data.modelInventaris === "KAMAR" ? sisaRentang : null,
    penuh,
    // Membedakan "listing ini memang sedang penuh" dari "tanggal yang Anda
    // pilih yang tidak bisa" — dua keadaan yang butuh dua kalimat berbeda,
    // dan yang kedua masih punya jalan keluar (ganti tanggal).
    penuhKarenaTanggal: penuh && tanggalMulai !== null,
    sisaUntukTipe,
    ketersediaanKalender,
    // 1 = penanda "tinggal sedikit" tidak akan pernah menyala, yang benar
    // untuk unit tunggal maupun untuk kapasitas yang belum diketahui.
    kapasitas: invAktif?.totalKamar ?? 1,
  };
}

/** Label satuan durasi siap tempel, mis. "3 bulan". */
export const labelLama = (n: number, d: DurasiKey) =>
  `${n} ${DURASI_META[d].satuan}`;
