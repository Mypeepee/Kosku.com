// src/app/api/profile/npwp/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "../../auth/[...nextauth]/route";

const prisma = new PrismaClient();

// ================ Helper: Google OAuth token ================
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

// ================ Helper: folder di Drive (sama seperti KTP) ================
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

// ================ Helper: upload base64 NPWP ke Drive ================
async function uploadNpwpToDrive(params: {
  base64Image: string;
  filename: string;
  folderName: string;
}): Promise<string> {
  const { base64Image, filename, folderName } = params;

  const parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!parentFolderId) {
    throw new Error("GOOGLE_DRIVE_FOLDER_ID belum diset");
  }

  const accessToken = await getDriveAccessToken();
  const targetFolderId = await getOrCreateFolder(
    folderName,
    parentFolderId,
    accessToken
  );

  const cleaned = base64Image.replace(
    /^data:image\/[a-zA-Z]+;base64,/,
    ""
  );
  const buffer = Buffer.from(cleaned, "base64");

  const boundary = "-------NPWP314159265358979323846";
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
    console.error("Drive NPWP upload error:", txt);
    throw new Error("Gagal upload NPWP ke Google Drive");
  }

  const uploaded = (await uploadRes.json()) as { id: string };
  const fileId = uploaded.id;

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

// ================ POST /api/profile/npwp ================
// Body JSON: { nomor_npwp: string, cropped_image_npwp?: string }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { nomor_npwp, cropped_image_npwp } = body as {
      nomor_npwp?: string;
      cropped_image_npwp?: string;
    };

    if (!nomor_npwp) {
      return NextResponse.json(
        { error: "nomor_npwp wajib diisi" },
        { status: 400 }
      );
    }

    // ambil nama user untuk nama folder
    const user = await prisma.pengguna.findUnique({
      where: { id_pengguna: session.user.id },
      select: { nama_lengkap: true },
    });

    const nama = user?.nama_lengkap || session.user.id;
    const folderName = nama
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");

    let fileId: string | null = null;

    if (cropped_image_npwp) {
      const filename = `npwp_${Date.now()}.jpg`;
      fileId = await uploadNpwpToDrive({
        base64Image: cropped_image_npwp,
        filename,
        folderName,
      });
    }

    const updatedAgent = await prisma.agent.update({
      where: {
        id_pengguna: session.user.id,
      },
      data: {
        // simpan nomor dan fileId (jika ada)
        nomor_npwp: nomor_npwp,
        foto_npwp_url: fileId ?? undefined,
        diperbarui_pada: new Date(),
      },
    });

    return NextResponse.json({
      fileId,
      agent: updatedAgent,
    });
  } catch (err) {
    console.error("Error upload/simpan NPWP:", err);
    return NextResponse.json(
      { error: "Gagal menyimpan data NPWP" },
      { status: 500 }
    );
  }
}
