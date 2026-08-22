"use client";

/**
 * Pengajuan sewa — konfirmasi → proses → hasil.
 *
 * KENAPA ADA LANGKAH KONFIRMASI, bukan langsung kirim dari panel:
 * pengajuan ini menjadi lead yang benar-benar masuk ke dashboard agent, dan
 * agent akan menelepon nomor yang tertulis di sana. Tanpa layar ini, panel
 * hanya punya nama & nomor dari sesi (kalau ada) — dan pengunjung yang belum
 * login tidak punya keduanya, sehingga yang sampai ke agent adalah pengajuan
 * tanpa cara menghubungi siapa pun.
 *
 * KENAPA PROSESNYA DITAMPILKAN BERTAHAP, bukan satu spinner:
 * tiga hal yang berbeda memang terjadi, dan ketiganya bisa gagal dengan sebab
 * yang berbeda — kamar keburu penuh, voucher gugur, atau jaringan putus.
 * Spinner tunggal memaksa ketiganya dijelaskan dengan satu kalimat "gagal";
 * daftar bertahap membuat kegagalan berhenti tepat di baris penyebabnya, dan
 * penyewa langsung tahu apa yang perlu diubah.
 *
 * Jeda antar langkah disengaja (±600 ms). Pemeriksaannya sendiri nyata — yang
 * ditambahkan hanya waktu supaya centang tiap langkah sempat terbaca; tanpa itu
 * ketiganya berkedip sekaligus dan yang tersisa hanyalah kilatan tanpa makna.
 */

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import { useSession } from "next-auth/react";

import { AKSEN, LINE, SURFACE } from "./sewaTheme";
import { useSeretTutup } from "../lib/useSeretTutup";
import {
  DURASI_META,
  formatRupiah,
  formatTanggal,
  type DurasiKey,
} from "@/lib/kosDetail";
import { trackLeadClick } from "@/lib/leadTracking";
import { SITE_URL } from "@/lib/site";

export interface RincianBiaya {
  hargaSatuan: number;
  lama: number;
  durasi: DurasiKey;
  subtotal: number;
  deposit: number;
  potongan: number;
  total: number;
}

interface Props {
  buka: boolean;
  onTutup: () => void;

  idProperty: string;
  idAgent: string;
  namaAgent: string;
  teleponAgent: string;
  judulProperti: string;
  slugId: string;
  lokasi: string;

  namaTipe: string | null;
  /** Id tipe kamar terpilih — ikut dikirim saat mencatat pemakaian voucher,
   *  karena voucher boleh dibatasi ke tipe tertentu dan server menghitung
   *  ulang potongannya sendiri. */
  idTipe: string | null;
  tanggalMulai: Date | null;
  tanggalSelesai: Date | null;
  penghuni: number;
  biaya: RincianBiaya;
  voucherKode: string | null;

  /** Kamar masih tersedia untuk pilihan ini — diperiksa ulang saat mengirim. */
  bisaLanjut: boolean;
  /** Voucher terpilih masih memenuhi syarat. true bila tidak pakai voucher. */
  voucherSah: boolean;
}

type Tahap = "konfirmasi" | "proses" | "berhasil" | "gagal";

const LANGKAH = [
  {
    label: "Memeriksa ketersediaan kamar",
    sub: "Memastikan kamar masih kosong untuk masa sewa yang dipilih",
  },
  {
    label: "Mengunci harga & voucher",
    sub: "Menyimpan angka yang Anda lihat sebagai dasar pembicaraan",
  },
  {
    label: "Mengirim ke agent",
    sub: "Pengajuan masuk ke dashboard agent pemegang listing",
  },
] as const;

const jeda = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────────────────
// POTONGAN
//
// Didefinisikan di LINGKUP MODUL, bukan di dalam komponen. Komponen yang
// dibuat ulang tiap render menghasilkan tipe baru setiap kali state berubah,
// dan React membongkar-pasang seluruh subtree-nya alih-alih memperbaruinya —
// di layar yang punya tiga kolom isian seperti ini, itu risiko yang tidak
// perlu diambil demi menghemat beberapa baris.
// ─────────────────────────────────────────────────────────────────────────────

