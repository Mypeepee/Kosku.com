import { NextResponse } from "next/server";
import { status_agent_enum } from "@prisma/client";
import prisma from "@/lib/prisma";
import { notifyNewAgentRegistration } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


/* ---------------- Utils ---------------- */

function jsonError(message: string, status = 400, extra?: any) {
  return NextResponse.json({ ok: false, message, ...extra }, { status });
}

function slugify(input: string) {
  return (input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function normalizeAgentCode(raw: string) {
  const s = (raw || "").trim();
  if (!s) return "";
  if (/^\d+$/.test(s)) return `AG${s.replace(/^0+/, "") || "0"}`;
  const m = s.toUpperCase().match(/^AG\s*0*(\d+)$/);
  if (m) return `AG${m[1]}`;
  return s.toUpperCase();
}

function normalizePhoneE164Id(raw: string) {
  let digits = (raw || "").replace(/\D/g, "");
  if (digits.startsWith("62")) digits = digits.slice(2);
  digits = digits.replace(/^0+/, "");
  return `+62${digits}`;
}

async function fileToBuffer(file: File) {
  const ab = await file.arrayBuffer();
  return Buffer.from(ab);
}

async function compressImageIfPossible(
  buf: Buffer,
  mime: string,
  opts: { maxWidth: number; quality: number }
): Promise<{ buffer: Buffer; contentType: string; ext: string }> {
  try {
    const sharpMod: any = await import("sharp");
    const sharp = sharpMod.default ?? sharpMod;

    const out = await sharp(buf)
      .rotate()
      .resize({ width: opts.maxWidth, withoutEnlargement: true })
      .jpeg({ quality: opts.quality, mozjpeg: true })
      .toBuffer();

    return { buffer: out, contentType: "image/jpeg", ext: "jpg" };
  } catch {
    const ext =
      mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    return { buffer: buf, contentType: mime || "application/octet-stream", ext };
  }
}

/* ---------------- Google Drive helpers ---------------- */

function assertDriveEnv() {
  const miss: string[] = [];
  if (!process.env.GOOGLE_DRIVE_CLIENT_ID) miss.push("GOOGLE_DRIVE_CLIENT_ID");
  if (!process.env.GOOGLE_DRIVE_CLIENT_SECRET) miss.push("GOOGLE_DRIVE_CLIENT_SECRET");
  if (!process.env.GOOGLE_DRIVE_REFRESH_TOKEN) miss.push("GOOGLE_DRIVE_REFRESH_TOKEN");
  if (!process.env.GDRIVE_PARENT_FOLDER_ID) miss.push("GDRIVE_PARENT_FOLDER_ID");

  if (miss.length) {
    throw new Error(`ENV Google Drive belum lengkap. Kurang: ${miss.join(", ")}`);
  }
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function getGoogleAccessToken() {
  assertDriveEnv();

  const client_id = process.env.GOOGLE_DRIVE_CLIENT_ID!;
  const client_secret = process.env.GOOGLE_DRIVE_CLIENT_SECRET!;
  const refresh_token = process.env.GOOGLE_DRIVE_REFRESH_TOKEN!;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id,
      client_secret,
      refresh_token,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json().catch(() => ({} as any));
  if (!res.ok || !data?.access_token) {
    throw new Error(data?.error_description || "Gagal mendapatkan access_token Google.");
  }
  return data.access_token as string;
}

/**
 * fetch wrapper + retry untuk error 5xx Google Drive yang sering intermittent.
 */
async function driveFetch(accessToken: string, url: string, init?: RequestInit) {
  const maxRetry = 4;

  for (let attempt = 0; attempt < maxRetry; attempt++) {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init?.headers || {}),
      },
    });

    if (res.ok) return res;

    const status = res.status;
    const txt = await res.text().catch(() => "");

    const isRetryable = status >= 500 && status <= 599;

    if (!isRetryable || attempt === maxRetry - 1) {
      throw new Error(`Google Drive error ${status}: ${txt.slice(0, 600)}`);
    }

    const backoff = 600 * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
    await sleep(backoff);
  }

  throw new Error("Google Drive error: retry exhausted");
}

