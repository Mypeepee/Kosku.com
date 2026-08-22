'use client';

/**
 * JudulOtomatis — bagian judul listing, diletakkan di UJUNG wizard.
 *
 * KENAPA PINDAH KE AKHIR. Judul dulu jadi isian pertama, dan itu urutan yang
 * terbalik: saat itu belum ada satu pun fakta yang bisa dimasukkan ke dalamnya.
 * Agent mengarang "Rumah Dijual Murah" lalu tidak pernah kembali memperbaikinya.
 * Di posisi sekarang — setelah lokasi, harga, spesifikasi & foto terisi — mesin
 * punya seluruh bahan untuk menuliskannya sendiri, dan agent tinggal memilih.
 *
 * KENAPA LANGSUNG TERISI, BUKAN MENUNGGU DITEKAN. Tombol "generate" yang harus
 * ditemukan dulu tetap meninggalkan judul kosong bagi yang tidak menekannya.
 * Saran terbaik diisikan sendiri begitu datanya cukup — sekali, dan hanya ke
 * kolom yang masih kosong. Isian agent tidak pernah ditimpa.
 *
 * SEMUA SARAN BERSUMBER DARI DATA. Perakitnya (src/lib/listingTitle.ts) tidak
 * boleh menyebut apa pun yang tidak ada di form — lihat catatan di sana.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Info, Loader2, RefreshCw, Sparkles, Type, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  JUDUL_IDEAL_MAKS,
  JUDUL_MAKS,
  JUDUL_MIN,
  bisaRakitJudul,
  nilaiJudul,
  susunKandidatJudul,
  type DataJudul,
  type KandidatJudul,
} from '@/lib/listingTitle';

interface Props {
  data: DataJudul;
  value: string;
  onChange: (judul: string) => void;
  error?: string;
  /** Mode edit: judul yang sudah tayang tidak pernah diisi ulang otomatis. */
  isEditMode?: boolean;
  /**
   * Langkah 5 sedang ditampilkan.
   *
   * Komponen ini ter-mount sejak langkah 1 (semua step dirender, hanya
   * disembunyikan), jadi tanpa penanda ini permintaan ke model akan terkirim
   * saat agent masih mengisi lokasi — untuk data yang belum lengkap, dan
   * berkali-kali. Kuota gratis tidak boleh dihabiskan untuk pertanyaan yang
   * belum layak ditanyakan.
   */
  aktif?: boolean;
}

const warnaSkor = (skor: number) =>
  skor >= 75
    ? { teks: 'text-emerald-300', bg: 'bg-emerald-400/15', ring: 'border-emerald-400/40', bar: 'from-emerald-400 to-teal-400' }
    : skor >= 50
      ? { teks: 'text-amber-300', bg: 'bg-amber-400/15', ring: 'border-amber-400/40', bar: 'from-amber-400 to-orange-400' }
      : { teks: 'text-rose-300', bg: 'bg-rose-400/15', ring: 'border-rose-400/40', bar: 'from-rose-400 to-red-400' };

const labelSkor = (skor: number) =>
  skor >= 75 ? 'Siap tayang' : skor >= 50 ? 'Cukup' : 'Perlu diperbaiki';

