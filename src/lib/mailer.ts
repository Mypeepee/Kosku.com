// src/lib/mailer.ts
// ---------------------------------------------------------------------------
// Pengirim email via Gmail SMTP (App Password) memakai nodemailer.
//
// Cara setup (1x saja):
//  1) Login ke Gmail yang dipakai (mis. closingsystem@gmail.com)
//  2) Aktifkan 2-Step Verification:  https://myaccount.google.com/security
//  3) Buat App Password:             https://myaccount.google.com/apppasswords
//     -> pilih "Mail", salin 16 huruf yang muncul.
//  4) Isi .env:
//        GMAIL_USER="closingsystem@gmail.com"
//        GMAIL_APP_PASSWORD="abcd efgh ijkl mnop"   (spasi boleh, otomatis dibuang)
//
// Bila env belum diisi, sistem TIDAK error — OTP hanya dicatat di console.
//
// TEMA: DARK EMERALD — selaras dengan website (darkmode #000510, primary mint
// #99E39E, emerald #10b981). Di-engineer agar tahan "dark mode" email client:
//  - Latar via atribut `bgcolor` SOLID di tiap sel (bukan hanya background-image
//    gradient, yang tidak bisa diproses Gmail sehingga teks ikut dibalik).
//  - Teks memakai hex SOLID terang (bukan rgba tipis).
//  - <meta color-scheme="dark"> menandai email ini dark-native (jangan dibalik).
//  - Override [data-ogsc]/[data-ogsb] + media query untuk client yang memaksa.
// ---------------------------------------------------------------------------

import nodemailer from "nodemailer";

const GMAIL_USER = process.env.GMAIL_USER || "";
const GMAIL_APP_PASSWORD = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
const BRAND = "Solusindo Aset";
const LEGAL = "PT. Solusi Tangguh Rejeki";
const SUPPORT_EMAIL = "closingsystem@gmail.com";
const SUPPORT_WA = "+62 813-3571-6679";
const SUPPORT_WA_LINK = "https://wa.me/6281335716679";
const SITE = "SolusindoAset.com";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://solusindoaset.com";
/* Gambar & tautan di dalam email WAJIB memakai alamat yang bisa dijangkau dari
   luar. BASE_URL berisi localhost di mesin pengembangan, dan server Gmail yang
   mengambil gambarnya tidak berada di mesin itu — hasilnya kotak rusak di
   setiap email. Lihat catatan lengkapnya di src/lib/site.ts. */
import { URL_PUBLIK } from "@/lib/site";
const ADDRESS =
  "Santorini Town Square, Jl. Ronggolawe No.2A, DR. Soetomo, Kec. Tegalsari, Surabaya, Jawa Timur";

// Palet emerald terpusat (selaras dengan website).
const E = {
  bg: "#000510",        // website darkmode base
  card: "#05160e",      // kartu utama (emerald sangat gelap)
  panel: "#0a2117",     // panel dalam
  cardBorder: "#123d2c",
  panelBorder: "#1c5640",
  divider: "#10342500",
  dividerSolid: "#103425",
  emerald: "#10b981",
  emeraldBright: "#34d399",
  teal: "#1dc8cd",
  mint: "#99e39e",      // primary accent (website)
  ink: "#eaf6ef",       // teks utama (nyaris putih kehijauan)
  inkSoft: "#a7c7b9",   // teks sekunder
  inkMute: "#7c9a8c",   // teks redup
  btnText: "#03130c",   // teks gelap di atas tombol emerald terang
  amber: "#fcd34d",
  amberBg: "#241c06",
  amberBorder: "#4d3d12",
  green: "#34d399",
  greenBg: "#07241a",
  greenBorder: "#1f5e44",
  rose: "#fb7185",
  roseBg: "#2a0f14",
  roseBorder: "#5a2030",
};

export function isMailConfigured() {
  return Boolean(GMAIL_USER && GMAIL_APP_PASSWORD);
}

let cachedTransport: nodemailer.Transporter | null = null;
function getTransport() {
  if (cachedTransport) return cachedTransport;
  cachedTransport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });
  return cachedTransport;
}

/* ---------------- Helpers ---------------- */

// Escape karakter HTML supaya data dari pengguna aman ditempel ke markup email.
function esc(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function initialsOf(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "SA";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function waDigits(phone?: string | null): string {
  return String(phone || "").replace(/\D/g, "");
}

function formatJoinedAt(d?: Date | null): string {
  const date = d ? new Date(d) : new Date();
  try {
    return (
      new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      }).format(date) + " WIB"
    );
  } catch {
    return date.toISOString();
  }
}

/** Tanggal lengkap + nama hari, mis. "Senin, 6 Juli 2026" (zona WIB). */
function formatEventDate(d?: Date | null): string {
  const date = d ? new Date(d) : new Date();
  try {
    return new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

/** Jam:menit 24-jam, mis. "10:00" (zona WIB). */
function formatEventClock(d?: Date | null): string {
  const date = d ? new Date(d) : new Date();
  try {
    return new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Jakarta",
    })
      .format(date)
      .replace(/\./g, ":");
  } catch {
    return "--:--";
  }
}

/** Frasa hitung mundur yang ramah, mis. "3 jam lagi" / "45 menit lagi". */
function humanizeUntil(start?: Date | null, now: Date = new Date()): string {
  if (!start) return "Segera";
  const diffMs = new Date(start).getTime() - now.getTime();
  if (diffMs <= 60 * 1000) return "Dimulai sekarang";
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `${mins} menit lagi`;
  const hours = Math.round(mins / 60);
  return `${hours} jam lagi`;
}

/** Satu baris data: label kecil uppercase mint + value terang. */
function dataRow(label: string, value: string, link?: { href: string }): string {
  const inner = link
    ? `<a href="${link.href}" class="em-mint" style="font-size:14px;color:${E.mint};font-weight:600;text-decoration:none;line-height:1.4;word-break:break-word;">${value}</a>`
    : `<div class="em-ink" style="font-size:14px;color:${E.ink};font-weight:600;line-height:1.4;word-break:break-word;">${value}</div>`;
  return `
    <tr>
      <td style="padding:13px 0;border-top:1px solid ${E.dividerSolid};">
        <div class="em-emerald" style="font-size:9.5px;letter-spacing:2px;text-transform:uppercase;color:${E.emeraldBright};font-weight:700;margin-bottom:5px;">${label}</div>
        ${inner}
      </td>
    </tr>`;
}

/** Blok kontak (WhatsApp + email) untuk bagian bantuan. */
function helpRow() {
  return `
          <tr><td align="center" style="padding:20px 40px 0;">
            <p class="em-mute" style="margin:0;font-size:12.5px;line-height:1.7;color:${E.inkMute};">
              Butuh bantuan? WhatsApp
              <a href="${SUPPORT_WA_LINK}" style="color:${E.mint};text-decoration:none;font-weight:600;">${esc(SUPPORT_WA)}</a>
              &nbsp;&middot;&nbsp; email
              <a href="mailto:${esc(SUPPORT_EMAIL)}" style="color:${E.mint};text-decoration:none;font-weight:600;">${esc(SUPPORT_EMAIL)}</a>
            </p>
          </td></tr>`;
}

/**
 * Shell email bersama (DARK EMERALD). bgcolor solid di tiap sel + override
 * dark-mode untuk menjaga keterbacaan.
 */