function BarisRingkas({
  ikon,
  label,
  nilai,
  aksen = AKSEN.sky,
}: {
  ikon: string;
  label: string;
  nilai: string;
  aksen?: (typeof AKSEN)["sky"];
}) {
  return (
    <div className="flex items-start gap-3 px-3.5 py-3">
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border ${aksen.kotak}`}
      >
        <Icon icon={ikon} className="text-base" />
      </span>
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/30">
          {label}
        </p>
        <p className="truncate text-xs font-bold text-white">{nilai}</p>
      </div>
    </div>
  );
}

function BarisBiaya({
  label,
  nilai,
  aksen,
  tebal,
}: {
  label: string;
  nilai: string;
  aksen?: string;
  tebal?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span
        className={`text-[11px] ${
          tebal ? "font-extrabold text-white" : "font-semibold text-white/40"
        }`}
      >
        {label}
      </span>
      <span
        className={`shrink-0 tabular-nums ${
          tebal
            ? "text-base font-black text-white"
            : `text-xs font-bold ${aksen ?? "text-white/70"}`
        }`}
      >
        {nilai}
      </span>
    </div>
  );
}

export default function PengajuanSewaModal(props: Props) {
  const {
    buka,
    onTutup,
    idProperty,
    idAgent,
    namaAgent,
    teleponAgent,
    judulProperti,
    slugId,
    lokasi,
    namaTipe,
    idTipe,
    tanggalMulai,
    tanggalSelesai,
    penghuni,
    biaya,
    voucherKode,
    bisaLanjut,
    voucherSah,
  } = props;

  const { data: session } = useSession();

  const [mounted, setMounted] = useState(false);
  const [tampil, setTampil] = useState(false);
  /** Seret pegangan/kepala ke bawah untuk menutup — lihat useSeretTutup. */
  const seret = useSeretTutup(onTutup);
  const [tahap, setTahap] = useState<Tahap>("konfirmasi");
  const [langkah, setLangkah] = useState(0);
  const [nama, setNama] = useState("");
  const [telepon, setTelepon] = useState("");
  const [catatan, setCatatan] = useState("");
  const [galat, setGalat] = useState("");
  const [galatProses, setGalatProses] = useState("");
  const [kodePengajuan, setKodePengajuan] = useState("");
  /** Satu frame "sebelum" untuk animasi masuk centang di layar berhasil. */
  const [sukesTampil, setSukesTampil] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (tahap !== "berhasil") {
      setSukesTampil(false);
      return;
    }
    const t = requestAnimationFrame(() => setSukesTampil(true));
    return () => cancelAnimationFrame(t);
  }, [tahap]);

  // Reset tiap kali dibuka. Modal yang masih menyimpan layar "berhasil" dari
  // pengajuan sebelumnya membuat penyewa mengira pengajuan barunya terkirim
  // padahal ia belum menekan apa pun.
  useEffect(() => {
    if (!buka) {
      setTampil(false);
      return;
    }
    setTahap("konfirmasi");
    setLangkah(0);
    setGalat("");
    setGalatProses("");
    setKodePengajuan("");
    setCatatan("");

    const t = requestAnimationFrame(() => setTampil(true));
    const asal = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    if (session?.user) {
      setNama(session.user.name || "");
      fetch("/api/profile")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          let digit = String(d?.pengguna?.nomor_telepon || "").replace(/\D/g, "");
          if (digit.startsWith("62")) digit = digit.slice(2);
          if (digit.startsWith("0")) digit = digit.slice(1);
          setTelepon(digit.slice(0, 12));
        })
        .catch(() => {});
    }

    return () => {
      cancelAnimationFrame(t);
      document.body.style.overflow = asal;
    };
  }, [buka, session]);

  // Esc hanya menutup di layar yang aman ditinggalkan. Menutup di tengah
  // "proses" akan meninggalkan permintaan yang sudah terkirim tanpa satu pun
  // keterangan bahwa ia berhasil.
  useEffect(() => {
    if (!buka || tahap === "proses") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onTutup();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [buka, tahap, onTutup]);

  if (!mounted || !buka) return null;

  const teleponPenuh = `+62${telepon}`;
  const satuan = DURASI_META[biaya.durasi].satuan;
  const masaSewa =
    tanggalMulai && tanggalSelesai
      ? `${formatTanggal(tanggalMulai)} – ${formatTanggal(tanggalSelesai)}`
      : "Belum dipilih";

  // ── Pesan WhatsApp lanjutan ────────────────────────────────────────────────
  // Dipakai di layar berhasil, BUKAN dikirim otomatis. Pengajuan sudah tercatat
  // di sisi agent; memaksa penyewa berpindah ke WhatsApp membuat halaman ini
  // terasa hanya sebagai perantara, dan pengajuan yang gagal terkirim jadi
  // tidak terbedakan dari yang berhasil.
  const bukaWA = () => {
    const telp = teleponAgent.replace(/^0/, "62").replace(/\D/g, "");
    if (!telp) return;
    const baris = [
      `Halo ${namaAgent} 👋`,
      "",
      `Saya baru mengajukan sewa lewat Solusindo${kodePengajuan ? ` (kode ${kodePengajuan})` : ""}.`,
      "",
      `🏠 *${judulProperti}*`,
      `📍 ${lokasi}`,
      namaTipe ? `🛏️ Tipe: *${namaTipe}*` : null,
      `📆 ${biaya.lama} ${satuan}${tanggalMulai ? ` · ${masaSewa}` : ""}`,
      penghuni > 1 ? `👥 ${penghuni} penghuni` : null,
      voucherKode ? `🎟️ Voucher: ${voucherKode}` : null,
      `🧾 Estimasi total: *${formatRupiah(biaya.total)}*`,
      "",
      `🔗 ${SITE_URL}/Sewa/${slugId}`,
    ].filter(Boolean);
    window.open(
      `https://wa.me/${telp}?text=${encodeURIComponent(baris.join("\n"))}`,
      "_blank",
    );
  };

  // ── Pengiriman ─────────────────────────────────────────────────────────────
  const ajukan = async () => {
    if (!nama.trim()) return setGalat("Nama lengkap wajib diisi");
    if (telepon.length < 7) return setGalat("Nomor WhatsApp tidak valid");

    setGalat("");
    setTahap("proses");
    setLangkah(0);

    // 1 — ketersediaan
    await jeda(700);
    if (!bisaLanjut) {
      setGalatProses(
        "Kamar sudah tidak tersedia untuk masa sewa itu. Coba ubah tanggal atau tipe kamarnya.",
      );
      setTahap("gagal");
      return;
    }

    // 2 — harga & voucher
    setLangkah(1);
    await jeda(600);
    if (voucherKode && !voucherSah) {
      setGalatProses(
        `Voucher ${voucherKode} tidak lagi memenuhi syarat untuk pilihan ini. Lepas vouchernya atau sesuaikan masa sewa.`,
      );
      setTahap("gagal");
      return;
    }

    // 3 — kirim
    setLangkah(2);
    const rinci = [
      `Pengajuan sewa dari halaman listing.`,
      namaTipe ? `Tipe kamar: ${namaTipe}` : null,
      `Masa sewa: ${masaSewa} (${biaya.lama} ${satuan})`,
      `Penghuni: ${penghuni} orang`,
      `Harga: ${formatRupiah(biaya.hargaSatuan)} ${DURASI_META[biaya.durasi].suffix}`,
      `Subtotal: ${formatRupiah(biaya.subtotal)}`,
      biaya.deposit > 0 ? `Deposit: ${formatRupiah(biaya.deposit)}` : null,
      voucherKode && biaya.potongan > 0
        ? `Voucher ${voucherKode}: -${formatRupiah(biaya.potongan)}`
        : null,
      `Estimasi total: ${formatRupiah(biaya.total)}`,
      catatan.trim() ? `Catatan penyewa: ${catatan.trim()}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const hasil = await trackLeadClick({
      id_property: idProperty,
      id_agent: idAgent,
      source: "form_inquiry",
      client_name: nama.trim(),
      client_phone: teleponPenuh,
      notes: rinci,
    });

    if (!hasil.ok) {
      setGalatProses(
        hasil.error === "missing id_property / id_agent"
          ? "Data listing tidak lengkap. Hubungi agent lewat WhatsApp."
          : "Pengajuan gagal terkirim. Periksa jaringan Anda lalu coba lagi.",
      );
      setTahap("gagal");
      return;
    }

    // ── Pencatatan pemakaian voucher ──
    // SESUDAH lead tersimpan, dan sengaja TIDAK ditunggu (`void`). Urutannya
    // yang penting: kuota yang berkurang untuk pengajuan yang ternyata gagal
    // terkirim akan menghabiskan promo tanpa ada calon penyewa di ujungnya,
    // dan pemiliknya tidak punya cara mengembalikannya.
    //
    // Kegagalannya pun sengaja tidak mengubah apa pun di layar ini. Pengajuan
    // penyewa SUDAH berhasil; menampilkan "gagal" karena catatan promosi tidak
    // tertulis akan membuatnya mengirim ulang lead yang sama. Kuota yang
    // meleset satu adalah kerugian yang jauh lebih kecil daripada itu, dan
    // angka rupiah yang mengikat tetap disepakati agent & penyewa di tahap
    // berikutnya.
    if (voucherKode && biaya.potongan > 0) {
      void fetch(`/api/listings/${idProperty}/voucher/pakai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kode: voucherKode,
          subtotal: biaya.subtotal,
          durasi: biaya.durasi,
          lama: biaya.lama,
          idTipe,
          nama: nama.trim(),
          telepon: teleponPenuh,
        }),
      }).catch(() => {});
    }

    // Kode yang ditampilkan berasal dari id lead yang BENAR-BENAR tersimpan —
    // bukan angka acak. Dengan begitu penyewa yang menyebut kodenya bisa
    // dicari agent di dashboard.
    setKodePengajuan(`SW-${String(hasil.id_lead ?? "").padStart(5, "0")}`);
    setLangkah(3);
    await jeda(500);
    setTahap("berhasil");
  };

  // ───────────────────────────────────────────────────────────────────────────

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Ajukan sewa"
    >
      <div
        className={`absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300 motion-reduce:transition-none ${
          tampil ? "opacity-100" : "opacity-0"
        }`}
        onClick={() => tahap !== "proses" && onTutup()}
      />

      <div
        className={`relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[2rem] border border-white/10 shadow-2xl transition-transform duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none sm:max-h-[88dvh] sm:max-w-[460px] sm:rounded-[1.75rem] ${
          tampil ? "translate-y-0" : "translate-y-8 sm:translate-y-4"
        }`}
        style={{ background: SURFACE.modal, ...seret.gaya }}
      >
        {/* ══════════ KONFIRMASI ══════════ */}
        {tahap === "konfirmasi" && (
          <>
            {/* Pegangan + kepala = daerah seret; tarik ke bawah untuk menutup. */}
            <div {...seret.pegangan}>
              <div className="flex cursor-grab justify-center pt-3 active:cursor-grabbing sm:hidden">
                <span className="h-[3px] w-9 rounded-full bg-white/25" />
              </div>

              <div className={`flex items-start justify-between gap-3 border-b px-5 pb-4 pt-4 ${LINE.row}`}>
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold text-white">Ajukan sewa</h3>
                  <p className="truncate text-[11px] font-semibold text-white/55">
                    {judulProperti}
                  </p>
                </div>
                <button
                  onClick={onTutup}
                  className="shrink-0 rounded-full p-1.5 text-white/55 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Tutup"
                >
                  <Icon icon="solar:close-circle-bold" className="text-xl" />
                </button>
              </div>
            </div>

            <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {/* Ringkasan pilihan */}
              {/* Kelasnya ditulis UTUH, bukan dirakit dari LINE.row
                  (`"border-white/[0.06]".replace("border-","divide-")`).
                  Tailwind mencari kelas dengan memindai teks berkas, jadi nama
                  hasil rakitan runtime tidak pernah digenerate — pemisahnya
                  hilang tanpa satu pun error. Lihat catatan di
                  @/lib/detailTheme. */}
              <div
                className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.08]"
                style={{ background: SURFACE.raised }}
              >
                {namaTipe && (
                  <BarisRingkas
                    ikon="solar:bed-bold-duotone"
                    label="Tipe kamar"
                    nilai={namaTipe}
                    aksen={AKSEN.violet}
                  />
                )}
                <BarisRingkas
                  ikon="solar:calendar-mark-bold-duotone"
                  label="Masa sewa"
                  nilai={`${masaSewa} · ${biaya.lama} ${satuan}`}
                />
                <BarisRingkas
                  ikon="solar:users-group-rounded-bold-duotone"
                  label="Penghuni"
                  nilai={`${penghuni} orang`}
                  aksen={AKSEN.violet}
                />
              </div>

              {/* Rincian biaya — di layar ini ditampilkan UTUH, tidak dilipat.
                  Panel boleh meringkas karena penyewa masih mengubah-ubah
                  pilihan; di titik mengajukan, setiap angka yang akan dibicarakan
                  dengan agent harus sudah terlihat tanpa satu ketukan pun. */}
              <div
                className="space-y-2 rounded-2xl border border-white/[0.08] p-4"
                style={{ background: SURFACE.raised }}
              >
                <BarisBiaya
                  label={`${formatRupiah(biaya.hargaSatuan)} × ${biaya.lama} ${satuan}`}
                  nilai={formatRupiah(biaya.subtotal)}
                />
                {biaya.deposit > 0 && (
                  <BarisBiaya label="Deposit" nilai={formatRupiah(biaya.deposit)} />
                )}
                {biaya.potongan > 0 && (
                  <BarisBiaya
                    label={`Voucher ${voucherKode}`}
                    nilai={`−${formatRupiah(biaya.potongan)}`}
                    aksen={AKSEN.mint.teks}
                  />
                )}
                <div className={`border-t pt-2 ${LINE.row}`}>
                  <BarisBiaya label="Estimasi total" nilai={formatRupiah(biaya.total)} tebal />
                </div>
              </div>

              {/* Kontak */}
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.14em] text-white/30">
                    Nama lengkap
                  </label>
                  <input
                    value={nama}
                    onChange={(e) => {
                      setNama(e.target.value);
                      setGalat("");
                    }}
                    placeholder="Nama sesuai KTP"
                    className="w-full rounded-xl border border-white/[0.08] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-white/20 focus:border-[#86efac]/50"
                    style={{ background: SURFACE.raised }}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.14em] text-white/30">
                    Nomor WhatsApp
                  </label>
                  <div
                    className="flex items-center gap-2 rounded-xl border border-white/[0.08] px-4 transition-colors focus-within:border-[#86efac]/50"
                    style={{ background: SURFACE.raised }}
                  >
                    <span className="text-sm font-bold text-white/40">+62</span>
                    <input
                      value={telepon}
                      onChange={(e) => {
                        let v = e.target.value.replace(/\D/g, "");
                        if (v.startsWith("62")) v = v.slice(2);
                        if (v.startsWith("0")) v = v.slice(1);
                        setTelepon(v.slice(0, 12));
                        setGalat("");
                      }}
                      inputMode="numeric"
                      placeholder="81234567890"
                      className="w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-white/20"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.14em] text-white/30">
                    Catatan untuk agent · opsional
                  </label>
                  <textarea
                    value={catatan}
                    onChange={(e) => setCatatan(e.target.value)}
                    rows={2}
                    placeholder="Mis. ingin lihat kamar dulu akhir pekan ini"
                    className="w-full resize-none rounded-xl border border-white/[0.08] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-white/20 focus:border-[#86efac]/50"
                    style={{ background: SURFACE.raised }}
                  />
                </div>
              </div>

              {galat && (
                <p
                  className={`flex items-center gap-2 rounded-xl border border-rose-500/20 p-3 text-xs font-semibold ${AKSEN.rose.wash} ${AKSEN.rose.teks}`}
                >
                  <Icon icon="solar:danger-triangle-bold" className="text-base" />
                  {galat}
                </p>
              )}
            </div>

            <div className={`border-t px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3.5 ${LINE.row}`}>
              {/* Ditulis sebelum tombol, bukan sesudah. Yang perlu diketahui
                  penyewa sebelum menekan tidak boleh baru muncul setelahnya. */}
              <p className="mb-3 flex items-start gap-2 text-[10px] leading-relaxed text-white/35">
                <Icon
                  icon="solar:shield-check-bold-duotone"
                  className={`mt-px shrink-0 text-sm ${AKSEN.emerald.ikon}`}
                />
                Pengajuan ini belum mengikat dan tidak ada pembayaran di tahap
                ini. Agent akan menghubungi Anda untuk memastikan kamar & jadwal.
              </p>
              <button
                onClick={ajukan}
                className="group relative w-full overflow-hidden rounded-2xl bg-[#86efac] py-4 text-sm font-extrabold text-black shadow-[0_10px_30px_-10px_rgba(134,239,172,0.75)] transition-all duration-200 hover:bg-[#a7f3c4] active:scale-[0.985] motion-reduce:transition-none"
              >
                <span className="relative inline-flex items-center justify-center gap-2">
                  <Icon icon="solar:document-add-bold" className="text-base" />
                  Kirim pengajuan
                </span>
              </button>
            </div>
          </>
        )}

        {/* ══════════ PROSES ══════════ */}
        {tahap === "proses" && (
          <div className="px-6 py-10">
            <div className="mb-8 text-center">
              <h3 className="text-lg font-extrabold text-white">Memproses pengajuan</h3>
              <p className="mt-1 text-[11px] font-semibold text-white/35">
                Sebentar, jangan tutup halaman ini
              </p>
            </div>

            {/* Rel vertikal yang TERISI mengikuti langkah — jarak yang sudah
                ditempuh terlihat sebagai panjang, bukan sebagai angka.

                Relnya digambar PER BARIS (dari bawah lingkaran ini sampai dasar
                barisnya), bukan sebagai satu garis absolut setinggi
                `calc(100% − sekian)`. Garis tunggal semacam itu harus menebak
                tinggi baris, dan tebakannya meleset begitu label melipat jadi
                dua baris di layar sempit — persis kondisi yang paling sering
                terjadi di ponsel. */}
            <div>
              {LANGKAH.map((l, i) => {
                const selesai = langkah > i;
                const aktif = langkah === i;
                const terakhir = i === LANGKAH.length - 1;
                return (
                  <div
                    key={l.label}
                    className={`relative flex items-start gap-3.5 ${terakhir ? "" : "pb-6"}`}
                  >
                    {!terakhir && (
                      <span
                        aria-hidden
                        className={`absolute bottom-0 left-[15px] top-8 w-px transition-colors duration-500 motion-reduce:transition-none ${
                          selesai ? "bg-[#86efac]" : "bg-white/[0.08]"
                        }`}
                      />
                    )}
                    <span
                      className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 transition-all duration-300 motion-reduce:transition-none ${
                        selesai
                          ? "border-[#86efac] bg-[#86efac] text-black"
                          : aktif
                            ? "border-[#86efac]/40 bg-[#0C1017]"
                            : "border-white/10 bg-[#0C1017]"
                      }`}
                    >
                      {selesai ? (
                        <Icon icon="ic:round-check" className="text-base" />
                      ) : aktif ? (
                        // Cincin berputar, bukan titik berkedip: putaran punya
                        // arah, jadi terbaca "sedang berjalan" — kedipan hanya
                        // terbaca "menunggu".
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#86efac] border-t-transparent motion-reduce:animate-none" />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                      )}
                    </span>
                    <div className="min-w-0 pt-1">
                      <p
                        className={`text-[13px] font-bold transition-colors duration-300 motion-reduce:transition-none ${
                          selesai || aktif ? "text-white" : "text-white/25"
                        }`}
                      >
                        {l.label}
                      </p>
                      <p
                        className={`text-[10px] leading-relaxed transition-opacity duration-300 motion-reduce:transition-none ${
                          aktif ? "text-white/40 opacity-100" : "text-white/25 opacity-60"
                        }`}
                      >
                        {l.sub}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════════ BERHASIL ══════════ */}
        {tahap === "berhasil" && (
          <>
            <div className="custom-scrollbar flex-1 overflow-y-auto px-6 pb-2 pt-10 text-center">
              {/* Centang MUNCUL sekali dengan memuai, lalu diam.
                  Dibuat dari transisi, bukan dari `animate-ping`: kelas itu
                  memasang `animation` beserta `infinite`, dan mematikannya
                  butuh `[animation-iteration-count:1]` yang hanya menang kalau
                  urutan CSS-nya kebetulan tepat. Kalau meleset, yang tersisa
                  adalah lingkaran berdenyut selamanya di layar yang seharusnya
                  menenangkan. Transisi tidak punya kemungkinan itu. */}
              <span
                className={`mx-auto mb-5 grid h-[72px] w-[72px] place-items-center rounded-full bg-[#86efac]/10 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none ${
                  sukesTampil ? "scale-100 opacity-100" : "scale-50 opacity-0"
                }`}
              >
                <Icon
                  icon="solar:check-circle-bold"
                  className={`text-5xl ${AKSEN.mint.ikon}`}
                />
              </span>

              <h3 className="text-xl font-extrabold text-white">Pengajuan terkirim</h3>
              <p className="mx-auto mt-2 max-w-[32ch] text-sm leading-relaxed text-white/45">
                {namaAgent} sudah menerima pengajuan Anda dan akan menghubungi{" "}
                <span className="font-bold text-white/70">{teleponPenuh}</span>.
              </p>

              {kodePengajuan && (
                <div
                  className={`mx-auto mt-5 inline-flex items-center gap-2 rounded-full border px-4 py-2 ${AKSEN.mint.chip}`}
                >
                  <Icon icon="solar:hashtag-bold" className="text-sm" />
                  <span className="text-xs font-black tracking-wider">{kodePengajuan}</span>
                </div>
              )}

              <div
                className="mt-5 space-y-2 rounded-2xl border border-white/[0.08] p-4 text-left"
                style={{ background: SURFACE.raised }}
              >
                <BarisBiaya
                  label={namaTipe ? `Tipe ${namaTipe}` : "Unit dipesan"}
                  nilai={`${biaya.lama} ${satuan}`}
                />
                {tanggalMulai && <BarisBiaya label="Masa sewa" nilai={masaSewa} />}
                {biaya.potongan > 0 && (
                  <BarisBiaya
                    label={`Voucher ${voucherKode}`}
                    nilai={`−${formatRupiah(biaya.potongan)}`}
                    aksen={AKSEN.mint.teks}
                  />
                )}
                <div className={`border-t pt-2 ${LINE.row}`}>
                  <BarisBiaya label="Estimasi total" nilai={formatRupiah(biaya.total)} tebal />
                </div>
              </div>

              {/* Menjawab pertanyaan yang selalu muncul setelah tombol ditekan:
                  "lalu apa?". Tanpa ini, layar berhasil hanya memberi tahu
                  bahwa sesuatu terkirim, bukan apa yang akan terjadi. */}
              <div className="mt-5 space-y-2.5 text-left">
                {[
                  ["solar:phone-calling-rounded-bold-duotone", "Agent menghubungi Anda, biasanya dalam 1×24 jam."],
                  ["solar:eye-bold-duotone", "Atur jadwal melihat kamar langsung sebelum menyepakati apa pun."],
                  ["solar:wallet-money-bold-duotone", "Pembayaran & tanda jadi dibicarakan setelah kamar Anda lihat."],
                ].map(([ikon, teks]) => (
                  <div key={teks} className="flex items-start gap-2.5">
                    <Icon icon={ikon} className={`mt-px shrink-0 text-base ${AKSEN.sky.ikon}`} />
                    <p className="text-[11px] leading-relaxed text-white/40">{teks}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
              <button
                onClick={onTutup}
                className="flex-1 rounded-2xl border border-white/[0.12] py-3.5 text-sm font-bold text-white transition-colors hover:bg-white/[0.06]"
              >
                Selesai
              </button>
              <button
                onClick={bukaWA}
                className="flex-1 rounded-2xl bg-[#86efac] py-3.5 text-sm font-extrabold text-black transition-all hover:bg-[#a7f3c4] active:scale-[0.98] motion-reduce:transition-none"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <Icon icon="ic:baseline-whatsapp" className="text-base" />
                  Chat agent
                </span>
              </button>
            </div>
          </>
        )}

        {/* ══════════ GAGAL ══════════ */}
        {tahap === "gagal" && (
          <div className="px-6 py-10 text-center">
            <span className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-rose-400/10">
              <Icon
                icon="solar:danger-triangle-bold-duotone"
                className={`text-4xl ${AKSEN.rose.ikon}`}
              />
            </span>
            <h3 className="text-lg font-extrabold text-white">Pengajuan belum terkirim</h3>
            <p className="mx-auto mt-2 max-w-[34ch] text-sm leading-relaxed text-white/45">
              {galatProses}
            </p>
            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setTahap("konfirmasi")}
                className="flex-1 rounded-2xl border border-white/[0.12] py-3.5 text-sm font-bold text-white transition-colors hover:bg-white/[0.06]"
              >
                Ubah pilihan
              </button>
              <button
                onClick={ajukan}
                className="flex-1 rounded-2xl bg-white py-3.5 text-sm font-extrabold text-black transition-transform active:scale-[0.98] motion-reduce:transition-none"
              >
                Coba lagi
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
