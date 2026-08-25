"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@iconify/react";
import SortSelect from "@/components/listing/SortSelect";
import LocationPicker from "@/components/search/LocationPicker";
import {
  locationsToSelectedRegions,
  parseLocationParams,
  serializeLocations,
  REGION_LEVELS,
  type SelectedRegion,
} from "@/lib/regionSearch";
import {
  bidangUntuk,
  chipAktif,
  hapusChip,
  hapusSemuaFilter,
  jumlahTersembunyi,
  paramBidang,
  parseFiltersDariUrl,
  type BidangFilter,
  type ChipFilter,
  type KonteksFilter,
} from "@/lib/listingFilters";
import ActiveFilterChips from "./ActiveFilterChips";
import Drawer from "./Drawer";
import Popover from "./Popover";
import TransactionSegments, { type TabTransaksi } from "./TransactionSegments";
import { DEF_PANEL, IsiPanel, type Draft } from "./panels";
import { BAR, CHIP_IDLE, CHIP_ISI, RING_FOKUS, TINGGI_BAR } from "./tokens";
import { useResultCount } from "./useResultCount";

/**
 * ══════════════════════════════════════════════════════════════════════════
 * Bar perintah daftar listing — filter, tab transaksi, dan urutan dalam satu
 * baris lengket.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * YANG DIGANTIKANNYA
 * Bar lama memajang enam pill URUTAN yang selalu terlihat, masing-masing bisa
 * di-toggle mati lewat silang merah. Bentuk itu berbohong dua kali: chip berarti
 * "boleh pilih banyak" padahal urutan hanya satu, dan mematikan pill membuat
 * daftar jatuh ke urutan default yang tidak ditandai apa pun. Sementara itu
 * filter sungguhan (lokasi, harga, tipe) hanya ada di hero yang ikut hilang
 * saat di-scroll.
 *
 * BENTUK BARUNYA
 *   [Semua][Jual][Lelang][Sewa] │ Lokasi▾ Harga▾ Tipe▾ … │ ⚙Filter③ · N hasil · Urutkan▾
 *   chip filter aktif yang bisa dihapus satuan ················· Hapus semua
 *
 * ATURAN YANG DIPEGANG
 *  • URL adalah satu-satunya sumber kebenaran. Tidak ada state bayangan yang
 *    harus disinkronkan — draft panel hanyalah nilai URL yang belum dituang.
 *  • Setiap perubahan filter/tab/urutan MERESET `page`. Tanpa itu, menyempitkan
 *    filter selagi di halaman 9 mendarat di luar jangkauan hasil yang baru.
 *  • Pilihan tunggal diterapkan seketika; yang perlu mengetik menunggu tombol
 *    "Terapkan". Bentuk panelnya sendiri yang memberi tahu mana yang mana.
 */

/**
 * Bidang yang tampil sebagai trigger langsung di bar (desktop). Sisanya hidup
 * di laci "Filter".
 *
 * Empat, bukan semua: bar yang memuat sebelas trigger kembali jadi dinding
 * kontrol seperti versi lama. Yang dipilih adalah pertanyaan pertama pemakai di
 * tiap konteks — dan di lelang pertanyaan itu "kapan lelangnya?", bukan "berapa
 * kamarnya?".
 */
const TRIGGER_UTAMA: Record<KonteksFilter, BidangFilter[]> = {
  SEMUA: ["lokasi", "harga", "kategori", "kamar"],
  JUAL: ["lokasi", "harga", "kategori", "kamar"],
  LELANG: ["lokasi", "harga", "kategori", "jadwal"],
  SEWA: ["lokasi", "harga", "kategori", "durasi"],
};

