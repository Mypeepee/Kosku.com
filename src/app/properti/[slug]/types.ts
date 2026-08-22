import type { PropertyDB } from "@/components/property/PropertyCard";
import type { TempatDipilih } from "@/lib/searchTabs";
import type { CatatanBar } from "@/components/listing/TempatAktifBar";
import type { KonteksFilter } from "@/lib/listingFilters";

/**
 * Item di halaman kategori/"semua" = PropertyDB, bentuk yang dimakan kartu
 * bersama (@/components/property/PropertyCard).
 *
 * Halaman ini dulu punya kartunya sendiri, dan akibatnya listing KOS tampil
 * dengan grid KT/KM/LT/LB yang seluruhnya "-" — angka rumah tapak untuk benda
 * yang bukan rumah tapak. Kartu bersama tahu membedakannya.
 *
 * Dua field di bawah TIDAK ada di PropertyDB dan sengaja dipertahankan: masih
 * dipakai bagian lain halaman ini (hero & filter), bukan oleh kartunya.
 */
export interface PropertyItem extends PropertyDB {
  alamat_lengkap: string;
  tanggal_lelang: string | null;
}

export interface PaginationData {
  currentPage: number;
  totalPages: number;
  totalItems: number;
}

export interface TabCounts {
  semua: number;
  jual: number;
  lelang: number;
  sewa: number;
}

export interface KategoriPageProps {
  slug: string;
  label: string;
  initialData: PropertyItem[];
  pagination: PaginationData;
  activeTipe: string;
  /**
   * Konteks filter & urut yang ditentukan tab transaksi. Dikirim dari server
   * (bukan dihitung ulang di klien) supaya bar filter, mesin `where`, dan
   * katalog urut tidak pernah berbeda pendapat soal tab mana yang sedang aktif.
   */
  konteks: KonteksFilter;
  tabCounts: TabCounts;
  /** Tempat yang sedang disaring ("dekat UNESA"), null bila tidak ada. */
  tempat?: TempatDipilih | null;
  radiusTempat?: number | null;
  /** True bila tempatnya DITEBAK server dari `?q=`, bukan dipilih user. */
  tempatDitebak?: boolean;
  /** Teks asli yang diketik user — ditampilkan saat tebakan, supaya
   *  penafsirannya bisa dikoreksi. */
  kueriAsli?: string | null;
  /** Penjelasan untuk hasil kosong yang punya sebab (mis. wilayah kosong). */
  catatanTempat?: CatatanBar | null;
}
