'use client';

/**
 * KamarTipeBuilder — penyusun tipe kamar kos (spesifikasi & jumlah, BUKAN harga).
 *
 * Masalah yang diselesaikan: satu kos dengan 10 kamar sering punya 2 kamar
 * mandi dalam yang lebih luas & lebih mahal. Dengan satu set field tunggal,
 * pemilik harus memilih satu angka untuk semuanya — calon penghuni datang
 * survei dengan ekspektasi salah.
 *
 * Keputusan desain (kenapa bentuknya begini):
 *
 * 1. Harga TIDAK ada di sini. Semua harga dikumpulkan di satu grid di bagian
 *    berikutnya, karena hal pertama yang dilakukan pemilik dengan angka harga
 *    adalah membandingkannya antar tipe — mustahil kalau angkanya tersebar di
 *    kartu-kartu yang harus di-scroll satu per satu.
 * 2. Satu tipe = satu kartu, bukan satu baris tabel. Tiap tipe punya 6 isian;
 *    tabel selebar itu tidak bisa dipakai di HP, kartu bisa melipat isinya.
 * 3. Kartu dibagi dua blok: ketersediaan (di-update rutin tiap penghuni
 *    masuk/keluar) di atas, spesifikasi (sekali isi) di bawahnya.
 * 4. Ketersediaan pakai stepper −/+ dan di-clamp ke jumlah kamar, jadi keadaan
 *    mustahil seperti "sisa 12 dari 8" tidak pernah bisa terbentuk.
 */

