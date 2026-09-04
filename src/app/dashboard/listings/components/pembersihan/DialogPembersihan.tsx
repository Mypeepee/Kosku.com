"use client";

/**
 * Dialog "Bersihkan Data" — OWNER ONLY.
 *
 * Alur yang dipaksakan di sini, dan alasannya: aturan → LIHAT ISINYA →
 * konfirmasi → jalan bertahap. Tombol "hapus semua yang cocok" memang ada,
 * tapi tidak pernah jadi hal pertama yang bisa ditekan: daftar kandidatnya
 * dimuat begitu sebuah aturan dipilih, karena satu-satunya cara mengetahui
 * sebuah aturan terlalu rakus adalah membaca baris yang ditangkapnya.
 *
 * Tab "Cari manual" ada untuk sampah bentuk baru yang belum punya aturan.
 * Di sana TIDAK ada tombol "hapus semua yang cocok" — hanya yang dicentang
 * satu per satu. Pencarian kata kunci yang bisa dieksekusi massal adalah
 * persis cara membuang pabrik 17 hektar yang judulnya kebetulan menyebut
 * "barang bergerak".
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { toast } from "sonner";
import { formatRupiahRingkas } from "@/lib/lelangBiaya";
import {
  ATURAN_PEMBERSIHAN,
  KATA_KONFIRMASI,
  aturanById,
  type AksiPembersihan,
  type DilewatiPembersihan,
  type HalamanKandidat,
  type HasilPembersihan,
  type IdAturan,
  type RingkasanPembersihan,
} from "@/lib/pembersihanListing";

const angka = (n: number) => new Intl.NumberFormat("id-ID").format(n);

type Tab = "ATURAN" | "CARI";

type Props = {
  open: boolean;
  ringkasan: RingkasanPembersihan | null;
  onClose: () => void;
  /** Dipanggil setiap kali database berubah, supaya banner & daftar ikut segar. */
  onSelesai: () => void;
};

/** Keadaan proses berjalan — dipakai untuk bilah kemajuan & mengunci tombol. */
type Proses = {
  aksi: AksiPembersihan;
  target: number;
  selesai: number;
  dilewati: DilewatiPembersihan[];
  berjalan: boolean;
};

