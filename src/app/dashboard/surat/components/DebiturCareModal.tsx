"use client";

/**
 * Modal "Debitur Care" — Surat Kuasa + Perjanjian Jasa Hukum dalam satu PDF.
 *
 * ALUR SENGAJA HANYA TIGA LANGKAH. Yang benar-benar diketik manusia cuma empat
 * hal: foto KTP, alamat sampai provinsi, jenis sertifikat, nomor sertifikat.
 * Sisanya datang dari hasil pembacaan KTP dan boleh dikoreksi di tempat —
 * bukan disembunyikan, karena yang menandatangani surat ini bertanggung jawab
 * atas isinya dan harus bisa melihat semuanya sebelum menekan generate.
 *
 * NOMOR SURAT TIDAK ADA DI FORM. Ia dipesan server saat generate (lihat
 * `/api/surat/generate-debitur-care`). Yang ditampilkan di langkah review
 * hanyalah PRATINJAU polanya — urutannya sengaja ditulis "NNN" supaya tidak
 * ada yang mengira angka itu sudah miliknya sebelum suratnya benar-benar jadi.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import { X } from "lucide-react";
import type { SuratTemplate } from "./data";

// ── Tipe ──────────────────────────────────────────────────────────────────────

type Props = { open: boolean; template: SuratTemplate | null; onClose: () => void };
type StatusScan = "idle" | "scanning" | "valid" | "review" | "invalid";

type Debitur = {
  nama: string; nik: string; tempat_lahir: string; tanggal_lahir: string;
  tempat_tanggal_lahir: string; jenis_kelamin: string; gol_darah: string;
  agama: string; status_kawin: string; pekerjaan: string; warga_negara: string;
};

type Alamat = {
  alamat: string; rt_rw: string; kelurahan: string; kecamatan: string;
  kota: string; jenis_kota: string; provinsi: string; alamat_lengkap: string;
};

type Sertifikat = { jenis_sertifikat: string; nomor_sertifikat: string };

type BalasanOcr = {
  data?: Partial<Debitur & Alamat>;
  sumber?: string;
  skor?: number;
  status?: string;
  peringatan?: string[];
  catatan_silang?: string[];
  detail?: string;
};

// ── Nilai awal ────────────────────────────────────────────────────────────────

const DEBITUR_KOSONG: Debitur = {
  nama: "", nik: "", tempat_lahir: "", tanggal_lahir: "", tempat_tanggal_lahir: "",
  jenis_kelamin: "", gol_darah: "", agama: "", status_kawin: "", pekerjaan: "",
  warga_negara: "Indonesia",
};

const ALAMAT_KOSONG: Alamat = {
  alamat: "", rt_rw: "", kelurahan: "", kecamatan: "",
  kota: "", jenis_kota: "Kota", provinsi: "", alamat_lengkap: "",
};

const SERTIFIKAT_KOSONG: Sertifikat = { jenis_sertifikat: "", nomor_sertifikat: "" };

const JENIS_SERTIFIKAT = [
  "Sertifikat Hak Milik (SHM)",
  "Sertifikat Hak Guna Bangunan (SHGB)",
  "Sertifikat Hak Guna Usaha (SHGU)",
  "Sertifikat Hak Pakai (SHP)",
  "Sertifikat Hak Milik Satuan Rumah Susun (SHMSRS)",
  "Petok D / Letter C",
];

const BULAN_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const ROMAWI = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

// ── Util ──────────────────────────────────────────────────────────────────────

function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

function isoHariIni() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function tampilTanggal(iso: string) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${Number(m[3])} ${BULAN_ID[Number(m[2]) - 1]} ${m[1]}` : iso || "—";
}

/**
 * Cerminan `inisialNama` di `src/lib/suratNomor.ts`, dipakai HANYA untuk
 * pratinjau. Server tetap yang menghitung nomor sungguhan — kalau keduanya
 * kelak berbeda, yang salah adalah pratinjaunya, bukan suratnya.
 */
const BUKAN_NAMA = new Set([
  "H", "HJ", "HAJI", "HJI", "DRS", "DRA", "IR", "DR", "PROF", "KH",
  "SH", "SE", "ST", "SPD", "SKOM", "SSOS", "SPSI", "MM", "MH", "MKN", "MSI",
  "BIN", "BINTI", "BT", "BTE", "ALM", "ALMH", "VAN", "DER",
]);

function inisialNama(nama: string): string {
  const kata = (nama ?? "").split(",")[0].toUpperCase().replace(/[^A-Z\s]/g, " ")
    .split(/\s+/).filter((k) => k.length > 0 && !BUKAN_NAMA.has(k));
  if (kata.length === 0) return "XX";
  if (kata.length === 1) return kata[0].slice(0, 3);
  return kata.slice(0, 4).map((k) => k[0]).join("");
}

/** Susunan yang diminta: alamat, Kel. X, Kec. Y, Kota/Kab Z, Provinsi. */
function susunAlamatLengkap(a: Alamat): string {
  const bagian: string[] = [];
  if (a.alamat.trim()) bagian.push(a.alamat.trim());
  if (a.kelurahan.trim()) bagian.push(`Kel. ${a.kelurahan.trim()}`);
  if (a.kecamatan.trim()) bagian.push(`Kec. ${a.kecamatan.trim()}`);
  if (a.kota.trim()) bagian.push(`${a.jenis_kota || "Kota"} ${a.kota.trim()}`);
  if (a.provinsi.trim()) {
    const prov = a.provinsi.trim();
    bagian.push(/^provinsi\b/i.test(prov) ? prov : `Provinsi ${prov}`);
  }
  return bagian.join(", ");
}

// ── Primitif tampilan ─────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
      {children}
    </span>
  );
}

function Isian({
  value, onChange, placeholder, readOnly, mono,
}: {
  value: string; onChange?: (v: string) => void;
  placeholder?: string; readOnly?: boolean; mono?: boolean;
}) {
  return (
    <input
      type="text" value={value} readOnly={readOnly} placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
      className={cx(
        "w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2.5",
        "text-[13px] text-white outline-none transition-all placeholder:text-zinc-600",
        mono && "font-mono tracking-wide",
        readOnly
          ? "cursor-default text-zinc-400"
          : "focus:border-cyan-400/40 focus:bg-white/[0.05] focus:ring-2 focus:ring-cyan-500/10",
      )}
    />
  );
}

