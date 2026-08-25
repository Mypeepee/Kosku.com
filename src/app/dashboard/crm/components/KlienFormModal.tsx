"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import {
  Klien, KlienForm, KlienStatus, MetodePembayaran, PreferensiForm, PreferensiKlien, SumberKlien,
  TipeProperti, JenisTransaksi, TujuanBeli,
  EMPTY_PREFERENSI, JENIS_TRANSAKSI_LABEL, TIPE_PROPERTI_LABEL,
} from "./types";
import { PremiumSelect, PremiumDateTimePicker, type PremiumOption } from "./CrmFormControls";
import LocationPicker from "@/components/search/LocationPicker";
import TypePicker from "@/components/search/TypePicker";
import { regionKey, type RegionLevel, type SelectedRegion } from "@/lib/regionSearch";
import { labelLuas } from "@/lib/klienRingkas";

/* Opsi dropdown — dipakai PremiumSelect */
const SUMBER_OPTIONS: PremiumOption[] = [
  { value: "wa_organik", label: "WA Organik", icon: "ic:baseline-whatsapp" },
  { value: "iklan",      label: "Iklan",      icon: "solar:tag-price-bold-duotone" },
  { value: "referral",   label: "Referral",   icon: "solar:users-group-rounded-bold-duotone" },
  { value: "website",    label: "Website",    icon: "solar:global-bold-duotone" },
  { value: "walk_in",    label: "Walk In",    icon: "solar:walking-bold-duotone" },
  { value: "titip_jual", label: "Titip Jual", icon: "solar:home-add-bold-duotone" },
  { value: "lainnya",    label: "Lainnya",    icon: "solar:inbox-line-bold-duotone" },
];
const STATUS_OPTIONS: PremiumOption[] = [
  { value: "lead_baru",      label: "Lead Baru",      dot: "bg-rose-400" },
  { value: "sudah_dikontak", label: "Sudah Dikontak", dot: "bg-sky-400" },
  { value: "hot_buyer",      label: "Hot Buyer",      dot: "bg-amber-400" },
  { value: "closing",        label: "Closing",        dot: "bg-emerald-400" },
  { value: "lost_iseng",     label: "Lost / Iseng",   dot: "bg-slate-500" },
];
const METODE_OPTIONS: PremiumOption[] = [
  { value: "",     label: "Belum ditentukan", icon: "solar:minus-circle-line-duotone" },
  { value: "cash", label: "Cash",             icon: "solar:wallet-money-bold-duotone" },
  { value: "kpr",  label: "KPR",              icon: "solar:card-bold-duotone" },
];
export const TUJUAN_OPTIONS: PremiumOption[] = [
  { value: "",          label: "Belum tahu" },
  { value: "ditempati", label: "Ditempati" },
  { value: "investasi", label: "Investasi" },
  { value: "disewakan", label: "Disewakan" },
];

// Icon per tipe properti — sama persis dengan PROPERTY_ICONS di Home/Hero/search.tsx
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
// Reverse map: label → enum key
const LABEL_TO_TIPE = Object.fromEntries(
  Object.entries(TIPE_PROPERTI_LABEL).map(([k, v]) => [v, k as TipeProperti])
);

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (klien: Klien) => void;
  initialData?: Partial<KlienForm>;
  editTarget?: Klien;
}

const INITIAL_FORM: KlienForm = {
  nama: "", nomor_whatsapp: "", email: "",
  sumber: "wa_organik", status: "lead_baru",
  metode_pembayaran: "", bank_kpr: "", tenor_kpr: "",
  catatan: "", tanggal_follow_up: "",
  preferensi: [],
};

export function formatRupiah(raw: string) {
  const num = raw.replace(/\D/g, "");
  if (!num) return "";
  return Number(num).toLocaleString("id-ID");
}

export function unformatRupiah(formatted: string) {
  return formatted.replace(/\./g, "").replace(/,/g, "");
}

/** Sebuah wilayah terpilih → 4 kolom lokasi terstruktur (isi level terpilih + induknya). */
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

