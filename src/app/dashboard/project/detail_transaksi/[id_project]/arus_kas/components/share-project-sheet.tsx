"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  Copy,
  ExternalLink,
  Link2,
  MessageCircle,
  QrCode,
  Share2,
  X,
} from "lucide-react";

type ShareProjectSheetProps = {
  open: boolean;
  onClose: () => void;
  idProject: string;
  namaProject: string;
};

function buildShareUrl(idProject: string) {
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://solusindoaset.com";
  return `${origin}/share/project/${idProject}`;
}

function buildWhatsAppText(namaProject: string, url: string) {
  return (
    `Halo! 👋\n\n` +
    `Ini link *Dashboard Project* untuk:\n` +
    `📁 *${namaProject}*\n\n` +
    `Kamu bisa lihat status dompet, riwayat transaksi, dan sisa dana project di sini:\n` +
    `👉 ${url}`
  );
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      return true;
    } catch {
      return false;
    }
  }
}

export default function ShareProjectSheet({
  open,
  onClose,
  idProject,
  namaProject,
}: ShareProjectSheetProps) {
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setShareUrl(buildShareUrl(idProject));
    }
  }, [open, idProject]);

  useEffect(() => {
    if (!open) {
      setCopied(false);
      return;
    }

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  async function handleCopyLink() {
    const ok = await copyToClipboard(shareUrl);
    if (ok) {
      setCopied(true);
      toast.success("Link berhasil disalin!");
      setTimeout(() => setCopied(false), 2500);
    } else {
      toast.error("Gagal menyalin link.");
    }
  }

  async function handleNativeShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: namaProject,
          text: `Dashboard project: ${namaProject}`,
          url: shareUrl,
        });
      } catch {
        // user cancelled — no-op
      }
    } else {
      handleCopyLink();
    }
  }

  function handleWhatsApp() {
    const text = buildWhatsAppText(namaProject, shareUrl);
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  }

  function handleOpenLink() {
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      {/* Backdrop */}
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/60 backdrop-blur-[3px]"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative w-full max-w-md overflow-hidden rounded-t-[32px] sm:rounded-[28px] bg-[linear-gradient(180deg,#08111d_0%,#050c18_100%)] shadow-[0_-20px_80px_rgba(0,0,0,0.5)] sm:shadow-[0_30px_100px_rgba(0,0,0,0.6)]">

        {/* Top accent glow */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-56 w-56 -translate-x-1/2 rounded-full bg-cyan-500/8 blur-3xl" />

        {/* Handle (mobile) */}
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-white/15 sm:hidden" />

        {/* Header */}
        <div className="relative flex items-start justify-between px-6 pb-4 pt-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-cyan-300/20 bg-cyan-400/10 text-cyan-200">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-white/38">
                Bagikan Project
              </div>
              <h2 className="mt-0.5 max-w-[220px] truncate text-base font-semibold text-white">
                {namaProject}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/50 transition hover:bg-white/[0.08] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* URL preview box */}
        <div className="relative mx-6 mb-5 overflow-hidden rounded-[18px] border border-white/10 bg-white/[0.03]">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center border-r border-white/8">
            <Link2 className="h-4 w-4 text-white/25" />
          </div>
          <div className="py-3 pl-12 pr-4">
            <p className="truncate text-xs text-white/50">
              {shareUrl || `…/arus_kas`}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 px-6 pb-6">

          {/* Copy link */}
          <button
            type="button"
            onClick={handleCopyLink}
            className={[
              "group flex w-full items-center gap-4 rounded-[20px] border px-5 py-4 text-left transition-all duration-200",
              copied
                ? "border-emerald-300/30 bg-emerald-400/10"
                : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.07]",
            ].join(" ")}
          >
            <div
              className={[
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border transition-colors duration-200",
                copied
                  ? "border-emerald-300/25 bg-emerald-400/12 text-emerald-200"
                  : "border-white/10 bg-white/[0.05] text-white/60 group-hover:border-white/20 group-hover:text-white",
              ].join(" ")}
            >
              {copied ? (
                <Check className="h-5 w-5" />
              ) : (
                <Copy className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className={["text-sm font-medium", copied ? "text-emerald-100" : "text-white"].join(" ")}>
                {copied ? "Link tersalin!" : "Salin link"}
              </p>
              <p className="mt-0.5 text-xs text-white/38">
                Tempel di mana saja untuk berbagi
              </p>
            </div>
          </button>

          {/* WhatsApp */}
          <button
            type="button"
            onClick={handleWhatsApp}
            className="group flex w-full items-center gap-4 rounded-[20px] border border-white/10 bg-white/[0.04] px-5 py-4 text-left transition hover:border-[#25d366]/30 hover:bg-[#25d366]/8"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-white/10 bg-white/[0.05] text-white/60 transition group-hover:border-[#25d366]/25 group-hover:bg-[#25d366]/12 group-hover:text-[#25d366]">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white">Kirim via WhatsApp</p>
              <p className="mt-0.5 text-xs text-white/38">
                Buka WhatsApp dengan pesan yang sudah diisi
              </p>
            </div>
          </button>

          {/* Native share (mobile) / Open link (desktop) */}
          {typeof navigator !== "undefined" && "share" in navigator ? (
            <button
              type="button"
              onClick={handleNativeShare}
              className="group flex w-full items-center gap-4 rounded-[20px] border border-white/10 bg-white/[0.04] px-5 py-4 text-left transition hover:border-white/20 hover:bg-white/[0.07]"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-white/10 bg-white/[0.05] text-white/60 transition group-hover:text-white">
                <Share2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">Bagikan lainnya</p>
                <p className="mt-0.5 text-xs text-white/38">
                  Pilih aplikasi untuk berbagi
                </p>
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleOpenLink}
              className="group flex w-full items-center gap-4 rounded-[20px] border border-white/10 bg-white/[0.04] px-5 py-4 text-left transition hover:border-white/20 hover:bg-white/[0.07]"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-white/10 bg-white/[0.05] text-white/60 transition group-hover:text-white">
                <ExternalLink className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">Buka di tab baru</p>
                <p className="mt-0.5 text-xs text-white/38">
                  Verifikasi link sebelum dibagikan
                </p>
              </div>
            </button>
          )}

          {/* Info note */}
          <div className="flex items-start gap-3 rounded-[16px] border border-white/6 bg-white/[0.025] px-4 py-3">
            <QrCode className="mt-0.5 h-4 w-4 shrink-0 text-white/25" />
            <p className="text-xs leading-5 text-white/35">
              Hanya pengguna yang sudah terdaftar dan login yang dapat mengakses halaman ini.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
