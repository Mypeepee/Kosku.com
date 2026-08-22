'use client';

/**
 * FacilityMultiSelect — dropdown multi-pilih untuk daftar fasilitas.
 *
 * Kenapa bukan grid tombol: daftar fasilitas panjang (16+ item × 3 grup) bikin
 * step jadi sangat tinggi. Kenapa bukan <select multiple>: jelek, tidak bisa
 * dicari, dan pilihan tidak terlihat setelah panel ditutup.
 *
 * Pola yang dipakai (Linear/Notion/GitHub labels): trigger ringkas → panel
 * dengan search → item terpilih tampil sebagai chip yang bisa dihapus. Panel
 * di-portal ke <body> supaya tidak terpotong ancestor ber-transform/overflow.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import { ChevronDown, Search, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FasilitasOption } from '@/app/tambah-property/types/listing';

interface FacilityMultiSelectProps {
  options: FasilitasOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  ariaLabel?: string;
}

export function FacilityMultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Pilih fasilitas…',
  searchPlaceholder = 'Cari fasilitas…',
  ariaLabel,
}: FacilityMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  // Posisi panel mengikuti trigger, ikut update saat scroll/resize.
  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  // Fokus ke search begitu panel dibuka
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => searchRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
    setQuery('');
  }, [open]);

  // Klik di luar → tutup. Panel ada di portal (di luar rootRef), jadi ikut dicek.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, query]);

  const toggle = (name: string) => {
    onChange(value.includes(name) ? value.filter((v) => v !== name) : [...value, name]);
  };

  const selectedOptions = options.filter((o) => value.includes(o.name));

  // Posisi panel (fixed + clamp ke viewport, flip ke atas kalau bawah sempit)
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const PANEL_W = rect?.width ?? 320;
  const left = Math.max(8, Math.min(rect?.left ?? 8, vw - PANEL_W - 8));
  const spaceBelow = rect ? vh - rect.bottom - 16 : 400;
  const spaceAbove = rect ? rect.top - 16 : 400;
  const openUpward = spaceBelow < 280 && spaceAbove > spaceBelow;
  const maxH = Math.max(220, Math.min(340, openUpward ? spaceAbove : spaceBelow));
  const top = openUpward ? (rect?.top ?? 0) - maxH - 10 : (rect?.bottom ?? 0) + 10;

  const panel = (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: openUpward ? 8 : -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: openUpward ? 8 : -8, scale: 0.98 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'fixed',
            top,
            left,
            width: PANEL_W,
            maxHeight: maxH,
            zIndex: 99999,
          }}
          className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-[0_24px_70px_-16px_rgba(16,185,129,0.35)]"
        >
          {/* Search */}
          <div className="shrink-0 border-b border-white/10 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-10 w-full rounded-lg border border-slate-800 bg-slate-900/60 pl-9 pr-3 text-sm font-medium text-slate-100 placeholder:text-slate-600 focus:border-emerald-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          {/* Daftar opsi */}
          <div className="flex-1 overflow-y-auto p-1.5 [scrollbar-width:thin]">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-slate-500">
                Tidak ada yang cocok dengan “{query}”
              </p>
            ) : (
              filtered.map((opt) => {
                const isSel = value.includes(opt.name);
                return (
                  <button
                    key={opt.name}
                    type="button"
                    role="option"
                    aria-selected={isSel}
                    onClick={() => toggle(opt.name)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors duration-150',
                      isSel ? 'bg-emerald-500/10' : 'hover:bg-white/5',
                    )}
                  >
                    {/* Checkbox */}
                    <span
                      className={cn(
                        'grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition-colors',
                        isSel
                          ? 'border-emerald-500 bg-emerald-500'
                          : 'border-slate-700 bg-transparent',
                      )}
                    >
                      {isSel && <Check className="h-3 w-3 text-slate-950" strokeWidth={3.5} />}
                    </span>

                    <span
                      className={cn(
                        'grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors',
                        isSel ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800/80 text-slate-500',
                      )}
                    >
                      <Icon icon={opt.icon} className="h-4 w-4" />
                    </span>

                    <span
                      className={cn(
                        'min-w-0 flex-1 truncate text-sm font-semibold',
                        isSel ? 'text-slate-100' : 'text-slate-400',
                      )}
                    >
                      {opt.name}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-white/10 bg-slate-900/60 px-3 py-2">
            <button
              type="button"
              onClick={() => onChange([])}
              disabled={value.length === 0}
              className="rounded-lg px-2 py-1.5 text-xs font-bold text-slate-400 transition-colors hover:text-red-400 disabled:opacity-40 disabled:hover:text-slate-400"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-bold text-slate-950 transition-colors hover:bg-emerald-400"
            >
              Selesai{value.length > 0 ? ` (${value.length})` : ''}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div ref={rootRef} className="space-y-2.5">
      {/* Trigger */}
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          'relative flex h-14 w-full items-center gap-3 rounded-xl border-2 px-4 text-left transition-all duration-300 focus:outline-none',
          'bg-slate-900/50 text-slate-100',
          open
            ? 'border-emerald-500/60 ring-2 ring-emerald-500/20'
            : 'border-slate-800 hover:border-slate-700',
        )}
      >
        <span className="min-w-0 flex-1 truncate text-base font-semibold">
          {value.length === 0 ? (
            <span className="text-slate-500">{placeholder}</span>
          ) : (
            <span>
              {value.length} dipilih
              <span className="ml-2 text-sm font-medium text-slate-500">
                {selectedOptions
                  .slice(0, 2)
                  .map((o) => o.name)
                  .join(', ')}
                {value.length > 2 ? '…' : ''}
              </span>
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

      {/* Chip terpilih — selalu terlihat walau panel ditutup */}
      <AnimatePresence initial={false}>
        {selectedOptions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-2">
              {selectedOptions.map((opt) => (
                <motion.span
                  key={opt.name}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 py-1 pl-2.5 pr-1.5 text-xs font-semibold text-emerald-300"
                >
                  <Icon icon={opt.icon} className="h-3.5 w-3.5" />
                  {opt.name}
                  <button
                    type="button"
                    onClick={() => toggle(opt.name)}
                    aria-label={`Hapus ${opt.name}`}
                    className="grid h-4 w-4 place-items-center rounded-full text-emerald-400/70 transition-colors hover:bg-emerald-500/20 hover:text-emerald-200"
                  >
                    <X className="h-3 w-3" strokeWidth={3} />
                  </button>
                </motion.span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {mounted ? createPortal(panel, document.body) : null}
    </div>
  );
}

export default FacilityMultiSelect;
