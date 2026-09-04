"use client";

/**
 * Kolom kata kunci search bar — sekaligus pintu masuk pencarian TEMPAT.
 *
 * ── APA YANG BERUBAH DAN KENAPA ─────────────────────────────────────────────
 * Dulu kolom ini cuma menebak "angka semua → ID properti, selain itu → alamat".
 * Tebakan itu benar tapi tidak cukup, karena yang paling sering diketik orang
 * bukan keduanya: yang diketik adalah "deket unesa", "deket rs soetomo",
 * "sekitaran gacoan". Diperlakukan sebagai alamat, kalimat-kalimat itu dicari
 * apa adanya di dalam kolom `alamat_lengkap`, tidak ketemu, dan halaman
 * menjawab "0 properti" — kegagalan yang terbaca seperti "memang tidak ada
 * asetnya", padahal ada puluhan.
 *
 * Sekarang: sambil diketik, kolom ini menawarkan tempat dari kamus. Memilih
 * satu mengubah pencarian jadi "di sekitar tempat itu", dengan radius yang
 * sesuai kelasnya (kampus 5 km, warung 1,2 km).
 *
 * JARING PENGAMAN. Orang yang mengabaikan saran dan langsung menekan Enter
 * tidak dihukum: `q` tetap terkirim seperti dulu, dan SERVER yang mencoba
 * mengenali tempatnya sendiri (lihat tebakTempatDariTeks). Saran di sini
 * mempercepat, bukan mensyaratkan.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { isNumericOnly, type TempatDipilih } from "@/lib/searchTabs";
import TempatSaranPanel, { type SaranTempatUi } from "./TempatSaranPanel";
import ContohKetikan, { type JenisContoh } from "./ContohKetikan";

type Theme = "light" | "dark";

const THEMES: Record<
  Theme,
  {
    label: string; input: string; badgeId: string; badgeText: string;
    badgeTempat: string; badgeContoh: string; clear: string; icon: string; chip: string;
  }
> = {
  light: {
    label: "text-gray-400 group-focus-within:text-primary",
    input: "text-gray-800 placeholder:text-gray-400",
    badgeId: "bg-blue-50 text-blue-600 border-blue-100",
    badgeText: "bg-primary/10 text-primary border-primary/20",
    badgeTempat: "bg-emerald-50 text-emerald-600 border-emerald-100",
    badgeContoh: "bg-gray-100 text-gray-400 border-gray-200",
    clear: "text-gray-300 hover:text-red-500 hover:bg-red-50",
    icon: "text-gray-400 group-focus-within:text-primary",
    chip: "bg-gray-100 border-gray-200 text-gray-800 hover:border-red-200 hover:text-red-500",
  },
  dark: {
    label: "text-gray-400 group-focus-within:text-primary",
    input: "text-white placeholder:text-gray-600",
    badgeId: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    badgeText: "bg-primary/15 text-primary border-primary/30",
    badgeTempat: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    badgeContoh: "bg-white/5 text-gray-500 border-white/10",
    clear: "text-gray-500 hover:text-red-400 hover:bg-red-500/10",
    icon: "text-gray-400 group-focus-within:text-primary",
    chip: "bg-white/5 border-white/10 text-white hover:border-red-500/40 hover:text-red-300",
  },
};

/**
 * Jeda sebelum menembak API saran.
 *
 * 220 ms adalah jeda yang cukup lama untuk menelan ketikan beruntun dalam satu
 * kata, tapi masih di bawah ambang yang terasa seperti "lag" (±250 ms). Tanpa
 * jeda, mengetik "universitas" berarti sebelas permintaan yang sepuluh di
 * antaranya jawabannya sudah basi sebelum tiba.
 */
const JEDA_KETIK_MS = 220;
const MIN_KETIK = 2;

