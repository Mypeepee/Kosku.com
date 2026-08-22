'use client';

/**
 * GenderKosSelect — dropdown peruntukan kos.
 *
 * KENAPA BUKAN `<select>` BAWAAN. Kontrol native menampilkan daftar teks polos
 * yang wujudnya ditentukan sistem operasi: di macOS abu-abu terang, di Android
 * lembar putih setengah layar. Di form yang seluruhnya gelap, satu kontrol
 * yang tiba-tiba berganti bahasa visual terasa seperti bagian yang belum jadi —
 * dan ikon (yang justru membuat pilihan ini terbaca sekejap) tidak bisa
 * dipasang di dalamnya sama sekali.
 *
 * KENAPA BUKAN TIGA KARTU RADIO SEPERTI SEBELUMNYA. Tiga kartu memakan satu
 * baris penuh untuk satu jawaban yang selalu pendek. Setelah diringkas jadi
 * dropdown, "Gender Kos" & "Akses 24 Jam" muat berdampingan dalam satu baris —
 * dua pertanyaan sekali pandang, bukan dua layar scroll.
 *
 * Panelnya di-portal ke <body>: nenek moyang komponen ini punya `transform`
 * (animasi step wizard) yang membentuk stacking context baru, sehingga z-index
 * setinggi apa pun tetap terpotong tanpa portal.
 */

import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  KOS_GENDER_OPTIONS,
  type KosGender,
} from '@/app/tambah-property/types/listing';

interface Props {
  value?: KosGender | null;
  onChange: (v: KosGender) => void;
  error?: string;
  /** Tinggi kontrol — disamakan dengan pasangannya di baris yang sama. */
  className?: string;
}

export function GenderKosSelect({ value, onChange, error, className }: Props) {
  const [open, setOpen] = useState(false);
  const [sorot, setSorot] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const indeksTerpilih = KOS_GENDER_OPTIONS.findIndex((o) => o.value === value);
  const terpilih = indeksTerpilih >= 0 ? KOS_GENDER_OPTIONS[indeksTerpilih] : null;

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
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (open) setSorot(indeksTerpilih >= 0 ? indeksTerpilih : 0);
  }, [open, indeksTerpilih]);

  const pilih = (v: KosGender) => {
    onChange(v);
    setOpen(false);
    btnRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!open) setOpen(true);
        else setSorot((i) => Math.min(KOS_GENDER_OPTIONS.length - 1, i + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (open) setSorot((i) => Math.max(0, i - 1));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (open) pilih(KOS_GENDER_OPTIONS[sorot].value);
        else setOpen(true);
        break;
      case 'Escape':
        setOpen(false);
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  // Posisi panel: default ke bawah, dibalik ke atas kalau ruang bawah sempit.
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const lebar = Math.max(rect?.width ?? 280, 268);
  const kiri = Math.max(8, Math.min(rect?.left ?? 8, vw - lebar - 8));
  const ruangBawah = rect ? vh - rect.bottom - 16 : 400;
  const ruangAtas = rect ? rect.top - 16 : 400;
  const keAtas = ruangBawah < 260 && ruangAtas > ruangBawah;
  const tinggiMaks = Math.max(200, Math.min(300, keAtas ? ruangAtas : ruangBawah));
  const atas = keAtas ? (rect?.top ?? 0) - tinggiMaks - 10 : (rect?.bottom ?? 0) + 10;

  const panel = (
    <AnimatePresence>
      {open && (
        <motion.ul
          ref={panelRef}
          id={listId}
          role="listbox"
          aria-label="Peruntukan kos"
          initial={{ opacity: 0, y: keAtas ? 8 : -8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: keAtas ? 8 : -8, scale: 0.97 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'fixed',
            top: atas,
            left: kiri,
            width: lebar,
            maxHeight: tinggiMaks,
            zIndex: 99999,
          }}
          className="overflow-y-auto rounded-2xl border border-white/10 bg-slate-950 p-1.5 shadow-[0_24px_70px_-16px_rgba(0,0,0,0.9)] [scrollbar-width:thin]"
        >
          <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

          {KOS_GENDER_OPTIONS.map((opt, i) => {
            const aktif = opt.value === value;
            const disorot = i === sorot;
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={aktif}
                onMouseEnter={() => setSorot(i)}
                onClick={() => pilih(opt.value)}
                className={cn(
                  'relative flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors duration-150',
                  disorot ? 'bg-white/10' : 'hover:bg-white/5',
                  aktif && 'bg-white/[0.07]',
                )}
              >
                <span
                  className={cn(
                    'grid h-10 w-10 shrink-0 place-items-center rounded-xl border',
                    opt.warna.kotak,
                  )}
                >
                  <Icon icon={opt.icon} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'truncate text-sm font-bold',
                      aktif ? opt.warna.teks : 'text-slate-100',
                    )}
                  >
                    {opt.label}
                  </p>
                  <p className="truncate text-[11px] text-slate-500">{opt.desc}</p>
                </div>
                {aktif && (
                  <Check className={cn('h-5 w-5 shrink-0', opt.warna.teks)} strokeWidth={3} />
                )}
              </li>
            );
          })}
        </motion.ul>
      )}
    </AnimatePresence>
  );

  return (
    <div className={cn('relative', className)}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label="Peruntukan kos"
        className={cn(
          'flex h-14 w-full items-center gap-3 rounded-xl border-2 px-3 text-left transition-all duration-300 focus:outline-none',
          error
            ? 'border-red-500/60 bg-red-500/[0.04]'
            : open
              ? 'border-emerald-500/60 bg-slate-900/60 ring-2 ring-emerald-500/20'
              : terpilih
                ? cn(terpilih.warna.panel, 'border-2')
                : 'border-slate-800 bg-slate-900/50 hover:border-slate-700',
        )}
      >
        <span
          className={cn(
            'grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition-colors',
            terpilih ? terpilih.warna.kotak : 'border-slate-700 bg-slate-800/60 text-slate-500',
          )}
        >
          <Icon
            icon={terpilih?.icon ?? 'solar:users-group-rounded-bold-duotone'}
            className="h-[18px] w-[18px]"
          />
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'block truncate text-[15px] font-bold',
              terpilih ? 'text-white' : 'text-slate-500',
            )}
          >
            {terpilih?.label ?? 'Pilih peruntukan…'}
          </span>
          {terpilih && (
            <span className="block truncate text-[11px] text-slate-400">
              {terpilih.desc}
            </span>
          )}
        </span>

        <ChevronDown
          className={cn(
            'h-5 w-5 shrink-0 text-slate-400 transition-transform duration-300',
            open && 'rotate-180',
          )}
        />
      </button>

      {mounted ? createPortal(panel, document.body) : null}
    </div>
  );
}

export default GenderKosSelect;