async function findFolder(accessToken: string, parentId: string, name: string) {
  const q = [
    `mimeType='application/vnd.google-apps.folder'`,
    `name='${name.replace(/'/g, "\\'")}'`,
    `'${parentId}' in parents`,
    `trashed=false`,
  ].join(" and ");

  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", q);
  url.searchParams.set("fields", "files(id,name)");
  url.searchParams.set("pageSize", "1");
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("includeItemsFromAllDrives", "true");

  const res = await driveFetch(accessToken, url.toString(), { method: "GET" });
  const data = await res.json().catch(() => ({} as any));
  return data?.files?.[0]?.id as string | undefined;
}

async function createFolder(accessToken: string, parentId: string, name: string) {
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("supportsAllDrives", "true");

  const res = await driveFetch(accessToken, url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });
  const data = await res.json().catch(() => ({} as any));
  return data.id as string;
}

async function getOrCreateFolder(accessToken: string, parentId: string, name: string) {
  const found = await findFolder(accessToken, parentId, name);
  if (found) return found;
  return createFolder(accessToken, parentId, name);
}

async function uploadFileMultipart(params: {
  accessToken: string;
  parentFolderId: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
}) {
  const boundary = "-------314159265358979323846";
  const metadata = { name: params.filename, parents: [params.parentFolderId] };

  const multipartBody = Buffer.concat([
    Buffer.from(`--${boundary}\r\n`),
    Buffer.from(`Content-Type: application/json; charset=UTF-8\r\n\r\n`),
    Buffer.from(`${JSON.stringify(metadata)}\r\n`),

    Buffer.from(`--${boundary}\r\n`),
    Buffer.from(`Content-Type: ${params.mimeType}\r\n\r\n`),
    params.buffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const uploadUrl = new URL("https://www.googleapis.com/upload/drive/v3/files");
  uploadUrl.searchParams.set("uploadType", "multipart");
  uploadUrl.searchParams.set("fields", "id");
  uploadUrl.searchParams.set("supportsAllDrives", "true");

  const res = await driveFetch(params.accessToken, uploadUrl.toString(), {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body: multipartBody as any,
  });

  const data = await res.json().catch(() => ({} as any));
  return data.id as string; // ✅ FILE ID
}

async function makeFilePublic(accessToken: string, fileId: string) {
  const permUrl = new URL(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`);
  permUrl.searchParams.set("supportsAllDrives", "true");

  await driveFetch(accessToken, permUrl.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });
}

// ✅ untuk response/preview saja (DB tidak simpan url)
function publicDriveUrlFromId(fileId: string) {
  return `https://drive.google.com/uc?id=${fileId}`;
}

async function deleteDriveFile(accessToken: string, fileId: string) {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${fileId}`);
  url.searchParams.set("supportsAllDrives", "true");
  await driveFetch(accessToken, url.toString(), { method: "DELETE" });
}

/* ---------------- Route ---------------- */

export async function POST(req: Request) {
  try {
    const fd = await req.formData();

    const id_pengguna = String(fd.get("id_pengguna") || "").trim();
    const nama_lengkap = String(fd.get("nama_lengkap") || "").trim();
    const email = String(fd.get("email") || "").trim() || null;

    const nomor_whatsapp_raw = String(fd.get("nomor_whatsapp") || "").trim();
    const nomor_whatsapp = normalizePhoneE164Id(nomor_whatsapp_raw);

    const nama_kantor_input = String(fd.get("nama_kantor") || "").trim();
    const kota_area = String(fd.get("kota_area") || "").trim();

    const link_instagram = String(fd.get("link_instagram") || "").trim() || null;
    const link_tiktok = String(fd.get("link_tiktok") || "").trim() || null;
    const link_facebook = String(fd.get("link_facebook") || "").trim() || null;

    const kode_referral_upline_raw = String(fd.get("kode_referral_upline") || "").trim();
    const kode_referral_upline = normalizeAgentCode(kode_referral_upline_raw) || null;

    const foto_ktp = fd.get("foto_ktp") as File | null;
    const foto_npwp = fd.get("foto_npwp") as File | null;
    const foto_profil = fd.get("foto_profil") as File | null;

    // basic validate
    if (!id_pengguna) return jsonError("id_pengguna wajib.");
    if (!nama_lengkap) return jsonError("nama_lengkap wajib.");
    if (!email) return jsonError("email wajib.");
    if (!kota_area) return jsonError("kota_area wajib.");
    if (!nomor_whatsapp || nomor_whatsapp === "+62") return jsonError("nomor_whatsapp wajib.");

    // Pastikan pengguna ada + ambil nomor_telepon sekarang
    const pengguna = await prisma.pengguna.findUnique({
      where: { id_pengguna },
      select: { id_pengguna: true, nomor_telepon: true },
    });
    if (!pengguna) return jsonError("Pengguna tidak ditemukan.", 404);

    // ✅ Cek dokumen yang sudah pernah diupload sebelumnya (kalau reapply).
    // File yang sudah ada dipertahankan kecuali pengguna mengganti dengan file baru.
    const existingAgentFiles = await prisma.agent.findUnique({
      where: { id_pengguna },
      select: { foto_ktp_url: true, foto_npwp_url: true, foto_profil_url: true },
    });

    if (!foto_ktp && !existingAgentFiles?.foto_ktp_url) return jsonError("foto_ktp wajib.");
    if (!foto_profil && !existingAgentFiles?.foto_profil_url) return jsonError("foto_profil wajib.");

    // ✅ Isi nomor_telepon di tabel pengguna hanya kalau masih kosong
    if (!pengguna.nomor_telepon || pengguna.nomor_telepon.trim() === "") {
      await prisma.pengguna.update({
        where: { id_pengguna },
        data: {
          nomor_telepon: nomor_whatsapp,
          diperbarui_pada: new Date(),
        },
      });
    }

    // referral lookup: harus AKTIF
    let id_upline: string | null = null;
    let nama_kantor_final = nama_kantor_input;

    if (kode_referral_upline) {
      const upline = await prisma.agent.findUnique({
        where: { id_agent: kode_referral_upline },
        select: { id_agent: true, status_keanggotaan: true, nama_kantor: true },
      });

      if (!upline) return jsonError("Kode referral tidak ditemukan.");
      if (upline.status_keanggotaan !== status_agent_enum.AKTIF) {
        return jsonError("Kode referral tidak valid: Agent belum AKTIF.");
      }

      id_upline = upline.id_agent;
      nama_kantor_final = upline.nama_kantor; // enforce kantor ikut upline
    }

    if (!nama_kantor_final) return jsonError("nama_kantor wajib.");

    // ✅ default: pertahankan fileId dokumen lama (kalau reapply & tidak diganti)
    let ktpFileId = existingAgentFiles?.foto_ktp_url ?? null;
    let npwpFileId = existingAgentFiles?.foto_npwp_url ?? null;
    let profilFileId = existingAgentFiles?.foto_profil_url ?? null;

    // fileId dokumen lama yang akan dihapus dari Drive setelah upsert sukses
    // (hanya terisi kalau ada penggantian file)
    const oldFileIdsToDelete: string[] = [];
    let driveAccessToken: string | null = null;

    const hasNewFiles = Boolean(foto_ktp || foto_npwp || foto_profil);

    if (hasNewFiles) {
      // Upload to Google Drive
      const parentFolderId = process.env.GDRIVE_PARENT_FOLDER_ID;
      if (!parentFolderId) return jsonError("ENV GDRIVE_PARENT_FOLDER_ID belum di-set.", 500);

      const accessToken = await getGoogleAccessToken();
      driveAccessToken = accessToken;

      // folder per user (biar rapi)
      const folderName = slugify(nama_lengkap) || `user_${id_pengguna}`;
      const targetFolderId = await getOrCreateFolder(accessToken, parentFolderId, folderName);

      // ✅ upload helper: return fileId saja (yang disimpan ke DB)
      async function uploadOne(file: File, prefix: string, compressProfile = false) {
        const raw = await fileToBuffer(file);

        const { buffer, contentType, ext } = await compressImageIfPossible(
          raw,
          file.type || "image/jpeg",
          compressProfile ? { maxWidth: 1600, quality: 75 } : { maxWidth: 2000, quality: 80 }
        );

        const filename = `${prefix}_${crypto.randomUUID()}.${ext}`;

        const fileId = await uploadFileMultipart({
          accessToken,
          parentFolderId: targetFolderId,
          filename,
          mimeType: contentType,
          buffer,
        });

        await makeFilePublic(accessToken, fileId);

        return { fileId }; // ✅ hanya fileId
      }

      if (foto_ktp) {
        const up = await uploadOne(foto_ktp, "ktp", false);
        if (ktpFileId) oldFileIdsToDelete.push(ktpFileId);
        ktpFileId = up.fileId;
      }
      if (foto_npwp) {
        const up = await uploadOne(foto_npwp, "npwp", false);
        if (npwpFileId) oldFileIdsToDelete.push(npwpFileId);
        npwpFileId = up.fileId;
      }
      if (foto_profil) {
        const up = await uploadOne(foto_profil, "profil", true);
        if (profilFileId) oldFileIdsToDelete.push(profilFileId);
        profilFileId = up.fileId;
      }
    }

    // Upsert Agent by id_pengguna
    // ✅ SIMPAN FILE ID ke kolom foto_ktp_url / foto_npwp_url / foto_profil_url (meski namanya url)
    const agent = await prisma.agent.upsert({
      where: { id_pengguna },
      create: {
        id_pengguna,
        nama_kantor: nama_kantor_final,
        kota_area,
        nomor_whatsapp,
        id_upline,

        foto_ktp_url: ktpFileId, // ✅ fileId saja
        foto_npwp_url: npwpFileId, // ✅ fileId saja
        foto_profil_url: profilFileId, // ✅ fileId saja

        link_instagram,
        link_tiktok,
        link_facebook,
        status_keanggotaan: status_agent_enum.PENDING,
      },
      update: {
        nama_kantor: nama_kantor_final,
        kota_area,
        nomor_whatsapp,
        id_upline,

        foto_ktp_url: ktpFileId, // ✅ fileId saja (lama dipertahankan kalau tidak diganti)
        foto_npwp_url: npwpFileId, // ✅ fileId saja
        foto_profil_url: profilFileId, // ✅ fileId saja

        link_instagram,
        link_tiktok,
        link_facebook,
        status_keanggotaan: status_agent_enum.PENDING,
        diperbarui_pada: new Date(),
      },
      select: {
        id_agent: true,
        status_keanggotaan: true,
        nama_kantor: true,
        kota_area: true,
        foto_ktp_url: true,
        foto_npwp_url: true,
        foto_profil_url: true,
      },
    });

    // ✅ Bersihkan dokumen lama di Google Drive yang sudah diganti (best-effort,
    // tidak boleh sampai menggagalkan response karena data DB sudah tersimpan).
    if (driveAccessToken && oldFileIdsToDelete.length) {
      const token = driveAccessToken;
      await Promise.all(
        oldFileIdsToDelete.map((fileId) =>
          deleteDriveFile(token, fileId).catch((e) =>
            console.warn(`Gagal menghapus file lama di Drive (${fileId}):`, e)
          )
        )
      );
    }

    // Kirim notifikasi "agent baru bergabung" ke principal/owner & upline —
    // dedup berdasarkan id_agent_ref dilakukan di dalam helper-nya.
    notifyNewAgentRegistration({
      id_agent: agent.id_agent,
      nama_lengkap,
      id_upline,
    }).catch((e) => console.warn("notifyNewAgentRegistration failed:", e));

    // ✅ kalau frontend butuh preview url, kirim derived_url di response saja
    return NextResponse.json({
      ok: true,
      message: "Pendaftaran agen berhasil. Menunggu verifikasi (PENDING).",
      agent,
      derived_urls: {
        foto_ktp_url: agent.foto_ktp_url ? publicDriveUrlFromId(agent.foto_ktp_url) : null,
        foto_npwp_url: agent.foto_npwp_url ? publicDriveUrlFromId(agent.foto_npwp_url) : null,
        foto_profil_url: agent.foto_profil_url ? publicDriveUrlFromId(agent.foto_profil_url) : null,
      },
    });
  } catch (err: any) {
    console.error("daftar-agent error:", err);
    return NextResponse.json(
      { ok: false, message: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