export default function KeywordField({
  id,
  label,
  placeholder = "Alamat / ID / tempat, ex: deket UNESA",
  value,
  onChange,
  onSubmit,
  onFocusField,
  theme = "dark",
  width = "lg:w-[24%]",
  dekat = null,
  onPilihTempat,
  kota = null,
  tx = "semua",
}: {
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  /** Dipanggil saat kolom ini diaktifkan — dipakai menutup dropdown lain. */
  onFocusField?: () => void;
  theme?: Theme;
  width?: string;
  /** Tempat yang sedang dipilih; null = belum ada. */
  dekat?: TempatDipilih | null;
  /** Tanpa handler ini, saran tempat dimatikan (mis. kotak cari internal). */
  onPilihTempat?: (t: TempatDipilih | null) => void;
  /** Kota yang sedang dilihat — menaikkan saran di kota itu, tidak menyaring. */
  kota?: string | null;
  /**
   * Tab transaksi halaman ini. Dipakai supaya angka "37 properti" di baris
   * alamat menghitung himpunan yang SAMA dengan yang akan tampil setelah
   * diklik — angka yang benar untuk halaman lain adalah janji yang meleset.
   */
  tx?: "semua" | "beli" | "sewa" | "lelang";
}) {
  const t = THEMES[theme];
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [saran, setSaran] = useState<SaranTempatUi[]>([]);
  /**
   * Tawaran pembuka: pintasan kawasan + tempat terpopuler, diambil sekali saat
   * kolomnya pertama kali disentuh. Inilah yang membuat pencarian per tempat
   * DITEMUKAN — sebelumnya kotak kosong tidak memberi petunjuk apa pun bahwa
   * "deket kampus" akan berhasil.
   */
  const [populer, setPopuler] = useState<SaranTempatUi[]>([]);
  /** Tawaran "cari sebagai alamat" + jumlahnya — lihat catatan di panel. */
  const [alamat, setAlamat] = useState<{ teks: string; jumlah: number | null } | null>(
    null,
  );
  const [memuat, setMemuat] = useState(false);
  const [fokus, setFokus] = useState(false);
  const [aktif, setAktif] = useState(0);
  const [kueriTerakhir, setKueriTerakhir] = useState("");
  /**
   * Jenis contoh yang sedang diketik sendiri di placeholder. Menghidupkan
   * lencana di sudut kolom — ruang yang justru KOSONG selama kolomnya kosong,
   * dan yang nanti dipakai umpan balik sungguhan begitu user mengetik.
   */
  const [jenisContoh, setJenisContoh] = useState<JenisContoh | null>(null);

  const trimmed = value.trim();
  const mode: "id" | "alamat" | null =
    trimmed === "" ? null : isNumericOnly(trimmed) ? "id" : "alamat";

  const saranHidup = Boolean(onPilihTempat);

  // ── Ambil saran (debounce + batalkan yang kedaluwarsa) ────────────────────
  useEffect(() => {
    if (!saranHidup) return;
    // Angka murni adalah ID properti, bukan nama tempat — tidak ada gunanya
    // menanyakan "123" ke kamus tempat.
    if (trimmed.length < MIN_KETIK || isNumericOnly(trimmed)) {
      setSaran([]);
      setAlamat(null);
      setMemuat(false);
      return;
    }

    const ac = new AbortController();
    const jam = setTimeout(async () => {
      setMemuat(true);
      try {
        const url =
          `/api/tempat/cari?q=${encodeURIComponent(trimmed)}&tx=${tx}` +
          (kota ? `&kota=${encodeURIComponent(kota)}` : "");
        const res = await fetch(url, { signal: ac.signal });
        const json = await res.json();
        setSaran(Array.isArray(json?.items) ? json.items : []);
        setAlamat(json?.alamat ?? null);
        setKueriTerakhir(trimmed);
        setAktif(0);
      } catch {
        // Termasuk pembatalan karena ketikan berikutnya — bukan kesalahan, dan
        // menampilkan pesan error untuk itu justru yang salah.
      } finally {
        setMemuat(false);
      }
    }, JEDA_KETIK_MS);

    return () => {
      clearTimeout(jam);
      ac.abort();
    };
  }, [trimmed, kota, tx, saranHidup]);

  // Sekali saja per kolom: isinya berubah dalam hitungan hari, bukan detik,
  // dan API-nya sudah di-cache di tepi.
  useEffect(() => {
    if (!saranHidup || !fokus || populer.length > 0) return;
    let batal = false;
    (async () => {
      try {
        const url =
          "/api/tempat/cari?populer=1" +
          (kota ? `&kota=${encodeURIComponent(kota)}` : "");
        const res = await fetch(url);
        const json = await res.json();
        if (!batal && Array.isArray(json?.items)) setPopuler(json.items);
      } catch {
        // Kolomnya tetap berfungsi penuh tanpa tawaran pembuka.
      }
    })();
    return () => {
      batal = true;
    };
  }, [saranHidup, fokus, kota, populer.length]);

  // Pindah antara tawaran pembuka dan hasil ketikan mengganti seluruh isi
  // daftar — sorotan lama akan menunjuk baris yang sama sekali berbeda.
  useEffect(() => setAktif(0), [trimmed.length >= MIN_KETIK]);

  const pilih = useCallback(
    (s: SaranTempatUi) => {
      onPilihTempat?.({
        nilai: s.nilai,
        nama: s.nama,
        label: s.label,
        icon: s.icon,
        warna: s.warna,
        kota: s.kota,
        radius: s.radius,
        cabang: s.cabang,
        kelasSemua: s.kelasSemua,
      });
      setSaran([]);
      setFokus(false);
      inputRef.current?.blur();
    },
    [onPilihTempat],
  );

  const modePopuler =
    saranHidup && !dekat && trimmed.length < MIN_KETIK && populer.length > 0;
  const daftar = modePopuler ? populer : saran;

  /**
   * Baris alamat ikut dinavigasi papan ketik, dan letaknya SETELAH daftar
   * tempat. Konsekuensinya disengaja: saat tidak ada tempat yang cocok, ia
   * jadi baris pertama sekaligus yang tersorot — jadi menekan Enter melakukan
   * persis hal yang paling masuk akal, dan pemakainya melihat lebih dulu apa
   * yang akan terjadi.
   */
  const adaAlamat = Boolean(alamat) && !modePopuler;
  const totalBaris = daftar.length + (adaAlamat ? 1 : 0);

  const panelTerbuka =
    saranHidup &&
    fokus &&
    ((trimmed.length >= MIN_KETIK &&
      !isNumericOnly(trimmed) &&
      // `memuat` ikut membuka panel supaya ada keadaan "sedang mencari".
      // Tanpa itu panel baru muncul saat jawaban tiba, dan ketikan cepat
      // terasa seperti tidak ada yang terjadi.
      (totalBaris > 0 || memuat)) ||
      modePopuler);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!panelTerbuka || totalBaris === 0) {
      if (e.key === "Enter") onSubmit();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAktif((i) => (i + 1) % totalBaris);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAktif((i) => (i - 1 + totalBaris) % totalBaris);
    } else if (e.key === "Enter") {
      e.preventDefault();
      // Di mode tawaran pembuka, Enter TIDAK memilih apa pun kecuali user
      // memang sudah menyorot sebuah baris dengan panah. Kalau tidak, ia
      // mencari seperti biasa — menekan Enter di kotak kosong tidak boleh
      // tiba-tiba mendarat di "semua kampus".
      if (modePopuler && aktif === 0 && !value) {
        onSubmit();
        return;
      }
      // Sorotan di luar daftar tempat = baris alamat.
      if (aktif >= daftar.length) {
        onSubmit();
        return;
      }
      pilih(daftar[aktif] ?? daftar[0]);
    } else if (e.key === "Escape") {
      setFokus(false);
    }
  };

  return (
    <div
      ref={wrapRef}
      className={`w-full ${width} px-3 lg:px-4 py-4 lg:py-2.5 relative group min-w-0`}
      onClick={() => {
        onFocusField?.();
        inputRef.current?.focus();
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <label
          htmlFor={id}
          className={`text-[10px] font-extrabold tracking-wider uppercase block transition-colors cursor-pointer ${t.label}`}
        >
          {label}
        </label>
        {dekat ? (
          <span
            className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-[1px] rounded-full leading-none border ${t.badgeTempat}`}
            title={`Hasil disaring di sekitar ${dekat.nama}`}
          >
            Dekat
          </span>
        ) : !value && jenisContoh ? (
          /* Lencana CONTOH — sengaja lebih redup daripada lencana sungguhan,
             supaya terbaca sebagai "begini nanti", bukan "begini sekarang".
             Inilah yang membuat ketiga kemampuan kolom ini terlihat tanpa
             memakan satu piksel pun ruang mendatar. */
          <span
            className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-[1px] rounded-full leading-none border transition-colors ${t.badgeContoh}`}
            title="Contoh — kolom ini menerima nama tempat, alamat, atau ID properti"
          >
            {jenisContoh === "tempat"
              ? "Tempat"
              : jenisContoh === "alamat"
                ? "Alamat"
                : "ID"}
          </span>
        ) : (
          mode && (
            <span
              className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-[1px] rounded-full leading-none border ${
                mode === "id" ? t.badgeId : t.badgeText
              }`}
              title={
                mode === "id"
                  ? "Akan dicari sebagai ID Properti"
                  : "Akan dicari sebagai alamat — atau sebagai tempat, kalau namanya dikenali"
              }
            >
              {mode === "id" ? "ID" : "Alamat"}
            </span>
          )
        )}
      </div>

      {/* Chip tempat berdiri SENDIRI di atas input, bukan menggantikannya:
          "kos murah" + "dekat UNESA" adalah pencarian yang wajar, dan
          menghapus kotak teksnya begitu tempat dipilih akan menutup separuh
          kemampuan yang justru baru saja ditambahkan. */}
      {dekat && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPilihTempat?.(null);
            inputRef.current?.focus();
          }}
          className={`mb-1.5 max-w-full inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-lg border text-xs font-bold transition-colors ${t.chip}`}
          title="Hapus filter tempat"
        >
          <span
            className="shrink-0 w-5 h-5 rounded-md grid place-items-center"
            style={{ backgroundColor: `${dekat.warna}22`, color: dekat.warna }}
          >
            <Icon icon={dekat.icon} className="text-sm" />
          </span>
          <span className="truncate">{dekat.nama}</span>
          <Icon icon="solar:close-circle-bold" className="shrink-0 text-sm opacity-60" />
        </button>
      )}

      <div className="flex items-center gap-2">
        <Icon
          icon={
            dekat
              ? "solar:map-point-bold-duotone"
              : mode === "id"
                ? "solar:hashtag-square-bold-duotone"
                : "solar:magnifer-bold-duotone"
          }
          className={`text-xl shrink-0 transition-colors ${t.icon}`}
        />
        <div className="relative min-w-0 flex-1">
          <input
            id={id}
            ref={inputRef}
            type="text"
            inputMode="text"
            autoComplete="off"
            value={value}
            // Placeholder asli dikosongkan saat contoh berputar mengambil alih
            // — dua teks di posisi yang sama akan saling menimpa.
            placeholder={dekat ? "Tambah kata kunci (opsional)" : ""}
            aria-describedby={`${id}-contoh`}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFokus(true)}
            // Jeda sebelum menutup: klik pada baris saran terjadi SETELAH blur,
            // dan menutup panel seketika berarti kliknya jatuh ke ruang kosong.
            onBlur={() => setTimeout(() => setFokus(false), 120)}
            onKeyDown={onKeyDown}
            onClick={(e) => e.stopPropagation()}
            className={`w-full bg-transparent outline-none font-bold text-sm placeholder:font-medium truncate ${t.input}`}
          />

          {!value && !dekat && (
            <span
              id={`${id}-contoh`}
              aria-live="off"
              className="pointer-events-none absolute inset-0 flex items-center overflow-hidden"
            >
              <ContohKetikan
                onJenis={setJenisContoh}
                className="ketikan-hantu truncate text-sm font-medium leading-none"
                // Bagian yang diam sengaja lebih redup daripada bagian yang
                // diketik: itu yang membuat kata yang berubah menonjol tanpa
                // perlu gerakan tambahan.
                kelasAwal={theme === "dark" ? "text-gray-600" : "text-gray-400"}
                kelasInti={
                  theme === "dark"
                    ? "font-bold text-primary/70"
                    : "font-bold text-primary"
                }
              />
            </span>
          )}
        </div>
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
              inputRef.current?.focus();
            }}
            className={`shrink-0 p-1 -m-1 rounded-full transition-colors ${t.clear}`}
            aria-label="Hapus pencarian"
          >
            <Icon icon="solar:close-circle-bold" className="text-base" />
          </button>
        )}
      </div>

      <TempatSaranPanel
        anchorRef={wrapRef}
        open={panelTerbuka}
        items={daftar}
        memuat={memuat}
        kueri={kueriTerakhir || trimmed}
        populer={modePopuler}
        alamat={adaAlamat ? alamat : null}
        onPilihAlamat={onSubmit}
        onContoh={(teks) => {
          onChange(teks);
          inputRef.current?.focus();
        }}
        aktif={aktif}
        onHover={setAktif}
        onPilih={pilih}
        theme={theme}
      />
    </div>
  );
}
