'use client';

/**
 * ImageUploader — unggah foto + atur urutannya: TAHAN, lalu bawa ke tempatnya.
 *
 * Urutan bukan hiasan: foto pertama dipakai sebagai cover di card listing,
 * hasil pencarian, dan preview WhatsApp.
 *
 * ---------------------------------------------------------------------------
 * Model interaksi — dan kenapa dua model sebelumnya gagal
 * ---------------------------------------------------------------------------
 *
 * Percobaan 1 — foto mengikuti jempol, urutan dihitung saat dilepas.
 *   Gagal: foto melayang keluar grid, meninggalkan lubang di tempat asalnya, dan
 *   pengguna tidak tahu ia akan mendarat di mana sampai melepas.
 *
 * Percobaan 2 — foto TIDAK mengikuti jempol, urutan data langsung ditukar.
 *   Gagal dua kali: (a) ambang di garis tengah antar petak → bertukar bolak-balik
 *   karena getaran jempol; (b) ambang dinaikkan ke pusat petak tujuan → jadi
 *   terlalu berat, harus menyeret jauh, dan karena fotonya sama sekali tidak
 *   bergerak, tidak ada umpan balik seberapa jauh lagi harus digeser.
 *
 * Yang dipakai sekarang — pola yang sudah terbukti di galeri ponsel:
 *
 *   1. Foto yang dipegang MENGIKUTI jempol, tapi DIKURUNG di dalam grid
 *      (`dragConstraints`), jadi ia tidak pernah melayang keluar area.
 *   2. Foto lain MEMBUKA CELAH: begitu titik tengah foto yang dibawa masuk ke
 *      petak lain, foto di antara asal & tujuan bergeser satu petak untuk
 *      memberi ruang. Yang terlihat selama menggeser adalah tempat mendarat
 *      sebenarnya — tidak ada kejutan saat dilepas.
 *   3. Selama menggeser, URUTAN DATA TIDAK DIUBAH sama sekali; yang berubah hanya
 *      posisi visual. Ini menghapus dua penyakit lama sekaligus: tidak ada
 *      pertukaran beruntun yang berkedip, dan foto yang dipegang mustahil
 *      berganti identitas. Urutan diubah SEKALI, saat dilepas.
 *   4. Ambangnya setengah petak — diukur dari foto yang bergerak bersama jempol,
 *      jadi terasa ringan. Tetap tenang karena yang bergeser hanyalah celah,
 *      bukan susunan data.
 *   5. TIDAK memakai `layout` framer-motion sama sekali. Ini penting: `layout`
 *      memindahkan elemen lewat proyeksi hasil PENGUKURAN, sementara celah &
 *      drag memindahkannya lewat transform x/y. Dua mesin yang mengatur posisi
 *      elemen yang sama akan saling menghitung dari hasil kerja yang lain —
 *      kartu mendarat di petak yang salah, bertumpuk, bahkan terlempar keluar
 *      grid. Di sini x/y punya SATU pemilik pada satu waktu: drag selagi
 *      dipegang, animasi imperatif di luar itu.
 *
 *   6. Aktif hanya setelah ditahan ~200ms, dan prop `drag` baru dipasang saat itu:
 *      framer-motion memasang `touch-action: none` pada elemen yang bisa ditarik,
 *      jadi kalau dipasang sejak awal layar tidak bisa di-scroll di atas foto.
 *      Dengan penundaan ini — sentuh-geser cepat = scroll halaman, tahan dulu =
 *      atur urutan. Berlaku sama untuk gerakan NAIK-TURUN antar baris di layar
 *      kecil, karena drag-nya dua arah (bukan dikunci satu sumbu).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  motion,
  animate,
  AnimatePresence,
  useMotionValue,
  useDragControls,
} from 'framer-motion';
import { Image as ImageIconLucide, Move, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface ImageFile {
  id: string;
  file?: File | null;
  preview: string;
}

interface ImageUploaderProps {
  value: ImageFile[];
  onChange: (files: ImageFile[]) => void;
  maxFiles?: number;
}

/** Lama menahan sebelum foto ikut tangan. */
const TAHAN_MS = 200;
/** Toleransi gerak selama menahan; lebih dari ini dianggap sedang scroll. */
const TOLERANSI_GESER = 10;

type Titik = { x: number; y: number };

/** Satu watak gerak untuk semua perpindahan kartu, supaya terasa satu sistem. */
const PEGAS = { type: 'spring' as const, stiffness: 520, damping: 42, mass: 0.8 };

