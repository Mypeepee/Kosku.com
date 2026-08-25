"use client";

/* ════════════════════════════════════════════════════════════
   FORMULIR PREFERENSI — SATU-SATUNYA di seluruh CRM
   ------------------------------------------------------------
   Dipakai TIGA tempat: "Tambah Klien", "Edit Klien", dan tambah/sunting
   kriteria dari dalam kartu klien.

   ── KENAPA DIEKSTRAK KE BERKAS SENDIRI ────────────────────────────────────
   Dulu ada DUA salinan: satu di KlienFormModal, satu di CrmPageClient. Persis
   yang selalu terjadi pada salinan pun terjadi — keduanya menyimpang. Salinan
   di modal tidak pernah tumbuh mengikuti yang lain, sehingga:

     • Patokan (landmark / nama jalan) dan Sertifikat hanya ada di satu sisi.
       Agent yang mencatat "rumah dekat UNESA" saat MENAMBAH klien kehilangan
       patokan itu tanpa peringatan, lalu menemukannya kembali saat menyunting
       dari kartu klien — dan menyimpulkan aplikasinya yang tidak konsisten.
     • Kewajibannya terbalik: satu sisi mewajibkan TIPE dan membiarkan lokasi
       kosong, sisi lain mewajibkan LOKASI dan membiarkan tipe kosong. Yang
       benar yang kedua — tipe kosong berarti "semua tipe", sedangkan kriteria
       tanpa wilayah menyaring 120 ribu aset se-Indonesia dan tidak pernah
       menghasilkan daftar yang berguna.

   Sekarang tidak ada salinan. Satu komponen, dua bingkai: `<KartuPreferensi>`
   untuk yang tersemat di daftar (formulir klien), `<FormPreferensi>` untuk yang
   berdiri sendiri dengan tombol Simpan/Batal (kartu klien).
   ════════════════════════════════════════════════════════════ */

import { useState } from "react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import TypePicker from "@/components/search/TypePicker";
import LocationPicker from "@/components/search/LocationPicker";
import KeywordField from "@/components/search/KeywordField";
import { PremiumSelect, type PremiumOption } from "./CrmFormControls";
import { regionKey, type RegionLevel, type SelectedRegion } from "@/lib/regionSearch";
import { labelLuas } from "@/lib/klienRingkas";
import {
  PreferensiForm, PreferensiKlien, TipeProperti, JenisTransaksi, TujuanBeli,
  JENIS_TRANSAKSI_LABEL, TIPE_PROPERTI_LABEL, SERTIFIKAT_LABEL, type Sertifikat,
} from "./types";

/* ── Opsi & gaya bersama ───────────────────────────────────────────────── */

export const TIPE_ICONS: Record<string, string> = {
  "Rumah":         "solar:home-2-bold-duotone",
  "Apartemen":     "solar:buildings-2-bold-duotone",
  "Gudang":        "solar:box-minimalistic-bold-duotone",
  "Tanah":         "solar:map-point-wave-bold-duotone",
  "Pabrik":        "solar:garage-bold-duotone",
  "Ruko":          "solar:shop-2-bold-duotone",
  "Toko":          "solar:shop-bold-duotone",
  "Hotel & Villa": "solar:bed-bold-duotone",
};
export const TIPE_LABELS = Object.values(TIPE_PROPERTI_LABEL);
const LABEL_TO_TIPE = Object.fromEntries(
  Object.entries(TIPE_PROPERTI_LABEL).map(([k, v]) => [v, k as TipeProperti]),
);

export const TUJUAN_OPTIONS: PremiumOption[] = [
  { value: "",          label: "Belum tahu" },
  { value: "ditempati", label: "Ditempati" },
  { value: "investasi", label: "Investasi" },
  { value: "disewakan", label: "Disewakan" },
];

const JENIS_OPTIONS: PremiumOption[] = [
  { value: "", label: "-- Semua --" },
  ...(Object.entries(JENIS_TRANSAKSI_LABEL) as [string, string][]).map(([k, v]) => ({ value: k, label: v })),
];

const SERTIFIKAT_OPTIONS: PremiumOption[] = [
  { value: "", label: "Tidak masalah" },
  ...(["SHM", "HGB", "HGU", "HP", "AJB", "PPJB", "LAINNYA"] as Sertifikat[])
    .map(s => ({ value: s, label: SERTIFIKAT_LABEL[s] })),
];

