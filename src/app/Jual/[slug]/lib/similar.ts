import prisma from "@/lib/prisma";
import { ambilLimitLelangSebelumnya } from "@/lib/auctionDiscount";
import type { PropertyItem } from "@/app/properti/[slug]/types";

/**
 * Rekomendasi "Properti Serupa" ala situs real estate profesional.
 *
 * Pendekatan: weighted relevance score (bukan sekadar "kota sama").
 * Faktor (lokasi paling kuat):
 *   - Lokasi   : kecamatan sama > kota sama > provinsi sama
 *   - Kategori : harus sama (hard filter)
 *   - Harga    : makin dekat (band ±50%) makin tinggi
 *   - Luas tanah & kamar tidur: makin mirip makin tinggi
 * Lelang ikut disertakan TAPI hanya yang skornya >= RELEVANCE_MIN
 * (jadi praktis cuma lelang yang lokasinya & harganya benar-benar relevan).
 */

const num = (v: any): number => (v == null ? 0 : Number(v));

function normalizeImages(raw?: string | null): string[] {
  if (!raw || raw.trim() === "") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) =>
      s.startsWith("http://") || s.startsWith("https://") || s.startsWith("/")
        ? s
        : `https://drive.google.com/thumbnail?id=${s}&sz=w800`,
    );
}

function normalizeAgentPhoto(fileId?: string | null): string {
  if (!fileId || fileId.trim() === "") return "/images/default-profile.png";
  const t = fileId.trim();
  if (t.startsWith("http://") || t.startsWith("https://") || t.startsWith("/")) return t;
  return `https://drive.google.com/thumbnail?id=${t}&sz=w64`;
}