/** Pindahkan satu elemen ke posisi lain tanpa mengubah array aslinya. */
export function pindahkan<T>(arr: T[], dari: number, ke: number): T[] {
  if (dari === ke || dari < 0 || ke < 0 || dari >= arr.length || ke >= arr.length) {
    return arr;
  }
  const next = [...arr];
  const [item] = next.splice(dari, 1);
  next.splice(ke, 0, item);
  return next;
}

/**
 * Petak mana yang ditempati sebuah titik.
 *
 * Kalau titiknya tidak persis di dalam petak mana pun (di sela antar petak),
 * dipilih petak dengan pusat terdekat — asal masih dalam jangkauan satu petak.
 * Jempol yang melenceng sedikit tetap terlayani; jempol yang keluar area tidak
 * menyeret apa pun.
 */
export function petakDi(
  petak: { pusat: Titik; w: number; h: number }[],
  t: Titik,
): number | null {
  for (let i = 0; i < petak.length; i++) {
    const p = petak[i];
    if (Math.abs(t.x - p.pusat.x) <= p.w / 2 && Math.abs(t.y - p.pusat.y) <= p.h / 2) {
      return i;
    }
  }
  let terbaik: number | null = null;
  let jarak = Infinity;
  for (let i = 0; i < petak.length; i++) {
    const d = Math.hypot(t.x - petak[i].pusat.x, t.y - petak[i].pusat.y);
    if (d < jarak) {
      jarak = d;
      terbaik = i;
    }
  }
  const jangkauan = petak.length ? Math.hypot(petak[0].w, petak[0].h) : 0;
  return jarak <= jangkauan ? terbaik : null;
}

/**
 * Petak mana yang ditempati foto ke-`i` SELAGI foto `dari` sedang dibawa ke
 * `ke`. Inilah yang membuka celah: foto di antara asal & tujuan bergeser satu
 * petak, sisanya diam.
 */
export function petakTampil(i: number, dari: number, ke: number): number {
  if (dari < ke) return i > dari && i <= ke ? i - 1 : i;
  if (dari > ke) return i >= ke && i < dari ? i + 1 : i;
  return i;
}

// ---------------------------------------------------------------------------
// Satu kartu foto
// ---------------------------------------------------------------------------

interface KartuProps {
  img: ImageFile;
  index: number;
  total: number;
  sedangDipegang: boolean;
  adaYangDipegang: boolean;
  /** Pergeseran visual untuk membuka celah (bukan perubahan urutan data). */
  geser: Titik;
  /** True sesaat setelah dilepas: pergeseran harus dinolkan TANPA animasi,
   *  karena posisi DOM-nya sudah berpindah ke petak yang baru. */
  resetInstan: boolean;
  batasDrag: React.RefObject<HTMLDivElement>;
  /** Mendaftarkan elemen kartu ke parent, berdasarkan ID fotonya. */
  registrasi: (id: string, el: HTMLDivElement | null) => void;
  onMulaiPegang: (id: string) => void;
  onGeser: (pusatFoto: Titik) => void;
  /** Mengembalikan selisih petak asal → petak tujuan, untuk kompensasi lompatan. */
  onSelesai: () => Titik;
  onPindah: (dari: number, ke: number) => void;
  onHapus: (id: string) => void;
}

