'use client';

/**
 * PindaiSekitarPanel — "cari tempat sekitar untuk saya".
 *
 * MASALAH YANG DIPERBAIKI. Halaman detail sudah bisa menemukan sendiri apa yang
 * ada di sekitar sebuah aset, tapi di form ini agent masih harus mengetik
 * patokannya satu per satu: nama tempat, jarak, satuan, enam kali. Pekerjaan
 * manual untuk pertanyaan yang mesinnya sudah punya jawabannya.
 *
 * TIDAK MENAMBAH PEMINDAIAN. Hasilnya disimpan server per KOORDINAT (tabel
 * `sekitar_titik`), dan halaman detail membaca tabel yang sama sebelum
 * memindai. Jadi pindaian di sini bukan pindaian tambahan — ia pindaian yang
 * memang akan terjadi nanti, dimajukan ke saat koordinatnya sudah pasti
 * sehingga geocoding alamat tidak diperlukan sama sekali. Menekan tombolnya
 * dua kali untuk titik yang sama juga tidak memanggil apa pun untuk kedua
 * kalinya.
 *
 * KENAPA TOMBOL, BUKAN OTOMATIS. Marker digeser-geser berkali-kali saat agent
 * mencari posisi yang pas. Memindai di setiap perubahan berarti belasan
 * pencarian untuk satu listing, dan hanya yang terakhir yang dipakai.
 *
 * KENAPA HASILNYA TIDAK LANGSUNG MASUK SEMUA. Halaman detail SUDAH menampilkan
 * seluruh hasil pindaian di bagian "Yang ada di sekitar". Yang diadopsi lewat
 * panel ini naik ke blok patokan agent — blok teratas yang dibaca sebagai
 * "diverifikasi orang". Jadi ini pekerjaan kurasi: pilih yang benar-benar jadi
 * alasan orang memilih tempat ini.
 *
 * TAPI MEMILIH SEMUANYA HARUS MUNGKIN. Batasnya kini sama dengan jumlah hasil
 * satu pemindaian, dan ada tombol "Pilih semua" — baik untuk seluruh daftar
 * maupun per kategori. Agent yang memang ingin memungut semuanya tidak perlu
 * mencentang puluhan kotak satu per satu; yang ingin memilih beberapa saja
 * tetap bisa. Daftar patokan di bawah sudah dirancang untuk isi sebanyak itu
 * (baris ringkas + wadah bergulir sendiri), jadi memilih banyak tidak lagi
 * berarti menambah panjang halaman.
 */

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import { Check, Loader2, RefreshCw, Search, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { bulatkanJarakKm } from '@/lib/geo';
import {
  AKSES_DARI_KATEGORI,
  KATEGORI_POI,
  URUTAN_KATEGORI,
  formatJarak,
  type KategoriPOI,
  type TempatTerdekat,
} from '@/lib/nearbyPlaces';
import type { AksesTerdekat } from '@/app/tambah-property/types/listing';

interface Props {
  /** Titik yang ditandai agent di peta. Tanpa ini panel tidak bisa bekerja. */
  koordinat?: { lat: number; lng: number } | null;
  /** Patokan yang sudah ada — dipakai menandai mana yang sudah diadopsi. */
  nilai: AksesTerdekat[];
  onChange: (next: AksesTerdekat[]) => void;
  /** Batas patokan yang berlaku di AksesTerdekatInput. */
  maksPatokan: number;
}

/** Nama disamakan sebelum dibandingkan — "Indomaret " ≠ "indomaret" itu bukan
 *  perbedaan yang berarti bagi siapa pun yang membaca daftarnya. */
const kunciNama = (s: string) => s.trim().toLowerCase();

export default function PindaiSekitarPanel({
  koordinat,
  nilai,
  onChange,
  maksPatokan,
}: Props) {
  const [memuat, setMemuat] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [tempat, setTempat] = useState<TempatTerdekat[] | null>(null);
  const [radius, setRadius] = useState(0);
  const [dipilih, setDipilih] = useState<Set<string>>(new Set());
  /** Titik yang hasilnya sedang ditampilkan — untuk tahu kapan hasilnya basi. */
  const [titikHasil, setTitikHasil] = useState<string | null>(null);

  const kunciKoordinat = koordinat
    ? `${koordinat.lat.toFixed(5)},${koordinat.lng.toFixed(5)}`
    : null;
  const hasilBasi = !!(titikHasil && kunciKoordinat && titikHasil !== kunciKoordinat);

  /** Nama yang sudah jadi patokan — tidak perlu ditawarkan lagi. */
  const sudahAda = useMemo(
    () => new Set(nilai.filter((a) => a?.nama).map((a) => kunciNama(a.nama))),
    [nilai],
  );

  const sisaKuota = Math.max(0, maksPatokan - nilai.length);

  const pindai = async (ulang = false) => {
    if (!koordinat || memuat) return;
    setMemuat(true);
    setPesan(null);
    try {
      const res = await fetch(
        `/api/sekitar/titik?lat=${koordinat.lat}&lng=${koordinat.lng}${
          ulang ? '&ulang=1' : ''
        }`,
      );
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.pesan || `HTTP ${res.status}`);
      }
      const hasil: TempatTerdekat[] = Array.isArray(json.tempat) ? json.tempat : [];
      setTempat(hasil);
      setRadius(Number(json.radius) || 0);
      setDipilih(new Set());
      setTitikHasil(kunciKoordinat);
      if (hasil.length === 0) {
        // Dibedakan dengan tegas: "tidak ketemu apa-apa" dan "yang dicari
        // sedang tidak menjawab" menuntut tindakan yang berbeda dari agent.
        setPesan(
          json.status === 'gagal'
            ? 'Server peta sedang tidak menjawab — coba lagi sebentar lagi.'
            : 'Tidak ada tempat terdata di sekitar titik ini. Isi patokan manual di bawah.',
        );
      }
    } catch (e: any) {
      setPesan(`Gagal memindai: ${e?.message || 'coba lagi'}`);
    } finally {
      setMemuat(false);
    }
  };

  const toggle = (id: string) => {
    setDipilih((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else if (next.size < sisaKuota) next.add(id);
      return next;
    });
  };

  /** Tempat yang masih bisa dicentang: belum jadi patokan di daftar bawah. */
  const bisaDicentang = useMemo(
    () => (tempat ?? []).filter((p) => !sudahAda.has(kunciNama(p.nama))),
    [tempat, sudahAda],
  );

  /**
   * Pilih semua. Dibatasi sisa kuota, dan yang lebih dekat didahulukan — kalau
   * kuotanya tidak cukup untuk seluruh hasil, yang terpotong seharusnya yang
   * paling jauh, bukan yang kebetulan berada di urutan bawah daftar.
   */
  const pilihSemua = (daftar = bisaDicentang) => {
    setDipilih((s) => {
      const next = new Set(s);
      const kandidat = [...daftar].sort((a, b) => a.jarak - b.jarak);
      for (const p of kandidat) {
        if (next.size >= sisaKuota) break;
        next.add(p.id);
      }
      return next;
    });
  };

  const semuaTercentang =
    bisaDicentang.length > 0 &&
    bisaDicentang.every((p) => dipilih.has(p.id));

  const tambahkan = () => {
    if (!tempat || dipilih.size === 0) return;
    const baru: AksesTerdekat[] = tempat
      .filter((p) => dipilih.has(p.id) && !sudahAda.has(kunciNama(p.nama)))
      .slice(0, sisaKuota)
      .map((p) => ({
        tipe: AKSES_DARI_KATEGORI[p.kategori],
        nama: p.nama,
        // Jaraknya sudah dihitung server dari titik properti (garis lurus,
        // meter) — tidak ada yang perlu dihitung ulang di sini.
        jarak: bulatkanJarakKm(p.jarak / 1000),
        satuan: 'KM',
      }));
    if (baru.length > 0) onChange([...nilai, ...baru]);
    setDipilih(new Set());
  };

  const grup = useMemo(() => {
    if (!tempat) return [];
    const acc = new Map<KategoriPOI, TempatTerdekat[]>();
    for (const p of tempat) {
      const list = acc.get(p.kategori) ?? [];
      list.push(p);
      acc.set(p.kategori, list);
    }
    return URUTAN_KATEGORI.filter((k) => acc.has(k)).map(
      (k) => [k, acc.get(k) as TempatTerdekat[]] as const,
    );
  }, [tempat]);

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-slate-800 bg-slate-900/40">
      {/* ── Kepala: penjelasan + tombol ── */}
      <div className="flex flex-wrap items-center gap-3 p-3.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-sky-500/30 bg-sky-500/15 text-sky-300">
          <Search className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-100">Cari otomatis dari peta</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {koordinat
              ? 'Kami carikan tempat di sekitar titik yang kamu tandai — tinggal centang yang penting.'
              : 'Tandai titik properti di peta dulu, lalu tombol ini aktif.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => pindai(hasilBasi ? false : !!tempat)}
          disabled={!koordinat || memuat}
          className={cn(
            'flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all active:scale-95',
            !koordinat || memuat
              ? 'cursor-not-allowed bg-slate-800/60 text-slate-600'
              : 'bg-sky-500/20 text-sky-300 hover:bg-sky-500/30',
          )}
        >
          {memuat ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Memindai…
            </>
          ) : tempat && !hasilBasi ? (
            <>
              <RefreshCw className="h-4 w-4" />
              Pindai ulang
            </>
          ) : (
            <>
              <Search className="h-4 w-4" />
              Pindai sekitar
            </>
          )}
        </button>
      </div>

      {/* ── Hasil ── */}
      <AnimatePresence initial={false}>
        {(tempat || pesan || memuat) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="border-t border-slate-800"
          >
            <div className="p-3.5">
              {hasilBasi && (
                <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-400">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  Titik di peta sudah berubah — pindai lagi supaya hasilnya sesuai.
                </p>
              )}

              {pesan && (
                <p className="text-xs font-semibold text-amber-400">{pesan}</p>
              )}

              {memuat && !tempat && (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 py-1.5">
                      <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-slate-800" />
                      <div className="h-3 flex-1 animate-pulse rounded bg-slate-800" />
                    </div>
                  ))}
                </div>
              )}

              {tempat && tempat.length > 0 && (
                <>
                  <div className="mb-3 space-y-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                        {tempat.length} tempat ditemukan
                      </p>
                      <p className="text-[11px] text-slate-600">
                        Radius{' '}
                        {radius >= 1000
                          ? `${(radius / 1000).toFixed(1).replace('.', ',')} km`
                          : `${radius} m`}
                        {' · '}
                        {sisaKuota > 0
                          ? `sisa ${sisaKuota} patokan`
                          : 'patokan sudah penuh'}
                      </p>
                    </div>

                    {/* Pilih semua / bersihkan pilihan.
                        Ditaruh di atas daftar, bukan di bawahnya: keputusan
                        "saya mau semuanya" diambil sebelum membaca daftarnya,
                        dan tombol di bawah baru ditemukan setelah menggulir
                        semua yang tadinya mau dilewati. */}
                    {bisaDicentang.length > 0 && sisaKuota > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            semuaTercentang ? setDipilih(new Set()) : pilihSemua()
                          }
                          className={cn(
                            'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors',
                            semuaTercentang
                              ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                              : 'bg-white/[0.06] text-slate-300 hover:bg-white/10',
                          )}
                        >
                          <span
                            className={cn(
                              'grid h-4 w-4 place-items-center rounded border transition-colors',
                              semuaTercentang
                                ? 'border-emerald-400 bg-emerald-400 text-slate-950'
                                : 'border-slate-600',
                            )}
                          >
                            {semuaTercentang && (
                              <Check className="h-2.5 w-2.5" strokeWidth={4} />
                            )}
                          </span>
                          {semuaTercentang
                            ? 'Batalkan semua'
                            : `Pilih semua (${Math.min(bisaDicentang.length, sisaKuota)})`}
                        </button>

                        {dipilih.size > 0 && !semuaTercentang && (
                          <button
                            type="button"
                            onClick={() => setDipilih(new Set())}
                            className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-300"
                          >
                            Bersihkan pilihan
                          </button>
                        )}

                        {bisaDicentang.length > sisaKuota && (
                          <span className="text-[11px] text-amber-500/80">
                            Kuota tersisa {sisaKuota} — yang terdekat didahulukan
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="max-h-[320px] space-y-4 overflow-y-auto pr-1 [scrollbar-width:thin]">
                    {grup.map(([kategori, list]) => {
                      const cfg = KATEGORI_POI[kategori];
                      const sisaGrup = list.filter(
                        (p) => !sudahAda.has(kunciNama(p.nama)),
                      );
                      const grupPenuh =
                        sisaGrup.length > 0 && sisaGrup.every((p) => dipilih.has(p.id));
                      return (
                        <div key={kategori}>
                          <h5
                            className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider"
                            style={{ color: cfg.warna }}
                          >
                            <Icon icon={cfg.icon} className="h-3.5 w-3.5" />
                            {cfg.label}
                            <span className="text-slate-600">{list.length}</span>

                            {/* Per kategori: cara paling sering dipakai —
                                "ambil semua kampusnya, minimarketnya tidak". */}
                            {sisaGrup.length > 1 && sisaKuota > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  grupPenuh
                                    ? setDipilih((s) => {
                                        const next = new Set(s);
                                        sisaGrup.forEach((p) => next.delete(p.id));
                                        return next;
                                      })
                                    : pilihSemua(sisaGrup)
                                }
                                className="ml-auto rounded-md px-1.5 py-0.5 text-[10px] font-bold normal-case tracking-normal text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-200"
                              >
                                {grupPenuh ? 'Batalkan' : 'Pilih semua'}
                              </button>
                            )}
                          </h5>
                          <div className="space-y-1">
                            {list.map((p) => {
                              const terpakai = sudahAda.has(kunciNama(p.nama));
                              const aktif = dipilih.has(p.id);
                              const penuh = !aktif && dipilih.size >= sisaKuota;
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => !terpakai && !penuh && toggle(p.id)}
                                  disabled={terpakai || penuh}
                                  className={cn(
                                    'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors',
                                    terpakai
                                      ? 'cursor-default opacity-40'
                                      : penuh
                                        ? 'cursor-not-allowed opacity-40'
                                        : aktif
                                          ? 'bg-emerald-500/10'
                                          : 'hover:bg-white/5',
                                  )}
                                >
                                  <span
                                    className={cn(
                                      'grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors',
                                      aktif || terpakai
                                        ? 'border-emerald-500 bg-emerald-500 text-slate-950'
                                        : 'border-slate-700',
                                    )}
                                  >
                                    {(aktif || terpakai) && (
                                      <Check className="h-3 w-3" strokeWidth={3.5} />
                                    )}
                                  </span>
                                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-200">
                                    {p.nama}
                                  </span>
                                  <span className="shrink-0 text-[11px] font-bold tabular-nums text-slate-500">
                                    {terpakai ? 'sudah dipakai' : formatJarak(p.jarak)}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={tambahkan}
                    disabled={dipilih.size === 0}
                    className={cn(
                      'mt-3 w-full rounded-xl py-2.5 text-sm font-bold transition-all active:scale-[0.99]',
                      dipilih.size === 0
                        ? 'cursor-not-allowed bg-slate-800/60 text-slate-600'
                        : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30',
                    )}
                  >
                    {dipilih.size === 0
                      ? 'Centang tempat yang mau dijadikan patokan'
                      : `Tambahkan ${dipilih.size} patokan`}
                  </button>

                  <p className="mt-2.5 text-[11px] leading-relaxed text-slate-600">
                    Yang dicentang jadi baris patokan di bawah — nama, jarak, dan
                    satuannya masih bisa kamu ubah, dan daftarnya ringkas jadi
                    sebanyak apa pun tidak bikin halaman memanjang. Yang tidak
                    dicentang pun tetap tampil sendiri di halaman detail pada bagian
                    &ldquo;Yang ada di sekitar&rdquo;.
                  </p>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
