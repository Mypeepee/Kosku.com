'use client';

/**
 * FotoKamarTipe — satu foto untuk satu tipe kamar.
 *
 * KENAPA ADA. Anak kos memilih kamar dari WUJUDNYA, bukan dari daftar
 * fasilitasnya. Selama ini galeri listing hanya satu tumpukan untuk seluruh
 * gedung, jadi kos dengan tiga tipe kamar tetap menyisakan pertanyaan yang
 * justru paling menentukan: "yang saya bayar ini yang mana?" — dan jawabannya
 * baru didapat saat survei, setelah calon penghuni menempuh perjalanan untuk
 * sesuatu yang seharusnya sudah terjawab di layar.
 *
 * KENAPA WAJIB. Begitu satu kos punya beberapa tipe, seluruh gunanya tipe
 * adalah membuat calon penghuni bisa membedakan kamar mana yang ia bayar.
 * Tipe tanpa foto mengembalikan persoalan yang justru mau diselesaikan, jadi
 * "Lanjut" menahan sampai tiap tipe punya fotonya.
 *
 * KENAPA MAKSIMAL SATU. Kartu tipe kamar gunanya MEMBANDINGKAN antar tipe.
 * Begitu tiap tipe punya galeri sendiri, yang terjadi bukan perbandingan yang
 * lebih kaya melainkan tiga galeri kecil yang saling menutupi — dan foto utuh
 * gedung (teras, dapur, jemuran) sudah punya tempatnya sendiri di galeri
 * listing. Satu foto per tipe menjawab tepat satu pertanyaan, dan itu cukup.
 *
 * KENAPA TIDAK ADA TOMBOL "GANTI FOTO". Petaknya sendiri sudah tombolnya —
 * menekan gambar untuk menggantinya adalah gerak yang sudah dikuasai semua
 * orang dari aplikasi foto mana pun. Tombol berlabel di sebelahnya cuma
 * mengulang hal yang sama sambil memakan satu baris penuh, dan baris itu
 * dikalikan jumlah tipe kamar. Yang tersisa hanya tombol hapus, sebagai ikon
 * kecil di sisi kanan foto — di sana ia tidak memakan ruang tata letak sama
 * sekali, dan tidak pernah tertukar dengan "ganti".
 *
 * KENAPA DIUNGGAH SEKETIKA, BUKAN SAAT SUBMIT.
 *   1. Isi form ikut ditulis ke localStorage sebagai draft. Objek `File` tidak
 *      bisa di-serialize dan `blob:` URL mati begitu tab ditutup — draft yang
 *      dipulihkan besok akan menampilkan gambar rusak.
 *   2. Kegagalan unggah jadi terlihat SEKARANG, saat agent masih menatap kamar
 *      yang dimaksud — bukan di detik terakhir saat menekan Publish, ketika
 *      satu foto gagal berarti seluruh submit ikut menggantung.
 * Konsekuensi yang diterima: foto yang diunggah lalu dibatalkan meninggalkan
 * berkas yatim di Drive. Itu harga yang jauh lebih murah daripada agent
 * kehilangan pekerjaannya.
 */

import React, { useRef, useState } from 'react';
import { Camera, ImageOff, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Label, PesanError } from './fields';

/** Batas ukuran berkas. Di atas ini unggahan lambat & sering putus di jaringan HP. */
const MAKS_BYTE = 10 * 1024 * 1024;

const TIPE_DIIZINKAN = ['image/jpeg', 'image/png', 'image/webp'];

interface Props {
  /** URL foto yang sudah tersimpan (atau null). */
  value?: string | null;
  onChange: (url: string | null) => void;
  /** Untuk penamaan folder di Drive — sama dengan yang dipakai foto listing. */
  kota?: string | null;
  alamat?: string | null;
  /** Nama tipe, dipakai di label aksesibilitas supaya jelas foto kamar yang mana. */
  namaTipe?: string;
  /** Pesan validasi — foto tiap tipe wajib diisi. */
  error?: string;
}

