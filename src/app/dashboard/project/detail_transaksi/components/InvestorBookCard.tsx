"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Check, ChevronDown, Loader2, Sparkles, Users2 } from "lucide-react";

import type { ProjectDetailViewModel } from "./types";
import { formatIDR, getInitials, normalizeImage } from "./utils";
import { EmptyState, SectionCard } from "./shared";
import {
  buildOwnershipDisplayMap,
  ownershipDenominator,
  toCommitted,
} from "@/lib/investor-ownership";

type PaymentStatus = "menunggu_pembayaran" | "lunas";

type InvestorItem = ProjectDetailViewModel["investors"][number] & {
  status: PaymentStatus | string;
};

const STATUS_OPTIONS: PaymentStatus[] = ["menunggu_pembayaran", "lunas"];

const STATUS_META: Record<
  PaymentStatus,
  {
    label: string;
    dot: string;
    chip: string;
    button: string;
    optionGlow: string;
    description: string;
  }
> = {
  menunggu_pembayaran: {
    label: "Menunggu",
    dot: "bg-amber-300",
    chip:
      "border-amber-400/30 bg-amber-500/10 text-amber-200 shadow-[0_0_25px_rgba(245,158,11,0.12)]",
    button:
      "border-amber-400/35 bg-[linear-gradient(135deg,rgba(245,158,11,0.18),rgba(255,255,255,0.03))] text-amber-100 hover:border-amber-300/50 hover:shadow-[0_0_30px_rgba(245,158,11,0.14)]",
    optionGlow: "group-hover:bg-amber-400/10",
    description: "Dana investor belum dikonfirmasi masuk.",
  },
  lunas: {
    label: "Lunas",
    dot: "bg-emerald-300",
    chip:
      "border-emerald-400/30 bg-emerald-500/10 text-emerald-200 shadow-[0_0_25px_rgba(16,185,129,0.12)]",
    button:
      "border-emerald-400/35 bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(255,255,255,0.03))] text-emerald-100 hover:border-emerald-300/50 hover:shadow-[0_0_30px_rgba(16,185,129,0.14)]",
    optionGlow: "group-hover:bg-emerald-400/10",
    description: "Pembayaran investor sudah diterima penuh.",
  },
};

function normalizeStatus(value: unknown): PaymentStatus {
  return String(value ?? "").toLowerCase() === "lunas"
    ? "lunas"
    : "menunggu_pembayaran";
}

