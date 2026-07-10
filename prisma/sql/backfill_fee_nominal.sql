-- Backfill nominal fee (pph/ajb/agent_fee) utk baris project_selesai lama.
-- Jalankan SETELAH `prisma db push` menambah kolom nominal. Idempotent.
UPDATE public.project_selesai
SET
  pph_nominal = ROUND(harga_jual * pph_percent / 100, 2),
  ajb_nominal = ROUND(harga_jual * ajb_percent / 100, 2),
  agent_fee_nominal = ROUND(harga_jual * agent_fee_percent / 100, 2)
WHERE pph_nominal = 0 AND ajb_nominal = 0 AND agent_fee_nominal = 0
  AND (pph_percent > 0 OR ajb_percent > 0 OR agent_fee_percent > 0);
