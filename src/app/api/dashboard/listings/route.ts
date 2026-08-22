// src/app/api/dashboard/listings/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";

const okJson = (data: any, status = 200, extraHeaders?: Record<string, string>) =>
  NextResponse.json(data, { status, headers: extraHeaders });

// ---------- number helpers ----------
const toNumber = (v: any): number => {
  if (v === null || v === undefined) return 0;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "object" && typeof v.toString === "function") return Number(v.toString());
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const toNullableNumber = (v: any): number | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "object" && typeof v.toString === "function") {
    const n = Number(v.toString());
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const toIsoOrNull = (d: any): string | null => {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
};

// ---------- image helpers ----------
function normalizeUrl(u: string) {
  const s = (u || "").trim();
  if (!s) return "";
  return s.replace(/\s+/g, "");
}
function sanitizeDriveId(id: string) {
  return (id || "").trim().replace(/_+$/g, "");
}
function toDriveThumb(url: string) {
  if (/drive\.google\.com\/thumbnail\?id=/i.test(url)) {
    const m = url.match(/thumbnail\?id=([^&]+)/i);
    if (m?.[1]) return `https://drive.google.com/thumbnail?id=${sanitizeDriveId(m[1])}`;
    return url;
  }
  const m1 = url.match(/drive\.google\.com\/file\/d\/([^/]+)\//i);
  if (m1?.[1]) return `https://drive.google.com/thumbnail?id=${sanitizeDriveId(m1[1])}`;
  const m2 = url.match(/drive\.google\.com\/open\?id=([^&]+)/i);
  if (m2?.[1]) return `https://drive.google.com/thumbnail?id=${sanitizeDriveId(m2[1])}`;
  const m3 = url.match(/drive\.google\.com\/uc\?[^#]*id=([^&]+)/i);
  if (m3?.[1]) return `https://drive.google.com/thumbnail?id=${sanitizeDriveId(m3[1])}`;
  return url;
}
function isProbablyUrl(url: string) {
  return !!url && (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/"));
}
function extractFirstImageUrl(raw: any): string {
  if (!raw) return "";
  const str = String(raw).trim();
  if (!str) return "";
  const candidates = str
    .split(",")
    .map((x) => normalizeUrl(x))
    .filter(Boolean)
    .map((x) => toDriveThumb(x));
  for (const c of candidates) if (isProbablyUrl(c)) return c;
  const single = toDriveThumb(normalizeUrl(str));
  return isProbablyUrl(single) ? single : "";
}
function toProxyImg(url: string) {
  if (!url) return "";
  if (url.startsWith("/")) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return `/api/img?url=${encodeURIComponent(url)}`;
  return "";
}

/* =========================================================
   ✅ VENDOR SEARCH (FIXED)
   - "BRI Purbalingga" => (alias BRI) AND (Purbalingga)
   - "BRI Kusuma" => (alias BRI) AND (Kusuma)
   - "BPR" => ONLY BPR banks (BPR / Bank Perkreditan Rakyat / Bank Perekonomian Rakyat)
   - "BPD" => ALL regional banks (Bank Pembangunan Daerah ...)
========================================================= */

const STOPWORDS = new Set([
  "PT", "PT.", "TBK", "TBK.", "Tbk", "PERSERO", "(PERSERO)", "PERSERO,",
  "DIVISI", "DIV", "REGION", "REG", "RETAIL", "COLLECTION", "RECOVERY",
  "ASSET", "MANAGEMENT", "KANTOR", "CABANG", "KC", "UNIT", "WILAYAH", "AREA",
  "DAN", "&"
]);

function normUp(s: string) {
  return (s ?? "")
    .toUpperCase()
    .replace(/[()]/g, " ")
    .replace(/[.,–—-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// alias yang kamu butuhin (berdasarkan vendor DB kamu)
const BANK_ALIASES: Record<string, string[]> = {
  BRI: ["BRI", "BANK RAKYAT INDONESIA", "RAKYAT INDONESIA"],
  BNI: ["BNI", "BANK NEGARA INDONESIA", "NEGARA INDONESIA"],
  BCA: ["BCA", "BANK CENTRAL ASIA", "CENTRAL ASIA"],
  BTN: ["BTN", "BANK TABUNGAN NEGARA", "TABUNGAN NEGARA"],
  MANDIRI: ["MANDIRI", "BANK MANDIRI", "RETAIL ASSET MANAGEMENT"],
  DANAMON: ["DANAMON", "BANK DANAMON", "DANAMON INDONESIA"],
  PNM: ["PNM", "PERMODALAN NASIONAL MADANI"],

  // ✅ ini penting: BPR harus GENERIC (bukan “Jombang” doang)
  BPR: ["BPR", "BANK PERKREDITAN RAKYAT", "BANK PEREKONOMIAN RAKYAT"],

  // ✅ ini juga harus GENERIC (biar BJB, Papua, Jatim, dll masuk)
  BPD: ["BPD", "BANK PEMBANGUNAN DAERAH", "PEMBANGUNAN DAERAH"],

  // optional tambahan (kalau user cari BJB langsung)
  BJB: ["BJB", "BANK BJB", "JAWA BARAT", "BANTEN", "BANK PEMBANGUNAN DAERAH JAWA BARAT DAN BANTEN"],
};

function tokenize(input: string): string[] {
  const up = normUp(input);
  if (!up) return [];
  const tokens = up.split(" ").map((t) => t.trim()).filter(Boolean);
  // buang stopwords, buang token super pendek
  return tokens.filter((t) => !STOPWORDS.has(t) && t.length >= 3).slice(0, 8);
}

function detectBankKey(tokensUp: string[]): string | null {
  // deteksi berdasar token yang user ketik
  // prioritas: BPR/BPD biar gak “ketarik” ke bank lain
  const set = new Set(tokensUp);

  if (set.has("BPR")) return "BPR";
  if (set.has("BPD")) return "BPD";

  if (set.has("BRI") || set.has("RAKYAT")) return "BRI";
  if (set.has("BNI") || set.has("NEGARA")) return "BNI";
  if (set.has("BCA") || set.has("CENTRAL")) return "BCA";
  if (set.has("BTN") || set.has("TABUNGAN")) return "BTN";
  if (set.has("MANDIRI")) return "MANDIRI";
  if (set.has("DANAMON")) return "DANAMON";
  if (set.has("PNM")) return "PNM";
  if (set.has("BJB")) return "BJB";

  // fuzzy: kalau user ketik "BANK JATIM" dia bakal token "JATIM"
  // tapi itu masih masuk via BPD phrase "BANK PEMBANGUNAN DAERAH" + token "JATIM" (AND)
  return null;
}

/**
 * Build vendor where:
 * - kalau user memasukkan bankKey + kata tambahan => (alias OR) AND (tokens lain)
 * - kalau hanya bankKey => alias OR saja (lebih presisi)
 * - kalau gak ada bankKey => AND tokens (lebih ketat)
 */
function buildVendorWhere(vendorRaw: string) {
  const raw = (vendorRaw ?? "").trim();
  if (!raw) return null;

  const tokens = tokenize(raw);
  const tokensUp = tokens.map((t) => t.toUpperCase());

  const bankKey = detectBankKey(tokensUp);

  // tokens tambahan (mis. "PURBALINGGA", "KUSUMA", "SURABAYA", "TEGAL", "PAPUA")
  const extraTokens =
    bankKey
      ? tokens.filter((t) => t.toUpperCase() !== bankKey) // buang token "BRI/BPR/BPD"
      : tokens;

  // alias terms
  const aliasTerms = bankKey ? (BANK_ALIASES[bankKey] ?? [bankKey]) : [];

  // (alias OR)
  const aliasOr =
    aliasTerms.length
      ? { OR: aliasTerms.map((t) => ({ vendor: { contains: t, mode: "insensitive" as const } })) }
      : null;

  // (extraTokens AND)
  const extraAnd =
    extraTokens.length
      ? { AND: extraTokens.map((t) => ({ vendor: { contains: t, mode: "insensitive" as const } })) }
      : null;

  // aturan:
  // - jika ada bankKey: pakai (alias OR) AND (extraAnd jika ada)
  // - jika tidak ada bankKey: pakai AND token (ketat), fallback contains raw
  if (bankKey) {
    if (extraAnd) return { AND: [aliasOr, extraAnd] };
    return aliasOr;
  }

  // no bankKey
  if (extraAnd) {
    return {
      OR: [
        extraAnd, // ketat
        { vendor: { contains: raw, mode: "insensitive" as const } }, // fallback
      ],
    };
  }

  return { vendor: { contains: raw, mode: "insensitive" as const } };
}

/* =====================================================
   POST (create listing) - tetap seperti punya kamu
===================================================== */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return okJson({ error: "Unauthorized" }, 401);

    const agentId = (session.user as any).agentId as string | undefined;
    if (!agentId) return okJson({ error: "agentId missing in session" }, 400);

    const body = await request.json();

    const agent = await prisma.agent.findUnique({
      where: { id_agent: agentId },
      select: {
        id_agent: true,
        poin: true,
        nama_kantor: true,
        pengguna: { select: { nama_lengkap: true, email: true } },
      },
    });
    if (!agent) return okJson({ error: "Agent not found" }, 404);

    if (!body.judul || !body.slug || !body.kota || !body.jenis_transaksi || !body.kategori) {
      return okJson(
        { error: "Missing required fields (judul, slug, kota, jenis_transaksi, kategori)" },
        400
      );
    }

    const jenis_transaksi = String(body.jenis_transaksi).toUpperCase() as
      | "PRIMARY"
      | "SECONDARY"
      | "LELANG"
      | "SEWA";

    const kategori = String(body.kategori).toUpperCase() as any;

    if (jenis_transaksi === "LELANG") {
      if (!body.nilai_limit_lelang || Number(body.nilai_limit_lelang) <= 0) {
        return okJson({ error: "Nilai limit lelang wajib diisi untuk tipe LELANG" }, 400);
      }
      if (!body.uang_jaminan || Number(body.uang_jaminan) <= 0) {
        return okJson({ error: "Uang jaminan wajib diisi untuk tipe LELANG" }, 400);
      }
      if (!body.tanggal_lelang) {
        return okJson({ error: "Tanggal lelang wajib diisi untuk tipe LELANG" }, 400);
      }
    } else {
      if (body.harga == null || Number(body.harga) <= 0) {
        return okJson({ error: "Harga wajib diisi untuk tipe non-LELANG" }, 400);
      }
    }

    const harga = jenis_transaksi === "LELANG" ? Number(body.nilai_limit_lelang) : Number(body.harga);

    const vendor =
      jenis_transaksi === "LELANG"
        ? `Balai Lelang Solusindo - ${agent.pengguna.nama_lengkap}`
        : `${agent.nama_kantor || "Premier"} - ${agent.pengguna.nama_lengkap}`;

    const listing = await prisma.listing.create({
      data: {
        id_agent: agent.id_agent,
        judul: body.judul,
        slug: body.slug,
        deskripsi: body.deskripsi || null,
        jenis_transaksi,
        kategori,
        vendor,
        status_tayang: body.status_tayang || "TERSEDIA",
        harga,
        harga_promo: jenis_transaksi !== "LELANG" && body.harga_promo != null ? Number(body.harga_promo) : null,
        tanggal_lelang: jenis_transaksi === "LELANG" && body.tanggal_lelang ? new Date(body.tanggal_lelang) : null,
        uang_jaminan: jenis_transaksi === "LELANG" && body.uang_jaminan != null ? Number(body.uang_jaminan) : null,
        nilai_limit_lelang:
          jenis_transaksi === "LELANG" && body.nilai_limit_lelang != null ? Number(body.nilai_limit_lelang) : null,
        link: body.link || null,
        alamat_lengkap: body.alamat_lengkap || null,
        provinsi: body.provinsi || null,
        kota: body.kota,
        kecamatan: body.kecamatan || null,
        kelurahan: body.kelurahan || null,
        latitude: body.latitude != null ? Number(body.latitude) : null,
        longitude: body.longitude != null ? Number(body.longitude) : null,
        luas_tanah: body.luas_tanah != null ? Number(body.luas_tanah) : null,
        luas_bangunan: body.luas_bangunan != null ? Number(body.luas_bangunan) : null,
        jumlah_lantai: body.jumlah_lantai || 1,
        kamar_tidur: body.kamar_tidur ?? null,
        kamar_mandi: body.kamar_mandi ?? null,
        daya_listrik: body.daya_listrik ?? null,
        sumber_air: body.sumber_air || null,
        hadap_bangunan: body.hadap_bangunan || null,
        kondisi_interior: body.kondisi_interior || null,
        legalitas: body.legalitas || null,
        nomor_legalitas: body.nomor_legalitas || null,
        gambar: body.gambar || null,
        lampiran: body.lampiran || null,
        is_hot_deal: body.is_hot_deal || false,
      },
    });

    const newPoin = (agent.poin ?? 0) + 10;
    await prisma.agent.update({ where: { id_agent: agent.id_agent }, data: { poin: newPoin } });
    await prisma.riwayatPoin.create({
      data: {
        id_agent: agent.id_agent,
        jenis_aktivitas: "Tambah Listing",
        deskripsi: `Menambahkan listing: ${body.judul}`,
        poin: 10,
        tipe_transaksi: "DAPAT",
        // BigInt langsung, bukan .toString(): kolomnya memang `BigInt?`.
        // Prisma kebetulan menerima string juga, jadi tidak ada data yang
        // hilang selama ini — yang hilang cuma jaminan tipenya.
        id_referensi: listing.id_property,
        tabel_referensi: "listing",
        saldo_sebelum: agent.poin ?? 0,
        saldo_sesudah: newPoin,
      },
    });

    return okJson({
      success: true,
      data: { ...listing, id_property: listing.id_property.toString() },
      message: "Listing berhasil dibuat dan poin ditambahkan (+10)",
    });
  } catch (error: any) {
    console.error("❌ Error creating listing:", error);
    return okJson({ error: "Failed to create listing", details: error?.message || "Unknown error" }, 500);
  }
}

/* =====================================================
   GET (dashboard listings)
===================================================== */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return okJson({ error: "Unauthorized" }, 401);

    const sessionAgentId = (session.user as any).agentId as string | undefined;

    const { searchParams } = new URL(request.url);

    const scopeRaw = (searchParams.get("scope") || "all").toLowerCase();
    const scope = scopeRaw === "mine" ? "mine" : "all";
    const wantMine = scope === "mine";

    const agentIdParam = (searchParams.get("agentId") || "").trim();

    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const limitRaw = parseInt(searchParams.get("limit") || searchParams.get("take") || "30", 10);
    const limit = Math.min(Math.max(limitRaw, 1), 500);
    const skip = (page - 1) * limit;

    // q: id_property (numeric) / alamat_lengkap (text)
    const qRaw = (searchParams.get("q") || "").trim();

    // vendor: bank alias smart
    const vendorRaw = (searchParams.get("vendor") || "").trim();

    const jenisParam = (searchParams.get("jenis") || searchParams.get("jenis_transaksi") || "ALL").trim();
    const kategoriParam = (searchParams.get("kategori") || "ALL").trim();

    const provinsi = (searchParams.get("provinsi") || "").trim();
    const kota = (searchParams.get("kota") || "").trim();
    const kecamatan = (searchParams.get("kecamatan") || "").trim();
    const kelurahan = (searchParams.get("kelurahan") || "").trim();
    const statusTayang = (searchParams.get("status_tayang") || "").trim();

    const where: any = {};

    if (statusTayang) where.status_tayang = statusTayang;

    // scope
    if (agentIdParam) {
      where.id_agent = agentIdParam;
    } else if (wantMine) {
      if (!sessionAgentId) return okJson({ error: "scope=mine but agentId missing in session" }, 400);
      where.id_agent = sessionAgentId;
    }

    // jenis
    if (jenisParam && jenisParam.toUpperCase() !== "ALL") where.jenis_transaksi = jenisParam.toUpperCase();

    // kategori
    if (kategoriParam && kategoriParam.toUpperCase() !== "ALL") where.kategori = kategoriParam.toUpperCase();

    // lokasi equals
    if (provinsi) where.provinsi = { equals: provinsi, mode: "insensitive" };
    if (kota) where.kota = { equals: kota, mode: "insensitive" };
    if (kecamatan) where.kecamatan = { equals: kecamatan, mode: "insensitive" };
    if (kelurahan) where.kelurahan = { equals: kelurahan, mode: "insensitive" };

    // ✅ vendor alias query (AND-able)
    if (vendorRaw) {
      const vw = buildVendorWhere(vendorRaw);
      if (vw) {
        where.AND = where.AND || [];
        where.AND.push(vw);
      }
    }

    // ✅ q: numeric => exact id_property, else => alamat_lengkap contains
    if (qRaw) {
      const isNumericQ = /^\d+$/.test(qRaw);
      where.AND = where.AND || [];

      if (isNumericQ) {
        where.id_property = BigInt(qRaw);
      } else {
        where.AND.push({
          OR: [
            { alamat_lengkap: { contains: qRaw, mode: "insensitive" } },
            { judul: { contains: qRaw, mode: "insensitive" } },
          ],
        });
      }
    }

    const [rows, total] = await Promise.all([
      prisma.listing.findMany({
        where,
        skip,
        take: limit,
        orderBy: { tanggal_diupdate: "desc" },
        select: {
          id_property: true,
          id_agent: true,
          judul: true,
          vendor: true,
          jenis_transaksi: true,
          kategori: true,
          status_tayang: true,

          harga: true,
          harga_promo: true,
          nilai_limit_lelang: true,
          tanggal_lelang: true,

          alamat_lengkap: true,
          provinsi: true,
          kota: true,
          kecamatan: true,
          kelurahan: true,

          luas_tanah: true,
          luas_bangunan: true,
          gambar: true,

          agent: {
            select: {
              nama_kantor: true,
              pengguna: { select: { nama_lengkap: true } },
            },
          },
        },
      }),
      prisma.listing.count({ where }),
    ]);

    const data = rows.map((r: any) => {
      const jenis = String(r.jenis_transaksi);

      const luasBangunan = jenis === "LELANG" ? null : toNullableNumber(r.luas_bangunan);
      const luasTanah = toNullableNumber(r.luas_tanah);
      const luas = toNumber(luasBangunan ?? luasTanah ?? 0);

      const rawImg = extractFirstImageUrl(r.gambar);
      const imageUrl = toProxyImg(rawImg);

      const tanggal_lelang = jenis === "LELANG" ? toIsoOrNull(r.tanggal_lelang) : null;

      const harga = toNumber(r.harga);
      const harga_promo = toNullableNumber(r.harga_promo);
      const nilai_limit_lelang = toNullableNumber(r.nilai_limit_lelang);

      // ✅ display price rules
      const displayHarga =
        jenis === "LELANG" ? toNumber(nilai_limit_lelang ?? 0) : toNumber(harga_promo ?? harga);

      const displayHargaType =
        jenis === "LELANG" ? "NILAI_LIMIT_LELANG" : harga_promo != null ? "HARGA_PROMO" : "HARGA";

      return {
        id: r.id_property.toString(),
        id_agent: r.id_agent,

        judul: r.judul,
        vendor: r.vendor ?? null,

        agent_nama: r.agent?.pengguna?.nama_lengkap ?? null,
        agent_kantor: r.agent?.nama_kantor ?? null,

        jenis_transaksi: r.jenis_transaksi,
        kategori: String(r.kategori),
        status_tayang: r.status_tayang,

        harga,
        harga_promo,
        nilai_limit_lelang,
        tanggal_lelang,

        displayHarga,
        displayHargaType,

        alamat_lengkap: r.alamat_lengkap ?? null,
        provinsi: r.provinsi ?? null,
        kota: r.kota,
        kecamatan: r.kecamatan ?? null,
        kelurahan: r.kelurahan ?? null,

        luas_tanah: luasTanah,
        luas_bangunan: luasBangunan,
        luas,

        imageUrl,
      };
    });

    const debugHeaders = {
      "x-scope": scope,
      "x-agentid-session": sessionAgentId ?? "",
      "x-agentid-param": agentIdParam,
    };

    return okJson(
      { success: true, data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
      200,
      debugHeaders
    );
  } catch (error: any) {
    console.error("❌ Error fetching listings:", error);
    return okJson({ error: "Failed to fetch listings", details: error?.message }, 500);
  }
}