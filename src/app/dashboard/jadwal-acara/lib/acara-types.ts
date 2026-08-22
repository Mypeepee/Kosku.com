/**
 * Bentuk satu acara — dipakai bersama oleh kalender, daftar todo, modal acara,
 * dan kartu agenda di dasbor.
 *
 * Sebelumnya keempat komponen itu mendeklarasikan `EventData` sendiri-sendiri,
 * dan keempatnya sudah berbeda: kalender memakai index signature `[key: string]`,
 * todo mewajibkan `agent.pengguna.nama_lengkap`, modal tidak punya `agent` sama
 * sekali. Karena semuanya menerima data dari SATU endpoint yang sama
 * (/api/dashboard/acara), perbedaan itu tidak pernah nyata — yang nyata cuma
 * akibatnya: TypeScript melihat empat tipe berbeda dengan nama sama dan menolak
 * meneruskan `events` dari satu komponen ke komponen lain (TS2719), sehingga
 * kalender tidak bisa mengoper daftar acaranya ke todo tanpa error.
 *
 * Satu tipe di sini menghapus seluruh kelas masalah itu. Field yang tidak
 * selalu dikirim API ditulis opsional — lebih baik komponen memeriksa
 * keberadaannya daripada tipe berbohong bahwa datanya pasti ada.
 */

/** Agent ringkas yang menempel di acara/undangan. */
export interface AcaraAgentRingkas {
  id_agent?: string;
  foto_profil_url?: string | null;
  pengguna?: { nama_lengkap?: string };
}

/** Satu undangan peserta acara, apa adanya dari API. */
export interface UndanganAcaraApi {
  id_undangan?: string;
  id_agent: string;
  status_undangan?: string;
  agent?: AcaraAgentRingkas;
}

export interface EventData {
  id_acara: string;
  judul_acara: string;
  deskripsi?: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  waktu_mulai?: string;
  waktu_selesai?: string;
  tipe_acara: string;
  lokasi?: string;
  status_acara?: string;
  id_property?: string;
  durasi_pilih?: number;
  agent?: AcaraAgentRingkas | null;
  /** Daftar undangan dari API GET — di-hydrate ke PesertaPicker saat edit/view. */
  undangan?: UndanganAcaraApi[];
  /**
   * Hint dari API: pemanggil adalah pemilik acara ini. Dipercaya lebih dulu
   * karena dihitung di server dari session; pemeriksaan di client hanya
   * cadangan untuk acara yang datang dari sumber lain (mis. MOU).
   */
  _isOwner?: boolean;
  /** Diisi komponen induk sebelum membuka modal, bukan dari API. */
  canEdit?: boolean;
}
