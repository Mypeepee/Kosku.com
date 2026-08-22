"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import ClosingTabs from "./ClosingTabs.client";
import DatePickerModal from "./DatePickerModal";
import type { Listing, Agent, TeamLeader } from "../page";
import Money from "./ui/Money";
import { Icon } from "@iconify/react";

function safe(s?: string | null) {
  return (s ?? "").trim();
}

function toTitleCase(s: string) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function transaksiLabel(j: Listing["jenis_transaksi"]) {
  const map: Record<Listing["jenis_transaksi"], string> = {
    PRIMARY: "Primary",
    SECONDARY: "Secondary",
    LELANG: "Lelang",
    SEWA: "Sewa",
  };
  return map[j] ?? j;
}

function pickFirstImageUrl(gambar: any): string | null {
  const asUrlFromItem = (it: any): string | null => {
    if (!it) return null;
    if (typeof it === "string") return safe(it) || null;
    if (typeof it === "object") {
      const u = safe(it.url ?? it.src ?? it.imageUrl ?? it.href);
      return u || null;
    }
    return null;
  };

  if (!gambar) return null;

  if (Array.isArray(gambar)) {
    return asUrlFromItem(gambar[0]);
  }

  if (typeof gambar === "object") {
    return asUrlFromItem(gambar);
  }

  const raw = safe(String(gambar));
  if (!raw) return null;

  if (raw.includes(",")) {
    const first = safe(raw.split(",")[0]);
    return first || null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return asUrlFromItem(parsed[0]);
    if (parsed && typeof parsed === "object") return asUrlFromItem(parsed);
  } catch {
    // ignore
  }

  return raw;
}

type Skema = "PERSENTASE" | "SELISIH";

function skemaLabel(k: Skema) {
  return k === "PERSENTASE" ? "Persentase Komisi" : "Selisih Harga";
}

function skemaDesc(k: Skema) {
  return k === "PERSENTASE"
    ? "Hitung komisi berdasarkan persentase dari harga deal/closing."
    : "Hitung komisi dari selisih harga jual vs harga limit/acuannya.";
}