const KELAS_INPUT =
  "w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[12.5px] text-white placeholder-slate-600 outline-none transition-all focus:border-emerald-400/50 focus:bg-white/[0.05]";

/** Rp dengan pemisah ribuan, tanpa mengganggu kursor: input tetap teks. */
export function formatRupiah(raw: string) {
  const num = String(raw).replace(/\D/g, "");
  if (!num) return "";
  return Number(num).toLocaleString("id-ID");
}
export function unformatRupiah(formatted: string) {
  return String(formatted).replace(/\./g, "").replace(/,/g, "");
}

/* ── Aturan sah ────────────────────────────────────────────────────────────
   DIPUSATKAN, dan itu yang membuat kedua formulir tidak bisa lagi berbeda
   pendapat soal apa yang boleh disimpan. Aturannya sama dengan yang ditegakkan
   server di src/lib/preferensiInput.ts — kalau salah satunya berubah, yang
   satunya lagi harus ikut, dan keduanya sekarang cukup pendek untuk dibaca
   berdampingan. */
export function masalahPreferensi(p: PreferensiForm): string | null {
  if (p.locations.length === 0) return "Lokasi belum dipilih";
  const bmin = Number(unformatRupiah(p.budget_min)) || 0;
  const bmax = Number(unformatRupiah(p.budget_max)) || 0;
  if (bmin && bmax && bmin > bmax) return "Budget minimum lebih besar dari maksimum";
  const lmin = Number(unformatRupiah(p.luas_min)) || 0;
  const lmax = Number(unformatRupiah(p.luas_max)) || 0;
  if (lmin && lmax && lmin > lmax) return "Luas minimum lebih besar dari maksimum";
  return null;
}

export type PickerPref = "type" | "transaksi" | "location" | "tujuan" | "legalitas" | null;

/* ════════════════════════════════════════════════════════════
   PEMETAAN FORM ⇄ BARIS TERSIMPAN
   ------------------------------------------------------------
   Satu kartu di layar BUKAN satu baris di database. Formulir menerima banyak
   tipe DAN banyak lokasi sekaligus ("Gudang atau Pabrik di Surabaya, Gresik"),
   lalu menyimpannya sebagai PERKALIAN keduanya — enam baris. Saat dibaca lagi,
   baris yang kriteria bersamanya sama digabung balik jadi satu kartu.

   Kedua arah itu ditulis berdampingan di sini dengan sengaja: begitu salah
   satunya melupakan sebuah kolom, kolom itu lenyap dalam satu putaran
   buka-simpan tanpa satu pun galat. Itulah yang pernah terjadi pada sertifikat
   dan patokan.
   ════════════════════════════════════════════════════════════ */

/** Sebuah wilayah terpilih → 4 kolom lokasi terstruktur (level terpilih + induknya). */
export function regionToLocFields(r: SelectedRegion) {
  const f: { loc_provinsi: string | null; loc_kota: string | null; loc_kecamatan: string | null; loc_kelurahan: string | null } =
    { loc_provinsi: null, loc_kota: null, loc_kecamatan: null, loc_kelurahan: null };
  switch (r.level) {
    case "provinsi":  f.loc_provinsi = r.name; break;
    case "kota":      f.loc_kota = r.name;      if (r.parent) f.loc_provinsi = r.parent; break;
    case "kecamatan": f.loc_kecamatan = r.name; if (r.parent) f.loc_kota = r.parent; break;
    case "kelurahan": f.loc_kelurahan = r.name; if (r.parent) f.loc_kecamatan = r.parent; break;
  }
  return f;
}

/** Kolom lokasi tersimpan → satu wilayah (level terdalam yang terisi), untuk
 *  menghidrasi picker saat menyunting. */
