"use client";

/**
 * Mode tampilan halaman detail sewa: penyewa atau pengelola.
 *
 * ── KENAPA DI CLIENT, BUKAN DI SERVER ─────────────────────────────────────
 * `page.tsx` sengaja tidak memanggil `getServerSession`. Begitu ia melakukannya,
 * halaman berubah jadi dinamis: cache-nya hilang, dan versi yang dilihat
 * Googlebot (yang selalu anonim) bukan lagi versi yang bisa kita uji. Halaman
 * publik ini adalah aset SEO — ia harus tetap satu untuk semua orang.
 *
 * Jadi chrome pengelola dipasang SETELAH hidrasi, di atas halaman yang sama.
 * Ini pola yang dipakai Airbnb & Mamikos, dan efek sampingnya justru fitur:
 * pengelola selalu melihat persis apa yang dilihat calon penyewa.
 *
 * ── INI BUKAN KEAMANAN ────────────────────────────────────────────────────
 * Hasil hook ini hanya memutuskan tombol muncul atau tidak. Siapa pun bisa
 * memanggil API tanpa membuka halaman ini, jadi otorisasi sesungguhnya ada di
 * `/api/listings/[id]/ketersediaan`, yang membaca ulang jabatan dari DB —
 * disiplin yang sama dengan `status-guard.ts`. Aturannya sendiri dipakai
 * bersama lewat `canManageSewaAvailability` supaya tombol dan API tidak pernah
 * berselisih pendapat.
 */

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  canManageSewaAvailability,
  STATUS_BASIS_LABEL,
  type StatusPermissionBasis,
} from "@/lib/listingStatusPermission";
import type { ModePanel } from "../components/BookingSidebar";

export interface ModePengelola {
  mode: ModePanel;
  bolehKelola: boolean;
  /** Atas dasar apa dia boleh — dipakai memberi label yang jujur. */
  basis: StatusPermissionBasis | null;
  /** "Listing Anda" / "Akses Owner". */
  labelBasis: string | null;
  /** Sesi sudah selesai dibaca. Sebelum ini, jangan render apa pun. */
  siap: boolean;
}

export function useModePengelola(idAgentListing: string): ModePengelola {
  const { data: session, status } = useSession();

  return useMemo(() => {
    // Selama sesi masih dibaca, perlakukan sebagai penyewa.
    //
    // Bukan sekadar kehati-hatian: menebak "pengelola" lebih dulu lalu meralat
    // akan membuat bilah pengelola berkedip di layar SETIAP pengunjung biasa —
    // dan yang lebih buruk, panel booking sempat non-aktif di detik pertama,
    // tepat saat penyewa memutuskan. Pola yang sama dipakai RiwayatLelang.tsx.
    if (status === "loading") {
      return {
        mode: "penyewa" as const,
        bolehKelola: false,
        basis: null,
        labelBasis: null,
        siap: false,
      };
    }

    const user = session?.user as
      | { agentId?: string | null; jabatan?: string | null }
      | undefined;

    const izin = canManageSewaAvailability(
      { idAgent: user?.agentId ?? null, jabatan: user?.jabatan ?? null },
      { idAgent: idAgentListing, jenisTransaksi: "SEWA" },
    );

    return {
      mode: izin.allowed ? ("pratinjau" as const) : ("penyewa" as const),
      bolehKelola: izin.allowed,
      basis: izin.allowed ? izin.basis : null,
      labelBasis: izin.allowed ? STATUS_BASIS_LABEL[izin.basis] : null,
      siap: true,
    };
  }, [session, status, idAgentListing]);
}
