// scripts/migrate-users.js
import pg from 'pg';
import bcrypt from 'bcrypt';

const { Client } = pg;

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:01082003Jason@127.0.0.1:5432/kosku?schema=public';

function mapRoleToNewRole(oldRole) {
  switch (oldRole) {
    case 'Agent':
    case 'Stoker':
    case 'Principal':
      return 'AGENT';
    case 'User':
    case 'Owner':
    case 'Pengosongan':
    case 'Register':
    case 'Pending':
    default:
      return 'USER';
  }
}

async function migrate() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log('Connected to PostgreSQL (users)');

  try {
    // Ambil semua account
    const { rows } = await client.query(`
      SELECT
        id_account,
        username,
        email,
        nama,
        tanggal_lahir,
        "password",
        kota,
        kecamatan,
        nomor_telepon,
        roles,
        kode_referal,
        provinsi
      FROM public.account
      WHERE "password" IS NOT NULL
        AND (email IS NOT NULL OR nomor_telepon IS NOT NULL)
    `);

    console.log('Total account ditemukan:', rows.length);

    let successCount = 0;
    let failCount = 0;

    for (const acc of rows) {
      const {
        id_account,
        username,
        email,
        nama,
        tanggal_lahir,
        password,
        kota,
        nomor_telepon,
        roles,
        kode_referal,
      } = acc;

      try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const peran = mapRoleToNewRole(roles);
        const namaLengkap = nama || username || email || nomor_telepon;

        // JANGAN langsung isi kode_referral (nanti update setelah agent selesai)
        const insertRes = await client.query(
          `
          INSERT INTO public.pengguna (
            nama_lengkap,
            email,
            nomor_telepon,
            kata_sandi,
            kota_asal,
            tanggal_lahir,
            peran,
            status_akun,
            kode_referral
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'AKTIF', NULL)
          ON CONFLICT (email) DO NOTHING
          RETURNING id_pengguna
        `,
          [namaLengkap, email, nomor_telepon, hashedPassword, kota, tanggal_lahir, peran]
        );

        if (insertRes.rowCount > 0) {
          const idPenggunaBaru = insertRes.rows[0].id_pengguna;

          // Simpan mapping
          await client.query(
            `
            INSERT INTO public.mapping_pengguna (id_account_lama, id_pengguna_baru)
            VALUES ($1, $2)
            ON CONFLICT (id_account_lama) DO NOTHING
          `,
            [id_account, idPenggunaBaru]
          );

          successCount++;
          console.log(`OK: ${id_account} -> ${idPenggunaBaru} (${email || nomor_telepon})`);
        } else {
          console.log(`SKIP (conflict): ${id_account}`);
        }
      } catch (err) {
        failCount++;
        console.error(`FAIL: ${id_account}:`, err.message);
      }
    }

    console.log('Migrasi pengguna selesai');
    console.log('Sukses:', successCount, 'Gagal:', failCount);
  } catch (err) {
    console.error('Error utama migrasi pengguna:', err.message);
  } finally {
    await client.end();
    console.log('PostgreSQL connection closed (users)');
  }
}

migrate().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
