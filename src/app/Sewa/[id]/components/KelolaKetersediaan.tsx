"use client";

/**
 * Drawer "Kelola Ketersediaan" — tempat pengelola menandai tanggal & kamar
 * yang tidak tersedia, tanpa membuka wizard edit properti.
 *
 * Ditaruh DI ATAS halaman detail, bukan di halaman dashboard tersendiri,
 * karena pekerjaannya bersifat "lihat lalu perbaiki": pengelola membuka
 * listingnya, melihat "sisa 3 kamar" yang sudah tidak benar, dan ingin
 * membetulkannya di detik itu juga. Memindahkannya ke halaman lain berarti
 * kehilangan konteks yang justru memicu perbaikannya.
 *
 * Komponennya sendiri sengaja tidak tahu apa-apa soal halaman detail: ia hanya
 * menerima id, bentuk inventaris, dan callback. Itu yang membuatnya bisa
 * dipasang di /dashboard nanti tanpa ditulis ulang.
 *
 * Semua aturan hitung datang dari @/lib/sewaAvailability — modul yang sama
 * dengan yang dipakai panel penyewa dan validator server.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";

import Kalender, { type FaseRentang } from "./Kalender";
import { useSeretTutup } from "../lib/useSeretTutup";
import { AKSEN, LINE, SURFACE } from "./sewaTheme";
import {
  ALASAN_BLOKIR,
  ALASAN_META,
  dariKunci,
  kunciDariKalender,
  kunciHariIni,
  sisaPadaTanggal,
  tambahHari,
  type AlasanBlokir,
  type BlokirView,
  type InventarisView,
  type KunciTanggal,
} from "@/lib/sewaAvailability";
import { formatTanggal } from "@/lib/kosDetail";
import type { ModelInventaris } from "../types";

/** Blok versi pengelola — dengan alasan & catatan, yang tidak pernah publik. */
interface BlokKelola extends BlokirView {
  id: string;
  alasan: AlasanBlokir;
  catatan: string | null;
}

interface DataKelola {
  inventaris: InventarisView[];
  blok: BlokKelola[];
  horizonSampai: KunciTanggal;
}

interface Props {
  buka: boolean;
  onTutup: () => void;
  idProperty: string;
  modelInventaris: ModelInventaris;
  /** Nama tipe untuk label. Kosong = listing tanpa tipe kamar. */
  namaTipe: { id: string; nama: string }[];
  /** "Listing Anda" / "Akses Owner" — pengelola harus tahu dasar wewenangnya. */
  labelBasis: string | null;
  /** Dipanggil setiap kali ada perubahan tersimpan. */
  onBerubah: () => void;
}

/** Kunci kantong "seluruh listing" di UI. `null` tidak bisa jadi key React. */
const KUNCI_LISTING = "__listing__";

