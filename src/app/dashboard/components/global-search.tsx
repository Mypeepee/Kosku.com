"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ─────────────────────────────────────────────────────────────────────

type SearchListing = { id: string; id_agent: string; judul: string; slug: string; kota: string; kategori: string; jenis: string; harga: number; gambar: string | null; status: string };
type SearchAgent   = { id: string; nama: string; jabatan: string; kota: string; foto: string | null; status: string };
type SearchProject = { id: string; nama: string; status: string; jenis: string; thumbnail: string | null; kota: string };
type SearchEvent   = { id: string; judul: string; tipe: string; status: string; tanggal: string; lokasi: string };
type SearchSurat   = { id: string; code: string; title: string; category: string; description: string; status: string };

type SearchResults = {
  listings: SearchListing[];
  agents:   SearchAgent[];
  projects: SearchProject[];
  events:   SearchEvent[];
  surat:    SearchSurat[];
};

type ResultItem =
  | { type: "listing"; data: SearchListing }
  | { type: "agent";   data: SearchAgent }
  | { type: "project"; data: SearchProject }
  | { type: "event";   data: SearchEvent }
  | { type: "surat";   data: SearchSurat };

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRupiah(n: number) {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1).replace(".0", "")} M`;
  if (n >= 1_000_000)     return `Rp ${(n / 1_000_000).toFixed(0)} Jt`;
  return `Rp ${n.toLocaleString("id-ID")}`;
}

const JENIS_LABEL: Record<string, string> = { PRIMARY: "Primer", SECONDARY: "Sekunder", LELANG: "Lelang", SEWA: "Sewa" };

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  AKTIF:               { label: "Aktif",        cls: "bg-emerald-500/15 text-emerald-400" },
  TERSEDIA:            { label: "Tersedia",      cls: "bg-emerald-500/15 text-emerald-400" },
  pendanaan_terbuka:   { label: "Terbuka",       cls: "bg-emerald-500/15 text-emerald-400" },
  PENDING:             { label: "Pending",       cls: "bg-amber-500/15  text-amber-400" },
  TERJUAL:             { label: "Terjual",       cls: "bg-blue-500/15   text-blue-400" },
  SUSPEND:             { label: "Suspend",       cls: "bg-red-500/15    text-red-400" },
  TARIK_LISTING:       { label: "Ditarik",       cls: "bg-slate-500/15  text-slate-400" },
  sedang_dijual:       { label: "Dijual",        cls: "bg-blue-500/15   text-blue-400" },
  Baru:                { label: "Baru",          cls: "bg-sky-500/15    text-sky-400" },
  Populer:             { label: "Populer",       cls: "bg-amber-500/15  text-amber-400" },
  Standar:             { label: "Standar",       cls: "bg-slate-500/15  text-slate-400" },
  DRAFT:               { label: "Draft",         cls: "bg-slate-500/15  text-slate-400" },
  PUBLISHED:           { label: "Published",     cls: "bg-blue-500/15   text-blue-400" },
  OPEN_REGISTRATION:   { label: "Registrasi",    cls: "bg-amber-500/15  text-amber-400" },
  REGISTRATION_CLOSED: { label: "Ditutup",       cls: "bg-slate-500/15  text-slate-400" },
  SCHEDULED:           { label: "Terjadwal",     cls: "bg-cyan-500/15   text-cyan-400" },
  ONGOING:             { label: "Berlangsung",   cls: "bg-emerald-500/15 text-emerald-400" },
  COMPLETED:           { label: "Selesai",       cls: "bg-slate-500/15  text-slate-400" },
  CANCELLED:           { label: "Dibatalkan",    cls: "bg-red-500/15    text-red-400" },
};

const TIPE_ACARA_LABEL: Record<string, string> = {
  BUYER_MEETING: "Buyer Meeting", SITE_VISIT: "Site Visit", CLOSING: "Closing",
  FOLLOW_UP: "Follow Up", OPEN_HOUSE: "Open House", INTERNAL_MEETING: "Internal Meeting",
  TRAINING: "Training", PEMILU: "Pemilu", LAINNYA: "Lainnya",
};

const TIPE_ACARA_ICON: Record<string, string> = {
  BUYER_MEETING: "solar:users-group-rounded-linear", SITE_VISIT: "solar:map-point-linear",
  CLOSING: "solar:hand-shake-linear", FOLLOW_UP: "solar:phone-calling-linear",
  OPEN_HOUSE: "solar:home-smile-linear", INTERNAL_MEETING: "solar:presentation-linear",
  TRAINING: "solar:book-linear", PEMILU: "solar:checklist-minimalistic-linear",
  LAINNYA: "solar:calendar-linear",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const badge = STATUS_BADGE[status] ?? { label: status.replace(/_/g, " "), cls: "bg-slate-500/15 text-slate-400" };
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.cls}`}>{badge.label}</span>;
}

