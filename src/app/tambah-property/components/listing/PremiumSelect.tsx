'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PremiumSelectOption = {
  value: string;
  label: string;
  desc?: string;
  icon?: React.ReactNode;
};

type AccentKey = 'cyan' | 'indigo' | 'emerald' | 'violet' | 'amber' | 'rose';

const ACCENTS: Record<
  AccentKey,
  {
    glow: string;
    open: string;
    leading: string;
    bar: string;
    selBg: string;
    iconWrap: string;
    check: string;
    panelShadow: string;
  }
> = {
  cyan: {
    glow: 'from-cyan-500/25 to-blue-500/25',
    open: 'border-cyan-500/60 ring-2 ring-cyan-500/20',
    leading: 'text-cyan-400',
    bar: 'bg-gradient-to-b from-cyan-400 to-blue-500',
    selBg: 'bg-cyan-500/10',
    iconWrap: 'from-cyan-500/20 to-blue-500/20 border-cyan-500/30',
    check: 'text-cyan-300',
    panelShadow: 'shadow-[0_24px_70px_-16px_rgba(34,211,238,0.35)]',
  },
  indigo: {
    glow: 'from-indigo-500/25 to-purple-500/25',
    open: 'border-indigo-500/60 ring-2 ring-indigo-500/20',
    leading: 'text-indigo-400',
    bar: 'bg-gradient-to-b from-indigo-400 to-purple-500',
    selBg: 'bg-indigo-500/10',
    iconWrap: 'from-indigo-500/20 to-purple-500/20 border-indigo-500/30',
    check: 'text-indigo-300',
    panelShadow: 'shadow-[0_24px_70px_-16px_rgba(99,102,241,0.35)]',
  },
  emerald: {
    glow: 'from-emerald-500/25 to-teal-500/25',
    open: 'border-emerald-500/60 ring-2 ring-emerald-500/20',
    leading: 'text-emerald-400',
    bar: 'bg-gradient-to-b from-emerald-400 to-teal-500',
    selBg: 'bg-emerald-500/10',
    iconWrap: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30',
    check: 'text-emerald-300',
    panelShadow: 'shadow-[0_24px_70px_-16px_rgba(16,185,129,0.35)]',
  },
  violet: {
    glow: 'from-violet-500/25 to-fuchsia-500/25',
    open: 'border-violet-500/60 ring-2 ring-violet-500/20',
    leading: 'text-violet-400',
    bar: 'bg-gradient-to-b from-violet-400 to-fuchsia-500',
    selBg: 'bg-violet-500/10',
    iconWrap: 'from-violet-500/20 to-fuchsia-500/20 border-violet-500/30',
    check: 'text-violet-300',
    panelShadow: 'shadow-[0_24px_70px_-16px_rgba(139,92,246,0.35)]',
  },
  amber: {
    glow: 'from-amber-500/25 to-orange-500/25',
    open: 'border-amber-500/60 ring-2 ring-amber-500/20',
    leading: 'text-amber-400',
    bar: 'bg-gradient-to-b from-amber-400 to-orange-500',
    selBg: 'bg-amber-500/10',
    iconWrap: 'from-amber-500/20 to-orange-500/20 border-amber-500/30',
    check: 'text-amber-300',
    panelShadow: 'shadow-[0_24px_70px_-16px_rgba(245,158,11,0.35)]',
  },
  rose: {
    glow: 'from-pink-500/25 to-rose-500/25',
    open: 'border-pink-500/60 ring-2 ring-pink-500/20',
    leading: 'text-pink-400',
    bar: 'bg-gradient-to-b from-pink-400 to-rose-500',
    selBg: 'bg-pink-500/10',
    iconWrap: 'from-pink-500/20 to-rose-500/20 border-pink-500/30',
    check: 'text-pink-300',
    panelShadow: 'shadow-[0_24px_70px_-16px_rgba(244,63,94,0.35)]',
  },
};

interface PremiumSelectProps {
  value?: string | null;
  onChange: (value: string) => void;
  options: PremiumSelectOption[];
  placeholder?: string;
  leadingIcon?: React.ReactNode;
  accent?: AccentKey;
  ariaLabel?: string;
  /** 'sm' untuk dipakai inline di dalam baris (tinggi 44px, bukan 56px). */
  size?: 'md' | 'sm';
}

