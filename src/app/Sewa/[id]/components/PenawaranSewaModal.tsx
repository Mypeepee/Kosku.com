"use client";

/**
 * Ajukan penawaran harga sewa — untuk kategori bermode NEGOSIASI.
 *
 * Padanan dari modal penawaran di halaman Jual, dengan satu perbedaan yang
 * menentukan bentuknya: yang ditawar di sini adalah TARIF PER PERIODE, bukan
 * harga sekali bayar. Karena itu setiap angka di layar ini selalu membawa
 * satuannya ("/tahun"), dan pertanyaan "cash atau KPR" — yang wajib di jalur
 * jual — tidak ditanyakan sama sekali: menyewa gudang tidak dibayar dengan
 * KPR. Sisi server sudah tahu bedanya (lihat penanganan `penawaranSewa` di
 * /api/leads/click), jadi kolom cara bayar memang dibiarkan kosong, bukan
 * diisi tebakan.
 *
 * ── DUA ATURAN YANG DIWARISI DARI JALUR JUAL ──────────────────────────────
 *
 * 1. WAJIB LOGIN. Penawaran adalah satu-satunya interaksi di situs ini yang
 *    menghasilkan keputusan (diterima/ditolak) dan tercatat sebagai riwayat.
 *    Tanpa akun, agent menerima angka dari orang yang tidak bisa dihubungi
 *    kembali — dan itu sudah pernah terjadi cukup sering untuk jadi aturan.
 *
 * 2. SATU PENAWARAN PENDING per properti. Ditegakkan server (PENDING_OFFER_EXISTS);
 *    di sini jawabannya ditampilkan apa adanya, bukan sebagai kegagalan.
 *    Pengunjung yang menawar dua kali biasanya lupa, bukan curang.
 */

