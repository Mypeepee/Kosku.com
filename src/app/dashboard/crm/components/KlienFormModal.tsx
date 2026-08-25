"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import {
  Klien, KlienForm, KlienStatus, MetodePembayaran, PreferensiForm, SumberKlien,
  EMPTY_PREFERENSI,
} from "./types";
import { PremiumSelect, PremiumDateTimePicker, type PremiumOption } from "./CrmFormControls";
import {
  KartuPreferensi, masalahPreferensi, buildPrefPayloads, groupPreferensi,
} from "./FormPreferensi";

/* Diteruskan, bukan didefinisikan ulang. Berkas ini sempat memiliki
   salinannya sendiri, dan pemanggil lama (CrmPageClient) mengimpor dari sini —
   jalur impornya dipertahankan supaya perpindahan ke modul bersama tidak
   menyebar jadi perubahan di lima berkas sekaligus. */
export {
  formatRupiah, unformatRupiah, regionToLocFields, locFieldsToRegion,
  buildPrefPayloads, groupPreferensi, sidikKriteria,
  TIPE_ICONS, TIPE_LABELS, TUJUAN_OPTIONS,
} from "./FormPreferensi";

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
  /* Menyala hanya SESUDAH agent menekan simpan. Memerahkan kartu yang belum
     sempat diisi adalah teguran untuk sesuatu yang belum dilakukan siapa pun —
     dan formulir yang menegur sejak dibuka mengajari mata untuk mengabaikan
     warna merahnya. */
  const [periksa, setPeriksa] = useState(false);
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
      setPeriksa(false);
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

  /** Kartu pertama yang belum sah, beserta alasannya. */
  function kartuBermasalah(): { i: number; pesan: string } | null {
    for (let i = 0; i < form.preferensi.length; i++) {
      const m = masalahPreferensi(form.preferensi[i]);
      if (m) return { i, pesan: `Preferensi #${i + 1}: ${m.toLowerCase()}` };
    }
    return null;
  }

  async function handleSave() {
    if (!form.nama.trim()) { setErr("Nama klien wajib diisi"); return; }

    /* ── DIPERIKSA SEBELUM APA PUN DIKIRIM ─────────────────────────────────
       Dulu kartu tanpa tipe DIBUANG diam-diam oleh `filter(...)`, dan kartu
       tanpa lokasi dikirim lalu ditolak server tanpa ada yang membaca
       jawabannya. Keduanya berakhir sama: kriteria yang agent yakin sudah ia
       isi tidak pernah tersimpan, tanpa satu pun tanda di layar.

       Sekarang formulir tidak berangkat sampai seluruh kartunya sah, dan yang
       bermasalah digulirkan ke tengah layar supaya tidak perlu dicari. */
    setPeriksa(true);
    const buruk = kartuBermasalah();
    if (buruk) {
      setErr(buruk.pesan);
      prefRefs.current[buruk.i]?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSaving(true); setErr(null);
    try {
      const barisPref = form.preferensi.flatMap(buildPrefPayloads);

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
        preferensi:       barisPref,
      };

      const url    = isEdit ? `/api/dashboard/klien/${editTarget!.id_klien}` : "/api/dashboard/klien";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({} as any));
      if (!res.ok || !j?.ok) throw new Error(j?.message || `Gagal menyimpan (HTTP ${res.status})`);

      if (!isEdit) { onSaved(j.data); handleClose(); return; }

      /* ── PREFERENSI DITULIS ULANG DALAM SATU TRANSAKSI ─────────────────
         PATCH klien sengaja tidak menyentuh preferensi (kolom kontak dan
         kriteria punya siklus hidup yang berbeda), jadi kriteria dikirim
         terpisah — tapi sebagai SATU permintaan, bukan rentetan DELETE lalu
         POST seperti sebelumnya.

         Rentetan itu punya dua akhir buruk yang sama-sama senyap: gagal di
         tengah membuat kriteria klien lenyap sebagian, dan DELETE yang gagal
         sementara POST berhasil meninggalkan baris lama sebagai hantu —
         layar menampilkan wilayah yang baru sementara pencarian aset masih
         memakai yang lama. */
      const resPref = await fetch(`/api/dashboard/klien/${editTarget!.id_klien}/preferensi`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferensi: barisPref }),
      });
      const jPref = await resPref.json().catch(() => ({} as any));
      if (!resPref.ok || !jPref?.ok) {
        throw new Error(jPref?.message || "Data kontak tersimpan, tapi preferensi gagal disimpan.");
      }

      /* Klien dari PATCH + preferensi dari PUT. Tidak perlu satu GET lagi:
         keduanya sudah mengembalikan bentuk yang sama dengan yang dibaca
         daftar, dan permintaan ketiga cuma menambah satu kesempatan gagal. */
      onSaved({ ...j.data, preferensi: jPref.data });
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
            {/* Keadaan kosong yang MENJELASKAN, bukan sekadar melaporkan.
                Preferensi bukan kolom pelengkap: ia satu-satunya bahan bakar
                pencarian aset, email pengingat, dan tugas otomatis. Klien tanpa
                kriteria tidak akan pernah muncul di mana pun, dan kalimat
                "belum ada preferensi" tidak memberi tahu siapa pun soal itu. */}
            {form.preferensi.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.02] px-4 py-4 text-center">
                <p className="text-[12.5px] font-bold text-slate-200">Belum ada kriteria</p>
                <p className="mx-auto mt-1 max-w-[17rem] text-[11.5px] leading-relaxed text-slate-500">
                  Isi lokasi yang dicari — asisten langsung mencarikan asetnya dan
                  mengabari Anda saat ada yang baru masuk. Boleh ditambahkan nanti.
                </p>
              </div>
            )}

            {form.preferensi.map((pref, i) => (
              <div key={i} ref={el => { prefRefs.current[i] = el; }}>
                <KartuPreferensi
                  index={i}
                  form={pref}
                  onUbah={(key, val) => setPrefField(i, key, val)}
                  onHapus={() => removePreferensi(i)}
                  sorotMasalah={periksa}
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
