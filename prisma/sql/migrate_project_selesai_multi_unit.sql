-- Migrasi project_selesai: PK id_project → id_project_selesai (autoincrement)
-- agar satu project bisa punya BANYAK baris penjualan (jual per unit).
-- Idempotent — aman dijalankan ulang. Jalankan SEBELUM `prisma db push`;
-- db push kemudian menambah tabel project_unit, kolom id_project_unit, dan index.

BEGIN;

-- 1) Kolom id baru + sequence di project_selesai
ALTER TABLE public.project_selesai
  ADD COLUMN IF NOT EXISTS id_project_selesai BIGINT;

CREATE SEQUENCE IF NOT EXISTS public.project_selesai_id_project_selesai_seq
  OWNED BY public.project_selesai.id_project_selesai;

ALTER TABLE public.project_selesai
  ALTER COLUMN id_project_selesai
  SET DEFAULT nextval('public.project_selesai_id_project_selesai_seq');

UPDATE public.project_selesai
SET id_project_selesai = nextval('public.project_selesai_id_project_selesai_seq')
WHERE id_project_selesai IS NULL;

ALTER TABLE public.project_selesai
  ALTER COLUMN id_project_selesai SET NOT NULL;

-- 2) Tautkan project_selesai_investor ke baris penjualan induknya
ALTER TABLE public.project_selesai_investor
  ADD COLUMN IF NOT EXISTS id_project_selesai BIGINT;

UPDATE public.project_selesai_investor psi
SET id_project_selesai = ps.id_project_selesai
FROM public.project_selesai ps
WHERE psi.id_project = ps.id_project
  AND psi.id_project_selesai IS NULL;

-- 3) Tukar constraint: lepas FK+PK lama, pasang PK+FK baru
ALTER TABLE public.project_selesai_investor
  DROP CONSTRAINT IF EXISTS project_selesai_investor_project_fk;

ALTER TABLE public.project_selesai_investor
  DROP CONSTRAINT IF EXISTS project_selesai_investor_pkey;

ALTER TABLE public.project_selesai
  DROP CONSTRAINT IF EXISTS project_selesai_pkey;

ALTER TABLE public.project_selesai
  ADD CONSTRAINT project_selesai_pkey PRIMARY KEY (id_project_selesai);

ALTER TABLE public.project_selesai_investor
  ALTER COLUMN id_project_selesai SET NOT NULL;

ALTER TABLE public.project_selesai_investor
  ADD CONSTRAINT project_selesai_investor_pkey
  PRIMARY KEY (id_project_selesai, id_agent);

ALTER TABLE public.project_selesai_investor
  ADD CONSTRAINT project_selesai_investor_selesai_fk
  FOREIGN KEY (id_project_selesai)
  REFERENCES public.project_selesai (id_project_selesai)
  ON DELETE CASCADE;

COMMIT;