export function locFieldsToRegion(p: {
  loc_provinsi: string | null; loc_kota: string | null;
  loc_kecamatan: string | null; loc_kelurahan: string | null;
}): SelectedRegion | null {
  const mk = (level: RegionLevel, name: string, parent?: string | null): SelectedRegion =>
    ({ id: `${level}:${name}`, name, level, ...(parent ? { parent } : {}) });
  if (p.loc_kelurahan) return mk("kelurahan", p.loc_kelurahan, p.loc_kecamatan);
  if (p.loc_kecamatan) return mk("kecamatan", p.loc_kecamatan, p.loc_kota);
  if (p.loc_kota)      return mk("kota", p.loc_kota, p.loc_provinsi);
  if (p.loc_provinsi)  return mk("provinsi", p.loc_provinsi);
  return null;
}

/**
 * Satu kartu form → banyak payload preferensi (satu per kombinasi tipe × lokasi).
 *
 * Tanpa tipe → SATU baris per lokasi dengan tipe null ("semua tipe"). Versi
 * lama menghasilkan NOL baris saat tipe kosong, dan itulah sebabnya tipe dulu
 * terasa wajib: kartu tersimpan tanpa satu pun baris adalah kriteria yang tidak
 * pernah mencocokkan apa pun.
 */
export function buildPrefPayloads(p: PreferensiForm) {
  const shared = {
    jenis_transaksi: p.jenis_transaksi || null,
    budget_min:      p.budget_min ? Number(unformatRupiah(p.budget_min)) : null,
    budget_max:      p.budget_max ? Number(unformatRupiah(p.budget_max)) : null,
    luas_min:        p.luas_min ? Number(unformatRupiah(p.luas_min)) : null,
    luas_max:        p.luas_max ? Number(unformatRupiah(p.luas_max)) : null,
    legalitas:       p.legalitas || null,
    dekat_nilai:     p.dekat?.nilai ?? null,
    dekat_radius:    p.dekat?.radius ?? null,
    alamat_teks:     p.alamat_teks?.trim() || null,
    tujuan_beli:     p.tujuan_beli || null,
    catatan:         p.catatan.trim() || null,
  };
  const locs: (SelectedRegion | null)[] = p.locations.length ? p.locations : [null];
  const tipes: (TipeProperti | null)[] = p.tipe_properti.length ? p.tipe_properti : [null];
  const rows: Record<string, unknown>[] = [];
  for (const tipe of tipes) {
    for (const loc of locs) {
      rows.push({
        tipe_properti: tipe,
        lokasi_dicari: loc ? [loc.name, loc.parent].filter(Boolean).join(", ") : null,
        ...(loc ? regionToLocFields(loc) : { loc_provinsi: null, loc_kota: null, loc_kecamatan: null, loc_kelurahan: null }),
        ...shared,
      });
    }
  }
  return rows;
}

/** Sidik jari "kriteria bersama" sebuah baris — semua kolom KECUALI tipe &
 *  lokasi, yaitu tepat kolom yang boleh berbeda di dalam satu kartu.
 *  Angkanya dinormalkan lebih dulu: Decimal yang lewat JSON bisa datang sebagai
 *  "500000000" maupun 500000000, dan tanpa penormalan itu satu kartu pecah jadi
 *  dua persis sesudah disimpan. */
export function sidikKriteria(p: {
  jenis_transaksi?: string | null; budget_min?: unknown; budget_max?: unknown;
  luas_min?: unknown; luas_max?: unknown; legalitas?: string | null;
  dekat_nilai?: string | null; dekat_radius?: number | null; alamat_teks?: string | null;
  tujuan_beli?: string | null; catatan?: string | null;
}): string {
  const n = (v: unknown) => (v === null || v === undefined || v === "" ? "" : String(Number(v)));
  return JSON.stringify([
    p.jenis_transaksi || "",
    n(p.budget_min), n(p.budget_max), n(p.luas_min), n(p.luas_max),
    p.legalitas || "",
    p.dekat_nilai || "", n(p.dekat_radius), p.alamat_teks || "",
    p.tujuan_beli || "", p.catatan || "",
  ]);
}