function Thumb({ src, alt, shape = "rounded", fallbackIcon, fallbackColor }: {
  src: string | null; alt: string; shape?: "rounded" | "circle";
  fallbackIcon: string; fallbackColor: string;
}) {
  const [status, setStatus] = useState<"loading" | "ok" | "err">(src ? "loading" : "err");
  const radius = shape === "circle" ? "rounded-full" : "rounded-xl";

  useEffect(() => { setStatus(src ? "loading" : "err"); }, [src]);

  return (
    <div className={`relative h-10 w-10 shrink-0 overflow-hidden ${radius} ${fallbackColor}`}>
      {status === "loading" && <div className="absolute inset-0 animate-pulse bg-white/10" />}
      {src && status !== "err" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} referrerPolicy="no-referrer"
          onLoad={() => setStatus("ok")} onError={() => setStatus("err")}
          className={`h-full w-full object-cover transition-opacity duration-200 ${status === "ok" ? "opacity-100" : "opacity-0"}`}
        />
      )}
      {status === "err" && (
        <div className="flex h-full w-full items-center justify-center">
          <Icon icon={fallbackIcon} className="h-5 w-5 opacity-60" />
        </div>
      )}
    </div>
  );
}

function SectionHeader({ icon, label, count }: { icon: string; label: string; count: number }) {
  return (
    <div className="flex items-center justify-between px-4 pb-1 pt-3">
      <div className="flex items-center gap-1.5">
        <Icon icon={icon} className="h-3.5 w-3.5 text-slate-500" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</span>
      </div>
      <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-600">{count}</span>
    </div>
  );
}