export interface FilterCommandBarProps {
  konteks: KonteksFilter;
  tabAktif: TabTransaksi;
  /** Wajib kalau `showSegments` true — dipakai badge jumlah tiap tab. */
  tabCounts?: Record<TabTransaksi, number>;
  /** Jumlah hasil yang sedang ditampilkan halaman (dari server). */
  totalHasil: number;
  /** Offset `top` saat menempel — menyesuaikan tinggi navbar situs. */
  topClass?: string;
  /**
   * Tampilkan segmen tab (Semua/Jual/Lelang/Sewa)?
   *
   * Default `true` untuk `/properti/[slug]`, tempat keempat tab hidup di satu
   * halaman lewat query `tipe`. `/Jual`, `/Lelang`, `/Sewa` adalah route
   * terpisah — bukan tab dari satu halaman — jadi mereka mematikan ini dan
   * memakai bar ini murni sebagai kontrol filter+urutkan.
   */
  showSegments?: boolean;
  /**
   * Kesempatan bagi halaman untuk MEMINDAHKAN path, bukan hanya query.
   *
   * Dibutuhkan halaman kategori: di sana kategori properti ikut hidup di URL
   * (`/properti/rumah`), jadi memilih "Apartemen" di bar tanpa memindahkan path
   * akan menampilkan apartemen di halaman yang judulnya masih "Rumah". Boleh
   * mengubah `params` (mis. membuang param yang sudah terwakili path).
   * Mengembalikan `null` berarti tetap di path sekarang.
   */
  resolvePath?: (params: URLSearchParams) => string | null;
  /** Nama tempat yang sedang disaring — melabeli opsi urut "Terdekat dari X". */
  namaTempat?: string | null;
}