export function FotoKamarTipe({
  value,
  onChange,
  kota,
  alamat,
  namaTipe,
  error,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mengunggah, setMengunggah] = useState(false);
  /** Pratinjau lokal selama unggahan berjalan — foto langsung terlihat. */
  const [pratinjau, setPratinjau] = useState<string | null>(null);

  // Lokasi wajib lebih dulu karena folder Drive disusun per kota & alamat.
  // Tanpa itu foto akan mendarat di folder yang salah dan tidak pernah
  // ditemukan lagi oleh siapa pun.
  const siap = !!kota?.trim();
  const tampil = pratinjau ?? value ?? null;

  const bersihkanPratinjau = (url: string | null) => {
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
  };

  const unggah = async (file: File) => {
    if (!TIPE_DIIZINKAN.includes(file.type)) {
      toast.error('Format foto harus JPG, PNG, atau WEBP');
      return;
    }
    if (file.size > MAKS_BYTE) {
      toast.error('Ukuran foto maksimal 10 MB');
      return;
    }

    const lokal = URL.createObjectURL(file);
    setPratinjau((lama) => {
      bersihkanPratinjau(lama);
      return lokal;
    });
    setMengunggah(true);

    try {
      const fd = new FormData();
      fd.append('images[0]', file);
      fd.append('kota', kota!.trim());
      fd.append('alamat', alamat?.trim() || 'Kamar Kos');
      fd.append('cover_image_index', '0');

      const res = await fetch('/api/upload/images', { method: 'POST', body: fd });
      const json = await res.json().catch(() => null);

      const url: string | undefined = json?.imageUrls?.[0];
      if (!res.ok || !url) {
        throw new Error(json?.error || 'Gagal mengunggah foto');
      }

      onChange(url);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Foto gagal diunggah — coba lagi',
      );
      // Pratinjau dibuang supaya tidak ada foto "seolah tersimpan" yang
      // sebenarnya tidak akan ikut terkirim saat listing di-publish.
      setPratinjau((lama) => {
        bersihkanPratinjau(lama);
        return null;
      });
    } finally {
      setMengunggah(false);
      // Nilai input dikosongkan supaya memilih BERKAS YANG SAMA lagi (mis.
      // setelah gagal) tetap memicu onChange.
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const hapus = () => {
    setPratinjau((lama) => {
      bersihkanPratinjau(lama);
      return null;
    });
    onChange(null);
  };

  const buka = () => {
    if (!siap || mengunggah) return;
    inputRef.current?.click();
  };

  const label = namaTipe ? `Foto kamar ${namaTipe}` : 'Foto kamar tipe ini';

  return (
    // `h-full` wajib: pembungkusnya adalah flex item yang sudah diregangkan
    // setinggi baris (items-stretch), tapi tinggi itu tidak menurun sendiri ke
    // dalam elemen block. Tanpa ini petak foto berhenti di tinggi isinya dan
    // ruang kosong yang mau dihilangkan justru muncul lagi di bawah foto.
    <div className="flex h-full min-w-0 flex-col">
      <Label wajib>Foto kamar</Label>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void unggah(f);
        }}
      />

      {/* Petaknya MEMANJANG mengikuti tinggi kolom isian di sebelahnya
          (`flex-1` di dalam induk yang `items-stretch`). Itu yang menghapus
          ruang kosong di bawah foto — tinggi foto tidak lagi ditentukan rasio
          tetap yang kebetulan tidak sama dengan tinggi isian di sampingnya. */}
      <div className="relative flex-1">
        <button
          type="button"
          onClick={buka}
          disabled={!siap || mengunggah}
          aria-label={tampil ? `Ganti ${label}` : `Unggah ${label}`}
          className={cn(
            'group relative h-full min-h-[86px] w-full overflow-hidden rounded-xl border-2 transition-all',
            tampil
              ? 'border-emerald-400/40'
              : error
                ? // Petak yang wajib diisi harus terlihat SALAH, bukan sekadar
                  // kosong — kalau tidak, agent yang tertahan "Lanjut" tidak
                  // punya cara menemukan petak mana yang dimaksud di antara
                  // delapan kartu tipe.
                  'border-dashed border-red-400/70 bg-red-400/[0.07]'
                : siap
                  ? 'border-dashed border-white/[0.15] bg-black/30 hover:border-emerald-400/50 hover:bg-emerald-400/[0.06]'
                  : 'cursor-not-allowed border-dashed border-white/[0.08] bg-black/20',
          )}
        >
          {tampil ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={tampil}
                alt={label}
                className={cn(
                  'absolute inset-0 h-full w-full object-cover transition-opacity',
                  mengunggah && 'opacity-40',
                )}
              />
              {/* Isyarat "ketuk untuk ganti". Di layar sentuh tidak ada hover,
                  jadi ikonnya tetap terlihat samar di sudut — cukup untuk
                  memberi tahu petak ini bisa ditekan, tanpa menutupi fotonya. */}
              {!mengunggah && (
                <span className="absolute inset-0 grid place-items-center bg-black/55 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-white">
                    <Camera className="h-3.5 w-3.5" />
                    Ganti
                  </span>
                </span>
              )}
              {!mengunggah && (
                <span className="pointer-events-none absolute bottom-1.5 left-1.5 grid h-6 w-6 place-items-center rounded-lg bg-black/55 backdrop-blur-sm transition-opacity group-hover:opacity-0 sm:hidden">
                  <Camera className="h-3 w-3 text-white" />
                </span>
              )}
            </>
          ) : (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-1.5 text-center">
              {siap ? (
                <>
                  <Camera
                    className={cn('h-4 w-4', error ? 'text-red-300' : 'text-emerald-400')}
                  />
                  <span
                    className={cn(
                      'text-[10px] font-bold leading-tight',
                      error ? 'text-red-300' : 'text-slate-400',
                    )}
                  >
                    Tambah foto
                  </span>
                </>
              ) : (
                <>
                  <ImageOff className="h-4 w-4 text-slate-600" />
                  <span className="text-[10px] font-bold leading-tight text-slate-600">
                    Isi kota dulu
                  </span>
                </>
              )}
            </span>
          )}

          {mengunggah && (
            <span className="absolute inset-0 grid place-items-center">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-300" />
            </span>
          )}
        </button>

        {/* Hapus — di sisi kanan foto, melayang di atasnya supaya tidak
            memakan satu kolom tata letak pun. Bukan tombol berlabel: satu-
            satunya aksi berlabel di petak ini adalah "ganti", dan itu sudah
            dipegang oleh fotonya sendiri. */}
        {tampil && !mengunggah && (
          <button
            type="button"
            onClick={hapus}
            aria-label={`Hapus ${label}`}
            className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/65 text-white backdrop-blur-sm transition-colors hover:bg-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <X className="h-3.5 w-3.5" strokeWidth={3} />
          </button>
        )}
      </div>

      <PesanError pesan={error} />
    </div>
  );
}

export default FotoKamarTipe;
