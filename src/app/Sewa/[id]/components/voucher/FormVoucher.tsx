"use client";

/**
 * Isi layar form Kelola Voucher — bagian yang menggulir saja; tombol simpan &
 * batal dipegang cangkangnya (../KelolaVoucher.tsx).
 *
 * ── URUTAN BAGIANNYA DISENGAJA ─────────────────────────────────────────────
 * 1. Pratinjau tiket   — bentuk akhirnya lebih dulu, sebelum satu isian pun.
 * 2. Besar potongan    — inti vouchernya; semua isian lain hanya membatasi ini.
 * 3. Simulasi rupiah   — persis SESUDAH angkanya diketik, selagi masih segar.
 * 4. Nama & kode       — yang dibaca penyewa.
 * 5. Syarat pakai      — terlipat, karena mayoritas promo tidak memakainya.
 * 6. Jadwal & kuota    — terlipat, dengan anggaran maksimal yang terhitung.
 * 7. Ringkasan kalimat — seluruh isian dibacakan kembali sebagai satu kalimat.
 * 8. Sakelar & hapus.
 *
 * Yang paling mudah keliru kalau urutannya diubah adalah nomor 3. Simulasi
 * yang ditaruh di bawah — sesudah pemilik menggulir melewati enam isian lain —
 * dibaca sesudah keputusannya terlanjur diambil, dan blok itu berubah dari
 * pencegah penyesalan jadi hiasan.
 *
 * SEMUA aturan sah/tidaknya voucher datang dari `validasiVoucher` di
 * @/lib/voucher — fungsi yang SAMA PERSIS dipanggil API sebelum menyimpan.
 * Form yang punya aturannya sendiri akan menolak hal yang sebenarnya boleh,
 * atau meloloskan hal yang lalu ditolak server tanpa bisa dijelaskan.
 */

import React, { useState } from "react";
import { Icon } from "@iconify/react";

import { AKSEN, LINE, SURFACE } from "../sewaTheme";
import Tiket from "./Tiket";
import PilihTanggal, { labelTanggalPendek } from "./PilihTanggal";
import { type StatistikVoucher } from "./KartuKelola";
import SimulasiDampak from "./SimulasiDampak";
import {
  AreaTeks,
  Bagian,
  Bantuan,
  ChipCepat,
  Galat,
  keAngka,
  Kolom,
  Label,
  pisahRibuan,
  Sakelar,
  Segmen,
} from "./kelolaPrimitif";
import {
  DURASI_META,
  DURASI_URUT,
  formatRupiah,
  type DurasiKey,
  type TipeKamarView,
} from "@/lib/kosDetail";
import {
  anggaranMaksimal,
  kalimatVoucher,
  kunciTambahHari,
  labelNilai,
  metaVoucher,
  ringkasRupiah,
  ringkasSyarat,
  usulKode,
  type InputVoucher,
  type JenisVoucher,
  type Voucher,
} from "@/lib/voucher";