export default function ClosingShell({
  listing,
  agent,
  leader,
  statusTransaksi,
  mouPrefill,
}: {
  listing: Listing;
  agent: Agent | null;
  leader: TeamLeader | null;
  statusTransaksi: string | null;
  mouPrefill?: any;
}) {
  const isClosingMode = mouPrefill?.status === "closing";

  const city = safe(listing.kota) || "-";
  const jenis = transaksiLabel(listing.jenis_transaksi);

  const alamat = safe((listing as any).alamat_lengkap) || "-";
  const judul = safe(listing.judul) || "Detail Closing";

  const defaultAgentName =
    safe((agent as any)?.pengguna?.nama_lengkap) ||
    safe((agent as any)?.nama_kantor) ||
    "-";

  const defaultLeaderName =
    safe((leader as any)?.pengguna?.nama_lengkap) ||
    safe((leader as any)?.nama_kantor) ||
    "-";

  const [agentName, setAgentName] = useState(defaultAgentName);
  const [leaderName, setLeaderName] = useState(defaultLeaderName);

  const [showRiwayat, setShowRiwayat] = useState(false);
  const [riwayatData, setRiwayatData] = useState<any>(null);
  const [riwayatLoading, setRiwayatLoading] = useState(false);

  // Badge hitungan hanya menghitung event atas aset yang sama persis. Lot
  // dengan susunan bidang berbeda (paket/pecahan) tetap muncul di dalam modal,
  // tapi tidak boleh membesarkan angka "sudah dilelang sekian kali".
  const riwayatCount: number =
    riwayatData?.total_sebidang ??
    (Array.isArray(riwayatData?.rows)
      ? riwayatData.rows.filter((r: any) => (r?.cakupan ?? "SAMA") === "SAMA")
          .length
      : 0);

  async function fetchRiwayatData() {
    if (riwayatData) return;
    try {
      setRiwayatLoading(true);
      const res = await fetch(
        `/api/closing/listing/${encodeURIComponent(String((listing as any).id_property))}/auction-history`,
        { cache: "no-store" }
      );
      const json = await res.json();
      setRiwayatData(json);
    } catch {
      setRiwayatData({ rows: [], matchCriteria: null });
    } finally {
      setRiwayatLoading(false);
    }
  }

  async function openRiwayat() {
    setShowRiwayat(true);
    await fetchRiwayatData();
  }

  const priceMain = (listing as any).nilai_limit_lelang ?? listing.harga;

  // Tanggal lelang — editable, dengan state lokal supaya bisa optimistic-update
  const [tanggalLelangRaw, setTanggalLelangRaw] = useState<string | null>(
    (listing as any).tanggal_lelang ?? null
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [savingDate, setSavingDate] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);

  const tanggalLelang = tanggalLelangRaw
    ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" })
        .format(new Date(tanggalLelangRaw))
    : null;

  async function handleSaveTanggalLelang(date: Date) {
    setSavingDate(true);
    setDateError(null);
    const previous = tanggalLelangRaw;
    // Optimistic update
    const iso = date.toISOString();
    setTanggalLelangRaw(iso);
    try {
      const res = await fetch(
        `/api/closing/listing/${encodeURIComponent(String((listing as any).id_property))}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tanggal_lelang: iso }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || `HTTP ${res.status}`);
      }
    } catch (e: any) {
      // Rollback on failure
      setTanggalLelangRaw(previous);
      setDateError(e?.message || "Gagal menyimpan tanggal");
    } finally {
      setSavingDate(false);
    }
  }

  const imgUrl =
    safe((listing as any).imageUrl) ||
    pickFirstImageUrl((listing as any).gambar);

  const isLelang = listing.jenis_transaksi === "LELANG";

  useEffect(() => {
    if (isLelang) fetchRiwayatData();
  }, [isLelang]);

  const skemaOptions: Skema[] = useMemo(
    () => (isLelang ? ["PERSENTASE", "SELISIH"] : ["PERSENTASE"]),
    [isLelang]
  );

  const [skema, setSkema] = useState<Skema>(() => {
    const tipe = mouPrefill?.tipeKomisi?.toUpperCase();
    if (isLelang && tipe === "SELISIH") return "SELISIH";
    return "PERSENTASE";
  });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isClosingMode) return;
    setSkema(skemaOptions[0]);
    setOpen(false);
  }, [skemaOptions, isClosingMode]);

  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 360,
  });

  const computePos = () => {
    const el = btnRef.current;
    if (!el) return;

    const r = el.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const desiredWidth = Math.min(Math.max(Math.round(r.width), 280), 420);
    const safeLeft = Math.max(
      12,
      Math.min(Math.round(r.left), viewportWidth - desiredWidth - 12)
    );

    setPos({
      top: Math.round(r.bottom + 10),
      left: safeLeft,
      width: desiredWidth,
    });
  };

  useEffect(() => {
    if (!open) return;
    computePos();

    const onResize = () => computePos();
    const onScroll = () => computePos();

    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black text-white">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-zinc-950" />
        <div className="absolute -top-40 left-[-220px] h-[520px] w-[520px] rounded-full bg-emerald-500/20" />
        <div className="absolute -top-44 right-[-240px] h-[620px] w-[620px] rounded-full bg-cyan-500/15" />
        <div className="absolute bottom-[-260px] left-[20%] h-[520px] w-[520px] rounded-full bg-emerald-400/10" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/55" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent" />
      </div>

      <div className="mx-auto w-full max-w-[1180px] overflow-hidden px-4 pb-8 pt-1 sm:px-5 sm:pt-2 lg:px-6 lg:pt-3">
        {/* Top bar — desktop only */}
        <div className="hidden lg:flex items-center gap-4">
          {/* Kembali — kiri, selalu visible */}
          <a
            href="/dashboard/transaksi"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-zinc-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white active:scale-[0.98]"
          >
            <Icon icon="solar:arrow-left-linear" className="text-base" />
            <span className="hidden sm:inline">Kembali</span>
          </a>

          {/* Divider */}
          <div className="h-5 w-px shrink-0 bg-white/10" />

          {/* Breadcrumb */}
          <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
            <Icon icon="solar:home-2-linear" className="shrink-0 text-base text-zinc-600" />
            <span className="text-zinc-600">Dashboard</span>
            <Icon icon="solar:alt-arrow-right-linear" className="shrink-0 text-xs text-zinc-700" />
            <span className="text-zinc-500">Closing</span>
            <Icon icon="solar:alt-arrow-right-linear" className="shrink-0 text-xs text-zinc-700" />
            <span className="truncate font-semibold text-zinc-200">
              #{Number(listing.id_property)}
            </span>
          </div>
        </div>

        {/* Hero */}
        <div className="mt-4 rounded-[28px] border border-white/10 bg-white/5 shadow-[0_30px_80px_rgba(0,0,0,0.45)] ">
          <div className="h-[3px] w-full rounded-t-[28px] bg-gradient-to-r from-transparent via-emerald-300/50 to-transparent" />

          <div className="p-4 sm:p-5 lg:p-6">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]">
              {/* LEFT */}
              <div className="min-w-0">
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="relative h-[170px] w-full overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/30 sm:h-[110px] sm:w-[150px] sm:shrink-0">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={alamat || judul}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const img = e.currentTarget as HTMLImageElement;
                          img.onerror = null;
                          img.src =
                            "data:image/svg+xml;charset=utf-8," +
                            encodeURIComponent(
                              `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180"><rect width="100%" height="100%" fill="#0b0f0e"/><text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-family="Arial" font-size="14">No Image</text></svg>`
                            );
                        }}
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-zinc-400">
                        <Icon icon="solar:gallery-linear" className="text-2xl" />
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950/70 via-transparent to-transparent" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-100">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300/90 shadow-[0_0_10px_rgba(16,185,129,0.85)]" />
                        Ready for Closing
                      </span>

                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-zinc-200">
                        <Icon icon="solar:tag-linear" className="text-sm" />
                        {jenis}
                      </span>

                      {isLelang && (
                        <button
                          type="button"
                          onClick={openRiwayat}
                          className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-[11px] font-semibold text-red-300 transition hover:bg-red-500/15 active:scale-[0.97]"
                        >
                          <Icon icon="solar:history-bold-duotone" className="text-sm" />
                          Riwayat Lelang
                          {riwayatCount > 0 && (
                            <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-[0_0_8px_rgba(239,68,68,0.5)]">
                              {riwayatCount}
                            </span>
                          )}
                        </button>
                      )}
                    </div>

                    <div className="mt-3 break-words text-[16px] font-semibold leading-snug text-white sm:text-[19px] lg:text-[21px]">
                      {alamat !== "-" ? (
                        alamat
                      ) : (
                        <span className="text-zinc-400">Alamat belum tersedia</span>
                      )}
                    </div>

                    <div className="mt-1 break-words text-sm leading-relaxed text-zinc-400">
                      {judul}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-400">
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <Icon
                          icon="solar:user-rounded-linear"
                          className="shrink-0 text-sm"
                        />
                        <span className="truncate">
                          Agent:{" "}
                          <span className="font-semibold text-zinc-200">
                            {agentName}
                          </span>
                        </span>
                      </span>

                      <span className="hidden sm:inline text-zinc-600">•</span>

                      <span className="inline-flex min-w-0 items-center gap-2">
                        <Icon
                          icon="solar:users-group-rounded-linear"
                          className="shrink-0 text-sm"
                        />
                        <span className="truncate">
                          TL:{" "}
                          <span className="font-semibold text-zinc-200">
                            {leaderName}
                          </span>
                        </span>
                      </span>
                    </div>

                    <div className="mt-4 w-full max-w-[620px]">
                      <div className="mb-1 text-[11px] text-zinc-400">
                        Skema Penjualan
                      </div>

                      <button
                        ref={btnRef}
                        type="button"
                        onClick={() => {
                          if (skemaOptions.length === 1 || isClosingMode) return;
                          setOpen((v) => !v);
                        }}
                        className={[
                          "group relative flex w-full items-center justify-between gap-3 rounded-full border px-4 py-3 text-sm font-semibold",
                          "border-emerald-400/25 bg-gradient-to-r from-emerald-500/12 via-white/5 to-cyan-500/12 text-white",
                          " transition hover:border-emerald-300/45",
                          "shadow-[0_12px_40px_rgba(0,0,0,0.45)]",
                          skemaOptions.length === 1 || isClosingMode
                            ? "cursor-default"
                            : "cursor-pointer",
                        ].join(" ")}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.85)]" />
                          <span className="shrink-0 text-zinc-200">Skema:</span>
                          <span className="truncate text-white">
                            {skemaLabel(skema)}
                          </span>
                        </div>

                        {skemaOptions.length > 1 ? (
                          <Icon
                            icon="solar:alt-arrow-down-linear"
                            className={[
                              "shrink-0 text-lg text-zinc-300 transition-transform",
                              open ? "rotate-180" : "",
                            ].join(" ")}
                          />
                        ) : (
                          <span className="shrink-0 text-[11px] text-zinc-400">
                            default
                          </span>
                        )}
                      </button>
                    </div>

                    {open &&
                      typeof document !== "undefined" &&
                      createPortal(
                        <div className="fixed inset-0 z-[9999]">
                          <button
                            type="button"
                            className="absolute inset-0 cursor-default"
                            onClick={() => setOpen(false)}
                            aria-label="Close dropdown"
                          />

                          <div
                            className="absolute"
                            style={{
                              top: pos.top,
                              left: pos.left,
                              width: pos.width,
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-[0_28px_90px_rgba(0,0,0,0.75)]">
                              <div className="p-2">
                                {skemaOptions.map((k) => {
                                  const active = k === skema;
                                  return (
                                    <button
                                      key={k}
                                      type="button"
                                      onClick={() => {
                                        setSkema(k);
                                        setOpen(false);
                                      }}
                                      className={[
                                        "w-full rounded-2xl border px-3 py-3 text-left transition",
                                        active
                                          ? "border-emerald-400/20 bg-gradient-to-r from-emerald-500/18 via-emerald-500/10 to-cyan-500/12"
                                          : "border-transparent hover:bg-white/5",
                                      ].join(" ")}
                                    >
                                      <div className="flex items-start gap-3">
                                        <span
                                          className={[
                                            "mt-1.5 h-2.5 w-2.5 rounded-full",
                                            active
                                              ? "bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.95)]"
                                              : "bg-zinc-600",
                                          ].join(" ")}
                                        />
                                        <div className="min-w-0 flex-1">
                                          <div
                                            className={[
                                              "flex items-center justify-between gap-3",
                                              active
                                                ? "text-emerald-100"
                                                : "text-zinc-100",
                                            ].join(" ")}
                                          >
                                            <div className="text-base font-semibold">
                                              {skemaLabel(k)}
                                            </div>
                                            {active ? (
                                              <Icon
                                                icon="solar:check-circle-linear"
                                                className="text-2xl text-emerald-200"
                                              />
                                            ) : null}
                                          </div>
                                          <div className="mt-1 text-[12px] text-zinc-400">
                                            {skemaDesc(k)}
                                          </div>
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>,
                        document.body
                      )}
                  </div>
                </div>
              </div>

              {/* RIGHT */}
              <div className="min-w-0">
                <div className="relative overflow-hidden rounded-[26px] border border-emerald-400/15 bg-gradient-to-br from-emerald-500/12 via-white/5 to-cyan-500/10 p-4 sm:p-5">
                  <div className="pointer-events-none absolute -top-16 -right-20 h-56 w-56 rounded-full bg-emerald-400/20" />
                  <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-cyan-400/15" />
                  <div className="pointer-events-none absolute inset-0 bg-zinc-950/20" />

                  <div className="relative">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs text-zinc-300/80">Harga acuan</div>
                        <div className="mt-1 break-words text-[22px] font-semibold tracking-tight text-white sm:text-[28px] sm:leading-none xl:text-[32px]">
                          <Money value={priceMain} />
                        </div>
                      </div>

                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 text-emerald-100">
                        <Icon
                          icon="solar:wallet-money-linear"
                          className="text-2xl"
                        />
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setShowDatePicker(true)}
                        aria-label="Ubah tanggal lelang"
                        className="group relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/20 p-3 text-left transition-all duration-300 hover:-translate-y-[1px] hover:border-emerald-400/30 hover:bg-emerald-500/[0.06] hover:shadow-[0_8px_24px_-12px_rgba(16,185,129,0.5)]"
                      >
                        {/* Subtle hover shine */}
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent opacity-0 transition-all duration-700 ease-out group-hover:left-[120%] group-hover:opacity-100"
                        />
                        <div className="relative flex items-center justify-between gap-2">
                          <div className="text-[11px] text-zinc-300/70">Tanggal Lelang</div>
                          <Icon
                            icon={
                              savingDate
                                ? "solar:refresh-bold"
                                : "solar:pen-2-bold-duotone"
                            }
                            className={`text-[12px] text-emerald-300/60 transition group-hover:text-emerald-200 ${
                              savingDate ? "animate-spin" : ""
                            }`}
                          />
                        </div>
                        <div className="relative mt-1 truncate text-sm font-semibold text-white">
                          {tanggalLelang ?? "Pilih tanggal"}
                        </div>
                        {dateError && (
                          <div className="relative mt-1 truncate text-[10px] font-medium text-rose-300">
                            {dateError}
                          </div>
                        )}
                      </button>

                      <div className="rounded-2xl border border-white/10 bg-zinc-950/20 p-3">
                        <div className="text-[11px] text-zinc-300/70">Lokasi</div>
                        <div className="mt-1 truncate text-sm font-semibold text-white">
                          {toTitleCase(city)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <ClosingTabs
            listing={listing}
            agent={agent}
            leader={leader}
            skemaPenjualan={skema}
            statusTransaksi={statusTransaksi}
            mouPrefill={mouPrefill}
            isClosingMode={isClosingMode}
            onAgentChange={(name) => setAgentName(name || "-")}
            onLeaderChange={(name) => setLeaderName(name || "-")}
          />
        </div>
      </div>

      {/* ── Date Picker Modal ── */}
      <DatePickerModal
        open={showDatePicker}
        initial={tanggalLelangRaw ? new Date(tanggalLelangRaw) : null}
        title="Ubah Tanggal Lelang"
        syncLabels={["Tanggal Lelang", "MOU", "Transaksi"]}
        onClose={() => setShowDatePicker(false)}
        onSelect={handleSaveTanggalLelang}
      />

      {/* ── Riwayat Lelang Modal ── */}
      {showRiwayat &&
        typeof document !== "undefined" &&
        createPortal(
          <RiwayatLelangModal
            rows={riwayatData?.rows ?? []}
            currentId={String((listing as any).id_property)}
            loading={riwayatLoading}
            matchCriteria={riwayatData?.matchCriteria ?? null}
            onClose={() => setShowRiwayat(false)}
          />,
          document.body
        )}
    </div>
  );
}

/* ================================================================
   Riwayat Lelang Modal
================================================================ */
type RiwayatRow = {
  id_property: string;
  tanggal_lelang: string | null;
  tanggal_dibuat: string | null;
  nilai_limit_lelang: string | null;
  uang_jaminan: string | null;
  agent_nama: string;
  link: string | null;
  imageUrl?: string;
  gambar_list?: string[];
  kelurahan?: string | null;
  kecamatan?: string | null;
  kota?: string | null;
  legalitas?: string | null;
  nomor_legalitas?: string | null;
  /** Nomor sertifikat ternormalisasi — satu lot bisa memuat banyak bidang. */
  nomor_legalitas_list?: string[];
  /**
   * Hubungan susunan bidang lot ini terhadap listing yang dibuka. Selain
   * "SAMA", nilai limitnya TIDAK sebanding (paket vs pecahan) — lihat
   * @/lib/auctionHistory. Absen = respons lama, diperlakukan sebagai "SAMA".
   */
  cakupan?: "SAMA" | "SEBAGIAN" | "LEBIH_LUAS" | "BERIRISAN";
  alamat_lengkap?: string | null;
};

/** Label lot yang susunan bidangnya berbeda dari aset yang sedang dibuka. */
const CAKUPAN_LABEL: Record<string, string> = {
  SEBAGIAN: "Sebagian bidang",
  LEBIH_LUAS: "Paket lebih besar",
  BERIRISAN: "Susunan bidang beda",
};

type MatchCriteria = {
  wilayah_level?: "kelurahan" | "kecamatan" | "kota";
  kelurahan?: string | null;
  kecamatan?: string | null;
  kota?: string | null;
  legalitas: string | null;
  nomor_legalitas: string | null;
  nomor_normal?: string[];
} | null;

const PLACEHOLDER_SVG =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180"><rect width="100%" height="100%" fill="#0d1014"/><text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" fill="#374151" font-family="Arial" font-size="13">No Image</text></svg>`
  );

function RiwayatLelangModal({
  rows,
  currentId,
  loading,
  matchCriteria,
  onClose,
}: {
  rows: RiwayatRow[];
  currentId: string;
  loading: boolean;
  matchCriteria: MatchCriteria;
  onClose: () => void;
}) {
  const fmt = new Intl.NumberFormat("id-ID");
  const fmtRp = (v: string | null) => {
    if (!v) return "-";
    const n = Number(v);
    return Number.isFinite(n) ? "Rp " + fmt.format(n) : "-";
  };
  const fmtDate = (d: string | null) => {
    if (!d) return "Tanggal belum ditentukan";
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric", month: "long", year: "numeric",
    }).format(new Date(d));
  };

  const legalitasLabel: Record<string, string> = {
    SHM: "SHM", HGB: "HGB", HGU: "HGU", HP: "HP",
    STRATA_TITLE: "Strata Title", PPJB: "PPJB", AJB: "AJB", LAINNYA: "Lainnya",
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-end justify-center sm:items-center p-0 sm:p-4">
      {/* overlay */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md"
        onClick={onClose}
      />

      {/* sheet / card */}
      <div
        className="relative z-10 flex w-full flex-col overflow-hidden rounded-t-[28px] sm:rounded-[28px] sm:max-w-[560px]"
        style={{
          maxHeight: "92dvh",
          background: "linear-gradient(160deg, #0e1318 0%, #0a0d10 100%)",
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.06), 0 -4px 60px rgba(0,0,0,0.6), 0 60px 120px rgba(0,0,0,0.85)",
        }}
      >
        {/* drag handle — mobile */}
        <div className="flex shrink-0 justify-center pt-3 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-white/[0.12]" />
        </div>

        {/* amber accent line */}
        <div className="h-[1.5px] w-full shrink-0 bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />

        {/* header */}
        <div className="flex shrink-0 items-center gap-3 px-5 pt-4 pb-3">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-amber-500/10 ring-1 ring-amber-500/25 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-400/10 to-transparent" />
            <Icon icon="solar:history-bold-duotone" className="relative text-2xl text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-bold tracking-tight text-white">Riwayat Lelang</div>
            <div className="text-[11px] text-zinc-500">
              {loading
                ? "Memuat..."
                : (() => {
                    // Lot dengan susunan bidang berbeda tetap ditampilkan, tapi
                    // tidak boleh ikut dihitung sebagai "penawaran atas aset ini".
                    const sebidang = rows.filter(
                      (r) => (r.cakupan ?? "SAMA") === "SAMA"
                    ).length;
                    const terkait = rows.length - sebidang;
                    return `${sebidang} penawaran tercatat pada aset yang sama${
                      terkait > 0 ? ` · ${terkait} lot terkait` : ""
                    }`;
                  })()}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-zinc-500 transition hover:bg-white/10 hover:text-white active:scale-95"
          >
            <Icon icon="solar:close-circle-bold-duotone" className="text-lg" />
          </button>
        </div>

        {/* criteria pill */}
        {matchCriteria && !loading && (
          <div className="mx-5 mb-3 flex flex-wrap gap-1.5">
            {(() => {
              const wilayah = [
                matchCriteria.kelurahan,
                matchCriteria.kecamatan,
                matchCriteria.kota,
              ]
                .filter(Boolean)
                .join(", ");
              return wilayah ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-zinc-400">
                  <Icon icon="solar:map-point-linear" className="text-[11px] text-zinc-500" />
                  {wilayah}
                </span>
              ) : null;
            })()}
            {matchCriteria.legalitas && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-zinc-400">
                <Icon icon="solar:document-linear" className="text-[11px] text-zinc-500" />
                {legalitasLabel[matchCriteria.legalitas] ?? matchCriteria.legalitas}
              </span>
            )}
            {matchCriteria.nomor_legalitas && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-zinc-400">
                <Icon icon="solar:hashtag-circle-linear" className="text-[11px] text-zinc-500" />
                No.&nbsp;{matchCriteria.nomor_legalitas}
              </span>
            )}
          </div>
        )}

        {/* divider */}
        <div className="mx-5 h-px shrink-0 bg-white/[0.05]" />

        {/* scrollable content */}
        <div
          className="min-h-0 flex-1 overflow-y-auto px-5 py-4"
          style={{ scrollbarWidth: "none" }}
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-4 py-20">
              <div className="relative h-12 w-12">
                <div className="absolute inset-0 animate-spin rounded-full border-2 border-amber-500/20 border-t-amber-400" />
                <div className="absolute inset-2 rounded-full bg-amber-400/10" />
              </div>
              <span className="text-[12px] text-zinc-600">Menelusuri riwayat aset...</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.03] ring-1 ring-white/[0.06]">
                <Icon icon="solar:history-bold-duotone" className="text-3xl text-zinc-700" />
              </div>
              <div>
                <div className="text-sm font-semibold text-zinc-400">Tidak ada riwayat lelang</div>
                <div className="mt-1 text-[12px] text-zinc-600 leading-relaxed max-w-[240px]">
                  Properti ini belum pernah ditawarkan pada lelang sebelumnya.
                </div>
              </div>
            </div>
          ) : (
            <div className="relative">
              {/* timeline spine */}
              <div className="absolute left-[21px] top-6 bottom-6 w-px bg-gradient-to-b from-transparent via-white/[0.07] to-transparent" />

              <div className="space-y-3">
                {rows.map((row, idx) => {
                  const isCurrent = row.id_property === currentId;
                  const attempt = idx + 1;
                  const cakupanLabel =
                    CAKUPAN_LABEL[row.cakupan ?? "SAMA"] ?? null;
                  const imgSrc = row.imageUrl && row.imageUrl !== "/placeholder.jpg"
                    ? row.imageUrl
                    : null;
                  const dateLabel = fmtDate(row.tanggal_lelang ?? row.tanggal_dibuat ?? null);

                  return (
                    <div key={row.id_property} className="relative flex gap-3.5">
                      {/* timeline dot */}
                      <div
                        className={[
                          "relative z-10 mt-[18px] flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full text-[13px] font-black tracking-tight",
                          isCurrent
                            ? "bg-gradient-to-br from-amber-400 to-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.45),0_0_0_1px_rgba(245,158,11,0.35)]"
                            : "bg-[#14191f] text-zinc-500 ring-1 ring-white/[0.07]",
                        ].join(" ")}
                      >
                        {attempt}
                      </div>

                      {/* card */}
                      <div
                        className={[
                          "min-w-0 flex-1 overflow-hidden rounded-[20px] transition-all",
                          isCurrent
                            ? "bg-gradient-to-br from-amber-500/[0.10] via-amber-500/[0.06] to-amber-400/[0.04] ring-1 ring-amber-500/[0.22]"
                            : "bg-white/[0.03] ring-1 ring-white/[0.06] hover:bg-white/[0.05]",
                        ].join(" ")}
                      >
                        {/* image strip */}
                        <div className="relative h-[120px] w-full overflow-hidden">
                          {imgSrc ? (
                            <img
                              src={imgSrc}
                              alt={row.alamat_lengkap ?? `Lelang #${row.id_property}`}
                              className="h-full w-full object-cover"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                const img = e.currentTarget as HTMLImageElement;
                                img.onerror = null;
                                img.src = PLACEHOLDER_SVG;
                              }}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-zinc-900/60">
                              <Icon icon="solar:gallery-minimalistic-linear" className="text-3xl text-zinc-700" />
                            </div>
                          )}
                          {/* gradient overlay */}
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                          {/* badges over image */}
                          <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
                            <span
                              className={[
                                "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]",
                                isCurrent
                                  ? "bg-amber-400 text-black"
                                  : "bg-black/60 text-zinc-300 ring-1 ring-white/10",
                              ].join(" ")}
                            >
                              Penawaran ke-{attempt}
                            </span>
                            {isCurrent && (
                              <span className="rounded-full bg-amber-500/90 px-2.5 py-0.5 text-[10px] font-bold text-black">
                                ● Saat ini
                              </span>
                            )}
                            {cakupanLabel && (
                              <span
                                className="rounded-full bg-sky-500/85 px-2.5 py-0.5 text-[10px] font-bold text-black"
                                title="Susunan bidangnya berbeda dari aset yang sedang dibuka — nilai limitnya tidak sebanding."
                              >
                                {cakupanLabel}
                              </span>
                            )}
                          </div>

                          {/* link button over image */}
                          {row.link && (
                            <a
                              href={row.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-zinc-300 ring-1 ring-white/10 backdrop-blur-sm transition hover:bg-black/70 hover:text-white"
                            >
                              <Icon icon="solar:link-minimalistic-2-bold" className="text-sm" />
                            </a>
                          )}

                          {/* date over image bottom */}
                          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
                            <div className={[
                              "text-[13px] font-semibold drop-shadow-md",
                              isCurrent ? "text-amber-200" : "text-white",
                            ].join(" ")}>
                              {dateLabel}
                            </div>
                            <span className="rounded-full bg-black/50 px-2 py-0.5 font-mono text-[9px] font-semibold text-zinc-400 ring-1 ring-white/[0.07] backdrop-blur-sm">
                              #{row.id_property}
                            </span>
                          </div>
                        </div>

                        {/* body */}
                        <div className="p-3.5">
                          {/* address */}
                          {row.alamat_lengkap && (
                            <div className="mb-3 flex items-start gap-1.5">
                              <Icon icon="solar:map-point-bold-duotone" className="mt-0.5 shrink-0 text-[13px] text-zinc-600" />
                              <span className="line-clamp-2 text-[12px] leading-snug text-zinc-400">
                                {row.alamat_lengkap}
                              </span>
                            </div>
                          )}

                          {/* stats grid */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className={[
                              "rounded-[14px] px-3 py-2.5",
                              isCurrent ? "bg-amber-500/[0.08] ring-1 ring-amber-500/[0.15]" : "bg-black/25 ring-1 ring-white/[0.04]",
                            ].join(" ")}>
                              <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-600">
                                Nilai Limit
                              </div>
                              <div className={[
                                "mt-1 text-[13px] font-bold tabular-nums leading-none",
                                isCurrent ? "text-amber-300" : "text-zinc-200",
                              ].join(" ")}>
                                {fmtRp(row.nilai_limit_lelang)}
                              </div>
                            </div>
                            <div className="rounded-[14px] bg-black/25 px-3 py-2.5 ring-1 ring-white/[0.04]">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-600">
                                Uang Jaminan
                              </div>
                              <div className="mt-1 text-[13px] font-bold tabular-nums leading-none text-zinc-200">
                                {fmtRp(row.uang_jaminan)}
                              </div>
                            </div>
                          </div>

                          {/* agent */}
                          <div className="mt-3 flex items-center gap-2 border-t border-white/[0.04] pt-3">
                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.05] ring-1 ring-white/[0.07]">
                              <Icon icon="solar:user-rounded-bold" className="text-[10px] text-zinc-500" />
                            </div>
                            <span className="truncate text-[11px] text-zinc-500">
                              {row.agent_nama}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="shrink-0 px-5 pb-5 pt-3">
          <div className="mb-3 h-px bg-white/[0.04]" />
          <button
            type="button"
            onClick={onClose}
            className="flex h-12 w-full items-center justify-center rounded-[16px] bg-white/[0.05] text-[14px] font-semibold text-zinc-300 ring-1 ring-white/[0.07] transition hover:bg-white/[0.08] hover:text-white active:scale-[0.98]"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}