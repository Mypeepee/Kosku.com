/**
 * ─────────────────────────────────────────────────────────────────────────
 *  KEPEMILIKAN INVESTOR — SATU SUMBER KEBENARAN
 * ─────────────────────────────────────────────────────────────────────────
 *
 *  Definisi kanonik (dan satu-satunya) untuk "kepemilikan" / "porsi" investor
 *  pada sebuah project — mengikuti praktik fintech / securities crowdfunding:
 *
 *      kepemilikan_i = modal_disetor_i / D,  D = max(target_pendanaan, Σ modal_disetor)
 *
 *  MODAL = uang yang SUDAH DISETOR (nominal_terbayar), bukan komitmen. Investor
 *  yang belum bayar = 0 porsi.
 *
 *  DENOMINATOR D = max(target, Σ setor):
 *  - Belum penuh (Σ<target): D=target → lone 50jt dari target 1M = 5%, sisa
 *    "belum terisi" = D−Σ. Porsi stabil, tak melompat ke 100%.
 *  - Penuh (Σ=target): D=target=Σ → Σ porsi = 100%.
 *  - Talangan/overrun (Σ>target): D=Σ → porsi dihitung ulang atas total modal
 *    riil; penanggung naik, lainnya terdilusi, Σ tetap 100% (tak tembus 100%).
 *
 *  Kenapa bukan denominator TARGET murni atau Σ murni — keduanya pecah di salah
 *  satu fase; max(target, Σ) menyatukan ketiganya. Gunakan `ownershipDenominator`.
 *
 *  1. STABIL & JUJUR. Porsi investor terkunci sejak ia masuk dan TIDAK goyang
 *     saat investor lain menyusul. Investor 50jt pada target 1M = 5% selamanya,
 *     bukan "100% sekarang lalu tiba-tiba 5%". Sisa yang belum terisi
 *     ditampilkan apa adanya sebagai "belum terisi" — tidak dipaksa jadi milik
 *     seseorang.
 *
 *  2. KOHEREN dengan model "jalan kalau penuh": project baru dieksekusi saat
 *     Σ modal = target, sehingga profit HANYA dibagi ketika seluruh slot terisi
 *     (Σ = target). Pada titik itu Σ (modal_i / target) = tepat 100%. Selama
 *     kampanye tidak ada profit yang dibagi, jadi porsi "belum terisi" aman.
 *
 *  3. Karena saat eksekusi Σ modal = target, `modal/target ≡ modal/Σmodal` —
 *     jadi denominator ini otomatis benar untuk distribusi profit juga.
 *
 *  ATURAN PAKAI:
 *  - Perhitungan UANG (profit, nilai akhir) → `ownershipRatio(modal, target)`
 *    presisi penuh. JANGAN pakai persentase yang sudah dibulatkan.
 *  - TAMPILAN persen → `buildOwnershipDisplayMap(items, target)` (largest
 *    remainder). Saat penuh jumlah tampilan = 100,0%; saat belum penuh =
 *    persentase pendanaan (mis. 5%), sisanya "belum terisi".
 *
 *  CATATAN: validasi hulu harus mencegah Σ modal > target (tidak boleh
 *  over-subscribe) agar porsi tak pernah melewati 100%.
 */

