"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { useSession } from "next-auth/react";
import { isOwnerAtauPemilik } from "@/lib/sessionJabatan";
import ModalAcara from "@/app/dashboard/jadwal-acara/components/modal-acara";

/* ────────────────────────────────────────────────────────────────────
   UpcomingEventsCard — "Agenda 7 Hari Ke Depan"
   Ultra-premium dark-glass card pair to live alongside HotLeadsCard.
   Designed to match the calendar's tone (emerald hairlines, ambient
   orbs, glass + tabular numbers).
   ──────────────────────────────────────────────────────────────────── */

interface EventApi {
  id_acara: string;
  judul_acara: string;
  deskripsi?: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  waktu_mulai?: string;
  waktu_selesai?: string;
  tipe_acara: string;
  lokasi?: string;
  status_acara: string;
  id_property?: string;
  agent?: { id_agent?: string } | null;
  listing?: { judul?: string; alamat_lengkap?: string | null } | null;
}

type EventCategory = {
  label: string;
  icon: string;
  /** Tailwind-compatible HEX used for ring/shadow/gradient stops */
  color: string;
  /** Inline gradient string for the date-pill background */
  gradient: string;
  /** Tailwind classes for the soft chip pill */
  chip: string;
  /** Tailwind class for the left accent bar */
  bar: string;
};

const CATEGORY: Record<string, EventCategory> = {
  BUYER_MEETING: {
    label: "Meeting",
    icon: "solar:users-group-rounded-bold-duotone",
    color: "#38bdf8",
    gradient: "linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)",
    chip: "bg-sky-500/15 text-sky-200 border-sky-400/25",
    bar: "bg-gradient-to-b from-sky-300 via-sky-500 to-sky-700",
  },
  SITE_VISIT: {
    label: "Site Visit",
    icon: "solar:map-point-bold-duotone",
    color: "#a78bfa",
    gradient: "linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)",
    chip: "bg-violet-500/15 text-violet-200 border-violet-400/25",
    bar: "bg-gradient-to-b from-violet-300 via-violet-500 to-violet-700",
  },
  CLOSING: {
    label: "Closing",
    icon: "solar:check-circle-bold-duotone",
    color: "#34d399",
    gradient: "linear-gradient(135deg, #34d399 0%, #047857 100%)",
    chip: "bg-emerald-500/15 text-emerald-200 border-emerald-400/25",
    bar: "bg-gradient-to-b from-emerald-300 via-emerald-500 to-emerald-700",
  },
  FOLLOW_UP: {
    label: "Follow Up",
    icon: "solar:phone-calling-bold-duotone",
    color: "#fbbf24",
    gradient: "linear-gradient(135deg, #fbbf24 0%, #d97706 100%)",
    chip: "bg-amber-500/15 text-amber-200 border-amber-400/25",
    bar: "bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700",
  },
  OPEN_HOUSE: {
    label: "Open House",
    icon: "solar:buildings-3-bold-duotone",
    color: "#f472b6",
    gradient: "linear-gradient(135deg, #f472b6 0%, #db2777 100%)",
    chip: "bg-pink-500/15 text-pink-200 border-pink-400/25",
    bar: "bg-gradient-to-b from-pink-300 via-pink-500 to-pink-700",
  },
  INTERNAL_MEETING: {
    label: "Internal",
    icon: "solar:case-round-bold-duotone",
    color: "#818cf8",
    gradient: "linear-gradient(135deg, #818cf8 0%, #4f46e5 100%)",
    chip: "bg-indigo-500/15 text-indigo-200 border-indigo-400/25",
    bar: "bg-gradient-to-b from-indigo-300 via-indigo-500 to-indigo-700",
  },
  TRAINING: {
    label: "Training",
    icon: "solar:book-bookmark-bold-duotone",
    color: "#fb923c",
    gradient: "linear-gradient(135deg, #fb923c 0%, #c2410c 100%)",
    chip: "bg-orange-500/15 text-orange-200 border-orange-400/25",
    bar: "bg-gradient-to-b from-orange-300 via-orange-500 to-orange-700",
  },
  PEMILU: {
    label: "Pemilu",
    icon: "solar:flag-bold-duotone",
    color: "#f87171",
    gradient: "linear-gradient(135deg, #f87171 0%, #b91c1c 100%)",
    chip: "bg-rose-500/15 text-rose-200 border-rose-400/25",
    bar: "bg-gradient-to-b from-rose-300 via-rose-500 to-rose-700",
  },
  LAINNYA: {
    label: "Lainnya",
    icon: "solar:star-bold-duotone",
    color: "#94a3b8",
    gradient: "linear-gradient(135deg, #94a3b8 0%, #475569 100%)",
    chip: "bg-slate-500/15 text-slate-200 border-slate-400/25",
    bar: "bg-gradient-to-b from-slate-300 via-slate-500 to-slate-700",
  },
};

