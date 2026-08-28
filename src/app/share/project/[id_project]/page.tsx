import { prisma } from "@/lib/prisma";
import { summarizeFunding } from "@/lib/investor-ownership";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

// ── helpers ──────────────────────────────────────────────────────────────────

function extractDriveId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const patterns = [
    /[?&]id=([^&#]+)/i,
    /\/file\/d\/([^/]+)/i,
    /\/d\/([^/]+)/i,
  ];
  for (const p of patterns) {
    const m = raw.match(p);
    if (m?.[1]) return m[1];
  }
  return /^[A-Za-z0-9_-]{20,}$/.test(raw) ? raw : null;
}

function thumbPath(raw: string | null | undefined, sz = "w1200") {
  const id = extractDriveId(raw);
  return id ? `/api/drive-image?id=${id}&sz=${sz}` : null;
}

function formatCompact(value: number) {
  if (value >= 1_000_000_000)
    return `Rp ${(value / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`;
  if (value >= 1_000_000)
    return `Rp ${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 0 })} Jt`;
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })
    .format(value)
    .replace(/\s/g, " ");
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    pendanaan_terbuka: "Pendanaan Terbuka",
    pendanaan_penuh: "Pendanaan Penuh",
    pengurusan_dokumen: "Pengurusan Dokumen",
    eksekusi_pengosongan: "Eksekusi",
    renovasi: "Dalam Renovasi",
    sedang_dijual: "Sedang Dijual",
    terjual: "Sudah Terjual",
    dibatalkan: "Dibatalkan",
  };
  return map[status] ?? status.replace(/_/g, " ");
}

function statusColor(status: string) {
  if (status === "pendanaan_terbuka")
    return "border-emerald-400/35 bg-emerald-500/15 text-emerald-200";
  if (status === "pendanaan_penuh" || status === "pengurusan_dokumen")
    return "border-sky-400/35 bg-sky-500/15 text-sky-200";
  if (status === "renovasi" || status === "eksekusi_pengosongan")
    return "border-amber-400/35 bg-amber-500/15 text-amber-200";
  if (status === "sedang_dijual" || status === "terjual")
    return "border-violet-400/35 bg-violet-500/15 text-violet-200";
  return "border-white/20 bg-white/[0.07] text-white/80";
}

// ── data fetching ─────────────────────────────────────────────────────────────

async function getProject(id: string) {
  return prisma.project.findUnique({
    where: { id_project: id },
    select: {
      id_project: true,
      nama_project: true,
      gambar_thumbnail: true,
      status: true,
      target_pendanaan: true,
      total_pendanaan: true,
      estimasi_profit_bersih: true,
      estimasi_harga_jual: true,
      deskripsi_project: true,
      alamat_property: true,
      kota: true,
      estimasi_bulan: true,
      investorProject: {
        select: {
          id_project_investor: true,
          nominal_komitmen: true,
          nominal_terbayar: true,
        },
      },
    },
  });
}

type Params = { id_project: string };