export function PremiumSelect({
  value,
  onChange,
  options,
  placeholder = 'Pilih opsi',
  leadingIcon,
  accent = 'cyan',
  ariaLabel,
  size = 'md',
}: PremiumSelectProps) {
  const isSm = size === 'sm';
  const cfg = ACCENTS[accent];
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  // Panel di-portal ke <body> supaya tidak terpotong oleh ancestor yang punya
  // overflow-hidden / transform (mis. motion.div animasi step wizard) — sebuah
  // z-index saja tidak cukup karena transform bikin stacking context baru.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [rect, setRect] = useState<DOMRect | null>(null);
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

  // Outside click + Escape close — panel ada di luar rootRef (portal), jadi
  // klik di dalamnya harus ikut dianggap "di dalam".
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

  // Saat dibuka, sorot opsi terpilih (atau pertama)
  useEffect(() => {
    if (open) setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, selectedIndex]);

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
    btnRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!open) {
          setOpen(true);
        } else {
          setActiveIndex((i) => Math.min(options.length - 1, i + 1));
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (open) setActiveIndex((i) => Math.max(0, i - 1));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (open && options[activeIndex]) choose(options[activeIndex].value);
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

  // Posisi panel (fixed, ter-clamp ke viewport). Default buka ke bawah; kalau
  // ruang bawah sempit dan atas lebih lega, panel dibalik ke atas.
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const PANEL_W = rect?.width ?? 280;
  const left = Math.max(8, Math.min(rect?.left ?? 8, vw - PANEL_W - 8));
  const spaceBelow = rect ? vh - rect.bottom - 16 : 400;
  const spaceAbove = rect ? rect.top - 16 : 400;
  const openUpward = spaceBelow < 240 && spaceAbove > spaceBelow;
  const maxH = Math.max(180, Math.min(288, openUpward ? spaceAbove : spaceBelow));
  const top = openUpward
    ? (rect?.top ?? 0) - maxH - 10
    : (rect?.bottom ?? 0) + 10;

  const panel = (
    <AnimatePresence>
      {open && (
        <motion.ul
          ref={panelRef}
          id={listId}
          role="listbox"
          data-premium-select-panel="true"
          initial={{ opacity: 0, y: openUpward ? 8 : -8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: openUpward ? 8 : -8, scale: 0.97 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'fixed',
            top,
            left,
            width: PANEL_W,
            maxHeight: maxH,
            zIndex: 99999,
          }}
          className={cn(
            'overflow-y-auto rounded-2xl p-1.5',
            'border border-white/10 bg-slate-950 backdrop-blur-2xl',
            '[scrollbar-width:thin]',
            cfg.panelShadow
          )}
        >
          {/* Top sheen */}
          <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

          {options.map((opt, i) => {
            const isSel = opt.value === value;
            const isActive = i === activeIndex;
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSel}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => choose(opt.value)}
                className={cn(
                  'relative flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors duration-150',
                  isActive ? 'bg-white/10' : 'hover:bg-white/5',
                  isSel && cfg.selBg
                )}
              >
                {/* Active accent bar */}
                <span
                  className={cn(
                    'absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-full transition-opacity duration-150',
                    cfg.bar,
                    isActive ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <span
                  className={cn(
                    'grid h-9 w-9 shrink-0 place-items-center rounded-lg border bg-gradient-to-br',
                    cfg.iconWrap,
                    cfg.leading
                  )}
                >
                  {opt.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-100">
                    {opt.label}
                  </p>
                  {opt.desc && (
                    <p className="truncate text-[11px] text-slate-500">{opt.desc}</p>
                  )}
                </div>
                {isSel && <Check className={cn('h-5 w-5 shrink-0', cfg.check)} />}
              </li>
            );
          })}
        </motion.ul>
      )}
    </AnimatePresence>
  );

  return (
    <div ref={rootRef} className="relative">
      {/* Ambient glow */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-r blur-lg transition-opacity duration-300',
          cfg.glow,
          open ? 'opacity-100' : 'opacity-0 group-focus-within:opacity-60'
        )}
      />

      {/* Trigger */}
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        className={cn(
          'relative flex w-full items-center rounded-xl text-left font-semibold',
          'border-2 bg-slate-900/50 text-slate-100 transition-all duration-300 focus:outline-none',
          isSm ? 'h-11 pr-9 text-sm' : 'h-14 pr-12 text-base',
          isSm ? (leadingIcon ? 'pl-9' : 'pl-3') : 'pl-12',
          open ? cfg.open : 'border-slate-800 hover:border-slate-700'
        )}
      >
        {leadingIcon && (
          <span
            className={cn(
              'absolute flex items-center',
              isSm ? 'left-3' : 'left-4',
              cfg.leading
            )}
          >
            {leadingIcon}
          </span>
        )}
        <span className={cn('truncate', selected ? 'text-slate-100' : 'text-slate-500')}>
          {selected ? selected.label : placeholder}
        </span>
        <span
          className={cn(
            'absolute flex items-center text-slate-400 transition-transform duration-300',
            isSm ? 'right-2.5' : 'right-4',
            open && 'rotate-180'
          )}
        >
          <ChevronDown className={isSm ? 'h-4 w-4' : 'h-5 w-5'} />
        </span>
      </button>

      {mounted ? createPortal(panel, document.body) : null}
    </div>
  );
}

export default PremiumSelect;
