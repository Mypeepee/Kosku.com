// src/lib/prospek.ts
// ---------------------------------------------------------------------------
// Identitas satu "calon klien" — dipakai bersama oleh sinkron prospek dan
// penghapusan klien.
//
// KENAPA HARUS SATU BERKAS. Dua tempat harus sepakat tentang identitas orang
// yang sama: sinkron yang memutuskan "orang ini sudah punya kartu klien", dan
// penghapusan yang memasang nisan "jangan impor orang ini lagi". Kalau
// normalisasi nomornya berbeda satu langkah saja — satu sisi menghapus awalan
// nol, sisi lain tidak — nisannya tidak akan pernah cocok dengan kandidatnya,
// dan klien yang dihapus terus-menerus hidup kembali tanpa ada yang mengerti
// kenapa.
// ---------------------------------------------------------------------------

/** Nomor telepon → bentuk kanonik 62xxxxxxxxx, atau null bila tidak masuk akal.
 *  Satu nomor = satu orang; inilah kunci dedup utama di seluruh CRM. */
export function normPhone(raw?: string | null): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("0"))      d = "62" + d.slice(1);
  else if (d.startsWith("8")) d = "62" + d;
  d = d.replace(/^620+/, "62");
  if (d.length < 9 || d.length > 16) return null;
  return d;
}

/** Semua kunci yang mewakili seorang klien di mata sinkron prospek.
 *
 *  Ada dua, dan keduanya perlu: orang yang sama bisa datang lewat nomor
 *  teleponnya (Titip Jual, WA organik) ATAU lewat id lead-nya (formulir yang
 *  tidak menyertakan nomor sah). Memasang nisan hanya pada salah satunya
 *  meninggalkan jalan masuk yang lain tetap terbuka. */
export function kunciProspek(k: {
  nomor_whatsapp?: string | null;
  id_lead_asal?: bigint | number | string | null;
}): string[] {
  const kunci: string[] = [];
  const p = normPhone(k.nomor_whatsapp);
  if (p) kunci.push(p);
  if (k.id_lead_asal != null) kunci.push(`lead:${k.id_lead_asal}`);
  return kunci;
}