function InvestorIdentity({
  name,
  avatar,
  note,
}: {
  name: string;
  avatar?: string | null;
  note?: string | null;
}) {
  const src = normalizeImage(avatar);
  const displayName = name?.trim() || "Investor";
  const helper = note?.trim() || "";

  return (
    <div className="flex min-w-0 items-center gap-3">
      {src ? (
        <img
          src={src}
          alt={displayName}
          className="h-11 w-11 shrink-0 rounded-full border border-white/10 object-cover shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_12px_30px_rgba(0,0,0,0.28)] md:h-12 md:w-12"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-base font-semibold text-white shadow-[0_10px_24px_rgba(0,0,0,0.28)] md:h-12 md:w-12 md:text-lg">
          {getInitials(displayName)}
        </div>
      )}

      <div className="min-w-0 md:max-w-[220px]">
        <div className="truncate text-[13.5px] font-semibold text-white md:text-[14.5px]">
          {displayName}
        </div>
        {helper ? (
          <div className="truncate text-[11px] text-slate-500 md:text-xs">
            {helper}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MobileFieldLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-1 text-[10px] uppercase tracking-[0.22em] text-slate-500 md:hidden">
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: PaymentStatus }) {
  const meta = STATUS_META[status];

  return (
    <span
      className={[
        "inline-flex h-11 min-w-[176px] items-center justify-center gap-2 rounded-2xl border px-3.5 text-sm font-semibold backdrop-blur-xl transition",
        meta.chip,
      ].join(" ")}
    >
      <span className={["h-2 w-2 rounded-full", meta.dot].join(" ")} />
      <span className="truncate">{meta.label}</span>
    </span>
  );
}

function FuturisticStatusDropdown({
  value,
  onChange,
  disabled,
}: {
  value: PaymentStatus;
  onChange: (nextValue: PaymentStatus) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const active = STATUS_META[value];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative z-[80] w-full max-w-[188px]">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className={[
          "group flex h-11 w-[188px] max-w-full items-center justify-between gap-3 rounded-2xl border px-4 text-sm font-semibold backdrop-blur-xl transition duration-200",
          "shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_10px_35px_rgba(15,23,42,0.42)]",
          "disabled:cursor-not-allowed disabled:opacity-70",
          active.button,
        ].join(" ")}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={["h-2.5 w-2.5 shrink-0 rounded-full", active.dot].join(
              " "
            )}
          />
          <span className="truncate">{active.label}</span>
        </span>

        {disabled ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        ) : (
          <ChevronDown
            className={[
              "h-4 w-4 shrink-0 text-white/70 transition-transform duration-200",
              open ? "rotate-180" : "",
            ].join(" ")}
          />
        )}
      </button>

      {open ? (
        <div className="absolute bottom-[calc(100%+12px)] right-0 z-[120] w-[280px] rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(7,12,24,0.98))] p-2 shadow-[0_24px_80px_rgba(0,0,0,0.52),0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-2xl">
          <div className="mb-2 flex items-center gap-2 px-3 py-2 text-[11px] uppercase tracking-[0.24em] text-slate-500">
            <Sparkles className="h-3.5 w-3.5" />
            Ubah status pembayaran
          </div>

          {STATUS_OPTIONS.map((status) => {
            const meta = STATUS_META[status];
            const selected = status === value;

            return (
              <button
                key={status}
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (status !== value) onChange(status);
                }}
                className={[
                  "group relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border px-3 py-3 text-left transition",
                  selected
                    ? "border-cyan-300/25 bg-white/[0.06]"
                    : "border-transparent hover:border-white/10 hover:bg-white/[0.04]",
                ].join(" ")}
              >
                <div
                  className={[
                    "absolute inset-0 opacity-0 transition-opacity",
                    meta.optionGlow,
                    "group-hover:opacity-100",
                  ].join(" ")}
                />

                <div
                  className={[
                    "relative mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
                    meta.dot,
                  ].join(" ")}
                />

                <div className="relative min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-white">{meta.label}</span>
                    {selected ? (
                      <Check className="h-4 w-4 shrink-0 text-cyan-300" />
                    ) : null}
                  </div>

                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    {meta.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function InvestorBookCard({
  project,
}: {
  project: ProjectDetailViewModel;
}) {
  const { data: session, status: sessionStatus } = useSession();

  const currentAgentId =
    (session?.user as { agentId?: string } | null)?.agentId ?? null;

  const canManagePaymentStatus =
    sessionStatus === "authenticated" &&
    !!currentAgentId &&
    currentAgentId === project.createdById;

  const initialInvestors = useMemo(
    () =>
      ([...project.investors] as InvestorItem[])
        .sort(
          (a, b) => toCommitted(b.committed) - toCommitted(a.committed)
        )
        .map((item) => ({
          ...item,
          status: normalizeStatus(item.status),
        })),
    [project.investors]
  );

  const [investors, setInvestors] = useState(initialInvestors);
  const [savingId, setSavingId] = useState<string | number | null>(null);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    setInvestors(initialInvestors);
  }, [initialInvestors]);

  const fundingTarget = toCommitted(project.fundingTarget);

  const ownershipDisplayMap = useMemo(() => {
    // Kepemilikan = modal DISETOR / max(target, Σsetor). Investor belum lunas
    // (paid 0) = 0%; sisa "belum terisi". Talangan (Σ>target) mendilusi.
    const totalPaid = investors.reduce(
      (sum, inv) => sum + toCommitted(inv.paid),
      0
    );
    const denom = ownershipDenominator(fundingTarget, totalPaid);
    const paidItems = investors.map((inv) => ({
      id: inv.id,
      committed: inv.paid,
    }));
    return buildOwnershipDisplayMap(paidItems, denom, {
      decimalSeparator: ".",
    });
  }, [investors, fundingTarget]);

  async function handleStatusChange(
    investorId: string | number,
    nextStatus: PaymentStatus
  ) {
    setFeedback("");

    const previous = investors;
    setSavingId(investorId);

    setInvestors((current) =>
      current.map((item) =>
        String(item.id) === String(investorId)
          ? { ...item, status: nextStatus }
          : item
      )
    );

    try {
      const response = await fetch("/api/project/update_status_pembayaran", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id_project_investor: investorId,
          status: nextStatus,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Gagal menyimpan status pembayaran.");
      }
    } catch (error) {
      setInvestors(previous);
      setFeedback(
        error instanceof Error
          ? error.message
          : "Terjadi kendala saat menyimpan status pembayaran."
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <SectionCard
      eyebrow="Investor Book"
      title="Partisipasi investor dan kualitas pembayaran"
      icon={<Users2 className="h-5 w-5" />}
      right={
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">
          {investors.length} investor terdaftar
        </span>
      }
    >
      <div className="space-y-4">
        {canManagePaymentStatus ? (
          <div className="flex items-center gap-2 rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.05] px-4 py-3 text-xs text-cyan-100 shadow-[0_0_30px_rgba(34,211,238,0.06)]">
            <Sparkles className="h-4 w-4 shrink-0" />
            Anda adalah penyelenggara project. Status pembayaran investor dapat diubah langsung dari panel ini.
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-slate-300">
            <Sparkles className="h-4 w-4 shrink-0 text-slate-400" />
            Status pembayaran hanya dapat diubah oleh penyelenggara project.
          </div>
        )}

        {feedback ? (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {feedback}
          </div>
        ) : null}

        {investors.length > 0 ? (
          <div className="relative overflow-visible rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.10),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] shadow-[0_12px_50px_rgba(2,6,23,0.36)]">
            <div className="hidden grid-cols-[1.2fr_0.95fr_0.72fr_1.08fr] gap-4 border-b border-white/10 bg-white/[0.04] px-5 py-4 text-xs uppercase tracking-[0.24em] text-slate-500 md:grid">
              <div>Investor</div>
              <div>Komitmen</div>
              <div className="text-center">Kepemilikan</div>
              <div className="text-center">Status</div>
            </div>

            <div className="divide-y divide-white/10">
              {investors.map((item) => {
                const status = normalizeStatus(item.status);
                const isSaving = String(savingId) === String(item.id);
                const committed = toCommitted(item.committed);
                // Kepemilikan dihitung dari modal DISETOR. Kalau komitmen dan
                // setoran berbeda, selisihnya wajib terlihat — kalau tidak,
                // investor bingung kenapa porsinya kecil/0 padahal komitmennya
                // besar.
                const paid = toCommitted(item.paid);
                const belumSetor = Math.max(0, committed - paid);
                const ownershipDisplay =
                  ownershipDisplayMap.get(String(item.id)) ?? {
                    ratio: null,
                    percent: null,
                    percentText: "—",
                  };

                return (
                  <div
                    key={String(item.id)}
                    className="relative z-0 grid grid-cols-2 gap-4 px-4 py-5 text-sm text-slate-200 transition hover:z-10 hover:bg-white/[0.02] md:grid-cols-[1.2fr_0.95fr_0.72fr_1.08fr] md:px-5"
                  >
                    <div className="col-span-2 min-w-0 md:col-span-1">
                      <MobileFieldLabel>Investor</MobileFieldLabel>
                      <InvestorIdentity
                        name={item.name}
                        avatar={item.avatar}
                        note={item.note}
                      />
                    </div>

                    <div className="min-w-0">
                      <MobileFieldLabel>Komitmen</MobileFieldLabel>
                      <div className="truncate font-mono text-white">
                        {formatIDR(committed)}
                      </div>
                      {belumSetor > 0 ? (
                        <div className="mt-1 truncate text-[11px] text-amber-300/75">
                          belum disetor {formatIDR(belumSetor)}
                        </div>
                      ) : paid > 0 ? (
                        <div className="mt-1 truncate text-[11px] text-emerald-300/70">
                          modal masuk penuh
                        </div>
                      ) : null}
                    </div>

                    <div className="min-w-0">
                      <MobileFieldLabel>Kepemilikan</MobileFieldLabel>
                      <div className="truncate text-white md:text-center">
                        {ownershipDisplay.percentText}
                      </div>
                    </div>

                    <div className="col-span-2 min-w-0 md:col-span-1">
                      <MobileFieldLabel>Status</MobileFieldLabel>
                      <div className="flex justify-start md:justify-center">
                        {canManagePaymentStatus ? (
                          <FuturisticStatusDropdown
                            value={status}
                            disabled={isSaving}
                            onChange={(nextStatus) =>
                              handleStatusChange(item.id, nextStatus)
                            }
                          />
                        ) : (
                          <StatusBadge status={status} />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <EmptyState text="Belum ada investor pada project ini." />
        )}
      </div>
    </SectionCard>
  );
}