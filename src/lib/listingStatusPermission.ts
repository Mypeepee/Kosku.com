/**
 * Siapa yang boleh mengubah status tayang sebuah listing.
 *
 * Sebelum modul ini, aturannya ditulis ulang di setiap tempat yang butuh —
 * dan ketiganya sudah terlanjur berbeda: API bulk menganggap STOKER boleh
 * mengubah listing siapa pun, halaman dashboard memakai `session.user.role`
 * untuk mendeteksi OWNER (padahal `role` isinya `peran_enum` = USER|AGENT,
 * jadi perbandingannya tidak pernah benar), dan halaman detail belum punya
 * aturan sama sekali. Aturan izin yang tersebar seperti itu selalu berakhir
 * sama: satu pintu ditambal, pintu lain masih terbuka.
 *
 * Karena itu SATU fungsi di sini — `canChangeListingStatus` — dipakai oleh
 * dua sisi sekaligus:
 *   1. Server (API) sebagai penjaga sesungguhnya, dengan jabatan yang dibaca
 *      langsung dari DB (bukan dari JWT yang bisa basi sampai 5 menit).
 *   2. Client (tombol di halaman detail) hanya untuk memutuskan tombolnya
 *      ditampilkan atau tidak. Hasil di sini TIDAK PERNAH jadi dasar
 *      keamanan — siapa pun bisa memanggil API tanpa membuka halaman.
 *
 * File ini sengaja bebas dari `prisma`, `next/server`, dan session: murni
 * fungsi tanpa efek samping supaya aman ikut ke bundel browser.
 *
 * ── ATURANNYA ──────────────────────────────────────────────────────────────
 *   • Agent          → hanya listing miliknya sendiri (JUAL/SEWA/LELANG).
 *   • OWNER          → semua listing.
 *   • STOKER         → listing miliknya sendiri + SEMUA listing LELANG.
 *                      (Stoker yang mengurus stok aset lelang, jadi dia harus
 *                      bisa menutup aset lelang agent mana pun begitu asetnya
 *                      laku/ditarik balai lelang.)
 *   • Selain itu     → tidak boleh.
 *
 * Catatan istilah: "kategori lelang" yang dimaksud di lapangan adalah
 * `Listing.jenis_transaksi = 'LELANG'` — bukan `kategori_properti_enum`
 * (RUMAH/TANAH/…) yang isinya jenis bangunan.
 */