interface Props {
  input: InputVoucher;
  ubah: <K extends keyof InputVoucher>(k: K, v: InputVoucher[K]) => void;
  /** Voucher yang sedang disunting; null saat membuat baru. */
  sunting: Voucher | null;
  statistik?: StatistikVoucher;
  durasiTersedia: DurasiKey[];
  hargaDurasi: Partial<Record<DurasiKey, number>>;
  durasiUtama: DurasiKey;
  /** Tipe kamar listing ini. Kosong = unit tunggal, dan seluruh pilihan
   *  "khusus tipe" tidak dirender sama sekali. */
  tipeList: TipeKamarView[];
  namaTipe: Record<string, string>;
  galat: string;
  menyimpan: boolean;
  onHapus: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// BAGIAN TERLIPAT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bagian yang bisa dilipat, DENGAN ringkasan keadaannya saat tertutup.
 *
 * Ringkasan itu syarat mutlak, bukan hiasan: bagian terlipat tanpa ringkasan
 * menyembunyikan syarat yang sudah terpasang, dan pemilik yang tidak membuka
 * semua lipatan akan menyimpan promo dengan aturan yang tidak dia sadari ada
 * di sana — persis kesalahan yang seharusnya dicegah oleh pelipatan itu.
 */
function Lipat({
  ikon,
  aksen,
  judul,
  ringkas,
  buka,
  onToggle,
  children,
}: {
  ikon: string;
  aksen: (typeof AKSEN)[keyof typeof AKSEN];
  judul: string;
  ringkas: string;
  buka: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-white/[0.08]"
      style={{ background: SURFACE.raised }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={buka}
        className="flex w-full items-center gap-3 p-3.5 text-left transition-colors hover:bg-white/[0.03] motion-reduce:transition-none"
      >
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${aksen.kotak}`}
        >
          <Icon icon={ikon} className="text-base" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-extrabold leading-tight text-white">
            {judul}
          </span>
          <span className="mt-0.5 block truncate text-[10.5px] font-semibold text-white/60">
            {ringkas}
          </span>
        </span>
        <Icon
          icon="solar:alt-arrow-down-linear"
          className={`shrink-0 text-base text-white/50 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
            buka ? "rotate-180" : ""
          }`}
        />
      </button>

      {buka && (
        <div className={`space-y-3.5 border-t px-3.5 pb-4 pt-3.5 ${LINE.row}`}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KOMPONEN UTAMA
// ─────────────────────────────────────────────────────────────────────────────

export default function FormVoucher({
  input,
  ubah,
  sunting,
  statistik,
  durasiTersedia,
  hargaDurasi,
  durasiUtama,
  tipeList,
  namaTipe,
  galat,
  menyimpan,
  onHapus,
}: Props) {
  /**
   * Lipatan dibuka dari awal kalau isinya SUDAH terisi — biasanya karena
   * datang dari preset atau dari voucher yang sedang disunting. Membiarkannya
   * tertutup berarti syarat yang aktif tersembunyi di balik satu ketukan yang
   * tidak ada alasan untuk ditekan.
   */
  const [bukaSyarat, setBukaSyarat] = useState(
    input.durasiBerlaku.length > 0 ||
      input.tipeBerlaku.length > 0 ||
      input.lamaMin != null ||
      input.minTransaksi != null,
  );
  const [bukaJadwal, setBukaJadwal] = useState(
    input.berlakuMulai != null ||
      input.berlakuSampai != null ||
      input.kuotaTotal != null,
  );
  const [konfirmasiHapus, setKonfirmasiHapus] = useState(false);

  const meta = metaVoucher(input);
  const aksenRel = AKSEN[meta.aksen];
  const hariIni = kunciTambahHari(0);

  /** Chip durasi dibatasi ke durasi yang benar-benar dijual listing ini —
   *  supaya pemilik tidak memasang syarat "tahunan" pada kos yang tidak pernah
   *  menjual tahunan, yaitu voucher yang mustahil dipakai siapa pun. */
  const pilihanDurasi = durasiTersedia.length > 0 ? durasiTersedia : DURASI_URUT;

  /** Voucher semu untuk pratinjau & kalimat ringkasan. */
  const semu: Voucher = {
    id: sunting?.id ?? "",
    ...input,
    deskripsi: input.deskripsi ?? "",
    // Array kosong → null pada keduanya. Di form "kosong" berarti belum
    // dipilih, di voucher tersimpan `null` berarti "semua"; menyamakannya di
    // sini membuat `ringkasSyarat` tidak perlu tahu ia sedang membaca form
    // atau baris DB.
    durasiBerlaku: input.durasiBerlaku.length ? input.durasiBerlaku : null,
    tipeBerlaku: input.tipeBerlaku.length ? input.tipeBerlaku : null,
    kuotaTerpakai: sunting?.kuotaTerpakai ?? 0,
  };

  const anggaran = anggaranMaksimal(input);
  const syaratPratinjau = ringkasSyarat(semu, namaTipe);

  // ── Ringkasan lipatan ──
  const ringkasSyaratLipat = [
    tipeList.length > 0
      ? input.tipeBerlaku.length > 0
        ? input.tipeBerlaku
            .map((id) => namaTipe[id])
            .filter(Boolean)
            .join(", ") || `${input.tipeBerlaku.length} tipe`
        : "Semua tipe"
      : null,
    input.durasiBerlaku.length > 0
      ? input.durasiBerlaku.map((d) => DURASI_META[d].label).join(", ")
      : "Semua durasi",
    input.lamaMin && input.lamaMin > 1 ? `min. ${input.lamaMin}×` : null,
    input.minTransaksi ? `min. ${formatRupiah(input.minTransaksi)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const ringkasJadwalLipat = [
    input.berlakuMulai ? `mulai ${labelTanggalPendek(input.berlakuMulai)}` : null,
    input.berlakuSampai
      ? `sampai ${labelTanggalPendek(input.berlakuSampai)}`
      : "tanpa tanggal akhir",
    input.kuotaTotal ? `${input.kuotaTotal} kuota` : "kuota tak terbatas",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto px-5 pb-4">
      {/* ── 1. PRATINJAU ──
          Sengaja TIDAK menampilkan angka potongan rupiah: besarnya bergantung
          pada lama sewa yang dipilih penyewa, dan menebaknya di sini berarti
          menjanjikan angka yang belum tentu muncul di panel mana pun. Angka
          rupiahnya ada di blok simulasi, yang memang menyebutkan asumsinya. */}
      <div>
        <Tiket
          ikon={meta.ikon}
          nilai={input.nilai > 0 ? labelNilai(input) : "—"}
          labelJenis={meta.label}
          aksenRel={aksenRel}
        >
          <p className="truncate text-[13px] font-extrabold leading-snug text-white">
            {input.nama || "Nama voucher"}
          </p>
          <p className="mt-0.5 truncate text-[10.5px] font-bold tracking-[0.08em] text-white/60">
            {input.kode || "KODE"}
          </p>
          {input.deskripsi && (
            <p className="mt-1 line-clamp-2 text-[10.5px] leading-relaxed text-white/60">
              {input.deskripsi}
            </p>
          )}
          {syaratPratinjau.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {syaratPratinjau.map((s) => (
                <span
                  key={s}
                  className="rounded-md border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[9px] font-bold text-white/65"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </Tiket>
        <p className="mt-1.5 flex items-center gap-1.5 text-[10px] font-semibold text-white/50">
          <Icon icon="solar:eye-bold-duotone" className="text-xs" />
          Begini tampilannya di panel pemesanan calon penyewa.
        </p>
      </div>

      {/* ── 2. BESAR POTONGAN ── */}
      <Bagian
        ikon="solar:tag-price-bold-duotone"
        aksen={AKSEN.mint}
        judul="Besar potongan"
        catatan="Inti vouchernya. Semua isian lain hanya membatasi kapan angka ini cair."
      >
        <div className="space-y-3">
          <Segmen<JenisVoucher>
            pilihan={[
              { nilai: "NOMINAL", label: "Rupiah tetap" },
              { nilai: "PERSEN", label: "Persen" },
            ]}
            nilai={input.jenis}
            onUbah={(j) => ubah("jenis", j)}
          />

          {/* Titik ribuan dipasang pada KEDUA jenis, bukan hanya rupiah.
              Alasannya bukan konsistensi tampilan: angka yang tidak dipisah
              membuat "250000" dan "2500000" terlihat nyaris sama persis di
              kolom yang sempit, dan satu nol yang salah ketik di kolom potongan
              adalah kesalahan yang paling mahal di seluruh form ini. */}
          <Kolom
            besar
            nilai={input.nilai > 0 ? pisahRibuan(String(input.nilai)) : ""}
            onUbah={(v) => ubah("nilai", keAngka(v) ?? 0)}
            placeholder={input.jenis === "PERSEN" ? "10" : "250.000"}
            awalan={input.jenis === "PERSEN" ? undefined : "Rp"}
            akhiran={input.jenis === "PERSEN" ? "%" : undefined}
            inputMode="numeric"
          />

          {input.jenis === "NOMINAL" ? (
            <Bantuan>
              Angka tetap. Paling cepat dipahami penyewa — tidak perlu dihitung
              dulu untuk tahu hematnya berapa.
            </Bantuan>
          ) : (
            <>
              <div>
                <Label opsional>Potongan maksimal</Label>
                <Kolom
                  nilai={
                    input.potonganMaks ? pisahRibuan(String(input.potonganMaks)) : ""
                  }
                  onUbah={(v) => ubah("potonganMaks", keAngka(v))}
                  placeholder="Tanpa batas"
                  awalan="Rp"
                  inputMode="numeric"
                />
                {/* Peringatannya muncul HANYA saat batasnya memang kosong, dan
                    berhenti begitu diisi. Catatan yang selalu ada akan segera
                    berhenti dibaca, termasuk pada voucher yang benar-benar
                    berbahaya. */}
                {input.potonganMaks == null ? (
                  <p
                    className={`mt-1.5 flex items-start gap-1.5 text-[10.5px] font-semibold leading-relaxed ${AKSEN.amber.teks}`}
                  >
                    <Icon
                      icon="solar:danger-triangle-bold"
                      className="mt-px shrink-0 text-xs"
                    />
                    Tanpa batas ini, {input.nilai || 10}% ikut membesar mengikuti
                    lama sewa — pada kontrak tahunan angkanya bisa jutaan.
                  </p>
                ) : (
                  <Bantuan>
                    Berapa pun lama sewanya, potongan tidak akan melebihi{" "}
                    {formatRupiah(input.potonganMaks)}.
                  </Bantuan>
                )}
              </div>
            </>
          )}
        </div>
      </Bagian>

      {/* ── 3. SIMULASI ── */}
      <Bagian
        ikon="solar:calculator-minimalistic-bold-duotone"
        aksen={AKSEN.sky}
        judul="Kalau voucher ini dipakai"
        catatan="Dihitung dari harga sewa listing ini, bukan contoh."
      >
        <SimulasiDampak
          input={input}
          hargaDurasi={hargaDurasi}
          durasiTersedia={durasiTersedia}
          durasiUtama={durasiUtama}
          tipeList={tipeList}
        />
      </Bagian>

      {/* ── 4. NAMA & KODE ── */}
      <Bagian
        ikon="solar:ticket-bold-duotone"
        aksen={AKSEN.violet}
        judul="Nama & kode"
        catatan="Yang dibaca calon penyewa di panel pemesanan."
      >
        <div className="space-y-3">
          <div>
            <Label>Nama voucher</Label>
            <Kolom
              nilai={input.nama}
              onUbah={(v) => ubah("nama", v)}
              placeholder="Diskon 10% sewa bulanan"
              maxLength={120}
            />
          </div>

          <div>
            <Label>Kode</Label>
            <Kolom
              nilai={input.kode}
              onUbah={(v) => ubah("kode", v.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              placeholder="HEMAT10"
              maxLength={20}
              // Kode adalah isian yang pemiliknya tidak pedulikan tapi menahan
              // penyimpanan sampai formatnya benar. Tombol ini membuatkannya
              // dari nama yang sudah diketik, sekali tekan.
              aksi={
                input.nama.trim().length >= 3
                  ? {
                      ikon: "solar:magic-stick-3-bold-duotone",
                      label: "Buatkan kode dari nama",
                      onKlik: () => ubah("kode", usulKode(input.nama)),
                    }
                  : undefined
              }
            />
            <Bantuan>
              Huruf & angka saja, 4–20 karakter. Kode inilah yang diketik ulang
              penyewa dari tangkapan layar atau pesan WhatsApp.
            </Bantuan>
          </div>

          <div>
            <Label opsional>Deskripsi</Label>
            <AreaTeks
              nilai={input.deskripsi ?? ""}
              onUbah={(v) => ubah("deskripsi", v || null)}
              placeholder="Potongan langsung untuk pembayaran sewa per bulan."
              maxLength={300}
            />
          </div>
        </div>
      </Bagian>

      {/* ── 5. SYARAT PAKAI ── */}
      <Lipat
        ikon="solar:filter-bold-duotone"
        aksen={AKSEN.cyan}
        judul="Syarat pakai"
        ringkas={ringkasSyaratLipat}
        buka={bukaSyarat}
        onToggle={() => setBukaSyarat((b) => !b)}
      >
        {/* ── Tipe kamar ──
            Hanya dirender kalau listing ini MEMANG punya tipe kamar. Pada unit
            tunggal (rumah, ruko, apartemen) tidak ada yang bisa dipilih, dan
            menampilkan isian kosong di sana hanya menyisakan pertanyaan.

            Ditaruh paling atas di antara syarat: pada kos, "kamar yang mana"
            adalah pembatas yang paling sering benar-benar dipakai — tipe yang
            sepi didiskon, tipe yang sudah penuh tidak. */}
        {tipeList.length > 0 && (
          <div>
            <Label opsional>Tipe kamar yang dilayani</Label>
            <div className="flex flex-wrap gap-1.5">
              {tipeList.map((t) => {
                const aktif = input.tipeBerlaku.includes(t.id);
                const harga = t.harga[durasiUtama] ?? 0;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      ubah(
                        "tipeBerlaku",
                        aktif
                          ? input.tipeBerlaku.filter((x) => x !== t.id)
                          : [...input.tipeBerlaku, t.id],
                      )
                    }
                    aria-pressed={aktif}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors motion-reduce:transition-none ${
                      aktif
                        ? AKSEN.mint.chip
                        : "border-white/[0.08] text-white/65 hover:border-white/30 hover:text-white"
                    }`}
                  >
                    {t.nama}
                    {/* Harganya ikut ditulis karena itulah yang membedakan tipe
                        di kepala pemilik — bukan namanya. Potongan Rp 300rb
                        berarti dua hal yang sangat berbeda pada kamar Rp 800rb
                        dan kamar Rp 2,5jt. */}
                    {harga > 0 && (
                      <span
                        className={`font-semibold tabular-nums ${
                          aktif ? "opacity-60" : "text-white/45"
                        }`}
                      >
                        {ringkasRupiah(harga)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <Bantuan>
              {input.tipeBerlaku.length === 0
                ? "Tidak dipilih = berlaku untuk semua tipe kamar."
                : `Hanya cair kalau penyewa memilih ${input.tipeBerlaku
                    .map((id) => namaTipe[id])
                    .filter(Boolean)
                    .join(" atau ")}.`}
            </Bantuan>
          </div>
        )}

        <div>
          <Label>Durasi yang dilayani</Label>
          <div className="flex flex-wrap gap-1.5">
            {pilihanDurasi.map((d) => {
              const aktif = input.durasiBerlaku.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() =>
                    ubah(
                      "durasiBerlaku",
                      aktif
                        ? input.durasiBerlaku.filter((x) => x !== d)
                        : [...input.durasiBerlaku, d],
                    )
                  }
                  aria-pressed={aktif}
                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors motion-reduce:transition-none ${
                    aktif
                      ? AKSEN.mint.chip
                      : "border-white/[0.08] text-white/65 hover:border-white/30 hover:text-white"
                  }`}
                >
                  {DURASI_META[d].label}
                </button>
              );
            })}
          </div>
          <Bantuan>
            {input.durasiBerlaku.length === 0
              ? "Tidak dipilih = berlaku untuk semua durasi yang Anda tawarkan."
              : `Hanya berlaku untuk sewa ${input.durasiBerlaku
                  .map((d) => DURASI_META[d].label.toLowerCase())
                  .join(" & ")}.`}
          </Bantuan>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <Label opsional>Minimal lama sewa</Label>
            <Kolom
              nilai={input.lamaMin ? pisahRibuan(String(input.lamaMin)) : ""}
              onUbah={(v) => ubah("lamaMin", keAngka(v))}
              placeholder="Bebas"
              akhiran="×"
              inputMode="numeric"
            />
          </div>
          <div>
            <Label opsional>Minimal transaksi</Label>
            <Kolom
              nilai={
                input.minTransaksi ? pisahRibuan(String(input.minTransaksi)) : ""
              }
              onUbah={(v) => ubah("minTransaksi", keAngka(v))}
              placeholder="Bebas"
              awalan="Rp"
              inputMode="numeric"
            />
          </div>
        </div>
        <Bantuan>
          Minimal transaksi dihitung dari biaya sewa saja — deposit tidak pernah
          ikut, di sini maupun saat potongannya dihitung.
        </Bantuan>
      </Lipat>

      {/* ── 6. JADWAL & KUOTA ── */}
      <Lipat
        ikon="solar:calendar-mark-bold-duotone"
        aksen={AKSEN.amber}
        judul="Jadwal & kuota"
        ringkas={ringkasJadwalLipat}
        buka={bukaJadwal}
        onToggle={() => setBukaJadwal((b) => !b)}
      >
        <div>
          <Label opsional>Mulai ditawarkan</Label>
          <ChipCepat
            pilihan={[
              { label: "Langsung", nilai: null },
              { label: "Besok", nilai: kunciTambahHari(1) },
              { label: "Minggu depan", nilai: kunciTambahHari(7) },
            ]}
            aktif={(n) => input.berlakuMulai === n}
            onPilih={(n) => ubah("berlakuMulai", n as string | null)}
          />
          <div className="mt-2">
            <PilihTanggal
              judul="Mulai ditawarkan"
              nilai={input.berlakuMulai ?? ""}
              onUbah={(v) => ubah("berlakuMulai", v || null)}
              max={input.berlakuSampai ?? undefined}
              kosong="Langsung berjalan"
            />
          </div>
          <Bantuan>
            Sebelum tanggal ini voucher tidak ditawarkan ke siapa pun, tapi sudah
            tersimpan rapi dan menunggu. Kosongkan untuk langsung berjalan.
          </Bantuan>
        </div>

        <div>
          <Label opsional>Berakhir</Label>
          <ChipCepat
            pilihan={[
              { label: "7 hari", nilai: kunciTambahHari(7) },
              { label: "30 hari", nilai: kunciTambahHari(30) },
              { label: "90 hari", nilai: kunciTambahHari(90) },
              { label: "Tanpa batas", nilai: null },
            ]}
            aktif={(n) => input.berlakuSampai === n}
            onPilih={(n) => ubah("berlakuSampai", n as string | null)}
          />
          <div className="mt-2">
            <PilihTanggal
              judul="Berakhir"
              nilai={input.berlakuSampai ?? ""}
              onUbah={(v) => ubah("berlakuSampai", v || null)}
              min={input.berlakuMulai ?? hariIni}
              kosong="Tanpa tanggal akhir"
            />
          </div>
        </div>

        <div>
          <Label opsional>Kuota pemakaian</Label>
          <ChipCepat
            pilihan={[
              { label: "10", nilai: 10 },
              { label: "25", nilai: 25 },
              { label: "50", nilai: 50 },
              { label: "Tanpa batas", nilai: null },
            ]}
            aktif={(n) => input.kuotaTotal === n}
            onPilih={(n) => ubah("kuotaTotal", n as number | null)}
          />
          <div className="mt-2">
            <Kolom
              nilai={input.kuotaTotal ? pisahRibuan(String(input.kuotaTotal)) : ""}
              onUbah={(v) => ubah("kuotaTotal", keAngka(v))}
              placeholder="Tanpa batas"
              akhiran="pemakaian"
              inputMode="numeric"
            />
          </div>
          {sunting && sunting.kuotaTerpakai > 0 && (
            <Bantuan>
              Sudah dipakai {sunting.kuotaTerpakai} kali, jadi kuotanya tidak bisa
              diturunkan di bawah angka itu.
            </Bantuan>
          )}
        </div>

        {/* ── Anggaran maksimal ──
            Angka yang paling ditanyakan pemilik dan paling jarang disediakan
            sistem voucher: "promo ini bisa menelan berapa?". Hanya bisa dijawab
            kalau DUA hal terbatas — besar satu potongan dan banyaknya
            pemakaian. Kehilangan salah satunya membuat jawabannya tak
            terhingga, dan menampilkan angka apa pun di situ akan berbohong. */}
        <div
          className={`rounded-xl border p-3 ${
            anggaran != null
              ? `border-white/[0.08] ${AKSEN.mint.wash}`
              : `border-amber-400/20 ${AKSEN.amber.wash}`
          }`}
        >
          {anggaran != null ? (
            <>
              <p className="text-[9.5px] font-black uppercase tracking-[0.12em] text-white/55">
                Paling banyak menelan
              </p>
              <p
                className={`mt-1 text-[1.25rem] font-black leading-none tracking-[-0.02em] tabular-nums ${AKSEN.mint.teks}`}
              >
                {formatRupiah(anggaran)}
              </p>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-white/60">
                {input.kuotaTotal} pemakaian ×{" "}
                {formatRupiah(
                  input.jenis === "NOMINAL" ? input.nilai : (input.potonganMaks ?? 0),
                )}
                . Ini batas atasnya, bukan perkiraan.
              </p>
            </>
          ) : (
            <p
              className={`flex items-start gap-2 text-[10.5px] font-semibold leading-relaxed ${AKSEN.amber.teks}`}
            >
              <Icon
                icon="solar:infinity-bold-duotone"
                className="mt-px shrink-0 text-sm"
              />
              Total yang Anda tanggung belum bisa dihitung — promo ini tidak
              punya batas atas
              {input.jenis === "PERSEN" && input.potonganMaks == null
                ? " per pemakaian"
                : ""}
              {input.kuotaTotal == null ? " maupun batas jumlah pemakaian" : ""}. Isi
              kuotanya
              {input.jenis === "PERSEN" && input.potonganMaks == null
                ? " dan potongan maksimalnya"
                : ""}{" "}
              kalau ingin angkanya pasti.
            </p>
          )}
        </div>
      </Lipat>

      {/* ── 7. RINGKASAN ──
          Seluruh isian dibacakan kembali sebagai satu kalimat. Delapan isian
          yang masing-masing benar masih bisa menghasilkan promo yang artinya
          bukan seperti yang dibayangkan pembuatnya, dan kalimat utuh adalah
          satu-satunya bentuk yang membuat selisih itu terasa. */}
      <div
        className={`rounded-2xl border border-white/[0.08] p-3.5 ${AKSEN.netral.wash}`}
      >
        <p className="mb-1.5 flex items-center gap-1.5 text-[9.5px] font-black uppercase tracking-[0.12em] text-white/55">
          <Icon icon="solar:document-text-bold-duotone" className="text-xs" />
          Yang akan berlaku
        </p>
        <p className="text-[12.5px] font-semibold leading-relaxed text-white/90">
          {kalimatVoucher(input, namaTipe)}
        </p>
      </div>

      {/* ── 8. SAKELAR ── */}
      <div className="space-y-2">
        <Sakelar
          nyala={input.aktif}
          onUbah={(v) => ubah("aktif", v)}
          judul="Tampilkan ke calon penyewa"
          catatan="Matikan untuk menyembunyikan voucher tanpa menghapus syaratnya."
          aksen="bg-[#86efac]"
        />
        <Sakelar
          nyala={input.rahasia}
          onUbah={(v) => ubah("rahasia", v)}
          judul="Rahasia"
          catatan="Tidak muncul di daftar. Hanya cair untuk penyewa yang tahu kodenya."
          aksen="bg-sky-400"
        />
      </div>

      {galat && <Galat pesan={galat} />}

      {/* ── Riwayat & hapus ──
          Hapus ditaruh di DALAM area gulir, jauh dari tombol simpan di bawah:
          keduanya tidak boleh bisa tertukar oleh ibu jari yang buru-buru. */}
      {sunting && (
        <div className={`space-y-3 border-t pt-4 ${LINE.row}`}>
          {statistik && statistik.dipakai > 0 && (
            <div
              className="rounded-xl border border-white/[0.08] p-3.5"
              style={{ background: SURFACE.raised }}
            >
              <p className="text-[9.5px] font-black uppercase tracking-[0.12em] text-white/55">
                Hasil sejauh ini
              </p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <span className="text-[13px] font-extrabold text-white">
                  Dipakai {statistik.dipakai}×
                </span>
                <span
                  className={`text-[13px] font-black tabular-nums ${AKSEN.mint.teks}`}
                >
                  {formatRupiah(statistik.totalPotongan)}
                </span>
              </div>
              <p className="mt-1 text-[10.5px] leading-relaxed text-white/55">
                Total potongan yang sudah Anda berikan lewat voucher ini.
              </p>
            </div>
          )}

          {konfirmasiHapus ? (
            <div className={`rounded-xl border border-rose-400/25 p-3 ${AKSEN.rose.wash}`}>
              <p className="text-xs font-bold text-white">
                Hapus voucher {sunting.kode}?
              </p>
              <p className="mt-0.5 text-[10.5px] leading-relaxed text-white/65">
                Penyewa yang sedang memakainya akan kehilangan potongan itu
                {statistik && statistik.dipakai > 0
                  ? `, dan riwayat ${statistik.dipakai} pemakaiannya ikut terhapus`
                  : ""}
                . Kalau hanya ingin menghentikannya sementara, matikan sakelar
                “Tampilkan ke calon penyewa”.
              </p>
              <div className="mt-2.5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setKonfirmasiHapus(false)}
                  className="flex-1 rounded-lg border border-white/[0.12] py-2 text-[11px] font-bold text-white"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={onHapus}
                  disabled={menyimpan}
                  className="flex-1 rounded-lg bg-rose-500 py-2 text-[11px] font-extrabold text-white disabled:opacity-40"
                >
                  Ya, hapus
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setKonfirmasiHapus(true)}
              className={`flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-400/20 py-2.5 text-[11px] font-bold transition-colors hover:bg-rose-500/10 motion-reduce:transition-none ${AKSEN.rose.teks}`}
            >
              <Icon icon="solar:trash-bin-trash-bold-duotone" className="text-sm" />
              Hapus voucher ini
            </button>
          )}
        </div>
      )}
    </div>
  );
}
