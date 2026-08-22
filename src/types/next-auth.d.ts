/**
 * Bentuk sebenarnya dari `session.user` & JWT di aplikasi ini.
 *
 * Tanpa berkas ini, TypeScript hanya tahu tiga field bawaan next-auth (name,
 * email, image) — padahal `authOptions` mengisi delapan field lain. Akibatnya
 * setiap pembacaan ditulis `(session.user as any).agentId`, dan `as any`
 * mematikan seluruh pemeriksaan: itulah yang membuat `session.user.role ===
 * "OWNER"` bisa hidup bertahun-tahun di enam berkas tanpa sekali pun ditegur
 * kompiler, walau `role` mustahil bernilai "OWNER".
 *
 * Deklarasi ini bukan kosmetik — ia mengubah kesalahan diam menjadi kesalahan
 * yang terlihat. Kalau menambah field baru di callback `session`/`jwt`
 * (@/app/api/auth/[...nextauth]/authOptions.ts), tambahkan juga di sini.
 *
 * Catatan nilai:
 *   • `peran` & `role` DIISI NILAI YANG SAMA (`peran_enum`: USER | AGENT).
 *     `role` hanya dipertahankan demi kode lama.
 *   • Wewenang (OWNER, STOKER, ADMIN, …) ada di `jabatan`, bukan di keduanya.
 *     Lihat @/lib/sessionJabatan.
 */

import type { DefaultSession } from 'next-auth';

/** USER | AGENT — `peran_enum`. Bukan tempat wewenang. */
export type PeranSesi = 'USER' | 'AGENT' | (string & {});

/** `jabatan_agent_enum` — DI SINI wewenang berada. */
export type JabatanSesi =
  | 'PRINCIPAL'
  | 'STOKER'
  | 'ADMIN'
  | 'OWNER'
  | 'AGENT'
  | 'TEAMLEADER'
  | (string & {});

declare module 'next-auth' {
  interface Session {
    user: {
      /** id_pengguna. Selalu ada untuk session yang sah. */
      id: string;
      /** `peran_enum` — USER | AGENT. */
      peran?: PeranSesi | null;
      /** Salinan `peran` untuk kode lama. JANGAN dipakai menilai wewenang. */
      role?: PeranSesi | null;
      /** id_agent, mis. "AG106". Null kalau akunnya bukan agent. */
      agentId?: string | null;
      /** `jabatan_agent_enum` — sumber wewenang yang benar. */
      jabatan?: JabatanSesi | null;
      /** Kode referral agent perujuk (monopoli Lelang di sisi klien). */
      kode_referral?: string | null;
      /** `status_agent_enum`: PENDING | AKTIF | SUSPEND. */
      agentStatus?: string | null;
      /** `status_akun_enum`: AKTIF | NONAKTIF | DIBEKUKAN. */
      status_akun?: string | null;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    peran?: PeranSesi | null;
    role?: PeranSesi | null;
    agentId?: string | null;
    jabatan?: JabatanSesi | null;
    kode_referral?: string | null;
    agentStatus?: string | null;
    status_akun?: string | null;
    /**
     * Kapan token terakhir menyegarkan peran/jabatan dari DB (epoch ms).
     * Ada karena penyegaran dibatasi 5 menit sekali — lihat callback `jwt`.
     * Konsekuensinya: untuk aksi yang MENULIS, jabatan wajib dibaca ulang dari
     * tabel agent, bukan dari token ini.
     */
    _refreshedAt?: number;
  }
}