// Normalisasi nama wilayah supaya format yang beda tetap dianggap sama.
// "Surabaya" / "Kota Surabaya" / "KOTA SURABAYA" → "surabaya".
function normLoc(s?: string | null): string {
  return (s ?? "")
    .toString()
    .toLowerCase()
    .replace(/^(kota|kab\.?|kabupaten|kotamadya|kec\.?|kecamatan)\s+/, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// Inti nama kota untuk SQL "contains" (toleran thd prefix Kota/Kab).
function kotaSearchTerm(s?: string | null): string {
  return (s ?? "")
    .toString()
    .toLowerCase()
    .replace(/^(kota|kab\.?|kabupaten|kotamadya)\s+/i, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

// Provinsi sering berantakan (data lelang) + bisa beda bahasa (form). Map seperlunya.
const PROV_ALIAS: Record<string, string> = {
  "east java": "jawa timur",
  "central java": "jawa tengah",
  "west java": "jawa barat",
  "north sumatra": "sumatera utara",
  "south sulawesi": "sulawesi selatan",
  "special region of yogyakarta": "yogyakarta",
};
function provinsiSearchTerm(s?: string | null): string {
  const t = (s ?? "")
    .toString()
    .toLowerCase()
    .replace(/^(provinsi|propinsi|prov\.?)\s+/, "")
    .replace(/[^a-z\s]/g, "")
    .trim();
  return PROV_ALIAS[t] ?? t;
}

// Harga efektif untuk perbandingan: lelang → nilai_limit_lelang; jual → promo (bila valid) / harga.
function effectivePrice(l: {
  jenis_transaksi: any;
  harga: any;
  harga_promo: any;
  nilai_limit_lelang: any;
}): number {
  if (String(l.jenis_transaksi).toUpperCase() === "LELANG") return num(l.nilai_limit_lelang);
  const h = num(l.harga);
  const p = num(l.harga_promo);
  return p > 0 && p < h ? p : h;
}

const SELECT = {
  id_property: true,
  slug: true,
  judul: true,
  kota: true,
  provinsi: true,
  kecamatan: true,
  // kelurahan + sertifikat dibutuhkan mesin pencocokan aset lelang
  // (auctionDiscount) untuk menentukan "aset ini pernah dilelang lebih mahal".
  // Tanpa keduanya, penanda turun harga tidak akan pernah muncul di blok ini
  // padahal muncul di halaman daftar — kartu yang sama tampil beda.
  kelurahan: true,
  legalitas: true,
  nomor_legalitas: true,
  latitude: true,
  longitude: true,
  alamat_lengkap: true,
  harga: true,
  harga_promo: true,
  nilai_limit_lelang: true,
  jenis_transaksi: true,
  kategori: true,
  gambar: true,
  luas_tanah: true,
  luas_bangunan: true,
  kamar_tidur: true,
  kamar_mandi: true,
  tanggal_lelang: true,
  is_hot_deal: true,
  agent: {
    select: {
      nama_kantor: true,
      foto_profil_url: true,
      pengguna: { select: { nama_lengkap: true } },
    },
  },
} as const;

const MAX_RESULTS = 12;
/** Ambang relevansi minimum. ~ kota sama + kategori sama sudah ≈ 50. */
const RELEVANCE_MIN = 50;

export async function getSimilarItems(current: any): Promise<PropertyItem[]> {
  try {
    const curId = BigInt(String(current.id_property));
    const baseWhere: any = {
      id_property: { not: curId },
      status_tayang: "TERSEDIA",
      kategori: current.kategori,
      jenis_transaksi: { in: ["PRIMARY", "SECONDARY", "LELANG"] },
    };

    // Lokasi sering beda format ("Surabaya" vs "Kota Surabaya" vs "KOTA SURABAYA"),
    // jadi cocokkan kota via "contains" case-insensitive pada inti namanya.
    const kotaTerm = kotaSearchTerm(current.kota);
    let pool = kotaTerm
      ? await prisma.listing.findMany({
          where: { ...baseWhere, kota: { contains: kotaTerm, mode: "insensitive" } },
          select: SELECT,
          take: 50,
          orderBy: [{ is_hot_deal: "desc" }, { tanggal_dibuat: "desc" }],
        })
      : [];

    // Fallback: kalau kota kurang, melebar ke provinsi (toleran thd data berantakan).
    if (pool.length < 12) {
      const provTerm = provinsiSearchTerm(current.provinsi);
      if (provTerm) {
        const more = await prisma.listing.findMany({
          where: { ...baseWhere, provinsi: { contains: provTerm, mode: "insensitive" } },
          select: SELECT,
          take: 30,
          orderBy: [{ is_hot_deal: "desc" }, { tanggal_dibuat: "desc" }],
        });
        const seen = new Set(pool.map((p) => String(p.id_property)));
        pool = [...pool, ...more.filter((m) => !seen.has(String(m.id_property)))];
      }
    }

    const subjectPrice = effectivePrice(current);
    const curLand = num(current.luas_tanah);
    const curBeds: number | null = current.kamar_tidur ?? null;
    const curKec = normLoc(current.kecamatan);
    const curKota = normLoc(current.kota);
    const curProv = normLoc(current.provinsi);

    const scored = pool.map((c) => {
      let score = 20; // kategori sama (hard filter) → baseline

      // Lokasi — faktor terkuat (dibandingkan setelah dinormalisasi)
      const cKec = normLoc(c.kecamatan);
      const cKota = normLoc(c.kota);
      const cProv = normLoc(c.provinsi);
      if (curKec && cKec && cKec === curKec) score += 45;
      else if (curKota && cKota && cKota === curKota) score += 30;
      else if (curProv && cProv && cProv === curProv) score += 12;

      // Kedekatan harga (band ±50%)
      const candPrice = effectivePrice(c);
      if (subjectPrice > 0 && candPrice > 0) {
        const diff = Math.abs(candPrice - subjectPrice) / subjectPrice;
        score += Math.max(0, 25 * (1 - diff / 0.5));
      }

      // Kedekatan luas tanah (band ±60%)
      const cl = num(c.luas_tanah);
      if (curLand > 0 && cl > 0) {
        const d = Math.abs(cl - curLand) / curLand;
        score += Math.max(0, 12 * (1 - d / 0.6));
      }

      // Kamar tidur
      if (curBeds && c.kamar_tidur) {
        if (c.kamar_tidur === curBeds) score += 8;
        else if (Math.abs(c.kamar_tidur - curBeds) === 1) score += 4;
      }

      if (c.is_hot_deal) score += 4;

      return { c, score };
    });

    const top = scored
      .filter((s) => s.score >= RELEVANCE_MIN)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS);

    // Satu query terindeks untuk seluruh blok (maksimal 12 item), bukan dua
    // query per kartu — lihat catatan biaya di src/lib/auctionDiscount.ts.
    const limitAwal = await ambilLimitLelangSebelumnya(top.map((s) => s.c));

    return top.map(({ c }) => {
      const imgs = normalizeImages(c.gambar);
      const isLel = String(c.jenis_transaksi).toUpperCase() === "LELANG";
      const h = num(c.harga);
      const p = num(c.harga_promo);
      return {
        id_property: String(c.id_property),
        slug: c.slug,
        judul: c.judul,
        kota: c.kota ?? "",
        kecamatan: c.kecamatan ?? null,
        kelurahan: c.kelurahan ?? null,
        alamat_lengkap: c.alamat_lengkap ?? "",
        harga: isLel ? num(c.nilai_limit_lelang) : h,
        harga_promo: !isLel && p > 0 && p < h ? p : null,
        jenis_transaksi: c.jenis_transaksi,
        kategori: c.kategori,
        gambar: imgs[0] || "/images/hero/banner.jpg",
        foto_list: imgs,
        luas_tanah: num(c.luas_tanah),
        luas_bangunan: num(c.luas_bangunan),
        kamar_tidur: c.kamar_tidur ?? 0,
        kamar_mandi: c.kamar_mandi ?? 0,
        tanggal_lelang: c.tanggal_lelang ? c.tanggal_lelang.toISOString() : null,
        lelang_limit_awal: limitAwal.get(String(c.id_property)) ?? null,
        agent_name: c.agent?.pengguna?.nama_lengkap || "Agent Premier",
        agent_photo: normalizeAgentPhoto(c.agent?.foto_profil_url),
        agent_office: c.agent?.nama_kantor || "Premier Asset",
        is_hot_deal: !!c.is_hot_deal,
      } as PropertyItem;
    });
  } catch (err) {
    console.error("getSimilarItems error:", err);
    return [];
  }
}
