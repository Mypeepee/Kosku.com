// src/app/dashboard/pemilu/pemilu.types.ts

// 1. ACARA
// Tabel Supabase: acara (id_acara, judul_acara, tanggal_mulai, tanggal_selesai)
export interface Acara {
    id_acara: number;          // bigserial di DB → number di FE
    judul_acara: string;
    tanggal_mulai: string;     // timestamp Supabase, kirim sebagai string/ISO
    tanggal_selesai: string;   // timestamp Supabase
  }
  
  // 2. PESERTA_ACARA
  // Tabel: peserta_acara
  // (id_acara, id_agent, nomor_urut, status_peserta, waktu_daftar, waktu_mulai_pilih, waktu_selesai_pilih, sisa_waktu)
  
  export type StatusPeserta =
    | "TERDAFTAR"
    | "GILIRAN"
    | "SELESAI"
    | "BATAL"; // sesuai enum status_peserta_enum di SQL
  
  export interface Participant {
    id_acara: number;          // int8 / bigint
    id_agent: string;          // varchar(20)
    nomor_urut: number | null;
    status_peserta: StatusPeserta;
    waktu_daftar: string;      // timestamp → string
    waktu_mulai_pilih: string | null;
    waktu_selesai_pilih: string | null;
    sisa_waktu: number | null;
  }
  
  // 3. PROPERTY / UNIT_PEMILU + LISTING
  // Tabel: unit_pemilu (id_unit, id_acara, id_agent, id_property)
  //        listing (id_property, alamat_lengkap, harga, gambar)
  
  export type PropertyStatus = "AVAILABLE" | "SELECTED" | "LOCKED";
  
  export interface Property {
    id_unit: number;           // unit_pemilu.id_unit (serial4)
    id_acara: number;          // unit_pemilu.id_acara
    id_property: number;       // listing.id_property (bigserial)
    id_agent: string | null;   // agent yang sudah memilih unit ini (kalau ada)
  
    // Data dari listing
    alamat_lengkap: string | null;
    harga: number | null;
    gambar: string | null;
  
    status: PropertyStatus;
  }
  
  // 4. PILIHAN_PEMILU
  // Tabel: pilihan_pemilu
  // (id_pilihan, id_acara, id_agent, id_unit, nomor_urut, waktu_memilih, durasi_detik)
  
  export interface Selection {
    id_pilihan: number;        // bigserial
    id_acara: number;
    id_agent: string;
    id_unit: number;
    nomor_urut: number;
    waktu_memilih: string;     // timestamp
    durasi_detik: number | null;
  }
  
  // 5. NOTIFIKASI (hanya dipakai di FE)
  export type NotificationType = "join" | "select" | "complete";
  
  export interface Notification {
    id: string;
    message: string;
    timestamp: string;         // ISO string
    type: NotificationType;
    agentName: string;
  }
  