function renderEmailShell(opts: {
  title: string;
  preheader: string;
  content: string;
  hideLogo?: boolean;
}) {
  const year = new Date().getFullYear();
  // Sebagian email (mis. pengingat acara) sengaja tanpa logo di atas —
  // langsung mulai dari pill. Sisanya tetap tampil logo brand.
  const brandHeader = opts.hideLogo
    ? ""
    : `
          <!-- brand header -->
          <tr><td bgcolor="${E.card}" align="center" style="padding:30px 40px 6px;background-color:${E.card};">
            <img src="${URL_PUBLIK}/images/logo/LogoSolusindoPremier.png" alt="Solusindo Aset" width="180" height="auto" style="display:block;height:auto;max-width:180px;border:0;" />
          </td></tr>`;
  return `<!doctype html>
<html lang="id" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${esc(opts.title)}</title>
  <!--[if mso]><style>*{font-family:Arial,Helvetica,sans-serif !important;}</style><![endif]-->
  <style>
    /* Email ini dark-native. Paksa tetap gelap + teks terang walau client
       mencoba menerapkan "dark mode"-nya sendiri (Apple Mail / Outlook.com). */
    @media (prefers-color-scheme: dark) {
      .em-body{background-color:${E.bg} !important;}
      .em-card{background-color:${E.card} !important;}
      .em-panel{background-color:${E.panel} !important;}
      .em-ink{color:${E.ink} !important;}
      .em-soft{color:${E.inkSoft} !important;}
      .em-mute{color:${E.inkMute} !important;}
      .em-mint{color:${E.mint} !important;}
      .em-emerald{color:${E.emeraldBright} !important;}
    }
    [data-ogsc] .em-ink{color:${E.ink} !important;}
    [data-ogsc] .em-soft{color:${E.inkSoft} !important;}
    [data-ogsc] .em-mute{color:${E.inkMute} !important;}
    [data-ogsc] .em-mint{color:${E.mint} !important;}
    [data-ogsc] .em-emerald{color:${E.emeraldBright} !important;}
    [data-ogsb] .em-body{background-color:${E.bg} !important;}
    [data-ogsb] .em-card{background-color:${E.card} !important;}
    [data-ogsb] .em-panel{background-color:${E.panel} !important;}
  </style>
</head>
<body class="em-body" bgcolor="${E.bg}" style="margin:0;padding:0;background-color:${E.bg};-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;mso-hide:all;">${esc(opts.preheader)}&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.bg}" class="em-body" style="background-color:${E.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <tr>
      <td align="center" style="padding:34px 16px;">
        <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.card}" class="em-card" style="max-width:600px;width:100%;background-color:${E.card};border:1px solid ${E.cardBorder};border-radius:22px;overflow:hidden;">

          <!-- accent bar -->
          <tr><td bgcolor="${E.emerald}" height="6" style="height:6px;line-height:6px;font-size:0;background-color:${E.emerald};background-image:linear-gradient(90deg,${E.emeraldBright},${E.emerald},${E.teal},${E.emeraldBright});">&nbsp;</td></tr>

          ${brandHeader}

          ${opts.content}

          <!-- divider -->
          <tr><td bgcolor="${E.card}" style="padding:24px 40px 0;background-color:${E.card};">
            <div style="height:1px;font-size:0;line-height:0;background-color:${E.dividerSolid};">&nbsp;</div>
          </td></tr>

          <!-- footer -->
          <tr><td bgcolor="${E.card}" align="center" style="padding:20px 40px 34px;background-color:${E.card};">
            <div class="em-soft" style="font-size:12px;font-weight:700;color:${E.inkSoft};letter-spacing:0.3px;">${esc(LEGAL)}</div>
            <div class="em-mute" style="font-size:11px;line-height:1.6;color:${E.inkMute};margin:6px auto 0;max-width:360px;">${esc(ADDRESS)}</div>
            <div class="em-mute" style="font-size:11px;color:${E.inkMute};margin-top:12px;">
              &copy; ${year} <a href="${esc(BASE_URL)}" style="color:${E.mint};text-decoration:none;font-weight:600;">${esc(SITE)}</a>
              &nbsp;&middot;&nbsp; Notifikasi otomatis
            </div>
          </td></tr>

        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Tombol CTA emerald (teks gelap; tahan Outlook via VML). */
function ctaButton(href: string, label: string) {
  return `
            <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:50px;v-text-anchor:middle;width:320px;" arcsize="22%" fillcolor="${E.emerald}" stroke="f">
            <w:anchorlock/><center style="color:${E.btnText};font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">${label}</center>
            </v:roundrect>
            <![endif]-->
            <!--[if !mso]><!-- -->
            <a href="${href}" target="_blank" rel="noopener noreferrer"
               style="display:inline-block;background-color:${E.emerald};background-image:linear-gradient(90deg,${E.emeraldBright},${E.emerald});color:${E.btnText};text-decoration:none;font-size:14.5px;font-weight:800;padding:15px 38px;border-radius:12px;letter-spacing:0.2px;">
              ${label} &nbsp;&rarr;
            </a>
            <!--<![endif]-->`;
}

/* ===========================================================================
 *  EMAIL 1: AGENT BARU BERGABUNG  →  OWNER / PRINCIPAL / UPLINE
 * ========================================================================= */

export type NewAgentEmailOpts = {
  recipientName?: string | null;
  recipientRole: "OWNER" | "PRINCIPAL" | "UPLINE";
  agentName: string;
  agentId: string;
  office: string;
  area: string;
  whatsapp?: string | null;
  agentEmail?: string | null;
  joinedAt?: Date | null;
  reviewUrl: string;
  uplineCode?: string | null;
};

export function newAgentEmailHtml(o: NewAgentEmailOpts) {
  const name = esc(o.agentName || "Agent Baru");
  const office = esc(o.office || "-");
  const area = esc(o.area || "-");
  const agentId = esc(o.agentId || "-");
  const initials = esc(initialsOf(o.agentName));
  const joined = esc(formatJoinedAt(o.joinedAt));
  const wa = waDigits(o.whatsapp);
  const waDisplay = esc(o.whatsapp || "-");
  const emailDisplay = esc(o.agentEmail || "-");
  const review = esc(o.reviewUrl);
  const greet = o.recipientName ? `Halo, ${esc(o.recipientName)}` : "Halo";
  const uplineCode = esc(o.uplineCode || "-");
  const isUpline = o.recipientRole === "UPLINE";

  const strong = (t: string) =>
    `<strong class="em-mint" style="color:${E.mint};font-weight:700;">${t}</strong>`;

  const pillText = isUpline ? "Referral Berhasil" : "Agent Baru Bergabung";

  const headline = isUpline
    ? `${greet}! Jaringan Anda<br>bertambah 🎉`
    : `${greet}! Ada talenta baru<br>di tim Anda 🎉`;

  const lead = isUpline
    ? `${strong(name)} baru saja mendaftar sebagai agent menggunakan kode referral ${strong(uplineCode)} milik Anda.`
    : o.recipientRole === "OWNER"
      ? `Seorang agent baru telah mendaftar di jaringan ${strong(esc(SITE))} dan menunggu verifikasi.`
      : `Seorang agent baru telah mendaftar di kantor ${strong(office)} yang Anda pimpin, dan menunggu verifikasi.`;

  const ctaLabel = isUpline ? "Lihat Detail Agent" : "Tinjau &amp; Verifikasi Agent";
  const ctaSub = isUpline
    ? `Agent ini terhubung ke jaringan Anda melalui<br>kode referral. Verifikasi diproses oleh pimpinan kantor.`
    : `Buka panel <strong style="color:${E.inkSoft};font-weight:700;">Human Resource Management</strong><br>untuk memverifikasi &amp; mengaktifkan agent ini.`;

  const noteTitle = isUpline ? "Sedang menunggu verifikasi." : "Status masih PENDING.";
  const noteBody = isUpline
    ? `Pendaftaran ini sedang ditinjau oleh principal/owner kantor. Agent akan otomatis aktif di jaringan Anda begitu disetujui — tidak ada tindakan yang perlu Anda lakukan.`
    : `Agent belum dapat mengakses fitur penuh sampai Anda menyetujui pendaftaran. Pastikan dokumen (KTP, NPWP, foto profil) sudah valid sebelum mengaktifkan.`;

  const content = `
          <!-- pill -->
          <tr><td bgcolor="${E.card}" align="center" style="padding:20px 40px 0;background-color:${E.card};">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.panel}" style="background-color:${E.panel};border:1px solid ${E.panelBorder};border-radius:999px;">
              <tr><td class="em-mint" style="padding:7px 16px 7px 14px;font-size:10.5px;letter-spacing:2.5px;text-transform:uppercase;color:${E.mint};font-weight:800;">
                <span style="color:${E.emeraldBright};">&#9679;</span>&nbsp;&nbsp;${pillText}
              </td></tr>
            </table>
          </td></tr>

          <!-- hero -->
          <tr><td bgcolor="${E.card}" align="center" style="padding:16px 40px 0;background-color:${E.card};">
            <h1 class="em-ink" style="margin:0;font-size:24px;line-height:1.3;font-weight:800;color:${E.ink};letter-spacing:-0.2px;">${headline}</h1>
            <p class="em-soft" style="margin:13px auto 0;font-size:14.5px;line-height:1.65;color:${E.inkSoft};max-width:430px;">${lead}</p>
          </td></tr>

          <!-- profile card -->
          <tr><td bgcolor="${E.card}" style="padding:24px 28px 0;background-color:${E.card};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.panel}" class="em-panel" style="background-color:${E.panel};border:1px solid ${E.panelBorder};border-radius:18px;">
              <tr><td style="padding:22px 22px 16px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td valign="middle" width="64" style="width:64px;">
                    <div style="width:60px;height:60px;line-height:60px;text-align:center;border-radius:16px;background-color:${E.emerald};background-image:linear-gradient(145deg,${E.emeraldBright},${E.emerald});color:${E.btnText};font-size:22px;font-weight:800;">${initials}</div>
                  </td>
                  <td width="15" style="width:15px;">&nbsp;</td>
                  <td valign="middle" align="left">
                    <div class="em-ink" style="font-size:17px;font-weight:800;color:${E.ink};line-height:1.25;">${name}</div>
                    <div style="margin-top:7px;">
                      <span style="display:inline-block;font-family:'SFMono-Regular',Consolas,Menlo,monospace;font-size:11px;color:${E.mint};background-color:#082018;border:1px solid ${E.panelBorder};border-radius:7px;padding:3px 9px;letter-spacing:0.5px;">${agentId}</span>
                      <span style="display:inline-block;font-size:10px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:${E.amber};background-color:${E.amberBg};border:1px solid ${E.amberBorder};border-radius:7px;padding:4px 9px;margin-left:4px;">&#9203; Pending</span>
                    </div>
                  </td>
                </tr></table>
              </td></tr>
              <tr><td style="padding:0 22px 8px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  ${dataRow("Kantor", office)}
                  ${dataRow("Kota / Area", area)}
                  ${wa ? dataRow("WhatsApp", waDisplay, { href: `https://wa.me/${wa}` }) : dataRow("WhatsApp", waDisplay)}
                  ${o.agentEmail ? dataRow("Email", emailDisplay, { href: `mailto:${esc(o.agentEmail)}` }) : ""}
                  ${dataRow("Waktu Pendaftaran", joined)}
                </table>
              </td></tr>
            </table>
          </td></tr>

          <!-- CTA -->
          <tr><td bgcolor="${E.card}" align="center" style="padding:24px 40px 4px;background-color:${E.card};">
            ${ctaButton(review, ctaLabel)}
            <div class="em-mute" style="margin-top:13px;font-size:11.5px;color:${E.inkMute};line-height:1.6;">${ctaSub}</div>
          </td></tr>

          <!-- info note -->
          <tr><td bgcolor="${E.card}" style="padding:22px 40px 0;background-color:${E.card};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.amberBg}" style="background-color:${E.amberBg};border:1px solid ${E.amberBorder};border-radius:14px;">
              <tr>
                <td valign="top" width="40" style="padding:14px 0 14px 16px;font-size:17px;">&#128274;</td>
                <td class="em-soft" style="padding:14px 16px 14px 8px;font-size:12.5px;line-height:1.65;color:${E.inkSoft};">
                  <strong style="color:${E.amber};font-weight:700;">${noteTitle}</strong><br>${noteBody}
                </td>
              </tr>
            </table>
          </td></tr>
          ${helpRow()}`;

  return renderEmailShell({
    title: `${BRAND} — Agent Baru Bergabung`,
    preheader: `${o.agentName} baru saja mendaftar sebagai agent · status PENDING · menunggu verifikasi Anda.`,
    content,
  });
}

export async function sendNewAgentEmail(
  to: string,
  opts: NewAgentEmailOpts
): Promise<{ delivered: boolean }> {
  if (!isMailConfigured()) {
    console.warn(
      `\n📧 [DEV] SMTP belum dikonfigurasi. Email "agent baru" untuk ${to} tidak dikirim.\n` +
        `   Agent: ${opts.agentName} (${opts.agentId}) — kantor ${opts.office}.\n`
    );
    return { delivered: false };
  }

  const isUpline = opts.recipientRole === "UPLINE";
  const subject = isUpline
    ? `🎉 ${opts.agentName} bergabung pakai kode referral Anda · ${BRAND}`
    : `🎉 Agent baru: ${opts.agentName} menunggu verifikasi · ${BRAND}`;

  const intro = isUpline
    ? `${opts.agentName} (${opts.agentId}) baru saja mendaftar sebagai agent menggunakan kode referral ${opts.uplineCode || "-"} milik Anda.`
    : `${opts.agentName} (${opts.agentId}) baru saja mendaftar sebagai agent dan menunggu verifikasi.`;

  try {
    await getTransport().sendMail({
      from: `"${BRAND}" <${GMAIL_USER}>`,
      to,
      subject,
      text:
        `${isUpline ? "Referral Berhasil" : "Agent Baru Bergabung"} — ${BRAND}\n\n` +
        `${intro}\n\n` +
        `Kantor          : ${opts.office}\n` +
        `Kota / Area     : ${opts.area}\n` +
        `WhatsApp        : ${opts.whatsapp || "-"}\n` +
        `Email           : ${opts.agentEmail || "-"}\n` +
        `Waktu daftar    : ${formatJoinedAt(opts.joinedAt)}\n` +
        `Status          : PENDING (menunggu verifikasi)\n\n` +
        `${isUpline ? "Lihat detail" : "Tinjau & verifikasi"} di: ${opts.reviewUrl}\n\n` +
        `Butuh bantuan? WhatsApp ${SUPPORT_WA} · email ${SUPPORT_EMAIL}\n` +
        `© ${new Date().getFullYear()} ${LEGAL} · ${SITE}`,
      html: newAgentEmailHtml(opts),
    });
    return { delivered: true };
  } catch (err) {
    console.error("❌ Gagal mengirim email 'agent baru':", err);
    return { delivered: false };
  }
}

/* ===========================================================================
 *  EMAIL 2: USER BARU MENDAFTAR  →  OWNER SAJA
 * ========================================================================= */

export type NewUserEmailOpts = {
  recipientName?: string | null;
  userName: string;
  userEmail?: string | null;
  userPhone?: string | null;
  registeredAt?: Date | null;
  dashboardUrl: string;
};

export function newUserEmailHtml(o: NewUserEmailOpts) {
  const name = esc(o.userName || "Member Baru");
  const initials = esc(initialsOf(o.userName));
  const joined = esc(formatJoinedAt(o.registeredAt));
  const emailDisplay = esc(o.userEmail || "-");
  const phoneDisplay = esc(o.userPhone || "-");
  const dashboard = esc(o.dashboardUrl);
  const greet = o.recipientName ? `Halo, ${esc(o.recipientName)}` : "Halo";

  const strong = (t: string) =>
    `<strong class="em-mint" style="color:${E.mint};font-weight:700;">${t}</strong>`;

  const lead = `${strong(name)} baru saja membuat akun baru di platform ${strong(esc(SITE))}.`;

  const content = `
          <!-- pill -->
          <tr><td bgcolor="${E.card}" align="center" style="padding:20px 40px 0;background-color:${E.card};">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.panel}" style="background-color:${E.panel};border:1px solid ${E.panelBorder};border-radius:999px;">
              <tr><td class="em-mint" style="padding:7px 16px 7px 14px;font-size:10.5px;letter-spacing:2.5px;text-transform:uppercase;color:${E.mint};font-weight:800;">
                <span style="color:${E.emeraldBright};">&#9679;</span>&nbsp;&nbsp;Member Baru Bergabung
              </td></tr>
            </table>
          </td></tr>

          <!-- hero -->
          <tr><td bgcolor="${E.card}" align="center" style="padding:16px 40px 0;background-color:${E.card};">
            <h1 class="em-ink" style="margin:0;font-size:24px;line-height:1.3;font-weight:800;color:${E.ink};letter-spacing:-0.2px;">${greet}! Ada member baru<br>di platform Anda &#128075;</h1>
            <p class="em-soft" style="margin:13px auto 0;font-size:14.5px;line-height:1.65;color:${E.inkSoft};max-width:430px;">${lead}</p>
          </td></tr>

          <!-- profile card -->
          <tr><td bgcolor="${E.card}" style="padding:24px 28px 0;background-color:${E.card};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.panel}" class="em-panel" style="background-color:${E.panel};border:1px solid ${E.panelBorder};border-radius:18px;">
              <tr><td style="padding:22px 22px 16px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td valign="middle" width="64" style="width:64px;">
                    <div style="width:60px;height:60px;line-height:60px;text-align:center;border-radius:16px;background-color:${E.teal};background-image:linear-gradient(145deg,${E.mint},${E.teal});color:${E.btnText};font-size:22px;font-weight:800;">${initials}</div>
                  </td>
                  <td width="15" style="width:15px;">&nbsp;</td>
                  <td valign="middle" align="left">
                    <div class="em-ink" style="font-size:17px;font-weight:800;color:${E.ink};line-height:1.25;">${name}</div>
                    <div style="margin-top:7px;">
                      <span style="display:inline-block;font-size:10px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:${E.green};background-color:${E.greenBg};border:1px solid ${E.greenBorder};border-radius:7px;padding:4px 9px;">&#10003;&nbsp; Aktif</span>
                    </div>
                  </td>
                </tr></table>
              </td></tr>
              <tr><td style="padding:0 22px 8px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  ${o.userEmail ? dataRow("Email", emailDisplay, { href: `mailto:${esc(o.userEmail)}` }) : dataRow("No. HP", phoneDisplay)}
                  ${dataRow("Waktu Daftar", joined)}
                </table>
              </td></tr>
            </table>
          </td></tr>

          <!-- CTA -->
          <tr><td bgcolor="${E.card}" align="center" style="padding:24px 40px 4px;background-color:${E.card};">
            ${ctaButton(dashboard, "Lihat Data Member")}
            <div class="em-mute" style="margin-top:13px;font-size:11.5px;color:${E.inkMute};line-height:1.6;">Buka <strong style="color:${E.inkSoft};font-weight:700;">Dashboard</strong> untuk melihat seluruh daftar member terdaftar.</div>
          </td></tr>

          <!-- info note -->
          <tr><td bgcolor="${E.card}" style="padding:22px 40px 0;background-color:${E.card};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.greenBg}" style="background-color:${E.greenBg};border:1px solid ${E.greenBorder};border-radius:14px;">
              <tr>
                <td valign="top" width="40" style="padding:14px 0 14px 16px;font-size:17px;">&#9989;</td>
                <td class="em-soft" style="padding:14px 16px 14px 8px;font-size:12.5px;line-height:1.65;color:${E.inkSoft};">
                  <strong style="color:${E.green};font-weight:700;">Akun langsung aktif.</strong><br>Member baru ini sudah dapat login dan menggunakan platform tanpa perlu verifikasi tambahan.
                </td>
              </tr>
            </table>
          </td></tr>
          ${helpRow()}`;

  return renderEmailShell({
    title: `${BRAND} — Member Baru Mendaftar`,
    preheader: `${o.userName} baru saja membuat akun di ${SITE} · akun langsung aktif.`,
    content,
  });
}

export async function sendNewUserEmail(
  to: string,
  opts: NewUserEmailOpts
): Promise<{ delivered: boolean }> {
  if (!isMailConfigured()) {
    console.warn(
      `\n📧 [DEV] SMTP belum dikonfigurasi. Email "user baru" untuk ${to} tidak dikirim.\n` +
        `   User: ${opts.userName} — email ${opts.userEmail || "-"} · HP ${opts.userPhone || "-"}.\n`
    );
    return { delivered: false };
  }

  try {
    await getTransport().sendMail({
      from: `"${BRAND}" <${GMAIL_USER}>`,
      to,
      subject: `👋 Member baru: ${opts.userName} baru saja mendaftar · ${BRAND}`,
      text:
        `Member Baru Bergabung — ${BRAND}\n\n` +
        `${opts.userName} baru saja membuat akun di ${SITE}.\n\n` +
        (opts.userEmail ? `Email           : ${opts.userEmail}\n` : `No. HP          : ${opts.userPhone || "-"}\n`) +
        `Waktu daftar    : ${formatJoinedAt(opts.registeredAt)}\n` +
        `Status          : AKTIF (langsung dapat digunakan)\n\n` +
        `Lihat data member di: ${opts.dashboardUrl}\n\n` +
        `Butuh bantuan? WhatsApp ${SUPPORT_WA} · email ${SUPPORT_EMAIL}\n` +
        `© ${new Date().getFullYear()} ${LEGAL} · ${SITE}`,
      html: newUserEmailHtml(opts),
    });
    return { delivered: true };
  } catch (err) {
    console.error("❌ Gagal mengirim email 'user baru':", err);
    return { delivered: false };
  }
}

/* ===========================================================================
 *  EMAIL 3: REFERRAL KLIEN BERHASIL  →  AGENT PERUJUK
 * ========================================================================= */

export type ReferralKlienEmailOpts = {
  agentName?: string | null;
  klienName: string;
  klienEmail?: string | null;
  klienPhone?: string | null;
  kodeReferral: string;
  poin: number;
  registeredAt?: Date | null;
  crmUrl: string;
};

export function referralKlienEmailHtml(o: ReferralKlienEmailOpts) {
  const agentGreet = o.agentName ? `Halo, ${esc(o.agentName)}` : "Halo";
  const klien = esc(o.klienName || "Klien Baru");
  const initials = esc(initialsOf(o.klienName));
  const kode = esc(o.kodeReferral);
  const poinStr = esc(o.poin.toLocaleString("id-ID"));
  const joined = esc(formatJoinedAt(o.registeredAt));
  const emailDisplay = esc(o.klienEmail || "");
  const phoneDisplay = esc(o.klienPhone || "");
  const crmUrl = esc(o.crmUrl);

  const strong = (t: string) =>
    `<strong class="em-mint" style="color:${E.mint};font-weight:700;">${t}</strong>`;

  const contactRow = o.klienEmail
    ? dataRow("Email", emailDisplay, { href: `mailto:${esc(o.klienEmail)}` })
    : o.klienPhone
      ? dataRow("No. HP", phoneDisplay)
      : "";

  const content = `
          <!-- pill -->
          <tr><td bgcolor="${E.card}" align="center" style="padding:20px 40px 0;background-color:${E.card};">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.greenBg}" style="background-color:${E.greenBg};border:1px solid ${E.greenBorder};border-radius:999px;">
              <tr><td style="padding:7px 16px 7px 14px;font-size:10.5px;letter-spacing:2.5px;text-transform:uppercase;color:${E.green};font-weight:800;">
                <span style="color:${E.green};">&#9679;</span>&nbsp;&nbsp;Referral Klien Berhasil
              </td></tr>
            </table>
          </td></tr>

          <!-- hero -->
          <tr><td bgcolor="${E.card}" align="center" style="padding:16px 40px 0;background-color:${E.card};">
            <h1 class="em-ink" style="margin:0;font-size:24px;line-height:1.3;font-weight:800;color:${E.ink};letter-spacing:-0.2px;">${agentGreet}! Ada klien baru<br>pakai kode referral kamu &#127881;</h1>
            <p class="em-soft" style="margin:13px auto 0;font-size:14.5px;line-height:1.65;color:${E.inkSoft};max-width:430px;">${strong(klien)} baru saja mendaftar menggunakan kode referral ${strong(kode)} milikmu. Kamu mendapat ${strong("+" + poinStr + " poin")}!</p>
          </td></tr>

          <!-- klien card -->
          <tr><td bgcolor="${E.card}" style="padding:24px 28px 0;background-color:${E.card};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.panel}" class="em-panel" style="background-color:${E.panel};border:1px solid ${E.panelBorder};border-radius:18px;">
              <tr><td style="padding:22px 22px 16px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td valign="middle" width="64" style="width:64px;">
                    <div style="width:60px;height:60px;line-height:60px;text-align:center;border-radius:16px;background-color:${E.teal};background-image:linear-gradient(145deg,${E.mint},${E.teal});color:${E.btnText};font-size:22px;font-weight:800;">${initials}</div>
                  </td>
                  <td width="15" style="width:15px;">&nbsp;</td>
                  <td valign="middle" align="left">
                    <div class="em-ink" style="font-size:17px;font-weight:800;color:${E.ink};line-height:1.25;">${klien}</div>
                    <div style="margin-top:7px;">
                      <span style="display:inline-block;font-family:'SFMono-Regular',Consolas,Menlo,monospace;font-size:11px;color:${E.mint};background-color:#082018;border:1px solid ${E.panelBorder};border-radius:7px;padding:3px 9px;letter-spacing:0.5px;">${kode}</span>
                      <span style="display:inline-block;font-size:10px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:${E.green};background-color:${E.greenBg};border:1px solid ${E.greenBorder};border-radius:7px;padding:4px 9px;margin-left:4px;">+${poinStr} poin</span>
                    </div>
                  </td>
                </tr></table>
              </td></tr>
              <tr><td style="padding:0 22px 8px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  ${contactRow}
                  ${dataRow("Waktu Daftar", joined)}
                </table>
              </td></tr>
            </table>
          </td></tr>

          <!-- CTA -->
          <tr><td bgcolor="${E.card}" align="center" style="padding:24px 40px 4px;background-color:${E.card};">
            ${ctaButton(crmUrl, "Lihat di CRM")}
            <div class="em-mute" style="margin-top:13px;font-size:11.5px;color:${E.inkMute};line-height:1.6;">Klien ini sudah otomatis masuk ke <strong style="color:${E.inkSoft};font-weight:700;">CRM</strong> kamu dengan status <em>lead baru</em>.</div>
          </td></tr>

          <!-- info note -->
          <tr><td bgcolor="${E.card}" style="padding:22px 40px 0;background-color:${E.card};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.greenBg}" style="background-color:${E.greenBg};border:1px solid ${E.greenBorder};border-radius:14px;">
              <tr>
                <td valign="top" width="40" style="padding:14px 0 14px 16px;font-size:17px;">&#128176;</td>
                <td class="em-soft" style="padding:14px 16px 14px 8px;font-size:12.5px;line-height:1.65;color:${E.inkSoft};">
                  <strong style="color:${E.green};font-weight:700;">Poin sudah masuk.</strong><br>+${poinStr} poin telah ditambahkan ke akun kamu. Terus bagikan kode referralmu dan kumpulkan lebih banyak poin!
                </td>
              </tr>
            </table>
          </td></tr>
          ${helpRow()}`;

  return renderEmailShell({
    title: `${BRAND} — Referral Klien Berhasil`,
    preheader: `${o.klienName} mendaftar pakai kode referral ${o.kodeReferral} milikmu · +${o.poin.toLocaleString("id-ID")} poin masuk ke akunmu.`,
    content,
  });
}

export async function sendReferralKlienEmail(
  to: string,
  opts: ReferralKlienEmailOpts
): Promise<{ delivered: boolean }> {
  if (!isMailConfigured()) {
    console.warn(
      `\n📧 [DEV] SMTP belum dikonfigurasi. Email referral klien untuk ${to} tidak dikirim.\n` +
        `   Klien: ${opts.klienName} — kode ${opts.kodeReferral} — +${opts.poin} poin.\n`
    );
    return { delivered: false };
  }

  try {
    await getTransport().sendMail({
      from: `"${BRAND}" <${GMAIL_USER}>`,
      to,
      subject: `🎉 Klien baru pakai kode referral kamu · ${BRAND}`,
      text:
        `Referral Klien Berhasil — ${BRAND}\n\n` +
        `${opts.klienName} baru saja mendaftar menggunakan kode referral ${opts.kodeReferral} milikmu.\n\n` +
        (opts.klienEmail ? `Email klien    : ${opts.klienEmail}\n` : opts.klienPhone ? `HP klien       : ${opts.klienPhone}\n` : "") +
        `Waktu daftar   : ${formatJoinedAt(opts.registeredAt)}\n` +
        `Poin didapat   : +${opts.poin.toLocaleString("id-ID")} poin\n\n` +
        `Lihat klien di CRM: ${opts.crmUrl}\n\n` +
        `Butuh bantuan? WhatsApp ${SUPPORT_WA} · email ${SUPPORT_EMAIL}\n` +
        `© ${new Date().getFullYear()} ${LEGAL} · ${SITE}`,
      html: referralKlienEmailHtml(opts),
    });
    return { delivered: true };
  } catch (err) {
    console.error("❌ Gagal mengirim email referral klien:", err);
    return { delivered: false };
  }
}

/* ===========================================================================
 *  EMAIL 4: KEPUTUSAN PENDAFTARAN  →  AGENT (diterima / ditolak)
 * ========================================================================= */

export type AgentDecisionEmailOpts = {
  agentName: string;
  agentId: string;
  office?: string | null;
  decision: "ACCEPTED" | "REJECTED";
  wasPending?: boolean;
  actionUrl: string;
  note?: string | null;
};

export function agentDecisionEmailHtml(o: AgentDecisionEmailOpts) {
  const name = esc(o.agentName || "Agent");
  const agentId = esc(o.agentId || "-");
  const office = esc(o.office || "-");
  const initials = esc(initialsOf(o.agentName));
  const action = esc(o.actionUrl);
  const accepted = o.decision === "ACCEPTED";
  const noteText = o.note ? esc(o.note) : "";

  const accent = accepted ? E.green : E.rose;
  const pillBg = accepted ? E.greenBg : E.roseBg;
  const pillBorder = accepted ? E.greenBorder : E.roseBorder;

  const pillText = accepted
    ? o.wasPending
      ? "Pendaftaran Diterima"
      : "Akun Diaktifkan"
    : o.wasPending
      ? "Hasil Peninjauan"
      : "Akun Dinonaktifkan";

  const headline = accepted ? `Selamat, ${name}! 🎉` : `Halo, ${name}`;

  const lead = accepted
    ? o.wasPending
      ? `Kabar baik! Pendaftaran Anda sebagai agent <strong style="color:${accent};font-weight:700;">${esc(SITE)}</strong> telah <strong style="color:${accent};font-weight:700;">disetujui</strong>. Akun Anda kini berstatus AKTIF dan siap digunakan.`
      : `Akun agent Anda telah <strong style="color:${accent};font-weight:700;">diaktifkan kembali</strong>. Selamat datang kembali!`
    : o.wasPending
      ? `Terima kasih atas minat Anda bergabung bersama kami. Mohon maaf, untuk saat ini pendaftaran Anda <strong style="color:${accent};font-weight:700;">belum dapat kami setujui</strong>.`
      : `Kami informasikan bahwa akun agent Anda untuk sementara <strong style="color:${accent};font-weight:700;">dinonaktifkan</strong>.`;

  const statusBadge = accepted ? "AKTIF" : o.wasPending ? "Belum Disetujui" : "Nonaktif";
  const badgeIcon = accepted ? "&#10003;" : "&#10005;";

  const ctaLabel = accepted
    ? "Masuk ke Dashboard"
    : o.wasPending
      ? "Ajukan Pendaftaran Ulang"
      : "Hubungi Tim Kami";

  const noteTitle = accepted ? "Langkah berikutnya" : "Ada pertanyaan?";
  const noteBody = accepted
    ? `Masuk ke dashboard untuk melengkapi profil, menambah listing, dan mulai closing. Selamat berkarya bersama ${BRAND}! 🚀`
    : `Anda dapat menghubungi pimpinan kantor atau tim kami untuk informasi lebih lanjut${o.wasPending ? ", dan mengajukan pendaftaran kembali setelah melengkapi persyaratan" : ""}.`;

  const reasonBlock = noteText
    ? `
          <tr><td bgcolor="${E.card}" style="padding:18px 40px 0;background-color:${E.card};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.panel}" class="em-panel" style="background-color:${E.panel};border:1px solid ${E.panelBorder};border-radius:14px;">
              <tr><td style="padding:14px 18px;">
                <div class="em-emerald" style="font-size:9.5px;letter-spacing:2px;text-transform:uppercase;color:${E.emeraldBright};font-weight:700;margin-bottom:6px;">Catatan dari Peninjau</div>
                <div class="em-ink" style="font-size:13px;line-height:1.6;color:${E.ink};">${noteText}</div>
              </td></tr>
            </table>
          </td></tr>`
    : "";

  const content = `
          <!-- pill -->
          <tr><td bgcolor="${E.card}" align="center" style="padding:20px 40px 0;background-color:${E.card};">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="${pillBg}" style="background-color:${pillBg};border:1px solid ${pillBorder};border-radius:999px;">
              <tr><td style="padding:7px 16px 7px 14px;font-size:10.5px;letter-spacing:2.5px;text-transform:uppercase;color:${accent};font-weight:800;">
                <span style="color:${accent};">&#9679;</span>&nbsp;&nbsp;${pillText}
              </td></tr>
            </table>
          </td></tr>

          <!-- hero -->
          <tr><td bgcolor="${E.card}" align="center" style="padding:16px 40px 0;background-color:${E.card};">
            <h1 class="em-ink" style="margin:0;font-size:24px;line-height:1.3;font-weight:800;color:${E.ink};letter-spacing:-0.2px;">${headline}</h1>
            <p class="em-soft" style="margin:13px auto 0;font-size:14.5px;line-height:1.65;color:${E.inkSoft};max-width:430px;">${lead}</p>
          </td></tr>

          <!-- agent card -->
          <tr><td bgcolor="${E.card}" style="padding:22px 40px 0;background-color:${E.card};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.panel}" class="em-panel" style="background-color:${E.panel};border:1px solid ${E.panelBorder};border-radius:18px;">
              <tr><td style="padding:20px 22px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td valign="middle" width="58" style="width:58px;">
                    <div style="width:54px;height:54px;line-height:54px;text-align:center;border-radius:15px;background-color:${E.emerald};background-image:linear-gradient(145deg,${E.emeraldBright},${E.emerald});color:${E.btnText};font-size:20px;font-weight:800;">${initials}</div>
                  </td>
                  <td width="14" style="width:14px;">&nbsp;</td>
                  <td valign="middle" align="left">
                    <div class="em-ink" style="font-size:16px;font-weight:800;color:${E.ink};line-height:1.25;">${name}</div>
                    <div style="margin-top:6px;">
                      <span style="display:inline-block;font-family:'SFMono-Regular',Consolas,Menlo,monospace;font-size:11px;color:${E.mint};background-color:#082018;border:1px solid ${E.panelBorder};border-radius:7px;padding:3px 9px;">${agentId}</span>
                      <span style="display:inline-block;font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:${accent};background-color:${pillBg};border:1px solid ${pillBorder};border-radius:7px;padding:4px 9px;margin-left:4px;">${badgeIcon}&nbsp; ${statusBadge}</span>
                    </div>
                    <div class="em-mute" style="margin-top:8px;font-size:11.5px;color:${E.inkMute};">Kantor: <span class="em-soft" style="color:${E.inkSoft};font-weight:600;">${office}</span></div>
                  </td>
                </tr></table>
              </td></tr>
            </table>
          </td></tr>
          ${reasonBlock}

          <!-- CTA -->
          <tr><td bgcolor="${E.card}" align="center" style="padding:24px 40px 4px;background-color:${E.card};">
            ${ctaButton(action, ctaLabel)}
          </td></tr>

          <!-- info note -->
          <tr><td bgcolor="${E.card}" style="padding:22px 40px 0;background-color:${E.card};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.panel}" class="em-panel" style="background-color:${E.panel};border:1px solid ${E.panelBorder};border-radius:14px;">
              <tr>
                <td valign="top" width="40" style="padding:14px 0 14px 16px;font-size:17px;">${accepted ? "&#128640;" : "&#128172;"}</td>
                <td class="em-soft" style="padding:14px 16px 14px 8px;font-size:12.5px;line-height:1.65;color:${E.inkSoft};">
                  <strong class="em-mint" style="color:${E.mint};font-weight:700;">${noteTitle}.</strong><br>${noteBody}
                </td>
              </tr>
            </table>
          </td></tr>
          ${helpRow()}`;

  return renderEmailShell({
    title: `${BRAND} — Status Pendaftaran Agent`,
    preheader: accepted
      ? `Selamat! Pendaftaran agent Anda telah disetujui dan akun Anda kini AKTIF.`
      : `Informasi mengenai status pendaftaran/akun agent Anda di ${SITE}.`,
    content,
  });
}

export async function sendAgentDecisionEmail(
  to: string,
  opts: AgentDecisionEmailOpts
): Promise<{ delivered: boolean }> {
  if (!isMailConfigured()) {
    console.warn(
      `\n📧 [DEV] SMTP belum dikonfigurasi. Email keputusan (${opts.decision}) untuk ${to} tidak dikirim.\n` +
        `   Agent: ${opts.agentName} (${opts.agentId}).\n`
    );
    return { delivered: false };
  }

  const accepted = opts.decision === "ACCEPTED";
  const subject = accepted
    ? opts.wasPending
      ? `🎉 Selamat! Pendaftaran agent Anda diterima · ${BRAND}`
      : `✅ Akun agent Anda telah diaktifkan · ${BRAND}`
    : `Informasi status pendaftaran agent Anda · ${BRAND}`;

  const bodyLine = accepted
    ? opts.wasPending
      ? `Selamat! Pendaftaran Anda sebagai agent ${SITE} telah DISETUJUI. Akun Anda kini AKTIF dan siap digunakan.`
      : `Akun agent Anda telah diaktifkan kembali. Selamat datang kembali!`
    : opts.wasPending
      ? `Mohon maaf, untuk saat ini pendaftaran Anda sebagai agent belum dapat kami setujui.`
      : `Akun agent Anda untuk sementara dinonaktifkan.`;

  try {
    await getTransport().sendMail({
      from: `"${BRAND}" <${GMAIL_USER}>`,
      to,
      subject,
      text:
        `Status Pendaftaran Agent — ${BRAND}\n\n` +
        `Halo ${opts.agentName} (${opts.agentId}),\n\n` +
        `${bodyLine}\n` +
        (opts.note ? `\nCatatan dari peninjau: ${opts.note}\n` : "") +
        `\n${accepted ? "Masuk ke dashboard" : "Selengkapnya"}: ${opts.actionUrl}\n\n` +
        `Butuh bantuan? WhatsApp ${SUPPORT_WA} · email ${SUPPORT_EMAIL}\n` +
        `© ${new Date().getFullYear()} ${LEGAL} · ${SITE}`,
      html: agentDecisionEmailHtml(opts),
    });
    return { delivered: true };
  } catch (err) {
    console.error("❌ Gagal mengirim email keputusan agent:", err);
    return { delivered: false };
  }
}

/* ===========================================================================
 *  EMAIL 3: OTP / KODE VERIFIKASI  →  reset kata sandi
 * ========================================================================= */

function otpEmailHtml(otp: string) {
  const code = esc(otp);
  const content = `
          <!-- pill -->
          <tr><td bgcolor="${E.card}" align="center" style="padding:20px 40px 0;background-color:${E.card};">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.panel}" style="background-color:${E.panel};border:1px solid ${E.panelBorder};border-radius:999px;">
              <tr><td class="em-mint" style="padding:7px 16px;font-size:10.5px;letter-spacing:2.5px;text-transform:uppercase;color:${E.mint};font-weight:800;">
                &#128274;&nbsp;&nbsp;Kode Keamanan
              </td></tr>
            </table>
          </td></tr>

          <!-- hero -->
          <tr><td bgcolor="${E.card}" align="center" style="padding:16px 40px 0;background-color:${E.card};">
            <h1 class="em-ink" style="margin:0;font-size:23px;line-height:1.3;font-weight:800;color:${E.ink};">Kode Verifikasi Anda</h1>
            <p class="em-soft" style="margin:12px auto 0;font-size:14.5px;line-height:1.65;color:${E.inkSoft};max-width:400px;">
              Gunakan kode sekali pakai di bawah untuk melanjutkan proses
              <strong class="em-mint" style="color:${E.mint};font-weight:700;">reset kata sandi</strong> akun Anda.
            </p>
          </td></tr>

          <!-- code panel -->
          <tr><td bgcolor="${E.card}" style="padding:24px 40px 4px;background-color:${E.card};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.panel}" class="em-panel" style="background-color:${E.panel};border:1px solid ${E.panelBorder};border-radius:18px;">
              <tr><td align="center" style="padding:26px 16px;">
                <div class="em-emerald" style="font-size:10.5px;letter-spacing:3px;text-transform:uppercase;color:${E.emeraldBright};font-weight:700;margin-bottom:16px;">Kode Verifikasi Anda</div>
                <div style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,Courier,monospace;font-size:42px;line-height:1;font-weight:800;letter-spacing:14px;color:${E.ink};padding-left:14px;">${code}</div>
                <div style="margin-top:20px;">
                  <a href="${BASE_URL}/salin-otp#${code}" target="_blank" rel="noopener noreferrer"
                     style="display:inline-block;background-color:${E.emerald};background-image:linear-gradient(90deg,${E.emeraldBright},${E.emerald});color:${E.btnText};text-decoration:none;font-size:13.5px;font-weight:700;padding:12px 26px;border-radius:10px;">
                    &#128203;&nbsp;&nbsp;Salin Kode
                  </a>
                </div>
                <div class="em-mute" style="margin-top:12px;font-size:11.5px;color:${E.inkMute};">
                  &#9201;&nbsp; Berlaku 10 menit &nbsp;&middot;&nbsp; ketuk untuk menyalin
                </div>
              </td></tr>
            </table>
          </td></tr>

          <!-- security note -->
          <tr><td bgcolor="${E.card}" style="padding:20px 40px 0;background-color:${E.card};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.amberBg}" style="background-color:${E.amberBg};border:1px solid ${E.amberBorder};border-radius:14px;">
              <tr>
                <td valign="top" width="40" style="padding:14px 0 14px 16px;font-size:17px;">&#128272;</td>
                <td class="em-soft" style="padding:14px 16px 14px 8px;font-size:12.5px;line-height:1.65;color:${E.inkSoft};">
                  <strong style="color:${E.amber};font-weight:700;">Jaga kerahasiaan kode ini.</strong><br>
                  ${BRAND} tidak akan pernah meminta kode OTP Anda melalui telepon, chat, maupun email. Jika Anda tidak meminta reset kata sandi, abaikan email ini — akun Anda tetap aman.
                </td>
              </tr>
            </table>
          </td></tr>
          ${helpRow()}`;

  return renderEmailShell({
    title: `${BRAND} — Kode Verifikasi`,
    preheader: `Kode verifikasi sekali pakai Anda berlaku 10 menit. Jangan bagikan kepada siapa pun.`,
    content,
  });
}

export async function sendOtpEmail(to: string, otp: string): Promise<{ delivered: boolean }> {
  if (!isMailConfigured()) {
    console.warn(
      `\n📧 [DEV] SMTP belum dikonfigurasi. OTP untuk ${to} = ${otp}\n` +
        `   Isi GMAIL_USER & GMAIL_APP_PASSWORD di .env untuk mengirim email sungguhan.\n`
    );
    return { delivered: false };
  }

  try {
    await getTransport().sendMail({
      from: `"${BRAND}" <${GMAIL_USER}>`,
      to,
      subject: `${otp} adalah kode verifikasi Anda · ${BRAND}`,
      text:
        `Kode Verifikasi ${BRAND}\n\n` +
        `Kode sekali pakai Anda: ${otp}\n` +
        `Kode ini berlaku selama 10 menit.\n\n` +
        `Gunakan kode ini untuk menyelesaikan reset kata sandi akun Anda.\n` +
        `Jangan bagikan kode ini kepada siapa pun — ${BRAND} tidak akan pernah memintanya.\n` +
        `Jika Anda tidak meminta reset, abaikan email ini.\n\n` +
        `Butuh bantuan? WhatsApp ${SUPPORT_WA} · email ${SUPPORT_EMAIL}\n` +
        `© ${new Date().getFullYear()} ${LEGAL} · ${SITE}`,
      html: otpEmailHtml(otp),
    });
    return { delivered: true };
  } catch (err) {
    console.error("❌ Gagal mengirim email OTP:", err);
    return { delivered: false };
  }
}

/* ===========================================================================
 *  EMAIL 6: PENGINGAT ACARA  →  AGENT (dikirim H-3 jam sebelum acara mulai)
 *
 *  Contoh: acara Senin, 6 Juli 2026 pukul 10:00–11:00 → email dikirim
 *  pukul 07:00 (3 jam sebelum mulai). Didesain agar SANGAT mudah dibaca:
 *  waktu ditampilkan besar, bahasa formal & ramah, tips singkat di bawah.
 * ========================================================================= */

export type AgentEventReminderEmailOpts = {
  agentName?: string | null;
  eventTitle: string;
  startAt: Date; // waktu mulai acara
  endAt?: Date | null; // waktu selesai (opsional)
  category?: string | null; // kategori acara, mis. "Open House", "Meeting"
  location?: string | null; // lokasi / tempat acara
  locationUrl?: string | null; // link Google Maps / link meeting online
  notes?: string | null; // catatan tambahan dari agent
  detailUrl: string; // link ke detail acara di dashboard
  now?: Date; // waktu acuan hitung mundur (default: sekarang) — untuk testing
};

export function agentEventReminderEmailHtml(o: AgentEventReminderEmailOpts) {
  const greet = o.agentName ? `Halo, ${esc(o.agentName)}` : "Halo";
  const title = esc(o.eventTitle || "Acara Anda");
  const dateStr = esc(formatEventDate(o.startAt));
  const startClock = esc(formatEventClock(o.startAt));
  const endClock = o.endAt ? esc(formatEventClock(o.endAt)) : "";
  const countdown = esc(humanizeUntil(o.startAt, o.now));
  const category = o.category ? esc(o.category) : "";
  const location = o.location ? esc(o.location) : "";
  const locationUrl = o.locationUrl ? esc(o.locationUrl) : "";
  const notes = o.notes ? esc(o.notes) : "";
  const detail = esc(o.detailUrl);

  const strong = (t: string) =>
    `<strong class="em-mint" style="color:${E.mint};font-weight:700;">${t}</strong>`;

  const timeRange = endClock
    ? `${startClock} &ndash; ${endClock} WIB`
    : `${startClock} WIB`;

  // Chip kategori di dalam tiket (hanya bila ada).
  const categoryChip = category
    ? `<span style="display:inline-block;font-size:10px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:${E.mint};background-color:#082018;border:1px solid ${E.panelBorder};border-radius:999px;padding:5px 13px;margin-bottom:12px;">${category}</span>`
    : "";

  // Blok LOKASI menonjol dengan ikon + tombol "Buka di Peta" (bila ada link).
  const locationBlock = location
    ? `
          <tr><td bgcolor="${E.card}" style="padding:16px 40px 0;background-color:${E.card};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.panel}" class="em-panel" style="background-color:${E.panel};border:1px solid ${E.panelBorder};border-radius:16px;">
              <tr>
                <td valign="top" width="46" style="padding:16px 0 16px 16px;font-size:20px;">&#128205;</td>
                <td style="padding:16px 18px 16px 6px;">
                  <div class="em-emerald" style="font-size:9.5px;letter-spacing:2px;text-transform:uppercase;color:${E.emeraldBright};font-weight:700;margin-bottom:5px;">Lokasi</div>
                  <div class="em-ink" style="font-size:15px;font-weight:700;color:${E.ink};line-height:1.45;">${location}</div>
                  ${
                    locationUrl
                      ? `<a href="${locationUrl}" target="_blank" rel="noopener noreferrer" class="em-mint" style="display:inline-block;margin-top:10px;font-size:12.5px;font-weight:700;color:${E.mint};text-decoration:none;">&#128506;&nbsp; Buka di Peta &nbsp;&rarr;</a>`
                      : ""
                  }
                </td>
              </tr>
            </table>
          </td></tr>`
    : "";

  // Catatan tambahan (bila ada).
  const notesBlock = notes
    ? `
          <tr><td bgcolor="${E.card}" style="padding:16px 40px 0;background-color:${E.card};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.panel}" class="em-panel" style="background-color:${E.panel};border:1px solid ${E.panelBorder};border-radius:16px;">
              <tr>
                <td valign="top" width="46" style="padding:16px 0 16px 16px;font-size:20px;">&#128221;</td>
                <td style="padding:16px 18px 16px 6px;">
                  <div class="em-emerald" style="font-size:9.5px;letter-spacing:2px;text-transform:uppercase;color:${E.emeraldBright};font-weight:700;margin-bottom:5px;">Catatan</div>
                  <div class="em-soft" style="font-size:13.5px;color:${E.inkSoft};line-height:1.6;">${notes}</div>
                </td>
              </tr>
            </table>
          </td></tr>`
    : "";

  const content = `
          <!-- pill -->
          <tr><td bgcolor="${E.card}" align="center" style="padding:20px 40px 0;background-color:${E.card};">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.panel}" style="background-color:${E.panel};border:1px solid ${E.panelBorder};border-radius:999px;">
              <tr><td class="em-mint" style="padding:7px 16px 7px 14px;font-size:10.5px;letter-spacing:2.5px;text-transform:uppercase;color:${E.mint};font-weight:800;">
                &#128276;&nbsp;&nbsp;Pengingat Acara
              </td></tr>
            </table>
          </td></tr>

          <!-- countdown -->
          <tr><td bgcolor="${E.card}" align="center" style="padding:18px 40px 0;background-color:${E.card};">
            <div class="em-emerald" style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${E.emeraldBright};font-weight:700;">Dimulai dalam</div>
            <div class="em-mint" style="font-size:30px;line-height:1.15;font-weight:800;color:${E.mint};letter-spacing:-0.5px;margin-top:4px;">&#9200;&nbsp;${countdown}</div>
          </td></tr>

          <!-- hero -->
          <tr><td bgcolor="${E.card}" align="center" style="padding:14px 40px 0;background-color:${E.card};">
            <h1 class="em-ink" style="margin:0;font-size:23px;line-height:1.3;font-weight:800;color:${E.ink};letter-spacing:-0.2px;">${greet}! &#128075;</h1>
            <p class="em-soft" style="margin:12px auto 0;font-size:15px;line-height:1.7;color:${E.inkSoft};max-width:440px;">
              Ini pengingat untuk acara Anda hari ini. Mohon persiapkan diri dan hadir tepat waktu &mdash; berikut detail lengkapnya di bawah ini.
            </p>
          </td></tr>

          <!-- TIKET ACARA -->
          <tr><td bgcolor="${E.card}" style="padding:24px 28px 0;background-color:${E.card};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.panel}" class="em-panel" style="background-color:${E.panel};border:1px solid ${E.panelBorder};border-radius:20px;">
              <!-- judul acara -->
              <tr><td align="center" style="padding:26px 24px 0;">
                ${categoryChip}
                <div class="em-ink" style="font-size:20px;line-height:1.35;font-weight:800;color:${E.ink};">${title}</div>
              </td></tr>
              <!-- pemisah bergaris putus-putus (perforasi tiket) -->
              <tr><td style="padding:20px 28px 0;">
                <div style="border-top:2px dashed ${E.panelBorder};font-size:0;line-height:0;">&nbsp;</div>
              </td></tr>
              <!-- tanggal -->
              <tr><td align="center" style="padding:20px 24px 0;">
                <div class="em-emerald" style="font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:${E.emeraldBright};font-weight:700;">&#128197;&nbsp; Hari &amp; Tanggal</div>
                <div class="em-ink" style="font-size:17px;font-weight:800;color:${E.ink};margin-top:6px;">${dateStr}</div>
              </td></tr>
              <!-- waktu (elemen paling besar & jelas) -->
              <tr><td align="center" style="padding:18px 24px 28px;">
                <div class="em-emerald" style="font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:${E.emeraldBright};font-weight:700;">&#128336;&nbsp; Waktu (WIB)</div>
                <div class="em-mint" style="font-size:32px;line-height:1.1;font-weight:800;color:${E.mint};letter-spacing:0.5px;margin-top:8px;">${timeRange}</div>
              </td></tr>
            </table>
          </td></tr>
          ${locationBlock}
          ${notesBlock}

          <!-- CTA -->
          <tr><td bgcolor="${E.card}" align="center" style="padding:24px 40px 4px;background-color:${E.card};">
            ${ctaButton(detail, "Lihat Detail Acara")}
            <div class="em-mute" style="margin-top:13px;font-size:11.5px;color:${E.inkMute};line-height:1.6;">Buka <strong style="color:${E.inkSoft};font-weight:700;">Dashboard</strong> untuk melihat atau mengubah detail acara ini.</div>
          </td></tr>

          <!-- tips note -->
          <tr><td bgcolor="${E.card}" style="padding:22px 40px 0;background-color:${E.card};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.amberBg}" style="background-color:${E.amberBg};border:1px solid ${E.amberBorder};border-radius:14px;">
              <tr>
                <td valign="top" width="40" style="padding:14px 0 14px 16px;font-size:17px;">&#128161;</td>
                <td class="em-soft" style="padding:14px 16px 14px 8px;font-size:12.5px;line-height:1.7;color:${E.inkSoft};">
                  <strong style="color:${E.amber};font-weight:700;">Agar acara berjalan lancar:</strong><br>
                  &bull;&nbsp; Usahakan hadir 10&ndash;15 menit lebih awal.<br>
                  &bull;&nbsp; Pastikan baterai HP terisi penuh.<br>
                  &bull;&nbsp; Siapkan dokumen atau kartu nama yang diperlukan.
                </td>
              </tr>
            </table>
          </td></tr>
          ${helpRow()}`;

  return renderEmailShell({
    title: `${BRAND} — Pengingat Acara`,
    preheader: `Pengingat: "${o.eventTitle}" ${humanizeUntil(o.startAt, o.now)} · ${formatEventDate(o.startAt)}, pukul ${formatEventClock(o.startAt)} WIB.`,
    content,
    hideLogo: true,
  });
}

export async function sendAgentEventReminderEmail(
  to: string,
  opts: AgentEventReminderEmailOpts
): Promise<{ delivered: boolean }> {
  if (!isMailConfigured()) {
    console.warn(
      `\n📧 [DEV] SMTP belum dikonfigurasi. Email pengingat acara untuk ${to} tidak dikirim.\n` +
        `   Acara: ${opts.eventTitle} — ${formatEventDate(opts.startAt)} pukul ${formatEventClock(opts.startAt)} WIB.\n`
    );
    return { delivered: false };
  }

  const countdown = humanizeUntil(opts.startAt, opts.now);
  const timeRange = opts.endAt
    ? `${formatEventClock(opts.startAt)}–${formatEventClock(opts.endAt)}`
    : formatEventClock(opts.startAt);

  try {
    await getTransport().sendMail({
      from: `"${BRAND}" <${GMAIL_USER}>`,
      to,
      subject: `🔔 Pengingat acara: ${opts.eventTitle} — ${countdown} · ${BRAND}`,
      text:
        `Pengingat Acara — ${BRAND}\n\n` +
        `${opts.agentName ? `Halo, ${opts.agentName}.` : "Halo."} Acara Anda ${countdown}.\n\n` +
        `Acara       : ${opts.eventTitle}\n` +
        (opts.category ? `Kategori    : ${opts.category}\n` : "") +
        `Hari/Tgl    : ${formatEventDate(opts.startAt)}\n` +
        `Waktu       : ${timeRange} WIB\n` +
        (opts.location ? `Lokasi      : ${opts.location}\n` : "") +
        (opts.locationUrl ? `Peta/Link   : ${opts.locationUrl}\n` : "") +
        (opts.notes ? `Catatan     : ${opts.notes}\n` : "") +
        `\nTips: hadir 10–15 menit lebih awal, pastikan baterai HP penuh, siapkan dokumen yang diperlukan.\n\n` +
        `Lihat detail acara: ${opts.detailUrl}\n\n` +
        `Butuh bantuan? WhatsApp ${SUPPORT_WA} · email ${SUPPORT_EMAIL}\n` +
        `© ${new Date().getFullYear()} ${LEGAL} · ${SITE}`,
      html: agentEventReminderEmailHtml(opts),
    });
    return { delivered: true };
  } catch (err) {
    console.error("❌ Gagal mengirim email pengingat acara:", err);
    return { delivered: false };
  }
}

/* ===========================================================================
 *  EMAIL 6: REKOMENDASI PROPERTI  →  KLIEN
 *
 *  Dikirim agent dari panel Rekomendasi di CRM. Isinya daftar properti yang
 *  cocok dengan preferensi klien, plus bagian terpisah untuk properti yang
 *  HARGANYA TURUN — properti yang pernah dikirim hanya boleh muncul lagi
 *  dengan alasan itu (lihat src/lib/preferensiRekomendasi.ts).
 * ========================================================================= */

export type RekomendasiPropertiEmailOpts = {
  klienName: string;
  agentName?: string | null;
  agentOffice?: string | null;
  agentWhatsapp?: string | null;
  ringkasKriteria?: string | null;
  subject: string;
  /** Properti yang belum pernah dikirim ke klien ini. */
  baru: RekomendasiPropertiItem[];
  /** Properti yang pernah dikirim dan sekarang lebih murah. */
  turunHarga: RekomendasiPropertiItem[];
  /** Versi teks polos, dipakai sebagai fallback body. */
  plainText: string;
};

export type RekomendasiPropertiItem = {
  judul: string;
  url: string;
  gambar: string;
  hargaTampil: string;
  hargaSebelumnya?: string | null;
  frasaTurun?: string | null;
  lokasi: string;
  spesifikasi: string;
  badge: string;
};

/** Satu kartu properti — tabel, bukan flexbox: klien email tidak punya CSS modern. */
function propertyCard(it: RekomendasiPropertiItem): string {
  const hargaBlok = it.hargaSebelumnya
    ? `<div style="font-size:12px;color:${E.inkMute};text-decoration:line-through;line-height:1.4;">${esc(it.hargaSebelumnya)}</div>
       <div class="em-mint" style="font-size:17px;font-weight:800;color:${E.mint};line-height:1.3;">${esc(it.hargaTampil)}</div>
       ${it.frasaTurun ? `<div style="display:inline-block;margin-top:5px;font-size:10.5px;font-weight:800;letter-spacing:0.6px;text-transform:uppercase;color:${E.green};background-color:${E.greenBg};border:1px solid ${E.greenBorder};border-radius:7px;padding:3px 8px;">&#8595; ${esc(it.frasaTurun)}</div>` : ""}`
    : `<div class="em-mint" style="font-size:17px;font-weight:800;color:${E.mint};line-height:1.3;">${esc(it.hargaTampil)}</div>`;

  return `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.panel}" class="em-panel" style="background-color:${E.panel};border:1px solid ${E.panelBorder};border-radius:16px;margin-bottom:12px;">
              <tr><td style="padding:0;">
                <a href="${esc(it.url)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:block;">
                  <img src="${esc(it.gambar)}" alt="${esc(it.judul)}" width="520" style="display:block;width:100%;max-width:520px;height:auto;border:0;border-radius:16px 16px 0 0;" />
                </a>
              </td></tr>
              <tr><td style="padding:16px 18px 18px;">
                <div style="margin-bottom:8px;">
                  <span style="display:inline-block;font-size:9.5px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:${E.emeraldBright};background-color:#082018;border:1px solid ${E.panelBorder};border-radius:6px;padding:3px 8px;">${esc(it.badge)}</span>
                </div>
                <a href="${esc(it.url)}" target="_blank" rel="noopener noreferrer" class="em-ink" style="display:block;font-size:15.5px;font-weight:800;color:${E.ink};line-height:1.35;text-decoration:none;">${esc(it.judul)}</a>
                ${it.lokasi ? `<div class="em-mute" style="margin-top:6px;font-size:12px;color:${E.inkMute};line-height:1.5;">&#128205; ${esc(it.lokasi)}</div>` : ""}
                ${it.spesifikasi ? `<div class="em-soft" style="margin-top:4px;font-size:12px;color:${E.inkSoft};line-height:1.5;">${esc(it.spesifikasi)}</div>` : ""}
                <div style="margin-top:12px;padding-top:12px;border-top:1px solid ${E.dividerSolid};">
                  ${hargaBlok}
                </div>
                <div style="margin-top:12px;">
                  <a href="${esc(it.url)}" target="_blank" rel="noopener noreferrer"
                     style="display:inline-block;background-color:#082018;border:1px solid ${E.panelBorder};color:${E.mint};text-decoration:none;font-size:12.5px;font-weight:700;padding:9px 18px;border-radius:9px;">
                    Lihat Detail &nbsp;&rarr;
                  </a>
                </div>
              </td></tr>
            </table>`;
}

function sectionHeading(text: string, sub?: string) {
  return `
          <tr><td bgcolor="${E.card}" style="padding:24px 40px 10px;background-color:${E.card};">
            <div class="em-emerald" style="font-size:10px;letter-spacing:2.2px;text-transform:uppercase;color:${E.emeraldBright};font-weight:800;">${text}</div>
            ${sub ? `<div class="em-mute" style="margin-top:5px;font-size:12px;color:${E.inkMute};line-height:1.55;">${sub}</div>` : ""}
          </td></tr>`;
}

export function rekomendasiPropertiEmailHtml(o: RekomendasiPropertiEmailOpts) {
  const nama = esc((o.klienName || "").trim().split(/\s+/)[0] || "");
  const total = o.baru.length + o.turunHarga.length;
  const agent = esc(o.agentName || "Agent Solusindo Aset");
  const wa = waDigits(o.agentWhatsapp);

  const headline =
    o.turunHarga.length > 0 && o.baru.length === 0
      ? `Kabar baik${nama ? `, ${nama}` : ""}!<br>Harganya turun &#128071;`
      : `Halo${nama ? ` ${nama}` : ""}!<br>${total > 1 ? `${total} properti` : "Ada properti"} untuk Anda &#127968;`;

  const lead = o.ringkasKriteria
    ? `Berikut properti yang cocok dengan kriteria yang Anda sampaikan — <strong class="em-mint" style="color:${E.mint};font-weight:700;">${esc(o.ringkasKriteria)}</strong>.`
    : `Berikut properti yang menurut kami cocok dengan kriteria yang Anda sampaikan.`;

  const blokBaru =
    o.baru.length > 0
      ? sectionHeading(
          o.baru.length > 1 ? `${o.baru.length} Properti Pilihan` : "Properti Pilihan",
        ) +
        `<tr><td bgcolor="${E.card}" style="padding:0 40px;background-color:${E.card};">${o.baru
          .map(propertyCard)
          .join("")}</td></tr>`
      : "";

  const blokTurun =
    o.turunHarga.length > 0
      ? sectionHeading(
          "Turun Harga",
          "Properti yang pernah kami kirimkan sebelumnya — sekarang harganya lebih rendah.",
        ) +
        `<tr><td bgcolor="${E.card}" style="padding:0 40px;background-color:${E.card};">${o.turunHarga
          .map(propertyCard)
          .join("")}</td></tr>`
      : "";

  const content = `
          <!-- pill -->
          <tr><td bgcolor="${E.card}" align="center" style="padding:20px 40px 0;background-color:${E.card};">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.panel}" style="background-color:${E.panel};border:1px solid ${E.panelBorder};border-radius:999px;">
              <tr><td class="em-mint" style="padding:7px 16px 7px 14px;font-size:10.5px;letter-spacing:2.5px;text-transform:uppercase;color:${E.mint};font-weight:800;">
                <span style="color:${E.emeraldBright};">&#9679;</span>&nbsp;&nbsp;Rekomendasi Properti
              </td></tr>
            </table>
          </td></tr>

          <!-- hero -->
          <tr><td bgcolor="${E.card}" align="center" style="padding:16px 40px 0;background-color:${E.card};">
            <h1 class="em-ink" style="margin:0;font-size:24px;line-height:1.3;font-weight:800;color:${E.ink};letter-spacing:-0.2px;">${headline}</h1>
            <p class="em-soft" style="margin:13px auto 0;font-size:14.5px;line-height:1.65;color:${E.inkSoft};max-width:430px;">${lead}</p>
          </td></tr>

          ${blokTurun}
          ${blokBaru}

          <!-- penutup -->
          <tr><td bgcolor="${E.card}" style="padding:14px 40px 0;background-color:${E.card};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.panel}" class="em-panel" style="background-color:${E.panel};border:1px solid ${E.panelBorder};border-radius:14px;">
              <tr>
                <td valign="top" width="40" style="padding:16px 0 16px 16px;font-size:17px;">&#128172;</td>
                <td class="em-soft" style="padding:16px 16px 16px 8px;font-size:12.5px;line-height:1.65;color:${E.inkSoft};">
                  <strong class="em-mint" style="color:${E.mint};font-weight:700;">Ada yang menarik?</strong><br>
                  Balas email ini atau hubungi ${esc(agent)}${wa ? ` di <a href="https://wa.me/${wa}" style="color:${E.mint};text-decoration:none;font-weight:600;">WhatsApp</a>` : ""} — jadwal survei bisa diatur sesuai waktu Anda.
                </td>
              </tr>
            </table>
          </td></tr>`;

  return renderEmailShell({
    title: `${BRAND} — Rekomendasi Properti`,
    preheader:
      o.turunHarga.length > 0 && o.baru.length === 0
        ? `Harga turun untuk properti yang Anda minati.`
        : `${total} properti yang cocok dengan kriteria Anda${o.ringkasKriteria ? ` — ${o.ringkasKriteria}` : ""}.`,
    content,
  });
}