const MONTH_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
const DAY_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function endOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(23, 59, 59, 999);
  return c;
}

function parseEventStart(ev: EventApi): Date {
  // tanggal_mulai is an ISO date string. If waktu_mulai is present,
  // try to merge — supporting both full ISO and "HH:mm" string.
  const base = new Date(ev.tanggal_mulai);
  if (!ev.waktu_mulai) return base;

  // Full datetime?
  const asDate = new Date(ev.waktu_mulai);
  if (!Number.isNaN(asDate.getTime()) && ev.waktu_mulai.includes("T")) {
    return asDate;
  }

  // HH:mm form
  const m = ev.waktu_mulai.match(/^(\d{1,2}):(\d{2})/);
  if (m) {
    base.setHours(Number(m[1]), Number(m[2]), 0, 0);
  }
  return base;
}

function parseEventEnd(ev: EventApi, start: Date): Date {
  // Prefer tanggal_selesai (sudah merged dengan jam oleh ModalAcara.buildDateTime).
  const base = new Date(ev.tanggal_selesai || ev.tanggal_mulai);
  if (Number.isNaN(base.getTime())) return endOfDay(start);

  // Legacy: waktu_selesai dipisah sebagai field sendiri.
  if (ev.waktu_selesai) {
    const asDate = new Date(ev.waktu_selesai);
    if (!Number.isNaN(asDate.getTime()) && ev.waktu_selesai.includes("T")) {
      return asDate;
    }
    const m = ev.waktu_selesai.match(/^(\d{1,2}):(\d{2})/);
    if (m) {
      const merged = new Date(base);
      merged.setHours(Number(m[1]), Number(m[2]), 0, 0);
      return merged;
    }
  }
  return base;
}

