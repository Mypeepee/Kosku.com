"use client";

/**
 * Kerangka halaman detail sewa.
 *
 * Susunannya mengikuti halaman Jual & Lelang supaya satu kebiasaan berlaku di
 * seluruh situs: spacer header → breadcrumb → judul → galeri → dua kolom
 * (informasi | panel aksi sticky) → rekomendasi. Yang berbeda hanya isi kolom
 * kanan: di Jual itu kartu agent, di sini panel pemesanan kamar.
 *
 * Urutan visual mobile dibalik lewat `order-*`: galeri naik ke paling atas
 * karena di layar kecil foto yang menahan orang untuk lanjut membaca, sementara
 * di desktop judul lebih dulu supaya breadcrumb & heading tetap satu blok.
 */

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";

import ImageGallery from "./components/ImageGallery";
import DetailInfo from "./components/DetailInfo";
import BookingSidebar from "./components/BookingSidebar";
import KontakSidebar from "./components/KontakSidebar";
import PanelPengelola from "./components/PanelPengelola";
import KelolaKetersediaan from "./components/KelolaKetersediaan";
import KelolaVoucher from "./components/KelolaVoucher";
import SimilarProperties from "./components/SimilarProperties";
import MarkSoldControl from "@/components/property/MarkSoldControl";
import type { ListingStatus } from "@/lib/listingStatusPermission";
import { punyaKalenderKetersediaan } from "@/lib/sewaAvailability";
import { useBooking } from "./lib/useBooking";
import { useModePengelola } from "./lib/useModePengelola";
import { AKSEN, CAHAYA_HALAMAN } from "./components/sewaTheme";
import type { SewaDetailData, SewaSimilarItem } from "./types";

interface Props {
  data: SewaDetailData;
  similar: SewaSimilarItem[];
}