function AreaIsian({
  value, onChange, placeholder, rows = 3,
}: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      rows={rows} value={value} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full resize-none rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2.5 text-[13px] leading-relaxed text-white outline-none transition-all placeholder:text-zinc-600 focus:border-cyan-400/40 focus:bg-white/[0.05] focus:ring-2 focus:ring-cyan-500/10"
    />
  );
}

function F({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <Label>{label}</Label>
      {children}
      {hint && <span className="mt-1 block text-[10.5px] text-zinc-600">{hint}</span>}
    </label>
  );
}

// ── Panel mengambang berjangkar ───────────────────────────────────────────────

/**
 * Posisi panel dihitung dari kotak pemicunya lalu dipasang `position: fixed`
 * di dalam portal.
 *
 * KENAPA TIDAK `absolute` SAJA. Badan modal ini `overflow-y-auto`; panel
 * absolut yang lebih tinggi dari sisa ruang akan TERPOTONG oleh kotak scroll
 * itu, dan yang terpotong justru pilihan paling bawah. Portal + fixed membuat
 * panel hidup di luar kotak scroll, jadi ia tidak bisa dipotong siapa pun.
 *
 * Panel dibalik ke ATAS pemicu kalau ruang di bawah tidak cukup — di layar
 * ponsel, field yang dekat tombol "Lanjut" hampir selalu begitu.
 */
function usePosisiPanel(terbuka: boolean, pemicu: React.RefObject<HTMLElement | null>, tinggiPanel: number) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number; keAtas: boolean } | null>(null);

  useLayoutEffect(() => {
    if (!terbuka) { setPos(null); return; }
    const hitung = () => {
      const el = pemicu.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const ruangBawah = window.innerHeight - r.bottom;
      const keAtas = ruangBawah < tinggiPanel + 16 && r.top > ruangBawah;
      setPos({
        top: keAtas ? r.top - 6 : r.bottom + 6,
        left: Math.min(r.left, window.innerWidth - r.width - 8),
        width: r.width,
        keAtas,
      });
    };
    hitung();
    window.addEventListener("resize", hitung);
    // Scroll apa pun (termasuk badan modal) menggeser pemicunya; menutup panel
    // lebih jujur daripada membiarkannya menggantung di tempat yang salah.
    window.addEventListener("scroll", hitung, true);
    return () => {
      window.removeEventListener("resize", hitung);
      window.removeEventListener("scroll", hitung, true);
    };
  }, [terbuka, pemicu, tinggiPanel]);

  return pos;
}

function PanelMengambang({
  pos, tinggi, onTutup, children,
}: {
  pos: { top: number; left: number; width: number; keAtas: boolean } | null;
  tinggi: number;
  onTutup: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onTutup(); } };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onTutup]);

  if (!pos) return null;
  return createPortal(
    <>
      <div className="fixed inset-0 z-[10000]" onClick={onTutup} />
      <div
        className="dc-pop fixed z-[10001] overflow-hidden rounded-2xl border border-cyan-400/25 bg-[#0b0b12] shadow-[0_24px_70px_rgba(0,0,0,0.85)]"
        style={{
          top: pos.keAtas ? undefined : pos.top,
          bottom: pos.keAtas ? window.innerHeight - pos.top : undefined,
          left: pos.left,
          width: pos.width,
          maxHeight: tinggi,
        }}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}

// ── Dropdown ──────────────────────────────────────────────────────────────────

/**
 * Pengganti `<select>` dan `<datalist>` bawaan browser. Keduanya digambar oleh
 * sistem operasi, jadi tampilannya tidak pernah bisa mengikuti tema gelap modal
 * ini — dan tampak seperti tambalan dari aplikasi lain.
 *
 * `bebas` menjadikannya combobox: daftar pilihan tetap ada, tetapi nilai di
 * luar daftar boleh diketik. Jenis sertifikat butuh itu — daftarnya menutup
 * kasus umum, tidak semua kasus.
 */
function Pilihan({
  value, onChange, opsi, placeholder = "Pilih…", bebas, ikon,
}: {
  value: string;
  onChange: (v: string) => void;
  opsi: string[];
  placeholder?: string;
  bebas?: boolean;
  ikon?: string;
}) {
  const [buka, setBuka] = useState(false);
  const [ketik, setKetik] = useState("");
  const pemicu = useRef<HTMLButtonElement | null>(null);
  const TINGGI = 300;
  const pos = usePosisiPanel(buka, pemicu, TINGGI);

  useEffect(() => { if (!buka) setKetik(""); }, [buka]);

  const saring = ketik.trim().toLowerCase();
  const terlihat = saring ? opsi.filter((o) => o.toLowerCase().includes(saring)) : opsi;
  const persisAda = opsi.some((o) => o.toLowerCase() === saring);

  const pilih = (v: string) => { onChange(v); setBuka(false); };

  return (
    <>
      <button
        ref={pemicu} type="button" onClick={() => setBuka((b) => !b)}
        className={cx(
          "flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-[13px] transition-all",
          buka
            ? "border-cyan-400/40 bg-cyan-500/[0.06] ring-2 ring-cyan-500/10"
            : "border-white/[0.07] bg-white/[0.03] hover:border-white/[0.14]",
        )}
      >
        {ikon && <Icon icon={ikon} className={cx("shrink-0 text-base", value ? "text-cyan-300" : "text-zinc-500")} />}
        <span className={cx("flex-1 truncate text-left", value ? "font-semibold text-white" : "text-zinc-600")}>
          {value || placeholder}
        </span>
        <Icon
          icon="solar:alt-arrow-down-bold"
          className={cx("shrink-0 text-xs text-zinc-500 transition-transform duration-200", buka && "rotate-180")}
        />
      </button>

      {buka && (
        <PanelMengambang pos={pos} tinggi={TINGGI} onTutup={() => setBuka(false)}>
          {bebas && (
            <div className="border-b border-white/[0.06] p-2">
              <input
                autoFocus value={ketik} onChange={(e) => setKetik(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && ketik.trim()) { e.preventDefault(); pilih(ketik.trim()); }
                }}
                placeholder="Cari atau ketik sendiri…"
                className="w-full rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-2 text-[12.5px] text-white outline-none placeholder:text-zinc-600 focus:border-cyan-400/40"
              />
            </div>
          )}

          <div className="max-h-[220px] overflow-y-auto overscroll-contain p-1.5">
            {terlihat.map((o) => {
              const aktif = o === value;
              return (
                <button
                  key={o} type="button" onClick={() => pilih(o)}
                  className={cx(
                    "flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] transition-colors",
                    aktif ? "bg-cyan-500/15 font-semibold text-cyan-200" : "text-zinc-300 hover:bg-white/[0.06] hover:text-white",
                  )}
                >
                  <Icon
                    icon={aktif ? "solar:check-circle-bold" : "solar:record-linear"}
                    className={cx("mt-px shrink-0 text-[13px]", aktif ? "text-cyan-300" : "text-zinc-700")}
                  />
                  <span className="flex-1 leading-snug">{o}</span>
                </button>
              );
            })}

            {bebas && ketik.trim() && !persisAda && (
              <button
                type="button" onClick={() => pilih(ketik.trim())}
                className="mt-1 flex w-full items-center gap-2 rounded-lg border border-dashed border-cyan-400/30 px-2.5 py-2 text-left text-[12.5px] text-cyan-300 transition-colors hover:bg-cyan-500/10"
              >
                <Icon icon="solar:add-circle-bold" className="shrink-0 text-[13px]" />
                <span className="flex-1 truncate">Pakai &ldquo;{ketik.trim()}&rdquo;</span>
              </button>
            )}

            {!terlihat.length && !bebas && (
              <p className="px-2.5 py-3 text-center text-[11.5px] text-zinc-600">Tidak ada pilihan</p>
            )}
          </div>
        </PanelMengambang>
      )}
    </>
  );
}