import React, { useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import {
  Copy,
  CopyCheck,
  DoorOpen,
  Layers,
  Plus,
  Ruler,
  Sparkles,
  Trash2,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FacilityMultiSelect } from './FacilityMultiSelect';
import {
  FASILITAS_KAMAR_OPTIONS,
  KAMAR_TIPE_PRESET,
} from '@/app/tambah-property/types/listing';
import {
  MAKS_TIPE_KAMAR,
  ringkasKamarTipe,
  type KamarTipe,
} from '@/lib/kosRoomTypes';
import {
  AngkaField,
  BarHunian,
  Label,
  PANEL,
  PilihKamarMandi,
  StepperField,
  TeksField,
} from './kos/fields';
import { FotoKamarTipe } from './kos/FotoKamarTipe';

export interface KamarTipeRowError {
  message?: string;
  nama?: { message?: string };
  gambar?: { message?: string };
  jumlah_kamar?: { message?: string };
  kamar_tersedia?: { message?: string };
  luas_kamar?: { message?: string };
  kapasitas_penghuni?: { message?: string };
}

interface KamarTipeBuilderProps {
  value: KamarTipe[];
  onChange: (next: KamarTipe[]) => void;
  rowErrors?: (KamarTipeRowError | undefined)[];
  groupError?: string;
  /**
   * Mode sunting — "kamar kosong sekarang" per tipe dikunci karena angkanya
   * turunan dari kalender ketersediaan. Alasan lengkapnya di
   * KamarSeragamFields.
   */
  isEditMode?: boolean;
  /** Kota & alamat properti — dipakai menyusun folder foto per tipe di Drive. */
  kota?: string | null;
  alamat?: string | null;
}

export function KamarTipeBuilder({
  value,
  onChange,
  rowErrors,
  groupError,
  isEditMode = false,
  kota,
  alamat,
}: KamarTipeBuilderProps) {
  const rows = value ?? [];
  const penuh = rows.length >= MAKS_TIPE_KAMAR;

  const tipeSignature = JSON.stringify(rows);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ringkasan = useMemo(() => ringkasKamarTipe(rows), [tipeSignature]);

  /**
   * Daftar terbaru, dibaca lewat ref.
   *
   * Unggahan foto berlangsung beberapa detik, dan `patch` yang dipanggil saat
   * unggahan SELESAI menutup daftar dari render saat berkasnya DIPILIH. Kalau
   * selama menunggu itu agent sempat mengetik nomor kamar atau menggeser sisa
   * kamar, menulis balik daftar lama akan menghapus ketikan itu tanpa jejak.
   * Ref selalu menunjuk daftar termutakhir, jadi tidak ada perubahan yang
   * tertimpa oleh jawaban yang datang terlambat.
   */
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const patch = (i: number, next: Partial<KamarTipe>) =>
    onChange(rowsRef.current.map((r, idx) => (idx === i ? { ...r, ...next } : r)));

  /** "Tipe A", "Tipe B", … melompati nama yang sudah dipakai. */
  const namaBerikutnya = () => {
    const terpakai = new Set(rows.map((r) => r.nama?.trim().toLowerCase()));
    for (let i = 0; i < 26; i++) {
      const kandidat = `Tipe ${String.fromCharCode(65 + i)}`;
      if (!terpakai.has(kandidat.toLowerCase())) return kandidat;
    }
    return `Tipe ${rows.length + 1}`;
  };

  const tipeBaru = (isi?: Partial<KamarTipe>): KamarTipe => ({
    nama: isi?.nama ?? namaBerikutnya(),
    jumlah_kamar: 1,
    kamar_tersedia: 1,
    luas_kamar: null,
    kamar_mandi_tipe: null,
    kapasitas_penghuni: null,
    lantai_kamar: null,
    nomor_kamar: null,
    harga_sewa_harian: null,
    harga_sewa_mingguan: null,
    harga_sewa_bulanan: null,
    harga_sewa_tahunan: null,
    fasilitas_kamar: null,
    gambar: null,
    catatan: null,
    ...isi,
  });

  const tambah = (isi?: Partial<KamarTipe>) => {
    if (penuh) return;
    onChange([...rows, tipeBaru(isi)]);
  };

  /**
   * Duplikat — jalan tercepat membuat tipe kedua yang cuma beda satu hal
   * (mis. hanya kamar mandinya luar). Nama diberi akhiran supaya tidak
   * bentrok dengan aturan "nama tipe tidak boleh sama".
   */
  const duplikat = (i: number) => {
    if (penuh) return;
    const asal = rows[i];
    const dasar = asal.nama?.trim() || 'Tipe';
    const terpakai = new Set(rows.map((r) => r.nama?.trim().toLowerCase()));
    let n = 2;
    let nama = `${dasar} (${n})`;
    while (terpakai.has(nama.toLowerCase()) && n < 20) {
      n += 1;
      nama = `${dasar} (${n})`;
    }
    onChange([...rows.slice(0, i + 1), { ...asal, nama }, ...rows.slice(i + 1)]);
  };

  const hapus = (i: number) => onChange(rows.filter((_, idx) => idx !== i));

  /**
   * Salin daftar fasilitas satu tipe ke SEMUA tipe. Kebanyakan kos punya
   * fasilitas dasar yang sama (kasur, lemari) dan cuma beda satu-dua item;
   * tanpa tombol ini pemilik mencentang ulang daftar yang sama tiap tipe, dan
   * satu tipe yang terlewat akan terlihat lebih miskin dari kenyataannya.
   */
  const terapkanFasilitasKeSemua = (sumber: number) => {
    const daftar = rows[sumber]?.fasilitas_kamar ?? null;
    onChange(rows.map((r) => ({ ...r, fasilitas_kamar: daftar })));
  };

  const parseChips = (raw?: string | null) =>
    raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [];

  // Preset yang namanya sudah dipakai tidak ditawarkan lagi — menekannya cuma
  // akan memicu error "nama tipe dipakai lebih dari sekali".
  const presetTersisa = KAMAR_TIPE_PRESET.filter(
    (p) => !rows.some((r) => r.nama?.trim().toLowerCase() === p.nama.toLowerCase()),
  );

  return (
    <div className="space-y-3">
      {/* Ringkasan jumlah — angka inilah yang tersimpan ke listing, jadi
          ditaruh di atas daftar supaya akibat tiap perubahan langsung terlihat
          tanpa harus scroll ke live preview. */}
      <AnimatePresence initial={false}>
        {rows.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="grid grid-cols-3 gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.09] px-4 py-3.5 sm:flex sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2"
          >
            {[
              {
                label: 'Tipe',
                nilai: ringkasan.jumlahTipe,
                satuan: ringkasan.jumlahTipe > 1 ? 'tipe' : 'tipe',
                icon: <Layers className="h-3.5 w-3.5" />,
              },
              {
                label: 'Total kamar',
                nilai: ringkasan.totalKamar,
                satuan: 'kamar',
                icon: <Icon icon="mdi:door-open" className="h-3.5 w-3.5" />,
              },
              {
                label: 'Kosong',
                nilai: ringkasan.kamarTersedia,
                satuan: 'kamar',
                icon: <DoorOpen className="h-3.5 w-3.5" />,
                sorot: true,
              },
            ].map((s) => (
              <div
                key={s.label}
                className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2"
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                  <span className="text-emerald-300">{s.icon}</span>
                  <span className="truncate">{s.label}</span>
                </span>
                <span
                  className={cn(
                    'text-lg font-black leading-none',
                    s.sorot ? 'text-emerald-300' : 'text-white',
                  )}
                >
                  {s.nilai}
                  <span className="ml-1 text-xs font-semibold text-slate-400">
                    {s.satuan}
                  </span>
                </span>
              </div>
            ))}
            <span className="hidden text-xs text-slate-400 sm:ml-auto sm:inline">
              dijumlah otomatis
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {groupError && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-400/40 bg-red-400/10 px-4 py-3">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
          <p className="text-xs font-semibold leading-relaxed text-red-200">
            {groupError}
          </p>
        </div>
      )}

      {/* Daftar kartu tipe */}
      <AnimatePresence initial={false}>
        {rows.map((row, i) => {
          const err = rowErrors?.[i];
          const jumlah = Number(row.jumlah_kamar ?? 0);
          const tersedia = Number(row.kamar_tersedia ?? 0);
          const fasilitas = parseChips(row.fasilitas_kamar);
          /**
           * Pesan "foto wajib" hanya ditampilkan kalau fotonya MEMANG belum
           * ada.
           *
           * `errors` dari react-hook-form adalah potret hasil validasi
           * terakhir, bukan cerminan nilai saat ini. Foto yang baru selesai
           * diunggah membuat potret itu basi seketika — dan yang dilihat agent
           * adalah petak berisi foto dengan tulisan merah "Foto kamar wajib
           * diunggah" di bawahnya, yang mustahil ia perbaiki karena memang
           * tidak ada yang salah. Menurunkannya dari nilai membuat keadaan itu
           * tidak bisa terbentuk, apa pun waktu validasi berikutnya berjalan.
           */
          const errFoto = row.gambar ? undefined : err?.gambar?.message;

          const adaError =
            !!err?.message ||
            !!err?.nama ||
            !!errFoto ||
            !!err?.jumlah_kamar ||
            !!err?.kamar_tersedia;

          return (
            <motion.div
              key={i}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, transition: { duration: 0.14 } }}
              transition={{ duration: 0.2 }}
              className={cn(
                PANEL,
                'overflow-hidden transition-colors',
                adaError && 'border-red-400/50',
              )}
            >
              {/* Header: nomor, nama, aksi — SATU baris, tanpa label di atas
                  kolom nama. Label "Nama tipe" dulu memakan satu baris penuh
                  untuk menjelaskan kotak yang sudah punya placeholder & nomor
                  urut di sebelahnya; di kartu yang bisa muncul delapan kali,
                  baris itu delapan kali terbuang. */}
              <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.06] p-2.5 sm:gap-2.5 sm:p-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-emerald-400/30 bg-emerald-400/15 text-sm font-black text-emerald-200">
                  {i + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <input
                    id={`tipe-nama-${i}`}
                    type="text"
                    value={row.nama ?? ''}
                    onChange={(e) => patch(i, { nama: e.target.value })}
                    placeholder="Nama tipe — mis. Kamar Mandi Dalam"
                    aria-label={`Nama tipe kamar ${i + 1}`}
                    maxLength={80}
                    className={cn(
                      'h-10 w-full rounded-xl border bg-black/40 px-3.5 text-sm font-bold text-white transition-colors sm:text-base',
                      'placeholder:text-xs placeholder:font-medium placeholder:text-slate-500 focus:border-emerald-400/70 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 sm:placeholder:text-sm',
                      err?.nama ? 'border-red-400/70' : 'border-white/[0.12]',
                    )}
                  />
                </div>

                <div className="flex shrink-0 gap-0.5">
                  <button
                    type="button"
                    onClick={() => duplikat(i)}
                    disabled={penuh}
                    title={penuh ? `Maksimal ${MAKS_TIPE_KAMAR} tipe` : 'Duplikat tipe ini'}
                    aria-label={`Duplikat ${row.nama || `tipe ${i + 1}`}`}
                    className={cn(
                      'grid h-9 w-9 place-items-center rounded-lg transition-colors',
                      penuh
                        ? 'cursor-not-allowed text-slate-600'
                        : 'text-slate-300 hover:bg-emerald-400/10 hover:text-emerald-300',
                    )}
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => hapus(i)}
                    title="Hapus tipe ini"
                    aria-label={`Hapus ${row.nama || `tipe ${i + 1}`}`}
                    className="grid h-9 w-9 place-items-center rounded-lg text-slate-300 transition-colors hover:bg-red-400/10 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Error nama dipindah ke bawah header supaya barisnya tetap
                  satu baris saat tidak ada masalah — dan tetap menempel pada
                  kotak yang salah saat ada. */}
              {(err?.nama?.message || err?.message) && (
                <p className="border-b border-white/10 bg-red-400/[0.06] px-3 py-1.5 text-[11px] font-semibold text-red-300">
                  {err?.nama?.message ?? err?.message}
                </p>
              )}

              <div className="space-y-3 p-3.5 sm:p-4">
                {/* BARIS 1 — foto, jumlah kamar, sisa kamar.
                    Ketiganya sebaris di SEMUA lebar layar, termasuk HP.
                    Sebelumnya foto memakan satu baris sendiri dengan kolom
                    penjelasan di sampingnya, dan dua angka di bawahnya memakan
                    dua baris lagi: tiga baris untuk tiga isian pendek, dengan
                    ruang kosong di kanan masing-masing.

                    Petak foto memakai `items-stretch` dari induk, jadi
                    tingginya PERSIS setinggi kolom isian di sebelahnya —
                    tidak ada lagi sisa ruang di bawah foto maupun di bawah
                    isian, berapa pun tinggi barisnya. */}
                <div className="flex items-stretch gap-2.5 sm:gap-3">
                  <div className="w-[78px] shrink-0 sm:w-[104px]">
                    <FotoKamarTipe
                      value={row.gambar ?? null}
                      onChange={(url) => patch(i, { gambar: url })}
                      kota={kota}
                      alamat={alamat}
                      namaTipe={row.nama || `tipe ${i + 1}`}
                      error={errFoto}
                    />
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-2.5">
                    <div className="grid grid-cols-2 items-start gap-2.5 sm:gap-3">
                      {/* Satuan "kamar" sengaja dilepas dari kotaknya: labelnya
                          sudah menyebut kamar, dan di kolom selebar ±110px
                          sufiks itu memakan tempat angkanya sendiri. */}
                      <AngkaField
                        id={`tipe-jumlah-${i}`}
                        label="Jumlah kamar"
                        value={row.jumlah_kamar ?? null}
                        onChange={(v) =>
                          patch(i, {
                            jumlah_kamar: v,
                            kamar_tersedia:
                              v != null && tersedia > v ? v : row.kamar_tersedia,
                          })
                        }
                        placeholder="8"
                        icon={<Icon icon="mdi:door-open" className="h-3.5 w-3.5" />}
                        error={err?.jumlah_kamar?.message}
                      />

                      {isEditMode ? (
                        <div className="min-w-0">
                          <Label>Kamar kosong</Label>
                          <div className="flex h-11 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3">
                            <DoorOpen className="h-3.5 w-3.5 shrink-0 text-white/30" />
                            <span className="text-sm font-black tabular-nums text-white/70">
                              {tersedia}
                            </span>
                            <span className="truncate text-[10px] font-semibold text-white/30">
                              otomatis
                            </span>
                          </div>
                        </div>
                      ) : (
                        <StepperField
                          id={`tipe-tersedia-${i}`}
                          label="Kamar kosong"
                          value={row.kamar_tersedia ?? null}
                          onChange={(v) => patch(i, { kamar_tersedia: v })}
                          maks={jumlah > 0 ? jumlah : null}
                          error={err?.kamar_tersedia?.message}
                        />
                      )}
                    </div>

                    {/* Bar hunian mengisi sisa tinggi kolom ini — sekaligus
                        alasan tinggi kolom kanan menyamai foto tanpa dipaksa. */}
                    <BarHunian jumlah={jumlah} tersedia={tersedia} />
                  </div>
                </div>

                {isEditMode && (
                  <p className="text-[10.5px] leading-snug text-white/35">
                    Kamar kosong dihitung otomatis dari kalender ketersediaan —
                    ubah lewat{' '}
                    <span className="font-semibold text-white/55">
                      Kelola Ketersediaan
                    </span>{' '}
                    di halaman detail listing.
                  </p>
                )}

                {/* BARIS 2 — spesifikasi kamar, dua kolom di semua lebar layar.
                    Isinya berpasangan secara alami: luas & kapasitas menjawab
                    "sebesar apa", lantai & nomor kamar menjawab "di mana".
                    Satu grid saja, bukan tiga blok bergaris pemisah: tiap
                    pemisah dulu menambah 20px jarak yang tidak membawa
                    informasi apa pun. */}
                <div className="grid grid-cols-2 gap-2.5 border-t border-white/10 pt-3.5 sm:gap-3">
                  {/* Kamar mandi butuh dua tombol berdampingan — dipaksa satu
                      kolom, labelnya terpotong. */}
                  <div className="col-span-2">
                    <PilihKamarMandi
                      value={row.kamar_mandi_tipe ?? null}
                      onChange={(v) => patch(i, { kamar_mandi_tipe: v })}
                    />
                  </div>

                  <AngkaField
                    id={`tipe-luas-${i}`}
                    label="Luas kamar"
                    value={row.luas_kamar ?? null}
                    onChange={(v) => patch(i, { luas_kamar: v })}
                    satuan="m²"
                    placeholder="12"
                    icon={<Ruler className="h-3.5 w-3.5" />}
                    error={err?.luas_kamar?.message}
                  />

                  <AngkaField
                    id={`tipe-kapasitas-${i}`}
                    label="Maks penghuni"
                    value={row.kapasitas_penghuni ?? null}
                    onChange={(v) => patch(i, { kapasitas_penghuni: v })}
                    satuan="org"
                    placeholder="1"
                    icon={<Users className="h-3.5 w-3.5" />}
                    error={err?.kapasitas_penghuni?.message}
                  />

                  {/* Lantai & nomor kamar: teks bebas, bukan angka. Penomoran
                      kos tidak seragam ("A1, A2", "Lt. 2 & 3"), dan memaksanya
                      jadi angka membuat pemilik mengisi yang salah atau
                      melewatinya sama sekali. */}
                  <TeksField
                    id={`tipe-lantai-${i}`}
                    label="Lantai"
                    value={row.lantai_kamar ?? ''}
                    onChange={(v) => patch(i, { lantai_kamar: v || null })}
                    placeholder="2"
                    maxLength={20}
                    icon={<Layers className="h-3.5 w-3.5" />}
                  />
                  <TeksField
                    id={`tipe-nomor-${i}`}
                    label="Nomor kamar"
                    value={row.nomor_kamar ?? ''}
                    onChange={(v) => patch(i, { nomor_kamar: v || null })}
                    placeholder="A1, A2"
                    maxLength={60}
                    icon={<DoorOpen className="h-3.5 w-3.5" />}
                  />
                </div>

                {/* Fasilitas khas tipe ini */}
                {/* Daftar LENGKAP fasilitas kamar tipe ini — tidak ada lagi
                    daftar "berlaku semua tipe" yang terpisah, karena fasilitas
                    kamar memang milik tipenya. Biaya dari keputusan itu adalah
                    isian yang berulang antar tipe, dan itu dibayar oleh tombol
                    "Terapkan ke semua tipe" di bawah — sekali tekan, tidak ada
                    tipe yang tertinggal karena lupa dicentang. */}
                <div className="border-t border-white/10 pt-3.5">
                  <Label>Fasilitas kamar tipe ini</Label>
                  <FacilityMultiSelect
                    options={FASILITAS_KAMAR_OPTIONS}
                    value={fasilitas}
                    onChange={(next) =>
                      patch(i, {
                        fasilitas_kamar: next.length ? next.join(',') : null,
                      })
                    }
                    placeholder="Pilih fasilitas kamar tipe ini…"
                    searchPlaceholder="Cari: AC, kasur, lemari…"
                    ariaLabel={`Fasilitas kamar ${row.nama || `tipe ${i + 1}`}`}
                  />

                  {rows.length > 1 && fasilitas.length > 0 && (
                    <button
                      type="button"
                      onClick={() => terapkanFasilitasKeSemua(i)}
                      className="mt-2.5 inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-black/30 px-3.5 py-2 text-xs font-bold text-slate-200 transition-colors hover:border-emerald-400/40 hover:bg-emerald-400/10 hover:text-emerald-200"
                    >
                      <CopyCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      Terapkan {fasilitas.length} fasilitas ini ke semua tipe
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Tambah tipe — preset dulu (pembeda paling umum), lalu tipe kosong */}
      {!penuh && presetTersisa.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {presetTersisa.slice(0, 3).map((p) => (
            <button
              key={p.nama}
              type="button"
              onClick={() =>
                tambah({ nama: p.nama, kamar_mandi_tipe: p.kamar_mandi_tipe ?? null })
              }
              title={p.desc}
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-black/40 px-3.5 py-2.5 text-sm font-bold text-slate-200 transition-colors hover:border-emerald-400/50 hover:bg-emerald-400/[0.12] hover:text-emerald-200"
            >
              <Icon icon={p.icon} className="h-4 w-4 text-emerald-400" />
              {p.nama}
              <Plus className="h-3 w-3 opacity-60" strokeWidth={3} />
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => tambah()}
        disabled={penuh}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-3.5 text-sm font-bold transition-all',
          penuh
            ? 'cursor-not-allowed border-white/[0.08] text-slate-600'
            : 'border-emerald-400/40 bg-emerald-400/[0.08] text-emerald-300 hover:border-emerald-400/70 hover:bg-emerald-400/[0.16] hover:text-emerald-200',
        )}
      >
        <span
          className={cn(
            'grid h-6 w-6 place-items-center rounded-lg transition-colors',
            penuh ? 'bg-white/[0.06]' : 'bg-emerald-400/25',
          )}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
        {penuh ? `Maksimal ${MAKS_TIPE_KAMAR} tipe kamar` : 'Tambah tipe kamar'}
      </button>

      {rows.length === 0 && (
        <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-400">
          <Sparkles className="mt-px h-3.5 w-3.5 shrink-0 text-emerald-400" />
          Contoh: kos 10 kamar → tipe “Kamar Mandi Luar” 8 kamar, dan tipe
          “Kamar Mandi Dalam” 2 kamar. Harga &amp; fasilitas diisi per tipe.
        </p>
      )}
    </div>
  );
}

export default KamarTipeBuilder;
