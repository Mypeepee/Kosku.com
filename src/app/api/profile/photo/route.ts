// src/app/api/profile/photo/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "../../auth/[...nextauth]/route";

const prisma = new PrismaClient();

// ========= Helper: ambil access token Google =========
async function getDriveAccessToken(): Promise<string> {
  const client_id = process.env.GOOGLE_CLIENT_ID;
  const client_secret = process.env.GOOGLE_CLIENT_SECRET;
  const refresh_token = process.env.GOOGLE_REFRESH_TOKEN;

  if (!client_id || !client_secret || !refresh_token) {
    throw new Error(
      "Google env (GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN) belum diset"
    );
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id,
      client_secret,
      refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error("Gagal tukar refresh_token:", txt);
    throw new Error("Tidak bisa mendapatkan Google access token");
  }

  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

// ========= Helper: cari / buat folder client di dalam Data_Agent =========
// parentFolderId = folder Data_Agent (sama seperti di Laravel: 1u8faFug3GV3lB6y0L2TbwEX48IPAUtiQ)
async function getOrCreateFolder(
  folderName: string,
  parentFolderId: string,
  accessToken: string
): Promise<string> {
  const q = `'${parentFolderId}' in parents and name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const searchUrl = new URL("https://www.googleapis.com/drive/v3/files");
  searchUrl.searchParams.set("q", q);
  searchUrl.searchParams.set("fields", "files(id, name)");
  searchUrl.searchParams.set("spaces", "drive");

  const searchRes = await fetch(searchUrl.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!searchRes.ok) {
    const txt = await searchRes.text();
    console.error("Error search folder:", txt);
    throw new Error("Gagal mencari folder di Google Drive");
  }

  const searchJson = (await searchRes.json()) as { files?: { id: string }[] };
  if (searchJson.files && searchJson.files.length > 0) {
    return searchJson.files[0].id;
  }

  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentFolderId],
    }),
  });

  if (!createRes.ok) {
    const txt = await createRes.text();
    console.error("Error create folder:", txt);
    throw new Error("Gagal membuat folder di Google Drive");
  }

  const created = (await createRes.json()) as { id: string };
  return created.id;
}

// ========= Helper: upload base64 foto profil ke Drive =========
async function uploadProfileToDrive(params: {
  base64Image: string;
  filename: string;
  folderName: string;
}): Promise<string> {
  const { base64Image, filename, folderName } = params;

  // ID folder Data_Agent (hardcode seperti di Laravel atau ambil dari env)
  const parentFolderId =
    process.env.GOOGLE_DATA_AGENT_FOLDER_ID ||
    "1u8faFug3GV3lB6y0L2TbwEX48IPAUtiQ";

  const accessToken = await getDriveAccessToken();

  const targetFolderId = await getOrCreateFolder(
    folderName,
    parentFolderId,
    accessToken
  );

  // hilangkan prefix data URL
  const cleaned = base64Image.replace(
    /^data:image\/[a-zA-Z]+;base64,/,
    ""
  );
  const buffer = Buffer.from(cleaned, "base64");

  const boundary = "-------PROFILE314159265358979323846";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: filename,
    parents: [targetFolderId],
  };

  const bodyParts = [
    delimiter +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(metadata),
    delimiter +
      "Content-Type: image/jpeg\r\n" +
      "Content-Transfer-Encoding: base64\r\n\r\n" +
      buffer.toString("base64"),
    closeDelimiter,
  ];

  const multipartBody = bodyParts.join("");

  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );

  if (!uploadRes.ok) {
    const txt = await uploadRes.text();
    console.error("Drive profile upload error:", txt);
    throw new Error("Gagal upload foto profil ke Google Drive");
  }

  const uploaded = (await uploadRes.json()) as { id: string };
  const fileId = uploaded.id;

  // set publik
  await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    }
  );

  return fileId;
}

// ========= POST /api/profile/photo =========
// Body JSON: { cropped_profile_image?: string }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { cropped_profile_image } = body as {
      cropped_profile_image?: string;
    };

    if (!cropped_profile_image) {
      return NextResponse.json(
        { error: "cropped_profile_image tidak ditemukan" },
        { status: 400 }
      );
    }

    // pastikan user agent
    const agent = await prisma.agent.findUnique({
      where: { id_pengguna: session.user.id },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Akun agent tidak ditemukan" },
        { status: 404 }
      );
    }

    const accessToken = await getDriveAccessToken();

    // kalau picture lama berupa fileId pendek seperti di Laravel, hapus
    if (agent.foto_profil_url && agent.foto_profil_url.length < 100) {
      await fetch(
        `https://www.googleapis.com/drive/v3/files/${agent.foto_profil_url}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      ).catch((e) =>
        console.warn("Gagal hapus foto profil lama di Drive:", e)
      );
    }

    // nama folder: slug dari nama agent atau fallback id_pengguna
    const nama =
      (agent.nama && agent.nama.trim().length > 0
        ? agent.nama
        : session.user.name || session.user.id) || session.user.id;

    const folderName = nama
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");

    const filename = `agent_profile_${Date.now()}.jpg`;

    const fileId = await uploadProfileToDrive({
      base64Image: cropped_profile_image,
      filename,
      folderName,
    });

    const updated = await prisma.agent.update({
      where: { id_agent: agent.id_agent },
      data: {
        foto_profil_url: fileId,
      },
    });

    return NextResponse.json({
      success: true,
      fileId,
      agent: updated,
    });
  } catch (err) {
    console.error("Error update foto profil:", err);
    return NextResponse.json(
      { error: "Gagal memperbarui foto profil" },
      { status: 500 }
    );
  }
}
