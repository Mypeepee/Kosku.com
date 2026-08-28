"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

const MONTH_LABELS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const WEEKDAY_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

export function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

export function shiftIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate()
  )}`;
}

export function parseIsoDate(value?: string | null) {
  if (!value) return null;

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate()
  )}`;
}

/** tanggal_transaksi dari DB adalah UTC midnight (@db.Date) — dibaca dalam UTC
 *  supaya picker menampilkan hari yang sama dengan yang tersimpan. */
export function normalizeDateValue(value?: string | Date | null) {
  if (!value) return todayIso();

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return todayIso();

  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(
    date.getUTCDate()
  )}`;
}

export function formatDatePretty(value?: string | null) {
  const date = parseIsoDate(value);
  if (!date) return "-";

  return `${date.getDate()} ${MONTH_LABELS[date.getMonth()]} ${date.getFullYear()}`;
}

function isSameDate(a: Date | null, b: Date | null) {
  if (!a || !b) return false;

  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getMonthMatrix(viewDate: Date) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const startWeekDay = (firstDayOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startWeekDay);

  return Array.from({ length: 42 }).map((_, index) => {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index
    );

    return { date, inCurrentMonth: date.getMonth() === month };
  });
}

export default function DatePickerModal({
  open,
  value,
  disabled,
  onClose,
  onChange,
}: {
  open: boolean;
  value: string;
  disabled?: boolean;
  onClose: () => void;
  onChange: (value: string) => void;
}) {
  const selectedDate = useMemo(() => parseIsoDate(value), [value]);
  const today = useMemo(() => parseIsoDate(todayIso()) ?? new Date(), []);

  const [viewDate, setViewDate] = useState<Date>(() => {
    const baseDate = selectedDate ?? today;
    return new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  });

  useEffect(() => {
    if (!open) return;

    const baseDate = selectedDate ?? today;
    setViewDate(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1));
  }, [open, selectedDate, today]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const cells = getMonthMatrix(viewDate);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#020817]/80 px-4 backdrop-blur-md">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative z-[1] w-full max-w-md overflow-hidden rounded-[30px] border border-cyan-400/15 bg-[radial-gradient(circle_at_top,rgba(8,145,178,0.12),transparent_42%),linear-gradient(180deg,rgba(10,18,30,0.98),rgba(3,8,18,0.98))] shadow-[0_30px_80px_rgba(0,0,0,0.65)]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-white/38">
              Pilih tanggal
            </div>
            <div className="mt-1 text-sm text-white/75">
              {formatDatePretty(value)}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.07] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                setViewDate(
                  (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                )
              }
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/80 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.08]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="text-center">
              <div className="text-base font-semibold text-white">
                {MONTH_LABELS[viewDate.getMonth()]}
              </div>
              <div className="text-sm text-slate-400">
                {viewDate.getFullYear()}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setViewDate(
                  (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                )
              }
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/80 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.08]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="pb-1 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-white/30"
              >
                {label}
              </div>
            ))}

            {cells.map(({ date, inCurrentMonth }) => {
              const isSelected = isSameDate(date, selectedDate);
              const isToday = isSameDate(date, today);

              return (
                <button
                  key={toIsoDate(date)}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onChange(toIsoDate(date));
                    onClose();
                  }}
                  className={[
                    "relative aspect-square rounded-2xl border text-sm font-medium transition",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    isSelected
                      ? "border-cyan-300/45 bg-cyan-400/[0.16] text-white"
                      : isToday
                        ? "border-violet-300/25 bg-violet-400/[0.10] text-white/90"
                        : inCurrentMonth
                          ? "border-white/[0.08] bg-white/[0.03] text-white/80 hover:border-cyan-300/20 hover:bg-cyan-400/[0.06]"
                          : "border-transparent bg-transparent text-white/20 hover:border-white/[0.08]",
                  ].join(" ")}
                >
                  {date.getDate()}
                  {isToday && !isSelected ? (
                    <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-violet-300" />
                  ) : null}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              onChange(todayIso());
              onClose();
            }}
            className="mt-5 inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/75 transition hover:bg-white/[0.07] hover:text-white"
          >
            Hari ini
          </button>
        </div>
      </div>
    </div>
  );
}