/** Status tayang yang boleh ditulis lewat jalur ubah-status. */
export const LISTING_STATUSES = ['TERSEDIA', 'TERJUAL', 'TARIK_LISTING'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export function isListingStatus(value: unknown): value is ListingStatus {
  return (LISTING_STATUSES as readonly string[]).includes(String(value));
}

/** Pihak yang melakukan aksi. `jabatan` = `jabatan_agent_enum`, BUKAN `peran`. */
export interface StatusActor {
  /** id_agent milik pemanggil, mis. "AG106". Null = akun bukan agent. */
  idAgent?: string | null;
  /** OWNER | STOKER | PRINCIPAL | ADMIN | TEAMLEADER | AGENT */
  jabatan?: string | null;
}

/** Listing yang mau diubah. Cukup dua kolom ini yang menentukan izin. */
export interface StatusTarget {
  /** Listing.id_agent — pemegang listing. */
  idAgent?: string | null;
  /** Listing.jenis_transaksi — PRIMARY | SECONDARY | LELANG | SEWA | CESSIE. */
  jenisTransaksi?: string | null;
}

/** Kenapa seseorang boleh — dipakai UI untuk memberi label yang jujur. */
export type StatusPermissionBasis = 'OWNER' | 'PEMILIK' | 'STOKER_LELANG';

/** Kenapa seseorang ditolak — dipakai API untuk memilih pesan & status HTTP. */
export type StatusDenialReason = 'BUKAN_AGENT' | 'BUKAN_PEMILIK';

export type StatusPermission =
  | { allowed: true; basis: StatusPermissionBasis }
  | { allowed: false; reason: StatusDenialReason; message: string };

/**
 * Samakan bentuk id agent sebelum dibandingkan. Id agent lahir dari sequence
 * (`AG` + angka) jadi tidak mungkin ada dua agent yang beda hanya di besar
 * kecil huruf — sementara nilainya bisa datang dari segmen URL yang ditulis
 * manual. Membandingkan setelah dinormalkan mencegah pemilik sah ditolak
 * cuma gara-gara "ag106" vs "AG106".
 */
function normalizeId(value?: string | null): string {
  return String(value ?? '').trim().toUpperCase();
}

/** Aset lelang — satu-satunya jenis yang boleh disentuh STOKER lintas agent. */
export function isLelang(jenisTransaksi?: string | null): boolean {
  return normalizeId(jenisTransaksi) === 'LELANG';
}

/**
 * Putusan izin. Urutannya sengaja: cek "bukan agent" dulu supaya pesannya
 * spesifik (akun klien vs agent yang bukan pemilik), lalu jalur yang paling
 * luas (OWNER), lalu kepemilikan, terakhir kekhususan STOKER.
 */
export function canChangeListingStatus(
  actor: StatusActor | null | undefined,
  target: StatusTarget | null | undefined,
): StatusPermission {
  const actorId = normalizeId(actor?.idAgent);
  const jabatan = normalizeId(actor?.jabatan);

  if (!actorId) {
    return {
      allowed: false,
      reason: 'BUKAN_AGENT',
      message: 'Akun ini belum terhubung sebagai agent.',
    };
  }

  if (jabatan === 'OWNER') {
    return { allowed: true, basis: 'OWNER' };
  }

  const ownerId = normalizeId(target?.idAgent);
  if (ownerId && ownerId === actorId) {
    return { allowed: true, basis: 'PEMILIK' };
  }

  if (jabatan === 'STOKER' && isLelang(target?.jenisTransaksi)) {
    return { allowed: true, basis: 'STOKER_LELANG' };
  }

  return {
    allowed: false,
    reason: 'BUKAN_PEMILIK',
    message:
      jabatan === 'STOKER'
        ? 'Sebagai Stoker, Anda hanya bisa mengubah status aset lelang atau listing milik sendiri.'
        : 'Listing ini dipegang agent lain, jadi statusnya hanya bisa diubah oleh pemegangnya.',
  };
}

/**
 * Siapa yang boleh mengubah KETERSEDIAAN sebuah listing sewa (memblokir
 * tanggal, menandai kamar penuh) — lihat @/lib/sewaAvailability.
 *
 * Ditaruh di berkas ini, bukan di modul izin baru, justru karena berkas ini
 * lahir dari masalah sebaliknya: aturan izin yang tersebar selalu berakhir
 * berbeda satu sama lain. Satu tempat, satu bentuk jawaban, satu label.
 *
 * Aturannya sengaja LEBIH SEMPIT daripada `canChangeListingStatus`:
 *   • OWNER  → semua listing;
 *   • Pemegang listing → listingnya sendiri;
 *   • STOKER → TIDAK punya kekhususan di sini. Wewenang lintas-agent miliknya
 *     terikat pada aset LELANG, dan lelang tidak punya ketersediaan harian.
 *     Meluaskan izin "karena mirip" adalah cara izin diam-diam bocor.
 */
export function canManageSewaAvailability(
  actor: StatusActor | null | undefined,
  target: StatusTarget | null | undefined,
): StatusPermission {
  const actorId = normalizeId(actor?.idAgent);
  const jabatan = normalizeId(actor?.jabatan);

  if (!actorId) {
    return {
      allowed: false,
      reason: 'BUKAN_AGENT',
      message: 'Akun ini belum terhubung sebagai agent.',
    };
  }

  if (jabatan === 'OWNER') {
    return { allowed: true, basis: 'OWNER' };
  }

  const ownerId = normalizeId(target?.idAgent);
  if (ownerId && ownerId === actorId) {
    return { allowed: true, basis: 'PEMILIK' };
  }

  return {
    allowed: false,
    reason: 'BUKAN_PEMILIK',
    message:
      'Listing ini dipegang agent lain, jadi ketersediaannya hanya bisa diatur oleh pemegangnya.',
  };
}

/** Versi ringkas untuk kondisi di JSX. */
export function mayManageSewaAvailability(
  actor: StatusActor | null | undefined,
  target: StatusTarget | null | undefined,
): boolean {
  return canManageSewaAvailability(actor, target).allowed;
}

/** Versi ringkas untuk kondisi di JSX. */
export function mayChangeListingStatus(
  actor: StatusActor | null | undefined,
  target: StatusTarget | null | undefined,
): boolean {
  return canChangeListingStatus(actor, target).allowed;
}

/**
 * Filter Prisma untuk "listing yang boleh dilihat & dikelola aktor ini" —
 * cerminan baca dari `canChangeListingStatus`.
 *
 * Aturan yang dipegang: **kamu melihat apa yang boleh kamu kelola.** Kalau
 * daftar dan wewenang dihitung dari dua tempat berbeda, cepat atau lambat
 * muncul kejanggalan seperti stoker yang boleh menutup aset lelang tapi tidak
 * pernah bisa menemukannya di dashboard. Karena itu keduanya lahir dari file
 * yang sama, tepat bersebelahan.
 *
 * Mengembalikan `null` kalau aktornya bukan agent sama sekali — pemanggil
 * wajib memperlakukan itu sebagai "tidak boleh melihat apa pun", bukan
 * "tanpa filter".
 *
 * Bentuk baliknya sengaja objek biasa (bukan `Prisma.ListingWhereInput`)
 * supaya berkas ini tetap bebas dari impor Prisma dan aman ikut ke browser.
 * Pemanggil di server tinggal menaruhnya di dalam `AND` — JANGAN di-spread ke
 * objek where yang sudah punya `OR` sendiri (mis. filter pencarian), karena
 * kunci `OR` yang kedua akan menimpa yang pertama tanpa error apa pun.
 */
export function listingScopeWhere(
  actor: StatusActor | null | undefined,
): Record<string, unknown> | null {
  const jabatan = normalizeId(actor?.jabatan);
  // Untuk PERBANDINGAN izin id dinormalkan (huruf besar), tapi yang masuk ke
  // query harus nilai apa adanya — kolom id_agent di DB case-sensitive.
  const idAgent = String(actor?.idAgent ?? '').trim();

  if (!idAgent) return null;

  // OWNER: seluruh listing, tanpa penyempitan.
  if (jabatan === 'OWNER') return {};

  // STOKER: listingnya sendiri + seluruh aset lelang yang jadi tanggung jawabnya.
  if (jabatan === 'STOKER') {
    return { OR: [{ id_agent: idAgent }, { jenis_transaksi: 'LELANG' }] };
  }

  return { id_agent: idAgent };
}

/**
 * Label peran yang dipakai UI ("atas dasar apa tombol ini muncul").
 * Agent perlu tahu ini: STOKER yang menutup aset agent lain harus sadar dia
 * sedang memakai wewenang khusus, bukan sedang menutup listingnya sendiri.
 */
export const STATUS_BASIS_LABEL: Record<StatusPermissionBasis, string> = {
  OWNER: 'Akses Owner',
  PEMILIK: 'Listing Anda',
  STOKER_LELANG: 'Wewenang Stoker · Lelang',
};

/**
 * Kata yang dipakai pengguna untuk "TERJUAL" berbeda per jenis transaksi:
 * unit sewa itu "Tersewa", bukan "Terjual". Kolom DB-nya tetap satu
 * (`status_tayang = TERJUAL`) — yang berubah hanya bahasanya di layar.
 */
export function soldLabelFor(jenisTransaksi?: string | null): string {
  return normalizeId(jenisTransaksi) === 'SEWA' ? 'Tersewa' : 'Terjual';
}

/** Bentuk kata kerjanya, mis. "Tandai Tersewa". */
export function soldVerbFor(jenisTransaksi?: string | null): string {
  return `Tandai ${soldLabelFor(jenisTransaksi)}`;
}
