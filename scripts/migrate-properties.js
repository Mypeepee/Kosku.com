// scripts/migrate-properties.js
import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

const connectionString =
  process.env.DATABASE_URL || 'postgres://postgres:password@127.0.0.1:5432/kosku';

// Mapping tipe -> kategori_properti_enum
function mapKategori(tipe) {
  if (!tipe) return 'RUMAH';
  const t = tipe.toLowerCase();
  if (t.includes('apart')) return 'APARTEMEN';
  if (t.includes('ruko')) return 'RUKO';
  if (t.includes('tanah') || t.includes('land')) return 'TANAH';
  if (t.includes('gudang') || t.includes('warehouse')) return 'GUDANG';
  if (t.includes('hotel') || t.includes('villa')) return 'HOTEL_DAN_VILLA';
  if (t.includes('toko') || t.includes('shop')) return 'TOKO';
  if (t.includes('pabrik') || t.includes('factory')) return 'PABRIK';
  if (t.includes('rumah') || t.includes('house')) return 'RUMAH';
  return 'RUMAH';
}

// generate slug: lelang-{kategori}-{kota}
// contoh: lelang-gudang-kota-surabaya
function generateSlug(kategori, kota) {
  const kat = (kategori || 'lainnya').toLowerCase();
  let city = (kota || 'tanpa kota').toLowerCase().trim();
  city = city.replace(/[^a-z0-9\s-]/g, '');
  city = city.replace(/\s+/g, '-');
  city = city.replace(/-+/g, '-');
  return `lelang-${kat}-kota-${city}`;
}

// balik kenaikan harga 27,8% → harga_limit asli
function revertHarga(hargaNaik) {
  if (hargaNaik == null) return 0;
  const h = Number(hargaNaik);
  if (Number.isNaN(h)) return 0;
  return Math.round((h / 1.278) * 100) / 100; // 2 decimal
}

// balik kenaikan uang jaminan 20% → jaminan asli
function revertJaminan(jaminanNaik) {
  if (jaminanNaik == null) return null;
  const j = Number(jaminanNaik);
  if (Number.isNaN(j)) return null;
  return Math.round((j / 1.2) * 100) / 100;
}

async function migrateProperties() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log('Connected to PostgreSQL (properties)');

  try {
    const { rows } = await client.query(`
      SELECT *
      FROM public.property_tampungan
      WHERE id_agent IS NOT NULL
      ORDER BY id_listing
    `);

    console.log('Total property_tampungan ditemukan:', rows.length);

    let success = 0;
    let skippedNoAgent = 0;
    let fail = 0;

    for (const prop of rows) {
      const {
        id_listing,
        id_agent,
        vendor,
        judul,
        deskripsi,
        tipe,
        harga,
        lokasi,
        luas,
        provinsi,
        kota,
        kecamatan,
        kelurahan,
        sertifikat,
        status,
        gambar,
        payment,
        uang_jaminan,
        batas_akhir_jaminan,
        batas_akhir_penawaran,
        tanggal_buyer_meeting,
        tanggal_dibuat,
        tanggal_diupdate,
        link,
      } = prop;

      try {
        // Cari id_agent_baru dari mapping
        const mapRes = await client.query(
          `SELECT id_agent_baru FROM public.mapping_agent WHERE id_agent_lama = $1`,
          [id_agent],
        );

        if (mapRes.rowCount === 0) {
          skippedNoAgent++;
          console.warn(`SKIP (agent tidak ditemukan): property ${id_listing}, agent ${id_agent}`);
          continue;
        }

        const idAgentBaru = mapRes.rows[0].id_agent_baru;

        const kategori = mapKategori(tipe);
        const jenisTransaksi = 'LELANG'; // semua LELANG
        const hargaLimitAsli = revertHarga(harga);
        const jaminanAsli = revertJaminan(uang_jaminan);
        const judulFinal =
          (judul && judul.trim().length > 0) ? judul : `Listing ${id_listing}`;
        const kotaFinal =
          (kota && kota.trim().length > 0) ? kota : 'KOTA TIDAK DIKETAHUI';
        const slug = generateSlug(kategori, kotaFinal);

        await client.query(
          `
          INSERT INTO public.listing (
            id_agent,
            judul,
            slug,
            deskripsi,
            jenis_transaksi,
            kategori,
            vendor,
            status_tayang,
            harga,
            harga_promo,
            tanggal_lelang,
            uang_jaminan,
            nilai_limit_lelang,
            link,
            alamat_lengkap,
            provinsi,
            kota,
            kecamatan,
            kelurahan,
            luas_tanah,
            legalitas,
            nomor_legalitas,
            gambar,
            tanggal_dibuat,
            tanggal_diupdate
          )
          VALUES (
            $1, $2, $3, $4,
            $5::jenis_transaksi_enum,
            $6::kategori_properti_enum,
            $7,
            CASE WHEN UPPER(TRIM(COALESCE($8, ''))) = 'TERJUAL' THEN 'TERJUAL'::status_properti_enum ELSE 'TERSEDIA'::status_properti_enum END,
            $9,
            NULL,
            $10,
            $11,
            $12,
            $13,
            $14,
            $15,
            $16,
            $17,
            $18,
            $19,
            NULL,
            NULL,
            $20,
            $21,
            $22
          )
        `,
          [
            idAgentBaru,                    // 1
            judulFinal,                     // 2
            slug,                           // 3
            deskripsi || null,              // 4
            jenisTransaksi,                 // 5
            kategori,                       // 6
            vendor || null,                 // 7
            status || null,                 // 8 (untuk mapping TERJUAL/TERSEDIA)
            hargaLimitAsli,                 // 9 -> harga
            batas_akhir_penawaran || null,  // 10 -> tanggal_lelang
            jaminanAsli,                    // 11 -> uang_jaminan
            hargaLimitAsli,                 // 12 -> nilai_limit_lelang
            link || null,                   // 13
            lokasi || null,                 // 14
            provinsi || null,               // 15
            kotaFinal,                      // 16
            kecamatan || null,              // 17
            kelurahan || null,              // 18
            luas ? Number(luas) : null,     // 19 -> luas_tanah
            gambar || null,                 // 20
            tanggal_dibuat,                 // 21
            tanggal_diupdate,               // 22
          ],
        );

        success++;
        console.log(`OK property: ${id_listing} -> agent ${idAgentBaru}`);
      } catch (err) {
        fail++;
        console.error(`FAIL property: ${id_listing}:`, err.message);
      }
    }

    console.log('Migrasi property selesai');
    console.log('Sukses:', success, 'Skip tanpa agent:', skippedNoAgent, 'Gagal:', fail);
  } finally {
    await client.end();
    console.log('PostgreSQL connection closed (properties)');
  }
}

migrateProperties().catch((err) => {
  console.error('Fatal error (properties):', err);
  process.exit(1);
});