export default function DetailClient({ data, similar }: Props) {
  const router = useRouter();
  const booking = useBooking(data);
  const pengelola = useModePengelola(data.agent.idAgent);
  const [tersalin, setTersalin] = useState(false);
  const [disimpan, setDisimpan] = useState(false);
  const [kelolaBuka, setKelolaBuka] = useState(false);
  const [voucherKelolaBuka, setVoucherKelolaBuka] = useState(false);
  /**
   * Dinaikkan tiap kali pemilik menyunting vouchernya. Dua tempat ikut
   * mendengarkan: ringkasan di tombol panel kontrol, dan katalog di panel
   * pemesanan. Tanpa ini, panel di belakang drawer tetap menawarkan promo yang
   * baru saja dihapus sampai halaman dimuat ulang — dan halaman ini di-ISR,
   * jadi `router.refresh()` pun tidak menyentuh state klien itu.
   */
  const [voucherVersi, setVoucherVersi] = useState(0);

  // Status dipegang di sini supaya penanda "Tersewa" di galeri & judul
  // berubah seketika saat agent menekan tombolnya, tanpa memuat ulang
  // halaman yang bisa saja masih tersaji dari cache.
  const [statusTayang, setStatusTayang] = useState<string>(data.statusTayang);

  const tersewa = statusTayang !== "TERSEDIA";

  /**
   * Bentuk transaksi kategori ini — keputusan tunggal yang menentukan seluruh
   * kolom kanan halaman.
   *
   * BOOKING (kos, apartemen, villa) → panel pemesanan: tanggal, tipe kamar,
   * voucher, "Ajukan Sewa". NEGOSIASI (gudang, ruko, pabrik, tanah, rumah) →
   * panel kontak: chat, ajukan penawaran, jadwalkan survei — sama seperti
   * halaman detail Jual & Lelang, karena persoalannya memang sama: tidak ada
   * yang bisa "dipesan", yang ada adalah percakapan.
   *
   * Nilainya datang dari server (tabel @/lib/sewaKapabilitas), bukan disimpulkan
   * di sini — supaya halaman, API tulis, dan formulir tambah properti tidak
   * pernah bisa berbeda pendapat soal kategori yang sama.
   */
  const modePemesanan = data.modeSewa === "BOOKING";

  // Kalender ketersediaan hanya untuk kategori bermode BOOKING — aturannya
  // dipegang satu tempat supaya tombol di sini dan API tidak pernah berbeda
  // pendapat.
  const berkalender = punyaKalenderKetersediaan(data.kategori);

  // Anak-anak komponen tetap membaca satu objek `data` seperti sebelumnya —
  // hanya statusnya yang ditimpa nilai terbaru. Dengan begitu panel pemesanan
  // ikut terkunci begitu unit ditandai tersewa, tanpa perlu menyebarkan prop
  // status terpisah ke setiap komponen.
  const dataLive = useMemo<SewaDetailData>(
    () => (data.statusTayang === statusTayang ? data : { ...data, statusTayang }),
    [data, statusTayang],
  );

  // Hitung dilihat — sekali per sesi browser supaya refresh berulang tidak
  // menggelembungkan angka yang dipakai agent menilai performa listing.
  //
  // Pengelolanya sendiri sengaja TIDAK dihitung: agent membuka listingnya
  // beberapa kali sehari untuk memeriksa harga & tampilan, dan menghitung
  // kunjungan itu merusak persis angka yang dia pakai menilai listing itu.
  // Menunggu sesi selesai dimuat lebih dulu — tanpa itu, pengelola sudah
  // terlanjur tercatat sebelum identitasnya diketahui.
  useEffect(() => {
    if (!pengelola.siap || pengelola.bolehKelola) return;
    const key = `viewed_${data.idProperty}`;
    if (sessionStorage.getItem(key)) return;
    fetch(`/api/listing/${data.idProperty}/dilihat`, { method: "POST" })
      .then(() => sessionStorage.setItem(key, "true"))
      .catch(() => {});
  }, [data.idProperty, pengelola.siap, pengelola.bolehKelola]);

  const bagikan = async () => {
    const url = `${window.location.origin}/Sewa/${data.slugId}`;
    // Web Share API baru muncul di konteks aman + (umumnya) perangkat mobile;
    // di desktop hampir selalu jatuh ke salin-tautan, jadi keduanya disediakan.
    if (navigator.share) {
      try {
        await navigator.share({ title: data.judul, url });
        return;
      } catch {
        /* dibatalkan user — lanjut ke salin */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setTersalin(true);
      setTimeout(() => setTersalin(false), 2000);
    } catch {
      /* clipboard diblokir — abaikan, tidak ada yang bisa dilakukan */
    }
  };

  const lokasiRingkas =
    [data.kelurahan, data.kecamatan, data.kota].filter(Boolean).join(", ") ||
    data.kota;

  return (
    <div className="relative text-white font-sans">
      {/* Sapuan cahaya latar. Ditaruh di lapisan sendiri dengan pointer-events
          none supaya tidak pernah menghalangi klik, dan dibatasi tinggi layar
          pertama — di bawah itu isi halaman sudah punya kartunya sendiri. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[80vh]"
        style={{ background: CAHAYA_HALAMAN }}
      />

      {/* Spacer header global */}
      <div className="lg:hidden h-[60px]" />
      <div className="hidden lg:block h-24 w-full" />

      <div className="relative flex flex-col pb-28 lg:pb-16">
        {/* ── BREADCRUMB ── */}
        <div className="hidden lg:block container mx-auto px-4 mb-5">
          <div className="flex items-center gap-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
            <Link href="/" className="transition-colors hover:text-white">
              Home
            </Link>
            <Icon icon="solar:alt-arrow-right-linear" className="text-sm" />
            <Link href="/Sewa" className="transition-colors hover:text-white">
              Sewa
            </Link>
            <Icon icon="solar:alt-arrow-right-linear" className="text-sm" />
            <Link
              href={`/Sewa?kota=${encodeURIComponent(data.kota)}`}
              className="transition-colors hover:text-white"
            >
              {data.kota}
            </Link>
            <Icon icon="solar:alt-arrow-right-linear" className="text-sm" />
            <span className="text-white truncate max-w-[220px] xl:max-w-md">
              {data.judul}
            </span>
          </div>
        </div>

        {/* ── JUDUL & META ── */}
        <div className="container mx-auto px-4 order-2 lg:order-none mt-6 lg:mt-0 mb-6 lg:mb-7">
          {/* Pill "Kos Campur" & "N tipe kamar" dihapus: keduanya mengulang
              sel statistik tepat di bawahnya (Tipe kos & Tipe kamar), jadi
              pembaca menemukan fakta yang sama dua kali sebelum sempat membaca
              judulnya. Yang tersisa hanya "Tersewa" — status yang TIDAK ada di
              tempat lain dan memang harus terbaca sebelum apa pun. */}
          <div className="flex flex-wrap items-center gap-2 empty:hidden mb-3">
            {tersewa && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${AKSEN.rose.chip}`}
              >
                <Icon icon="solar:lock-keyhole-bold-duotone" className="text-sm" />
                Tersewa
              </span>
            )}
          </div>

          <h1 className="text-[1.6rem] leading-[1.15] md:text-4xl font-extrabold tracking-tight mb-4">
            {data.judul}
          </h1>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-white/50">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                <Icon
                  icon="solar:map-point-bold"
                  className={`text-base ${AKSEN.sky.ikon}`}
                />
                {lokasiRingkas}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                <Icon icon="solar:eye-bold" className="text-base" />
                {data.dilihat.toLocaleString("id-ID")} dilihat
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                <Icon icon="solar:hashtag-bold" className="text-base" />
                Kode {data.idProperty}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={bagikan}
                className="flex items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-white transition-all hover:border-white/60 hover:bg-white/[0.06] active:scale-95"
              >
                <Icon
                  icon={tersalin ? "solar:check-circle-bold" : "solar:share-bold"}
                  className={`text-base ${tersalin ? AKSEN.emerald.ikon : ""}`}
                />
                {tersalin ? "Tersalin" : "Bagikan"}
              </button>
              <button
                onClick={() => setDisimpan((v) => !v)}
                aria-pressed={disimpan}
                className={`flex items-center gap-2 rounded-full border px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider transition-all active:scale-95 ${
                  disimpan
                    ? "border-white bg-white text-black"
                    : "border-white/15 text-white hover:border-white/60 hover:bg-white/[0.06]"
                }`}
              >
                <Icon
                  icon={disimpan ? "solar:heart-bold" : "solar:heart-linear"}
                  className={`text-base ${disimpan ? "text-rose-500" : ""}`}
                />
                {disimpan ? "Tersimpan" : "Simpan"}
              </button>
            </div>
          </div>
        </div>

        {/* ── GALERI ── */}
        <div className="container mx-auto px-4 lg:px-4 order-1 lg:order-none mb-2 lg:mb-10">
          <ImageGallery
            images={data.fotoList}
            judul={data.judul}
            tersewa={tersewa}
          />
        </div>

        {/* ── PANEL KONTROL AGENT ── */}
        {/* Ditaruh tepat di atas kartu agent (dua kolom), bukan di paling
            atas halaman — alat kerja agent, tapi bukan hal pertama yang
            dilihat calon penyewa. Hanya dirender untuk yang berwenang atas
            listing ini. */}
        <MarkSoldControl
          className="order-3 lg:order-none mb-5 lg:mb-6"
          idProperty={data.idProperty}
          ownerAgentId={data.agent?.idAgent}
          jenisTransaksi="SEWA"
          status={statusTayang}
          onStatusChange={(s: ListingStatus) => setStatusTayang(s)}
          judul={data.judul}
          lokasi={lokasiRingkas}
          harga={data.hargaPromo || data.harga}
          hargaLabel={data.hargaPromo ? "Harga promo" : "Harga sewa"}
          thumbnail={data.fotoList?.[0]}
          // Panel ini kembali menjawab SATU pertanyaan saja: bagaimana performa
          // aset ini. "Kelola Ketersediaan" & "Kelola Voucher" pindah ke kolom
          // kanan (lihat PanelPengelola) — ke tempat akibat perubahannya
          // langsung terlihat, dan ke ruang yang memang milik pemilihan tanggal
          // & harga.
        />

        {/* ── DUA KOLOM ── */}
        <div className="container mx-auto px-4 order-3 lg:order-none">
          <div className="flex flex-col lg:flex-row gap-8 xl:gap-12 items-start">
            <DetailInfo data={dataLive} booking={booking} />
            {!modePemesanan ? (
              /* Kategori NEGOSIASI: tidak ada yang bisa dipesan di sini.
                 Panel kontak menggantikan seluruh panel pemesanan — lihat
                 catatan pembuka KontakSidebar. */
              <KontakSidebar
                data={dataLive}
                bolehKelola={pengelola.bolehKelola}
                menunggu={!pengelola.siap}
              />
            ) : (
              /* Satu kolom kanan, dua peran. Penyewa memilih tanggal & voucher
                 di sini; pengelola mengatur ketersediaan & vouchernya di sini
                 juga — lengkap dengan tab Pratinjau untuk melihat persis apa
                 yang dilihat penyewa. Alat kelolanya dititipkan sebagai slot
                 supaya BookingSidebar tetap memegang satu cangkang (panel
                 sticky di desktop, bilah + sheet di ponsel) untuk keduanya. */
              <BookingSidebar
              data={dataLive}
              booking={booking}
              mode={pengelola.mode}
              // Selama sesi belum selesai dibaca, panel tidak boleh menebak
              // peran pembacanya — pemilik yang me-refresh halamannya sendiri
              // tidak lagi disodori "Ajukan Sewa" selama sepersekian detik.
              menunggu={!pengelola.siap}
              voucherVersi={voucherVersi}
              panelPengelola={
                pengelola.bolehKelola
                  ? (tutupSheet) => (
                      <PanelPengelola
                        idProperty={data.idProperty}
                        berkalender={berkalender}
                        modelInventaris={data.modelInventaris}
                        sisaKamar={data.kamarTersedia}
                        totalKamar={data.totalKamar}
                        unitTersedia={!booking.penuh}
                        voucherVersi={voucherVersi}
                        // Sheet ditutup lebih dulu supaya drawer tidak terbuka
                        // di atas lapisan gelap yang masih membentang. Di
                        // desktop pemanggilan ini tidak berakibat apa-apa.
                        onKelolaKetersediaan={() => {
                          tutupSheet();
                          setKelolaBuka(true);
                        }}
                        onKelolaVoucher={() => {
                          tutupSheet();
                          setVoucherKelolaBuka(true);
                        }}
                      />
                    )
                  : undefined
              }
              />
            )}
          </div>

          <SimilarProperties items={similar} kota={data.kota} />
        </div>
      </div>

      {/* Satu drawer untuk seluruh halaman, state-nya dipegang di sini.
          Tombol pemicunya ada di panel kontrol atas, tapi drawernya tidak
          dirender di dalam panel itu supaya panel tetap bisa dipakai bersama
          halaman Jual & Lelang tanpa membawa apa pun yang khas sewa. */}
      {berkalender && pengelola.bolehKelola && (
        <KelolaKetersediaan
          buka={kelolaBuka}
          onTutup={() => setKelolaBuka(false)}
          idProperty={data.idProperty}
          modelInventaris={data.modelInventaris}
          // Hanya id & nama — drawer memuat sendiri kapasitas & bloknya yang
          // paling baru dari API, jadi ia tidak boleh ikut memakai angka yang
          // sudah ter-cache bersama halaman ini.
          namaTipe={data.tipeKamar.map((t) => ({ id: t.id, nama: t.nama }))}
          labelBasis={pengelola.labelBasis}
          // Halaman ini dirender di server & ter-cache. API sudah memanggil
          // revalidatePath, jadi refresh menarik angka yang sudah baru —
          // tanpa ini panel di belakang drawer tetap menampilkan sisa kamar
          // sebelum perubahan sampai pengguna memuat ulang sendiri.
          onBerubah={() => router.refresh()}
        />
      )}

      {/* Voucher hanya untuk kategori bermode BOOKING.
          Bukan karena vouchernya rumit, tapi karena tidak ada tempat memakainya:
          potongan harga dipakai di panel pemesanan, dan kategori NEGOSIASI tidak
          punya panel itu. Membiarkan pemilik gudang membuat voucher berarti
          membiarkannya menyiapkan promo yang tidak akan pernah bisa ditebus
          siapa pun — lalu heran kenapa tidak ada yang memakainya.
          Wewenang atas listing tetap syarat kedua, dan keduanya ditegakkan ulang
          di API (bukan cuma di sini). */}
      {modePemesanan && pengelola.bolehKelola && (
        <KelolaVoucher
          buka={voucherKelolaBuka}
          onTutup={() => setVoucherKelolaBuka(false)}
          idProperty={data.idProperty}
          // Hanya durasi yang benar-benar ditawarkan listing ini, supaya
          // pemilik tidak memasang syarat "tahunan" pada kos yang tidak
          // pernah menjual tahunan — voucher yang mustahil dipakai siapa pun.
          durasiTersedia={booking.durasiOpsi}
          // Harga listing ikut dikirim supaya simulasi "kalau dipakai, penyewa
          // bayar berapa" memakai angka yang SEBENARNYA, bukan contoh karangan.
          // Contoh karangan hanya melatih pemilik mengabaikan blok itu — dan
          // blok itulah yang mencegah promo yang disesali seminggu kemudian.
          hargaDurasi={data.hargaDurasi}
          durasiUtama={booking.durasi}
          // Tipe kamar untuk syarat "khusus tipe" & simulasi per tipe. Kosong
          // pada unit tunggal, dan di sana pilihannya memang tidak dirender.
          tipeList={booking.tipeList}
          onBerubah={() => setVoucherVersi((n) => n + 1)}
        />
      )}
    </div>
  );
}
