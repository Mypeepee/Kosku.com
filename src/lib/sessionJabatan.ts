/**
 * Membaca WEWENANG dari session dengan benar.
 *
 * Aplikasi ini punya dua kolom peran yang gampang tertukar, dan salah satunya
 * hampir selalu jadi pilihan yang salah:
 *
 *   • `session.user.peran` / `session.user.role` — isinya `peran_enum`, dan
 *     `peran_enum` HANYA punya dua nilai: USER dan AGENT. Keduanya diisi nilai
 *     yang sama oleh authOptions.
 *   • `session.user.jabatan` — isinya `jabatan_agent_enum`: PRINCIPAL, STOKER,
 *     ADMIN, OWNER, AGENT, TEAMLEADER. DI SINILAH wewenang berada.
 *
 * Akibatnya `session.user.role === "OWNER"` tidak pernah bernilai true. Bukan
 * error, bukan warning — cuma diam-diam false, sehingga fitur yang bergantung
 * padanya (owner melihat semua listing, tombol takedown, hak menyunting acara
 * milik agent lain) mati tanpa jejak apa pun di log. Kesalahan ini sudah
 * terulang di enam berkas berbeda karena `.role` memang nama yang paling
 * masuk akal untuk ditebak.
 *
 * Modul ini ada supaya tebakan itu tidak perlu lagi: satu nama yang benar,
 * dipakai di server maupun browser. Berkas ini bebas dari prisma/next-auth —
 * cukup diberi objek `session.user`.
 *
 * Untuk aksi yang MENULIS ke DB, jangan berhenti di sini: JWT baru disegarkan
 * tiap 5 menit, jadi jabatan di session bisa tertinggal. Baca ulang dari tabel
 * agent — polanya ada di src/app/api/listings/_lib/status-guard.ts.
 */

/** Bentuk minimum `session.user` yang dibutuhkan; sengaja longgar. */
export interface PenggunaSesi {
  jabatan?: string | null;
  agentId?: string | null;
  [key: string]: unknown;
}

/** Jabatan agent dalam huruf besar; "" kalau akunnya bukan agent. */
export function jabatanDari(user: PenggunaSesi | null | undefined): string {
  return String(user?.jabatan ?? '').trim().toUpperCase();
}

/** id_agent apa adanya (untuk dibandingkan/di-query); "" kalau bukan agent. */
export function agentIdDari(user: PenggunaSesi | null | undefined): string {
  return String(user?.agentId ?? '').trim();
}

/**
 * OWNER — satu-satunya jabatan yang berwenang atas data seluruh agent.
 * PRINCIPAL/ADMIN/TEAMLEADER sengaja TIDAK ikut: masing-masing punya cakupan
 * sendiri (kantor, tim), dan menyamakannya di sini akan diam-diam memperluas
 * wewenang mereka di setiap tempat yang memanggil fungsi ini.
 */
export function isOwner(user: PenggunaSesi | null | undefined): boolean {
  return jabatanDari(user) === 'OWNER';
}

/**
 * Boleh menyunting sebuah entitas: pemiliknya sendiri, atau OWNER.
 * Dipakai acara/agenda — pola yang sebelumnya disalin-tempel di tiga komponen
 * dengan pembacaan peran yang salah di ketiganya.
 */
export function isOwnerAtauPemilik(
  user: PenggunaSesi | null | undefined,
  idAgentPemilik?: string | null,
): boolean {
  if (isOwner(user)) return true;
  const aku = agentIdDari(user);
  const pemilik = String(idAgentPemilik ?? '').trim();
  return !!aku && !!pemilik && aku === pemilik;
}