export function JudulOtomatis({
  data,
  value,
  onChange,
  error,
  isEditMode = false,
  aktif = false,
}: Props) {
  const judul = value ?? '';

  // Sidik jari data, bukan identitas objeknya: `data` dirakit ulang tiap render
  // di komponen induk, jadi memakainya sebagai dependensi useMemo sama dengan
  // tidak memakai useMemo sama sekali.
  const sidik = JSON.stringify(data);
  const kandidatAturan = useMemo<KandidatJudul[]>(
    () => susunKandidatJudul(data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sidik],
  );
  const siap = bisaRakitJudul(data);

  // ── Saran dari model bahasa ───────────────────────────────────────────
  // Mesin aturan tetap yang menjawab lebih dulu (instan, offline, nol biaya);
  // hasil model menggantikannya begitu tiba. Urutan itu disengaja: agent tidak
  // pernah menatap kolom kosong sambil menunggu jaringan.
  const [kandidatAI, setKandidatAI] = useState<KandidatJudul[] | null>(null);
  const [memuatAI, setMemuatAI] = useState(false);
  const [pesanAI, setPesanAI] = useState<string | null>(null);
  /** Sidik data yang sudah pernah ditanyakan — penjaga kuota. */
  const sidikDiminta = useRef<string | null>(null);

  const kandidat = kandidatAI ?? kandidatAturan;
  const dariAI = kandidatAI !== null;

  const mintaSaranAI = useCallback(
    async (paksa = false) => {
      if (!siap) return;
      setMemuatAI(true);
      setPesanAI(null);
      try {
        const res = await fetch(`/api/listing/judul${paksa ? '?paksa=1' : ''}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: sidik,
        });
        const json = await res.json();
        // Route ini tidak pernah mengembalikan daftar kosong — kalau model
        // gagal, isinya hasil mesin aturan. Jadi yang perlu dibedakan di sini
        // cuma "ini benar tulisan model atau bukan", untuk badge & pesannya.
        if (json?.sumber === 'ai' && Array.isArray(json.kandidat) && json.kandidat.length) {
          setKandidatAI(json.kandidat as KandidatJudul[]);
        } else {
          setKandidatAI(null);
          if (json?.pesan) setPesanAI(String(json.pesan));
        }
      } catch {
        setKandidatAI(null);
        setPesanAI('Gagal menghubungi penyusun judul — saran otomatis biasa tetap bisa dipakai.');
      } finally {
        setMemuatAI(false);
      }
    },
    [siap, sidik],
  );

  useEffect(() => {
    if (!aktif || !siap) return;
    if (sidikDiminta.current === sidik) return;

    // Jeda: agent masih bisa mengubah foto/deskripsi setelah tiba di langkah
    // ini, dan tiap perubahan mengubah sidik data. Menunggu sejenak membuat
    // satu listing cukup satu panggilan, bukan satu panggilan per ketikan.
    const jeda = setTimeout(() => {
      sidikDiminta.current = sidik;
      void mintaSaranAI(false);
    }, 900);
    return () => clearTimeout(jeda);
  }, [aktif, siap, sidik, mintaSaranAI]);

  const penilaian = useMemo(() => nilaiJudul(judul, data), [judul, sidik]); // eslint-disable-line react-hooks/exhaustive-deps
  const warna = warnaSkor(penilaian.skor);

  /**
   * Judul terisi sendiri, dan tetap SEGAR selama agent belum menyentuhnya.
   *
   * Kenapa bukan sekali isi lalu berhenti: komponen ini ikut ter-mount sejak
   * langkah pertama (semua step dirender, hanya disembunyikan), jadi pengisian
   * "sekali saja" akan terjadi tepat saat kota baru diisi di langkah 2 — dan
   * judul yang tertinggal itu tidak akan pernah menyebut harga, luas, atau
   * kamar yang diisi sesudahnya.
   *
   * Kenapa tidak selalu menimpa: begitu agent memilih salah satu saran atau
   * mengetik sendiri, judul itu MILIK DIA. Penguncian di bawah memastikan
   * mesin tidak pernah menimpa keputusan orang.
   */
  const dikunci = useRef(isEditMode);
  /** Judul terakhir yang ditulis mesin — hanya nilai ini yang boleh disegarkan. */
  const judulOtomatisRef = useRef<string | null>(null);
  const [terisiOtomatis, setTerisiOtomatis] = useState(false);

  useEffect(() => {
    if (dikunci.current || kandidat.length === 0) return;

    // Judul yang ada tapi BUKAN tulisan mesin = tulisan agent (mis. draft lama
    // yang dipulihkan dari localStorage). Kunci, jangan disentuh.
    const sekarang = judul.trim();
    if (sekarang.length > 0 && sekarang !== judulOtomatisRef.current) {
      dikunci.current = true;
      setTerisiOtomatis(false);
      return;
    }

    const terbaik = [...kandidat].sort((a, b) => b.skor - a.skor)[0];
    if (terbaik.teks === sekarang) return;

    judulOtomatisRef.current = terbaik.teks;
    setTerisiOtomatis(true);
    onChange(terbaik.teks);
  }, [kandidat, judul, onChange]);

  /** Sentuhan agent — apa pun bentuknya — menghentikan penyegaran otomatis. */
  const kunci = () => {
    dikunci.current = true;
    setTerisiOtomatis(false);
  };

  const pakai = (k: KandidatJudul) => {
    kunci();
    onChange(k.teks);
  };

  const terpakai = (k: KandidatJudul) =>
    k.teks.trim().toLowerCase() === judul.trim().toLowerCase();

  const panjangKritis = judul.length > JUDUL_IDEAL_MAKS;

  return (
    <div className="space-y-3.5">
      {/* ── Kepala bagian ── */}
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600">
          <Type className="h-4 w-4 text-white" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-1.5">
            <span className="text-[10px] font-black tabular-nums text-slate-600">2</span>
            <span className="truncate text-sm font-bold text-slate-100">
              Judul Listing <span className="text-red-400">*</span>
            </span>
          </span>
          <span className="block truncate text-[11px] text-slate-500">
            Dirangkai dari lokasi &amp; patokan terdekat — tinggal pilih atau ubah
          </span>
        </span>
        {judul.trim().length > 0 && (
          <span
            className={cn(
              'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums',
              warna.bg,
              warna.teks,
            )}
          >
            {penilaian.skor}%
          </span>
        )}
      </div>

      {/* ── Kolom judul ── */}
      <div className="space-y-2">
        <div className="relative">
          <input
            type="text"
            value={judul}
            onChange={(e) => {
              kunci();
              onChange(e.target.value);
            }}
            // Kolom ini berada di langkah terakhir, satu form dengan tombol
            // Publish. Tanpa penjaga ini, menekan Enter setelah mengetik judul
            // langsung menerbitkan listing — gerak refleks yang di semua kolom
            // lain (langkah 1–4) hanya berarti "lanjut".
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.preventDefault();
            }}
            maxLength={JUDUL_MAKS}
            placeholder={
              siap
                ? 'Pilih salah satu saran di bawah, atau tulis sendiri…'
                : 'Lengkapi kategori & lokasi dulu supaya judul bisa dirangkai otomatis'
            }
            aria-label="Judul listing"
            className={cn(
              'h-14 w-full rounded-xl border-2 bg-slate-900/50 pl-4 pr-16 text-sm font-bold text-slate-100 transition-all sm:text-base',
              'placeholder:text-xs placeholder:font-medium placeholder:text-slate-600 sm:placeholder:text-sm',
              'focus:outline-none focus:ring-2',
              error
                ? 'border-red-500/60 focus:border-red-500/60 focus:ring-red-500/20'
                : 'border-slate-800 focus:border-emerald-500/60 focus:ring-emerald-500/20',
            )}
          />

          <div className="pointer-events-none absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-2">
            {judul.length > 0 && (
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums',
                  panjangKritis
                    ? 'bg-amber-400/15 text-amber-300'
                    : judul.length >= JUDUL_MIN
                      ? 'bg-emerald-400/15 text-emerald-300'
                      : 'bg-slate-800 text-slate-400',
                )}
              >
                {judul.length}
              </span>
            )}
          </div>
        </div>

        <AnimatePresence>
          {terisiOtomatis && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-center gap-2 text-xs font-semibold text-emerald-400"
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              Judul dibuatkan otomatis dari data properti Anda — silakan ubah kalau perlu.
            </motion.p>
          )}
        </AnimatePresence>

        {error && (
          <p className="flex items-center gap-2 text-xs font-semibold text-red-400">
            <X className="h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        )}
      </div>

      {/* ── Penilaian: skor + kriteria ── */}
      {judul.trim().length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2.5"
        >
          {/* Empat kriteria sebagai pil dalam satu baris yang membungkus —
              dulu grid dua kolom setinggi 88px plus bar & angka raksasa yang
              mengulang skor yang kini sudah tercetak di kepala bagian. */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn('mr-0.5 text-[11px] font-bold', warna.teks)}>
              {labelSkor(penilaian.skor)}
            </span>
            {penilaian.kriteria.map((k) => (
              <span
                key={k.label}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-bold',
                  k.lulus
                    ? 'bg-emerald-400/[0.10] text-emerald-300'
                    : 'bg-white/[0.04] text-slate-400',
                )}
              >
                <span
                  className={cn(
                    'grid h-3 w-3 shrink-0 place-items-center rounded-full',
                    k.lulus ? 'bg-emerald-400 text-slate-950' : 'border border-slate-600',
                  )}
                >
                  {k.lulus && <Check className="h-1.5 w-1.5" strokeWidth={5} />}
                </span>
                {k.label}
              </span>
            ))}
          </div>

          {penilaian.tips.length > 0 && (
            <ul className="mt-2 space-y-1 border-t border-slate-800 pt-2">
              {penilaian.tips.map((t) => (
                <li key={t} className="flex items-start gap-1.5 text-[10.5px] leading-snug text-slate-400">
                  <Info className="mt-px h-3 w-3 shrink-0 text-amber-400" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      )}

      {/* ── Saran judul ── */}
      {siap && kandidat.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              {memuatAI ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              )}
              {memuatAI ? 'Menyusun judul…' : `${kandidat.length} saran judul`}
            </p>

            {/* Badge sumber. Agent berhak tahu mana yang ditulis model dan mana
                yang dirakit template — keduanya sah, tapi tingkat kepercayaan
                yang pantas diberikan kepadanya berbeda. */}
            {!memuatAI && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider',
                  dariAI
                    ? 'bg-emerald-400/15 text-emerald-300'
                    : 'bg-white/[0.06] text-slate-500',
                )}
              >
                {dariAI ? 'Ditulis AI' : 'Otomatis'}
              </span>
            )}

            {/* "Tulis ulang" hanya berarti kalau modelnya memang menjawab —
                mesin aturan deterministik, menekannya akan mengembalikan tiga
                kalimat yang sama persis. */}
            {dariAI && !memuatAI && (
              <button
                type="button"
                onClick={() => void mintaSaranAI(true)}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-400 transition-colors hover:bg-white/5 hover:text-emerald-300"
              >
                <RefreshCw className="h-3 w-3" />
                Tulis ulang
              </button>
            )}
          </div>

          {pesanAI && (
            <p className="flex items-start gap-1.5 text-[10.5px] leading-snug text-amber-400/80">
              <Info className="mt-px h-3 w-3 shrink-0" />
              {pesanAI}
            </p>
          )}

          <div className="space-y-2">
            {kandidat.map((k) => {
              // Sengaja BUKAN `aktif`: nama itu sudah dipakai prop yang menandai
              // langkah 5 sedang tampil, dan menutupinya di sini membuat siapa
              // pun yang membaca blok ini salah mengira keduanya hal yang sama.
              const dipakai = terpakai(k);
              const w = warnaSkor(k.skor);
              return (
                <motion.button
                  key={k.id}
                  type="button"
                  onClick={() => pakai(k)}
                  whileTap={{ scale: 0.99 }}
                  className={cn(
                    'group relative w-full overflow-hidden rounded-xl border-2 p-3 text-left transition-all duration-200',
                    dipakai
                      ? 'border-emerald-500/60 bg-gradient-to-br from-emerald-500/10 via-teal-500/[0.04] to-transparent'
                      : 'border-slate-800 bg-slate-900/40 hover:border-emerald-500/40 hover:bg-slate-900/70',
                  )}
                >
                  <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider',
                        dipakai ? 'bg-emerald-400/20 text-emerald-300' : 'bg-white/[0.06] text-slate-400',
                      )}
                    >
                      {k.gaya}
                    </span>
                    <span className={cn('text-[11px] font-bold tabular-nums', w.teks)}>
                      {k.skor}%
                    </span>
                    <span className="text-[11px] tabular-nums text-slate-600">
                      {k.teks.length} karakter
                    </span>
                    {dipakai && (
                      <span className="ml-auto flex items-center gap-1 text-[11px] font-bold text-emerald-300">
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        Dipakai
                      </span>
                    )}
                  </div>

                  <p
                    className={cn(
                      'text-sm font-bold leading-snug transition-colors',
                      dipakai ? 'text-white' : 'text-slate-200 group-hover:text-white',
                    )}
                  >
                    {k.teks}
                  </p>

                  {/* Alasan dipertahankan (itu yang membuat pilihan gaya
                      jadi keputusan, bukan tebakan) tapi dipadatkan. Baris
                      "Ketuk untuk pakai judul ini" dihapus: di layar sentuh ia
                      tidak pernah muncul, dan di desktop ia menjelaskan hal
                      yang sudah dijelaskan oleh kursor. */}
                  <p className="text-[10.5px] leading-snug text-slate-500">
                    {k.alasan}
                  </p>
                </motion.button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-3">
          <Info className="mt-px h-3.5 w-3.5 shrink-0 text-amber-400" />
          <p className="text-[11px] leading-relaxed text-slate-300">
            Saran judul muncul setelah{' '}
            <span className="font-bold text-amber-300">kategori properti</span> dan{' '}
            <span className="font-bold text-amber-300">kota</span> terisi. Yang paling
            menguatkan judul adalah{' '}
            <span className="font-bold text-amber-300">patokan terdekat</span> di langkah
            Lokasi — nama kampus atau stasiun persis kata yang diketik orang saat mencari.
          </p>
        </div>
      )}
    </div>
  );
}

export default JudulOtomatis;
