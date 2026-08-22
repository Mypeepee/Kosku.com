"use client";

/**
 * Drawer "Kelola Voucher" — tempat pemegang listing membuat promo untuk
 * ASETNYA SENDIRI, tanpa membuka wizard edit properti.
 *
 * Ditaruh di atas halaman detail dengan alasan yang sama seperti Kelola
 * Ketersediaan: pekerjaannya bersifat "lihat lalu ubah". Pemilik membuka
 * listingnya, melihat kamarnya sepi sebulan terakhir, dan ingin memasang
 * potongan di detik itu juga. Memindahkannya ke halaman dashboard berarti
 * kehilangan konteks yang justru memicu tindakannya.
 *
 * ── SATU MODAL, TIGA LAYAR ────────────────────────────────────────────────
 *   daftar → preset → form
 *
 * Bukan tiga modal bertumpuk: menyunting voucher hampir selalu diikuti melihat
 * hasilnya di daftar, dan tumpukan modal membuat tombol "kembali" berarti dua
 * hal berbeda tergantung kedalaman.
 *
 * Layar PRESET disisipkan di antara keduanya, dan itu keputusan produk yang
 * paling menentukan di panel ini — lihat catatan di ./voucher/GaleriPreset.tsx.
 * Ia hanya lewat saat MEMBUAT; menyunting voucher yang sudah ada langsung
 * membuka form, karena bentuknya sudah ditentukan sejak dulu.
 *
 * ── APA YANG TIDAK ADA DI BERKAS INI ──────────────────────────────────────
 * Tidak ada satu pun aturan voucher. Sah atau tidaknya diputuskan
 * `validasiVoucher`, statusnya oleh `statusVoucher`, potongannya oleh
 * `evaluasiVoucher` — semuanya di @/lib/voucher, fungsi yang SAMA PERSIS
 * dipanggil API sebelum menyimpan. Cangkang ini hanya mengatur perpindahan
 * layar, pemuatan, dan penyimpanan.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";

import { AKSEN, LINE, SURFACE } from "./sewaTheme";
import KartuKelola, { type StatistikVoucher } from "./voucher/KartuKelola";
import GaleriPreset from "./voucher/GaleriPreset";
import KosongVoucher from "./voucher/KosongVoucher";
import FormVoucher from "./voucher/FormVoucher";
import { useSeretTutup } from "../lib/useSeretTutup";
import type { DurasiKey, TipeKamarView } from "@/lib/kosDetail";
import {
  KOSONG_VOUCHER,
  keInputVoucher,
  presetVoucher,
  ringkasRupiah,
  statusVoucher,
  validasiVoucher,
  type InputVoucher,
  type PresetVoucher,
  type StatusVoucher,
  type Voucher,
} from "@/lib/voucher";

interface Props {
  buka: boolean;
  onTutup: () => void;
  idProperty: string;
  /** Durasi yang benar-benar ditawarkan listing ini. */
  durasiTersedia: DurasiKey[];
  /** Harga listing per durasi — dipakai simulasi & usulan angka preset. */
  hargaDurasi: Partial<Record<DurasiKey, number>>;
  durasiUtama: DurasiKey;
  /**
   * Tipe kamar listing ini. Kosong pada unit tunggal (rumah/ruko/apartemen),
   * dan di situ seluruh pilihan "khusus tipe" memang tidak dirender — bukan
   * dirender dalam keadaan mati.
   */
  tipeList: TipeKamarView[];
  /** Dipanggil setiap kali ada perubahan tersimpan. */
  onBerubah: () => void;
}

type Layar =
  | { jenis: "daftar" }
  | { jenis: "preset" }
  | { jenis: "form"; sunting: Voucher | null };

/** Urutan kelompok di daftar — dari yang paling butuh perhatian ke arsip. */
const KELOMPOK: {
  judul: string;
  catatan: string;
  status: StatusVoucher[];
}[] = [
  {
    judul: "Sedang berjalan",
    catatan: "Ditawarkan ke calon penyewa sekarang juga",
    status: ["AKTIF"],
  },
  {
    judul: "Terjadwal",
    catatan: "Sudah siap, menunggu tanggal mulainya",
    status: ["TERJADWAL"],
  },
  {
    judul: "Tidak berjalan",
    catatan: "Dimatikan, kedaluwarsa, atau kuotanya habis",
    status: ["NONAKTIF", "KEDALUWARSA", "HABIS"],
  },
];