function ResultRow({ children, active, onHover, onClick }: {
  children: React.ReactNode; active: boolean; onHover: () => void; onClick: () => void;
}) {
  return (
    <button data-result-row onMouseEnter={onHover} onClick={onClick}
      className={`group relative flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-100 ${active ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"}`}
    >
      <span className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-emerald-400 transition-opacity duration-100 ${active ? "opacity-100" : "opacity-0"}`} />
      {children}
      <Icon icon="solar:arrow-right-linear"
        className={`h-3.5 w-3.5 shrink-0 text-slate-600 transition-all duration-100 ${active ? "translate-x-0 opacity-100" : "-translate-x-1 opacity-0"}`}
      />
    </button>
  );
}

function KbdHint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="flex items-center gap-1">
      {keys.map((k) => <kbd key={k} className="rounded border border-white/10 bg-white/5 px-1 py-0.5 font-mono text-[10px]">{k}</kbd>)}
      <span>{label}</span>
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GlobalSearch() {
  const router = useRouter();
  const [query,       setQuery]       = useState("");
  const [open,        setOpen]        = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [results,     setResults]     = useState<SearchResults | null>(null);
  const [cursor,      setCursor]      = useState(-1);
  const [rect,        setRect]        = useState<{ top: number; left: number; width: number } | null>(null);
  const [mounted,     setMounted]     = useState(false);

  const inputRef     = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef      = useRef<HTMLDivElement>(null);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // Hitung posisi fixed dropdown dari bounding rect input
  const updateRect = useCallback(() => {
    if (!containerRef.current) return;
    const r = containerRef.current.getBoundingClientRect();
    setRect({ top: r.bottom + 8, left: r.left, width: r.width });
  }, []);

  useEffect(() => {
    if (!open) return;
    updateRect();
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [open, updateRect]);

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); inputRef.current?.focus(); setOpen(true); }
      if (e.key === "Escape") { setOpen(false); setCursor(-1); inputRef.current?.blur(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Click luar → tutup
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false); setCursor(-1);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Debounced search
  const doSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setResults(null); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/dashboard/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults({ listings: [], agents: [], projects: [], events: [], surat: [], ...data });
      } catch { setResults(null); }
      finally { setLoading(false); }
    }, 260);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val); setCursor(-1); setOpen(true); doSearch(val);
  };

  // Flat list untuk keyboard nav
  const flatItems: ResultItem[] = [
    ...(results?.listings.map((d) => ({ type: "listing" as const, data: d })) ?? []),
    ...(results?.agents.map((d)   => ({ type: "agent"   as const, data: d })) ?? []),
    ...(results?.projects.map((d) => ({ type: "project" as const, data: d })) ?? []),
    ...(results?.events.map((d)   => ({ type: "event"   as const, data: d })) ?? []),
    ...(results?.surat.map((d)    => ({ type: "surat"   as const, data: d })) ?? []),
  ];

  const navigateTo = (item: ResultItem) => {
    setOpen(false); setQuery(""); setResults(null);
    if (item.type === "listing") {
      const { jenis, slug, id, id_agent } = item.data;
      const slugId = `${slug}-${id}`;
      if (jenis === "SEWA")        router.push(`/Sewa/${id}`);
      else if (jenis === "LELANG") router.push(`/Lelang/${slugId}/${id_agent}`);
      else                         router.push(`/Jual/${slugId}/${id_agent}`);
    }
    else if (item.type === "agent")   router.push(`/dashboard/human-resource-management?agent=${item.data.id}`);
    else if (item.type === "project") router.push(`/dashboard/project/detail_transaksi/${item.data.id}`);
    else if (item.type === "event")   router.push("/dashboard/jadwal-acara");
    else if (item.type === "surat")   router.push(`/dashboard/surat?template=${item.data.id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || flatItems.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(cursor + 1, flatItems.length - 1);
      setCursor(next);
      listRef.current?.querySelectorAll<HTMLButtonElement>("[data-result-row]")[next]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = Math.max(cursor - 1, 0);
      setCursor(prev);
      listRef.current?.querySelectorAll<HTMLButtonElement>("[data-result-row]")[prev]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && cursor >= 0) {
      e.preventDefault(); navigateTo(flatItems[cursor]);
    }
  };

  const hasResults  = results && (results.listings.length > 0 || results.agents.length > 0 || results.projects.length > 0 || results.events.length > 0 || results.surat.length > 0);
  const showEmpty   = !loading && results && !hasResults && query.length >= 2;
  const showDropdown = open && (hasResults || showEmpty || (loading && query.length >= 2));

  let globalIndex = 0;

  // ── Dropdown content (di-render via portal) ───────────────────────────────
  const dropdownNode = (
    <AnimatePresence>
      {showDropdown && rect && (
        <motion.div
          key="global-search-dropdown"
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          style={{ position: "fixed", top: rect.top, left: rect.left, width: rect.width, zIndex: 9999 }}
          className="overflow-hidden rounded-2xl border border-white/10 bg-[#0e1016]/95 shadow-2xl shadow-black/60 backdrop-blur-xl"
        >
          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-3 px-4 py-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-white/5" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-3/4 rounded bg-white/5" />
                    <div className="h-2.5 w-1/2 rounded bg-white/5" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {showEmpty && (
            <div className="flex flex-col items-center gap-3 py-10">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5">
                <Icon icon="solar:magnifer-broken" className="h-6 w-6 text-slate-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-300">Tidak ada hasil</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Coba kata kunci lain untuk <span className="text-slate-400">"{query}"</span>
                </p>
              </div>
            </div>
          )}

          {/* Results */}
          {hasResults && !loading && (
            <div ref={listRef} className="max-h-[460px] overflow-y-auto">

              {/* Listings */}
              {results!.listings.length > 0 && (
                <section>
                  <SectionHeader icon="solar:buildings-3-linear" label="Listings" count={results!.listings.length} />
                  {results!.listings.map((item) => {
                    const idx = globalIndex++;
                    return (
                      <ResultRow key={`l-${item.id}`} active={cursor === idx} onHover={() => setCursor(idx)} onClick={() => navigateTo({ type: "listing", data: item })}>
                        <Thumb src={item.gambar} alt={item.judul} shape="rounded" fallbackIcon="solar:home-2-linear" fallbackColor="bg-blue-500/10 text-blue-400" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-100">{item.judul}</p>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                            <Icon icon="solar:map-point-linear" className="h-3 w-3 shrink-0" />
                            <span className="truncate">{item.kota}</span>
                            <span className="text-white/10">·</span>
                            <span>{JENIS_LABEL[item.jenis] ?? item.jenis}</span>
                            <span className="text-white/10">·</span>
                            <span className="font-medium text-slate-400">{formatRupiah(item.harga)}</span>
                          </div>
                        </div>
                        <StatusBadge status={item.status} />
                      </ResultRow>
                    );
                  })}
                </section>
              )}

              {/* Agents */}
              {results!.agents.length > 0 && (
                <section>
                  <SectionHeader icon="solar:user-id-linear" label="Agents" count={results!.agents.length} />
                  {results!.agents.map((item) => {
                    const idx = globalIndex++;
                    return (
                      <ResultRow key={`a-${item.id}`} active={cursor === idx} onHover={() => setCursor(idx)} onClick={() => navigateTo({ type: "agent", data: item })}>
                        <Thumb src={item.foto} alt={item.nama} shape="circle" fallbackIcon="solar:user-bold" fallbackColor="bg-emerald-500/10 text-emerald-400" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-100">{item.nama}</p>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                            <Icon icon="solar:suitcase-linear" className="h-3 w-3 shrink-0" />
                            <span>{item.jabatan}</span>
                            <span className="text-white/10">·</span>
                            <Icon icon="solar:map-point-linear" className="h-3 w-3 shrink-0" />
                            <span className="truncate">{item.kota}</span>
                          </div>
                        </div>
                        <StatusBadge status={item.status} />
                      </ResultRow>
                    );
                  })}
                </section>
              )}

              {/* Projects */}
              {results!.projects.length > 0 && (
                <section>
                  <SectionHeader icon="solar:presentation-graph-linear" label="Projects" count={results!.projects.length} />
                  {results!.projects.map((item) => {
                    const idx = globalIndex++;
                    return (
                      <ResultRow key={`p-${item.id}`} active={cursor === idx} onHover={() => setCursor(idx)} onClick={() => navigateTo({ type: "project", data: item })}>
                        <Thumb src={item.thumbnail} alt={item.nama} shape="rounded" fallbackIcon="solar:chart-2-linear" fallbackColor="bg-purple-500/10 text-purple-400" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-100">{item.nama}</p>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                            <Icon icon="solar:map-point-linear" className="h-3 w-3 shrink-0" />
                            <span className="truncate">{item.kota}</span>
                            <span className="text-white/10">·</span>
                            <span className="capitalize">{item.jenis}</span>
                          </div>
                        </div>
                        <StatusBadge status={item.status} />
                      </ResultRow>
                    );
                  })}
                </section>
              )}

              {/* Events */}
              {results!.events.length > 0 && (
                <section>
                  <SectionHeader icon="solar:calendar-linear" label="Jadwal & Acara" count={results!.events.length} />
                  {results!.events.map((item) => {
                    const idx = globalIndex++;
                    const icon = TIPE_ACARA_ICON[item.tipe] ?? "solar:calendar-linear";
                    const tglStr = new Date(item.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
                    return (
                      <ResultRow key={`e-${item.id}`} active={cursor === idx} onHover={() => setCursor(idx)} onClick={() => navigateTo({ type: "event", data: item })}>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400">
                          <Icon icon={icon} className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-100">{item.judul}</p>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                            <Icon icon="solar:calendar-mark-linear" className="h-3 w-3 shrink-0" />
                            <span>{tglStr}</span>
                            <span className="text-white/10">·</span>
                            <Icon icon="solar:map-point-linear" className="h-3 w-3 shrink-0" />
                            <span className="truncate">{item.lokasi}</span>
                            <span className="text-white/10">·</span>
                            <span>{TIPE_ACARA_LABEL[item.tipe] ?? item.tipe}</span>
                          </div>
                        </div>
                        <StatusBadge status={item.status} />
                      </ResultRow>
                    );
                  })}
                </section>
              )}

              {/* Surat */}
              {results!.surat.length > 0 && (
                <section>
                  <SectionHeader icon="solar:document-text-linear" label="Template Surat" count={results!.surat.length} />
                  {results!.surat.map((item) => {
                    const idx = globalIndex++;
                    return (
                      <ResultRow key={`s-${item.id}`} active={cursor === idx} onHover={() => setCursor(idx)} onClick={() => navigateTo({ type: "surat", data: item })}>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">
                          <Icon icon="solar:file-text-linear" className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-slate-100">{item.title}</p>
                            <span className="shrink-0 rounded border border-rose-500/20 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-mono text-rose-400">{item.code}</span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                            <Icon icon="solar:folder-linear" className="h-3 w-3 shrink-0" />
                            <span>{item.category}</span>
                          </div>
                        </div>
                        <StatusBadge status={item.status} />
                      </ResultRow>
                    );
                  })}
                </section>
              )}

              {/* Footer shortcuts */}
              <div className="flex items-center gap-4 border-t border-white/5 px-4 py-2.5 text-[10px] text-slate-600">
                <KbdHint keys={["↑", "↓"]} label="navigasi" />
                <KbdHint keys={["↵"]}       label="buka" />
                <KbdHint keys={["Esc"]}     label="tutup" />
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="relative w-full min-w-0 max-w-xl">
      {/* Input bar */}
      <div className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 transition-all duration-200 ${open ? "border-white/20 bg-[#0e1016] shadow-lg shadow-black/40" : "border-white/5 bg-[#0b0d11]"}`}>
        <Icon icon={loading ? "svg-spinners:ring-resize" : "solar:magnifer-linear"} className="h-4 w-4 shrink-0 text-slate-400" />
        <input
          ref={inputRef} type="text" value={query}
          onChange={handleChange}
          onFocus={() => { if (query.length >= 2) setOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder="Cari listing, agent, project, surat…"
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
        />
        <AnimatePresence>
          {query && (
            <motion.button initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }} transition={{ duration: 0.12 }}
              onClick={() => { setQuery(""); setResults(null); setOpen(false); }}
              className="shrink-0 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <Icon icon="solar:close-circle-bold" className="h-4 w-4" />
            </motion.button>
          )}
        </AnimatePresence>
        <kbd className="hidden sm:flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 shrink-0">⌘K</kbd>
      </div>

      {/* Dropdown via Portal — keluar dari semua stacking context */}
      {mounted && createPortal(dropdownNode, document.body)}
    </div>
  );
}
