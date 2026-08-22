"use client";

/**
 * Panel kontrol status aset di halaman detail (Jual / Lelang / Sewa).
 *
 * Alasan keberadaannya: menandai aset terjual dulu butuh lima langkah —
 * buka dashboard → menu listing → ingat & cari id-nya → centang kotak →
 * tandai terjual. Serumit itu untuk satu kali klik akhirnya membuat agent
 * menunda, dan situs penuh aset yang sebenarnya sudah laku. Sekarang: buka
 * halaman asetnya (yang memang sudah dipegang agent di WhatsApp), satu
 * tombol, satu konfirmasi.
 *
 * ── Yang perlu diketahui sebelum mengubah berkas ini ────────────────────────
 * 1. Izin dihitung DI BROWSER lewat @/lib/listingStatusPermission, memakai
 *    session milik pembaca. Ini disengaja: halaman `/Jual/[slug]/[agentId]`
 *    dirender statis (`revalidate = 3600`), jadi kalau tombol ini diputuskan
 *    di server, HTML milik satu agent akan tersimpan di cache dan tersaji ke
 *    SEMUA pengunjung — termasuk tombolnya. Menghitungnya di browser membuat
 *    hasilnya selalu milik pembaca yang sedang login.
 * 2. Karena itu hasil hitungan di sini TIDAK dianggap keamanan. Penentu
 *    sesungguhnya ada di PATCH /api/listings/{id}/status, yang membaca ulang
 *    jabatan dari DB. Komponen ini hanya memutuskan tombolnya terlihat atau
 *    tidak.
 * 3. `status` dikendalikan induk (halaman detail) supaya galeri, badge, dan
 *    panel ini tidak pernah menampilkan status yang berbeda-beda.
 * 4. Panel ini TIDAK memajang "Tersedia". Selagi aset masih tayang, statusnya
 *    sudah tersirat dari tombol "Tandai {soldLabel}" di sebelahnya — mencetaknya
 *    lagi hanya menghabiskan baris yang paling terlihat untuk mengulang hal
 *    yang sudah diketahui. Ruang itu dipakai untuk yang benar-benar tidak
 *    diketahui agent tanpa membuka dashboard: umur listing dan corong
 *    performanya (dilihat → klik WA → penawaran → survei), ditutup satu
 *    kalimat yang menafsirkannya. Status baru dinyatakan saat TERJUAL —
 *    keadaan yang tak terduga, dan karena itu memang perlu diumumkan.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Icon } from "@iconify/react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";

import {
  canChangeListingStatus,
  soldLabelFor,
  type ListingStatus,
} from "@/lib/listingStatusPermission";
import MarkSoldConfirmSheet, { type MarkSoldMode } from "./MarkSoldConfirmSheet";

interface Props {
  /** id_property sebagai string (BigInt tidak selamat melewati props). */
  idProperty: string;
  /** Listing.id_agent — pemegang listing, penentu utama izin. */
  ownerAgentId?: string | null;
  /** Listing.jenis_transaksi — PRIMARY | SECONDARY | LELANG | SEWA | CESSIE. */
  jenisTransaksi?: string | null;
  /** Status yang sedang ditampilkan halaman (dikendalikan induk). */
  status: string;
  /** Dipanggil setelah server mengonfirmasi status baru. */
  onStatusChange: (status: ListingStatus) => void;

  judul: string;
  lokasi?: string | null;
  harga?: number | null;
  hargaLabel?: string;
  thumbnail?: string | null;
  className?: string;
  /**
   * Aksi khas jenis transaksi, disisipkan di samping tombol utama.
   *
   * Ada supaya kendali pengelola tetap SATU permukaan. Halaman sewa butuh
   * tombol "Kelola ketersediaan", tapi memberinya bilah sendiri berarti dua
   * kotak berwenang yang bersebelahan dengan dua label izin yang harus
   * dijaga tetap sepakat — dan yang satu pasti tertinggal. Slot ini membuat
   * izinnya tetap dihitung sekali, di sini.
   *
   * Pemanggil TIDAK perlu memeriksa izin sendiri: isi slot hanya dirender
   * kalau panel ini dirender, dan panel ini hanya muncul untuk yang berwenang.
   */
  aksiTambahan?: React.ReactNode;
}