/** Baris tersimpan → kartu form. Kebalikan `buildPrefPayloads`. */
export function groupPreferensi(rows: PreferensiKlien[]): PreferensiForm[] {
  const map = new Map<string, PreferensiForm>();
  for (const p of rows) {
    const sig = sidikKriteria(p);
    let card = map.get(sig);
    if (!card) {
      card = {
        tipe_properti:   [],
        jenis_transaksi: p.jenis_transaksi || "",
        locations:       [],
        budget_min:      p.budget_min ? formatRupiah(String(p.budget_min)) : "",
        budget_max:      p.budget_max ? formatRupiah(String(p.budget_max)) : "",
        luas_min:        p.luas_min ? formatRupiah(String(p.luas_min)) : "",
        luas_max:        p.luas_max ? formatRupiah(String(p.luas_max)) : "",
        legalitas:       p.legalitas || "",
        alamat_teks:     p.alamat_teks || "",
        /* Chip tempat dirakit ulang dari kolom yang tersimpan. Label & ikonnya
           diisi seadanya di sini; KeywordField menggantinya dengan yang benar
           begitu agent menyentuh kolomnya. Menanyakan kamus dari komponen
           formulir hanya demi label akan menambah satu permintaan jaringan
           untuk sesuatu yang tidak mengubah apa pun saat disimpan. */
        dekat:           p.dekat_nilai
          ? { nilai: p.dekat_nilai, nama: p.dekat_nilai, label: "Tempat",
              icon: "solar:map-point-bold-duotone", warna: "emerald",
              radius: p.dekat_radius ?? 1500 }
          : null,
        tujuan_beli:     p.tujuan_beli || "",
        catatan:         p.catatan || "",
      };
      map.set(sig, card);
    }
    /* Baris ber-tipe null tidak menambah centang apa pun — "semua tipe" adalah
       daftar centang yang KOSONG, dan itulah cara ia dibaca kembali. */
    if (p.tipe_properti && !card.tipe_properti.includes(p.tipe_properti)) {
      card.tipe_properti.push(p.tipe_properti);
    }
    const region = locFieldsToRegion(p);
    if (region && !card.locations.some(l => regionKey(l) === regionKey(region))) {
      card.locations.push(region);
    }
  }
  return Array.from(map.values());
}

/* ════════════════════════════════════════════════════════════
   ISI KARTU — seluruh medan, tanpa bingkai & tanpa tombol
   ════════════════════════════════════════════════════════════ */
