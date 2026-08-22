'use client';

/**
 * AksesTerdekatInput — daftar patokan / akses terdekat.
 *
 * MASALAH YANG DIPERBAIKI DI VERSI INI. Sebelumnya tiap patokan adalah satu
 * baris editor penuh setinggi ±90 px yang selalu terbuka. Dengan batas 6
 * patokan itu masih tertahankan; begitu agent boleh memungut SEMUA hasil
 * pemindaian sekitar (bisa puluhan), bentuk itu berubah jadi dinding scroll
 * sepanjang 2000 px — dan yang harus discroll bukan informasi, melainkan kotak
 * isian yang 95% -nya tidak akan disentuh lagi.
 *
 * BENTUK SEKARANG: RINGKAS DULU, EDIT KALAU PERLU.
 *
 *   • Satu patokan = satu baris 52 px: ikon kategori, nama, jarak. Itu saja
 *     yang perlu dibaca untuk memeriksa daftarnya benar.
 *   • Baris dibuka hanya saat mau diubah, satu per satu (akordeon). Yang baru
 *     ditambah manual langsung terbuka & fokus, karena memang belum ada isinya.
 *   • Daftarnya punya tinggi maksimum sendiri begitu isinya banyak, jadi
 *     panjang halaman TIDAK ikut tumbuh seiring jumlah patokan. Tombol "Lanjut"
 *     tetap berada di jarak yang sama dari layar, berapa pun yang dipilih.
 *
 * Panel saran Google Places di-portal ke <body> — daftarnya harus bisa muncul
 * menembus wadah yang bisa di-scroll; kalau dirender di dalam, ia terpotong
 * tepat saat baris yang diedit berada di dasar wadah.
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import {
  ChevronDown,
  X,
  Plus,
  MapPin,
  Loader2,
  Check,
  Pencil,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { jarakKm, bulatkanJarakKm } from '@/lib/geo';
import { MAKS_HASIL } from '@/lib/nearbyPlaces';
import {
  AKSES_TIPE_OPTIONS,
  AKSES_SATUAN_OPTIONS,
  type AksesTerdekat,
  type AksesTipe,
  type AksesSatuan,
} from '@/app/tambah-property/types/listing';

/**
 * Batas patokan = batas hasil satu kali pemindaian sekitar. Dipilih supaya
 * "Pilih semua" di panel pindai tidak pernah menabrak dinding: apa pun yang
 * ditemukan mesin boleh diadopsi seluruhnya kalau agent memang mau. Angkanya
 * tetap ada (bukan tak terbatas) karena kolomnya JSON di satu baris listing —
 * daftar yang tumbuh tanpa batas adalah cara paling pelan membuat halaman
 * detail berhenti bisa dibuka.
 */
export const MAKS_PATOKAN = MAKS_HASIL;

/** Di atas jumlah ini daftar diberi tinggi tetap + scroll sendiri. */
const AMBANG_SCROLL = 6;

const CONTOH_NAMA: Record<AksesTipe, string> = {
  KAMPUS: 'Universitas Brawijaya',
  SEKOLAH: 'SMAN 5 Surabaya',
  STASIUN: 'Stasiun Gubeng',
  HALTE: 'Terminal Bungurasih',
  BANDARA: 'Bandara Juanda',
  MALL: 'Tunjungan Plaza',
  PASAR: 'Pasar Genteng',
  RUMAH_SAKIT: 'RS Dr. Soetomo',
  PERKANTORAN: 'Graha Pena',
  MASJID: 'Masjid Al-Akbar',
  MINIMARKET: 'Indomaret Kapasari',
  LAINNYA: 'Alun-alun kota',
};