/** Kolom lokasi tersimpan → satu wilayah (level terdalam yang terisi) untuk hidrasi picker saat edit. */
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
 * Expand satu kartu form → banyak payload preferensi (satu per kombinasi tipe × lokasi).
 * Tanpa lokasi → satu baris per tipe (lokasi null = berlaku semua wilayah).
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
  /* Tanpa tipe → SATU baris per lokasi dengan tipe null ("semua tipe").
     Sebelumnya loop ini menghasilkan NOL baris saat tipe kosong, dan itulah
     sebabnya tipe jadi wajib secara struktural: preferensi tersimpan tanpa
     satu pun baris adalah preferensi yang tidak pernah mencocokkan apa pun. */
  const tipes: (string | null)[] = p.tipe_properti.length ? p.tipe_properti : [null];
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

/**
 * Grup baris preferensi tersimpan → kartu form. Baris dengan kriteria bersama
 * yang sama (jenis transaksi, budget, luas, tujuan, catatan) digabung jadi satu
 * kartu dengan banyak tipe & banyak lokasi.
 */
function groupPreferensi(rows: PreferensiKlien[]): PreferensiForm[] {
  const map = new Map<string, PreferensiForm>();
  for (const p of rows) {
    const sig = JSON.stringify([
      p.jenis_transaksi || "",
      p.budget_min ?? "", p.budget_max ?? "",
      p.luas_min ?? "", p.luas_max ?? "",
      /* legalitas WAJIB ikut sidik grup. Tanpanya, "Rumah SHM" dan "Rumah HGB"
         dianggap satu kartu, dan sertifikat salah satunya hilang begitu
         formulir disimpan ulang. */
      p.legalitas || "",
      /* Ikut sidik grup, alasan yang sama dengan legalitas: "Rumah dekat UNESA"
         dan "Rumah dekat Tunjungan Plaza" adalah dua kriteria berbeda. */
      p.dekat_nilai || "", p.dekat_radius ?? "", p.alamat_teks || "",
      p.tujuan_beli || "", p.catatan || "",
    ]);
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

/** Nomor WA → tampil per 4 digit dengan tanda "-" (mis. 8812-3456-7890) */
function formatPhone(digits: string) {
  const d = digits.replace(/\D/g, "");
  return d.match(/.{1,4}/g)?.join("-") ?? "";
}

export default function KlienFormModal({ open, onClose, onSaved, initialData, editTarget }: Props) {
  const [form, setForm]     = useState<KlienForm>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState<string | null>(null);
  const [shown, setShown]   = useState(false);
  const scrollRef           = useRef<HTMLDivElement>(null);
  const prefRefs            = useRef<Record<number, HTMLDivElement | null>>({});

  const isEdit = Boolean(editTarget);

  useEffect(() => {
    if (open) {
      const t = requestAnimationFrame(() => setShown(true));
      if (editTarget) {
        setForm({
          nama:             editTarget.nama,
          nomor_whatsapp:   editTarget.nomor_whatsapp?.replace(/^62/, "") || "",
          email:            editTarget.email || "",
          sumber:           editTarget.sumber,
          status:           editTarget.status,
          metode_pembayaran: editTarget.metode_pembayaran || "",
          bank_kpr:         editTarget.bank_kpr || "",
          tenor_kpr:        editTarget.tenor_kpr?.toString() || "",
          catatan:          editTarget.catatan || "",
          tanggal_follow_up: editTarget.tanggal_follow_up
            ? editTarget.tanggal_follow_up.slice(0, 16) : "",
          preferensi:       groupPreferensi(editTarget.preferensi),
        });
      } else {
        setForm({ ...INITIAL_FORM, ...initialData, preferensi: [] });
      }
      setErr(null);
      return () => cancelAnimationFrame(t);
    } else {
      setShown(false);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = original; };
  }, [open]);

  function handleClose() {
    setShown(false);
    setTimeout(onClose, 220);
  }

  function setField<K extends keyof KlienForm>(key: K, val: KlienForm[K]) {
    setForm(f => ({ ...f, [key]: val }));
  }

  function addPreferensi() {
    const newIdx = form.preferensi.length;
    setForm(f => ({ ...f, preferensi: [...f.preferensi, { ...EMPTY_PREFERENSI }] }));
    // Scroll ke top kartu baru — bukan absolute bottom (yang menampilkan tombol, bukan kartu)
    setTimeout(() => prefRefs.current[newIdx]?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  function removePreferensi(i: number) {
    setForm(f => ({ ...f, preferensi: f.preferensi.filter((_, idx) => idx !== i) }));
  }

  function setPrefField<K extends keyof PreferensiForm>(i: number, key: K, val: PreferensiForm[K]) {
    setForm(f => {
      const prefs = [...f.preferensi];
      prefs[i] = { ...prefs[i], [key]: val };
      return { ...f, preferensi: prefs };
    });
  }

  function buildPhone() {
    const d = form.nomor_whatsapp.replace(/\D/g, "").replace(/^0+/, "");
    return d ? `62${d}` : "";
  }

  async function handleSave() {
    if (!form.nama.trim()) { setErr("Nama klien wajib diisi"); return; }
    setSaving(true); setErr(null);
    try {
      const payload: any = {
        nama:             form.nama.trim(),
        nomor_whatsapp:   buildPhone() || null,
        email:            form.email.trim() || null,
        sumber:           form.sumber,
        status:           form.status,
        catatan:          form.catatan.trim() || null,
        metode_pembayaran: form.metode_pembayaran || null,
        bank_kpr:         form.bank_kpr.trim() || null,
        tenor_kpr:        form.tenor_kpr ? Number(form.tenor_kpr) : null,
        tanggal_follow_up: form.tanggal_follow_up || null,
        id_lead_asal:     form.id_lead_asal || undefined,
        id_properti_asal: form.id_properti_asal || undefined,
        preferensi: form.preferensi
          .filter(p => p.tipe_properti.length > 0)
          .flatMap(buildPrefPayloads),
      };

      const url    = isEdit ? `/api/dashboard/klien/${editTarget!.id_klien}` : "/api/dashboard/klien";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || `HTTP ${res.status}`);
      }
      const { data } = await res.json();

      // Untuk edit, preferensi sudah dihandle di-update. Untuk create, sudah include dalam POST.
      // Kalau edit: sync preferensi secara individual (hapus lama, tambah baru)
      if (isEdit) {
        const old = editTarget!.preferensi;
        // hapus semua preferensi lama
        await Promise.all(old.map(p =>
          fetch(`/api/dashboard/klien/${editTarget!.id_klien}/preferensi/${p.id_preferensi}`, { method: "DELETE" })
        ));
        // tambah preferensi baru (expand tiap kartu → baris per tipe × lokasi)
        const newRows = form.preferensi
          .filter(p => p.tipe_properti.length > 0)
          .flatMap(buildPrefPayloads);
        await Promise.all(
          newRows.map(payload =>
            fetch(`/api/dashboard/klien/${editTarget!.id_klien}/preferensi`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          )
        );
        // fetch ulang data terbaru
        const fresh = await fetch(`/api/dashboard/klien/${editTarget!.id_klien}`).then(r => r.json());
        onSaved(fresh.data);
      } else {
        onSaved(data);
      }

      handleClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const phoneDigits = form.nomor_whatsapp.replace(/\D/g, "").replace(/^0+/, "");

  return (
    <div
      className={`fixed inset-0 z-[70] flex items-end justify-center bg-black/70 backdrop-blur-xl transition-opacity duration-200 sm:items-center ${shown ? "opacity-100" : "opacity-0"}`}
      onClick={handleClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`relative flex max-h-[96vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] border-t border-white/[0.1] bg-gradient-to-b from-[#1a1a1d] via-[#121214] to-[#08080a] shadow-[0_-30px_80px_rgba(0,0,0,0.7)] sm:max-h-[90vh] sm:rounded-[28px] sm:border transition-transform duration-280 ${shown ? "translate-y-0" : "translate-y-10"}`}
      >
        {/* Top accent */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-emerald-500 via-emerald-400 to-transparent" />

        {/* Drag handle mobile */}
        <div className="absolute left-1/2 top-2.5 z-20 h-1 w-12 -translate-x-1/2 rounded-full bg-white/20 sm:hidden" />

        {/* Close button */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 z-20 grid h-9 w-9 place-items-center rounded-full border border-white/[0.1] bg-white/[0.06] text-slate-200 transition-all hover:bg-white/[0.12]"
        >
          <Icon icon="solar:close-circle-bold" className="text-lg" />
        </button>

        {/* Header */}
        <header className="shrink-0 border-b border-white/[0.06] px-5 pb-4 pt-9 sm:pt-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl border border-emerald-400/30 bg-emerald-500/10">
              <Icon icon="solar:user-plus-bold-duotone" className="text-xl text-emerald-300" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-white">
                {isEdit ? "Edit Klien" : "Tambah Klien Baru"}
              </h2>
              <p className="text-[11px] text-slate-400">
                {isEdit ? "Perbarui data klien" : "Isi data kontak & preferensi properti"}
              </p>
            </div>
          </div>
        </header>

        {/* Body — scrollable */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

          {/* ── BAGIAN 1: DATA KONTAK ── */}
          <Section icon="solar:phone-calling-bold-duotone" title="Data Kontak">
            <Field label="Nama Klien" required>
              <input
                type="text"
                value={form.nama}
                onChange={e => setField("nama", e.target.value)}
                placeholder="Mis. Budi Santoso"
                className={inputCls}
              />
            </Field>

            <Field label="Nomor WhatsApp">
              <div className="flex items-stretch overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] focus-within:border-emerald-400/50">
                <div className="flex shrink-0 items-center gap-2 border-r border-white/[0.08] bg-white/[0.04] px-3.5">
                  <span className="text-lg">🇮🇩</span>
                  <span className="text-sm font-bold text-slate-100">+62</span>
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={formatPhone(form.nomor_whatsapp)}
                  onChange={e => setField("nomor_whatsapp", e.target.value.replace(/\D/g, "").replace(/^0+/, ""))}
                  placeholder="8812-3456-7890"
                  className="flex-1 bg-transparent px-3.5 py-2.5 text-sm text-white placeholder-slate-600 outline-none"
                />
              </div>
              <p className="mt-1 text-[10px] text-slate-500">Tanpa angka 0 di depan</p>
            </Field>

            <Field label="Email (opsional)">
              <input
                type="email"
                value={form.email}
                onChange={e => setField("email", e.target.value)}
                placeholder="budi@email.com"
                className={inputCls}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Sumber Lead">
                <PremiumSelect
                  value={form.sumber}
                  onChange={v => setField("sumber", v as SumberKlien)}
                  options={SUMBER_OPTIONS}
                />
              </Field>

              <Field label="Status">
                <PremiumSelect
                  value={form.status}
                  onChange={v => setField("status", v as KlienStatus)}
                  options={STATUS_OPTIONS}
                />
              </Field>
            </div>
          </Section>

          {/* ── BAGIAN 2: PEMBAYARAN ── */}
          <Section icon="solar:card-bold-duotone" title="Pembayaran">
            <Field label="Metode Pembayaran">
              <PremiumSelect
                value={form.metode_pembayaran}
                onChange={v => setField("metode_pembayaran", v as MetodePembayaran | "")}
                options={METODE_OPTIONS}
              />
            </Field>

            {form.metode_pembayaran === "kpr" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Bank KPR">
                  <input
                    type="text"
                    value={form.bank_kpr}
                    onChange={e => setField("bank_kpr", e.target.value)}
                    placeholder="BRI, BCA, Mandiri..."
                    className={inputCls}
                  />
                </Field>
                <Field label="Tenor (tahun)">
                  <input
                    type="number"
                    min={1} max={30}
                    value={form.tenor_kpr}
                    onChange={e => setField("tenor_kpr", e.target.value)}
                    placeholder="15"
                    className={inputCls}
                  />
                </Field>
              </div>
            )}
          </Section>

          {/* ── BAGIAN 3: PREFERENSI PROPERTI ── */}
          <Section icon="solar:home-bold-duotone" title="Preferensi Properti">
            {form.preferensi.length === 0 && (
              <p className="text-[12px] text-slate-500 text-center py-2">
                Belum ada preferensi. Klik tombol di bawah untuk tambah.
              </p>
            )}

            {form.preferensi.map((pref, i) => (
              <div key={i} ref={el => { prefRefs.current[i] = el; }}>
                <PreferensiCard
                  index={i}
                  pref={pref}
                  onChange={(key, val) => setPrefField(i, key, val)}
                  onRemove={() => removePreferensi(i)}
                />
              </div>
            ))}

            <button
              type="button"
              onClick={addPreferensi}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-400/30 py-3 text-[12px] font-semibold text-emerald-400 transition-colors hover:border-emerald-400/60 hover:text-emerald-300"
            >
              <Icon icon="solar:add-circle-bold-duotone" className="text-base" />
              Tambah Preferensi
            </button>
          </Section>

          {/* ── BAGIAN 4: CATATAN & FOLLOW UP ── */}
          <Section icon="solar:clipboard-text-bold-duotone" title="Catatan & Follow Up">
            <Field label="Jadwal Follow Up">
              <PremiumDateTimePicker
                value={form.tanggal_follow_up}
                onChange={v => setField("tanggal_follow_up", v)}
              />
            </Field>

            <Field label="Catatan">
              <textarea
                value={form.catatan}
                onChange={e => setField("catatan", e.target.value)}
                placeholder="Tulis catatan tentang klien ini..."
                rows={3}
                className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-emerald-400/50 focus:bg-white/[0.05]"
              />
            </Field>
          </Section>

          {err && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-xs text-rose-200">
              <Icon icon="solar:danger-triangle-bold-duotone" className="mt-0.5 shrink-0 text-base" />
              <span>{err}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="shrink-0 border-t border-white/[0.06] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {phoneDigits.length >= 8 && (
            <a
              href={`https://wa.me/62${phoneDigits}`}
              target="_blank" rel="noopener noreferrer"
              className="mb-2 group flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 py-2.5 text-sm font-bold text-emerald-100 transition-all hover:bg-emerald-500/20"
            >
              <Icon icon="ic:baseline-whatsapp" className="text-base" />
              Buka WhatsApp
            </a>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-xl border border-white/[0.08] py-3 text-sm font-semibold text-slate-300 hover:bg-white/[0.06] transition-all"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-[2] overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 py-3 text-sm font-extrabold text-white transition-all hover:from-emerald-400 hover:to-emerald-300 disabled:opacity-70"
            >
              {saving ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Icon icon="solar:refresh-circle-bold-duotone" className="animate-spin text-base" />
                  Menyimpan…
                </span>
              ) : (
                <span className="inline-flex items-center justify-center gap-2">
                  <Icon icon="solar:check-circle-bold-duotone" className="text-base" />
                  {isEdit ? "Simpan Perubahan" : "Tambah Klien"}
                </span>
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ── PREFERENSI CARD ── */
function PreferensiCard({
  index, pref, onChange, onRemove,
}: {
  index: number;
  pref: PreferensiForm;
  onChange: <K extends keyof PreferensiForm>(key: K, val: PreferensiForm[K]) => void;
  onRemove: () => void;
}) {
  const [openPicker, setOpenPicker] = useState<"type" | "transaksi" | "location" | null>(null);
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
          Preferensi #{index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="grid h-7 w-7 place-items-center rounded-lg border border-rose-400/20 bg-rose-500/10 text-rose-300 transition-colors hover:bg-rose-500/20"
        >
          <Icon icon="solar:trash-bin-2-bold-duotone" className="text-sm" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipe Properti" required>
          <div className="h-[42px] rounded-xl border border-white/[0.08] bg-white/[0.03] px-1 transition-all hover:border-white/20">
            <TypePicker
              theme="dark"
              label=""
              value={pref.tipe_properti.map(k => TIPE_PROPERTI_LABEL[k])}
              options={TIPE_LABELS}
              icons={TIPE_ICONS}
              open={openPicker === "type"}
              onOpenChange={v => setOpenPicker(v ? "type" : null)}
              onChange={labels => onChange(
                "tipe_properti",
                labels.map(l => LABEL_TO_TIPE[l]).filter(Boolean)
              )}
            />
          </div>
        </Field>

        <Field label="Jenis Transaksi">
          <PremiumSelect
            value={pref.jenis_transaksi}
            onChange={v => onChange("jenis_transaksi", v as JenisTransaksi)}
            placeholder="-- Semua --"
            open={openPicker === "transaksi"}
            onOpenChange={v => setOpenPicker(v ? "transaksi" : null)}
            options={[
              { value: "", label: "-- Semua --" },
              ...(Object.entries(JENIS_TRANSAKSI_LABEL) as [JenisTransaksi, string][]).map(([k, v]) => ({ value: k, label: v })),
            ]}
          />
        </Field>
      </div>

      <Field label="Lokasi yang Diinginkan">
        <div className="h-[42px] rounded-xl border border-white/[0.08] bg-white/[0.03] px-1 transition-all hover:border-white/20">
          <LocationPicker
            theme="dark"
            label=""
            value={pref.locations}
            onChange={next => onChange("locations", next)}
            open={openPicker === "location"}
            onOpenChange={v => setOpenPicker(v ? "location" : null)}
          />
        </div>
        {pref.locations.length === 0 && (
          <p className="mt-1 text-[10px] text-slate-500">Kosongkan untuk semua wilayah.</p>
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Budget Min (Rp)">
          <input
            type="text"
            inputMode="numeric"
            value={pref.budget_min}
            onChange={e => onChange("budget_min", formatRupiah(e.target.value))}
            placeholder="500.000.000"
            className={inputCls}
          />
        </Field>
        <Field label="Budget Max (Rp)">
          <input
            type="text"
            inputMode="numeric"
            value={pref.budget_max}
            onChange={e => onChange("budget_max", formatRupiah(e.target.value))}
            placeholder="1.000.000.000"
            className={inputCls}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Label MENYEBUT dimensinya. "Luas Min" saja adalah sumber bug yang
            baru diperbaiki: agent mengetik 500 untuk gudang bermaksud luas
            tanah, sementara mesin dulu menerima luas bangunan juga. */}
        <Field label={`${labelLuas(pref.tipe_properti)} min (m²)`}>
          <input
            type="text"
            inputMode="numeric"
            value={pref.luas_min}
            onChange={e => onChange("luas_min", formatRupiah(e.target.value))}
            placeholder="1.000"
            className={inputCls}
          />
        </Field>
        <Field label={`${labelLuas(pref.tipe_properti)} max (m²)`}>
          <input
            type="text"
            inputMode="numeric"
            value={pref.luas_max}
            onChange={e => onChange("luas_max", formatRupiah(e.target.value))}
            placeholder="5.000"
            className={inputCls}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Tujuan Beli">
          <PremiumSelect
            value={pref.tujuan_beli}
            onChange={v => onChange("tujuan_beli", v as TujuanBeli)}
            placeholder="-- Belum tahu --"
            options={TUJUAN_OPTIONS}
          />
        </Field>
        <Field label="Catatan Preferensi">
          <input
            type="text"
            value={pref.catatan}
            onChange={e => onChange("catatan", e.target.value)}
            placeholder="Hal lain yang diinginkan..."
            className={inputCls}
          />
        </Field>
      </div>
    </div>
  );
}

/* ── SMALL HELPERS ── */
function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon icon={icon} className="text-[14px] text-slate-400" />
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-300">{title}</span>
        <div className="h-px flex-1 bg-gradient-to-r from-white/[0.08] to-transparent" />
      </div>
      {children}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-semibold text-slate-200">
        {label}{required && <span className="ml-1 text-rose-400">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls  = "w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-emerald-400/50 focus:bg-white/[0.05]";
