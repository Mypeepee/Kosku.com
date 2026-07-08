-- Backfill: kolom `harga` untuk listing LELANG hasil scrape dulunya diisi 0,
-- sedangkan harga aslinya ada di `nilai_limit_lelang`. Akibatnya sort
-- Termurah/Termahal & filter harga salah (semua lelang dianggap harga 0).
-- Samakan `harga` = `nilai_limit_lelang` supaya kolom harga menyimpan harga
-- efektif. Idempotent: hanya baris lelang yang masih harga=0 & punya limit > 0.
UPDATE listing
SET harga = nilai_limit_lelang
WHERE jenis_transaksi = 'LELANG'
  AND (harga IS NULL OR harga = 0)
  AND nilai_limit_lelang IS NOT NULL
  AND nilai_limit_lelang > 0;