export async function sendRekomendasiPropertiEmail(
  to: string,
  opts: RekomendasiPropertiEmailOpts
): Promise<{ delivered: boolean; reason?: string }> {
  if (!isMailConfigured()) {
    console.warn(
      `\n📧 [DEV] SMTP belum dikonfigurasi. Email rekomendasi untuk ${to} tidak dikirim.\n` +
        `   ${opts.baru.length} properti baru · ${opts.turunHarga.length} turun harga.\n`
    );
    return { delivered: false, reason: "SMTP belum dikonfigurasi" };
  }

  try {
    await getTransport().sendMail({
      from: `"${opts.agentName || BRAND} · ${BRAND}" <${GMAIL_USER}>`,
      to,
      subject: `${opts.subject} · ${BRAND}`,
      text: opts.plainText,
      html: rekomendasiPropertiEmailHtml(opts),
    });
    return { delivered: true };
  } catch (err) {
    console.error("❌ Gagal mengirim email rekomendasi properti:", err);
    return { delivered: false, reason: "Gagal mengirim email" };
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   ASISTEN ASET — email ke AGENT: "ada aset baru untuk klien Anda"
   ---------------------------------------------------------------------------
   Email ini punya satu tugas dan bukan "memberi tahu". Memberi tahu itu murah
   dan hampir tidak berguna: agent yang membaca "3 aset baru cocok untuk Budi"
   lalu harus membuka dashboard, mencari Budi, mencari asetnya, memilih, dan
   menyusun pesan sedang mengerjakan seluruh pekerjaan yang tadinya ada —
   ditambah membaca email. Otomatisasi yang begitu justru MENAMBAH satu langkah.

   Maka email ini memuat keputusannya, bukan cuma kabarnya:
     • asetnya ditampilkan (foto, harga, lokasi) → inilah momen pemeriksaannya;
     • satu tombol per klien → mencatat kiriman lalu membuka WhatsApp yang
       sudah berisi draf lengkap.
   Dari kotak masuk ke draf WhatsApp: satu ketukan. Menekan "kirim" di
   WhatsApp tetap pekerjaan manusia — aset yang salah kirim tidak bisa ditarik,
   dan yang menanggung malunya agent, bukan sistem.

   Satu email memuat SEMUA klien yang punya kecocokan baru. Satu email per
   klien akan mengubur kotak masuk agent yang punya tiga puluh klien, dan
   kotak masuk yang terkubur berhenti dibaca dalam tiga hari.
   ═══════════════════════════════════════════════════════════════════════════ */

export type AsistenAsetItem = {
  judul: string;
  url: string;
  gambar: string;
  hargaTampil: string;
  /** Baris lokasi pendek: kecamatan, kota. */
  lokasi: string;
  /** Alamat lengkap — nama jalan, komplek, blok, kavling. Inilah yang membuat
   *  agent tahu PERSIS di mana asetnya tanpa membuka apa pun, dan yang
   *  menentukan apakah ia bisa langsung menjawab saat klien bertanya
   *  "dekat mana itu?". */
  alamat?: string | null;
  spesifikasi: string;
  badge: string;
  /** KENAPA aset ini cocok — "Rp 184 jt di bawah plafon", "baru masuk hari
   *  ini", "Kelurahan Manukan Kulon". Bagian yang mengubah email ini dari
   *  pemberitahuan jadi sesuatu yang bisa dinilai dalam dua detik. Tanpa
   *  alasan, agent harus membuka tiap aset untuk tahu apakah kecocokannya
   *  masuk akal — dan rekomendasi yang tidak bisa dinilai berhenti dipercaya
   *  setelah satu hasil yang terasa aneh. */
  alasan?: string[];
};

export type AsistenAsetKlien = {
  nama: string;
  /** Sudah berapa lama klien ini tidak dihubungi, mis. "12 hari lalu".
   *  Bukan hiasan: aset baru untuk klien yang baru dihubungi kemarin dan untuk
   *  klien yang didiamkan sebulan adalah dua tingkat kepentingan yang berbeda,
   *  dan agent hanya bisa membedakannya kalau angkanya ditulis. */
  kontakTerakhir?: string | null;
  /** Kriteria yang membuat aset-aset ini muncul, mis. "Rumah · Gresik · ≤ 500 jt".
   *  Bukan hiasan: tanpanya agent tidak bisa menilai apakah kecocokannya masuk
   *  akal, dan rekomendasi yang tidak bisa dinilai berhenti dipercaya. */
  kriteria: string;
  /** Total kecocokan baru — bisa lebih besar dari `aset.length` yang ditampilkan. */
  total: number;
  aset: AsistenAsetItem[];
  /** Tautan satu-ketukan: catat kiriman lalu buka WhatsApp berisi draf.
   *  null bila klien tidak punya nomor WhatsApp. */
  kirimUrl: string | null;
  /** Tautan cadangan ke layar Asisten Aset klien ini. */
  bukaUrl: string;
};

export type AsistenAsetEmailOpts = {
  agentName?: string | null;
  klien: AsistenAsetKlien[];
  /** Total aset baru di seluruh klien — dipakai di judul & preheader. */
  totalAset: number;
  /** Foto yang ikut di dalam surat (cid). Kartu yang punya entri di sini
   *  memakai `cid:` alih-alih URL — lihat alasannya di src/lib/fotoListing.ts. */
  lampiran?: { cid: string; content: Buffer }[];
};

/** Batas panjang alamat di kartu email. Median alamat 96 karakter dan 90%
 *  di bawah 172 — tapi ADA baris sepanjang 500 karakter di data, dan satu
 *  alamat seperti itu menenggelamkan harga, alasan, dan tombolnya sekaligus
 *  di bawah lipatan layar ponsel. Dipotong di 150: dua baris pada lebar email
 *  600px, tetap utuh untuk sebagian besar alamat. */
const MAKS_ALAMAT = 150;

/** Satu kartu aset di email agent.
 *
 *  ── KENAPA SUSUNANNYA SEPERTI INI ────────────────────────────────────────
 *  Versi sebelumnya menaruh foto 92×92 di samping blok teks setinggi ±230px,
 *  dan selisihnya — sekitar 140px kolom kosong di bawah foto — adalah lubang
 *  yang tidak bisa diisi apa pun. Email tidak punya flexbox; sel tabel tidak
 *  bisa disuruh meregangkan gambar mengikuti tinggi tetangganya.
 *
 *  Jadi jaraknya ditutup dari DUA sisi sekaligus:
 *    • fotonya naik ke 118×148 (potret 4:5, lazim untuk properti), dan
 *    • teksnya dirapatkan dengan menggabungkan dua pasang baris yang selama
 *      ini berdiri sendiri-sendiri — badge dengan luas, lalu chip alasan
 *      dengan tombol detail.
 *  Menaikkan foto saja akan menghasilkan foto raksasa; merapatkan teks saja
 *  tetap menyisakan lubang. Keduanya sekaligus membuat sisa ruangnya tinggal
 *  puluhan piksel — dan email jadi LEBIH pendek, bukan lebih panjang.
 *
 *  Foto TIDAK dibuat selebar kartu (pola email ke klien) dengan sengaja:
 *  agent membaca untuk MEMUTUSKAN, bukan untuk tergoda. Tiga foto selebar
 *  kartu membuat email sepanjang tiga layar demi tiga keputusan.
 *
 *  Tabel bersarang, bukan flexbox — Outlook tidak punya CSS modern. */
function asistenAsetCard(it: AsistenAsetItem): string {
  const alamat = (it.alamat || it.lokasi || "").trim();
  const alamatTampil =
    alamat.length > MAKS_ALAMAT ? `${alamat.slice(0, MAKS_ALAMAT - 1).trimEnd()}…` : alamat;

  const chip = (isi: string) =>
    `<span style="display:inline-block;font-size:10.5px;font-weight:700;color:${E.inkSoft};background-color:${E.bg};border:1px solid ${E.dividerSolid};border-radius:6px;padding:4px 9px;margin:0 5px 0 0;white-space:nowrap;">${esc(isi)}</span>`;

  return `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.panel}" class="em-panel" style="background-color:${E.panel};border:1px solid ${E.panelBorder};border-radius:14px;margin-bottom:10px;">
              <tr>
                <td width="118" valign="top" style="padding:10px 0 10px 10px;">
                  <a href="${esc(it.url)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:block;">
                    <img src="${esc(it.gambar)}" alt="" width="118" height="148" style="display:block;width:118px;height:148px;border:0;border-radius:10px;object-fit:cover;background-color:${E.cardBorder};" />
                  </a>
                </td>
                <td valign="top" style="padding:10px 12px 10px 11px;">

                  <!-- Baris 1: jenis + luas. Dulu dua baris terpisah; keduanya
                       sama-sama keterangan singkat dan tidak pernah dibaca
                       sebagai kalimat, jadi tidak ada yang hilang. -->
                  <div style="line-height:1;">
                    <span style="display:inline-block;font-size:9px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:${E.emeraldBright};background-color:#082018;border:1px solid ${E.panelBorder};border-radius:5px;padding:3px 7px;vertical-align:middle;">${esc(it.badge)}</span>
                    ${it.spesifikasi ? `<span class="em-mute" style="font-size:11px;color:${E.inkMute};vertical-align:middle;">&nbsp;&nbsp;${esc(it.spesifikasi)}</span>` : ""}
                  </div>

                  <a href="${esc(it.url)}" target="_blank" rel="noopener noreferrer" class="em-ink" style="display:block;margin-top:7px;font-size:13.5px;font-weight:700;color:${E.ink};line-height:1.35;text-decoration:none;">${esc(it.judul)}</a>

                  <div class="em-mint" style="margin-top:6px;font-size:17px;font-weight:800;color:${E.mint};line-height:1.2;">${esc(it.hargaTampil)}</div>

                  ${alamatTampil ? `<div class="em-soft" style="margin-top:6px;font-size:11.5px;color:${E.inkSoft};line-height:1.45;">&#128205; ${esc(alamatTampil)}</div>` : ""}

                  <!-- Baris terakhir: alasan di kiri, tombol di kanan.
                       Dua baris terpisah menyisakan satu jalur kosong selebar
                       kartu di antara keduanya, padahal masing-masing hanya
                       memakai sepertiga lebarnya. -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;">
                    <tr>
                      <td valign="middle" style="padding:0;">
                        ${(it.alasan && it.alasan.length > 0) ? it.alasan.slice(0, 2).map(chip).join("") : "&nbsp;"}
                      </td>
                      <td valign="middle" align="right" style="padding:0;">
                        <a href="${esc(it.url)}" target="_blank" rel="noopener noreferrer"
                           style="display:inline-block;background-color:${E.bg};border:1px solid ${E.panelBorder};color:${E.mint};text-decoration:none;font-size:11.5px;font-weight:700;padding:7px 13px;border-radius:8px;white-space:nowrap;">
                          Detail &nbsp;&rarr;
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>`;
}

function asistenBlokKlien(k: AsistenAsetKlien): string {
  const sisa = k.total - k.aset.length;

  /* Tombol utama = tindakannya, bukan navigasinya. "Buka dashboard" akan
     mendaratkan agent di tempat pekerjaannya baru dimulai; "Kirim ke Budi"
     menyelesaikannya. Bila nomor WhatsApp-nya tidak ada, tombolnya berubah
     jujur jadi "Buka" — tombol kirim yang mendarat di layar kosong lebih
     merusak kepercayaan daripada tombol yang sejak awal mengaku terbatas. */
  const aksi = k.kirimUrl
    ? `<a href="${esc(k.kirimUrl)}" target="_blank" rel="noopener noreferrer"
          style="display:inline-block;background-color:${E.mint};color:${E.btnText};text-decoration:none;font-size:13px;font-weight:800;padding:11px 22px;border-radius:10px;">
         Kirim ke ${esc(k.nama.split(/\s+/)[0])} via WhatsApp &nbsp;&rarr;
       </a>`
    : `<a href="${esc(k.bukaUrl)}" target="_blank" rel="noopener noreferrer"
          style="display:inline-block;background-color:#082018;border:1px solid ${E.panelBorder};color:${E.mint};text-decoration:none;font-size:13px;font-weight:700;padding:10px 20px;border-radius:10px;">
         Buka di CRM &nbsp;&rarr;
       </a>
       <div class="em-mute" style="margin-top:7px;font-size:11px;color:${E.inkMute};">Nomor WhatsApp-nya belum terisi.</div>`;

  return `
          <tr><td bgcolor="${E.card}" style="padding:22px 28px 0;background-color:${E.card};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="padding-bottom:10px;border-bottom:1px solid ${E.dividerSolid};">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td valign="middle" style="padding:0;">
                      <div class="em-ink" style="font-size:16px;font-weight:800;color:${E.ink};line-height:1.3;">${esc(k.nama)}</div>
                    </td>
                    <td valign="middle" align="right" style="padding:0;">
                      <span style="display:inline-block;font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:${E.btnText};background-color:${E.mint};border-radius:999px;padding:4px 10px;white-space:nowrap;">
                        ${k.total} aset &middot; kirim
                      </span>
                    </td>
                  </tr>
                </table>
                <div class="em-mute" style="margin-top:5px;font-size:11.5px;color:${E.inkMute};line-height:1.6;">
                  Mencari: ${esc(k.kriteria)}
                  ${k.kontakTerakhir ? `<br><span style="color:${E.amber};">&#9200; Terakhir dihubungi ${esc(k.kontakTerakhir)}</span>` : ""}
                </div>
              </td></tr>
            </table>
          </td></tr>
          <tr><td bgcolor="${E.card}" style="padding:12px 28px 0;background-color:${E.card};">
            ${k.aset.map(asistenAsetCard).join("")}
            ${sisa > 0 ? `<div class="em-mute" style="margin:2px 0 4px;font-size:11.5px;color:${E.inkMute};">&#43;${sisa} aset lain menunggu di CRM.</div>` : ""}
          </td></tr>
          <tr><td bgcolor="${E.card}" style="padding:8px 28px 0;background-color:${E.card};">
            ${aksi}
          </td></tr>`;
}

export function asistenAsetEmailHtml(o: AsistenAsetEmailOpts) {
  const sapaan = esc((o.agentName || "").trim().split(/\s+/)[0] || "");
  const jumlahKlien = o.klien.length;

  /* ── JUDUL SEBAGAI PERINTAH, BUKAN LAPORAN ────────────────────────────
     "3 aset baru untuk Bambang" menyampaikan fakta lalu berhenti. Agent
     membacanya, mengangguk, dan menutup emailnya — tidak ada satu pun kata yang
     menyuruhnya melakukan sesuatu.

     Judulnya sekarang menyebut TINDAKANNYA. Bedanya kecil di halaman, besar di
     kotak masuk: subjek yang berbunyi "Kirim 3 aset ke Bambang hari ini" sudah
     memberi tahu apa yang harus terjadi bahkan sebelum emailnya dibuka.

     Tanpa <br> paksa: judul rata kiri membungkus sendiri sesuai lebar layar,
     sementara pemenggalan tetap akan salah tempat di separuh lebar yang ada. */
  const headline =
    jumlahKlien === 1
      ? `Kirim ${o.totalAset} aset ini ke ${esc(o.klien[0].nama.split(/\s+/)[0])} hari ini &#128640;`
      : `${jumlahKlien} klien Anda menunggu aset baru hari ini &#128640;`;

  const content = `
          <!-- ── Bilah merek: logo KIRI, penanda kanan ──
               Menggantikan logo terpusat 180px + pill terpusat yang bersama-sama
               memakan sekitar 200px tinggi sebelum satu kata pun terbaca. Di
               ponsel itu berarti seluruh layar pertama habis untuk merek —
               padahal yang menunggu dibaca agent adalah nama kliennya. Susunan
               mendatar memangkasnya jadi satu baris. -->
          <tr><td bgcolor="${E.card}" style="padding:20px 28px 14px;background-color:${E.card};border-bottom:1px solid ${E.dividerSolid};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td valign="middle" style="padding:0;">
                  <!-- Kunci merek: lambang + NAMA, sama dengan header situs
                       (src/components/Layout/Header/Logo). Lambang sendirian
                       tidak memberi tahu siapa pengirimnya, dan yang lebih
                       menentukan: banyak klien email MEMBLOKIR gambar secara
                       bawaan. Nama yang ditulis sebagai TEKS tetap terbaca di
                       email yang gambarnya tidak dimuat — email tanpa identitas
                       pengirim adalah email yang dilaporkan sebagai spam.
                       Memakai kelas em-ink/em-mint, bukan hex mati, supaya
                       tidak dibalik oleh mode gelap paksa di Outlook. -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="36" valign="middle" style="padding:0;">
                        <img src="${URL_PUBLIK}/images/logo/LogoSolusindoPremier.png" alt="" width="36" height="36" style="display:block;width:36px;height:36px;border:0;" />
                      </td>
                      <td valign="middle" style="padding:0 0 0 9px;">
                        <span class="em-ink" style="font-size:18px;font-weight:800;letter-spacing:-0.3px;color:${E.ink};white-space:nowrap;">Solusindo<span class="em-mint" style="color:${E.mint};">&nbsp;Aset</span></span>
                      </td>
                    </tr>
                  </table>
                </td>
                <td valign="middle" align="right" style="padding:0;">
                  <span class="em-mint" style="display:inline-block;font-size:9.5px;letter-spacing:2px;text-transform:uppercase;color:${E.mint};font-weight:800;background-color:${E.panel};border:1px solid ${E.panelBorder};border-radius:999px;padding:6px 13px;white-space:nowrap;">
                    <span style="color:${E.emeraldBright};">&#9679;</span>&nbsp; Asisten Aset
                  </span>
                </td>
              </tr>
            </table>
          </td></tr>

          <!-- ── Judul: rata KIRI, bukan tengah ──
               Teks rata tengah memaksa mata mencari awal tiap baris. Untuk
               kalimat pemasaran itu wajar; untuk email kerja yang dipindai
               sambil berjalan, rata kiri lebih cepat dibaca dan sejajar dengan
               nama-nama klien di bawahnya. -->
          <tr><td bgcolor="${E.card}" style="padding:20px 28px 0;background-color:${E.card};">
            <h1 class="em-ink" style="margin:0;font-size:19px;line-height:1.35;font-weight:800;color:${E.ink};letter-spacing:-0.2px;">${headline}</h1>
            <!-- SATU kalimat. Versi sebelumnya lima baris yang menjelaskan cara
                 kerja tombolnya — penjelasan yang tidak dibutuhkan siapa pun yang
                 sudah melihat tombol hijau besar di bawahnya. Yang perlu diketahui
                 agent cuma dua: asetnya baru, dan belum pernah ia kirim. -->
            <p class="em-soft" style="margin:7px 0 0;font-size:13px;line-height:1.55;color:${E.inkSoft};">
              ${sapaan ? `${sapaan}, b` : "B"}aru masuk hari ini &amp; belum pernah Anda kirim.
              <strong class="em-mint" style="color:${E.mint};font-weight:700;">Ketuk tombol hijau</strong> &mdash; WhatsApp langsung terbuka dengan pesannya.
            </p>
          </td></tr>

          ${o.klien.map(asistenBlokKlien).join("")}

          <!-- ── Penutup: jaminan sebagai PENANDA, bukan paragraf ──
               Versi sebelumnya satu paragraf beremoji besar dengan baris kosong
               di tengahnya: memakan enam baris untuk tiga fakta, dan tiga fakta
               yang harus dibaca sebagai kalimat tidak akan dibaca sama sekali
               pada email yang dibuka sambil berjalan. Sebagai penanda pendek
               berbaris, ketiganya tertangkap dalam satu pandangan — dan justru
               inilah yang membuat agent percaya pada isi email di atasnya. -->
          <tr><td bgcolor="${E.card}" style="padding:24px 28px 0;background-color:${E.card};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.panel}" class="em-panel" style="background-color:${E.panel};border:1px solid ${E.panelBorder};border-radius:14px;">
              <tr>
                <td style="padding:15px 16px 13px;">
                  <div class="em-mint" style="font-size:10px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:${E.mint};">Sudah diperiksa sistem</div>
                  <div style="margin-top:9px;line-height:2;">
                    ${[
                      "Masih tersedia",
                      "Belum pernah Anda kirim",
                      "Cocok dengan kriteria klien",
                    ].map(t => `<span style="display:inline-block;font-size:11.5px;font-weight:700;color:${E.ink};background-color:${E.bg};border:1px solid ${E.dividerSolid};border-radius:7px;padding:5px 10px;margin:0 5px 5px 0;white-space:nowrap;"><span style="color:${E.emeraldBright};font-weight:800;">&#10003;</span>&nbsp; ${t}</span>`).join("")}
                  </div>
                  <div class="em-mute" style="margin-top:8px;font-size:11.5px;line-height:1.6;color:${E.inkMute};">
                    Tidak ada yang terkirim otomatis &mdash; Anda tetap yang menekan kirim di WhatsApp.
                  </div>
                </td>
              </tr>
            </table>
          </td></tr>`;

  return renderEmailShell({
    hideLogo: true,
    title: `${BRAND} — Aset Baru untuk Klien Anda`,
    preheader:
      jumlahKlien === 1
        ? `${o.totalAset} aset baru cocok untuk ${o.klien[0].nama}.`
        : `${o.totalAset} aset baru cocok untuk ${jumlahKlien} klien Anda.`,
    content,
  });
}

export async function sendAsistenAsetEmail(
  to: string,
  opts: AsistenAsetEmailOpts,
): Promise<{ delivered: boolean; reason?: string }> {
  if (!isMailConfigured()) {
    console.warn(
      `\n📧 [DEV] SMTP belum dikonfigurasi. Email asisten aset untuk ${to} tidak dikirim.\n` +
        `   ${opts.klien.length} klien · ${opts.totalAset} aset.\n`,
    );
    return { delivered: false, reason: "SMTP belum dikonfigurasi" };
  }

  /* Subjek menyebut tindakan + nama. Itu dua hal yang terlihat di daftar
     kotak masuk sebelum emailnya dibuka, dan keduanya yang menentukan apakah
     ia dibuka sama sekali. */
  const subjek =
    opts.klien.length === 1
      ? `Kirim ${opts.totalAset} aset ke ${opts.klien[0].nama} — baru masuk hari ini`
      : `${opts.klien.length} klien menunggu: ${opts.totalAset} aset baru siap dikirim`;

  /* Teks polos bukan formalitas: sebagian klien email menampilkannya di
     pratinjau, dan penyaring spam menilai email yang HANYA berisi HTML lebih
     keras. Isinya sengaja memuat tautan CRM, bukan tautan satu-ketukan —
     tautan bertanda tangan yang tercetak di teks polos gampang tersalin ke
     tempat yang tidak semestinya. */
  const plain = [
    `${subjek}`,
    "",
    ...opts.klien.map(k => `• ${k.nama} (${k.kriteria}) — ${k.total} aset baru\n  ${k.bukaUrl}`),
    "",
    "Buka email versi HTML untuk mengirim langsung lewat WhatsApp.",
    `${BRAND}`,
  ].join("\n");

  try {
    await getTransport().sendMail({
      from: `"Asisten Aset · ${BRAND}" <${GMAIL_USER}>`,
      to,
      subject: `${subjek} · ${BRAND}`,
      text: plain,
      html: asistenAsetEmailHtml(opts),
      /* `cid` + `contentDisposition: inline` — tanpa keduanya nodemailer
         melampirkannya sebagai berkas unduhan biasa, dan <img src="cid:…">
         tetap kosong sementara suratnya jadi berat. */
      attachments: (opts.lampiran ?? []).map(f => ({
        filename: `${f.cid}.jpg`,
        content: f.content,
        cid: f.cid,
        contentType: "image/jpeg",
        contentDisposition: "inline" as const,
      })),
    });
    return { delivered: true };
  } catch (err) {
    console.error("❌ Gagal mengirim email asisten aset:", err);
    return { delivered: false, reason: "Gagal mengirim email" };
  }
}