/** Angka performa aset, bentuk yang dikirim API. */
interface Performa {
  hariTayang: number | null;
  dilihat: number;
  klikWa: number;
  penawaran: number;
  penawaranPending: number;
  survei: number;
  konversi: number | null;
}

/** Satu baris jejak audit, bentuk yang dikirim API. */
interface RiwayatStatus {
  id: string;
  idAgent: string;
  namaPelaku: string | null;
  jabatanPelaku: string;
  dasarWewenang: string;
  statusLama: string;
  statusBaru: string;
  sumber: string;
  dibuatPada: string;
}

/** 1.240 · 12,4rb — angka besar dipendekkan supaya kolomnya tidak melar. */
function formatAngka(n: number): string {
  if (n >= 10_000) {
    const ribu = n / 1000;
    return `${ribu.toFixed(ribu >= 100 ? 0 : 1).replace(".", ",")}rb`;
  }
  return n.toLocaleString("id-ID");
}

/**
 * Umur listing, dibaca sebagai isyarat—bukan sekadar angka.
 *
 * Aset yang sudah lama tayang tanpa gerakan adalah masalah yang paling sering
 * tidak disadari: tidak ada yang memberi tahu, dan agent tidak punya alasan
 * membuka dashboard untuk memeriksanya. Warnanya yang mengingatkan.
 */
function nadaUmur(hari: number | null) {
  if (hari === null) return null;
  if (hari <= 30)
    return { teks: "border-emerald-400/25 bg-emerald-500/10 text-emerald-300" };
  if (hari <= 90)
    return { teks: "border-amber-400/25 bg-amber-500/10 text-amber-300" };
  return { teks: "border-rose-400/25 bg-rose-500/10 text-rose-300" };
}

/**
 * Satu kalimat yang menafsirkan angka-angka di atasnya.
 *
 * Ini bagian yang membuat panel ini layak ada: empat angka mentah masih
 * menyisakan pertanyaan "jadi saya harus apa?". Urutannya bukan sembarang —
 * yang paling mendesak (ada orang yang sedang menunggu jawaban) selalu
 * mengalahkan yang sekadar menarik (persentase konversi).
 */
function bacaPerforma(p: Performa, isSold: boolean) {
  if (isSold) return null;

  if (p.penawaranPending > 0)
    return {
      ikon: "solar:bell-bing-bold-duotone",
      nada: "text-amber-200",
      aksen: "bg-amber-400",
      teks: `${p.penawaranPending} penawaran menunggu jawaban Anda.`,
    };

  if (p.survei > 0)
    return {
      ikon: "solar:calendar-mark-bold-duotone",
      nada: "text-sky-200",
      aksen: "bg-sky-400",
      teks: `${p.survei} survei terjadwal — siapkan kunci & akses lokasi.`,
    };

  if (p.dilihat === 0)
    return {
      ikon: "solar:share-circle-bold-duotone",
      nada: "text-white/55",
      aksen: "bg-white/30",
      teks: "Belum ada yang membuka aset ini. Bagikan tautannya ke klien.",
    };

  // Banyak yang melihat tapi tidak ada yang menghubungi: hampir selalu soal
  // harga atau foto, dan itu keputusan yang hanya bisa diambil agent.
  if (p.klikWa === 0 && p.dilihat >= 50)
    return {
      ikon: "solar:chart-square-bold-duotone",
      nada: "text-rose-200",
      aksen: "bg-rose-400",
      teks: `${formatAngka(p.dilihat)} kali dilihat, belum ada yang menghubungi — coba tinjau harga atau fotonya.`,
    };

  if (p.konversi !== null && p.klikWa > 0)
    return {
      ikon: "solar:graph-up-bold-duotone",
      nada: "text-emerald-200",
      aksen: "bg-emerald-400",
      teks: `${p.konversi.toFixed(1).replace(".", ",")}% pengunjung menghubungi Anda.`,
    };


}

