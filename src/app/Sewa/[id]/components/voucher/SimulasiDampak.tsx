"use client";

/**
 * "Kalau voucher ini dipakai, angkanya jadi berapa?"
 *
 * ── KENAPA BLOK INI ADA ───────────────────────────────────────────────────
 * Pemilik tidak berpikir dalam persen; dia berpikir dalam rupiah yang masuk ke
 * rekeningnya. "Diskon 15%" terdengar wajar sampai ditulis sebagai angka: pada
 * kos Rp 1.200.000/bulan untuk sewa 6 bulan, itu Rp 1.080.000 yang tidak jadi
 * diterima. Selisih antara kedua cara membaca angka yang sama itulah sumber
 * promo yang disesali seminggu kemudian — dan satu-satunya cara mencegahnya
 * adalah menulis rupiahnya SEBELUM tombol simpan ditekan.
 *
 * Angkanya memakai HARGA LISTING YANG SEBENARNYA, bukan contoh karangan.
 * Contoh karangan hanya melatih pemilik mengabaikan blok ini.
 *
 * ── APA YANG SENGAJA TIDAK IKUT DINILAI ───────────────────────────────────
 * Jadwal, kuota, dan sakelar aktif dilucuti sebelum disimulasikan. Ketiganya
 * menentukan KAPAN voucher ditawarkan, bukan berapa potongannya — dan tanpa
 * pelucutan itu, promo yang dijadwalkan bulan depan akan menjawab "Berlaku
 * mulai 1 Sep" di tempat yang seharusnya berisi angka. Yang tetap dinilai
 * hanya syarat yang memang mengubah hitungan: durasi, lama sewa minimum, dan
 * minimal transaksi.
 */

import React, { useState } from "react";
import { Icon } from "@iconify/react";

import { AKSEN, SURFACE } from "../sewaTheme";
import {
  DURASI_META,
  formatRupiah,
  type DurasiKey,
  type TipeKamarView,
} from "@/lib/kosDetail";
import {
  pilihanLamaSimulasi,
  simulasiVoucher,
  type InputVoucher,
  type Voucher,
} from "@/lib/voucher";

interface Props {
  input: InputVoucher;
  /** Harga listing per durasi. Nilai 0/kosong = durasi itu tidak dijual. */
  hargaDurasi: Partial<Record<DurasiKey, number>>;
  durasiTersedia: DurasiKey[];
  durasiUtama: DurasiKey;
  /** Tipe kamar listing ini; kosong pada unit tunggal. */
  tipeList: TipeKamarView[];
}

