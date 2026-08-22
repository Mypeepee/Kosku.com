/**
 * Utilitas jarak geografis.
 *
 * Dipakai untuk menghitung jarak patokan (kampus/stasiun/dll) ke properti dari
 * koordinat masing-masing — jauh lebih konsisten dibanding pemilik menebak
 * sendiri "5 menit", yang artinya beda-beda tiap orang (jalan kaki vs motor).
 */

const RADIUS_BUMI_KM = 6371;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Jarak garis lurus (great-circle) antara dua koordinat, dalam kilometer. */
export function jarakKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * RADIUS_BUMI_KM * Math.asin(Math.sqrt(h));
}

/**
 * Bulatkan jarak agar enak dibaca: di bawah 10 km pakai 1 desimal (0,8 / 2,4),
 * di atas itu bulat saja (12). Minimal 0,1 supaya tidak pernah tampil "0".
 */
export function bulatkanJarakKm(km: number): number {
  if (km < 0.1) return 0.1;
  if (km < 10) return Math.round(km * 10) / 10;
  return Math.round(km);
}