export default function DialogPembersihan({
  open,
  ringkasan,
  onClose,
  onSelesai,
}: Props) {
  const [tab, setTab] = useState<Tab>("ATURAN");
  const [aturanAktif, setAturanAktif] = useState<IdAturan | null>(null);
  const [q, setQ] = useState("");
  const [qAktif, setQAktif] = useState("");

  const [halaman, setHalaman] = useState<HalamanKandidat | null>(null);
  const [page, setPage] = useState(1);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const [pilih, setPilih] = useState<Set<string>>(new Set());
  const [aksi, setAksi] = useState<AksiPembersihan>("HAPUS");
  const [konfirmasi, setKonfirmasi] = useState("");
  const [proses, setProses] = useState<Proses | null>(null);

  const berhenti = useRef(false);

  /* ── Buka/tutup: kunci scroll body, Esc untuk keluar ── */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !proses?.berjalan) onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, proses?.berjalan]);

  // Aturan pertama yang memang ada isinya dipilihkan saat dialog dibuka —
  // dialog yang terbuka dengan daftar kosong terbaca seperti "tidak ada apa-apa
  // untuk dibersihkan", padahal isinya cuma belum diminta.
  useEffect(() => {
    if (!open || !ringkasan || aturanAktif) return;
    const berisi = ringkasan.aturan.find((a) => a.jumlah > 0);
    if (berisi) setAturanAktif(berisi.id);
  }, [open, ringkasan, aturanAktif]);

  /* ── Muat kandidat ── */
  const muat = useCallback(async () => {
    const params = new URLSearchParams();
    if (tab === "ATURAN") {
      if (!aturanAktif) {
        setHalaman(null);
        return;
      }
      params.set("aturan", aturanAktif);
    } else {
      if (qAktif.trim().length < 2) {
        setHalaman(null);
        return;
      }
      params.set("q", qAktif.trim());
    }
    params.set("page", String(page));

    setMemuat(true);
    setGalat(null);
    try {
      const res = await fetch(`/api/listings/pembersihan/kandidat?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal memuat kandidat.");
      setHalaman(data as HalamanKandidat);
    } catch (e) {
      setHalaman(null);
      setGalat(e instanceof Error ? e.message : "Gagal memuat kandidat.");
    } finally {
      setMemuat(false);
    }
  }, [tab, aturanAktif, qAktif, page]);

  useEffect(() => {
    if (open) void muat();
  }, [open, muat]);

  // Pilihan dibuang setiap kali daftarnya berganti. Centang yang tertinggal
  // dari aturan/pencarian sebelumnya adalah centang atas baris yang sudah
  // tidak terlihat lagi — dan itu justru baris yang paling tidak boleh ikut
  // terhapus.
  useEffect(() => {
    setPilih(new Set());
  }, [tab, aturanAktif, qAktif]);

  const totalHalaman = halaman
    ? Math.max(1, Math.ceil(halaman.total / halaman.pageSize))
    : 1;

  const bisaDipilih = useMemo(
    () => (halaman?.items ?? []).filter((i) => !i.terkunci),
    [halaman],
  );
  const semuaTercentang =
    bisaDipilih.length > 0 && bisaDipilih.every((i) => pilih.has(i.id));

  const toggle = (id: string) =>
    setPilih((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSemua = () =>
    setPilih((prev) => {
      const next = new Set(prev);
      if (semuaTercentang) bisaDipilih.forEach((i) => next.delete(i.id));
      else bisaDipilih.forEach((i) => next.add(i.id));
      return next;
    });

  /* ── Eksekusi ── */
  const perluKonfirmasi = aksi === "HAPUS";
  const konfirmasiSah = !perluKonfirmasi || konfirmasi.trim() === KATA_KONFIRMASI;

  // Tanpa tabel arsip, HAPUS dimatikan di layar — dan ditolak lagi di server.
  // Yang dimatikan hanya HAPUS: menghitung, meninjau, dan TARIK tidak
  // menyentuh arsip sama sekali dan tetap berguna di database seperti itu.
  const hapusMati = ringkasan?.arsipSiap === false;
  const aksiTerkunci = aksi === "HAPUS" && hapusMati;

  const kirim = async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/listings/pembersihan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, aksi, konfirmasi }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Pembersihan gagal.");
    return data as HasilPembersihan;
  };

  /**
   * Jalankan sampai habis, sepotong demi sepotong.
   *
   * Server memproses paling banyak beberapa ratus baris per panggilan lalu
   * melaporkan sisanya; di sinilah panggilan itu diulang. Berhenti kalau sisa
   * habis, atau kalau satu putaran tidak memproses apa pun — keadaan terakhir
   * berarti yang tersisa semuanya terkunci, dan mengulanginya hanya akan jadi
   * lingkaran tanpa ujung.
   */
  const jalankanAturan = async () => {
    if (!aturanAktif || !halaman) return;
    berhenti.current = false;

    const target = halaman.total;
    setProses({ aksi, target, selesai: 0, dilewati: [], berjalan: true });

    let selesai = 0;
    const dilewati: DilewatiPembersihan[] = [];

    try {
      for (;;) {
        const hasil = await kirim({ sumber: "ATURAN", aturan: aturanAktif });
        selesai += hasil.diproses;
        for (const d of hasil.dilewati) {
          if (!dilewati.some((x) => x.id === d.id)) dilewati.push(d);
        }
        setProses({ aksi, target, selesai, dilewati, berjalan: true });

        if (berhenti.current || hasil.sisa === 0 || hasil.diproses === 0) break;
      }

      setProses({ aksi, target, selesai, dilewati, berjalan: false });
      laporkan(selesai, dilewati.length);
    } catch (e) {
      setProses(null);
      toast.error(e instanceof Error ? e.message : "Pembersihan gagal.");
    }
  };

  const jalankanPilihan = async () => {
    const ids = Array.from(pilih);
    if (ids.length === 0) return;
    setProses({ aksi, target: ids.length, selesai: 0, dilewati: [], berjalan: true });

    try {
      const hasil = await kirim({
        sumber: "PILIHAN",
        ids,
        aturan: tab === "ATURAN" ? aturanAktif : undefined,
      });
      setProses({
        aksi,
        target: ids.length,
        selesai: hasil.diproses,
        dilewati: hasil.dilewati,
        berjalan: false,
      });
      setPilih(new Set());
      laporkan(hasil.diproses, hasil.dilewati.length);
    } catch (e) {
      setProses(null);
      toast.error(e instanceof Error ? e.message : "Pembersihan gagal.");
    }
  };

  const laporkan = (jumlah: number, jumlahDilewati: number) => {
    const kata = aksi === "HAPUS" ? "dihapus permanen" : "ditarik dari tayang";
    if (jumlah > 0) {
      toast.success(`${angka(jumlah)} listing ${kata}.`, {
        description:
          aksi === "HAPUS"
            ? "Salinan utuhnya tersimpan di tabel listing_dibersihkan."
            : "Barisnya tetap ada dan bisa ditayangkan lagi.",
      });
    } else {
      toast.info("Tidak ada baris yang diproses.");
    }
    if (jumlahDilewati > 0) {
      toast.warning(`${angka(jumlahDilewati)} listing dilewati.`, {
        description: "Punya lead, klien, project, atau MoU — lihat daftarnya di dialog.",
      });
    }
    setKonfirmasi("");
    void muat();
    onSelesai();
  };

  const sedangJalan = !!proses?.berjalan;
  // Keranjang "perlu ditinjau" tidak boleh dieksekusi sekaligus — isinya
  // sebagian properti asli yang luasnya tidak terbawa scraper. Servernya
  // menolaknya juga; ini supaya tombolnya tidak pernah menggoda.
  const aturanTerpilih = aturanAktif ? aturanById(aturanAktif) : undefined;
  const bolehMassal = tab === "ATURAN" && !aturanTerpilih?.tinjauManual;
  const jumlahAturan = (id: IdAturan) =>
    ringkasan?.aturan.find((a) => a.id === id)?.jumlah ?? 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-label="Pembersihan data listing"
        >
          <motion.div
            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            onClick={() => !sedangJalan && onClose()}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="relative flex h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#050b09]/98 shadow-[0_40px_120px_-24px_rgba(0,0,0,0.9)] sm:h-[86vh] sm:rounded-3xl"
          >
            {/* ── Kepala ── */}
            <header className="relative shrink-0 border-b border-white/5 px-5 py-4 sm:px-7 sm:py-5">
              <div className="pointer-events-none absolute -top-24 left-1/3 h-40 w-56 rounded-full bg-amber-500/10 blur-3xl" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Icon
                      icon="solar:broom-bold-duotone"
                      className="text-xl text-amber-300"
                    />
                    <h2 className="text-base font-black tracking-tight text-white sm:text-lg">
                      Pembersihan Data Listing
                    </h2>
                    <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">
                      Owner
                    </span>
                  </div>
                  <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-zinc-400">
                    Menyingkirkan baris yang bukan benda tidak bergerak —
                    kendaraan, mesin, hewan, komoditas, inventaris — dari{" "}
                    {angka(ringkasan?.totalListing ?? 0)} listing hasil scraping.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => !sedangJalan && onClose()}
                  disabled={sedangJalan}
                  aria-label="Tutup"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-zinc-400 transition-all hover:border-white/25 hover:text-white disabled:opacity-40"
                >
                  <Icon icon="solar:close-circle-linear" className="text-base" />
                </button>
              </div>

              {/* Tab */}
              <div className="relative mt-4 flex gap-1.5">
                {(
                  [
                    ["ATURAN", "Terdeteksi otomatis", "solar:shield-check-bold-duotone"],
                    ["CARI", "Cari manual", "solar:magnifer-linear"],
                  ] as const
                ).map(([id, label, ikon]) => (
                  <button
                    key={id}
                    type="button"
                    disabled={sedangJalan}
                    onClick={() => {
                      setTab(id);
                      setPage(1);
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-bold transition-all disabled:opacity-40 ${
                      tab === id
                        ? "border-amber-400/50 bg-amber-500/15 text-amber-100"
                        : "border-white/10 bg-white/5 text-zinc-400 hover:text-white"
                    }`}
                  >
                    <Icon icon={ikon} className="text-sm" />
                    {label}
                  </button>
                ))}
              </div>
            </header>

            {/* ── Isi ── */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-7">
              {ringkasan && !ringkasan.siap && (
                <PitaGalat
                  judul="Database ini belum siap"
                  pesan={ringkasan.pesan ?? ""}
                />
              )}

              {hapusMati && (
                <PitaGalat
                  judul="Hapus permanen dimatikan di database ini"
                  pesan={ringkasan?.pesanArsip ?? ""}
                />
              )}

              {tab === "ATURAN" ? (
                <div className="space-y-2.5">
                  {ATURAN_PEMBERSIHAN.map((a) => {
                    const aktif = aturanAktif === a.id;
                    const n = jumlahAturan(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        disabled={sedangJalan}
                        onClick={() => {
                          setAturanAktif(a.id);
                          setPage(1);
                        }}
                        className={`w-full rounded-2xl border p-3.5 text-left transition-all disabled:opacity-50 ${
                          aktif
                            ? "border-amber-400/50 bg-amber-500/10"
                            : "border-white/8 bg-white/[0.03] hover:border-white/20"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Icon
                            icon={a.ikon}
                            className={`mt-0.5 shrink-0 text-xl ${
                              aktif ? "text-amber-300" : "text-zinc-500"
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[13px] font-bold text-white">
                                {a.label}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                                  n > 0
                                    ? a.tinjauManual
                                      ? "bg-sky-500/20 text-sky-200"
                                      : "bg-amber-500/20 text-amber-200"
                                    : "bg-white/5 text-zinc-500"
                                }`}
                              >
                                {angka(n)} baris
                              </span>
                              {a.tinjauManual && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-300">
                                  <Icon icon="solar:hand-stars-bold" className="text-[10px]" />
                                  centang manual
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                              {a.ringkas}
                            </p>
                            {aktif && (
                              <p className="mt-2 rounded-xl border border-white/5 bg-black/30 p-2.5 text-[11px] leading-relaxed text-zinc-400">
                                {a.penjelasan}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Icon
                      icon="solar:magnifer-linear"
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-zinc-500"
                    />
                    <input
                      value={q}
                      disabled={sedangJalan}
                      onChange={(e) => setQ(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setQAktif(q);
                          setPage(1);
                        }
                      }}
                      placeholder='Kata di judul atau kota — mis. "sapi", "kotak suara", "batik"'
                      className="w-full rounded-2xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-24 text-[13px] text-white placeholder:text-zinc-600 focus:border-amber-400/50 focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={sedangJalan || q.trim().length < 2}
                      onClick={() => {
                        setQAktif(q);
                        setPage(1);
                      }}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-[11px] font-bold text-amber-100 disabled:opacity-40"
                    >
                      Cari
                    </button>
                  </div>
                  <p className="px-1 text-[11px] leading-relaxed text-zinc-500">
                    Di sini tidak ada &quot;hapus semua yang cocok&quot; — hanya
                    yang Anda centang. Kata kunci bisa mengenai properti asli
                    yang judulnya kebetulan mirip, jadi setiap baris diperiksa
                    sendiri.
                  </p>
                </div>
              )}

              {/* ── Daftar kandidat ── */}
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between gap-3 px-1">
                  <label className="flex cursor-pointer select-none items-center gap-2 text-[11px] text-zinc-400">
                    <input
                      type="checkbox"
                      checked={semuaTercentang}
                      disabled={sedangJalan || bisaDipilih.length === 0}
                      onChange={toggleSemua}
                      className="h-3.5 w-3.5 rounded border-white/20 bg-transparent accent-amber-400"
                    />
                    Pilih semua di halaman ini
                  </label>
                  <span className="text-[11px] text-zinc-500">
                    {halaman
                      ? `${angka(halaman.total)} baris cocok`
                      : memuat
                        ? "memuat…"
                        : "—"}
                    {pilih.size > 0 && (
                      <span className="ml-2 font-bold text-amber-300">
                        {angka(pilih.size)} dicentang
                      </span>
                    )}
                  </span>
                </div>

                {galat && <PitaGalat judul="Gagal memuat" pesan={galat} />}

                {memuat && !halaman ? (
                  <div className="grid place-items-center rounded-2xl border border-white/5 bg-white/[0.02] py-16 text-xs text-zinc-500">
                    Memuat kandidat…
                  </div>
                ) : !halaman || halaman.items.length === 0 ? (
                  <div className="grid place-items-center gap-2 rounded-2xl border border-white/5 bg-white/[0.02] py-16 text-center">
                    <Icon
                      icon="solar:confetti-minimalistic-bold-duotone"
                      className="text-3xl text-emerald-400/40"
                    />
                    <p className="text-xs text-zinc-500">
                      {tab === "CARI" && qAktif.trim().length < 2
                        ? "Ketik kata kunci lalu tekan Cari."
                        : "Tidak ada baris yang cocok. Bersih."}
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-1.5">
                    {halaman.items.map((it) => {
                      const dicentang = pilih.has(it.id);
                      return (
                        <li
                          key={it.id}
                          className={`flex items-start gap-3 rounded-2xl border p-3 transition-colors ${
                            it.terkunci
                              ? "border-white/5 bg-white/[0.02] opacity-60"
                              : dicentang
                                ? "border-amber-400/40 bg-amber-500/10"
                                : "border-white/8 bg-white/[0.03]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={dicentang}
                            disabled={!!it.terkunci || sedangJalan}
                            onChange={() => toggle(it.id)}
                            className="mt-1 h-3.5 w-3.5 shrink-0 rounded border-white/20 bg-transparent accent-amber-400 disabled:opacity-30"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-[12px] font-semibold leading-snug text-zinc-100">
                              {it.judul}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-zinc-500">
                              <span className="font-mono">#{it.id}</span>
                              <span>{it.kategori}</span>
                              <span>{it.jenisTransaksi}</span>
                              {it.kota && <span>{it.kota}</span>}
                              {it.harga && (
                                <span className="font-semibold text-zinc-400">
                                  {formatRupiahRingkas(Number(it.harga))}
                                </span>
                              )}
                              <span>
                                LT {it.luasTanah ?? "–"} / LB{" "}
                                {it.luasBangunan ?? "–"}
                              </span>
                            </div>
                            {it.terkunci ? (
                              <p className="mt-1.5 inline-flex items-center gap-1 rounded-lg border border-sky-400/25 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-200">
                                <Icon icon="solar:lock-keyhole-bold" className="text-[11px]" />
                                Tidak bisa dihapus — {it.terkunci}
                              </p>
                            ) : (
                              it.catatan && (
                                <p className="mt-1.5 inline-flex items-center gap-1 rounded-lg border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-200/90">
                                  <Icon icon="solar:danger-triangle-bold" className="text-[11px]" />
                                  {it.catatan}
                                </p>
                              )
                            )}
                          </div>
                          <a
                            href={`/tambah-property?id=${it.id}&mode=edit`}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold text-zinc-300 transition-colors hover:text-white"
                          >
                            Lihat
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {halaman && totalHalaman > 1 && (
                  <div className="mt-3 flex items-center justify-center gap-2 text-[11px]">
                    <button
                      type="button"
                      disabled={page === 1 || memuat || sedangJalan}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-zinc-300 disabled:opacity-40"
                    >
                      Sebelumnya
                    </button>
                    <span className="text-zinc-500">
                      {page} / {angka(totalHalaman)}
                    </span>
                    <button
                      type="button"
                      disabled={page >= totalHalaman || memuat || sedangJalan}
                      onClick={() => setPage((p) => p + 1)}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-zinc-300 disabled:opacity-40"
                    >
                      Berikutnya
                    </button>
                  </div>
                )}
              </div>

              {/* ── Laporan baris yang dilewati ── */}
              {proses && proses.dilewati.length > 0 && (
                <div className="mt-5 rounded-2xl border border-sky-400/20 bg-sky-500/5 p-3.5">
                  <p className="text-[11px] font-bold text-sky-200">
                    {angka(proses.dilewati.length)} listing dilewati — masih
                    terpakai di tempat lain
                  </p>
                  <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto">
                    {proses.dilewati.slice(0, 40).map((d) => (
                      <li key={d.id} className="text-[10px] text-sky-100/70">
                        <span className="font-mono">#{d.id}</span> {d.judul} —{" "}
                        <span className="text-sky-300/80">{d.alasan}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* ── Kaki: aksi ── */}
            <footer className="shrink-0 space-y-3 border-t border-white/5 bg-black/40 px-5 py-4 sm:px-7">
              {proses && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className={proses.berjalan ? "text-amber-200" : "text-emerald-300"}>
                      {proses.berjalan
                        ? `Memproses… ${angka(proses.selesai)} dari ${angka(proses.target)}`
                        : `Selesai — ${angka(proses.selesai)} listing ${
                            proses.aksi === "HAPUS" ? "dihapus" : "ditarik"
                          }`}
                    </span>
                    <span className="text-zinc-500">
                      {Math.min(
                        100,
                        Math.round(
                          (proses.selesai / Math.max(1, proses.target)) * 100,
                        ),
                      )}
                      %
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                    <div
                      className={`h-full rounded-full transition-[width] duration-300 ${
                        proses.berjalan ? "bg-amber-400" : "bg-emerald-400"
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          (proses.selesai / Math.max(1, proses.target)) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {/* Pilihan aksi. TARIK ada di kiri dan bukan bawaan: ia jalan
                    tengah untuk baris yang belum diyakini, bukan tujuan utama
                    panel ini. */}
                <div className="flex rounded-xl border border-white/10 bg-white/5 p-0.5">
                  {(
                    [
                      ["HAPUS", "Hapus permanen"],
                      ["TARIK", "Tarik dari tayang"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      disabled={sedangJalan || (id === "HAPUS" && hapusMati)}
                      title={
                        id === "HAPUS" && hapusMati
                          ? "Tabel arsip belum ada di database ini."
                          : undefined
                      }
                      onClick={() => setAksi(id)}
                      className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors disabled:opacity-40 ${
                        aksi === id
                          ? id === "HAPUS"
                            ? "bg-red-500/20 text-red-200"
                            : "bg-amber-500/20 text-amber-100"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {perluKonfirmasi && (
                  <input
                    value={konfirmasi}
                    disabled={sedangJalan}
                    onChange={(e) => setKonfirmasi(e.target.value)}
                    placeholder={`Ketik ${KATA_KONFIRMASI}`}
                    className={`w-44 rounded-xl border bg-black/40 px-3 py-1.5 text-[11px] font-bold tracking-wide text-white placeholder:font-normal placeholder:tracking-normal placeholder:text-zinc-600 focus:outline-none ${
                      konfirmasiSah
                        ? "border-emerald-400/50"
                        : "border-red-400/30"
                    }`}
                  />
                )}

                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={
                      sedangJalan ||
                      pilih.size === 0 ||
                      !konfirmasiSah ||
                      aksiTerkunci
                    }
                    onClick={jalankanPilihan}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-bold text-zinc-200 transition-all hover:bg-white/10 disabled:opacity-30"
                  >
                    <Icon icon="solar:check-square-bold-duotone" className="text-sm" />
                    {aksi === "HAPUS" ? "Hapus" : "Tarik"} {angka(pilih.size)} terpilih
                  </button>

                  {/* Menghentikan yang sedang berjalan. Bukan "batal": yang
                      sudah terhapus tetap terhapus — ia berhenti di batas
                      potongan berikutnya, dan itulah yang dijanjikan
                      labelnya. */}
                  {sedangJalan && (
                    <button
                      type="button"
                      onClick={() => {
                        berhenti.current = true;
                        toast.info("Berhenti setelah potongan ini selesai.");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-[11px] font-bold text-white"
                    >
                      <Icon icon="solar:stop-circle-bold-duotone" className="text-sm" />
                      Hentikan
                    </button>
                  )}

                  {bolehMassal && (
                    <button
                      type="button"
                      disabled={
                        sedangJalan ||
                        !konfirmasiSah ||
                        !halaman ||
                        halaman.total === 0 ||
                        aksiTerkunci
                      }
                      onClick={jalankanAturan}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-[11px] font-black transition-all disabled:opacity-30 ${
                        aksi === "HAPUS"
                          ? "border-red-400/50 bg-red-500/20 text-red-100 hover:bg-red-500/30"
                          : "border-amber-400/50 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30"
                      }`}
                    >
                      <Icon
                        icon={
                          sedangJalan
                            ? "svg-spinners:ring-resize"
                            : "solar:broom-bold-duotone"
                        }
                        className="text-sm"
                      />
                      {aksi === "HAPUS" ? "Hapus" : "Tarik"} semua{" "}
                      {angka(halaman?.total ?? 0)}
                    </button>
                  )}
                </div>
              </div>

              {tab === "ATURAN" && aturanTerpilih?.tinjauManual && (
                <p className="rounded-xl border border-sky-400/25 bg-sky-500/10 px-3 py-2 text-[10px] leading-relaxed text-sky-100/80">
                  Keranjang ini sengaja tanpa tombol &quot;semua&quot;. Buka
                  yang ragu lewat tombol Lihat; kalau ternyata properti asli,
                  isi luasnya di form edit — database akan berhenti menandainya
                  bukan properti dengan sendirinya.
                </p>
              )}

              <p className="text-[10px] leading-relaxed text-zinc-500">
                {aksi === "HAPUS" ? (
                  <>
                    Baris yang dihapus <b className="text-zinc-400">disalin utuh</b> ke
                    tabel <code className="text-zinc-400">listing_dibersihkan</code> lebih
                    dulu, dalam transaksi yang sama — masih bisa dipulihkan lewat SQL.
                    Listing yang punya lead, klien, project, MoU, tugas, acara,
                    atau booking survei dilewati otomatis.
                  </>
                ) : (
                  <>
                    Barisnya tetap ada; hanya status tayangnya jadi TARIK_LISTING
                    dan tercatat di riwayat status. Bisa dikembalikan kapan saja.
                  </>
                )}
              </p>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PitaGalat({ judul, pesan }: { judul: string; pesan: string }) {
  return (
    <div className="mb-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-3.5">
      <p className="flex items-center gap-1.5 text-[11px] font-bold text-red-200">
        <Icon icon="solar:danger-triangle-bold" className="text-sm" />
        {judul}
      </p>
      <p className="mt-1 break-words font-mono text-[10px] leading-relaxed text-red-100/70">
        {pesan}
      </p>
    </div>
  );
}