export default function KelolaKetersediaan({
  buka,
  onTutup,
  idProperty,
  modelInventaris,
  namaTipe,
  labelBasis,
  onBerubah,
}: Props) {
  const [mounted, setMounted] = useState(false);
  /** Seret pegangan/kepala ke bawah untuk menutup — lihat useSeretTutup. */
  const seret = useSeretTutup(onTutup);
  const [data, setData] = useState<DataKelola | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);

  // Kantong yang sedang dikelola. Untuk unit tunggal & kos tanpa tipe, hanya
  // ada satu dan pemilihnya tidak dirender sama sekali.
  const [kantong, setKantong] = useState<string>(
    namaTipe[0]?.id ?? KUNCI_LISTING,
  );

  const [mulai, setMulai] = useState<Date | null>(null);
  const [selesai, setSelesai] = useState<Date | null>(null);
  const [fase, setFase] = useState<FaseRentang>("mulai");
  const [jumlahKamar, setJumlahKamar] = useState(1);
  const [alasan, setAlasan] = useState<AlasanBlokir>("DISEWA");
  const [catatan, setCatatan] = useState("");
  const [terbuka, setTerbuka] = useState(false); // "sampai dibuka lagi"

  useEffect(() => setMounted(true), []);

  // ── MUAT ──────────────────────────────────────────────────────────────────

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat(null);
    try {
      const r = await fetch(`/api/listings/${idProperty}/ketersediaan`, {
        // Kalender pengelola tidak boleh dilayani dari cache browser: dia baru
        // saja mengubahnya, dan melihat angka lama akan membuatnya mengubah
        // dua kali.
        cache: "no-store",
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Gagal memuat ketersediaan.");
      setData({
        inventaris: j.inventaris ?? [],
        blok: j.blok ?? [],
        horizonSampai: j.horizonSampai,
      });
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal memuat ketersediaan.");
    } finally {
      setMemuat(false);
    }
  }, [idProperty]);

  useEffect(() => {
    if (buka) muat();
  }, [buka, muat]);

  useEffect(() => {
    if (!buka) return;
    const asal = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = asal;
    };
  }, [buka]);

  useEffect(() => {
    if (!buka) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onTutup();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [buka, onTutup]);

  // ── TURUNAN ───────────────────────────────────────────────────────────────

  const idTipeAktif = kantong === KUNCI_LISTING ? null : kantong;

  const invAktif = useMemo(
    () => data?.inventaris.find((i) => i.idTipe === idTipeAktif) ?? null,
    [data, idTipeAktif],
  );

  const kapasitas = invAktif?.totalKamar ?? 1;

  /** Blok kantong ini + blok tingkat listing yang ikut menutupnya. */
  const blokKantong = useMemo(() => {
    if (!data) return [];
    return data.blok.filter(
      (b) => b.idTipe === idTipeAktif || (b.idTipe === null && idTipeAktif !== null),
    );
  }, [data, idTipeAktif]);

  const ketersediaan = useCallback(
    (d: Date): number | null => {
      if (!invAktif || !data) return null;
      const k = kunciDariKalender(d);
      if (k >= data.horizonSampai) return null;
      return sisaPadaTanggal(invAktif, blokKantong, k);
    },
    [invAktif, data, blokKantong],
  );

  const sisaHariIni = invAktif
    ? sisaPadaTanggal(invAktif, blokKantong, kunciHariIni())
    : null;

  /**
   * Blok tingkat listing pada gedung bertipe berarti "tutup seluruhnya" — bukan
   * pengurangan sejumlah kamar. Karena itu stepper jumlah kamar disembunyikan
   * di kasus itu: angkanya tidak akan dipakai, dan menampilkannya akan
   * menjanjikan kendali yang tidak ada.
   */
  const tutupTotal = idTipeAktif === null && namaTipe.length > 0;
  const pakaiStepper = !tutupTotal && kapasitas > 1;

  // Blok pengelola bebas: tanggal keluar mana pun sesudah tanggal masuk sah.
  // Tidak ada pembulatan durasi di sini — itu aturan penagihan penyewa, bukan
  // aturan fisik kamar terisi.
  const snapSelesai = useCallback(
    (d: Date): Date | null => {
      if (!mulai) return null;
      return d.getTime() > mulai.getTime() ? d : null;
    },
    [mulai],
  );

  const resetForm = () => {
    setMulai(null);
    setSelesai(null);
    setFase("mulai");
    setJumlahKamar(1);
    setAlasan("DISEWA");
    setCatatan("");
    setTerbuka(false);
  };

  // ── AKSI ──────────────────────────────────────────────────────────────────

  const kirim = useCallback(
    async (init: RequestInit, query = "", sukses?: () => void) => {
      setMenyimpan(true);
      setGalat(null);
      try {
        const r = await fetch(
          `/api/listings/${idProperty}/ketersediaan${query}`,
          init,
        );
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error || "Gagal menyimpan.");
        await muat();
        // Halaman detail dirender server; tanpa ini panel penyewa di
        // belakangnya masih memakai angka sebelum perubahan.
        onBerubah();
        sukses?.();
      } catch (e) {
        setGalat(e instanceof Error ? e.message : "Gagal menyimpan.");
      } finally {
        setMenyimpan(false);
      }
    },
    [idProperty, muat, onBerubah],
  );

  const simpanBlok = () => {
    if (!mulai) {
      setGalat("Pilih tanggal mulai dulu.");
      return;
    }
    if (!terbuka && !selesai) {
      setGalat("Pilih tanggal selesai, atau centang 'sampai dibuka lagi'.");
      return;
    }

    kirim(
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idTipe: idTipeAktif,
          mulai: kunciDariKalender(mulai),
          selesai: terbuka || !selesai ? null : kunciDariKalender(selesai),
          jumlahKamar: pakaiStepper ? jumlahKamar : 1,
          alasan,
          catatan: catatan.trim() || null,
        }),
      },
      "",
      resetForm,
    );
  };

  const tandaiPenuh = () => {
    // "Penuh sampai dibuka lagi" = blok terbuka mulai hari ini sebanyak
    // seluruh sisa kamar. Dikirim sebagai SATU blok, bukan beberapa, supaya
    // membukanya kembali juga cukup satu langkah.
    if (!invAktif) return;
    const sisa = sisaHariIni ?? 0;
    if (sisa <= 0) return;
    kirim({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idTipe: idTipeAktif,
        mulai: kunciHariIni(),
        selesai: null,
        jumlahKamar: tutupTotal ? 1 : sisa,
        alasan: "TUTUP",
        catatan: "Ditandai penuh dari halaman detail",
      }),
    });
  };

  const hapusSemua = () => {
    if (
      !window.confirm(
        "Hapus SEMUA periode tidak tersedia? Listing akan tampil kosong sepenuhnya.",
      )
    )
      return;
    // `?semua=1` — satu permintaan, bukan N permintaan hapus yang bisa gagal di
    // tengah jalan dan meninggalkan kalender setengah terbuka.
    kirim({ method: "DELETE" }, "?semua=1");
  };

  const hapusSatu = (idBlok: string) =>
    kirim({ method: "DELETE" }, `?blok=${encodeURIComponent(idBlok)}`);

  // ── RENDER ────────────────────────────────────────────────────────────────

  if (!mounted || !buka) return null;

  const daftarBlok = data?.blok ?? [];

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onTutup}
      />

      <div
        className="relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[2rem] border border-white/10 shadow-2xl sm:max-h-[90dvh] sm:max-w-[720px] sm:rounded-[1.75rem]"
        style={{ background: SURFACE.modal, ...seret.gaya }}
      >
        {/* Pegangan + kepala: bisa diseret ke bawah untuk menutup, seperti
            sheet mana pun yang datang dari tepi bawah layar. */}
        <div {...seret.pegangan}>
          <div className="flex cursor-grab justify-center pt-3 active:cursor-grabbing sm:hidden">
            <span className="h-[3px] w-9 rounded-full bg-white/25" />
          </div>

          {/* ── KEPALA ── */}
          <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-base font-extrabold text-white">
                <Icon
                  icon="solar:calendar-mark-bold-duotone"
                  className={`text-lg ${AKSEN.amber.ikon}`}
                />
                Kelola Ketersediaan
              </h3>
              <p className="truncate text-[11px] text-white/55">
                {labelBasis ? `${labelBasis} · ` : ""}
                {modelInventaris === "UNIT"
                  ? "Tandai periode unit ini terpakai"
                  : "Tandai tanggal & kamar yang tidak tersedia"}
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

        <div className="custom-scrollbar flex-1 overflow-y-auto px-5 pb-4">
          {galat && (
            <div
              className={`mb-3 flex items-start gap-2 rounded-xl border border-rose-400/25 p-3 ${AKSEN.rose.wash}`}
            >
              <Icon
                icon="solar:danger-triangle-bold-duotone"
                className={`mt-px shrink-0 text-base ${AKSEN.rose.ikon}`}
              />
              <p className={`text-[11px] font-semibold ${AKSEN.rose.teks}`}>
                {galat}
              </p>
            </div>
          )}

          {memuat && !data ? (
            <p className="py-10 text-center text-xs font-semibold text-white/35">
              Memuat ketersediaan…
            </p>
          ) : (
            <>
              {/* ── PEMILIH KANTONG ── */}
              {namaTipe.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-[9px] font-black uppercase tracking-[0.14em] text-white/30">
                    Kelola untuk
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {namaTipe.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setKantong(t.id);
                          resetForm();
                        }}
                        className={`rounded-xl border px-3 py-2 text-[11px] font-bold transition-colors ${
                          kantong === t.id
                            ? "border-amber-300/60 bg-amber-300/10 text-amber-200"
                            : "border-white/[0.08] text-white/50 hover:border-white/20 hover:text-white"
                        }`}
                      >
                        {t.nama}
                      </button>
                    ))}
                    {/* Menutup SELURUH gedung sekaligus — mis. renovasi total.
                        Dipisah dari tipe supaya artinya tidak tercampur dengan
                        "beberapa kamar tipe X terisi". */}
                    <button
                      onClick={() => {
                        setKantong(KUNCI_LISTING);
                        resetForm();
                      }}
                      className={`rounded-xl border px-3 py-2 text-[11px] font-bold transition-colors ${
                        kantong === KUNCI_LISTING
                          ? "border-rose-300/60 bg-rose-300/10 text-rose-200"
                          : "border-white/[0.08] text-white/50 hover:border-white/20 hover:text-white"
                      }`}
                    >
                      Seluruh gedung
                    </button>
                  </div>
                </div>
              )}

              {/* ── RINGKAS ── */}
              <div
                className={`mb-4 flex items-center justify-between gap-3 rounded-2xl border border-white/[0.08] p-3.5`}
                style={{ background: SURFACE.raised }}
              >
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/30">
                    Hari ini
                  </p>
                  <p className="text-xs font-bold text-white">
                    {invAktif === null
                      ? "Kapasitas belum diisi"
                      : modelInventaris === "UNIT"
                        ? (sisaHariIni ?? 0) > 0
                          ? "Unit tersedia"
                          : "Unit terpakai"
                        : `${sisaHariIni ?? 0} dari ${kapasitas} kamar tersedia`}
                  </p>
                </div>
                {invAktif !== null && (sisaHariIni ?? 0) > 0 && (
                  <button
                    onClick={tandaiPenuh}
                    disabled={menyimpan}
                    className="shrink-0 rounded-xl border border-rose-400/30 px-3 py-2 text-[11px] font-bold text-rose-200 transition-colors hover:bg-rose-400/10 disabled:opacity-40"
                  >
                    Tandai penuh
                  </button>
                )}
              </div>

              {invAktif === null ? (
                <p className="rounded-2xl border border-white/[0.08] p-4 text-[11px] leading-relaxed text-white/45">
                  Jumlah kamar untuk pilihan ini belum pernah diisi, jadi
                  ketersediaannya tidak bisa dihitung. Lengkapi dulu lewat{" "}
                  <span className="font-bold text-white/70">Edit listing</span>.
                </p>
              ) : (
                <>
                  {/* ── KALENDER ── */}
                  <div className="mb-4 rounded-2xl border border-white/[0.08] p-4">
                    <div className="mb-3 grid grid-cols-2 gap-2">
                      {(
                        [
                          ["mulai", "Mulai tidak tersedia", mulai],
                          ["selesai", "Sampai (kosong lagi)", selesai],
                        ] as const
                      ).map(([f, label, nilai]) => (
                        <button
                          key={f}
                          onClick={() => setFase(mulai ? f : "mulai")}
                          disabled={f === "selesai" && terbuka}
                          className={`rounded-xl border p-3 text-left transition-colors disabled:opacity-35 ${
                            fase === f && !(f === "selesai" && terbuka)
                              ? "border-amber-300/60 bg-amber-300/[0.08]"
                              : "border-white/[0.08] hover:border-white/20"
                          }`}
                        >
                          <span className="block text-[9px] font-black uppercase tracking-[0.14em] text-white/30">
                            {label}
                          </span>
                          <span
                            className={`block truncate text-xs font-bold ${
                              nilai ? "text-white" : "text-white/35"
                            }`}
                          >
                            {f === "selesai" && terbuka
                              ? "Sampai dibuka lagi"
                              : nilai
                                ? formatTanggal(nilai)
                                : "Pilih tanggal"}
                          </span>
                        </button>
                      ))}
                    </div>

                    <Kalender
                      mode="range"
                      jumlahBulan={2}
                      maksBulanKeDepan={12}
                      mulai={mulai}
                      selesai={terbuka ? null : selesai}
                      fase={fase}
                      onFase={setFase}
                      onMulai={(d) => {
                        setMulai(d);
                        setSelesai(null);
                      }}
                      onSelesai={setSelesai}
                      snapSelesai={snapSelesai}
                      ketersediaan={ketersediaan}
                      kapasitas={kapasitas}
                      // Pengelola justru perlu memilih tanggal yang sudah
                      // terisi — tanggalnya ditandai merah, bukan dikunci.
                      ketersediaanMengunci={false}
                    />

                    <p className="mt-2 text-[10px] font-semibold text-white/25">
                      Tanggal &quot;sampai&quot; adalah hari kamar kosong lagi —
                      hari itu sudah bisa dihuni penyewa berikutnya.
                    </p>
                  </div>

                  {/* ── FORM ── */}
                  <div
                    className="mb-4 divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08]"
                    style={{ background: SURFACE.raised }}
                  >
                    <label className="flex cursor-pointer items-center justify-between gap-3 p-3.5">
                      <span className="min-w-0">
                        <span className="block text-xs font-bold text-white/75">
                          Sampai dibuka lagi
                        </span>
                        <span className="block text-[10px] text-white/30">
                          Tanpa tanggal selesai — mis. sudah ada penghuni tetap
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={terbuka}
                        onChange={(e) => {
                          setTerbuka(e.target.checked);
                          if (e.target.checked) {
                            setSelesai(null);
                            setFase("mulai");
                          }
                        }}
                        className="h-4 w-4 shrink-0 accent-amber-300"
                      />
                    </label>

                    {pakaiStepper && (
                      <div className="flex items-center justify-between gap-3 p-3.5">
                        <span className="min-w-0">
                          <span className="block text-xs font-bold text-white/75">
                            Berapa kamar
                          </span>
                          <span className="block text-[10px] text-white/30">
                            Dari {kapasitas} kamar tipe ini
                          </span>
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setJumlahKamar((n) => Math.max(1, n - 1))
                            }
                            disabled={jumlahKamar <= 1}
                            className="grid h-7 w-7 place-items-center rounded-lg bg-white/[0.07] text-white transition-colors hover:bg-white/[0.14] disabled:opacity-20"
                            aria-label="Kurangi"
                          >
                            <Icon icon="ic:round-minus" width="14" />
                          </button>
                          <span className="w-6 text-center text-xs font-extrabold tabular-nums text-white">
                            {jumlahKamar}
                          </span>
                          <button
                            onClick={() =>
                              setJumlahKamar((n) => Math.min(kapasitas, n + 1))
                            }
                            disabled={jumlahKamar >= kapasitas}
                            className="grid h-7 w-7 place-items-center rounded-lg bg-white/[0.07] text-white transition-colors hover:bg-white/[0.14] disabled:opacity-20"
                            aria-label="Tambah"
                          >
                            <Icon icon="ic:round-plus" width="14" />
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="p-3.5">
                      <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.14em] text-white/30">
                        Alasan
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {ALASAN_BLOKIR.map((a) => (
                          <button
                            key={a}
                            onClick={() => setAlasan(a)}
                            title={ALASAN_META[a].keterangan}
                            className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                              alasan === a
                                ? "border-amber-300/60 bg-amber-300/10 text-amber-200"
                                : "border-white/[0.08] text-white/50 hover:border-white/20 hover:text-white"
                            }`}
                          >
                            <Icon icon={ALASAN_META[a].ikon} className="text-sm" />
                            {ALASAN_META[a].label}
                          </button>
                        ))}
                      </div>
                      <p className="mt-2 text-[10px] text-white/25">
                        Hanya untuk catatan Anda — tidak pernah ditampilkan ke
                        calon penyewa.
                      </p>
                    </div>

                    <div className="p-3.5">
                      <input
                        value={catatan}
                        onChange={(e) => setCatatan(e.target.value)}
                        maxLength={255}
                        placeholder="Catatan (opsional), mis. nama penghuni"
                        className="w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5 text-xs text-white placeholder:text-white/25 focus:border-amber-300/50 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    onClick={simpanBlok}
                    disabled={menyimpan || !mulai}
                    className="mb-5 w-full rounded-2xl bg-amber-300 py-3.5 text-sm font-extrabold text-black transition-all hover:bg-amber-200 active:scale-[0.985] disabled:opacity-35"
                  >
                    {menyimpan ? "Menyimpan…" : "Simpan periode"}
                  </button>
                </>
              )}

              {/* ── DAFTAR BLOK ── */}
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/30">
                    Periode tidak tersedia ({daftarBlok.length})
                  </p>
                  {daftarBlok.length > 0 && (
                    <button
                      onClick={hapusSemua}
                      disabled={menyimpan}
                      className="text-[11px] font-bold text-white/40 underline transition-colors hover:text-white disabled:opacity-40"
                    >
                      Buka semua
                    </button>
                  )}
                </div>

                {daftarBlok.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-white/[0.10] p-5 text-center text-[11px] font-semibold text-white/30">
                    Belum ada periode yang ditandai — semua tanggal tampil
                    tersedia untuk calon penyewa.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {daftarBlok.map((b) => (
                      <BarisBlok
                        key={b.id}
                        blok={b}
                        namaTipe={namaTipe}
                        modelInventaris={modelInventaris}
                        sibuk={menyimpan}
                        onHapus={() => hapusSatu(b.id)}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>

        <div
          className={`flex items-center justify-between gap-3 border-t px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] ${LINE.row}`}
        >
          <p className="text-[10px] font-semibold text-white/25">
            Perubahan langsung terlihat di halaman ini.
          </p>
          <button
            onClick={onTutup}
            className="shrink-0 rounded-xl border border-white/[0.12] px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-white/[0.06]"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BARIS BLOK
// ─────────────────────────────────────────────────────────────────────────────

function BarisBlok({
  blok,
  namaTipe,
  modelInventaris,
  sibuk,
  onHapus,
}: {
  blok: BlokKelola;
  namaTipe: { id: string; nama: string }[];
  modelInventaris: ModelInventaris;
  sibuk: boolean;
  onHapus: () => void;
}) {
  const label =
    blok.idTipe === null
      ? namaTipe.length > 0
        ? "Seluruh gedung"
        : modelInventaris === "UNIT"
          ? "Unit ini"
          : "Semua kamar"
      : (namaTipe.find((t) => t.id === blok.idTipe)?.nama ?? "Tipe kamar");

  const meta = ALASAN_META[blok.alasan] ?? ALASAN_META.DISEWA;

  // Tanggal akhir yang DITAMPILKAN adalah hari terakhir terpakai, sementara
  // yang disimpan adalah hari kamar kosong lagi (rentang setengah terbuka).
  // Menampilkan tanggal simpan apa adanya membuat pengelola mengira kamarnya
  // terpakai satu hari lebih lama daripada kenyataannya.
  const akhirTampil = blok.selesai
    ? formatTanggal(dariKunci(tambahHari(blok.selesai, -1)))
    : null;

  return (
    <li
      className="flex items-center gap-3 rounded-xl border border-white/[0.08] p-3"
      style={{ background: SURFACE.raised }}
    >
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border ${AKSEN.amber.kotak}`}
      >
        <Icon icon={meta.ikon} className="text-base" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-white">
          {formatTanggal(dariKunci(blok.mulai))}
          {akhirTampil ? ` – ${akhirTampil}` : " – seterusnya"}
        </p>
        <p className="truncate text-[10px] font-semibold text-white/35">
          {label}
          {blok.jumlahKamar > 1 && ` · ${blok.jumlahKamar} kamar`}
          {` · ${meta.label}`}
          {blok.catatan ? ` · ${blok.catatan}` : ""}
        </p>
      </div>

      <button
        onClick={onHapus}
        disabled={sibuk}
        className="shrink-0 rounded-lg p-2 text-white/30 transition-colors hover:bg-rose-400/10 hover:text-rose-300 disabled:opacity-30"
        aria-label="Hapus periode"
      >
        <Icon icon="solar:trash-bin-trash-bold-duotone" className="text-base" />
      </button>
    </li>
  );
}