export default function KelolaVoucher({
  buka,
  onTutup,
  idProperty,
  durasiTersedia,
  hargaDurasi,
  durasiUtama,
  tipeList,
  onBerubah,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [layar, setLayar] = useState<Layar>({ jenis: "daftar" });

  const [daftar, setDaftar] = useState<Voucher[]>([]);
  const [statistik, setStatistik] = useState<Record<string, StatistikVoucher>>({});
  const [memuat, setMemuat] = useState(true);
  const [galatMuat, setGalatMuat] = useState("");

  const [input, setInput] = useState<InputVoucher>(KOSONG_VOUCHER);
  const [galat, setGalat] = useState("");
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => setMounted(true), []);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalatMuat("");
    try {
      const res = await fetch(`/api/listings/${idProperty}/voucher?kelola=1`);
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        // `detail` hanya dikirim rutenya di luar produksi — lihat
        // `galatInternal` di api/listings/[id]/voucher/route.ts. Di sanalah
        // sebab sesungguhnya berada; "Internal error" saja tidak pernah cukup
        // untuk siapa pun yang sedang memperbaiki halaman ini.
        setGalatMuat(
          json?.detail
            ? `${json.error ?? "Gagal memuat voucher."} — ${json.detail}`
            : json?.error || "Gagal memuat voucher.",
        );
        setDaftar([]);
        setStatistik({});
      } else {
        setDaftar(json.vouchers ?? []);
        setStatistik(json.statistik ?? {});
      }
    } catch {
      setGalatMuat("Koneksi gagal. Periksa jaringan Anda.");
    } finally {
      setMemuat(false);
    }
  }, [idProperty]);

  /**
   * Mundur satu layar. Dipakai tombol kembali, tombol Esc, DAN ketukan pada
   * latar gelap.
   *
   * Ketiganya sengaja disamakan: di layar form ada isian yang belum tersimpan,
   * dan menutup seluruh drawer karena ibu jari menyenggol tepi layar adalah
   * cara paling sepele untuk kehilangan promo yang baru selesai disusun.
   * Dari layar daftar tidak ada apa pun yang bisa hilang, jadi di sanalah
   * ketiganya benar-benar menutup.
   */
  const mundur = useCallback(() => {
    setLayar((l) => {
      if (l.jenis === "daftar") {
        onTutup();
        return l;
      }
      // Form yang dibuka dari galeri kembali ke galeri; form penyuntingan
      // kembali ke daftar, karena bentuk vouchernya memang tidak sedang dipilih.
      if (l.jenis === "form" && !l.sunting) return { jenis: "preset" };
      return { jenis: "daftar" };
    });
    setGalat("");
  }, [onTutup]);

  /**
   * `mundur` versi ref, KHUSUS untuk pendengar tombol Esc.
   *
   * Tanpa ini, `mundur` harus ikut jadi dependency efek di bawah — dan ia
   * berubah identitas setiap kali induknya me-render ulang, karena `onTutup`
   * yang dikirim DetailClient adalah arrow function sebaris. Akibatnya efek
   * pembuka drawer berjalan lagi di setiap render induk: layar dilempar balik
   * ke daftar dan katalog voucher diambil ulang dari jaringan, tepat di
   * tengah pemilik mengisi form.
   */
  const mundurRef = useRef(mundur);
  mundurRef.current = mundur;

  /** Seret-ke-bawah menutup drawer — jalan yang sama dengan Esc & latar gelap,
   *  jadi ia pun mundur satu layar, bukan membuang isian form yang sedang
   *  disusun. */
  const seret = useSeretTutup(() => mundurRef.current());

  useEffect(() => {
    if (!buka) return;
    setLayar({ jenis: "daftar" });
    setGalat("");
    muat();

    const asal = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") mundurRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = asal;
      document.removeEventListener("keydown", onKey);
    };
  }, [buka, muat]);

  // ── Turunan ────────────────────────────────────────────────────────────────

  const preset = useMemo(
    () =>
      presetVoucher(hargaDurasi[durasiUtama] ?? 0, durasiUtama, durasiTersedia),
    [hargaDurasi, durasiUtama, durasiTersedia],
  );

  /**
   * id tipe → nama, untuk kalimat sebab & pill syarat.
   *
   * Dibangun di sini, bukan dikirim API bersama vouchernya: nama tipe boleh
   * diubah pemiliknya kapan saja, dan yang harus dibaca adalah nama yang
   * sedang tampil di kartu tipe — bukan nama saat vouchernya dulu dibuat.
   */
  const namaTipe = useMemo(
    () => Object.fromEntries(tipeList.map((t) => [t.id, t.nama])),
    [tipeList],
  );

  /** Tiga pintasan untuk keadaan kosong. "Mulai dari kosong" dibuang — di
   *  layar yang belum punya apa-apa, pintasan menuju form kosong tidak
   *  menghemat apa pun dibanding tombol besar di bawahnya. */
  const pintasan = useMemo(
    () => preset.filter((p) => p.id !== "kosong").slice(0, 3),
    [preset],
  );

  /**
   * Voucher dikelompokkan per STATUS TERHITUNG, bukan per kolom `aktif`.
   *
   * Kolom `aktif` hanya berarti pemiliknya belum mematikannya; voucher yang
   * kedaluwarsa & yang kuotanya habis tetap `aktif = true` di DB, dan
   * mengelompokkan dengannya akan menaruh tiga promo mati di bawah judul
   * "Sedang berjalan".
   */
  const kelompok = useMemo(() => {
    const sekarang = new Date();
    return KELOMPOK.map((k) => ({
      ...k,
      isi: daftar.filter((v) =>
        k.status.includes(statusVoucher(v, sekarang).status),
      ),
    })).filter((k) => k.isi.length > 0);
  }, [daftar]);

  const ringkasan = useMemo(() => {
    const sekarang = new Date();
    let aktif = 0;
    let dipakai = 0;
    let potongan = 0;
    for (const v of daftar) {
      if (statusVoucher(v, sekarang).status === "AKTIF") aktif += 1;
      const s = statistik[v.id];
      dipakai += s?.dipakai ?? 0;
      potongan += s?.totalPotongan ?? 0;
    }
    return { aktif, dipakai, potongan };
  }, [daftar, statistik]);

  if (!mounted || !buka) return null;

  // ── Aksi ───────────────────────────────────────────────────────────────────

  const bukaForm = (v: Voucher | null) => {
    setInput(v ? keInputVoucher(v) : KOSONG_VOUCHER);
    setGalat("");
    setLayar({ jenis: "form", sunting: v });
  };

  const pakaiPreset = (p: PresetVoucher) => {
    setInput({ ...KOSONG_VOUCHER, ...p.isi });
    setGalat("");
    setLayar({ jenis: "form", sunting: null });
  };

  const ubah = <K extends keyof InputVoucher>(k: K, v: InputVoucher[K]) => {
    setInput((p) => ({ ...p, [k]: v }));
    // Galat dibersihkan pada sentuhan pertama, bukan saat isian yang disebut
    // galat itu diperbaiki: pesan yang bertahan sesudah pemilik mulai mengetik
    // terbaca sebagai penolakan terhadap yang sedang diketiknya.
    setGalat("");
  };

  const sunting = layar.jenis === "form" ? layar.sunting : null;

  const simpan = async () => {
    // Divalidasi di klien lebih dulu HANYA untuk kecepatan balasan — server
    // memvalidasi ulang dengan fungsi yang sama, dan itulah yang mengikat.
    const pesan = validasiVoucher(input, sunting?.kuotaTerpakai ?? 0);
    if (pesan) return setGalat(pesan);

    setMenyimpan(true);
    setGalat("");
    try {
      const res = await fetch(`/api/listings/${idProperty}/voucher`, {
        method: sunting ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sunting ? { ...input, id: sunting.id } : input),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setGalat(json?.error || "Gagal menyimpan voucher.");
        return;
      }
      await muat();
      onBerubah();
      setLayar({ jenis: "daftar" });
    } catch {
      setGalat("Koneksi gagal. Periksa jaringan Anda.");
    } finally {
      setMenyimpan(false);
    }
  };

  const hapus = async () => {
    if (!sunting) return;
    setMenyimpan(true);
    try {
      const res = await fetch(
        `/api/listings/${idProperty}/voucher?voucher=${encodeURIComponent(sunting.id)}`,
        { method: "DELETE" },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setGalat(json?.error || "Gagal menghapus voucher.");
        return;
      }
      await muat();
      onBerubah();
      setLayar({ jenis: "daftar" });
    } catch {
      setGalat("Koneksi gagal. Periksa jaringan Anda.");
    } finally {
      setMenyimpan(false);
    }
  };

  // ── Layar: daftar ──────────────────────────────────────────────────────────

  const isiDaftar = (
    <>
      <div className="custom-scrollbar flex-1 overflow-y-auto px-5 pb-4">
        {/* ── Ringkasan ──
            Tiga angka yang menjawab satu-satunya pertanyaan yang membuat
            pemilik kembali ke panel ini: promo saya jalan atau tidak. Hanya
            muncul kalau memang ada vouchernya — tiga nol besar di panel kosong
            terbaca sebagai kegagalan, bukan sebagai awal. */}
        {!memuat && daftar.length > 0 && (
          <div
            className="mb-4 grid grid-cols-3 divide-x divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.08]"
            style={{ background: SURFACE.raised }}
          >
            <Angka label="Berjalan" nilai={String(ringkasan.aktif)} />
            <Angka label="Dipakai" nilai={`${ringkasan.dipakai}×`} />
            <Angka
              label="Diberikan"
              nilai={
                ringkasan.potongan > 0 ? ringkasRupiah(ringkasan.potongan) : "—"
              }
              nada={ringkasan.potongan > 0 ? AKSEN.mint.teks : "text-white/45"}
            />
          </div>
        )}

        {memuat ? (
          <div className="space-y-2.5">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="h-[120px] animate-pulse rounded-2xl bg-white/[0.04] motion-reduce:animate-none"
              />
            ))}
          </div>
        ) : galatMuat ? (
          <div className={`rounded-2xl border border-rose-400/20 p-4 ${AKSEN.rose.wash}`}>
            <p className={`text-xs font-bold ${AKSEN.rose.teks}`}>{galatMuat}</p>
            <button
              onClick={muat}
              className="mt-2 text-[11px] font-bold text-white underline"
            >
              Coba lagi
            </button>
          </div>
        ) : daftar.length === 0 ? (
          <KosongVoucher
            preset={pintasan}
            onPilihPreset={pakaiPreset}
            onLihatSemua={() => setLayar({ jenis: "preset" })}
          />
        ) : (
          <div className="space-y-5">
            {kelompok.map((k) => (
              <section key={k.judul} className="bg-transparent">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.14em] text-white/70">
                    {k.judul}
                  </h4>
                  <span className="text-[10px] font-bold tabular-nums text-white/45">
                    {k.isi.length}
                  </span>
                </div>
                <p className="mb-2.5 text-[10.5px] leading-relaxed text-white/50">
                  {k.catatan}
                </p>
                <div className="space-y-2.5">
                  {k.isi.map((v) => (
                    <KartuKelola
                      key={v.id}
                      v={v}
                      statistik={statistik[v.id]}
                      namaTipe={namaTipe}
                      onBuka={() => bukaForm(v)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <div className="px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <button
          onClick={() => setLayar({ jenis: "preset" })}
          className="w-full rounded-2xl bg-[#86efac] py-3.5 text-sm font-extrabold text-black shadow-[0_10px_30px_-14px_rgba(134,239,172,0.9)] transition-all hover:bg-[#a7f3c4] active:scale-[0.98] motion-reduce:transition-none"
        >
          <span className="inline-flex items-center justify-center gap-2">
            <Icon icon="ic:round-plus" className="text-base" />
            Buat voucher
          </span>
        </button>
      </div>
    </>
  );

  // ── Layar: form ────────────────────────────────────────────────────────────

  const isiForm = (
    <>
      <FormVoucher
        input={input}
        ubah={ubah}
        sunting={sunting}
        statistik={sunting ? statistik[sunting.id] : undefined}
        durasiTersedia={durasiTersedia}
        hargaDurasi={hargaDurasi}
        durasiUtama={durasiUtama}
        tipeList={tipeList}
        namaTipe={namaTipe}
        galat={galat}
        menyimpan={menyimpan}
        onHapus={hapus}
      />

      <div
        className={`flex gap-2 border-t px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 ${LINE.row}`}
      >
        <button
          onClick={mundur}
          disabled={menyimpan}
          className="flex-1 rounded-2xl border border-white/[0.12] py-3.5 text-sm font-bold text-white transition-colors hover:bg-white/[0.06] disabled:opacity-40 motion-reduce:transition-none"
        >
          Kembali
        </button>
        <button
          onClick={simpan}
          disabled={menyimpan}
          className="flex-[2] rounded-2xl bg-[#86efac] py-3.5 text-sm font-extrabold text-black transition-all active:scale-[0.98] disabled:opacity-40 motion-reduce:transition-none"
        >
          {menyimpan ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Icon icon="solar:refresh-bold" className="animate-spin" />
              Menyimpan…
            </span>
          ) : sunting ? (
            "Simpan perubahan"
          ) : (
            "Terbitkan voucher"
          )}
        </button>
      </div>
    </>
  );

  // ── Kepala ─────────────────────────────────────────────────────────────────

  const judul =
    layar.jenis === "daftar"
      ? "Voucher listing ini"
      : layar.jenis === "preset"
        ? "Buat voucher"
        : sunting
          ? "Ubah voucher"
          : "Susun voucher";

  const subjudul =
    layar.jenis === "daftar"
      ? memuat
        ? "Memuat…"
        : // Gagal memuat DAHULU, sebelum daftar kosong diperiksa. Keduanya
          // sama-sama menghasilkan `daftar.length === 0`, dan mengumumkan
          // "belum ada promo terpasang" pada listing yang sebenarnya punya
          // sepuluh voucher — hanya karena satu permintaan gagal — adalah
          // kesalahan yang bisa membuat pemilik membuat ulang semuanya.
          galatMuat
          ? "Daftar gagal dimuat"
          : daftar.length === 0
            ? "Belum ada promo terpasang"
            : `${daftar.length} voucher · ${ringkasan.aktif} sedang berjalan`
      : layar.jenis === "preset"
        ? "Mau promo seperti apa?"
        : sunting
          ? `${sunting.kode} · dibuat untuk listing ini`
          : "Semua isian bisa diubah sebelum diterbitkan";

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Kelola voucher"
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={mundur} />

      <div
        className="relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[2rem] border border-white/10 shadow-2xl sm:max-h-[90dvh] sm:max-w-[540px] sm:rounded-[1.75rem]"
        style={{ background: SURFACE.modal, ...seret.gaya }}
      >
        {/* Pegangan + kepala bisa diseret ke bawah untuk menutup. Yang
            dipanggil `mundur`, BUKAN `onTutup` — aturannya sama persis dengan
            ketukan pada latar gelap: dari layar form, gestur ini mundur ke
            daftar dan isian yang belum tersimpan tetap utuh. */}
        <div {...seret.pegangan}>
          <div className="flex cursor-grab justify-center pt-3 active:cursor-grabbing sm:hidden">
            <span className="h-[3px] w-9 rounded-full bg-white/25" />
          </div>

          <div className="flex items-start justify-between gap-3 px-5 pb-4 pt-4">
            <div className="flex min-w-0 items-start gap-2.5">
              {layar.jenis !== "daftar" && (
                <button
                  onClick={mundur}
                  className="mt-0.5 shrink-0 rounded-full p-1 text-white/65 transition-colors hover:bg-white/10 hover:text-white motion-reduce:transition-none"
                  aria-label="Kembali"
                >
                  <Icon icon="solar:alt-arrow-left-linear" className="text-lg" />
                </button>
              )}
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 text-base font-extrabold text-white">
                  {layar.jenis === "daftar" && (
                    <Icon
                      icon="solar:ticket-sale-bold-duotone"
                      className={`text-xl ${AKSEN.mint.ikon}`}
                    />
                  )}
                  {judul}
                </h3>
                <p className="truncate text-[11px] font-semibold text-white/60">
                  {subjudul}
                </p>
              </div>
            </div>
            <button
              onClick={onTutup}
              className="shrink-0 rounded-full p-1.5 text-white/55 transition-colors hover:bg-white/10 hover:text-white motion-reduce:transition-none"
              aria-label="Tutup"
            >
              <Icon icon="solar:close-circle-bold" className="text-xl" />
            </button>
          </div>
        </div>

        {layar.jenis === "daftar"
          ? isiDaftar
          : layar.jenis === "preset"
            ? <GaleriPreset daftar={preset} onPilih={pakaiPreset} />
            : isiForm}
      </div>
    </div>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/** Satu sel di strip ringkasan. */
function Angka({
  label,
  nilai,
  nada = "text-white",
}: {
  label: string;
  nilai: string;
  nada?: string;
}) {
  return (
    <div className="px-3 py-3 text-center">
      <p className="text-[9.5px] font-black uppercase tracking-[0.12em] text-white/55">
        {label}
      </p>
      <p
        className={`mt-1 truncate text-[15px] font-black tracking-[-0.01em] tabular-nums ${nada}`}
      >
        {nilai}
      </p>
    </div>
  );
}