/** Tipe Google Places → kategori kita, untuk menebak kategori otomatis. */
const PLACE_TYPE_MAP: [string, AksesTipe][] = [
  ['university', 'KAMPUS'],
  ['school', 'SEKOLAH'],
  ['train_station', 'STASIUN'],
  ['subway_station', 'STASIUN'],
  ['bus_station', 'HALTE'],
  ['transit_station', 'HALTE'],
  ['airport', 'BANDARA'],
  ['shopping_mall', 'MALL'],
  ['department_store', 'MALL'],
  ['supermarket', 'PASAR'],
  ['hospital', 'RUMAH_SAKIT'],
  ['mosque', 'MASJID'],
  ['convenience_store', 'MINIMARKET'],
];

const tebakTipe = (types: string[] = []): AksesTipe | null => {
  for (const [pt, tipe] of PLACE_TYPE_MAP) if (types.includes(pt)) return tipe;
  return null;
};

const ikonTipe = (tipe: AksesTipe) =>
  AKSES_TIPE_OPTIONS.find((t) => t.value === tipe)?.icon ??
  'solar:map-point-bold-duotone';

const labelTipe = (tipe: AksesTipe) =>
  AKSES_TIPE_OPTIONS.find((t) => t.value === tipe)?.label ?? 'Lainnya';