function KartuFoto({
  img,
  index,
  total,
  sedangDipegang,
  adaYangDipegang,
  geser,
  resetInstan,
  batasDrag,
  registrasi,
  onMulaiPegang,
  onGeser,
  onSelesai,
  onPindah,
  onHapus,
}: KartuProps) {
  const dragControls = useDragControls();
  const [siap, setSiap] = useState(false);

  // x/y dikendalikan sendiri supaya bisa dinolkan tepat saat urutan berubah —
  // lihat `lepas()`.
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  /**
   * Menyala selagi kartu ini meluncur ke tengah petaknya setelah dilepas.
   *
   * Tanpa penanda ini, effect di bawah (yang dipicu `resetInstan` di frame komit)
   * akan menyetel x/y ke nol seketika dan MEMBATALKAN luncuran itu — kartunya
   * mendarat benar, tapi patah, tidak mengalir.
   */
  const mendarat = useRef(false);
  const el = useRef<HTMLDivElement | null>(null);
  const eventAwal = useRef<PointerEvent | null>(null);
  const titikAwal = useRef<Titik>({ x: 0, y: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isCover = index === 0;

  const batalkanTahan = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  /**
   * Ref didaftarkan dengan KUNCI ID, dan callback-nya stabil selama ID tidak
   * berubah.
   *
   * Versi sebelumnya menaruh elemen ke array berdasarkan NOMOR POSISI lewat
   * callback inline. Callback inline dibuat ulang setiap render, jadi saat urutan
   * berubah React memanggil callback lama dengan null lalu callback baru dengan
   * elemennya — dan urutan panggilan antar kartu tidak dijamin. Yang terjadi:
   * satu kartu menulis elemennya ke posisi barunya, kartu berikutnya menulis
   * NULL ke posisi yang sama itu. Satu petak jadi kosong, potret geometrinya
   * berisi koordinat sampah, dan seluruh perhitungan celah ikut kacau — itulah
   * "amburadul" yang terlihat. Dengan kunci ID, tiap kartu hanya pernah menulis
   * ke kuncinya sendiri.
   */
  const daftar = useCallback(
    (node: HTMLDivElement | null) => {
      el.current = node;
      registrasi(img.id, node);
    },
    [img.id, registrasi],
  );

  // Drag baru bisa dimulai setelah render dengan `drag` menyala.
  useEffect(() => {
    if (!siap || !eventAwal.current) return;
    dragControls.start(eventAwal.current);
    onMulaiPegang(img.id);
    navigator.vibrate?.(10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siap]);

  useEffect(() => () => batalkanTahan(), []);

  /**
   * Melaporkan titik tengah kartu dalam RUANG OFFSET (offsetLeft/offsetTop),
   * bukan koordinat viewport.
   *
   * `getBoundingClientRect()` sudah termasuk transform — jadi ia mengembalikan
   * posisi yang sedang dianimasikan, dan keputusan yang dihitung darinya ikut
   * salah (terutama kalau drag baru dimulai selagi kartu lain masih meluncur).
   * `offsetLeft/Top` adalah posisi TATA LETAK: kebal transform, kebal scroll,
   * dan sama-sama relatif terhadap induk yang sama untuk semua kartu.
   */
  const lapor = () => {
    const node = el.current;
    if (!node) return;
    onGeser({
      x: node.offsetLeft + x.get() + node.offsetWidth / 2,
      y: node.offsetTop + y.get() + node.offsetHeight / 2,
    });
  };

  /**
   * Pergeseran celah dijalankan imperatif, BUKAN lewat prop `animate`.
   *
   * Alasannya: selagi kartu ini yang dipegang, x/y dimiliki oleh drag. Kalau
   * prop `animate` juga menyebut x/y, framer akan menariknya kembali ke nilai
   * deklaratif sementara jempol menariknya ke arah lain. Dengan effect ini,
   * pemilik x/y selalu tunggal: drag saat dipegang, animasi saat tidak.
   */
  useEffect(() => {
    if (sedangDipegang) {
      mendarat.current = false;
      return;
    }
    // Selagi mendarat, penolan seketika diabaikan — kecuali memang ada
    // pergeseran baru (kartu lain sedang dibawa), yang harus tetap dilayani.
    const adaGeseranBaru = geser.x !== 0 || geser.y !== 0;
    if (mendarat.current && !adaGeseranBaru) return;
    if (adaGeseranBaru) mendarat.current = false;

    if (resetInstan) {
      x.set(geser.x);
      y.set(geser.y);
      return;
    }
    const a = animate(x, geser.x, PEGAS);
    const b = animate(y, geser.y, PEGAS);
    return () => {
      a.stop();
      b.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geser.x, geser.y, sedangDipegang, resetInstan]);

  /**
   * Melepas. Urutan dikomit lebih dulu — posisi DOM kartu ini langsung berpindah
   * ke petak tujuan. Supaya perpindahan DOM itu tidak terlihat sebagai lompatan,
   * x/y dikurangi selisih petaknya (jadi secara visual kartu TIDAK bergerak
   * sama sekali di frame itu), lalu diluncurkan ke nol: kartu terlihat menyelip
   * rapi ke tengah petaknya dari titik jempol dilepas.
   */
  const lepas = () => {
    const selisih = onSelesai();
    x.set(x.get() - selisih.x);
    y.set(y.get() - selisih.y);
    mendarat.current = true;
    animate(x, 0, { ...PEGAS, onComplete: () => (mendarat.current = false) });
    animate(y, 0, PEGAS);
    setSiap(false);
  };

  return (
    <motion.div
      ref={daftar}
      // Tidak ada prop `layout` — lihat catatan di kepala berkas. x/y juga tidak
      // disebut di `animate`; keduanya diurus effect di atas / drag.
      transition={PEGAS}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{
        opacity: 1,
        scale: sedangDipegang ? 1.08 : 1,
      }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.16 } }}
      style={{ x, y, zIndex: sedangDipegang ? 50 : 1 }}
      drag={siap}
      dragControls={dragControls}
      dragListener={false}
      dragConstraints={batasDrag}
      dragElastic={0}
      dragMomentum={false}
      onDrag={lapor}
      onDragEnd={lepas}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('[data-abaikan-tahan]')) return;
        eventAwal.current = e.nativeEvent;
        titikAwal.current = { x: e.clientX, y: e.clientY };
        batalkanTahan();
        timer.current = setTimeout(() => setSiap(true), TAHAN_MS);
      }}
      onPointerMove={(e) => {
        if (siap) return;
        const jarak = Math.hypot(
          e.clientX - titikAwal.current.x,
          e.clientY - titikAwal.current.y,
        );
        if (jarak > TOLERANSI_GESER) batalkanTahan();
      }}
      onPointerUp={() => (siap ? lepas() : batalkanTahan())}
      onPointerCancel={() => (siap ? lepas() : batalkanTahan())}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' && index > 0) {
          e.preventDefault();
          onPindah(index, index - 1);
        }
        if (e.key === 'ArrowRight' && index < total - 1) {
          e.preventDefault();
          onPindah(index, index + 1);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Foto ${index + 1} dari ${total}${
        isCover ? ' (cover)' : ''
      }. Tahan lalu bawa ke tempatnya, atau pakai tombol panah kiri/kanan.`}
      className={cn(
        'group relative aspect-square select-none overflow-hidden rounded-2xl bg-slate-900 outline-none',
        'border-2',
        sedangDipegang ? 'cursor-grabbing' : 'cursor-grab',
        sedangDipegang
          ? 'border-emerald-400 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.95)]'
          : isCover
          ? 'border-emerald-500/50'
          : 'border-white/10 focus-visible:border-emerald-400/70',
      )}
    >
      <Image
        src={img.preview}
        alt=""
        fill
        className="pointer-events-none object-cover"
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        draggable={false}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/60 to-transparent" />

      {/* Nomor urut — satu-satunya penanda yang selalu tampil, karena angka
          inilah arti dari seluruh fitur ini. */}
      <div className="pointer-events-none absolute left-2 top-2 z-10 flex items-center gap-1.5">
        <span
          className={cn(
            'grid h-6 min-w-6 place-items-center rounded-md px-1.5 text-[11px] font-black',
            isCover ? 'bg-emerald-400 text-black' : 'bg-black/65 text-white backdrop-blur-sm',
          )}
        >
          {index + 1}
        </span>
        {isCover && (
          <span className="rounded-md bg-emerald-400 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-black">
            Cover
          </span>
        )}
      </div>

      {/* Hapus — satu-satunya tombol; redup sampai disentuh. */}
      <button
        type="button"
        data-abaikan-tahan
        onClick={(e) => {
          e.stopPropagation();
          onHapus(img.id);
        }}
        title="Hapus foto"
        aria-label={`Hapus foto ${index + 1}`}
        className="absolute right-2 top-2 z-20 grid h-7 w-7 place-items-center rounded-md bg-black/55 text-white/80 opacity-70 backdrop-blur-sm transition-all hover:bg-red-500 hover:text-white hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* Isyarat cara pakai — hanya di desktop saat kursor di atas foto. */}
      {!adaYangDipegang && (
        <div className="pointer-events-none absolute inset-0 z-10 hidden items-center justify-center md:group-hover:flex">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-black/70 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
            <Move className="h-3.5 w-3.5 text-emerald-400" />
            Tahan &amp; bawa
          </span>
        </div>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------

export function ImageUploader({ value = [], onChange, maxFiles = 10 }: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);

  /** ID foto yang sedang dipegang — ID, bukan nomor posisi: nomor berubah tiap
   *  kali urutan berubah, ID tidak pernah. */
  const [idDipegang, setIdDipegang] = useState<string | null>(null);
  /** Petak tujuan yang sedang dipratayangkan (celah terbuka di sini). */
  const [sasaran, setSasaran] = useState<number | null>(null);
  /**
   * Menyala satu frame setelah dilepas.
   *
   * Saat urutan dikomit, posisi DOM tiap kartu ikut berpindah ke petak barunya —
   * padahal secara visual mereka SUDAH berada di sana (lewat transform celah).
   * Kalau transform itu dinolkan dengan animasi, kartu bergerak dua kali:
   * sekali karena DOM, sekali karena animasi kembali ke nol. Karena itu di frame
   * komit transform dinolkan seketika, tanpa animasi.
   */
  const [resetInstan, setResetInstan] = useState(false);

  const grid = useRef<HTMLDivElement>(null);

  /** Elemen kartu per ID foto — lihat catatan `daftar` di komponen kartu. */
  const kartuEl = useRef(new Map<string, HTMLDivElement>());
  const registrasi = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) kartuEl.current.set(id, el);
    else kartuEl.current.delete(id);
  }, []);

  /**
   * Potret petak grid, diambil sekali saat foto mulai dipegang.
   *
   * Wajib potret, bukan pengukuran langsung: selagi menggeser, kartu-kartu
   * sedang dalam perjalanan animasi, jadi `getBoundingClientRect()` mereka
   * mengembalikan posisi antara — dan keputusan yang dihitung dari posisi antara
   * itulah yang dulu membuat foto berkedip. Petaknya sendiri tidak bergerak
   * (jumlah foto tetap), jadi satu potret sudah cukup.
   */
  const petak = useRef<{ pusat: Titik; w: number; h: number }[]>([]);

  /**
   * Mengambil potret geometri petak dalam ruang offset. Mengembalikan false
   * kalau ada satu saja kartu yang elemennya belum terdaftar — lebih baik drag
   * tidak dimulai daripada dimulai dengan satu petak berisi koordinat sampah,
   * karena satu petak yang salah merusak perhitungan celah seluruh grid.
   */
  const ambilPotret = (): boolean => {
    const hasil: { pusat: Titik; w: number; h: number }[] = [];
    for (const foto of value) {
      const el = kartuEl.current.get(foto.id);
      if (!el) return false;
      hasil.push({
        pusat: {
          x: el.offsetLeft + el.offsetWidth / 2,
          y: el.offsetTop + el.offsetHeight / 2,
        },
        w: el.offsetWidth,
        h: el.offsetHeight,
      });
    }
    petak.current = hasil;
    return true;
  };

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newFiles: ImageFile[] = acceptedFiles
        .slice(0, maxFiles - value.length)
        .map((file) => ({
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          file,
          preview: URL.createObjectURL(file),
        }));
      onChange([...value, ...newFiles]);
      setIsDragging(false);
    },
    [value, onChange, maxFiles],
  );

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    maxFiles: maxFiles - value.length,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
    disabled: value.length >= maxFiles,
  });

  const removeImage = (id: string) => {
    const imageToRemove = value.find((img) => img.id === id);
    if (imageToRemove?.preview?.startsWith('blob:')) {
      URL.revokeObjectURL(imageToRemove.preview);
    }
    onChange(value.filter((img) => img.id !== id));
  };

  const pindahFoto = (dari: number, ke: number) => {
    const next = pindahkan(value, dari, ke);
    if (next !== value) onChange(next);
  };

  const indexDipegang = idDipegang ? value.findIndex((f) => f.id === idDipegang) : -1;

  const mulaiPegang = (id: string) => {
    if (!ambilPotret()) return;
    setIdDipegang(id);
    setSasaran(value.findIndex((f) => f.id === id));
  };

  /**
   * Titik tengah foto yang dibawa → petak tujuan (pratayang celah).
   * Keduanya di ruang offset, jadi scroll halaman tidak perlu dikompensasi.
   */
  const saatGeser = (pusatFoto: Titik) => {
    const tujuan = petakDi(petak.current, pusatFoto);
    if (tujuan !== null) setSasaran((s) => (s === tujuan ? s : tujuan));
  };

  /**
   * Dilepas: urutan diubah SEKALI di sini.
   *
   * Mengembalikan selisih posisi petak asal → petak tujuan. Kartu yang dilepas
   * memakainya untuk mengurangi transform-nya sendiri, supaya perpindahan DOM
   * tidak terlihat sebagai lompatan (lihat `lepas()` di kartu).
   */
  const selesai = (): Titik => {
    let selisih: Titik = { x: 0, y: 0 };

    if (indexDipegang !== -1 && sasaran !== null && sasaran !== indexDipegang) {
      const asal = petak.current[indexDipegang];
      const tujuan = petak.current[sasaran];
      if (asal && tujuan) {
        selisih = {
          x: tujuan.pusat.x - asal.pusat.x,
          y: tujuan.pusat.y - asal.pusat.y,
        };
      }
      pindahFoto(indexDipegang, sasaran);
    }

    setIdDipegang(null);
    setSasaran(null);
    setResetInstan(true);
    // Satu frame cukup: setelah DOM dilukis di susunan barunya, animasi normal
    // dinyalakan kembali untuk gerakan berikutnya.
    requestAnimationFrame(() => setResetInstan(false));
    petak.current = [];
    return selisih;
  };

  /** Pergeseran visual satu kartu selagi ada foto yang dibawa. */
  const geserKartu = (i: number): Titik => {
    if (indexDipegang === -1 || sasaran === null || petak.current.length === 0) {
      return { x: 0, y: 0 };
    }
    const tampil = petakTampil(i, indexDipegang, sasaran);
    if (tampil === i) return { x: 0, y: 0 };
    const asal = petak.current[i];
    const tujuan = petak.current[tampil];
    if (!asal || !tujuan) return { x: 0, y: 0 };

    const d = { x: tujuan.pusat.x - asal.pusat.x, y: tujuan.pusat.y - asal.pusat.y };
    // Jaring pengaman: pergeseran waras paling jauh = seluruh lebar/tinggi grid.
    // Kalau ada geometri yang keliru, kartu cukup diam di tempat — jauh lebih
    // baik daripada terlempar ribuan piksel dan terlihat seperti hilang.
    const wajar = 5000;
    if (Math.abs(d.x) > wajar || Math.abs(d.y) > wajar) return { x: 0, y: 0 };
    return d;
  };

  return (
    <div className="space-y-4">
      {/* Zona unggah */}
      {value.length < maxFiles && (
        <div
          {...getRootProps()}
          className={cn(
            'relative cursor-pointer overflow-hidden rounded-xl border-2 border-dashed p-8 text-center transition-all duration-300',
            isDragging
              ? 'border-purple-500 bg-purple-500/10'
              : 'border-slate-700 bg-slate-900/50 hover:border-purple-500/50 hover:bg-slate-900',
          )}
        >
          <input {...getInputProps()} />
          <motion.div
            animate={isDragging ? { scale: 1.05 } : { scale: 1 }}
            className="flex flex-col items-center gap-3"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/20 to-pink-500/20">
              <Upload className="h-8 w-8 text-purple-400" />
            </div>
            <div>
              <p className="mb-1 text-sm font-semibold text-slate-200">
                {isDragging ? 'Drop foto di sini' : 'Upload Foto Property'}
              </p>
              <p className="text-xs text-slate-500">
                Drag &amp; drop atau click untuk browse • Max {maxFiles} foto
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span>JPG</span>
              <span>•</span>
              <span>PNG</span>
              <span>•</span>
              <span>WEBP</span>
              <span>•</span>
              <span>Max 5MB</span>
            </div>
          </motion.div>
        </div>
      )}

      {/* Grid foto */}
      {value.length > 0 && (
        <div className="space-y-3">
          {value.length > 1 && (
            <p className="px-1 text-xs text-slate-400">
              Tahan foto lalu bawa ke tempatnya ·{' '}
              <span className="font-semibold text-slate-200">Foto 1</span> jadi cover
            </p>
          )}

          <div ref={grid} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <AnimatePresence initial={false}>
              {value.map((img, index) => (
                <KartuFoto
                  key={img.id}
                  img={img}
                  index={index}
                  total={value.length}
                  sedangDipegang={idDipegang === img.id}
                  adaYangDipegang={idDipegang !== null}
                  geser={geserKartu(index)}
                  resetInstan={resetInstan}
                  batasDrag={grid}
                  registrasi={registrasi}
                  onMulaiPegang={mulaiPegang}
                  onGeser={saatGeser}
                  onSelesai={selesai}
                  onPindah={pindahFoto}
                  onHapus={removeImage}
                />
              ))}
            </AnimatePresence>
          </div>

          {/* Kaki info */}
          <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 p-3">
            <div className="flex items-center gap-2">
              <ImageIconLucide className="h-4 w-4 text-purple-400" />
              <span className="text-sm text-slate-300">
                {value.length} foto terupload
              </span>
            </div>
            <span className="text-xs text-slate-500">
              {maxFiles - value.length} slot tersisa
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
