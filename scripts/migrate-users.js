// scripts/migrate-users.js
import pg from 'pg';
import bcrypt from 'bcrypt';

const { Client } = pg;

// Pakai env DATABASE_URL, fallback kalau perlu
const connectionString =
  process.env.DATABASE_URL || 'postgres://postgres:password@127.0.0.1:5432/kosku';

// Hanya dua role di sistem baru: USER dan AGENT
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
    // Ambil semua account yang punya password dan minimal email atau nomor_telepon
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
        kecamatan,
        nomor_telepon,
        roles,
        kode_referal,
        provinsi,
      } = acc;

      try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const peran = mapRoleToNewRole(roles);

        const namaLengkap = nama || username || email || nomor_telepon;

        // PENTING: kode_referal dibiarkan apa adanya (AG001, dst)
        const kodeReferralBaru = kode_referal || null;

        await client.query(
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
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'AKTIF', $8)
          ON CONFLICT (email) DO NOTHING
        `,
          [
            namaLengkap,
            email,
            nomor_telepon,
            hashedPassword,
            kota,
            tanggal_lahir,
            peran,
            kodeReferralBaru,
          ],
        );

        successCount++;
        console.log(
          `OK: ${id_account} -> ${email || nomor_telepon} (role: ${peran})`,
        );
      } catch (err) {
        failCount++;
        console.error(
          `FAIL: ${id_account} -> ${email || nomor_telepon}:`,
          err.message,
        );
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