import React, { useEffect, useMemo, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { Icon } from "@iconify/react";

import { DURASI_META, formatRupiah, type DurasiKey } from "@/lib/kosDetail";
import { trackLeadClick } from "@/lib/leadTracking";
import { getOfferFeedback } from "@/lib/offerFeedback";
import { AKSEN, LINE, SURFACE } from "./sewaTheme";

interface Props {
  buka: boolean;
  onTutup: () => void;
  idProperty: string;
  idAgent: string;
  namaAgent: string;
  teleponAgent: string;
  judulProperti: string;
  /** Harga yang sedang dipasang — dasar perbandingan tawaran. */
  hargaListing: number;
  /** Periode harga tersebut. null = listing belum punya harga per durasi. */
  durasi: DurasiKey | null;
}

/** Tawaran di bawah ini hampir pasti salah ketik, bukan tawaran. */
const TAWARAN_MINIMUM = 100_000;

export default function PenawaranSewaModal({
  buka,
  onTutup,
  idProperty,
  idAgent,
  namaAgent,
  teleponAgent,
  judulProperti,
  hargaListing,
  durasi,
}: Props) {
  const { data: session, status } = useSession();

  const [nominalRaw, setNominalRaw] = useState("");
  const [catatan, setCatatan] = useState("");
  const [galat, setGalat] = useState("");
  const [mengirim, setMengirim] = useState(false);
  const [terkirim, setTerkirim] = useState(false);
  /** Penawaran yang masih menunggu keputusan agent, dari jawaban server. */
  const [pending, setPending] = useState<number | null>(null);

  const satuan = durasi ? DURASI_META[durasi].satuan : "periode";
  const suffix = durasi ? DURASI_META[durasi].suffix : "";

  const nominal = Number(nominalRaw || 0);

  // Selisih terhadap harga pasang, dalam persen. Dipakai dua kali: sebagai
  // umpan balik langsung ke penawar ("wajar / agak rendah"), dan sebagai
  // `discount_pct` yang ikut tersimpan di lead supaya agent bisa menyaring.
  const selisihPersen = useMemo(() => {
    if (nominal <= 0 || hargaListing <= 0) return 0;
    return Math.round(((hargaListing - nominal) / hargaListing) * 100);
  }, [nominal, hargaListing]);

  const umpanBalik =
    nominal > 0 ? getOfferFeedback(selisihPersen, "harga sewa") : null;

  useEffect(() => {
    if (!buka) return;
    setNominalRaw("");
    setCatatan("");
    setGalat("");
    setTerkirim(false);
    setPending(null);

    const asal = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = asal;
    };
  }, [buka]);

  useEffect(() => {
    if (!buka) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onTutup();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [buka, onTutup]);

  if (!buka) return null;

  const belumMasuk = status !== "loading" && !session?.user;

  const kirim = async () => {
    if (nominal < TAWARAN_MINIMUM) {
      setGalat(`Tawaran minimal ${formatRupiah(TAWARAN_MINIMUM)}`);
      return;
    }
    setMengirim(true);
    setGalat("");

    const hasil = await trackLeadClick({
      id_property: idProperty,
      id_agent: idAgent,
      source: "penawaran",
      offer_amount: nominal,
      // Negatif kalau menawar DI ATAS harga pasang — itu keadaan yang nyata
      // pada aset sewa komersial yang diperebutkan, dan membulatkannya ke 0
      // akan menyembunyikan justru penawaran yang paling menarik bagi agent.
      discount_pct: selisihPersen,
      notes:
        [
          durasi ? `Tawaran per ${satuan}` : null,
          catatan.trim() || null,
        ]
          .filter(Boolean)
          .join("\n") || undefined,
    });

    if (!hasil.ok) {
      if (hasil.error === "PENDING_OFFER_EXISTS" && hasil.existing) {
        setPending(hasil.existing.penawaran);
      } else {
        setGalat(
          hasil.error?.includes("Unauthorized")
            ? "Sesi Anda berakhir. Silakan masuk lagi."
            : "Gagal mengirim penawaran. Coba lagi sebentar lagi.",
        );
      }
      setMengirim(false);
      return;
    }

    setTerkirim(true);
    setMengirim(false);
  };

  const bukaWa = () => {
    const telp = teleponAgent.replace(/^0/, "62").replace(/\D/g, "");
    if (!telp) return;
    const pesan = [
      `Halo ${namaAgent} 👋`,
      "",
      `Saya baru mengajukan penawaran sewa lewat Solusindo.`,
      "",
      `🏠 *${judulProperti}*`,
      `💰 Harga pasang: ${formatRupiah(hargaListing)}${suffix}`,
      `🤝 Tawaran saya: *${formatRupiah(nominal)}${suffix}*`,
      catatan.trim() ? `📝 ${catatan.trim()}` : null,
      "",
      "Mohon pertimbangannya. Terima kasih!",
    ]
      .filter(Boolean)
      .join("\n");
    window.open(`https://wa.me/${telp}?text=${encodeURIComponent(pesan)}`, "_blank");
  };

  // ───────────────────────────────────────────────────────────────────────
  // ISI
  // ───────────────────────────────────────────────────────────────────────

  const renderIsi = () => {
    if (belumMasuk) {
      return (
        <div className="px-6 py-8 text-center">
          <span
            className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl border ${AKSEN.sky.kotak}`}
          >
            <Icon icon="solar:lock-keyhole-bold-duotone" className="text-2xl" />
          </span>
          <h3 className="mt-4 text-base font-bold text-white">
            Masuk untuk mengajukan penawaran
          </h3>
          <p className="mx-auto mt-2 max-w-[280px] text-xs leading-relaxed text-white/45">
            Penawaran tercatat sebagai riwayat dan akan dijawab agent, jadi ia
            harus bisa dikembalikan ke akun yang mengajukannya.
          </p>
          <button
            onClick={() => signIn()}
            className="mt-5 w-full rounded-2xl bg-[#86efac] px-4 py-3.5 text-[13px] font-extrabold text-black transition-all hover:bg-[#a7f3c4] active:scale-[0.985]"
          >
            Masuk / Daftar
          </button>
        </div>
      );
    }

    if (pending !== null) {
      return (
        <div className="px-6 py-8 text-center">
          <span
            className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl border ${AKSEN.amber.kotak}`}
          >
            <Icon icon="solar:hourglass-bold-duotone" className="text-2xl" />
          </span>
          <h3 className="mt-4 text-base font-bold text-white">
            Penawaran Anda masih ditimbang
          </h3>
          <p className="mx-auto mt-2 max-w-[300px] text-xs leading-relaxed text-white/45">
            {pending != null
              ? `Tawaran ${formatRupiah(pending)}${suffix} sudah masuk ke agent dan belum diputuskan. `
              : "Sudah ada penawaran Anda yang belum diputuskan agent. "}
            Penawaran baru bisa diajukan setelah yang ini dijawab.
          </p>
          <button
            onClick={onTutup}
            className="mt-5 w-full rounded-2xl border border-white/[0.12] px-4 py-3.5 text-[13px] font-bold text-white transition-all hover:bg-white/[0.06]"
          >
            Mengerti
          </button>
        </div>
      );
    }

    if (terkirim) {
      return (
        <div className="px-6 py-8 text-center">
          <span
            className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl border ${AKSEN.mint.kotak}`}
          >
            <Icon icon="solar:check-circle-bold" className="text-2xl" />
          </span>
          <h3 className="mt-4 text-base font-bold text-white">
            Penawaran terkirim
          </h3>
          <p className="mx-auto mt-2 max-w-[300px] text-xs leading-relaxed text-white/45">
            {formatRupiah(nominal)}
            {suffix} sudah masuk ke dashboard {namaAgent}. Anda akan diberi tahu
            begitu ada keputusan.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2.5">
            <button
              onClick={bukaWa}
              className="flex items-center justify-center gap-1.5 rounded-2xl bg-[#86efac] px-3 py-3.5 text-[12px] font-extrabold text-black transition-all hover:bg-[#a7f3c4] active:scale-[0.985]"
            >
              <Icon icon="ic:baseline-whatsapp" className="text-base" />
              Susul via WA
            </button>
            <button
              onClick={onTutup}
              className="rounded-2xl border border-white/[0.12] px-3 py-3.5 text-[12px] font-bold text-white transition-all hover:bg-white/[0.06]"
            >
              Tutup
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="px-5 pb-5 pt-4">
        {/* Pembanding selalu terlihat saat mengetik. Tanpa angka pasangannya,
            "Rp 45.000.000" tidak memberi tahu penawar apakah ia sedang
            menawar tipis atau separuh. */}
        <div
          className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${LINE.card}`}
          style={{ background: SURFACE.raised }}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-white/40">
            Harga pasang
          </span>
          <span className="text-sm font-extrabold text-white">
            {formatRupiah(hargaListing)}
            <span className="ml-0.5 text-[11px] font-bold text-white/40">
              {suffix}
            </span>
          </span>
        </div>

        <label className="mt-4 block text-[11px] font-bold uppercase tracking-wider text-white/40">
          Tawaran Anda {durasi ? `per ${satuan}` : ""}
        </label>
        <div className="mt-2 flex items-center gap-2 rounded-2xl border border-white/[0.12] px-4 focus-within:border-[#86efac]/60">
          <span className="text-base font-bold text-white/40">Rp</span>
          <input
            autoFocus
            inputMode="numeric"
            value={
              nominalRaw ? Number(nominalRaw).toLocaleString("id-ID") : ""
            }
            onChange={(e) => {
              setNominalRaw(e.target.value.replace(/\D/g, "").slice(0, 12));
              setGalat("");
            }}
            placeholder="0"
            aria-label="Nominal tawaran"
            className="w-full bg-transparent py-3.5 text-lg font-extrabold text-white placeholder:text-white/20 focus:outline-none"
          />
          {suffix && (
            <span className="shrink-0 text-xs font-bold text-white/40">
              {suffix}
            </span>
          )}
        </div>

        {umpanBalik && (
          <p
            className={`mt-2.5 flex items-start gap-2 text-[11px] font-semibold leading-relaxed ${umpanBalik.textClass}`}
          >
            <Icon icon={umpanBalik.icon} className="mt-px shrink-0 text-sm" />
            <span>{umpanBalik.message}</span>
          </p>
        )}

        <label className="mt-4 block text-[11px] font-bold uppercase tracking-wider text-white/40">
          Catatan <span className="normal-case text-white/25">(opsional)</span>
        </label>
        <textarea
          value={catatan}
          onChange={(e) => setCatatan(e.target.value.slice(0, 500))}
          rows={3}
          placeholder={`Mis. siap kontrak 2 ${satuan}, bayar di muka.`}
          className="mt-2 w-full resize-none rounded-2xl border border-white/[0.12] bg-transparent px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-[#86efac]/60 focus:outline-none"
        />

        {galat && (
          <p className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-rose-300">
            <Icon icon="solar:danger-circle-bold" className="text-sm" />
            {galat}
          </p>
        )}

        <button
          onClick={kirim}
          disabled={mengirim || nominal <= 0}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#86efac] px-4 py-3.5 text-[13px] font-extrabold text-black transition-all hover:bg-[#a7f3c4] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {mengirim ? (
            <>
              <Icon icon="svg-spinners:180-ring" className="text-base" />
              Mengirim…
            </>
          ) : (
            <>
              <Icon icon="solar:tag-price-bold" className="text-base" />
              Kirim penawaran
            </>
          )}
        </button>

        <p className="mt-3 text-center text-[10px] leading-relaxed text-white/30">
          Penawaran bersifat tidak mengikat sampai keduanya sepakat tertulis.
        </p>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onTutup}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ajukan penawaran sewa"
        className="relative max-h-[90vh] w-full overflow-y-auto rounded-t-[1.75rem] border border-white/[0.08] sm:max-w-[420px] sm:rounded-[1.75rem]"
        style={{ background: SURFACE.modal }}
      >
        <div
          className={`flex items-start justify-between gap-3 border-b px-5 py-4 ${LINE.row}`}
        >
          <div className="min-w-0">
            <h2 className="text-base font-bold text-white">Ajukan penawaran</h2>
            <p className="mt-0.5 truncate text-[11px] font-semibold text-white/40">
              {judulProperti}
            </p>
          </div>
          <button
            onClick={onTutup}
            aria-label="Tutup"
            className="shrink-0 rounded-xl border border-white/[0.12] p-2 text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <Icon icon="solar:close-circle-bold" className="text-base" />
          </button>
        </div>

        {renderIsi()}
      </div>
    </div>
  );
}