// ---------------------------------------------------------------------------
// Dropdown kategori — panel di-portal ke <body> agar tidak terpotong ancestor
// ber-transform maupun wadah daftar yang bisa di-scroll.
// ---------------------------------------------------------------------------
function KategoriPicker({
  value,
  onChange,
}: {
  value: AksesTipe;
  onChange: (v: AksesTipe) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const update = () => btnRef.current && setRect(btnRef.current.getBoundingClientRect());
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const W = Math.max(rect?.width ?? 220, 230);
  const left = Math.max(8, Math.min(rect?.left ?? 8, vw - W - 8));
  const spaceBelow = rect ? vh - rect.bottom - 16 : 400;
  const keAtas = spaceBelow < 300 && (rect?.top ?? 0) > spaceBelow;
  const maxH = Math.min(320, Math.max(200, keAtas ? (rect?.top ?? 0) - 16 : spaceBelow));
  const top = keAtas ? (rect?.top ?? 0) - maxH - 8 : (rect?.bottom ?? 0) + 8;

  const panel = (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: keAtas ? 6 : -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: keAtas ? 6 : -6, scale: 0.98 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          style={{ position: 'fixed', top, left, width: W, maxHeight: maxH, zIndex: 99999 }}
          className="overflow-y-auto rounded-2xl border border-white/10 bg-slate-950 p-1.5 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.9)] [scrollbar-width:thin]"
        >
          {AKSES_TIPE_OPTIONS.map((opt) => {
            const aktif = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors',
                  aktif ? 'bg-emerald-500/10' : 'hover:bg-white/5',
                )}
              >
                <span
                  className={cn(
                    'grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors',
                    aktif ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800/80 text-slate-400',
                  )}
                >
                  <Icon icon={opt.icon} className="h-4 w-4" />
                </span>
                <span
                  className={cn(
                    'flex-1 truncate text-sm font-semibold',
                    aktif ? 'text-emerald-300' : 'text-slate-300',
                  )}
                >
                  {opt.label}
                </span>
                {aktif && <Check className="h-4 w-4 shrink-0 text-emerald-400" strokeWidth={3} />}
              </button>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="group flex h-full w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors hover:bg-white/[0.03]"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-500/15 text-emerald-300">
          <Icon icon={ikonTipe(value)} className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
            Kategori
          </span>
          <span className="block truncate text-sm font-bold text-slate-100">
            {labelTipe(value)}
          </span>
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>
      {mounted ? createPortal(panel, document.body) : null}
    </>
  );
}

// ---------------------------------------------------------------------------

interface Props {
  value: AksesTerdekat[];
  onChange: (next: AksesTerdekat[]) => void;
  propertyCoords?: { lat: number; lng: number } | null;
  placesReady?: boolean;
}

type Prediksi = { placeId: string; utama: string; sekunder: string; tipe: AksesTipe | null };

export function AksesTerdekatInput({
  value,
  onChange,
  propertyCoords,
  placesReady,
}: Props) {
  const rows = value ?? [];
  const penuh = rows.length >= MAKS_PATOKAN;

  /** Baris yang sedang dibuka editornya. Satu saja — akordeon, bukan daftar form. */
  const [terbuka, setTerbuka] = useState<number | null>(null);
  const [prediksi, setPrediksi] = useState<Prediksi[]>([]);
  const [mencari, setMencari] = useState(false);
  const [fokusIndex, setFokusIndex] = useState<number | null>(null);
  const [konfirmasiHapusSemua, setKonfirmasiHapusSemua] = useState(false);

  const namaRefs = useRef<(HTMLInputElement | null)[]>([]);
  const acRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const detailRef = useRef<google.maps.places.PlacesService | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bisaCari = Boolean(placesReady && typeof google !== 'undefined' && google.maps?.places);

  useEffect(() => {
    if (!bisaCari) return;
    if (!acRef.current) acRef.current = new google.maps.places.AutocompleteService();
    if (!detailRef.current)
      detailRef.current = new google.maps.places.PlacesService(document.createElement('div'));
  }, [bisaCari]);

  useEffect(() => {
    if (fokusIndex === null) return;
    namaRefs.current[fokusIndex]?.focus();
    setFokusIndex(null);
  }, [fokusIndex]);

  // Daftar menyusut sampai di bawah ambang → tidak perlu lagi kotak bergulir.
  const banyak = rows.length > AMBANG_SCROLL;

  const ringkasKategori = useMemo(() => {
    const set = new Set(rows.map((r) => r.tipe));
    return set.size;
  }, [rows]);

  const patchRow = (i: number, patch: Partial<AksesTerdekat>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const addRow = () => {
    if (penuh) return;
    onChange([...rows, { tipe: 'KAMPUS', nama: '', jarak: null, satuan: 'MENIT' }]);
    setTerbuka(rows.length);
    setFokusIndex(rows.length);
  };

  const removeRow = (i: number) => {
    onChange(rows.filter((_, idx) => idx !== i));
    setPrediksi([]);
    // Indeks di bawah baris yang dihapus bergeser naik satu — kalau `terbuka`
    // tidak ikut digeser, yang terbuka jadi baris yang salah.
    setTerbuka((t) => (t === null ? null : t === i ? null : t > i ? t - 1 : t));
  };

  const hapusSemua = () => {
    onChange([]);
    setTerbuka(null);
    setPrediksi([]);
    setKonfirmasiHapusSemua(false);
  };

  const cari = useCallback(
    (teks: string) => {
      if (!bisaCari || teks.trim().length < 2) {
        setPrediksi([]);
        setMencari(false);
        return;
      }
      setMencari(true);
      acRef.current?.getPlacePredictions(
        {
          input: teks,
          types: ['establishment'],
          componentRestrictions: { country: 'id' },
          ...(propertyCoords && {
            location: new google.maps.LatLng(propertyCoords.lat, propertyCoords.lng),
            radius: 15000,
          }),
        },
        (hasil, status) => {
          setMencari(false);
          if (status !== google.maps.places.PlacesServiceStatus.OK || !hasil) {
            setPrediksi([]);
            return;
          }
          setPrediksi(
            hasil.slice(0, 5).map((p) => ({
              placeId: p.place_id,
              utama: p.structured_formatting.main_text,
              sekunder: p.structured_formatting.secondary_text ?? '',
              tipe: tebakTipe(p.types),
            })),
          );
        },
      );
    },
    [bisaCari, propertyCoords],
  );

  const handleNama = (i: number, teks: string) => {
    patchRow(i, { nama: teks });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => cari(teks), 300);
  };

  /** Pilih saran → isi nama, tebak kategori, hitung jarak dari koordinat. */
  const pilih = (i: number, p: Prediksi) => {
    setPrediksi([]);
    const patchDasar: Partial<AksesTerdekat> = {
      nama: p.utama,
      ...(p.tipe ? { tipe: p.tipe } : {}),
    };

    if (!detailRef.current || !propertyCoords) {
      patchRow(i, patchDasar);
      return;
    }
    detailRef.current.getDetails(
      { placeId: p.placeId, fields: ['geometry.location'] },
      (place, status) => {
        const lok = place?.geometry?.location;
        if (status !== google.maps.places.PlacesServiceStatus.OK || !lok) {
          patchRow(i, patchDasar);
          return;
        }
        patchRow(i, {
          ...patchDasar,
          jarak: bulatkanJarakKm(
            jarakKm(propertyCoords, { lat: lok.lat(), lng: lok.lng() }),
          ),
          satuan: 'KM',
        });
      },
    );
  };

  const teksJarak = (r: AksesTerdekat) =>
    r.jarak != null ? `${r.jarak} ${r.satuan === 'KM' ? 'km' : 'mnt'}` : null;

  return (
    <div className="space-y-3">
      {/* ── Kepala daftar: jumlah + aksi massal ── */}
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
            {rows.length} patokan
            {ringkasKategori > 1 && (
              <span className="text-slate-600"> · {ringkasKategori} kategori</span>
            )}
          </p>

          <div className="ml-auto flex items-center gap-2">
            {konfirmasiHapusSemua ? (
              <>
                <span className="text-[11px] font-semibold text-slate-400">
                  Hapus semua?
                </span>
                <button
                  type="button"
                  onClick={hapusSemua}
                  className="rounded-lg bg-red-500/15 px-2.5 py-1 text-[11px] font-bold text-red-300 transition-colors hover:bg-red-500/25"
                >
                  Ya, hapus
                </button>
                <button
                  type="button"
                  onClick={() => setKonfirmasiHapusSemua(false)}
                  className="rounded-lg px-2.5 py-1 text-[11px] font-bold text-slate-400 transition-colors hover:bg-white/5"
                >
                  Batal
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setKonfirmasiHapusSemua(true)}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-300"
              >
                <Trash2 className="h-3 w-3" />
                Kosongkan
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Daftar patokan ── */}
      {rows.length > 0 && (
        <div
          className={cn(
            'overflow-hidden rounded-2xl border-2 border-slate-800 bg-slate-900/40',
            // Tinggi tetap begitu isinya banyak: panjang halaman tidak boleh
            // ikut tumbuh seiring jumlah patokan yang dipilih.
            banyak && 'max-h-[26rem] overflow-y-auto [scrollbar-width:thin]',
          )}
        >
          <AnimatePresence initial={false}>
            {rows.map((row, i) => {
              const dibuka = terbuka === i;
              const adaSaran = dibuka && prediksi.length > 0;
              const jarak = teksJarak(row);
              const kosong = !row.nama?.trim();

              return (
                <motion.div
                  key={i}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="border-b border-slate-800 last:border-b-0"
                >
                  {/* Baris ringkas — satu tarikan mata, tanpa kotak isian */}
                  <div
                    className={cn(
                      'flex items-center gap-2.5 px-3 transition-colors',
                      dibuka ? 'bg-emerald-500/[0.06]' : 'hover:bg-white/[0.02]',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setPrediksi([]);
                        setTerbuka(dibuka ? null : i);
                        if (!dibuka) setFokusIndex(i);
                      }}
                      aria-expanded={dibuka}
                      className="flex min-w-0 flex-1 items-center gap-2.5 py-2.5 text-left"
                    >
                      <span
                        className={cn(
                          'grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors',
                          dibuka
                            ? 'bg-emerald-500/25 text-emerald-200'
                            : 'bg-emerald-500/10 text-emerald-300',
                        )}
                      >
                        <Icon icon={ikonTipe(row.tipe)} className="h-[17px] w-[17px]" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            'block truncate text-sm font-bold',
                            kosong ? 'text-slate-500' : 'text-slate-100',
                          )}
                        >
                          {kosong ? 'Ketuk untuk isi nama tempat' : row.nama}
                        </span>
                        <span className="block truncate text-[11px] text-slate-500">
                          {labelTipe(row.tipe)}
                        </span>
                      </span>

                      {jarak && (
                        <span className="shrink-0 rounded-lg bg-white/[0.06] px-2 py-1 text-[11px] font-bold tabular-nums text-slate-200">
                          {jarak}
                        </span>
                      )}

                      <Pencil
                        className={cn(
                          'h-3.5 w-3.5 shrink-0 transition-colors',
                          dibuka ? 'text-emerald-400' : 'text-slate-600',
                        )}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      aria-label={`Hapus patokan ${row.nama || i + 1}`}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-600 transition-colors hover:bg-red-500/10 hover:text-red-400"
                    >
                      <X className="h-4 w-4" strokeWidth={2.5} />
                    </button>
                  </div>

                  {/* Editor — hanya untuk baris yang sedang dibuka */}
                  <AnimatePresence initial={false}>
                    {dibuka && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-3">
                          <div
                            className={cn(
                              'flex flex-col overflow-visible rounded-xl border border-slate-700/70 bg-black/30',
                              'divide-y divide-slate-800 transition-colors',
                              'focus-within:border-emerald-500/50 sm:flex-row sm:divide-x sm:divide-y-0',
                            )}
                          >
                            <div className="shrink-0 sm:w-[180px]">
                              <KategoriPicker
                                value={row.tipe}
                                onChange={(v) => patchRow(i, { tipe: v })}
                              />
                            </div>

                            <div className="relative min-w-0 flex-1 px-3.5 py-2">
                              <label
                                htmlFor={`akses-nama-${i}`}
                                className="mb-0.5 block text-[10px] font-extrabold uppercase tracking-wider text-slate-500"
                              >
                                Nama Tempat
                              </label>
                              <input
                                id={`akses-nama-${i}`}
                                ref={(el) => {
                                  namaRefs.current[i] = el;
                                }}
                                type="text"
                                value={row.nama}
                                onChange={(e) => handleNama(i, e.target.value)}
                                onBlur={() => setTimeout(() => setPrediksi([]), 150)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (adaSaran) pilih(i, prediksi[0]);
                                    else setTerbuka(null);
                                  }
                                  if (e.key === 'Escape') setPrediksi([]);
                                }}
                                placeholder={CONTOH_NAMA[row.tipe]}
                                autoComplete="off"
                                className="w-full bg-transparent pr-6 text-sm font-bold text-slate-100 placeholder:font-medium placeholder:text-slate-500 focus:outline-none"
                              />
                              {mencari && dibuka && (
                                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 animate-spin text-emerald-400" />
                              )}

                              <SaranTempat
                                tampil={adaSaran}
                                anchorId={`akses-nama-${i}`}
                                prediksi={prediksi}
                                onPilih={(p) => pilih(i, p)}
                              />
                            </div>

                            <div className="flex shrink-0 divide-x divide-slate-800">
                              <div className="flex-1 px-3.5 py-2 sm:w-[86px] sm:flex-none">
                                <label
                                  htmlFor={`akses-jarak-${i}`}
                                  className="mb-0.5 block text-[10px] font-extrabold uppercase tracking-wider text-slate-500"
                                >
                                  Jarak
                                </label>
                                <input
                                  id={`akses-jarak-${i}`}
                                  type="text"
                                  inputMode="decimal"
                                  value={row.jarak ?? ''}
                                  onChange={(e) => {
                                    const bersih = e.target.value
                                      .replace(',', '.')
                                      .replace(/[^0-9.]/g, '')
                                      .replace(/(\..*)\./g, '$1');
                                    patchRow(i, { jarak: bersih ? Number(bersih) : null });
                                  }}
                                  placeholder="5"
                                  className="w-full bg-transparent text-sm font-bold text-slate-100 placeholder:font-medium placeholder:text-slate-500 focus:outline-none"
                                />
                              </div>

                              <div className="flex-1 px-3 py-2 sm:flex-none">
                                <span className="mb-0.5 block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                                  Satuan
                                </span>
                                <div className="flex gap-1">
                                  {AKSES_SATUAN_OPTIONS.map((s) => (
                                    <button
                                      key={s.value}
                                      type="button"
                                      onClick={() =>
                                        patchRow(i, { satuan: s.value as AksesSatuan })
                                      }
                                      className={cn(
                                        'rounded-md px-2 py-0.5 text-xs font-bold transition-colors',
                                        row.satuan === s.value
                                          ? 'bg-emerald-500/20 text-emerald-300'
                                          : 'text-slate-500 hover:bg-white/5 hover:text-slate-300',
                                      )}
                                    >
                                      {s.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setPrediksi([]);
                              setTerbuka(null);
                            }}
                            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-bold text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200"
                          >
                            <Check className="h-3.5 w-3.5" strokeWidth={3} />
                            Selesai
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Tambah baris manual */}
      <button
        type="button"
        onClick={addRow}
        disabled={penuh}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-3.5 text-sm font-bold transition-all',
          penuh
            ? 'cursor-not-allowed border-slate-800/60 text-slate-700'
            : 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400 hover:border-emerald-500/60 hover:bg-emerald-500/[0.12]',
        )}
      >
        <span
          className={cn(
            'grid h-6 w-6 place-items-center rounded-lg transition-colors',
            penuh ? 'bg-slate-800/60' : 'bg-emerald-500/20',
          )}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
        {penuh ? `Maksimal ${MAKS_PATOKAN} patokan` : 'Tambah Patokan Manual'}
      </button>

      {bisaCari && !propertyCoords && rows.length > 0 && (
        <p className="flex items-center gap-1.5 text-[11px] text-amber-500/80">
          <MapPin className="h-3 w-3 shrink-0" />
          Tandai lokasi di peta dulu supaya jarak terisi otomatis saat memilih tempat.
        </p>
      )}
    </div>
  );
}

/**
 * Panel saran Google Places, di-portal ke <body>.
 *
 * Posisinya diambil dari elemen input lewat `getBoundingClientRect` dan
 * diperbarui saat halaman digulir — termasuk gulir di dalam wadah daftar
 * (`capture: true` pada listener scroll). Tanpa portal, panel ini terpotong
 * oleh `overflow-y-auto` wadah daftar tepat pada baris terbawah, yaitu baris
 * yang paling sering baru ditambahkan.
 */
function SaranTempat({
  tampil,
  anchorId,
  prediksi,
  onPilih,
}: {
  tampil: boolean;
  anchorId: string;
  prediksi: Prediksi[];
  onPilih: (p: Prediksi) => void;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!tampil) return;
    const update = () => {
      const el = document.getElementById(anchorId);
      if (el) setRect(el.getBoundingClientRect());
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [tampil, anchorId, prediksi.length]);

  if (!mounted || !tampil || !rect) return null;

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const W = Math.max(rect.width, 240);
  const left = Math.max(8, Math.min(rect.left, vw - W - 8));
  const ruangBawah = vh - rect.bottom - 12;
  const tinggi = Math.min(260, prediksi.length * 52 + 12);
  const keAtas = ruangBawah < tinggi && rect.top > ruangBawah;
  const top = keAtas ? rect.top - tinggi - 8 : rect.bottom + 8;

  return createPortal(
    <motion.ul
      initial={{ opacity: 0, y: keAtas ? 4 : -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.14 }}
      style={{
        position: 'fixed',
        top,
        left,
        width: W,
        maxHeight: tinggi,
        zIndex: 99999,
      }}
      className="overflow-y-auto rounded-xl border border-white/10 bg-slate-950 p-1 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.85)] [scrollbar-width:thin]"
    >
      {prediksi.map((p) => (
        <li key={p.placeId}>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPilih(p)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/5"
          >
            <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-slate-100">
                {p.utama}
              </span>
              {p.sekunder && (
                <span className="block truncate text-[11px] text-slate-500">
                  {p.sekunder}
                </span>
              )}
            </span>
          </button>
        </li>
      ))}
    </motion.ul>,
    document.body,
  );
}

export default AksesTerdekatInput;
