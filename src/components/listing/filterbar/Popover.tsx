"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { EASE, PANEL } from "./tokens";

/**
 * `useLayoutEffect` memperingatkan di server (tidak ada layout untuk diukur),
 * dan komponen ini tetap ikut ter-render server walau ditandai "use client".
 * Di server ia tidak perlu berjalan sama sekali — panelnya baru ada setelah
 * pemakai mengklik.
 */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Popover panel filter (desktop).
 *
 * Dirender lewat portal ke `document.body` karena bar-nya `sticky` dengan
 * `backdrop-filter` — properti itu membuat stacking context baru, sehingga
 * panel yang dirender di dalamnya akan terpotong oleh bar sendiri berapa pun
 * z-index-nya.
 *
 * Yang ditangani di sini dan tidak boleh ditulis ulang di tiap panel:
 *  • posisi mengikuti trigger, dan MEMBALIK ke kiri kalau menabrak tepi kanan
 *    layar (panel "Urutkan" di ujung kanan bar selalu kena ini);
 *  • Escape menutup DAN mengembalikan fokus ke trigger — tanpa itu fokus jatuh
 *    ke <body> dan penjelajahan keyboard harus mulai lagi dari atas halaman;
 *  • klik/sentuh di luar menutup, memakai `pointerdown` supaya panel tertutup
 *    begitu jari menyentuh, bukan setelah diangkat;
 *  • fokus dipindahkan ke dalam panel saat dibuka.
 */

const LEBAR_DEFAULT = 320;
const JARAK = 10;
const MARGIN_LAYAR = 12;

export default function Popover({
  anchorRef,
  open,
  onClose,
  labelledBy,
  id,
  lebar = LEBAR_DEFAULT,
  children,
}: {
  anchorRef: React.RefObject<HTMLElement>;
  open: boolean;
  onClose: () => void;
  /** id tombol pemicu — untuk `aria-labelledby` panel. */
  labelledBy?: string;
  id: string;
  lebar?: number;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const kurangiGerak = useReducedMotion();

  // Posisi dihitung sebelum cat pertama supaya panel tidak terlihat "meloncat"
  // dari pojok kiri atas ke tempatnya.
  useIsomorphicLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const hitung = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const maks = window.innerWidth - lebar - MARGIN_LAYAR;
      setPos({
        top: r.bottom + JARAK,
        left: Math.max(MARGIN_LAYAR, Math.min(r.left, maks)),
      });
    };
    hitung();
    // `true` = fase capture, supaya scroll kontainer mana pun ikut tertangkap,
    // bukan hanya scroll window.
    window.addEventListener("scroll", hitung, true);
    window.addEventListener("resize", hitung);
    return () => {
      window.removeEventListener("scroll", hitung, true);
      window.removeEventListener("resize", hitung);
    };
  }, [open, anchorRef, lebar]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
      anchorRef.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return; // trigger mengurus toggle-nya sendiri
      onClose();
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, onClose, anchorRef]);

  // Fokus masuk ke panel begitu terbuka.
  useEffect(() => {
    if (!open || !pos) return;
    const t = window.setTimeout(() => {
      const fokusable = panelRef.current?.querySelector<HTMLElement>(
        'input,button,[tabindex]:not([tabindex="-1"])'
      );
      fokusable?.focus();
    }, 40);
    return () => window.clearTimeout(t);
  }, [open, pos]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && pos && (
        <motion.div
          ref={panelRef}
          id={id}
          role="dialog"
          aria-labelledby={labelledBy}
          initial={kurangiGerak ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={kurangiGerak ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: kurangiGerak ? 0.12 : 0.16, ease: EASE }}
          className="rounded-2xl"
          style={{
            ...PANEL,
            position: "fixed",
            top: pos.top,
            left: pos.left,
            width: lebar,
            maxHeight: `calc(100vh - ${pos.top + MARGIN_LAYAR}px)`,
            overflowY: "auto",
            zIndex: 99999,
            transformOrigin: "top left",
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