// ── Pemilih tanggal ───────────────────────────────────────────────────────────

const HARI_PENDEK = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

function pad2(n: number) { return String(n).padStart(2, "0"); }

/**
 * `<input type="date">` juga digambar sistem operasi — masalah yang sama
 * dengan `<select>`, di form yang sama. Diganti sekalian supaya seluruh modal
 * ini konsisten satu tema.
 */
function PilihTanggal({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const [buka, setBuka] = useState(false);
  const pemicu = useRef<HTMLButtonElement | null>(null);
  const TINGGI = 330;
  const pos = usePosisiPanel(buka, pemicu, TINGGI);

  const pilihan = useMemo(() => {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? { y: +m[1], b: +m[2] - 1, t: +m[3] } : null;
  }, [value]);

  const kini = new Date();
  const [lihatY, setLihatY] = useState(pilihan?.y ?? kini.getFullYear());
  const [lihatB, setLihatB] = useState(pilihan?.b ?? kini.getMonth());

  useEffect(() => {
    if (buka && pilihan) { setLihatY(pilihan.y); setLihatB(pilihan.b); }
  }, [buka, pilihan]);

  // Kisi 6×7 selalu, supaya tinggi panel tidak melompat antar bulan.
  const awal = (() => {
    const pertama = new Date(lihatY, lihatB, 1);
    const geser = (pertama.getDay() + 6) % 7;              // Senin jadi kolom pertama
    return new Date(lihatY, lihatB, 1 - geser);
  })();
  const sel = Array.from({ length: 42 }, (_, i) =>
    new Date(awal.getFullYear(), awal.getMonth(), awal.getDate() + i));

  const samaDengan = (d: Date, p: { y: number; b: number; t: number } | null) =>
    !!p && d.getFullYear() === p.y && d.getMonth() === p.b && d.getDate() === p.t;
  const hariIni = (d: Date) =>
    d.getFullYear() === kini.getFullYear() && d.getMonth() === kini.getMonth() && d.getDate() === kini.getDate();

  const geserBulan = (n: number) => {
    const d = new Date(lihatY, lihatB + n, 1);
    setLihatY(d.getFullYear()); setLihatB(d.getMonth());
  };

  return (
    <>
      <button
        ref={pemicu} type="button" onClick={() => setBuka((b) => !b)}
        className={cx(
          "flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-[13px] transition-all",
          buka
            ? "border-cyan-400/40 bg-cyan-500/[0.06] ring-2 ring-cyan-500/10"
            : "border-white/[0.07] bg-white/[0.03] hover:border-white/[0.14]",
        )}
      >
        <Icon icon="solar:calendar-bold-duotone" className={cx("shrink-0 text-base", pilihan ? "text-cyan-300" : "text-zinc-500")} />
        <span className={cx("flex-1 text-left font-semibold", pilihan ? "text-white" : "text-zinc-600")}>
          {pilihan ? tampilTanggal(value) : "Pilih tanggal"}
        </span>
        <Icon icon="solar:alt-arrow-down-bold" className={cx("shrink-0 text-xs text-zinc-500 transition-transform duration-200", buka && "rotate-180")} />
      </button>

      {buka && (
        <PanelMengambang pos={pos} tinggi={TINGGI} onTutup={() => setBuka(false)}>
          <div className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <button type="button" onClick={() => geserBulan(-1)}
                className="grid h-7 w-7 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-white/[0.07] hover:text-white">
                <Icon icon="solar:alt-arrow-left-bold" className="text-sm" />
              </button>
              <span className="text-[12.5px] font-black text-white">{BULAN_ID[lihatB]} {lihatY}</span>
              <button type="button" onClick={() => geserBulan(1)}
                className="grid h-7 w-7 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-white/[0.07] hover:text-white">
                <Icon icon="solar:alt-arrow-right-bold" className="text-sm" />
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7 gap-0.5">
              {HARI_PENDEK.map((h) => (
                <span key={h} className="py-1 text-center text-[9.5px] font-bold uppercase tracking-wide text-zinc-600">{h}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {sel.map((d, i) => {
                const bulanIni = d.getMonth() === lihatB;
                const dipilih = samaDengan(d, pilihan);
                return (
                  <button
                    key={i} type="button"
                    onClick={() => {
                      onChange(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`);
                      setBuka(false);
                    }}
                    className={cx(
                      "grid h-8 place-items-center rounded-lg text-[12px] transition-colors",
                      dipilih ? "bg-cyan-500/25 font-black text-cyan-100 ring-1 ring-cyan-400/40"
                        : hariIni(d) ? "font-bold text-cyan-300 hover:bg-white/[0.07]"
                          : bulanIni ? "text-zinc-300 hover:bg-white/[0.07]"
                            : "text-zinc-700 hover:bg-white/[0.04]",
                    )}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => { onChange(isoHariIni()); setBuka(false); }}
              className="mt-2 w-full rounded-lg border border-white/[0.07] py-1.5 text-[11.5px] font-bold text-zinc-400 transition-colors hover:border-cyan-400/30 hover:text-cyan-300"
            >
              Hari ini
            </button>
          </div>
        </PanelMengambang>
      )}
    </>
  );
}

function Kartu({ icon, title, sub, children }: {
  icon: string; title: string; sub?: string; children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4">
      <div className="mb-3.5 flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-cyan-500/12 ring-1 ring-cyan-400/25">
          <Icon icon={icon} className="text-[15px] text-cyan-300" />
        </span>
        <div>
          <h3 className="text-[12.5px] font-black text-white">{title}</h3>
          {sub && <p className="text-[10.5px] text-zinc-500">{sub}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

// ── Lencana hasil scan ────────────────────────────────────────────────────────

function LencanaScan({ status, skor, sumber }: { status: StatusScan; skor: number; sumber: string }) {
  if (status === "idle" || status === "scanning") return null;
  const cfg = {
    valid: { cls: "bg-emerald-500/12 text-emerald-300 ring-emerald-400/30", icon: "solar:verified-check-bold", teks: "Terbaca lengkap" },
    review: { cls: "bg-amber-500/12 text-amber-300 ring-amber-400/30", icon: "solar:danger-triangle-bold", teks: "Perlu diperiksa" },
    invalid: { cls: "bg-rose-500/12 text-rose-300 ring-rose-400/30", icon: "solar:close-circle-bold", teks: "Gagal dibaca" },
  }[status];
  const namaSumber = sumber === "gabungan" ? "AI + OCR" : sumber === "gemini" ? "AI" : sumber === "vision" ? "OCR" : "—";
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ring-1", cfg.cls)}>
      <Icon icon={cfg.icon} className="text-xs" />
      {cfg.teks} · {skor}% · {namaSumber}
    </span>
  );
}

// ── Panel unggah KTP ──────────────────────────────────────────────────────────

function PanelKtp({
  imgUrl, memuat, status, skor, sumber, peringatan, catatan, onFile,
}: {
  imgUrl: string; memuat: boolean; status: StatusScan; skor: number; sumber: string;
  peringatan: string[]; catatan: string[]; onFile: (f: File) => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  const [seret, setSeret] = useState(false);

  return (
    <div className="space-y-3">
      <input
        ref={ref} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
      />

      {!imgUrl ? (
        <div
          role="button" tabIndex={0}
          onClick={() => ref.current?.click()}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") ref.current?.click(); }}
          onDragOver={(e) => { e.preventDefault(); setSeret(true); }}
          onDragLeave={() => setSeret(false)}
          onDrop={(e) => { e.preventDefault(); setSeret(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
          className={cx(
            "group relative cursor-pointer select-none overflow-hidden rounded-3xl border border-dashed transition-all duration-300",
            seret
              ? "border-cyan-400/90 bg-cyan-500/[0.07] shadow-[0_0_60px_rgba(6,182,212,0.22)]"
              : "border-white/[0.10] bg-white/[0.02] hover:border-cyan-400/60 hover:bg-cyan-500/[0.035]",
          )}
        >
          <div className="relative flex flex-col items-center gap-3.5 px-5 py-10 text-center">
            <div className={cx(
              "grid h-14 w-14 place-items-center rounded-3xl bg-cyan-500/12 ring-1 ring-cyan-400/30 transition-transform duration-300",
              seret ? "scale-110" : "group-hover:scale-105",
            )}>
              <Icon icon="solar:camera-add-bold-duotone"
                className={cx("text-2xl transition-colors", seret ? "text-cyan-300" : "text-zinc-500 group-hover:text-zinc-300")} />
            </div>
            <div className="space-y-1">
              <p className="text-[13px] font-black text-white">Scan KTP Debitur</p>
              <p className="text-[11px] leading-relaxed text-zinc-500">
                Tarik &amp; lepas atau klik — <span className="text-cyan-300">nama, NIK, alamat</span> terisi otomatis
              </p>
            </div>
            <span className="rounded-full bg-cyan-500/12 px-3 py-1 text-[10px] font-black tracking-wide text-cyan-300 ring-1 ring-cyan-400/35">
              JPG · PNG · WEBP · maks 15 MB
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-2.5">
          <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-white/[0.06]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgUrl} alt="KTP debitur" className="h-full w-full object-cover" />
            {memuat && (
              <>
                <div className="absolute inset-0 bg-cyan-500/12 opacity-60" />
                <span className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-cyan-400/40 to-transparent"
                  style={{ animation: "dcScan 1.3s linear infinite" }} />
              </>
            )}
          </div>
          <div className="min-w-0 flex-1">
            {memuat ? (
              <div className="flex items-center gap-2">
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-transparent border-t-cyan-400" />
                <p className="text-[12px] font-semibold text-cyan-300">Membaca KTP…</p>
              </div>
            ) : (
              <LencanaScan status={status} skor={skor} sumber={sumber} />
            )}
          </div>
          <button
            type="button" onClick={() => ref.current?.click()}
            className="shrink-0 rounded-xl border border-white/[0.10] bg-white/[0.05] px-3 py-2 text-[11px] font-bold text-zinc-300 transition-all hover:border-white/20 hover:text-white"
          >
            Ganti
          </button>
        </div>
      )}

      {/* Catatan silang-uji NIK: inilah yang membuat koreksi otomatis tidak
          terasa seperti sihir — pengguna melihat APA yang diubah dan kenapa. */}
      {catatan.length > 0 && (
        <div className="space-y-1 rounded-xl border border-cyan-500/15 bg-cyan-500/[0.04] p-3">
          {catatan.map((c, i) => (
            <p key={i} className="flex items-start gap-1.5 text-[10.5px] leading-relaxed text-cyan-200/85">
              <Icon icon="solar:shield-check-bold" className="mt-px shrink-0 text-[11px]" />
              {c}
            </p>
          ))}
        </div>
      )}

      {peringatan.length > 0 && (
        <div className="space-y-1">
          {peringatan.map((w, i) => (
            <p key={i} className="flex items-start gap-1.5 text-[10.5px] text-amber-400/85">
              <Icon icon="solar:point-on-map-bold" className="mt-px shrink-0 text-[9px]" />
              {w}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function BarisReview({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="flex gap-3 border-b border-white/[0.04] py-1.5 last:border-0">
      <span className="w-[38%] shrink-0 text-[11px] text-zinc-500">{label}</span>
      <span className="flex-1 text-[11.5px] font-semibold text-zinc-200">{nilai || "—"}</span>
    </div>
  );
}

// ── Langkah ───────────────────────────────────────────────────────────────────

const LANGKAH = [
  { label: "KTP Debitur", sub: "Scan identitas", icon: "solar:user-id-bold-duotone" },
  { label: "Alamat & Objek", sub: "Sertifikat", icon: "solar:home-angle-bold-duotone" },
  { label: "Review & Buat", sub: "Generate PDF", icon: "solar:magic-stick-bold-duotone" },
];

// ── Komponen utama ────────────────────────────────────────────────────────────

export function DebiturCareModal({ open, template, onClose }: Props) {
  const [pasang, setPasang] = useState(false);
  const [langkah, setLangkah] = useState(0);
  const [arah, setArah] = useState(1);

  const [debitur, setDebitur] = useState<Debitur>(DEBITUR_KOSONG);
  const [alamat, setAlamat] = useState<Alamat>(ALAMAT_KOSONG);
  const [sertifikat, setSertifikat] = useState<Sertifikat>(SERTIFIKAT_KOSONG);
  const [tanggalSurat, setTanggalSurat] = useState(isoHariIni);

  const [imgUrl, setImgUrl] = useState("");
  const [memuat, setMemuat] = useState(false);
  const [status, setStatus] = useState<StatusScan>("idle");
  const [skor, setSkor] = useState(0);
  const [sumber, setSumber] = useState("");
  const [peringatan, setPeringatan] = useState<string[]>([]);
  const [catatan, setCatatan] = useState<string[]>([]);

  // Begitu alamat gabungan disentuh tangan, perakit otomatis berhenti menimpa.
  const [alamatManual, setAlamatManual] = useState(false);
  const [membuat, setMembuat] = useState(false);
  const [galat, setGalat] = useState("");
  const badanRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setPasang(true), []);
  useEffect(() => () => { if (imgUrl) URL.revokeObjectURL(imgUrl); }, [imgUrl]);

  // Reset penuh tiap modal dibuka: sisa data debitur SEBELUMNYA yang menempel
  // di form adalah cara tercepat menerbitkan surat atas nama orang yang salah.
  useEffect(() => {
    if (!open) return;
    setLangkah(0); setArah(1);
    setDebitur(DEBITUR_KOSONG); setAlamat(ALAMAT_KOSONG); setSertifikat(SERTIFIKAT_KOSONG);
    setTanggalSurat(isoHariIni());
    setImgUrl((lama) => { if (lama) URL.revokeObjectURL(lama); return ""; });
    setMemuat(false); setStatus("idle"); setSkor(0); setSumber("");
    setPeringatan([]); setCatatan([]); setAlamatManual(false); setGalat("");
  }, [open]);

  // Rakit ulang alamat gabungan dari bagian-bagiannya.
  useEffect(() => {
    if (alamatManual) return;
    const susun = susunAlamatLengkap(alamat);
    if (susun !== alamat.alamat_lengkap) {
      setAlamat((p) => ({ ...p, alamat_lengkap: susun }));
    }
  }, [alamat, alamatManual]);

  useEffect(() => { badanRef.current?.scrollTo({ top: 0 }); }, [langkah]);

  const ubahDebitur = useCallback((k: keyof Debitur, v: string) => {
    setDebitur((p) => {
      const baru = { ...p, [k]: v };
      // Tempat & tanggal lahir tampil sebagai satu baris di surat; jaga agar
      // gabungannya ikut berubah saat salah satu bagiannya dikoreksi.
      if (k === "tempat_lahir" || k === "tanggal_lahir") {
        baru.tempat_tanggal_lahir = [baru.tempat_lahir, baru.tanggal_lahir].filter(Boolean).join(", ");
      }
      return baru;
    });
  }, []);

  const ubahAlamat = useCallback((k: keyof Alamat, v: string) => {
    setAlamat((p) => ({ ...p, [k]: v }));
  }, []);

  // ── Scan KTP ────────────────────────────────────────────────────────────
  const onFile = useCallback(async (file: File) => {
    if (file.size > 15 * 1024 * 1024) { setGalat("Ukuran file maksimal 15 MB."); return; }
    setGalat("");
    setImgUrl((lama) => { if (lama) URL.revokeObjectURL(lama); return URL.createObjectURL(file); });
    setMemuat(true); setStatus("scanning"); setPeringatan([]); setCatatan([]);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/surat/ocr-ktp-cerdas", { method: "POST", body: fd });
      const json: BalasanOcr = await res.json();
      if (!res.ok) {
        setStatus("invalid");
        setPeringatan([json.detail ?? "Gagal membaca KTP."]);
        return;
      }
      const d = json.data ?? {};
      setDebitur((p) => ({
        nama: d.nama || p.nama,
        nik: d.nik || p.nik,
        tempat_lahir: d.tempat_lahir || p.tempat_lahir,
        tanggal_lahir: d.tanggal_lahir || p.tanggal_lahir,
        tempat_tanggal_lahir: d.tempat_tanggal_lahir || p.tempat_tanggal_lahir,
        jenis_kelamin: d.jenis_kelamin || p.jenis_kelamin,
        gol_darah: d.gol_darah || p.gol_darah,
        agama: d.agama || p.agama,
        status_kawin: d.status_kawin || p.status_kawin,
        pekerjaan: d.pekerjaan || p.pekerjaan,
        warga_negara: d.warga_negara || p.warga_negara || "Indonesia",
      }));
      setAlamatManual(false);
      setAlamat((p) => ({
        alamat: d.alamat || p.alamat,
        rt_rw: d.rt_rw || p.rt_rw,
        kelurahan: d.kelurahan || p.kelurahan,
        kecamatan: d.kecamatan || p.kecamatan,
        kota: d.kota || p.kota,
        jenis_kota: d.jenis_kota || p.jenis_kota || "Kota",
        provinsi: d.provinsi || p.provinsi,
        alamat_lengkap: d.alamat_lengkap || p.alamat_lengkap,
      }));
      setStatus((json.status as StatusScan) ?? "review");
      setSkor(json.skor ?? 0);
      setSumber(json.sumber ?? "");
      setPeringatan(json.peringatan ?? []);
      setCatatan(json.catatan_silang ?? []);
    } catch {
      setStatus("invalid");
      setPeringatan(["Gagal menghubungi server. Isi data secara manual di bawah."]);
    } finally {
      setMemuat(false);
    }
  }, []);

  // ── Navigasi ────────────────────────────────────────────────────────────
  const langkah0ok = Boolean(debitur.nama.trim()) && !memuat;
  const langkah1ok = Boolean(alamat.alamat_lengkap.trim())
    && Boolean(sertifikat.jenis_sertifikat.trim())
    && Boolean(sertifikat.nomor_sertifikat.trim());
  const langkahOk = [langkah0ok, langkah1ok, true][langkah] ?? false;

  const keLangkah = (n: number) => { setArah(n > langkah ? 1 : -1); setLangkah(n); setGalat(""); };

  const nomorPratinjau = useMemo(() => {
    const d = tanggalSurat.match(/^(\d{4})-(\d{2})-/);
    const bulan = d ? Number(d[2]) : new Date().getMonth() + 1;
    const tahun = d ? d[1] : String(new Date().getFullYear());
    return `NNN/PJH-${inisialNama(debitur.nama) || "XX"}/${ROMAWI[bulan - 1]}/${tahun}`;
  }, [debitur.nama, tanggalSurat]);

  // ── Generate ────────────────────────────────────────────────────────────
  const buatSurat = async () => {
    if (membuat) return;
    setMembuat(true); setGalat("");
    try {
      const muatan = {
        tanggal_surat: tanggalSurat,
        ...debitur,
        ...alamat,
        ...sertifikat,
        sumber_ocr: sumber,
        skor_ocr: String(skor),
      };
      const res = await fetch("/api/surat/generate-debitur-care", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(muatan),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { detail?: string };
        setGalat(err.detail ?? "Gagal membuat surat. Coba lagi.");
        return;
      }
      const disp = res.headers.get("Content-Disposition") ?? "";
      const namaBerkas = disp.match(/filename="([^"]+)"/)?.[1] ?? "DebiturCare.pdf";
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = namaBerkas; a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch {
      setGalat("Gagal menghubungi server.");
    } finally {
      setMembuat(false);
    }
  };

  if (!open || !template || !pasang) return null;

  const anim = arah === 1 ? "dc-slide-r" : "dc-slide-l";

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center sm:p-4">
      <style>{`
        @keyframes dcSlideR { from{opacity:0;transform:translateX(24px)} to{opacity:1;transform:none} }
        @keyframes dcSlideL { from{opacity:0;transform:translateX(-24px)} to{opacity:1;transform:none} }
        @keyframes dcScan   { 0%{top:-2px} 100%{top:calc(100% + 2px)} }
        @keyframes dcOrb    { 0%,100%{transform:translate(0,0)} 50%{transform:translate(10px,-8px)} }
        @keyframes dcPop    { from{opacity:0;transform:translateY(-4px) scale(.97)} to{opacity:1;transform:none} }
        .dc-slide-r { animation: dcSlideR .3s cubic-bezier(.22,1,.36,1) both }
        .dc-slide-l { animation: dcSlideL .3s cubic-bezier(.22,1,.36,1) both }
        .dc-pop     { animation: dcPop .16s cubic-bezier(.22,1,.36,1) both }
      `}</style>

      <div className="absolute inset-0 bg-black/85 backdrop-blur-xl" onClick={membuat ? undefined : onClose} />

      <div
        className="relative flex max-h-[96vh] w-full flex-col overflow-hidden rounded-t-[26px] border border-white/[0.07] bg-[#07070c] shadow-[0_48px_140px_rgba(0,0,0,0.95)] sm:max-w-4xl sm:rounded-[26px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-cyan-500/[0.06] blur-3xl"
          style={{ animation: "dcOrb 11s ease-in-out infinite" }} />
        <div className="pointer-events-none absolute -right-28 top-28 h-64 w-64 rounded-full bg-violet-500/[0.05] blur-3xl"
          style={{ animation: "dcOrb 14s ease-in-out infinite" }} />

        {/* ── Header ── */}
        <div className="relative shrink-0 px-6 pb-4 pt-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan-500/25 to-cyan-700/5 ring-1 ring-cyan-400/25">
                <Icon icon="solar:shield-user-bold-duotone" className="text-[22px] text-cyan-300" />
              </div>
              <div>
                <h2 className="text-[16px] font-black tracking-tight text-white">Debitur Care</h2>
                <p className="text-[11px] text-zinc-500">
                  Surat Kuasa + Perjanjian Jasa Hukum · nomor otomatis · PDF
                </p>
              </div>
            </div>
            <button
              type="button" onClick={membuat ? undefined : onClose} disabled={membuat}
              className={cx(
                "grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/[0.10] bg-white/[0.06] transition-all",
                membuat ? "cursor-not-allowed text-zinc-600" : "text-zinc-300 hover:border-white/[0.18] hover:bg-white/[0.12] hover:text-white",
              )}
            >
              <X className="h-[15px] w-[15px]" />
            </button>
          </div>

          {/* ── Stepper ── */}
          <div className="mt-5 flex items-center">
            {LANGKAH.map((s, i) => {
              const selesai = i < langkah;
              const aktif = i === langkah;
              const bisa = i <= langkah || (i === langkah + 1 && langkahOk);
              return (
                <div key={s.label} className={cx("flex items-center", i < LANGKAH.length - 1 && "flex-1")}>
                  <button
                    type="button"
                    onClick={() => bisa && !membuat && keLangkah(i)}
                    className={cx("group flex items-center gap-2", bisa ? "cursor-pointer" : "cursor-not-allowed")}
                  >
                    <span className={cx(
                      "relative grid h-9 w-9 shrink-0 place-items-center rounded-2xl ring-1 transition-all duration-300",
                      selesai ? "bg-cyan-500/12 ring-cyan-400/35"
                        : aktif ? "bg-cyan-500/12 ring-cyan-400/35 shadow-[0_0_26px_rgba(6,182,212,0.28)]"
                          : "bg-white/[0.03] ring-white/[0.06]",
                    )}>
                      {selesai
                        ? <Icon icon="solar:check-circle-bold-duotone" className="text-base text-cyan-300" />
                        : <Icon icon={s.icon} className={cx("text-sm", aktif ? "text-cyan-300" : "text-zinc-600")} />}
                    </span>
                    <span className="hidden text-left lg:block">
                      <span className={cx("block text-[11px] font-black leading-none", aktif || selesai ? "text-white" : "text-zinc-600")}>{s.label}</span>
                      <span className="mt-0.5 block text-[9.5px] text-zinc-600">{s.sub}</span>
                    </span>
                  </button>
                  {i < LANGKAH.length - 1 && (
                    <span className="mx-2 h-[2px] flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <span className="block h-full rounded-full bg-gradient-to-r from-cyan-400 to-sky-400 transition-all duration-500"
                        style={{ width: i < langkah ? "100%" : "0%" }} />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Overlay saat membuat ── */}
        {membuat && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-[#07070c]/95 backdrop-blur-sm">
            <div className="relative grid place-items-center">
              <div className="absolute h-28 w-28 animate-ping rounded-full bg-cyan-500/[0.08]" />
              <div className="relative grid h-[72px] w-[72px] place-items-center rounded-full bg-gradient-to-br from-cyan-500/25 to-cyan-700/5 ring-1 ring-cyan-400/30">
                <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-cyan-400" />
                <Icon icon="solar:shield-user-bold-duotone" className="text-2xl text-cyan-300" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-[17px] font-black text-white">Membuat surat…</p>
              <p className="mt-1 text-[12px] text-zinc-500">Memesan nomor & menyusun PDF · jangan tutup halaman ini</p>
            </div>
          </div>
        )}

        {/* ── Badan ── */}
        <div ref={badanRef} className={cx("relative flex-1 overflow-y-auto overscroll-contain", membuat && "pointer-events-none select-none")}>
          <div key={langkah} className={cx("space-y-4 px-6 pb-6 pt-2", anim)}>

            {galat && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-500/25 bg-rose-500/[0.07] px-3.5 py-2.5">
                <Icon icon="solar:danger-triangle-bold" className="mt-px shrink-0 text-sm text-rose-300" />
                <p className="text-[12px] leading-relaxed text-rose-200">{galat}</p>
              </div>
            )}

            {/* ── Langkah 1: KTP ── */}
            {langkah === 0 && (
              <>
                <Kartu icon="solar:user-id-bold-duotone" title="Foto KTP Debitur"
                  sub="Semua kolom di bawah terisi dari sini — dan tetap bisa dikoreksi">
                  <PanelKtp
                    imgUrl={imgUrl} memuat={memuat} status={status} skor={skor} sumber={sumber}
                    peringatan={peringatan} catatan={catatan} onFile={onFile}
                  />
                </Kartu>

                <Kartu icon="solar:card-bold-duotone" title="Identitas Debitur"
                  sub="PIHAK KESATU / PEMBERI KUASA">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <F label="Nama Lengkap" hint="Tercetak apa adanya di surat — biarkan huruf kapital seperti di KTP.">
                        <Isian value={debitur.nama} onChange={(v) => ubahDebitur("nama", v)} placeholder="Sesuai KTP" />
                      </F>
                    </div>
                    <F label="NIK">
                      <Isian mono value={debitur.nik} onChange={(v) => ubahDebitur("nik", v)} placeholder="16 digit" />
                    </F>
                    <F label="Jenis Kelamin">
                      <Isian value={debitur.jenis_kelamin} onChange={(v) => ubahDebitur("jenis_kelamin", v)} placeholder="Laki-Laki / Perempuan" />
                    </F>
                    <F label="Tempat Lahir">
                      <Isian value={debitur.tempat_lahir} onChange={(v) => ubahDebitur("tempat_lahir", v)} placeholder="Contoh: Malang" />
                    </F>
                    <F label="Tanggal Lahir" hint="Format DD-MM-YYYY">
                      <Isian mono value={debitur.tanggal_lahir} onChange={(v) => ubahDebitur("tanggal_lahir", v)} placeholder="22-12-1967" />
                    </F>
                    <F label="Pekerjaan">
                      <Isian value={debitur.pekerjaan} onChange={(v) => ubahDebitur("pekerjaan", v)} placeholder="Contoh: Mengurus Rumah Tangga" />
                    </F>
                    <F label="Status Perkawinan">
                      <Isian value={debitur.status_kawin} onChange={(v) => ubahDebitur("status_kawin", v)} placeholder="Kawin / Belum Kawin" />
                    </F>
                    <F label="Warga Negara">
                      <Isian value={debitur.warga_negara} onChange={(v) => ubahDebitur("warga_negara", v)} />
                    </F>
                    <F label="Agama" hint="Tidak dicetak di surat — hanya arsip.">
                      <Isian value={debitur.agama} onChange={(v) => ubahDebitur("agama", v)} />
                    </F>
                  </div>
                </Kartu>
              </>
            )}

            {/* ── Langkah 2: Alamat & sertifikat ── */}
            {langkah === 1 && (
              <>
                <Kartu icon="solar:map-point-bold-duotone" title="Alamat Debitur"
                  sub="Sampai provinsi — dipakai di Surat Kuasa & Pasal 1">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <F label="Alamat (Jalan / Nomor)">
                        <Isian value={alamat.alamat} onChange={(v) => ubahAlamat("alamat", v)}
                          placeholder="Contoh: Jl. Candi Lontar Kulon 44-Q/11" />
                      </F>
                    </div>
                    <F label="RT / RW" hint="Arsip saja — tidak masuk baris alamat surat.">
                      <Isian mono value={alamat.rt_rw} onChange={(v) => ubahAlamat("rt_rw", v)} placeholder="003/008" />
                    </F>
                    <F label="Kelurahan / Desa">
                      <Isian value={alamat.kelurahan} onChange={(v) => ubahAlamat("kelurahan", v)} placeholder="Contoh: Lontar" />
                    </F>
                    <F label="Kecamatan">
                      <Isian value={alamat.kecamatan} onChange={(v) => ubahAlamat("kecamatan", v)} placeholder="Contoh: Sambi Kerep" />
                    </F>
                    <F label="Kota / Kabupaten">
                      <div className="grid grid-cols-[128px_1fr] gap-2">
                        <Pilihan
                          value={alamat.jenis_kota}
                          onChange={(v) => ubahAlamat("jenis_kota", v)}
                          opsi={["Kota", "Kabupaten"]}
                          placeholder="Jenis"
                          ikon="solar:city-bold-duotone"
                        />
                        <Isian value={alamat.kota} onChange={(v) => ubahAlamat("kota", v)} placeholder="Contoh: Surabaya" />
                      </div>
                    </F>
                    <div className="sm:col-span-2">
                      <F label="Provinsi">
                        <Isian value={alamat.provinsi} onChange={(v) => ubahAlamat("provinsi", v)} placeholder="Contoh: Jawa Timur" />
                      </F>
                    </div>

                    <div className="sm:col-span-2">
                      <div className="mb-1.5 flex items-center justify-between">
                        <Label>Alamat Lengkap (yang dicetak di surat)</Label>
                        {alamatManual && (
                          <button
                            type="button"
                            onClick={() => { setAlamatManual(false); setAlamat((p) => ({ ...p, alamat_lengkap: susunAlamatLengkap(p) })); }}
                            className="text-[10px] font-bold text-cyan-300 hover:text-cyan-200"
                          >
                            Susun ulang otomatis
                          </button>
                        )}
                      </div>
                      <AreaIsian
                        value={alamat.alamat_lengkap}
                        onChange={(v) => { setAlamatManual(true); ubahAlamat("alamat_lengkap", v); }}
                        placeholder="Terisi otomatis dari kolom di atas"
                      />
                      <span className="mt-1 block text-[10.5px] text-zinc-600">
                        Tersusun otomatis: alamat, Kel., Kec., Kota/Kab, Provinsi. Boleh diketik ulang.
                      </span>
                    </div>
                  </div>
                </Kartu>

                <Kartu icon="solar:document-text-bold-duotone" title="Objek Pengosongan"
                  sub="Muncul di Surat Kuasa & Pasal 1 Perjanjian">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <F label="Jenis Sertifikat" hint="Boleh pilih dari daftar atau ketik sendiri.">
                      <Pilihan
                        value={sertifikat.jenis_sertifikat}
                        onChange={(v) => setSertifikat((p) => ({ ...p, jenis_sertifikat: v }))}
                        opsi={JENIS_SERTIFIKAT}
                        placeholder="Pilih jenis sertifikat"
                        ikon="solar:document-bold-duotone"
                        bebas
                      />
                    </F>
                    <F label="Nomor Sertifikat">
                      <Isian mono value={sertifikat.nomor_sertifikat}
                        onChange={(v) => setSertifikat((p) => ({ ...p, nomor_sertifikat: v }))}
                        placeholder="Contoh: 01234/Lontar" />
                    </F>
                  </div>
                </Kartu>

                <Kartu icon="solar:calendar-bold-duotone" title="Tanggal Surat"
                  sub="Menentukan bulan & tahun pada nomor surat">
                  <PilihTanggal value={tanggalSurat} onChange={setTanggalSurat} />
                </Kartu>
              </>
            )}

            {/* ── Langkah 3: review ── */}
            {langkah === 2 && (
              <>
                <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.07] to-transparent p-4">
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:hashtag-square-bold-duotone" className="text-base text-cyan-300" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-300/80">Nomor Surat</span>
                  </div>
                  <p className="mt-2 font-mono text-[17px] font-black tracking-wide text-white">{nomorPratinjau}</p>
                  <p className="mt-1.5 text-[10.5px] leading-relaxed text-zinc-500">
                    <span className="font-mono text-zinc-400">NNN</span> diisi server saat surat dibuat — urutannya
                    dimulai lagi dari 001 tiap ganti bulan, dan nomor baru terpakai kalau PDF-nya benar-benar jadi.
                  </p>
                </div>

                <Kartu icon="solar:user-id-bold-duotone" title="Debitur" sub="PIHAK KESATU / PEMBERI KUASA">
                  <div>
                    <BarisReview label="Nama" nilai={debitur.nama} />
                    <BarisReview label="NIK" nilai={debitur.nik} />
                    <BarisReview label="Tempat/Tgl Lahir" nilai={debitur.tempat_tanggal_lahir} />
                    <BarisReview label="Jenis Kelamin" nilai={debitur.jenis_kelamin} />
                    <BarisReview label="Warga Negara" nilai={debitur.warga_negara} />
                    <BarisReview label="Pekerjaan" nilai={debitur.pekerjaan} />
                    <BarisReview label="Status" nilai={debitur.status_kawin} />
                  </div>
                </Kartu>

                <Kartu icon="solar:home-angle-bold-duotone" title="Alamat & Objek" sub="Dicetak di Surat Kuasa dan Pasal 1">
                  <div>
                    <BarisReview label="Alamat Lengkap" nilai={alamat.alamat_lengkap} />
                    <BarisReview label="Jenis Sertifikat" nilai={sertifikat.jenis_sertifikat} />
                    <BarisReview label="Nomor Sertifikat" nilai={sertifikat.nomor_sertifikat} />
                    <BarisReview label="Tanggal Surat" nilai={tampilTanggal(tanggalSurat)} />
                  </div>
                </Kartu>

                {peringatan.length > 0 && (
                  <div className="space-y-1 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-3">
                    <p className="mb-1 text-[11px] font-bold text-amber-300">Periksa lagi sebelum membuat surat</p>
                    {peringatan.map((w, i) => (
                      <p key={i} className="flex items-start gap-1.5 text-[10.5px] text-amber-200/85">
                        <Icon icon="solar:point-on-map-bold" className="mt-px shrink-0 text-[9px]" />
                        {w}
                      </p>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={buatSurat}
                  disabled={membuat || !langkah0ok || !langkah1ok}
                  className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-500 to-cyan-600 py-4 text-[14px] font-black tracking-wide text-black shadow-[0_4px_24px_rgba(6,182,212,0.35)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(6,182,212,0.50)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <Icon icon="solar:bolt-bold" className="text-base" />
                    Buat Surat &amp; Unduh PDF
                  </span>
                  <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-[100%]" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        {langkah < 2 && (
          <div className="relative shrink-0 border-t border-white/[0.05] bg-[#07070c]/80 px-6 py-4 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button" onClick={() => keLangkah(langkah - 1)} disabled={langkah === 0}
                className="flex items-center gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-2.5 text-[12px] font-bold text-zinc-400 transition-all hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Icon icon="solar:alt-arrow-left-bold" className="text-xs" />
                Kembali
              </button>

              <div className="flex items-center gap-1.5">
                {LANGKAH.map((_, i) => (
                  <span key={i} className={cx(
                    "h-1.5 rounded-full transition-all duration-300",
                    i === langkah ? "w-6 bg-gradient-to-r from-cyan-400 to-sky-400"
                      : i < langkah ? "w-1.5 bg-cyan-500/60" : "w-1.5 bg-white/10",
                  )} />
                ))}
              </div>

              <button
                type="button" onClick={() => keLangkah(langkah + 1)} disabled={!langkahOk}
                className="flex items-center gap-1.5 rounded-xl bg-cyan-500/15 px-5 py-2.5 text-[12px] font-black text-cyan-300 ring-1 ring-cyan-500/25 transition-all duration-200 hover:bg-cyan-500/25 hover:ring-cyan-400/35 disabled:cursor-not-allowed disabled:opacity-30"
              >
                Lanjut
                <Icon icon="solar:alt-arrow-right-bold" className="text-xs" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