export function IsiPreferensi({
  form, onUbah, pickerTerbuka, setPicker, idUnik = "pref",
}: {
  form: PreferensiForm;
  onUbah: <K extends keyof PreferensiForm>(key: K, val: PreferensiForm[K]) => void;
  pickerTerbuka: PickerPref;
  setPicker: (v: PickerPref) => void;
  /** Awalan id DOM. Formulir klien menggambar beberapa kartu sekaligus, dan
   *  `id` yang sama di dua kolom membuat <label htmlFor> menunjuk ke kotak yang
   *  salah — mengetuk label kartu kedua memfokuskan kartu pertama. */
  idUnik?: string;
}) {
  /* Teks yang sedang diketik di kolom patokan.
     WAJIB punya keadaannya sendiri. `KeywordField` adalah input TERKENDALI: ia
     menggambar apa pun yang diberikan lewat `value` dan menyerahkan tiap
     ketikan ke `onChange`. Diberi `value=""` tetap, hurufnya memang masuk tapi
     langsung dibuang dan React menggambar ulang string kosong — yang terlihat
     agent: kolomnya tidak bisa diketik sama sekali.

     Teksnya TIDAK ikut disimpan: yang disimpan hasil pilihannya (`form.dekat`
     atau `form.alamat_teks`), bukan kata kunci yang dipakai mencarinya. */
  const [teksDekat, setTeksDekat] = useState("");

  return (
    <>
      {/* ── Tipe Properti ── */}
      <div>
        <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
          Tipe Properti
          <span className="ml-1 font-semibold normal-case tracking-normal text-slate-600">
            — kosongkan = semua tipe
          </span>
        </label>
        <div className="h-[42px] rounded-xl border border-white/[0.08] bg-white/[0.03] transition-all hover:border-white/20">
          <TypePicker
            theme="dark"
            label=""
            value={form.tipe_properti.map(t => TIPE_PROPERTI_LABEL[t])}
            onChange={labels =>
              onUbah("tipe_properti", labels.map(l => LABEL_TO_TIPE[l]).filter(Boolean) as TipeProperti[])
            }
            options={TIPE_LABELS}
            icons={TIPE_ICONS}
            open={pickerTerbuka === "type"}
            onOpenChange={v => setPicker(v ? "type" : null)}
          />
        </div>
      </div>

      {/* ── Jenis Transaksi ── */}
      <div>
        <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
          Jenis Transaksi
        </label>
        <PremiumSelect
          value={form.jenis_transaksi}
          onChange={v => onUbah("jenis_transaksi", v as JenisTransaksi | "")}
          placeholder="-- Semua --"
          options={JENIS_OPTIONS}
          open={pickerTerbuka === "transaksi"}
          onOpenChange={v => setPicker(v ? "transaksi" : null)}
        />
      </div>

      {/* ── Lokasi ──
          Satu-satunya medan yang WAJIB. Lihat catatan di kepala berkas. */}
      <div>
        <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
          Lokasi <span className="text-rose-400">*</span>
          <span className="ml-1 font-semibold normal-case tracking-normal text-slate-600">
            — provinsi sampai kelurahan
          </span>
        </label>
        <div
          className={`h-[42px] rounded-xl border bg-white/[0.03] px-1 transition-all hover:border-white/20 ${
            form.locations.length === 0 ? "border-rose-400/40" : "border-white/[0.08]"
          }`}
        >
          <LocationPicker
            theme="dark"
            label=""
            value={form.locations}
            onChange={locs => onUbah("locations", locs)}
            open={pickerTerbuka === "location"}
            onOpenChange={v => setPicker(v ? "location" : null)}
          />
        </div>
      </div>

      {/* ── Patokan ──
          Memakai KeywordField yang SAMA dengan searchbar publik. Bukan demi
          hemat kode: kalau preferensi punya pemilih tempatnya sendiri, agent
          bisa memilih patokan yang tidak ada di kamus pencarian, dan hasil
          "cari aset" akan berbeda dari hasil pencarian untuk kriteria yang
          terlihat sama. */}
      <div>
        <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
          Patokan
          <span className="ml-1 font-semibold normal-case tracking-normal text-slate-600">
            — opsional · landmark atau nama jalan
          </span>
        </label>
        <KeywordField
          id={`${idUnik}-dekat`}
          label=""
          placeholder="mis. UNESA, hotel, atau Jalan Raya Darmo"
          value={teksDekat}
          onChange={setTeksDekat}
          /* DI SINILAH nama jalan ditangani. Panel saran menawarkan dua hal:
             daftar tempat dari kamus (landmark) dan satu baris "cari sebagai
             alamat" untuk teks yang bukan tempat. Baris kedua memanggil
             `onSubmit` — jadi di formulir ini onSubmit berarti "pakai teks ini
             sebagai patokan alamat", bukan "kirim formulir".

             Satu kolom melayani keduanya, dan itu disengaja: agent tidak perlu
             tahu lebih dulu apakah "Graha Family" terdaftar sebagai tempat atau
             cuma tertulis di alamat. Ia mengetik, lalu memilih. */
          onSubmit={() => {
            const t = teksDekat.trim();
            if (t.length < 3) return;
            onUbah("alamat_teks", t);
            onUbah("dekat", null);
            setTeksDekat("");
          }}
          theme="dark"
          width="w-full"
          dekat={form.dekat}
          onPilihTempat={t => {
            /* Keduanya saling meniadakan. Menyimpan landmark DAN teks alamat
               sekaligus memasang dua penyaring bersamaan — hampir selalu nol
               hasil, dan agent tidak akan menduga sebabnya. */
            onUbah("dekat", t);
            if (t) { onUbah("alamat_teks", ""); setTeksDekat(""); }
          }}
        />
        {form.dekat && (
          <p className="mt-1 text-[10.5px] text-slate-500">
            Radius {(form.dekat.radius / 1000).toFixed(1).replace(".", ",")} km dari {form.dekat.nama}
          </p>
        )}
        {form.alamat_teks && (
          <button
            type="button"
            onClick={() => onUbah("alamat_teks", "")}
            className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-500/10 py-1 pl-2 pr-1.5 text-[11px] font-bold text-sky-200 transition-colors hover:bg-sky-500/20"
          >
            <Icon icon="solar:signpost-2-bold-duotone" className="shrink-0 text-xs" />
            <span className="truncate">Alamat memuat “{form.alamat_teks}”</span>
            <Icon icon="solar:close-circle-bold" className="shrink-0 text-sm opacity-70" />
          </button>
        )}
      </div>

      {/* ── Budget ── */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Budget Min (Rp)</label>
          <input type="text" inputMode="numeric" placeholder="500.000.000"
            value={form.budget_min}
            onChange={e => onUbah("budget_min", formatRupiah(e.target.value))}
            className={KELAS_INPUT} />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Budget Max (Rp)</label>
          <input type="text" inputMode="numeric" placeholder="2.000.000.000"
            value={form.budget_max}
            onChange={e => onUbah("budget_max", formatRupiah(e.target.value))}
            className={KELAS_INPUT} />
        </div>
      </div>

      {/* ── Luas ── */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          {/* Label MENYEBUT dimensinya. "Luas Min" saja adalah sumber bug
              yang sudah diperbaiki di mesin pencocokan: agent mengetik 500
              untuk gudang bermaksud luas TANAH, sementara mesin dulu menerima
              luas bangunan juga — dan kartu hasilnya menampilkan "LT 100".
              Kalau layarnya sendiri tidak menyebut dimensinya, agent tidak
              punya cara menduga angka mana yang sedang dibandingkan, lalu ia
              menyalahkan hasilnya alih-alih isiannya. */}
          <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{labelLuas(form.tipe_properti)} min (m²)</label>
          <input type="text" inputMode="numeric" placeholder="60"
            value={form.luas_min}
            onChange={e => onUbah("luas_min", formatRupiah(e.target.value))}
            className={KELAS_INPUT} />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{labelLuas(form.tipe_properti)} max (m²)</label>
          <input type="text" inputMode="numeric" placeholder="500"
            value={form.luas_max}
            onChange={e => onUbah("luas_max", formatRupiah(e.target.value))}
            className={KELAS_INPUT} />
        </div>
      </div>

      {/* ── Sertifikat + Tujuan + Catatan ── */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          {/* Satu-satunya kriteria tambahan yang bisa dijawab data listing
              (99,9% terisi; kamar tidur hanya 4 baris dari 120 ribu). Kosong =
              tidak mempermasalahkan — keadaan bawaan yang paling sering benar,
              dan memaksa agent memilih hanya membuatnya mengarang jawaban. */}
          <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Sertifikat</label>
          <PremiumSelect
            value={form.legalitas}
            onChange={v => onUbah("legalitas", v as Sertifikat | "")}
            placeholder="-- Tidak masalah --"
            options={SERTIFIKAT_OPTIONS}
            open={pickerTerbuka === "legalitas"}
            onOpenChange={v => setPicker(v ? "legalitas" : null)}
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Tujuan Beli</label>
          <PremiumSelect
            value={form.tujuan_beli}
            onChange={v => onUbah("tujuan_beli", v as TujuanBeli | "")}
            placeholder="-- Belum tahu --"
            options={TUJUAN_OPTIONS}
            open={pickerTerbuka === "tujuan"}
            onOpenChange={v => setPicker(v ? "tujuan" : null)}
          />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Catatan</label>
          <input type="text" placeholder="Hal lain yang diinginkan..."
            value={form.catatan}
            onChange={e => onUbah("catatan", e.target.value)}
            className={KELAS_INPUT} />
        </div>
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   BINGKAI 1 — kartu tersemat (dipakai formulir klien)
   ════════════════════════════════════════════════════════════ */
export function KartuPreferensi({
  index, form, onUbah, onHapus, sorotMasalah,
}: {
  index: number;
  form: PreferensiForm;
  onUbah: <K extends keyof PreferensiForm>(key: K, val: PreferensiForm[K]) => void;
  onHapus: () => void;
  /** Tampilkan pesan masalah. Sengaja BARU sesudah agent menekan simpan:
   *  memerahkan kartu yang belum sempat diisi adalah teguran untuk sesuatu
   *  yang belum dilakukan siapa pun. */
  sorotMasalah?: boolean;
}) {
  const [picker, setPicker] = useState<PickerPref>(null);
  const masalah = masalahPreferensi(form);

  return (
    <div
      className={`space-y-3 rounded-2xl border bg-white/[0.02] p-4 transition-colors ${
        sorotMasalah && masalah ? "border-rose-400/40 bg-rose-500/[0.04]" : "border-white/[0.07]"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
          Preferensi #{index + 1}
        </span>
        <button
          type="button"
          onClick={onHapus}
          title="Hapus preferensi ini"
          className="grid h-7 w-7 place-items-center rounded-lg border border-rose-400/20 bg-rose-500/10 text-rose-300 transition-colors hover:bg-rose-500/20"
        >
          <Icon icon="solar:trash-bin-2-bold-duotone" className="text-sm" />
        </button>
      </div>

      <IsiPreferensi
        form={form}
        onUbah={onUbah}
        pickerTerbuka={picker}
        setPicker={setPicker}
        idUnik={`pref-${index}`}
      />

      {sorotMasalah && masalah && (
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-300">
          <Icon icon="solar:danger-triangle-bold-duotone" className="shrink-0 text-sm" />
          {masalah}
        </p>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   BINGKAI 2 — formulir berdiri sendiri (dipakai kartu klien)
   ════════════════════════════════════════════════════════════ */
export function FormPreferensi({
  form, setForm, pickerTerbuka, setPicker, judul, ikon, labelSimpan,
  menyimpan, galat, onBatal, onSimpan, className,
}: {
  form: PreferensiForm;
  setForm: (f: (p: PreferensiForm | null) => PreferensiForm | null) => void;
  pickerTerbuka: PickerPref;
  setPicker: (v: PickerPref) => void;
  judul: string;
  ikon: string;
  labelSimpan: string;
  menyimpan: boolean;
  /** Pesan kegagalan dari server. Ditampilkan DI DALAM formulir, tempat mata
   *  agent sedang berada, dan isian tetap utuh untuk dicoba lagi. */
  galat?: string | null;
  onBatal: () => void;
  onSimpan: () => void;
  /** Pembungkus opsional. Ada supaya komponen ini bisa jadi anak LANGSUNG
   *  <AnimatePresence>: membungkusnya dengan <div> biasa membuat animasi keluar
   *  tidak pernah berjalan — AnimatePresence hanya melihat anak langsungnya. */
  className?: string;
}) {
  const masalah = masalahPreferensi(form);

  const onUbah = <K extends keyof PreferensiForm>(key: K, val: PreferensiForm[K]) =>
    setForm(f => (f ? { ...f, [key]: val } : f));

  return (
    <motion.div
      key={judul}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className={`space-y-3 p-3 ${className ?? ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/20">
            <Icon icon={ikon} className="text-[10px] text-emerald-300" />
          </div>
          <p className="text-[11px] font-bold text-emerald-300">{judul}</p>
        </div>
        <button onClick={onBatal} className="text-[10px] font-semibold text-slate-400 transition-colors hover:text-white">
          Batal
        </button>
      </div>

      <IsiPreferensi form={form} onUbah={onUbah} pickerTerbuka={pickerTerbuka} setPicker={setPicker} />

      {galat && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 p-2.5 text-[11.5px] text-rose-200">
          <Icon icon="solar:danger-triangle-bold-duotone" className="mt-px shrink-0 text-sm" />
          <span>{galat}</span>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={onBatal}
          className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 text-[12px] font-bold text-slate-300 transition-all hover:border-white/20 hover:text-white"
        >
          Batal
        </button>
        <button
          onClick={onSimpan}
          disabled={menyimpan || !!masalah}
          title={masalah ?? undefined}
          className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 py-2.5 text-[12px] font-extrabold text-[#04130d] transition-all hover:from-emerald-400 hover:to-emerald-300 disabled:opacity-50"
        >
          {menyimpan
            ? <><Icon icon="solar:refresh-circle-bold-duotone" className="animate-spin text-sm" /> Menyimpan…</>
            : <><Icon icon="solar:check-circle-bold" className="text-sm" /> {labelSimpan}</>}
        </button>
      </div>

      {/* Tombol yang mati tanpa penjelasan membuat agent mengira formulirnya
          rusak. Satu kalimat menghapus seluruh tebakan itu. */}
      {masalah && (
        <p className="text-center text-[10.5px] text-slate-500">
          {form.locations.length === 0
            ? <>Pilih <span className="font-bold text-slate-300">lokasi</span> dulu — sisanya boleh dikosongkan.</>
            : masalah}
        </p>
      )}
    </motion.div>
  );
}