/** "12 Agu 2026, 14:30" — cukup untuk menjawab "kapan tepatnya?". */
function formatWaktu(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MarkSoldControl({
  idProperty,
  ownerAgentId,
  jenisTransaksi,
  status,
  onStatusChange,
  judul,
  lokasi,
  harga,
  hargaLabel,
  thumbnail,
  className = "",
  aksiTambahan,
}: Props) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [performa, setPerforma] = useState<Performa | null>(null);
  const [memuatPerforma, setMemuatPerforma] = useState(true);
  const [riwayatTerakhir, setRiwayatTerakhir] = useState<RiwayatStatus | null>(
    null,
  );

  const user = session?.user as
    | { agentId?: string | null; jabatan?: string | null }
    | undefined;

  const izin = useMemo(
    () =>
      canChangeListingStatus(
        { idAgent: user?.agentId, jabatan: user?.jabatan },
        { idAgent: ownerAgentId, jenisTransaksi },
      ),
    [user?.agentId, user?.jabatan, ownerAgentId, jenisTransaksi],
  );

  const statusSekarang = String(status || "TERSEDIA").toUpperCase();
  const isSold = statusSekarang === "TERJUAL";
  const soldLabel = soldLabelFor(jenisTransaksi);
  const mode: MarkSoldMode = isSold ? "reactivate" : "sold";

  const simpan = useCallback(async () => {
    if (saving) return;
    const target: ListingStatus = isSold ? "TERSEDIA" : "TERJUAL";
    setSaving(true);

    try {
      const res = await fetch(`/api/listings/${idProperty}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: target }),
      });
      const data = await res.json().catch(() => ({} as any));

      if (!res.ok) {
        // 409 = status sudah berubah dari perangkat/orang lain. Itu bukan
        // kesalahan pengguna, jadi tampilannya langsung disamakan dengan
        // kenyataan di server alih-alih memaksanya menebak.
        if (res.status === 409 && data?.status) {
          onStatusChange(data.status as ListingStatus);
          router.refresh();
        }
        throw new Error(data?.error || "Gagal memperbarui status listing.");
      }

      const statusBaru = (data?.status as ListingStatus) || target;
      onStatusChange(statusBaru);
      // Jejak yang barusan dicatat ikut di balasan PATCH, jadi baris "ditandai
      // oleh …" langsung benar tanpa perlu memanggil API kedua.
      if (data?.riwayat) setRiwayatTerakhir(data.riwayat as RiwayatStatus);
      setSheetOpen(false);

      if (statusBaru === "TERJUAL") {
        toast.success(`Aset ditandai ${soldLabel.toUpperCase()} 🎉`, {
          description:
            data?.changed === false
              ? "Statusnya memang sudah tersimpan sebelumnya."
              : "Listing keluar dari daftar aktif. Datanya tetap tersimpan.",
        });
      } else {
        toast.success("Listing aktif kembali", {
          description: `Penanda ${soldLabel.toUpperCase()} dilepas dan aset kembali dihitung aktif.`,
        });
      }

      // Halaman detail bisa tersaji dari cache — minta Next merender ulang
      // supaya data server (badge, urutan, dashboard) ikut menyusul.
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Terjadi kesalahan, coba lagi.",
      );
    } finally {
      setSaving(false);
    }
  }, [saving, isSold, idProperty, onStatusChange, router, soldLabel]);

  // Satu permintaan mengisi dua hal sekaligus: angka performa dan jejak
  // terakhir. Dijalankan sekali saat panel muncul — bukan hanya saat aset
  // sudah ditandai — karena justru selagi aset MASIH tayang angka-angka itu
  // yang menentukan langkah berikutnya.
  const bolehLihat = sessionStatus === "authenticated" && izin.allowed;
  useEffect(() => {
    if (!bolehLihat) return;

    const batal = new AbortController();
    fetch(`/api/listings/${idProperty}/status`, { signal: batal.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        if (d.performa) setPerforma(d.performa as Performa);
        if (d.riwayat?.length) setRiwayatTerakhir(d.riwayat[0]);
      })
      .catch(() => {
        /* angka gagal dimuat bukan alasan mengganggu agent — tombol tetap jalan */
      })
      .finally(() => setMemuatPerforma(false));

    return () => batal.abort();
  }, [bolehLihat, idProperty]);

  // Belum diketahui siapa pembacanya → jangan render apa pun. Menampilkan
  // kerangka lalu menghilangkannya justru membuat halaman berkedip untuk
  // pengunjung biasa, yang jumlahnya jauh lebih banyak daripada agent.
  if (sessionStatus !== "authenticated" || !izin.allowed) return null;

  // Listing yang ditarik tidak punya halaman publik; kalaupun sampai terbuka,
  // status itu hanya bisa dibereskan dari dashboard.
  if (statusSekarang === "TARIK_LISTING") return null;

  const umur = performa ? nadaUmur(performa.hariTayang) : null;
  const bacaan = performa ? bacaPerforma(performa, isSold) : null;

  return (
    <>
      <div className={`container mx-auto px-4 ${className}`}>
        <div
          className={`relative overflow-hidden rounded-[26px] p-px transition-shadow duration-500 ${
            isSold
              ? "bg-[linear-gradient(110deg,rgba(251,191,36,0.45),rgba(255,255,255,0.08)_40%,rgba(251,146,60,0.35))] shadow-[0_18px_50px_-24px_rgba(245,158,11,0.55)]"
              : "bg-[linear-gradient(110deg,rgba(52,211,153,0.5),rgba(255,255,255,0.08)_40%,rgba(16,185,129,0.4))] shadow-[0_18px_50px_-24px_rgba(16,185,129,0.6)]"
          }`}
        >
          <div className="relative overflow-hidden rounded-[25px] bg-[#060a09]/95 backdrop-blur-xl">
            {/* Kisi halus + cahaya sudut: memberi kesan "panel instrumen",
                membedakan blok milik agent dari isi halaman untuk publik. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] [background-size:28px_28px]"
            />
            <div
              aria-hidden
              className={`pointer-events-none absolute -left-10 -top-16 h-40 w-56 rounded-full blur-3xl ${
                isSold ? "bg-amber-500/20" : "bg-emerald-500/20"
              }`}
            />

            {/* Identitas + tombol utama tetap SATU baris sampai layar
                terkecil: keduanya pendek, dan menumpuknya cuma membuat panel
                setinggi dua kali tanpa menambah apa pun.

                Aksi tambahan (khusus sewa) TIDAK ikut dipaksa ke baris itu.
                Ia membawa teks keadaan yang panjangnya tak bisa ditebak
                ("Kapasitas belum diisi"), dan memaksanya masuk membuat ketiga
                blok saling menabrak di ponsel. Di bawah `lg` ia turun jadi
                barisnya sendiri selebar panel. */}
            <div className="relative flex flex-wrap items-center gap-x-3 gap-y-2.5 px-3.5 py-3 sm:gap-x-5 sm:px-5 sm:py-3.5">
              {/* ── Identitas panel ── */}
              <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
                <span
                  className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-2xl border sm:h-10 sm:w-10 ${
                    isSold
                      ? "border-amber-400/30 bg-amber-500/10"
                      : "border-emerald-400/30 bg-emerald-500/10"
                  }`}
                >
                  <Icon
                    icon={
                      isSold
                        ? "solar:lock-keyhole-minimalistic-bold-duotone"
                        : "solar:widget-5-bold-duotone"
                    }
                    className={`text-xl ${
                      isSold ? "text-amber-300" : "text-emerald-300"
                    }`}
                  />
                </span>

                <div className="min-w-0">
                  <span className="text-[9.5px] font-black uppercase tracking-[0.2em] text-white/75">
                    {isSold ? `Aset ${soldLabel}` : "Performa Aset"}
                  </span>

                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    {/* Status hanya dipajang saat TERJUAL. Selagi aset masih
                        tayang, "Tersedia" tidak memberi tahu apa pun yang
                        tidak sudah dikatakan oleh tombol di sebelahnya —
                        ruangnya lebih berguna untuk umur listing. */}
                    {isSold ? (
                      <StatusPill soldLabel={soldLabel} />
                    ) : (
                      umur && (
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${umur.teks}`}
                        >
                          <Icon
                            icon="solar:calendar-minimalistic-bold-duotone"
                            className="text-xs"
                          />
                          {performa!.hariTayang === 0
                            ? "Tayang hari ini"
                            : `Tayang ${performa!.hariTayang} hari`}
                        </span>
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* ── Aksi tambahan (khusus sewa) ──
                  `order-last` + `w-full`: di ponsel ia jatuh ke barisnya
                  sendiri DI BAWAH tombol utama. Mulai `lg`, urutan DOM-nya
                  dipulihkan sehingga ia kembali berdiri sebelum tombol utama —
                  "Tandai {soldLabel}" harus tetap jadi tombol paling kanan &
                  paling menonjol, karena ia yang paling jarang dipakai tapi
                  paling besar akibatnya. */}
              {aksiTambahan && (
                <div className="order-last w-full lg:order-none lg:w-auto">
                  {aksiTambahan}
                </div>
              )}

              {/* ── Aksi utama ── */}
              <div className="flex shrink-0 items-center gap-2">
                {isSold ? (
                  <button
                    type="button"
                    onClick={() => setSheetOpen(true)}
                    className="group flex items-center justify-center gap-1.5 rounded-2xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-[11.5px] font-bold text-zinc-200 transition-all hover:border-amber-300/50 hover:bg-amber-500/10 hover:text-amber-100 active:scale-[0.98] sm:gap-2 sm:px-4 sm:text-[12px]"
                  >
                    <Icon
                      icon="solar:refresh-bold"
                      className="text-base transition-transform duration-500 group-hover:-rotate-180"
                    />
                    Aktifkan Lagi
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSheetOpen(true)}
                    className="group relative flex items-center justify-center gap-1.5 overflow-hidden rounded-2xl bg-gradient-to-r from-[#86efac] to-[#34d399] px-3.5 py-2.5 text-[11.5px] font-extrabold text-[#04231a] shadow-[0_10px_30px_-10px_rgba(52,211,153,0.9)] transition-all hover:shadow-[0_14px_38px_-10px_rgba(52,211,153,1)] active:scale-[0.98] sm:gap-2 sm:px-5 sm:text-[12.5px]"
                  >
                    <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                    <Icon
                      icon="solar:verified-check-bold"
                      className="relative text-base"
                    />
                    <span className="relative">Tandai {soldLabel}</span>
                  </button>
                )}
              </div>
            </div>

            {/* ── Corong performa ──
                Empat angka dalam urutan perjalanan calon pembeli: dilihat →
                menghubungi → menawar → survei. Urutannya yang bercerita —
                di langkah mana orang berhenti adalah diagnosisnya. */}
            <div className="relative grid grid-cols-4 border-t border-white/[0.07]">
              {(
                [
                  { label: "Dilihat", ikon: "solar:eye-bold-duotone", nilai: performa?.dilihat },
                  { label: "Klik WA", ikon: "solar:chat-round-line-bold-duotone", nilai: performa?.klikWa },
                  { label: "Penawaran", ikon: "solar:hand-money-bold-duotone", nilai: performa?.penawaran },
                  { label: "Survei", ikon: "solar:calendar-mark-bold-duotone", nilai: performa?.survei },
                ] as const
              ).map((m, i) => (
                <div
                  key={m.label}
                  className={`flex flex-col items-center gap-0.5 px-2 py-2.5 ${
                    i > 0 ? "border-l border-white/[0.07]" : ""
                  }`}
                >
                  {memuatPerforma ? (
                    <span className="my-[3px] h-4 w-8 animate-pulse rounded bg-white/10" />
                  ) : (
                    // Angkanya gagal dimuat → "–", bukan "0". Nol adalah
                    // sebuah fakta ("belum ada yang melihat"); kalau kita
                    // tidak tahu, mencetaknya sebagai nol itu berbohong.
                    <span className="text-[15px] font-extrabold leading-none tabular-nums text-white sm:text-base">
                      {m.nilai === undefined ? "–" : formatAngka(m.nilai)}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.1em] text-white/75">
                    <Icon icon={m.ikon} className="text-[11px] text-white/50" />
                    {m.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Kalimat yang menafsirkan angka di atasnya — tanpa ini panel
                cuma memindahkan pekerjaan berpikir ke agent. */}
            {bacaan && (
              <div className="relative flex items-center gap-2 border-t border-white/[0.07] px-4 py-2.5 sm:px-5">
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span
                    className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${bacaan.aksen}`}
                  />
                  <span
                    className={`relative inline-flex h-1.5 w-1.5 rounded-full ${bacaan.aksen}`}
                  />
                </span>
                <Icon
                  icon={bacaan.ikon}
                  className={`shrink-0 text-sm ${bacaan.nada}`}
                />
                <p className={`text-[11px] font-semibold leading-snug ${bacaan.nada}`}>
                  {bacaan.teks}
                </p>
              </div>
            )}

            {/* Jejak audit: siapa yang menandai, kapan, atas dasar apa.
                Pertanyaan pertama saat sebuah aset tiba-tiba tertutup adalah
                "siapa yang menutupnya?" — jawabannya ditaruh persis di tombol
                yang bisa membatalkannya. */}
            {isSold && riwayatTerakhir && (
              <div className="relative flex items-start gap-1.5 border-t border-white/5 px-4 py-2 sm:px-5">
                <Icon
                  icon="solar:history-2-bold-duotone"
                  className="mt-[1px] shrink-0 text-xs text-amber-300/50"
                />
                <p className="text-[10.5px] leading-snug text-white/40">
                  Ditandai {soldLabel.toLowerCase()} oleh{" "}
                  <span className="font-semibold text-white/70">
                    {riwayatTerakhir.namaPelaku || riwayatTerakhir.idAgent}
                  </span>
                  <span className="text-white/30">
                    {" "}
                    ({riwayatTerakhir.idAgent}
                    {riwayatTerakhir.dasarWewenang !== "PEMILIK"
                      ? ` · ${riwayatTerakhir.jabatanPelaku}`
                      : ""}
                    )
                  </span>{" "}
                  · {formatWaktu(riwayatTerakhir.dibuatPada)}
                </p>
              </div>
            )}

          </div>
        </div>
      </div>

      <MarkSoldConfirmSheet
        open={sheetOpen}
        mode={mode}
        loading={saving}
        soldLabel={soldLabel}
        judul={judul}
        idProperty={idProperty}
        lokasi={lokasi}
        harga={harga}
        hargaLabel={hargaLabel}
        thumbnail={thumbnail}
        onConfirm={simpan}
        onCancel={() => !saving && setSheetOpen(false)}
      />
    </>
  );
}

/**
 * Penanda aset tertutup. Hanya muncul saat statusnya TERJUAL — keadaan yang
 * tidak terduga dan karena itu memang perlu dinyatakan. Animasinya dipertahankan
 * supaya perubahan tepat setelah tombol ditekan terasa sebagai akibat.
 */
function StatusPill({ soldLabel }: { soldLabel: string }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={soldLabel}
        initial={{ opacity: 0, y: 6, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.94 }}
        transition={{ duration: 0.22 }}
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/35 bg-amber-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-200"
      >
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
        {soldLabel}
      </motion.span>
    </AnimatePresence>
  );
}
