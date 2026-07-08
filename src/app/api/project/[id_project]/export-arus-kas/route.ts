import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
// @ts-expect-error – no types for xlsx-populate
import XlsxPopulate from "xlsx-populate";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

function n(v: Prisma.Decimal | number | null | undefined): number {
  const num = v instanceof Prisma.Decimal ? v.toNumber() : Number(v ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function fmtDate(v: Date | string | null | undefined): string {
  if (!v) return "-";
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return "-";
  // Kolom @db.Date disimpan sebagai tanggal murni — tampilkan dalam WIB agar
  // tanggal di file ekspor sama dengan yang tampil di aplikasi.
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
}

function fmtIDR(v: number) {
  return `Rp${v.toLocaleString("id-ID")}`;
}

function usageStatus(persen: number): string {
  if (persen <= 0)   return "Belum Terpakai";
  if (persen >= 1)   return "Melebihi Anggaran";
  if (persen >= 0.99) return "Terserap Penuh";
  return "Sebagian Terpakai";
}

type WalletKey = "utama" | "dokumen" | "eksekusi" | "renovasi" | "cadangan";
const WALLET_KEYS = ["utama","dokumen","eksekusi","renovasi","cadangan"];
function normalizeKey(v: unknown): WalletKey {
  return WALLET_KEYS.includes(v as string) ? (v as WalletKey) : "utama";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id_project: string } }
) {
  const { id_project } = params;

  const [project, txRows] = await Promise.all([
    prisma.project.findUnique({
      where: { id_project },
      select: {
        id_project: true, nama_project: true,
        alamat_property: true, provinsi: true, kota: true, kecamatan: true, kelurahan: true,
        status: true, jenis_pendanaan: true,
        tanggal_pembelian: true, mulai_tanggal: true, estimasi_selesai: true, estimasi_bulan: true,
        target_pendanaan: true, total_pendanaan: true,
        harga_pembelian: true, total_biaya_akuisisi: true,
        nilai_limit_lelang: true, spare_bidding: true,
        biaya_eksekusi: true, biaya_balik_nama: true, biaya_renov: true, dana_cadangan: true,
        estimasi_harga_jual: true, estimasi_profit_bersih: true,
        pembuat: { select: { pengguna: { select: { nama_lengkap: true } } } },
      },
    }),
    prisma.projectArusKas.findMany({
      where: { id_project, status_transaksi: { not: "dibatalkan" } },
      orderBy: { tanggal_transaksi: "asc" },
      select: {
        wallet_key: true, tanggal_transaksi: true,
        jenis_transaksi: true, kategori_transaksi: true,
        judul_transaksi: true, nominal: true, status_transaksi: true, catatan: true,
      },
    }),
  ]);

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ── Data project ────────────────────────────────────────────
  const lokasi = [project.kota, project.kecamatan, project.kelurahan, project.provinsi]
    .filter(Boolean).join(", ") || "-";

  const p = {
    id_project:            project.id_project,
    nama_project:          project.nama_project,
    alamat_property:       project.alamat_property ?? "-",
    lokasi,
    status:                project.status ?? "-",
    jenis_pendanaan:       String(project.jenis_pendanaan ?? "-").replace(/_/g, " "),
    tanggal_pembelian:     project.tanggal_pembelian,
    mulai_tanggal:         project.mulai_tanggal,
    estimasi_selesai:      project.estimasi_selesai,
    estimasi_bulan:        project.estimasi_bulan ?? 0,
    penanggung_jawab:      project.pembuat?.pengguna?.nama_lengkap ?? "-",
    target_pendanaan:      n(project.target_pendanaan),
    total_pendanaan:       n(project.total_pendanaan),
    harga_pembelian:       n(project.harga_pembelian),
    total_biaya_akuisisi:  n(project.total_biaya_akuisisi),
    nilai_limit_lelang:    n(project.nilai_limit_lelang),
    spare_bidding:         n(project.spare_bidding),
    biaya_eksekusi:        n(project.biaya_eksekusi),
    biaya_balik_nama:      n(project.biaya_balik_nama),
    biaya_renov:           n(project.biaya_renov),
    dana_cadangan:         n(project.dana_cadangan),
    estimasi_harga_jual:   n(project.estimasi_harga_jual),
    estimasi_profit_bersih: n(project.estimasi_profit_bersih),
  };

  // ── Transaksi ────────────────────────────────────────────────
  const tx = txRows.map((r) => ({
    wallet_key:         normalizeKey(r.wallet_key),
    tanggal_transaksi:  r.tanggal_transaksi,
    jenis_transaksi:    r.jenis_transaksi as "pemasukan" | "pengeluaran",
    kategori_transaksi: r.kategori_transaksi ?? "-",
    judul_transaksi:    r.judul_transaksi ?? "-",
    nominal:            n(r.nominal),
    status_transaksi:   r.status_transaksi ?? "tercatat",
    catatan:            r.catatan ?? "",
  }));

  // ── Budget & realisasi per dompet ───────────────────────────
  const budget = {
    utama:    p.nilai_limit_lelang + p.spare_bidding,
    dokumen:  p.biaya_balik_nama,
    eksekusi: p.biaya_eksekusi,
    renovasi: p.biaya_renov,
    cadangan: p.dana_cadangan,
  };

  const real: Record<WalletKey, number> = { utama:0, dokumen:0, eksekusi:0, renovasi:0, cadangan:0 };
  tx.filter(t => t.jenis_transaksi === "pengeluaran")
    .forEach(t => { real[t.wallet_key] += t.nominal; });

  const totalBudget  = Object.values(budget).reduce((s, v) => s + v, 0);
  const totalReal    = Object.values(real).reduce((s, v) => s + v, 0);
  const totalIncome  = tx.filter(t => t.jenis_transaksi === "pemasukan").reduce((s,t) => s+t.nominal, 0);
  const totalExpense = tx.filter(t => t.jenis_transaksi === "pengeluaran").reduce((s,t) => s+t.nominal, 0);
  const totalBalance = totalIncome - totalExpense;

  // ── Buka template ────────────────────────────────────────────
  const templatePath = path.join(
    process.cwd(),
    "src/app/dashboard/project/detail_transaksi/[id_project]/arus_kas/components/Solusindo_Premier_Laporan_LelangTerbaru.xlsx"
  );
  const wb = await XlsxPopulate.fromDataAsync(fs.readFileSync(templatePath));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const S = (name: string) => wb.sheet(name) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = (ws: any, cell: string, val: string | number) => ws.cell(cell).value(val);

  // ════════════════════════════════════════════════════════════
  // COVER  (B2:G33)
  // Row 9:  D9  = id_project
  // Row 13: D13 = nama_project
  // Row 14: D14 = alamat_property
  // Row 15: D15 = lokasi
  // Row 16: D16 = tanggal_pembelian
  // Row 17: D17 = mulai_tanggal
  // Row 18: D18 = estimasi_selesai
  // Row 19: D19 = estimasi_bulan
  // Row 20: D20 = status
  // Row 21: D21 = jenis_pendanaan
  // Row 22: D22 = penanggung_jawab
  // Row 27 = label KPI, Row 28 = nilai KPI
  // B28 = total_biaya_akuisisi | D28 = estimasi_harga_jual | F28 = estimasi_profit_bersih
  // ════════════════════════════════════════════════════════════
  const cover = S("Cover");
  v(cover, "D9",  p.id_project);
  v(cover, "D13", p.nama_project);
  v(cover, "D14", p.alamat_property);
  v(cover, "D15", p.lokasi);
  v(cover, "D16", fmtDate(p.tanggal_pembelian));
  v(cover, "D17", fmtDate(p.mulai_tanggal));
  v(cover, "D18", fmtDate(p.estimasi_selesai));
  v(cover, "D19", p.estimasi_bulan > 0 ? `${p.estimasi_bulan} bulan` : "-");
  v(cover, "D20", p.status);
  v(cover, "D21", p.jenis_pendanaan);
  v(cover, "D22", p.penanggung_jawab);
  v(cover, "B28", p.total_biaya_akuisisi);
  v(cover, "D28", p.estimasi_harga_jual);
  v(cover, "F28", p.estimasi_profit_bersih);

  // ════════════════════════════════════════════════════════════
  // PROFIL PROYEK  (B2:G38)
  // Row 9:  D9  = harga_pembelian (field: harga_pembelian)
  // Row 10: D10 = estimasi_harga_jual
  // Row 11: D11 = estimasi_profit_bersih
  // Row 15: D15 = nilai_limit_lelang
  // Row 16: D16 = spare_bidding
  // Row 17: D17 = biaya_eksekusi
  // Row 18: D18 = biaya_balik_nama
  // Row 19: D19 = biaya_renov
  // Row 20: D20 = dana_cadangan
  // Row 21: D21 = total_biaya_akuisisi  (label row, ini formula di template tapi kita isi)
  // Row 25: D25 = target_pendanaan
  // Row 26: D26 = total_pendanaan
  // ROI table: C32=harga_pembelian, C33=total_biaya_akuisisi, C34=estimasi_harga_jual, C35=estimasi_profit_bersih
  // ════════════════════════════════════════════════════════════
  const profil = S("Profil Proyek");
  v(profil, "D9",  p.harga_pembelian);
  v(profil, "D10", p.estimasi_harga_jual);
  v(profil, "D11", p.estimasi_profit_bersih);
  v(profil, "D15", p.nilai_limit_lelang);
  v(profil, "D16", p.spare_bidding);
  v(profil, "D17", p.biaya_eksekusi);
  v(profil, "D18", p.biaya_balik_nama);
  v(profil, "D19", p.biaya_renov);
  v(profil, "D20", p.dana_cadangan);
  v(profil, "D21", p.total_biaya_akuisisi);
  v(profil, "D25", p.target_pendanaan);
  v(profil, "D26", p.total_pendanaan);
  v(profil, "D27", p.target_pendanaan - p.total_pendanaan);
  v(profil, "C32", p.harga_pembelian);
  v(profil, "C33", p.total_biaya_akuisisi);
  v(profil, "C34", p.estimasi_harga_jual);
  v(profil, "C35", p.estimasi_profit_bersih);

  // ════════════════════════════════════════════════════════════
  // CASHFLOW TIMELINE  (B2:L110)
  // Row 6  = header (No., Tanggal, ID Project, Jenis, Kategori, Nominal, Wallet, Judul, Status, Catatan, Saldo)
  // Row 7–106 = data (100 baris)
  // Row 108 = TOTAL  →  G108=totalExpense, L108=saldo akhir
  // Kolom: B=No, C=Tanggal, D=ID, E=Jenis, F=Kategori, G=Nominal, H=Wallet, I=Judul, J=Status, K=Catatan, L=Saldo
  // ════════════════════════════════════════════════════════════
  const timeline = S("Cashflow Timeline");
  let runBalance = 0;
  tx.slice(0, 100).forEach((t, i) => {
    const row = 7 + i;
    runBalance += t.jenis_transaksi === "pemasukan" ? t.nominal : -t.nominal;
    v(timeline, `B${row}`, i + 1);
    v(timeline, `C${row}`, fmtDate(t.tanggal_transaksi));
    v(timeline, `D${row}`, p.id_project);
    v(timeline, `E${row}`, t.jenis_transaksi);
    v(timeline, `F${row}`, t.kategori_transaksi);
    v(timeline, `G${row}`, t.nominal);
    v(timeline, `H${row}`, t.wallet_key);
    v(timeline, `I${row}`, t.judul_transaksi);
    v(timeline, `J${row}`, t.status_transaksi);
    v(timeline, `K${row}`, t.catatan);
    v(timeline, `L${row}`, runBalance);
  });
  v(timeline, "G108", totalExpense);
  v(timeline, "L108", runBalance);

  // ════════════════════════════════════════════════════════════
  // DOMPET SHEETS  (B2:I64)
  // Row 5:  E5 = Anggaran (satu-satunya blue cell di KPI)
  // Row 11: header kolom
  // Row 12–61: data transaksi (50 baris)
  // Row 62: G62 = SUBTOTAL PENGELUARAN
  // Kolom data: B=No, C=Tanggal, D=Jenis, E=Kategori, F=Judul, G=Nominal, H=Status, I=Catatan
  // ════════════════════════════════════════════════════════════
  const dompetCfg: Array<{ sheet: string; key: WalletKey }> = [
    { sheet: "Dompet Utama",    key: "utama"    },
    { sheet: "Dompet Dokumen",  key: "dokumen"  },
    { sheet: "Dompet Eksekusi", key: "eksekusi" },
    { sheet: "Dompet Renovasi", key: "renovasi" },
    { sheet: "Dompet Cadangan", key: "cadangan" },
  ];

  for (const cfg of dompetCfg) {
    const ws = S(cfg.sheet);
    v(ws, "E5", budget[cfg.key]);

    const txList = tx.filter(t => t.wallet_key === cfg.key);
    txList.slice(0, 50).forEach((t, i) => {
      const row = 12 + i;
      v(ws, `B${row}`, i + 1);
      v(ws, `C${row}`, fmtDate(t.tanggal_transaksi));
      v(ws, `D${row}`, t.jenis_transaksi);
      v(ws, `E${row}`, t.kategori_transaksi);
      v(ws, `F${row}`, t.judul_transaksi);
      v(ws, `G${row}`, t.nominal);
      v(ws, `H${row}`, t.status_transaksi);
      v(ws, `I${row}`, t.catatan);
    });

    const subtotal = txList
      .filter(t => t.jenis_transaksi === "pengeluaran")
      .reduce((s, t) => s + t.nominal, 0);
    v(ws, "G62", subtotal);
  }

  // ════════════════════════════════════════════════════════════
  // RINGKASAN EKSEKUTIF  (B2:H37)
  // Row 5  = header KPI anggaran
  // Row 6  = nilai: B6=totalBudget, D6=totalReal, E6=penyerapan%, G6=sisa
  // Row 11 = header KPI cashflow
  // Row 12 = nilai: B12=totalIncome, D12=totalExpense, F12=netCashflow
  // Row 16 = header tabel dompet
  // Row 17 = Utama   → D17,E17,F17,G17,H17
  // Row 18 = Dokumen
  // Row 19 = Eksekusi
  // Row 20 = Renovasi
  // Row 21 = Cadangan
  // Row 22 = TOTAL   → D22,E22,F22,G22,H22
  // Row 26–29 = catatan manajemen
  // ════════════════════════════════════════════════════════════
  const rk = S("Ringkasan Eksekutif");
  const penyerapanTotal = totalBudget > 0 ? totalReal / totalBudget : 0;
  const sisaTotal = totalBudget - totalReal;

  v(rk, "B6", totalBudget);
  v(rk, "D6", totalReal);
  v(rk, "E6", penyerapanTotal);
  v(rk, "G6", sisaTotal);

  v(rk, "B12", totalIncome);
  v(rk, "D12", totalExpense);
  v(rk, "F12", totalBalance);

  const rkDompet = [
    { row: 17, key: "utama"    as WalletKey },
    { row: 18, key: "dokumen"  as WalletKey },
    { row: 19, key: "eksekusi" as WalletKey },
    { row: 20, key: "renovasi" as WalletKey },
    { row: 21, key: "cadangan" as WalletKey },
  ];
  for (const d of rkDompet) {
    const b = budget[d.key], r = real[d.key];
    const sisa = b - r, pct = b > 0 ? r / b : 0;
    v(rk, `D${d.row}`, b);
    v(rk, `E${d.row}`, r);
    v(rk, `F${d.row}`, sisa);
    v(rk, `G${d.row}`, pct);
    v(rk, `H${d.row}`, usageStatus(pct));
  }
  v(rk, "D22", totalBudget);
  v(rk, "E22", totalReal);
  v(rk, "F22", sisaTotal);
  v(rk, "G22", penyerapanTotal);
  v(rk, "H22", usageStatus(penyerapanTotal));

  const roi = p.total_biaya_akuisisi > 0
    ? ((p.estimasi_profit_bersih / p.total_biaya_akuisisi) * 100).toFixed(1) : "0.0";
  v(rk, "B26", `• Total anggaran proyek sebesar ${fmtIDR(totalBudget)} dengan realisasi ${fmtIDR(totalReal)} (${(penyerapanTotal*100).toFixed(1)}% terserap).`);
  v(rk, "B27", `• Sisa anggaran tersedia: ${fmtIDR(sisaTotal)}.`);
  v(rk, "B28", `• Status keseluruhan: ${usageStatus(penyerapanTotal)}.`);
  v(rk, "B29", `• Estimasi profit bersih: ${fmtIDR(p.estimasi_profit_bersih)} (ROI: ${roi}%).`);

  // ════════════════════════════════════════════════════════════
  // ANGGARAN vs REALISASI  (B2:I14)
  // Row 5  = header kolom
  // Row 6  = Utama    → D6,E6,F6,G6,H6
  // Row 7  = Dokumen
  // Row 8  = Eksekusi
  // Row 9  = Renovasi
  // Row 10 = Cadangan
  // Row 11 = TOTAL    → D11,E11,F11,G11,H11
  // ════════════════════════════════════════════════════════════
  const avr = S("Anggaran vs Realisasi");
  const avrDompet = [
    { row: 6,  key: "utama"    as WalletKey },
    { row: 7,  key: "dokumen"  as WalletKey },
    { row: 8,  key: "eksekusi" as WalletKey },
    { row: 9,  key: "renovasi" as WalletKey },
    { row: 10, key: "cadangan" as WalletKey },
  ];
  for (const d of avrDompet) {
    const b = budget[d.key], r = real[d.key];
    const varians = b - r, pct = b > 0 ? r / b : 0;
    v(avr, `D${d.row}`, b);
    v(avr, `E${d.row}`, r);
    v(avr, `F${d.row}`, varians);
    v(avr, `G${d.row}`, pct);
    v(avr, `H${d.row}`, usageStatus(pct));
  }
  v(avr, "D11", totalBudget);
  v(avr, "E11", totalReal);
  v(avr, "F11", sisaTotal);
  v(avr, "G11", penyerapanTotal);
  v(avr, "H11", usageStatus(penyerapanTotal));

  // ════════════════════════════════════════════════════════════
  // BREAKDOWN KATEGORI  (B2:G18)
  // Row 6  = header
  // Row 7  = Pendanaan Investor → C7, D7
  // Row 8  = Modal Internal
  // Row 9  = Pengembalian Modal
  // Row 10 = Pembayaran Lelang
  // Row 11 = Biaya Eksekusi
  // Row 12 = Balik Nama
  // Row 13 = Renovasi
  // Row 14 = Operasional
  // Row 15 = Pengeluaran Lainnya
  // Row 16 = Penjualan Properti
  // Row 17 = Pemasukan Lainnya
  // Row 18 = TOTAL → C18
  // ════════════════════════════════════════════════════════════
  const bk = S("Breakdown Kategori");
  const byKat: Record<string, number> = {};
  tx.filter(t => t.jenis_transaksi === "pengeluaran")
    .forEach(t => { byKat[t.kategori_transaksi] = (byKat[t.kategori_transaksi] ?? 0) + t.nominal; });
  const totalPengeluaran = Object.values(byKat).reduce((s, x) => s + x, 0);

  const bkMap: [string, number][] = [
    ["Pendanaan Investor", 7], ["Modal Internal", 8], ["Pengembalian Modal", 9],
    ["Pembayaran Lelang", 10], ["Biaya Eksekusi", 11], ["Balik Nama", 12],
    ["Renovasi", 13], ["Operasional", 14], ["Pengeluaran Lainnya", 15],
    ["Penjualan Properti", 16], ["Pemasukan Lainnya", 17],
  ];
  for (const [kat, row] of bkMap) {
    const val = byKat[kat] ?? 0;
    v(bk, `C${row}`, val);
    v(bk, `D${row}`, totalPengeluaran > 0 ? val / totalPengeluaran : 0);
  }
  v(bk, "C18", totalPengeluaran);

  // ── Output ──────────────────────────────────────────────────
  const buf: Buffer = await wb.outputAsync();
  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="LaporanKeuangan_${p.id_project}_${today}.xlsx"`,
    },
  });
}