/** Angka uang yang aman: non-negatif & finite, selain itu 0. */
export function toCommitted(value: unknown): number {
  const n =
    typeof value === "number"
      ? value
      : Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

/** Total modal seluruh investor (dana terkumpul / disetor). */
export function sumCommitted(
  items: ReadonlyArray<{ committed: unknown }>
): number {
  return items.reduce((sum, item) => sum + toCommitted(item.committed), 0);
}

/**
 * Denominator kepemilikan kanonik = max(target_pendanaan, Σ modal disetor).
 * Lihat header file untuk alasannya. Selalu ≥ 0.
 */
export function ownershipDenominator(
  targetPendanaan: unknown,
  totalPaid: unknown
): number {
  return Math.max(toCommitted(targetPendanaan), toCommitted(totalPaid));
}

/**
 * Rasio kepemilikan presisi penuh (0..1) untuk perhitungan UANG.
 * `base` = target pendanaan. Mengembalikan `null` bila tak terdefinisi.
 */
export function ownershipRatio(
  committed: unknown,
  base: number
): number | null {
  const c = toCommitted(committed);
  if (!Number.isFinite(base) || base <= 0) return null;
  return c / base;
}

/**
 * Persentase kepemilikan presisi penuh (0..100) untuk perhitungan UANG.
 * `base` = target pendanaan. `null` bila tak terdefinisi.
 */
export function ownershipPercent(
  committed: unknown,
  base: number
): number | null {
  const ratio = ownershipRatio(committed, base);
  return ratio === null ? null : ratio * 100;
}

/**
 * Progres pendanaan (fill-rate) = terkumpul / target. Rasio 0..1.
 * Berbeda makna dari kepemilikan per-investor; untuk bar "X% terkumpul".
 */
export function fundingProgressRatio(
  raised: unknown,
  target: unknown
): number | null {
  const r = toCommitted(raised);
  const t = toCommitted(target);
  if (t <= 0) return null;
  return r / t;
}

export type OwnershipDisplay = {
  /** Rasio presisi penuh 0..1 (untuk uang), `null` bila tak terdefinisi. */
  ratio: number | null;
  /** Persentase presisi penuh 0..100, `null` bila tak terdefinisi. */
  percent: number | null;
  /** Teks siap-tampil, mis. "5,0%" / "100,0%" / "—". */
  percentText: string;
};

export type BuildOwnershipOptions = {
  /** Jumlah digit desimal untuk tampilan. Default 1. */
  decimals?: number;
  /** Karakter desimal. Default "," (locale ID). */
  decimalSeparator?: string;
  /** Teks untuk nilai tak terdefinisi. Default "—". */
  emptyText?: string;
};

/**
 * Membangun peta kepemilikan siap-tampil untuk daftar investor, relatif
 * terhadap `base` = D = ownershipDenominator(target, Σ modal disetor).
 * `committed` di sini = modal DISETOR (nominal_terbayar) tiap investor.
 *
 * - `ratio`/`percent` = presisi penuh (untuk uang) = committed / base.
 * - `percentText` = dibulatkan via LARGEST REMAINDER METHOD sehingga jumlah
 *   seluruh teks = tepat sama dengan persentase PENDANAAN yang dibulatkan
 *   (Σ committed / base). Jadi:
 *     • saat penuh (Σ = base)   → jumlah tampilan = 100,0%
 *     • saat belum penuh        → jumlah tampilan = mis. 5,0% (sisanya belum terisi)
 *   Tidak pernah muncul 99,9%/100,1% akibat pembulatan.
 *
 * Bila `base` tak valid (≤0), fallback ke Σ committed sebagai base agar tetap
 * menampilkan proporsi relatif antar-investor (jumlah = 100%).
 */
export function buildOwnershipDisplayMap<
  T extends { id: string | number; committed: unknown }
>(
  items: ReadonlyArray<T>,
  base: number,
  options: BuildOwnershipOptions = {}
): Map<string, OwnershipDisplay> {
  const decimals = options.decimals ?? 1;
  const decimalSeparator = options.decimalSeparator ?? ",";
  const emptyText = options.emptyText ?? "—";

  const result = new Map<string, OwnershipDisplay>();

  const normalized = items.map((item, index) => ({
    key: String(item.id),
    committed: toCommitted(item.committed),
    index,
  }));

  const totalCommitted = normalized.reduce((s, i) => s + i.committed, 0);

  // Denominator kepemilikan = target. Bila target tak valid, jatuh ke Σ modal
  // agar proporsi antar-investor tetap tampil.
  const denom =
    Number.isFinite(base) && base > 0 ? base : totalCommitted;

  if (denom <= 0) {
    normalized.forEach(({ key }) => {
      result.set(key, { ratio: null, percent: null, percentText: emptyText });
    });
    return result;
  }

  const SCALE = Math.pow(10, decimals); // decimals=1 -> unit 0,1%
  // Total unit yang dibagikan = persentase PENDANAAN yang dibulatkan.
  // Penuh → 100,0% (1000 unit). Belum penuh → mis. 5,0% (50 unit).
  const TARGET_UNITS = Math.round((totalCommitted / denom) * 100 * SCALE);

  const calculated = normalized.map(({ key, committed, index }) => {
    const ratio = committed / denom;
    const scaled = ratio * 100 * SCALE;
    const floorUnits = Math.floor(scaled + 1e-9);
    return {
      key,
      ratio,
      committed,
      index,
      units: floorUnits,
      remainder: scaled - floorUnits,
    };
  });

  const usedUnits = calculated.reduce((s, i) => s + i.units, 0);
  const remainingUnits = TARGET_UNITS - usedUnits;

  if (remainingUnits > 0) {
    const ranked = [...calculated].sort((a, b) => {
      if (b.remainder !== a.remainder) return b.remainder - a.remainder;
      if (b.committed !== a.committed) return b.committed - a.committed;
      return a.index - b.index;
    });
    for (let i = 0; i < remainingUnits; i += 1) {
      ranked[i % ranked.length].units += 1;
    }
  }

  calculated.forEach((item) => {
    const percentValue = item.units / SCALE;
    const text = percentValue.toFixed(decimals).replace(".", decimalSeparator);
    result.set(item.key, {
      ratio: item.ratio,
      percent: item.ratio * 100,
      percentText: `${text}%`,
    });
  });

  return result;
}