function formatTimeRaw(raw?: string): string | null {
  if (!raw) return null;
  if (raw.includes("T")) {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  const m = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

function parseTimeAsMinutes(raw?: string): number | null {
  const formatted = formatTimeRaw(raw);
  if (!formatted) return null;
  const [h, m] = formatted.split(":").map(Number);
  return h * 60 + m;
}

/** "1j 50m" / "45m" / "2j" — compact Indonesian duration. */
function formatDuration(startMin: number, endMin: number): string | null {
  let diff = endMin - startMin;
  if (diff <= 0) diff += 24 * 60; // event ends next day (rare)
  if (diff <= 0) return null;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}j`;
  return `${h}j ${m}m`;
}

function dayDelta(target: Date, base: Date): number {
  const a = startOfDay(target).getTime();
  const b = startOfDay(base).getTime();
  return Math.round((a - b) / (24 * 60 * 60 * 1000));
}

function relativeDayLabel(start: Date, now: Date): string {
  const delta = dayDelta(start, now);
  if (delta === 0) return "Hari ini";
  if (delta === 1) return "Besok";
  if (delta === 2) return "Lusa";
  return DAY_ID[start.getDay()];
}

function getCategory(raw: string): EventCategory {
  return CATEGORY[raw] ?? CATEGORY.LAINNYA;
}

interface EnrichedEvent {
  raw: EventApi;
  start: Date;
  end: Date;
  /** Formatted jam mulai, e.g. "10:10" */
  time: string | null;
  /** Formatted jam selesai, e.g. "11:00" */
  endTime: string | null;
  /** Compact duration string, e.g. "1j 50m" */
  duration: string | null;
  cat: EventCategory;
  delta: number;
  /** Now di antara start dan end — event sedang berlangsung. */
  isLive: boolean;
  /** Persen progres event saat live, 0..1. Untuk live progress bar. */
  progress: number;
  /** Whole-day event (user tidak set jam). Filter out di end of day. */
  isWholeDay: boolean;
}

export function UpcomingEventsCard() {
  const { data: session } = useSession();
  const [events, setEvents] = useState<EventApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());
  // Bump to force a refetch — used by the `acara:changed` window event so
  // adding/editing an event in the modal updates this card immediately.
  const [refreshTick, setRefreshTick] = useState(0);

  // ModalAcara state — clicking an agenda row opens the same edit/view modal
  // the calendar uses, prefilled with that event's data.
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"edit" | "view">("view");
  const [modalEvent, setModalEvent] = useState<EventApi | null>(null);

  const openEvent = (ev: EventApi) => {
    // Wewenang dibaca dari `jabatan` (@/lib/sessionJabatan) — dulu dari
    // `session.user.role` yang isinya USER|AGENT, jadi cabang OWNER-nya tidak
    // pernah aktif dan owner selalu jatuh ke mode "lihat saja".
    const canEdit = isOwnerAtauPemilik(session?.user, ev.agent?.id_agent);
    setModalEvent(ev);
    setModalMode(canEdit ? "edit" : "view");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalEvent(null);
  };

  // Re-tick relative labels & "live" detection. Tiap 20 detik supaya
  // event yang baru selesai cepat menghilang (resolusi maksimum ~20s),
  // dan progress bar live event terlihat hidup.
  useEffect(() => {
    const intv = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(intv);
  }, []);

  // Live refresh when the event modal saves anywhere on the page.
  useEffect(() => {
    const onChanged = () => setRefreshTick((t) => t + 1);
    window.addEventListener("acara:changed", onChanged);
    return () => window.removeEventListener("acara:changed", onChanged);
  }, []);

  // Fetch current month + next month (window may straddle month edge).
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const today = new Date();
        const y1 = today.getFullYear();
        const m1 = today.getMonth() + 1;
        const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        const y2 = next.getFullYear();
        const m2 = next.getMonth() + 1;

        const [r1, r2] = await Promise.all([
          fetch(`/api/dashboard/acara?year=${y1}&month=${m1}`, { cache: "no-store" }),
          fetch(`/api/dashboard/acara?year=${y2}&month=${m2}`, { cache: "no-store" }),
        ]);
        const [a, b] = await Promise.all([
          r1.ok ? r1.json() : [],
          r2.ok ? r2.json() : [],
        ]);
        if (!alive) return;
        const merged: EventApi[] = [
          ...(Array.isArray(a) ? a : []),
          ...(Array.isArray(b) ? b : []),
        ];
        // de-dup defensively by id
        const seen = new Set<string>();
        const unique = merged.filter((e) => {
          if (seen.has(e.id_acara)) return false;
          seen.add(e.id_acara);
          return true;
        });
        setEvents(unique);
        setError(null);
      } catch (e) {
        if (!alive) return;
        setError(String(e));
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [refreshTick]);

  const enriched: EnrichedEvent[] = useMemo(() => {
    const today0 = startOfDay(now);
    const windowEnd = endOfDay(new Date(today0.getTime() + 6 * 24 * 60 * 60 * 1000));

    return events
      .map((ev): EnrichedEvent | null => {
        const start = parseEventStart(ev);
        if (Number.isNaN(start.getTime())) return null;
        if (start > windowEnd) return null;

        const cat = getCategory(ev.tipe_acara);

        // Time is merged into `tanggal_mulai` / `tanggal_selesai` as a full ISO
        // datetime by ModalAcara (buildDateTime). Read it from there. Fallback
        // to the legacy separate `waktu_*` fields if a future caller uses them.
        const rawStart = ev.waktu_mulai ?? ev.tanggal_mulai;
        const rawEnd = ev.waktu_selesai ?? ev.tanggal_selesai;
        let time = formatTimeRaw(rawStart);
        let endTime = formatTimeRaw(rawEnd);

        const startMin = parseTimeAsMinutes(rawStart);
        const endMin = parseTimeAsMinutes(rawEnd);

        // Heuristic: if both timestamps are exactly midnight AND the duration
        // is zero, the user did not pick a time — treat as whole-day event.
        const isWholeDay =
          time === "00:00" && endTime === "00:00" && startMin === endMin;
        if (isWholeDay) {
          time = null;
          endTime = null;
        }

        const duration =
          time && startMin !== null && endMin !== null
            ? formatDuration(startMin, endMin)
            : null;

        // Effective end: untuk whole-day pakai akhir hari, selainnya pakai
        // tanggal_selesai (yang sudah merged dengan jam).
        const parsedEnd = parseEventEnd(ev, start);
        const end = isWholeDay ? endOfDay(start) : parsedEnd;

        // Auto-hide event yang sudah lewat jamnya — bukan tunggu day+1.
        if (end.getTime() <= now.getTime()) return null;

        // Live = now di antara start dan end.
        const nowMs = now.getTime();
        const isLive = nowMs >= start.getTime() && nowMs <= end.getTime();
        const totalMs = end.getTime() - start.getTime();
        const progress =
          isLive && totalMs > 0
            ? Math.max(0, Math.min(1, (nowMs - start.getTime()) / totalMs))
            : 0;

        const delta = dayDelta(start, today0);
        return {
          raw: ev,
          start,
          end,
          time,
          endTime,
          duration,
          cat,
          delta,
          isLive,
          progress,
          isWholeDay,
        };
      })
      .filter((x): x is EnrichedEvent => x !== null)
      .sort((a, b) => {
        // Live events first, lalu sort by start ascending
        if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
        return a.start.getTime() - b.start.getTime();
      });
  }, [events, now]);

  const todayCount = enriched.filter((e) => e.delta === 0).length;
  const totalCount = enriched.length;

  return (
    <div className="relative flex flex-col overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-b from-[#0a0f10] to-[#070a0b] h-full">
      {/* top hairline */}
      <div className="pointer-events-none absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />

      {/* ambient orb */}
      <div
        className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full blur-3xl opacity-50"
        style={{ background: "radial-gradient(circle, rgba(52,211,153,0.30) 0%, transparent 65%)" }}
      />

      {/* ─── Header ─── */}
      <div className="relative flex items-start justify-between gap-2.5 px-4 pt-4 pb-2.5 sm:px-5 sm:pt-5 sm:pb-3 lg:px-6 lg:pt-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <div
            className="relative flex h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-xl sm:rounded-2xl ring-1 ring-emerald-300/25 shadow-[0_10px_28px_-10px_rgba(16,185,129,0.65)]"
            style={{ background: "linear-gradient(135deg, #34d399, #047857)" }}
          >
            <Icon icon="solar:calendar-mark-bold-duotone" className="text-lg sm:text-xl text-white drop-shadow" />
            <div className="pointer-events-none absolute inset-0 rounded-xl sm:rounded-2xl bg-gradient-to-b from-white/30 to-transparent opacity-60" />
            <div className="pointer-events-none absolute inset-1 rounded-lg sm:rounded-xl ring-1 ring-white/15" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm sm:text-base font-bold tracking-tight text-white">Agenda 7 Hari</h3>
            <p className="mt-0.5 truncate text-[10.5px] sm:text-[11px] leading-tight text-slate-500">
              {loading
                ? "Memuat agenda…"
                : totalCount === 0
                ? "Tidak ada agenda mendatang"
                : todayCount > 0
                ? `${todayCount} hari ini · ${totalCount} dalam seminggu`
                : `${totalCount} agenda mendatang`}
            </p>
          </div>
        </div>

        {!loading && totalCount > 0 && (
          <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg sm:rounded-xl border border-emerald-400/25 bg-emerald-500/[0.08] px-2 py-1 sm:px-2.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-200">
            <Icon icon="solar:calendar-date-bold-duotone" className="text-[11px] sm:text-[12px]" />
            {totalCount}
          </span>
        )}
      </div>

      {/* Day strip — mini horizontal 7-day overview */}
      <div className="relative mx-4 sm:mx-5 lg:mx-6 mb-2.5 sm:mb-3 grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }).map((_, i) => {
          const d = new Date(startOfDay(now).getTime() + i * 24 * 60 * 60 * 1000);
          const cnt = enriched.filter((e) => dayDelta(e.start, d) === 0).length;
          const isToday = i === 0;
          return (
            <div
              key={i}
              className={[
                "relative flex flex-col items-center justify-center rounded-lg sm:rounded-xl border px-0.5 py-1 sm:py-1.5 transition",
                isToday
                  ? "border-emerald-400/40 bg-emerald-500/[0.1]"
                  : cnt > 0
                  ? "border-white/[0.08] bg-white/[0.03]"
                  : "border-white/[0.04] bg-transparent",
              ].join(" ")}
            >
              <span
                className={[
                  "text-[8.5px] sm:text-[9px] font-bold uppercase tracking-widest",
                  isToday ? "text-emerald-300" : "text-slate-500",
                ].join(" ")}
              >
                {DAY_ID[d.getDay()]}
              </span>
              <span
                className={[
                  "text-[12px] sm:text-[13px] font-extrabold tabular-nums leading-none mt-0.5",
                  isToday ? "text-emerald-100" : "text-white/90",
                ].join(" ")}
              >
                {d.getDate()}
              </span>
              {cnt > 0 && (
                <span
                  className={[
                    "mt-0.5 sm:mt-1 inline-flex h-1 w-1 rounded-full",
                    isToday ? "bg-emerald-300 shadow-[0_0_6px_rgba(52,211,153,0.8)]" : "bg-emerald-400/70",
                  ].join(" ")}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ─── List ─── */}
      <div className="relative flex-1 min-h-0 space-y-2 overflow-y-auto px-2.5 pb-3 sm:px-3 sm:pb-4 lg:px-4 max-h-[360px] lg:max-h-none">
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.015] p-3"
              >
                <div className="h-14 w-12 shrink-0 animate-pulse rounded-xl bg-white/[0.05]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-3/4 animate-pulse rounded bg-white/[0.06]" />
                  <div className="h-2 w-1/2 animate-pulse rounded bg-white/[0.04]" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center py-8 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-rose-400/20 bg-rose-500/10">
              <Icon icon="solar:danger-triangle-bold-duotone" className="text-2xl text-rose-300" />
            </div>
            <p className="mt-3 text-sm font-semibold text-rose-200">Gagal memuat agenda</p>
            <p className="mt-1 text-[11px] text-slate-500">Coba refresh halaman</p>
          </div>
        ) : enriched.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-10 text-center">
            <div className="relative grid h-14 w-14 place-items-center rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06]">
              <span className="pointer-events-none absolute inset-0 rounded-2xl bg-emerald-500/[0.08] blur-md" />
              <Icon icon="solar:calendar-bold-duotone" className="relative text-3xl text-emerald-300/80" />
            </div>
            <p className="mt-3 text-sm font-semibold text-white">Jadwal kamu lega</p>
            <p className="mt-1 max-w-[240px] text-[11px] text-slate-500">
              Belum ada agenda terjadwal dalam 7 hari ke depan.
            </p>
          </div>
        ) : (
          enriched.map((ev) => {
            const { cat, start, time, endTime, duration, delta, isLive, progress } = ev;
            const relLabel = relativeDayLabel(start, now);
            const accent = isLive
              ? "border-transparent bg-gradient-to-br from-emerald-500/[0.16] via-emerald-500/[0.04] to-transparent shadow-[0_14px_44px_-18px_rgba(52,211,153,0.85)]"
              : delta === 0
                ? "border-emerald-400/30 bg-gradient-to-br from-emerald-500/[0.07] via-transparent to-transparent shadow-[0_8px_24px_-16px_rgba(52,211,153,0.45)]"
                : delta === 1
                  ? "border-sky-400/20 bg-gradient-to-br from-sky-500/[0.05] via-transparent to-transparent"
                  : "border-white/[0.06] bg-white/[0.015]";

            return (
              <article
                key={ev.raw.id_acara}
                role="button"
                tabIndex={0}
                onClick={() => openEvent(ev.raw)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openEvent(ev.raw);
                  }
                }}
                className={`group relative cursor-pointer overflow-hidden rounded-2xl ${
                  isLive ? "" : "border"
                } outline-none backdrop-blur-sm transition hover:-translate-y-[1px] hover:shadow-[0_10px_28px_-14px_rgba(0,0,0,0.6)] focus-visible:ring-2 focus-visible:ring-emerald-400/40 ${accent}`}
              >
                {/* Animated breathing border ring — hanya untuk live event */}
                {isLive && (
                  <>
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-emerald-400/45 [animation:livePulseRing_2.4s_ease-in-out_infinite]"
                    />
                    {/* Scanline texture untuk kesan futuristik */}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 rounded-2xl opacity-[0.06] bg-[repeating-linear-gradient(0deg,transparent_0_2px,rgba(255,255,255,0.6)_2px_3px)]"
                    />
                    {/* Ambient glow di pojok */}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -inset-x-2 -top-4 h-16 blur-2xl opacity-70 bg-[radial-gradient(50%_60%_at_50%_50%,rgba(52,211,153,0.55),transparent_70%)]"
                    />
                  </>
                )}

                {/* Left accent bar — live = emerald glow yang menyala */}
                <span
                  className={`absolute inset-y-0 left-0 w-[3px] ${
                    isLive
                      ? "bg-gradient-to-b from-emerald-200 via-emerald-400 to-teal-500 shadow-[0_0_14px_rgba(52,211,153,0.85)]"
                      : cat.bar
                  }`}
                />

                {/* Catatan: dot pojok kanan sengaja dihilangkan saat live —
                   badge "Sedang Berlangsung" di-inline-kan di chip row sudah
                   menyediakan pulsing indicator, jadi tidak duplikat. */}

                <div className="flex gap-2.5 sm:gap-3 p-2.5 sm:p-3 pl-3 sm:pl-4 pr-3 sm:pr-4">
                  {/* Date pill */}
                  <div
                    className="relative flex h-12 w-11 sm:h-14 sm:w-12 flex-shrink-0 flex-col items-center justify-center rounded-lg sm:rounded-xl text-white shadow-[0_6px_18px_-8px_rgba(0,0,0,0.6)]"
                    style={{ background: cat.gradient }}
                  >
                    <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest opacity-90">
                      {MONTH_ID[start.getMonth()]}
                    </span>
                    <span className="text-base sm:text-lg font-extrabold leading-none tabular-nums">
                      {start.getDate()}
                    </span>
                    <span className="mt-0.5 text-[7.5px] sm:text-[8px] font-bold uppercase tracking-widest opacity-80">
                      {DAY_ID[start.getDay()]}
                    </span>
                    {/* glass overlay */}
                    <div className="pointer-events-none absolute inset-0 rounded-lg sm:rounded-xl bg-gradient-to-b from-white/25 to-transparent opacity-50" />
                    <div className="pointer-events-none absolute inset-[2px] rounded-[8px] sm:rounded-[10px] ring-1 ring-white/15" />
                  </div>

                  {/* Body */}
                  <div className="min-w-0 flex-1">
                    {/* Top row: primary status + category */}
                    <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                      {isLive ? (
                        /* Live menggantikan chip "HARI INI" — implicit
                           hari ini, jadi tidak perlu chip terpisah */
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-gradient-to-r from-emerald-400/25 via-emerald-400/30 to-teal-400/25 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.14em] text-emerald-100 ring-1 ring-emerald-300/50 shadow-[0_2px_10px_-2px_rgba(52,211,153,0.55)]">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inset-0 rounded-full bg-emerald-300 animate-ping opacity-80" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-200" />
                          </span>
                          Sedang Berlangsung
                        </span>
                      ) : (
                        <span
                          className={[
                            "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider",
                            delta === 0
                              ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/30"
                              : delta === 1
                              ? "bg-sky-500/15 text-sky-200 ring-1 ring-sky-400/25"
                              : "bg-white/[0.05] text-slate-300 ring-1 ring-white/[0.06]",
                          ].join(" ")}
                        >
                          {delta === 0 && (
                            <Icon icon="solar:bolt-bold" className="text-[10px]" />
                          )}
                          {relLabel}
                        </span>
                      )}

                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-bold tracking-wide ${cat.chip}`}
                      >
                        <Icon icon={cat.icon} className="text-[10px]" />
                        {cat.label}
                      </span>
                    </div>

                    {/* Title */}
                    <p className="mt-1.5 line-clamp-1 text-[13px] font-bold leading-snug text-white">
                      {ev.raw.judul_acara}
                    </p>

                    {/* Meta row */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] text-slate-400">
                      {time && (
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.025] px-1.5 py-0.5">
                          <Icon
                            icon="solar:clock-circle-bold-duotone"
                            className="text-[12px] text-slate-400"
                          />
                          <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-slate-100">
                            {time}
                            {endTime && (
                              <>
                                <Icon
                                  icon="solar:arrow-right-linear"
                                  className="text-[10px] text-slate-500"
                                />
                                <span className="text-slate-300">{endTime}</span>
                              </>
                            )}
                          </span>
                          {duration && (
                            <>
                              <span className="h-2.5 w-px bg-white/[0.08]" />
                              <span
                                className="font-bold tracking-wide text-emerald-300/90"
                                style={{ textShadow: "0 0 6px rgba(52,211,153,0.35)" }}
                              >
                                {duration}
                              </span>
                            </>
                          )}
                        </span>
                      )}
                      {(ev.raw.lokasi || ev.raw.listing?.alamat_lengkap || ev.raw.listing?.judul) && (
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <Icon icon="solar:map-point-bold-duotone" className="text-[12px] text-slate-500" />
                          <span className="truncate">
                            {ev.raw.lokasi ||
                              ev.raw.listing?.alamat_lengkap ||
                              ev.raw.listing?.judul}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* hairline at top of card on hover */}
                <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                {/* Progress bar — visual "berapa jauh event sudah berjalan".
                   Bertambah seiring waktu (re-render tiap 20s). */}
                {isLive && (
                  <div className="relative h-[3px] bg-white/[0.05] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-400 shadow-[0_0_10px_rgba(52,211,153,0.7)] transition-[width] duration-700 ease-out"
                      style={{ width: `${Math.round(progress * 100)}%` }}
                    />
                    {/* Shimmer di ujung bar (leading edge) */}
                    <div
                      className="pointer-events-none absolute top-0 h-full w-6 bg-gradient-to-r from-transparent via-white/55 to-transparent blur-[2px] animate-[liveBarShimmer_2.2s_linear_infinite]"
                      style={{ left: `calc(${Math.round(progress * 100)}% - 24px)` }}
                    />
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      {/* Edit / view modal prefilled with the clicked agenda item. After save
         the modal already dispatches `acara:changed` which this card listens
         to (and the calendar refetches via its own onSuccess), so both views
         stay in sync. */}
      <ModalAcara
        open={modalOpen}
        onClose={closeModal}
        selectedEvent={modalEvent ?? undefined}
        mode={modalMode}
      />
    </div>
  );
}

export default UpcomingEventsCard;
