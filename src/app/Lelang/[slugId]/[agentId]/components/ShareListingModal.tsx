"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import { downloadPropertyImages } from "@/lib/downloadPropertyImages";

interface SelfAgent {
  id_agent: string;
  nama: string;
  kantor: string;
  whatsapp: string;
  foto_url: string;
  rating: number;
  kota_area: string;
}

interface ShareListingModalProps {
  open: boolean;
  onClose: () => void;
  agentCode: string;
  selfAgent: SelfAgent | null;
  propertyTitle: string;
  propertyPrice: number;
  priceLabel?: string;
  propertyLocation: string;
  slugId: string;
  urlPrefix?: string;
  posterImages?: string[];
  coverImage?: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n || 0);

const phoneDisplay = (raw: string): string => {
  let d = (raw || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "62" + d.slice(1);
  if (!d) return "";
  const m = d.match(/^(\d{2})(\d{3})(\d{3,4})(\d+)$/);
  return m ? `+${m[1]} ${m[2]}-${m[3]}-${m[4]}` : `+${d}`;
};

export default function ShareListingModal({
  open,
  onClose,
  agentCode,
  selfAgent,
  propertyTitle,
  propertyPrice,
  priceLabel = "HARGA",
  propertyLocation,
  slugId,
  urlPrefix = "/Lelang/",
  posterImages = [],
  coverImage,
}: ShareListingModalProps) {
  const [mounted, setMounted]           = useState(false);
  const [show, setShow]                 = useState(false);
  const [visible, setVisible]           = useState(false);
  const [isMobile, setIsMobile]         = useState(false);
  const [origin, setOrigin]             = useState("");
  const [copied, setCopied]             = useState(false);
  const [toast, setToast]               = useState<string | null>(null);
  const [downloading, setDownloading]   = useState(false);
  const [captionOpen, setCaptionOpen]   = useState(false);
  const [captionEdited, setCaptionEdited] = useState(false);
  const [caption, setCaption]           = useState("");
  const [qrFailed, setQrFailed]         = useState(false);
  const [avatarErr, setAvatarErr]       = useState(false);
  const [coverErr, setCoverErr]         = useState(false);
  const [dragY, setDragY]               = useState(0);
  const [snapOut, setSnapOut]           = useState(false);
  const captionRef    = useRef<HTMLTextAreaElement>(null);
  const scrollRef     = useRef<HTMLDivElement>(null);
  const touchStartY   = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const dragYRef      = useRef(0);

  const setDragYBoth = (v: number) => { dragYRef.current = v; setDragY(v); };

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    isDraggingRef.current = false;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null || snapOut) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    const atTop = !scrollRef.current || scrollRef.current.scrollTop <= 0;

    if (!isDraggingRef.current) {
      if (delta > 8 && atTop) isDraggingRef.current = true;
      else return;
    }
    if (delta > 0) setDragYBoth(delta);
  }, [snapOut]);

  const onTouchEnd = useCallback(() => {
    if (isDraggingRef.current) {
      if (dragYRef.current > 80) {
        setSnapOut(true);
        setTimeout(() => { setSnapOut(false); setDragYBoth(0); onClose(); }, 280);
      } else {
        setDragYBoth(0);
      }
    }
    touchStartY.current = null;
    isDraggingRef.current = false;
  }, [onClose]);

  // Client mount + responsive detection
  useEffect(() => {
    setMounted(true);
    setOrigin(window.location.origin);
    const mq = window.matchMedia("(max-width: 639px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Open/close with animation
  useEffect(() => {
    if (!mounted) return;
    if (open) {
      setShow(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      const t = setTimeout(() => setShow(false), 450);
      return () => clearTimeout(t);
    }
  }, [open, mounted]);

  const shareUrl = useMemo(
    () => `${origin}${urlPrefix}${slugId}${agentCode ? `/${agentCode}` : ""}`,
    [origin, urlPrefix, slugId, agentCode]
  );

  const defaultCaption = useMemo(() => {
    const nama   = selfAgent?.nama    || "Agent Premier";
    const kantor = selfAgent?.kantor  || "Solusindo Aset";
    const wa     = phoneDisplay(selfAgent?.whatsapp || "");
    const area   = selfAgent?.kota_area || "";

    const agentBlock =
      `👤 *${nama}*\n` +
      `🏢 ${kantor}` +
      (area ? ` · ${area}` : "") + "\n" +
      (wa ? `📲 ${wa}` : "");

    return (
      `🏷️ *PROPERTI LELANG*\n\n` +
      `🏠 *${propertyTitle}*\n` +
      (propertyLocation ? `📍 ${propertyLocation}\n` : "") +
      `\n💰 *${priceLabel}:* ${fmt(propertyPrice)}\n\n` +
      `🤝 *Hubungi Agent Penyaji*\n\n` +
      `${agentBlock}\n\n` +
      `⚡ *TERTARIK? JANGAN LEWATKAN!*\n\n` +
      `Properti lelang bisa berubah status kapan saja.\n` +
      `Segera ambil tindakan sebelum kehabisan! 🔥\n\n` +
      `Balas pesan ini atau klik link untuk:\n` +
      `💬 Tanya info & dokumen lengkap\n` +
      `💰 Ajukan penawaran harga\n` +
      `📅 Jadwalkan survei lokasi\n\n` +
      `👇 *Buka sekarang:*\n${shareUrl}`
    );
  }, [selfAgent, propertyTitle, propertyPrice, priceLabel, propertyLocation, shareUrl]);

  useEffect(() => {
    if (!captionEdited) setCaption(defaultCaption);
  }, [defaultCaption, captionEdited]);

  // Body scroll lock + ESC
  useEffect(() => {
    if (!open) return;
    setCaptionEdited(false);
    setCopied(false);
    setQrFailed(false);
    setAvatarErr(false);
    setCoverErr(false);
    setCaptionOpen(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onEsc);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onEsc);
    };
  }, [open, onClose]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = shareUrl;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch {}
      document.body.removeChild(ta);
    }
    setCopied(true);
    flash("Link disalin ✓");
    setTimeout(() => setCopied(false), 2200);
  };

  const openWa = () =>
    window.open(`https://wa.me/?text=${encodeURIComponent(caption)}`, "_blank");

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: propertyTitle, text: caption, url: shareUrl });
        return;
      } catch { /* batal */ }
    }
    copy();
  };

  const dlImages = () => downloadPropertyImages(posterImages, setDownloading);

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=4&color=86efac&bgcolor=0c0c0c&data=${encodeURIComponent(shareUrl)}`;

  const agentName   = selfAgent?.nama     || "Agent Premier";
  const agentOffice = selfAgent?.kantor   || "Solusindo Aset";
  const agentPhone  = phoneDisplay(selfAgent?.whatsapp || "");
  const agentArea   = selfAgent?.kota_area || "";
  const showAvatar  = !!selfAgent?.foto_url && !avatarErr;
  const hasCover    = !!coverImage && !coverErr;

  if (!mounted || !show) return null;

  const urlDisplay = shareUrl.replace(/^https?:\/\//, "");

  // ── Animation values ──────────────────────────────────────────────────────
  // Mobile  → bottom-sheet slide-up   (translateY 100% → 0)
  // Desktop → center scale+fade       (scale 0.94 + opacity 0 → 1)
  const SPRING   = "cubic-bezier(0.32, 0.72, 0, 1)";
  const EASE_OUT = "cubic-bezier(0.4, 0, 1, 1)";
  const D_IN     = 440;
  const D_OUT    = 340;

  const cardTransform = snapOut
    ? "translateY(100vh)"
    : dragY > 0
      ? `translateY(${dragY}px)`
      : visible
        ? "translateY(0) scale(1)"
        : isMobile
          ? "translateY(100%)"
          : "translateY(20px) scale(0.94)";

  const cardOpacity = dragY > 0
    ? Math.max(0.55, 1 - dragY / 320)
    : visible ? 1 : isMobile ? 1 : 0;

  const cardTransition = snapOut
    ? "transform 280ms cubic-bezier(0.4,0,1,1)"
    : dragY > 0
      ? "none"
      : visible
        ? `transform ${D_IN}ms ${SPRING}, opacity 280ms ease`
        : `transform ${D_OUT}ms ${EASE_OUT}, opacity 200ms ease`;

  const backdropOpacity    = visible ? 0.88 : 0;
  const backdropBlur       = visible ? 14 : 0;
  const backdropTransition = visible
    ? `opacity ${D_IN}ms ease, backdrop-filter ${D_IN}ms ease, -webkit-backdrop-filter ${D_IN}ms ease`
    : `opacity ${D_OUT}ms ease, backdrop-filter ${D_OUT}ms ease, -webkit-backdrop-filter ${D_OUT}ms ease`;

  const modal = (
    <div
      className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center"
      style={{ fontFamily: "inherit" }}
    >
      {/* ── BACKDROP ── */}
      <div
        className="absolute inset-0 cursor-pointer"
        onClick={onClose}
        style={{
          background: `rgba(0,0,0,${backdropOpacity})`,
          backdropFilter: `blur(${backdropBlur}px)`,
          WebkitBackdropFilter: `blur(${backdropBlur}px)`,
          transition: backdropTransition,
        }}
      />

      {/* ── CARD ── */}
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="relative w-full sm:max-w-[480px] rounded-t-[2rem] sm:rounded-[2rem] overflow-hidden flex flex-col"
        style={{
          background: "linear-gradient(160deg,#0d1117 0%,#080b0f 100%)",
          border: "1px solid rgba(134,239,172,0.13)",
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.04)," +
            "0 40px 120px rgba(0,0,0,0.95)," +
            "0 0 80px rgba(134,239,172,0.07)",
          maxHeight: "92vh",
          transform: cardTransform,
          opacity: cardOpacity,
          transition: cardTransition,
          willChange: "transform, opacity",
        }}
      >
        {/* Top glow line */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px] z-10 pointer-events-none"
          style={{
            background: "linear-gradient(90deg,transparent 0%,#86efac 40%,#34d399 60%,transparent 100%)",
          }}
        />

        {/* Mobile drag handle — always triggers swipe */}
        <div
          className="sm:hidden flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div
            className="w-10 h-[5px] rounded-full transition-all"
            style={{
              background: dragY > 0
                ? "rgba(134,239,172,0.5)"
                : "rgba(255,255,255,0.15)",
            }}
          />
        </div>

        {/* ── SCROLLABLE BODY ── */}
        <div ref={scrollRef} className="overflow-y-auto flex-1" style={{ scrollbarWidth: "none" }}>

          {/* HEADER */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg,rgba(134,239,172,0.16),rgba(52,211,153,0.06))",
                  border: "1px solid rgba(134,239,172,0.22)",
                }}
              >
                <Icon icon="solar:share-bold-duotone" style={{ color: "#86efac", fontSize: 20 }} />
              </div>
              <div>
                <h3 className="text-white font-extrabold text-[15px] leading-tight">
                  Bagikan Listing
                </h3>
                <p
                  className="text-[9px] font-bold mt-0.5"
                  style={{ color: "rgba(134,239,172,0.62)", letterSpacing: "0.14em" }}
                >
                  KODE {agentCode || "—"} · LEAD MASUK KE KAMU
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-110 active:scale-90"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.07)",
                color: "rgba(255,255,255,0.38)",
              }}
            >
              <Icon icon="solar:close-square-bold" style={{ fontSize: 18 }} />
            </button>
          </div>

          <div className="px-5 space-y-4 pb-8">

            {/* ── PREVIEW CARD ── */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.015)",
              }}
            >
              {/* Cover area */}
              <div
                className="relative h-[152px] overflow-hidden flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg,#0c1820 0%,#081510 50%,#0c1820 100%)",
                }}
              >
                {/* Subtle grid */}
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage:
                      "linear-gradient(rgba(134,239,172,0.06) 1px,transparent 1px)," +
                      "linear-gradient(90deg,rgba(134,239,172,0.06) 1px,transparent 1px)",
                    backgroundSize: "28px 28px",
                  }}
                />

                {/* Radial ambient glow */}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(ellipse 70% 60% at 50% 100%,rgba(52,211,153,0.12) 0%,transparent 70%)",
                  }}
                />

                {hasCover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverImage!}
                    alt={propertyTitle}
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ opacity: 0.58 }}
                    onError={() => setCoverErr(true)}
                  />
                ) : (
                  <div className="relative flex flex-col items-center gap-1 select-none">
                    <Icon
                      icon="solar:home-2-bold-duotone"
                      style={{ fontSize: 52, color: "#34d399", opacity: 0.22 }}
                    />
                  </div>
                )}

                {/* Bottom fade */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(0deg,#080b0f 0%,rgba(8,11,15,0.55) 50%,transparent 100%)",
                  }}
                />

                {/* Harga badge — top left */}
                <div
                  className="absolute top-3 left-3 px-3 py-2 rounded-xl"
                  style={{
                    background: "rgba(0,0,0,0.72)",
                    border: "1px solid rgba(134,239,172,0.28)",
                    backdropFilter: "blur(14px)",
                    WebkitBackdropFilter: "blur(14px)",
                  }}
                >
                  <p
                    className="text-[8.5px] font-black"
                    style={{ color: "#86efac", letterSpacing: "0.14em" }}
                  >
                    {priceLabel}
                  </p>
                  <p className="text-white font-extrabold text-[14px] leading-tight mt-0.5">
                    {fmt(propertyPrice)}
                  </p>
                </div>

                {/* Via badge — top right */}
                <div
                  className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
                  style={{
                    background: "rgba(0,0,0,0.72)",
                    border: "1px solid rgba(134,239,172,0.2)",
                    backdropFilter: "blur(14px)",
                    WebkitBackdropFilter: "blur(14px)",
                  }}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-[#86efac] animate-pulse" />
                  <span
                    className="text-[8.5px] font-black text-[#86efac]"
                    style={{ letterSpacing: "0.13em" }}
                  >
                    VIA {agentCode}
                  </span>
                </div>
              </div>

              {/* Agent row */}
              <div
                className="px-4 py-3 flex items-center gap-3"
                style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
              >
                {/* Avatar with gradient ring */}
                <div
                  className="relative shrink-0 w-10 h-10 rounded-full"
                  style={{
                    padding: 1.5,
                    background: "linear-gradient(135deg,#86efac,#34d399)",
                  }}
                >
                  <div
                    className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
                    style={{ background: "#16201a" }}
                  >
                    {showAvatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selfAgent!.foto_url}
                        alt={agentName}
                        className="w-full h-full object-cover"
                        onError={() => setAvatarErr(true)}
                      />
                    ) : (
                      <span className="font-black text-white text-sm">
                        {agentName.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div
                    className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-blue-500 flex items-center justify-center"
                    style={{ border: "1.5px solid #080b0f" }}
                  >
                    <Icon
                      icon="solar:verified-check-bold"
                      className="text-white"
                      style={{ fontSize: 8 }}
                    />
                  </div>
                </div>

                {/* Name + office */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-extrabold text-[13px] truncate leading-tight">
                    {agentName}
                  </p>
                  <p
                    className="text-[10px] truncate mt-0.5"
                    style={{ color: "rgba(255,255,255,0.36)" }}
                  >
                    {agentOffice}
                  </p>
                </div>

                {/* Area + phone */}
                <div className="shrink-0 flex flex-col items-end gap-0.5">
                  {agentArea && (
                    <div className="flex items-center gap-1">
                      <Icon
                        icon="solar:map-point-bold"
                        className="text-rose-400"
                        style={{ fontSize: 10 }}
                      />
                      <span className="text-[9px] text-white/38">{agentArea}</span>
                    </div>
                  )}
                  {agentPhone && (
                    <div className="flex items-center gap-1">
                      <Icon
                        icon="ic:baseline-whatsapp"
                        className="text-[#25D366]"
                        style={{ fontSize: 11 }}
                      />
                      <span className="text-[9px] text-white/40">{agentPhone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Property title + location */}
              <div
                className="px-4 py-2.5"
                style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
              >
                <p className="text-white/72 text-[11px] font-semibold line-clamp-1 leading-snug">
                  {propertyTitle}
                </p>
                {propertyLocation && (
                  <p
                    className="text-[10px] mt-0.5 flex items-center gap-1"
                    style={{ color: "rgba(255,255,255,0.3)" }}
                  >
                    <Icon icon="solar:map-point-linear" style={{ fontSize: 10 }} />
                    {propertyLocation}
                  </p>
                )}
              </div>
            </div>

            {/* ── LINK FIELD ── */}
            <div>
              <p
                className="text-[9px] font-black mb-2 uppercase"
                style={{ color: "#ffffff", letterSpacing: "0.17em" }}
              >
                Link kamu — kode ditempel otomatis
              </p>
              <div className="flex items-stretch gap-2">
                <div
                  className="flex-1 min-w-0 rounded-xl flex items-center px-3 py-2.5 overflow-hidden"
                  style={{
                    background: "rgba(134,239,172,0.03)",
                    border: copied
                      ? "1px solid rgba(134,239,172,0.42)"
                      : "1px solid rgba(255,255,255,0.07)",
                    transition: "border-color 0.3s",
                  }}
                >
                  <span
                    className="text-[11px] truncate font-mono"
                    style={{ color: copied ? "#86efac" : "rgba(255,255,255,0.38)" }}
                  >
                    {agentCode
                      ? urlDisplay.split(agentCode).map((part, i, arr) => (
                          <React.Fragment key={i}>
                            {part}
                            {i < arr.length - 1 && (
                              <span
                                className="font-black"
                                style={{
                                  color: "#86efac",
                                  background: "rgba(134,239,172,0.13)",
                                  borderRadius: 3,
                                  padding: "0 2px",
                                }}
                              >
                                {agentCode}
                              </span>
                            )}
                          </React.Fragment>
                        ))
                      : urlDisplay}
                  </span>
                </div>
                <button
                  onClick={copy}
                  className="shrink-0 px-4 rounded-xl font-bold text-[12px] flex items-center gap-1.5 active:scale-95"
                  style={{
                    background: copied ? "rgba(134,239,172,0.12)" : "rgba(255,255,255,0.06)",
                    border: copied
                      ? "1px solid rgba(134,239,172,0.32)"
                      : "1px solid rgba(255,255,255,0.09)",
                    color: copied ? "#86efac" : "rgba(255,255,255,0.7)",
                    transition: "background 0.25s, border-color 0.25s, color 0.25s",
                  }}
                >
                  <Icon
                    icon={copied ? "solar:check-circle-bold" : "solar:copy-bold-duotone"}
                    style={{ fontSize: 14 }}
                  />
                  {copied ? "Tersalin!" : "Salin"}
                </button>
              </div>
            </div>

            {/* ── ACTION BUTTONS ── */}
            <div className="grid grid-cols-3 gap-2.5">
              {/* WhatsApp */}
              <button
                onClick={openWa}
                className="flex flex-col items-center gap-2.5 py-4 rounded-2xl transition-all active:scale-95 hover:scale-[1.03]"
                style={{
                  background: "rgba(37,211,102,0.08)",
                  border: "1px solid rgba(37,211,102,0.18)",
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: "#25D366",
                    boxShadow: "0 6px 24px rgba(37,211,102,0.42)",
                  }}
                >
                  <Icon icon="ic:baseline-whatsapp" className="text-white" style={{ fontSize: 22 }} />
                </div>
                <span className="text-[10px] font-bold text-white/60">WhatsApp</span>
              </button>

              {/* Native Share / Copy fallback */}
              <button
                onClick={nativeShare}
                className="flex flex-col items-center gap-2.5 py-4 rounded-2xl transition-all active:scale-95 hover:scale-[1.03]"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg,#6366f1,#818cf8)",
                    boxShadow: "0 6px 24px rgba(99,102,241,0.40)",
                  }}
                >
                  <Icon
                    icon="solar:share-bold-duotone"
                    className="text-white"
                    style={{ fontSize: 20 }}
                  />
                </div>
                <span className="text-[10px] font-bold text-white/60">Bagikan…</span>
              </button>

              {/* Download Gambar */}
              <button
                onClick={dlImages}
                disabled={downloading || posterImages.length === 0}
                className="flex flex-col items-center gap-2.5 py-4 rounded-2xl transition-all active:scale-95 hover:scale-[1.03] disabled:opacity-40"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg,#f59e0b,#fbbf24)",
                    boxShadow: "0 6px 24px rgba(245,158,11,0.36)",
                  }}
                >
                  <Icon
                    icon={downloading ? "solar:refresh-bold" : "solar:gallery-download-bold-duotone"}
                    className={`text-white ${downloading ? "animate-spin" : ""}`}
                    style={{ fontSize: 20 }}
                  />
                </div>
                <span className="text-[10px] font-bold text-white/60">
                  {downloading ? "..." : "Gambar"}
                </span>
              </button>
            </div>

            {/* ── CAPTION (collapsible) ── */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                border: "1px solid rgba(255,255,255,0.06)",
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <button
                onClick={() => setCaptionOpen((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 transition-all"
                style={{ color: "rgba(255,255,255,0.6)" }}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    icon="solar:text-bold-duotone"
                    style={{ fontSize: 16, color: "#86efac" }}
                  />
                  <span className="text-[12px] font-semibold">Teks broadcast WhatsApp</span>
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{
                      background: "rgba(134,239,172,0.1)",
                      color: "#86efac",
                      border: "1px solid rgba(134,239,172,0.15)",
                    }}
                  >
                    Edit
                  </span>
                </div>
                <Icon
                  icon="solar:alt-arrow-down-linear"
                  style={{
                    fontSize: 14,
                    transition: "transform 0.25s",
                    transform: captionOpen ? "rotate(-180deg)" : "rotate(0deg)",
                  }}
                />
              </button>
              {captionOpen && (
                <div
                  className="px-4 pb-4"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <textarea
                    ref={captionRef}
                    value={caption}
                    onChange={(e) => {
                      setCaption(e.target.value);
                      setCaptionEdited(true);
                    }}
                    rows={6}
                    className="w-full mt-3 text-[11px] leading-relaxed resize-none focus:outline-none rounded-xl px-3 py-2.5"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      color: "rgba(255,255,255,0.7)",
                    }}
                  />
                  <button
                    onClick={openWa}
                    className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl py-2.5 font-bold text-[12px] transition-all active:scale-95"
                    style={{ background: "#25D366", color: "#000" }}
                  >
                    <Icon icon="ic:baseline-whatsapp" style={{ fontSize: 16 }} />
                    Kirim via WhatsApp
                  </button>
                </div>
              )}
            </div>

            {/* ── QR CODE ── */}
            {!qrFailed && (
              <div
                className="flex items-center gap-4 rounded-2xl px-4 py-3"
                style={{
                  background: "rgba(134,239,172,0.025)",
                  border: "1px solid rgba(134,239,172,0.09)",
                }}
              >
                <div
                  className="w-[72px] h-[72px] shrink-0 rounded-xl overflow-hidden p-1.5"
                  style={{
                    background: "#0c0c0c",
                    border: "1px solid rgba(134,239,172,0.15)",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrSrc}
                    alt="QR link"
                    className="w-full h-full"
                    onError={() => setQrFailed(true)}
                  />
                </div>
                <div>
                  <p className="text-white/78 text-[12px] font-bold mb-0.5">
                    QR Code properti ini
                  </p>
                  <p
                    className="text-[10px] leading-snug"
                    style={{ color: "rgba(255,255,255,0.3)" }}
                  >
                    Tunjukkan ke klien saat survei — link tetap bawa kode{" "}
                    <span style={{ color: "#86efac", fontWeight: 700 }}>{agentCode}</span>
                  </p>
                </div>
              </div>
            )}

            {/* ── TRUST NOTE ── */}
            <div className="flex items-start gap-2.5 pb-1">
              <Icon
                icon="solar:shield-check-bold-duotone"
                style={{
                  fontSize: 13,
                  color: "rgba(134,239,172,0.36)",
                  marginTop: 2,
                  flexShrink: 0,
                }}
              />
              <p
                className="text-[10px] leading-snug"
                style={{ color: "rgba(255,255,255,0.2)" }}
              >
                Profil &amp; nomormu{" "}
                <strong className="text-white/34">hanya tampil</strong> di link yang kamu
                bagikan. Kepemilikan data listing &amp; komisi tidak berubah.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── TOAST ── */}
      {toast && (
        <div
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100000] rounded-full px-5 py-2.5 font-bold text-[12px] pointer-events-none"
          style={{
            background: "#86efac",
            color: "#000",
            boxShadow: "0 8px 32px rgba(134,239,172,0.44)",
            whiteSpace: "nowrap",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );

  return createPortal(modal, document.body);
}