export default function FilterCommandBar({
  konteks,
  tabAktif,
  tabCounts,
  totalHasil,
  topClass = "top-0 lg:top-[72px]",
  showSegments = true,
  resolvePath,
  namaTempat = null,
}: FilterCommandBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const spString = sp.toString();

  const state = useMemo(() => parseFiltersDariUrl(sp), [sp]);
  const chips = useMemo(() => chipAktif(state, konteks), [state, konteks]);
  const tersembunyi = useMemo(
    () => jumlahTersembunyi(state, konteks),
    [state, konteks]
  );

  const [bukaLaci, setBukaLaci] = useState(false);

  /** Semua perubahan URL lewat satu pintu, supaya `page` tidak pernah lupa direset. */
  const navigasi = useCallback(
    (ubah: (p: URLSearchParams) => void) => {
      const p = new URLSearchParams(spString);
      ubah(p);
      // `page` selalu dibuang. Tanpa ini, menyempitkan filter selagi berada di
      // halaman 9 mendarat di luar jangkauan hasil yang baru.
      p.delete("page");
      const tujuan = resolvePath?.(p) ?? pathname;
      const q = p.toString();
      router.push(q ? `${tujuan}?${q}` : tujuan, { scroll: false });
    },
    [pathname, router, spString, resolvePath]
  );

  const terapkanDraft = useCallback(
    (draft: Draft) => {
      navigasi((p) => {
        for (const [k, v] of Object.entries(draft)) {
          if (v) p.set(k, v);
          else p.delete(k);
        }
      });
    },
    [navigasi]
  );

  const gantiTab = useCallback(
    (tab: TabTransaksi) => {
      navigasi((p) => {
        if (tab === "semua") p.delete("tipe");
        else p.set("tipe", tab);
      });
    },
    [navigasi]
  );

  const hapusSatu = useCallback(
    (chip: ChipFilter) => navigasi((p) => hapusChip(p, chip)),
    [navigasi]
  );

  const hapusSemua = useCallback(
    () => navigasi((p) => hapusSemuaFilter(p)),
    [navigasi]
  );

  /**
   * Ringkasan nilai sebuah bidang untuk label trigger — "Rp 300 jt – 500 jt",
   * bukan "Harga". Diturunkan dari chip yang sudah dihitung mesin filter, jadi
   * tidak ada aturan format kedua yang bisa menyimpang.
   */
  const ringkas = useCallback(
    (bidang: BidangFilter): string | null => {
      const milik = chips.filter((c) => c.bidang === bidang);
      if (milik.length === 0) return null;
      if (milik.length === 1) return milik[0].label;
      return `${milik[0].label} +${milik.length - 1}`;
    },
    [chips]
  );

  const utama = TRIGGER_UTAMA[konteks].filter((b) =>
    bidangUntuk(konteks).includes(b)
  );
  const jumlahFilter = chips.length;

  // Filter hanya hidup di JUAL dan SEWA. Dua tab lain sengaja tidak dapat
  // trigger cepat maupun laci filter penuh:
  //
  //   • "Semua" mencampur jual, lelang, dan sewa — harga, lokasi, dan tipe aset
  //     tidak lagi berarti satu hal yang sama antar baris hasil (lihat
  //     peringatan yang sama di panel Harga).
  //   • "Lelang" dicari lewat pertanyaan yang lain sama sekali: jadwal, kelas
  //     aset, dan nilai limit — bukan kamar tidur/kondisi interior. Laci filter
  //     properti biasa di sana memajang bidang yang hampir seluruh datanya
  //     kosong pada listing hasil scrape, jadi setiap kombinasi berakhir "0
  //     hasil" dan terbaca seperti situs yang rusak.
  //
  // Yang tetap masuk akal di kedua tab itu hanyalah mengurutkan — dan baris
  // chip di bawah bar tetap dirender, supaya filter yang TERLANJUR dipasang
  // lewat search bar hero masih terlihat dan masih bisa dilepas satuan.
  const filterAktifDiBar = tabAktif === "jual" || tabAktif === "sewa";

  return (
    <div className={`sticky ${topClass} z-40`} style={BAR}>
      <div
        className="container mx-auto flex max-w-screen-xl items-center gap-2 px-5 sm:px-8 md:px-10"
        style={{ height: TINGGI_BAR }}
      >
        {/* Wadah yang bisa di-scroll HANYA memuat segmen & trigger. Tombol
            Filter dan Urutkan sengaja di luar: panel keduanya dirender absolut,
            dan `overflow-x: auto` pada induknya akan memotong panel itu. */}
        <div
          className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto scrollbar-none"
          style={{ scrollbarWidth: "none" }}
        >
          {showSegments && (
            <TransactionSegments
              aktif={tabAktif}
              counts={tabCounts ?? { semua: 0, jual: 0, lelang: 0, sewa: 0 }}
              onChange={gantiTab}
            />
          )}

          {showSegments && filterAktifDiBar && (
            <div
              className="hidden h-5 w-px shrink-0 lg:block"
              style={{ background: "rgba(255,255,255,0.08)" }}
              aria-hidden
            />
          )}

          {filterAktifDiBar && (
            <div className="hidden items-center gap-1.5 lg:flex">
              {utama.map((bidang) =>
                // Lokasi memakai trigger-nya sendiri: LocationPicker SUDAH berupa
                // trigger + panel lengkap. Membungkusnya lagi dengan popover di
                // sini berarti pemakai harus mengklik dua kali untuk sampai ke
                // daftar wilayah.
                bidang === "lokasi" ? (
                  <TriggerLokasi
                    key={bidang}
                    ringkas={ringkas("lokasi")}
                    spString={spString}
                    onTerapkan={terapkanDraft}
                  />
                ) : (
                  <TriggerBidang
                    key={bidang}
                    bidang={bidang}
                    konteks={konteks}
                    ringkas={ringkas(bidang)}
                    spString={spString}
                    onTerapkan={terapkanDraft}
                  />
                )
              )}
            </div>
          )}
        </div>

        {/* Tombol laci filter lengkap */}
        {filterAktifDiBar && (
          <button
            type="button"
            onClick={() => setBukaLaci(true)}
            aria-haspopup="dialog"
            aria-expanded={bukaLaci}
            className={`flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[13px] font-bold transition-colors ${RING_FOKUS}`}
            style={jumlahFilter > 0 ? CHIP_ISI : CHIP_IDLE}
          >
            <Icon icon="solar:tuning-4-bold-duotone" className="text-base" aria-hidden />
            <span>Filter</span>
            {jumlahFilter > 0 && (
              <span
                className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[11px] font-bold tabular-nums"
                style={{ background: "rgba(99,102,241,0.45)", color: "#fff" }}
              >
                {jumlahFilter}
              </span>
            )}
          </button>
        )}

        <span
          className="hidden shrink-0 text-[12px] font-medium tabular-nums xl:block"
          style={{ color: "rgba(255,255,255,0.35)" }}
        >
          {totalHasil.toLocaleString("id-ID")} hasil
        </span>

        <SortSelect
          konteks={konteks}
          baseUrl={pathname}
          namaTempat={namaTempat}
          varian="ringkas"
          className="w-auto shrink-0 max-w-[46vw] sm:max-w-none"
        />
      </div>

      {/* Barisnya mengurus kemunculannya sendiri (mengembalikan null saat tak
          ada filter aktif), jadi tidak dibungkus AnimatePresence di sini —
          pembungkus itu tidak akan pernah melihat anaknya "hilang". */}
      <ActiveFilterChips
        chips={chips}
        tersembunyi={tersembunyi}
        onHapus={hapusSatu}
        onHapusSemua={hapusSemua}
      />

      {/* Kelasnya didefinisikan di sini, bukan menumpang style global halaman,
          supaya bar ini bisa dipasang di halaman daftar mana pun tanpa membawa
          syarat tersembunyi. */}
      <style jsx global>{`
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {filterAktifDiBar && (
        <LaciFilter
          buka={bukaLaci}
          onTutup={() => setBukaLaci(false)}
          konteks={konteks}
          spString={spString}
          jumlahFilter={jumlahFilter}
          onTerapkan={(draft) => {
            terapkanDraft(draft);
            setBukaLaci(false);
          }}
          onReset={() => {
            hapusSemua();
            setBukaLaci(false);
          }}
        />
      )}
    </div>
  );
}

/* ──────────────────────── Trigger + popover per bidang ───────────────── */

/** Nilai param milik satu bidang, dibaca dari URL. */
function draftAwal(spString: string, bidang: BidangFilter): Draft {
  const sp = new URLSearchParams(spString);
  const draft: Draft = {};
  for (const param of paramBidang(bidang)) draft[param] = sp.get(param) ?? "";
  return draft;
}

function TriggerBidang({
  bidang,
  konteks,
  ringkas,
  spString,
  onTerapkan,
}: {
  bidang: BidangFilter;
  konteks: KonteksFilter;
  ringkas: string | null;
  spString: string;
  onTerapkan: (draft: Draft) => void;
}) {
  const def = DEF_PANEL[bidang];
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [buka, setBuka] = useState(false);
  const [draft, setDraft] = useState<Draft>({});
  const idPanel = `panel-${bidang}`;
  const idTombol = `trigger-${bidang}`;
  const berisi = ringkas !== null;

  const bukaPanel = () => {
    // Draft selalu dimulai ulang dari URL saat dibuka — kalau tidak, sisa
    // ketikan yang pernah dibatalkan pemakai akan muncul lagi di pembukaan
    // berikutnya seolah-olah ia sudah tersimpan.
    setDraft(draftAwal(spString, bidang));
    setBuka(true);
  };

  const patch = (next: Draft) => {
    if (def.instan) {
      // Pilihan tunggal: langsung jalan, panel menutup. Menahannya di balik
      // tombol "Terapkan" hanya menambah satu ketukan tanpa memberi apa pun.
      onTerapkan(next);
      setBuka(false);
      return;
    }
    setDraft((prev) => ({ ...prev, ...next }));
  };

  return (
    <>
      <button
        id={idTombol}
        ref={anchorRef}
        type="button"
        onClick={() => (buka ? setBuka(false) : bukaPanel())}
        aria-haspopup="dialog"
        aria-expanded={buka}
        aria-controls={buka ? idPanel : undefined}
        className={`flex h-9 max-w-[220px] shrink-0 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold transition-colors ${RING_FOKUS}`}
        style={berisi ? CHIP_ISI : CHIP_IDLE}
      >
        <Icon icon={def.ikon} className="shrink-0 text-base" aria-hidden />
        {/* Label menampilkan NILAI kalau ada — pemakai membaca keadaan filter
            tanpa perlu membuka satu panel pun. */}
        <span className="truncate">{ringkas ?? def.label}</span>
        <Icon
          icon="solar:alt-arrow-down-linear"
          className={`shrink-0 text-xs transition-transform ${buka ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      <Popover
        id={idPanel}
        labelledBy={idTombol}
        anchorRef={anchorRef}
        open={buka}
        onClose={() => setBuka(false)}
        lebar={def.lebar}
      >
        <div className="p-4">
          <IsiPanel bidang={bidang} konteks={konteks} draft={draft} patch={patch} />

          {!def.instan && (
            <div
              className="mt-4 flex items-center gap-2 pt-3"
              style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
            >
              <button
                type="button"
                onClick={() => {
                  const kosong: Draft = {};
                  for (const p of paramBidang(bidang)) kosong[p] = "";
                  onTerapkan(kosong);
                  setBuka(false);
                }}
                className={`rounded-lg px-3 py-2 text-[12px] font-bold transition-colors hover:text-white ${RING_FOKUS}`}
                style={{ color: "rgba(255,255,255,0.45)" }}
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => {
                  onTerapkan(draft);
                  setBuka(false);
                }}
                className={`flex-1 rounded-lg px-3 py-2 text-[13px] font-bold transition-opacity hover:opacity-90 ${RING_FOKUS}`}
                style={{ background: "#6366f1", color: "#fff" }}
              >
                Terapkan
              </button>
            </div>
          )}
        </div>
      </Popover>
    </>
  );
}

/* ───────────────────────────── Trigger lokasi ────────────────────────── */

/**
 * `LocationPicker` sudah membawa trigger DAN panelnya sendiri (pencarian lintas
 * provinsi, drill-down, tombol "Terapkan"), jadi di sini ia dipakai apa adanya
 * dan hanya dibungkus agar bentuknya menyatu dengan chip lain di bar.
 *
 * Dua hal yang tetap harus disediakan pembungkusnya:
 *  • KLIK DI LUAR. Picker ini menutup dirinya sendiri hanya lewat Escape dan
 *    tombol "Terapkan"; penutupan karena klik di luar memang sengaja diserahkan
 *    ke induk (lihat pemakaian di search bar hero).
 *  • PENUNDAAN PENERAPAN. Pilihan ditahan di state lokal dan baru dituang ke URL
 *    saat panel ditutup — kalau tiap centang langsung mendorong route, memilih
 *    tiga kota berarti tiga kali render ulang server di halaman berisi ribuan
 *    listing.
 */
function TriggerLokasi({
  ringkas,
  spString,
  onTerapkan,
}: {
  ringkas: string | null;
  spString: string;
  onTerapkan: (draft: Draft) => void;
}) {
  const wadahRef = useRef<HTMLDivElement>(null);
  const [buka, setBuka] = useState(false);

  const dariUrl = useCallback(
    () => locationsToSelectedRegions(parseLocationParams((k) => new URLSearchParams(spString).get(k))),
    [spString]
  );

  const [lokal, setLokal] = useState<SelectedRegion[]>(dariUrl);

  // Selagi tertutup, pilihan lokal selalu mengikuti URL — supaya menghapus chip
  // "Surabaya" di baris chip aktif juga tercermin di dalam picker.
  React.useEffect(() => {
    if (!buka) setLokal(dariUrl());
  }, [buka, dariUrl]);

  const tutupDanTerapkan = useCallback(
    (berikutnya: SelectedRegion[]) => {
      setBuka(false);
      const ser = serializeLocations(berikutnya);
      const draft: Draft = {};
      // Semua level ditulis, termasuk yang kosong, supaya wilayah yang dilepas
      // benar-benar hilang dari URL.
      for (const level of REGION_LEVELS) draft[level] = ser[level] ?? "";
      onTerapkan(draft);
    },
    [onTerapkan]
  );

  React.useEffect(() => {
    if (!buka) return;
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Element;
      if (wadahRef.current?.contains(t)) return;
      // Panel picker di-portal ke body dan menandai dirinya dengan atribut ini.
      if (t.closest?.("[data-search-portal]")) return;
      tutupDanTerapkan(lokal);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [buka, lokal, tutupDanTerapkan]);

  const berisi = ringkas !== null;

  return (
    <div
      ref={wadahRef}
      className="flex h-9 w-[200px] shrink-0 items-center rounded-xl px-3"
      style={berisi ? CHIP_ISI : CHIP_IDLE}
    >
      <LocationPicker
        theme="dark"
        label=""
        value={lokal}
        onChange={setLokal}
        open={buka}
        onOpenChange={(o) => (o ? setBuka(true) : tutupDanTerapkan(lokal))}
      />
    </div>
  );
}

/* ─────────────────────────── Laci filter lengkap ─────────────────────── */

function LaciFilter({
  buka,
  onTutup,
  konteks,
  spString,
  jumlahFilter,
  onTerapkan,
  onReset,
}: {
  buka: boolean;
  onTutup: () => void;
  konteks: KonteksFilter;
  spString: string;
  jumlahFilter: number;
  onTerapkan: (draft: Draft) => void;
  onReset: () => void;
}) {
  // Bidang yang sudah punya trigger cepat di bar (Lokasi/Harga/Kategori/…)
  // tidak diulang di sini — laci ini hanya memuat sisanya. Untuk JUAL ini
  // berarti "dari Kamar Tidur ke bawah": Lokasi/Harga/Kategori/Kamar sudah
  // bisa diisi lewat tombolnya sendiri tanpa membuka laci sama sekali.
  const bidang = bidangUntuk(konteks).filter(
    (b) => !TRIGGER_UTAMA[konteks].includes(b)
  );
  const [draft, setDraft] = useState<Draft>({});
  const [sesi, setSesi] = useState(0);

  // Draft diisi ulang dari URL setiap kali laci dibuka. `sesi` memaksa isian
  // di dalamnya ikut ter-remount, supaya tidak ada kolom yang menyimpan
  // ketikan dari sesi sebelumnya.
  React.useEffect(() => {
    if (!buka) return;
    const awal: Draft = {};
    for (const b of bidang) Object.assign(awal, draftAwal(spString, b));
    setDraft(awal);
    setSesi((s) => s + 1);
    // `bidang` stabil per konteks; sengaja hanya bergantung pada pembukaan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buka, spString, konteks]);

  /** Query pratinjau = URL sekarang, ditimpa draft yang belum diterapkan. */
  const queryPratinjau = useMemo(() => {
    const p = new URLSearchParams(spString);
    for (const [k, v] of Object.entries(draft)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    p.delete("page");
    return p.toString();
  }, [spString, draft]);

  const { data, memuat } = useResultCount(queryPratinjau, buka);

  const labelTombol = () => {
    if (memuat) return "Menghitung…";
    if (data.total === null) return "Terapkan filter";
    if (data.total === 0) return "Tidak ada hasil";
    return `Lihat ${data.total.toLocaleString("id-ID")} properti`;
  };

  const kosong = data.total === 0;

  return (
    <Drawer
      open={buka}
      onClose={onTutup}
      judul="Filter"
      footer={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            disabled={jumlahFilter === 0}
            className={`rounded-xl px-4 py-3 text-[13px] font-bold transition-colors hover:text-white disabled:opacity-40 ${RING_FOKUS}`}
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => onTerapkan(draft)}
            // Hasil nol tidak memblokir tombol: kadang pemakai memang ingin
            // melihat sendiri bahwa kombinasi itu kosong, lalu melonggarkannya
            // dari halaman hasil. Yang penting ia tahu SEBELUM menutup laci.
            className={`flex-1 rounded-xl px-4 py-3 text-[14px] font-bold transition-opacity hover:opacity-90 ${RING_FOKUS}`}
            style={{
              background: kosong ? "rgba(255,255,255,0.1)" : "#6366f1",
              color: kosong ? "rgba(255,255,255,0.55)" : "#fff",
            }}
          >
            {labelTombol()}
          </button>
        </div>
      }
    >
      <div key={sesi} className="space-y-6 pb-2">
        {bidang.map((b) => (
          <IsiPanel
            key={b}
            bidang={b}
            konteks={konteks}
            draft={draft}
            patch={(next) => setDraft((prev) => ({ ...prev, ...next }))}
          />
        ))}
      </div>
    </Drawer>
  );
}