// ── metadata / OG tags (WhatsApp reads these) ─────────────────────────────────

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const project = await getProject(params.id_project);
  if (!project) return { title: "Project Tidak Ditemukan" };

  const target = Number(project.target_pendanaan);
  const profit = Number(project.estimasi_profit_bersih);
  const roi = target > 0 ? ((profit / target) * 100).toFixed(1) : null;
  const lokasi = project.kota || project.alamat_property || "";

  const title = project.nama_project;
  const description = [
    lokasi,
    `Target ${formatCompact(target)}`,
    roi ? `Est. ROI ${roi}%` : null,
    `${statusLabel(String(project.status))}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const img = thumbPath(project.gambar_thumbnail, "w1200");

  return {
    title: `${title} — Solusindo Aset`,
    description,
    openGraph: {
      title,
      description,
      siteName: "Solusindo Aset",
      type: "website",
      images: img
        ? [{ url: img, width: 1200, height: 630, alt: title }]
        : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: img ? [img] : [],
    },
  };
}

// ── page ──────────────────────────────────────────────────────────────────────

export default async function ShareProjectPage({ params }: { params: Params }) {
  const project = await getProject(params.id_project);
  if (!project) notFound();

  const target = Number(project.target_pendanaan);
  // Progres pendanaan = modal yang SUDAH disetor. `total_pendanaan` (Σ komitmen)
  // akan menampilkan 100% padahal belum ada pembayaran masuk.
  // Lihat summarizeFunding di src/lib/investor-ownership.ts.
  const funding = summarizeFunding(
    project.investorProject.map((item) => ({
      committed: item.nominal_komitmen,
      paid: item.nominal_terbayar,
    })),
    project.target_pendanaan
  );
  const raised = funding.terkumpul;
  const profit = Number(project.estimasi_profit_bersih);
  const hargaJual = Number(project.estimasi_harga_jual);
  const roi = target > 0 ? ((profit / target) * 100).toFixed(1) : null;
  const progress = Math.round(funding.persen);
  const progressKomitmen = Math.round(funding.persenKomitmen);
  const investor = project.investorProject.length;
  const isSold = project.status === "terjual";
  const img400 = thumbPath(project.gambar_thumbnail, "w800");
  const arusKasHref = `/dashboard/project/detail_transaksi/${project.id_project}/arus_kas`;
  const lokasi = [project.alamat_property, project.kota].filter(Boolean).join(", ");

  return (
    <main className="min-h-screen bg-[#030810] text-white">

      {/* ── ambient background ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-emerald-500/[0.07] blur-[120px]" />
        <div className="absolute -right-40 top-1/3 h-[400px] w-[400px] rounded-full bg-cyan-500/[0.06] blur-[100px]" />
        <div className="absolute bottom-0 left-1/2 h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-violet-500/[0.05] blur-[80px]" />
      </div>

      <div className="relative mx-auto max-w-lg px-4 pb-16 pt-8 sm:pt-12">

        {/* ── logo / brand ── */}
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10" />
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30">
            Solusindo Aset
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10" />
        </div>

        {/* ── hero card ── */}
        <div className="overflow-hidden rounded-[28px] border border-white/[0.09] bg-[linear-gradient(180deg,#070d18_0%,#04080f_100%)] shadow-[0_32px_80px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.05)]">

          {/* Hero image */}
          <div className="relative h-56 sm:h-72">
            {img400 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={img400}
                alt={project.nama_project}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-[linear-gradient(135deg,#0d1f35_0%,#071525_60%,#050e1a_100%)]" />
            )}
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,8,15,0.08)_0%,rgba(4,8,15,0.18)_30%,rgba(4,8,15,0.65)_65%,rgba(4,8,15,0.97)_100%)]" />
            <div className="absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,transparent_100%)]" />

            {/* Top row badges */}
            <div className="absolute left-4 right-4 top-4 flex items-start justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-white/75 backdrop-blur-xl">
                {project.id_project}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.18em] backdrop-blur-xl ${statusColor(String(project.status))}`}
              >
                {statusLabel(String(project.status))}
              </span>
            </div>

            {/* Bottom info */}
            <div className="absolute bottom-0 left-0 right-0 px-5 pb-5">
              <h1 className="text-[clamp(20px,5vw,28px)] font-bold leading-[1.1] tracking-[-0.04em] text-white">
                {project.nama_project}
              </h1>
              {lokasi && (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-white/50">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
                  </svg>
                  <span className="truncate">{lokasi}</span>
                </p>
              )}
            </div>
          </div>

          {/* ── metrics grid ── */}
          <div className="grid grid-cols-3 divide-x divide-white/[0.06] border-t border-white/[0.06]">
            <div className="px-4 py-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">
                Target Dana
              </p>
              <p className="mt-1.5 text-[clamp(14px,3.5vw,18px)] font-bold text-white">
                {formatCompact(target)}
              </p>
            </div>

            <div className="px-4 py-4 text-center">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">
                Est. ROI
              </p>
              <p className={`mt-1.5 text-[clamp(14px,3.5vw,18px)] font-bold ${roi ? "text-emerald-300" : "text-slate-600"}`}>
                {roi ? `${roi}%` : "—"}
              </p>
            </div>

            <div className="px-4 py-4 text-right">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">
                Investor
              </p>
              <p className="mt-1.5 text-[clamp(14px,3.5vw,18px)] font-bold text-white">
                {investor}
              </p>
            </div>
          </div>

          {/* ── funding progress ── */}
          {!isSold && (
            <div className="border-t border-white/[0.06] px-5 py-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">
                  Funding Progress
                </span>
                <span className="text-[11px] font-bold text-white">
                  {progress}%
                </span>
              </div>
              <div className="relative h-[5px] overflow-hidden rounded-full bg-white/[0.06]">
                {progressKomitmen > progress ? (
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-[repeating-linear-gradient(115deg,rgba(251,191,36,0.32)_0px,rgba(251,191,36,0.32)_4px,transparent_4px,transparent_8px)]"
                    style={{ width: `${progressKomitmen}%` }}
                  />
                ) : null}
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#059669_0%,#34d399_55%,#7dd3fc_100%)] shadow-[0_0_10px_rgba(52,211,153,0.45)] transition-all duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between">
                <span className="text-[10px] text-slate-600">
                  {formatCompact(raised)} terkumpul
                </span>
                <span className="text-[10px] text-slate-600">
                  dari {formatCompact(target)}
                </span>
              </div>
              {funding.belumSetor > 0 ? (
                <p className="mt-1 text-[10px] text-amber-300/70">
                  {formatCompact(funding.belumSetor)} dijanjikan investor,
                  menunggu pembayaran
                </p>
              ) : null}
            </div>
          )}

          {/* ── description teaser ── */}
          {project.deskripsi_project && (
            <div className="border-t border-white/[0.06] px-5 py-4">
              <p className="line-clamp-3 text-sm leading-6 text-slate-500">
                {project.deskripsi_project}
              </p>
            </div>
          )}

          {/* ── CTA ── */}
          <div className="border-t border-white/[0.06] p-5">
            <Link
              href={arusKasHref}
              className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#059669_0%,#10b981_50%,#34d399_100%)] px-6 py-4 text-sm font-bold tracking-[0.02em] text-white shadow-[0_12px_32px_rgba(16,185,129,0.35)] transition-all duration-200 hover:shadow-[0_16px_40px_rgba(16,185,129,0.48)] active:scale-[0.99]"
            >
              <span className="pointer-events-none absolute inset-0 translate-x-[-100%] bg-[linear-gradient(105deg,transparent_25%,rgba(255,255,255,0.18)_50%,transparent_75%)] transition-transform duration-500 group-hover:translate-x-[100%]" />
              <span className="relative">Masuk &amp; Lihat Detail Project</span>
              <svg
                viewBox="0 0 24 24"
                className="relative h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>

            <p className="mt-3 text-center text-[10px] text-white/25">
              Diperlukan akun Solusindo Aset untuk melihat detail
            </p>
          </div>
        </div>

        {/* ── est. harga jual note ── */}
        {hargaJual > 0 && (
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.025] px-5 py-4">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600">
                Estimasi Harga Jual
              </p>
              <p className="mt-1 text-base font-bold text-white/80">
                {formatCompact(hargaJual)}
              </p>
            </div>
            {project.estimasi_bulan && project.estimasi_bulan > 0 ? (
              <div className="text-right">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600">
                  Est. Exit
                </p>
                <p className="mt-1 text-base font-bold text-white/80">
                  {project.estimasi_bulan} bln
                </p>
              </div>
            ) : null}
          </div>
        )}

        {/* ── footer ── */}
        <p className="mt-8 text-center text-[10px] text-white/20">
          © Solusindo Aset · Platform Investasi Properti
        </p>
      </div>
    </main>
  );
}