export default function SimulasiDampak({
  input,
  hargaDurasi,
  durasiTersedia,
  durasiUtama,
  tipeList,
}: Props) {
  /**
   * Durasi yang disimulasikan.
   *
   * Diambil dari syarat vouchernya sendiri kalau ada — mensimulasikan promo
   * "khusus tahunan" pada sewa bulanan hanya akan menampilkan penolakan di
   * tempat yang seharusnya berisi angka.
   */
  const durasiKandidat =
    input.durasiBerlaku.filter((d) => durasiTersedia.includes(d))[0] ??
    (durasiTersedia.includes(durasiUtama) ? durasiUtama : durasiTersedia[0]) ??
    durasiUtama;

  const opsiLama = pilihanLamaSimulasi(input, durasiKandidat);

  /**
   * Lama sewa yang disimulasikan — TURUNAN dengan kemungkinan ditimpa, bukan
   * state biasa.
   *
   * Bedanya terasa begitu pemilik mengubah "minimal lama sewa" sesudah menekan
   * salah satu chip: daftar chip ikut berubah, dan angka yang dipilih tadi bisa
   * saja sudah tidak ada di dalamnya. State biasa akan menyisakan simulasi pada
   * angka yang chip-nya sendiri sudah hilang — tidak ada satu pun tombol yang
   * terlihat menyala, dan tidak ada cara mengembalikannya selain menebak.
   *
   * Titik awalnya = syarat minimumnya kalau ada, karena di situlah voucher
   * pertama kali cair. Membuka simulasi pada 1 periode untuk voucher bersyarat
   * "minimal 6 bulan" berarti angka pertama yang dilihat pemilik selalu nol.
   */
  const [lamaDipilih, setLama] = useState<number | null>(null);
  const lamaBawaan =
    input.lamaMin && input.lamaMin > 1 ? input.lamaMin : (opsiLama[0] ?? 1);
  const lama =
    lamaDipilih != null && opsiLama.includes(lamaDipilih)
      ? lamaDipilih
      : lamaBawaan;

  /**
   * Harga acuan simulasi.
   *
   * Voucher yang dibatasi ke tipe tertentu HARUS disimulasikan dengan harga
   * tipe itu, bukan harga agregat listing. Kos menjual Standard Rp 900rb dan
   * Deluxe Rp 1,8jt di bawah satu listing; memakai angka agregat pada promo
   * "khusus Standard" menghasilkan simulasi yang meleset hampir dua kali lipat
   * — dan itu persis angka yang dipakai pemilik memutuskan besar potongannya.
   *
   * Kalau beberapa tipe dipilih sekaligus, yang dipakai yang TERMAHAL: di
   * situlah potongan persen menggigit paling dalam, dan simulasi yang berguna
   * bagi pemilik adalah yang menunjukkan kemungkinan terburuknya.
   */
  const tipeDipilih = tipeList.filter((t) => input.tipeBerlaku.includes(t.id));
  const tipeTermahal = tipeDipilih.reduce<TipeKamarView | null>(
    (juara, t) =>
      !juara || (t.harga[durasiKandidat] ?? 0) > (juara.harga[durasiKandidat] ?? 0)
        ? t
        : juara,
    null,
  );
  const hargaTipe = tipeTermahal?.harga[durasiKandidat] ?? 0;
  const harga = hargaTipe > 0 ? hargaTipe : (hargaDurasi[durasiKandidat] ?? 0);
  const satuan = DURASI_META[durasiKandidat].satuan;

  /** Asumsi harga disebutkan, tidak disembunyikan — angka tanpa asumsinya
   *  hanya memindahkan salah paham ke tempat lain. */
  const labelAcuan =
    hargaTipe > 0 && tipeTermahal
      ? tipeDipilih.length === 1
        ? `tipe ${tipeTermahal.nama}`
        : `tipe termahal, ${tipeTermahal.nama}`
      : null;

  /**
   * Voucher semu untuk mesin hitung. Jadwal, kuota & sakelar dilucuti — lihat
   * catatan kepala berkas.
   */
  const semu: Voucher = {
    id: "",
    ...input,
    deskripsi: input.deskripsi ?? "",
    durasiBerlaku: input.durasiBerlaku.length ? input.durasiBerlaku : null,
    berlakuMulai: null,
    berlakuSampai: null,
    kuotaTotal: null,
    kuotaTerpakai: 0,
    aktif: true,
  };

  const hasil = simulasiVoucher(semu, harga, durasiKandidat, lama);

  const lamaTerbesar = opsiLama[opsiLama.length - 1] ?? lama;

  return (
    <div
      className="overflow-hidden rounded-2xl border border-white/[0.08]"
      style={{ background: SURFACE.raised }}
    >
      {/* ── Pemilih lama sewa ── */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-3.5 py-2.5">
        <span className="shrink-0 text-[9.5px] font-black uppercase tracking-[0.12em] text-white/60">
          Sewa
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap justify-end gap-1">
          {opsiLama.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setLama(n)}
              aria-pressed={lama === n}
              className={`rounded-lg border px-2 py-1 text-[10.5px] font-bold tabular-nums transition-colors motion-reduce:transition-none ${
                lama === n
                  ? AKSEN.mint.chip
                  : "border-white/[0.08] text-white/65 hover:border-white/30 hover:text-white"
              }`}
            >
              {n} {satuan}
            </button>
          ))}
        </div>
      </div>

      {harga <= 0 ? (
        // Harga kosong bukan galat: listing memang boleh tidak menjual durasi
        // itu. Yang salah adalah menampilkan "Rp 0 → Rp 0" seolah itu hasil
        // perhitungan.
        <div className="px-3.5 py-4">
          <p className="flex items-start gap-2 text-[11px] leading-relaxed text-white/65">
            <Icon
              icon="solar:info-circle-bold-duotone"
              className={`mt-px shrink-0 text-sm ${AKSEN.amber.ikon}`}
            />
            Harga sewa {DURASI_META[durasiKandidat].label.toLowerCase()} belum
            diisi di listing ini, jadi angkanya belum bisa dihitung. Vouchernya
            tetap bisa disimpan.
          </p>
        </div>
      ) : (
        <div className="px-3.5 py-3">
          <Baris
            label={`Total sewa ${lama} ${satuan}${labelAcuan ? ` · ${labelAcuan}` : ""}`}
            nilai={formatRupiah(hasil.subtotal)}
          />
          <Baris
            label="Potongan voucher"
            nilai={hasil.potongan > 0 ? `−${formatRupiah(hasil.potongan)}` : "—"}
            nada={hasil.potongan > 0 ? AKSEN.mint.teks : "text-white/50"}
          />

          <div className="my-2 border-t border-dashed border-white/[0.1]" />

          <div className="flex items-end justify-between gap-3">
            <span className="text-[11px] font-bold text-white/80">
              Penyewa membayar
            </span>
            <span className="text-[1.05rem] font-black tracking-[-0.01em] tabular-nums text-white">
              {formatRupiah(hasil.bayar)}
            </span>
          </div>

          {/* Syarat yang belum terpenuhi ditulis sebagai KETERANGAN, bukan
              galat: pemilik memang sengaja memasangnya, dan blok ini hanya
              memberitahu di titik mana syarat itu mulai menggigit. */}
          {!hasil.berlaku && hasil.alasan && (
            <p className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-white/[0.03] px-2.5 py-2 text-[10.5px] leading-relaxed text-white/65">
              <Icon
                icon="solar:lock-keyhole-minimalistic-bold-duotone"
                className="mt-px shrink-0 text-xs text-white/50"
              />
              Belum cair di sini — {hasil.alasan.toLowerCase()}.
            </p>
          )}

          {hasil.berlaku && (
            <p className="mt-2.5 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-white/60">
              <Icon
                icon="solar:hand-money-bold-duotone"
                className="mt-px shrink-0 text-xs text-white/45"
              />
              Anda menanggung {formatRupiah(hasil.potongan)}
              {hasil.persen > 0 && ` — setara ${hasil.persen}% dari nilai sewanya`}
              {lama !== lamaTerbesar &&
                `. Pada sewa ${lamaTerbesar} ${satuan}, angkanya jadi ${formatRupiah(
                  simulasiVoucher(semu, harga, durasiKandidat, lamaTerbesar).potongan,
                )}`}
              .
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Baris({
  label,
  nilai,
  nada = "text-white/85",
}: {
  label: string;
  nilai: string;
  nada?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="min-w-0 truncate text-[11px] font-semibold text-white/65">
        {label}
      </span>
      <span className={`shrink-0 text-[12px] font-bold tabular-nums ${nada}`}>
        {nilai}
      </span>
    </div>
  );
}
