// app/dashboard/listings/loading.tsx
// Instant skeleton while server fetches the page (Next.js loading.tsx convention).

export default function Loading() {
  return (
    <div className="relative min-h-screen px-4 py-8 sm:px-6 sm:py-10 space-y-6">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#020617] via-[#020c1a] to-[#020617]" />
        <div className="absolute -right-32 -top-32 h-72 w-72 rounded-full bg-emerald-500/25 blur-3xl" />
        <div className="absolute -left-32 bottom-0 h-64 w-64 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(to_right,#22c55e_1px,transparent_1px),linear-gradient(to_bottom,#22c55e_1px,transparent_1px)] [background-size:80px_80px]" />
      </div>

      {/* Metric cards skeleton */}
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-6">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[120px] rounded-2xl border border-white/5 bg-white/[0.02] animate-pulse"
          />
        ))}
      </div>

      {/* Filter bar skeleton — tingginya harus SAMA dengan bilah aslinya
          (kontrol 36px + padding 6px = 48px). Kalau beda, isi halaman
          melompat sejauh selisihnya begitu data datang. */}
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-12 rounded-2xl border border-white/10 bg-white/5 animate-pulse" />

        {/* Action row skeleton */}
        <div className="flex items-center justify-between px-1">
          <div className="h-4 w-32 rounded bg-white/5 animate-pulse" />
          <div className="flex gap-2">
            <div className="h-7 w-32 rounded-xl bg-white/5 animate-pulse" />
            <div className="h-7 w-36 rounded-full bg-emerald-500/10 animate-pulse" />
          </div>
        </div>

        {/* Card grid skeleton */}
        <div className="grid grid-cols-1 gap-y-5 gap-x-6 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col">
              <div
                className="relative h-[480px] rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/60 to-zinc-950 overflow-hidden"
                style={{ animation: `pulse 1.6s ease-in-out ${i * 0.12}s infinite` }}
              >
                <div className="absolute inset-x-0 top-0 h-64 bg-white/[0.03]" />
                <div className="absolute left-5 top-72 h-6 w-32 rounded bg-white/[0.06]" />
                <div className="absolute left-5 top-80 h-4 w-48 rounded bg-white/[0.04]" />
                <div className="absolute left-5 top-[22rem] h-16 rounded-2xl bg-white/[0.03] right-5" />
                {/* shimmer line */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
              </div>
              <div className="-mt-4 flex items-center justify-between rounded-b-3xl border-x border-b border-white/5 bg-zinc-950/95 px-4 pb-3 pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-lg bg-white/5" />
                  <div className="h-3 w-3 bg-white/5" />
                  <div className="h-3 w-8 rounded bg-white/5" />
                </div>
                <div className="h-7 w-16 rounded-xl bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
