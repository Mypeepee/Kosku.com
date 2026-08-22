"use client";

import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { EASE, RING_FOKUS } from "./tokens";

/**
 * Panel filter lengkap. SATU komponen, dua bentuk:
 *  • layar kecil  → bottom sheet, bisa ditarik ke bawah untuk menutup;
 *  • layar besar  → laci yang masuk dari kanan.
 *
 * Dibuat satu komponen supaya isi panel (yang panjang, dengan banyak bidang)
 * hanya ditulis sekali. Versi lama halaman ini menulis daftar tipe & urutan dua
 * kali — sekali untuk desktop, sekali untuk mobile — dan keduanya sempat
 * berbeda isi.
 *
 * Yang ditangani di sini: kunci scroll latar, Escape, klik backdrop, fokus
 * masuk & kembali, area aman iOS, dan footer lengket yang tidak ikut ter-scroll.
 */

export default function Drawer({
  open,
  onClose,
  judul,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  judul: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const pemicuRef = useRef<Element | null>(null);
  const kurangiGerak = useReducedMotion();

  // Kunci scroll body. `overflow: hidden` saja tidak cukup di iOS Safari, tapi
  // ia sudah menghentikan kasus yang paling mengganggu: latar ikut bergulir
  // saat jari menggeser di dalam sheet.
  useEffect(() => {
    if (!open) return;
    pemicuRef.current = document.activeElement;
    const asli = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = asli;
      (pemicuRef.current as HTMLElement | null)?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      panelRef.current
        ?.querySelector<HTMLElement>('button,input,[tabindex]:not([tabindex="-1"])')
        ?.focus();
    }, 60);
    return () => window.clearTimeout(t);
  }, [open]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0" style={{ zIndex: 99998 }}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)" }}
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={judul}
            drag={kurangiGerak ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              // Hanya sheet bawah yang layak ditarik-tutup; di layar lebar
              // gerakan ini praktis tidak pernah terjadi dengan mouse.
              if (info.offset.y > 120 && window.innerWidth < 768) onClose();
            }}
            initial={kurangiGerak ? { opacity: 0 } : { y: "100%" }}
            animate={kurangiGerak ? { opacity: 1 } : { y: 0 }}
            exit={kurangiGerak ? { opacity: 0 } : { y: "100%" }}
            transition={{ duration: kurangiGerak ? 0.15 : 0.34, ease: EASE }}
            className="absolute inset-x-0 bottom-0 flex flex-col md:inset-y-0 md:left-auto md:right-0 md:w-[420px]"
            style={{
              maxHeight: "88vh",
              background: "rgba(14,15,21,0.99)",
              borderTop: "1px solid rgba(255,255,255,0.1)",
              borderLeft: "1px solid rgba(255,255,255,0.1)",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              boxShadow: "0 -20px 60px rgba(0,0,0,0.7)",
            }}
          >
            {/* Gagang tarik — hanya bermakna di sheet bawah */}
            <div className="flex justify-center pt-3 pb-1 md:hidden" aria-hidden>
              <div
                className="h-1 w-10 rounded-full"
                style={{ background: "rgba(255,255,255,0.2)" }}
              />
            </div>

            <div className="flex items-center justify-between px-5 pb-4 pt-3 md:pt-5">
              <h2 className="text-base font-bold text-white">{judul}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup panel filter"
                className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/10 ${RING_FOKUS}`}
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                <Icon icon="solar:close-circle-linear" className="text-xl" />
              </button>
            </div>

            <div
              className="min-h-0 flex-1 overflow-y-auto px-5 pb-4"
              style={{ overscrollBehavior: "contain" }}
            >
              {children}
            </div>

            {footer && (
              <div
                className="shrink-0 px-5 pt-3"
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.08)",
                  // Area aman iPhone: tanpa ini tombol utama tertutup home bar.
                  paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
                }}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
