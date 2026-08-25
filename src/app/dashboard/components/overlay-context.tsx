"use client";

/* ════════════════════════════════════════════════════════════════════
   DashboardOverlay — koordinator overlay "chrome" dashboard
   ────────────────────────────────────────────────────────────────────
   Hanya boleh ada SATU overlay chrome hidup dalam satu waktu: drawer
   menu mobile, dropdown notifikasi, atau dropdown profil. Sebelum ini
   ketiganya punya state sendiri-sendiri, jadi di layar kecil drawer
   menu bisa terbuka menimpa panel notifikasi yang masih terbuka.

   Z-SCALE chrome (satu skala, jangan diacak sendiri-sendiri):
     1400  backdrop drawer sidebar mobile
     1410  drawer sidebar mobile
     1420  scrim notifikasi (mobile)
     1430  panel notifikasi
   Semuanya di atas modal level-halaman (tertinggi saat ini z-[1300]),
   karena navigasi chrome harus selalu bisa diakses paling atas.
   ════════════════════════════════════════════════════════════════════ */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export type OverlayId = "sidebar" | "notif" | "profile";

export const OVERLAY_Z = {
  sidebarBackdrop: 1400,
  sidebar: 1410,
  notifScrim: 1420,
  notif: 1430,
} as const;

type OverlayCtx = {
  active: OverlayId | null;
  isOpen: (id: OverlayId) => boolean;
  open: (id: OverlayId) => void;
  toggle: (id: OverlayId) => void;
  /** Tanpa argumen = tutup apa pun yang sedang terbuka. */
  close: (id?: OverlayId) => void;
};

const Ctx = createContext<OverlayCtx | null>(null);

export function DashboardOverlayProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [active, setActive] = useState<OverlayId | null>(null);

  const isOpen = useCallback((id: OverlayId) => active === id, [active]);
  const open = useCallback((id: OverlayId) => setActive(id), []);
  const toggle = useCallback(
    (id: OverlayId) => setActive((cur) => (cur === id ? null : id)),
    [],
  );
  const close = useCallback(
    (id?: OverlayId) => setActive((cur) => (!id || cur === id ? null : cur)),
    [],
  );

  const value = useMemo<OverlayCtx>(
    () => ({ active, isOpen, open, toggle, close }),
    [active, isOpen, open, toggle, close],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Dipakai komponen chrome. Kalau kebetulan dirender di luar provider
 * (mis. topbar dipakai ulang di layout lain), otomatis jatuh ke state
 * lokal supaya komponennya tetap berfungsi — cuma kehilangan koordinasi.
 */
export function useDashboardOverlay(): OverlayCtx {
  const ctx = useContext(Ctx);
  const [localActive, setLocalActive] = useState<OverlayId | null>(null);

  const fallback = useMemo<OverlayCtx>(
    () => ({
      active: localActive,
      isOpen: (id) => localActive === id,
      open: (id) => setLocalActive(id),
      toggle: (id) => setLocalActive((cur) => (cur === id ? null : id)),
      close: (id) => setLocalActive((cur) => (!id || cur === id ? null : cur)),
    }),
    [localActive],
  );

  return ctx ?? fallback;
}
