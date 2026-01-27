// scripts/migrate-agents.js
import pg from 'pg';

const { Client } = pg;

// SESUAIKAN koneksi
const connectionString =
  process.env.DATABASE_URL || 'postgres://postgres:password@127.0.0.1:5432/kosku';

function normalizePhone(phone) {
  if (!phone) return null;
  let p = phone.trim().replace(/\s+/g, '');
  if (p.startsWith('+62')) return p;
  if (p.startsWith('62')) return '+' + p;
  if (p.startsWith('0')) return '+62' + p.slice(1);
  return p;
}

// jabatan dari account.roles
function mapJabatanFromRoles(roles) {
  if (!roles) return 'AGENT';
  const s = roles.toLowerCase();
  if (s.includes('principal')) return 'PRINCIPAL';
  if (s.includes('stoker')) return 'STOKER';
  if (s.includes('owner')) return 'OWNER';
  if (s.includes('agent')) return 'AGENT';
  return 'AGENT';
}

function mapStatusKeanggotaan(status) {
  if (!status) return 'PENDING';
  const s = status.toUpperCase();
  if (s === 'AKTIF') return 'AKTIF';
  if (s === 'SUSPEND') return 'SUSPEND';
  if (s === 'PENDING') return 'PENDING';
  return 'PENDING';
}

function parseIntOrNull(v) {
  if (v === null || v === undefined) return null;
  const n = parseInt(String(v), 10);
  return Number.isNaN(n) ? null : n;
}

function parseFloatOrNull(v) {
  if (v === null || v === undefined) return null;
  const n = parseFloat(String(v));
  return Number.isNaN(n) ? null : n;
}

function normalizeDateString(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s; // biarkan PG yang cast
}

async function migrateAgents() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log('Connected to PostgreSQL (agents)');

  try {
    const { rows } = await client.query(`
      SELECT *
      FROM public.agent_tampungan
      WHERE email IS NOT NULL
    `);

    console.log('Total agent_tampungan ditemukan:', rows.length);

    let success = 0;
    let skippedNoUser = 0;
    let fail = 0;

    for (const row of rows) {
      const {
        id_account,
        id_agent,     // id_agent lama, contoh: AG001
        email,
        nama,
        kota,
        nomor_telepon,
        roles,
        instagram,
        facebook,
        tanggal_join,
        picture,
        status,
        rating,
        comment,
        jumlah_penjualan,
        lokasi_kerja,
        gambar_ktp,
        gambar_npwp,
        upline_id,    // untuk mapping kantor
      } = row;

      try {
        // 1) cari pengguna berdasarkan email
        const userRes = await client.query(
          `SELECT id_pengguna FROM public.pengguna WHERE email = $1`,
          [email],
        );
        if (userRes.rowCount === 0) {
          skippedNoUser++;
          console.warn(
            `SKIP (tidak ada pengguna): ${id_account} (${email})`,
          );
          continue;
        }
        const idPenggunaBaru = userRes.rows[0].id_pengguna;

        // 2) ambil roles dari account untuk jabatan
        const accRes = await client.query(
          `SELECT roles FROM public.account WHERE id_account = $1`,
          [id_account],
        );
        const rolesAccount = accRes.rowCount ? accRes.rows[0].roles : roles;
        const jabatanFinal = mapJabatanFromRoles(rolesAccount);

        // 3) nama_kantor & kota_area
        let kantorFinal;
        if (upline_id === 'AG023' || id_agent === 'AG023') {
          kantorFinal = 'Ray White Diponegoro';
        } else if (upline_id === 'AG022' || id_agent === 'AG022') {
          kantorFinal = 'Era Ventura';
        } else {
          kantorFinal = 'Kantor Tidak Diketahui';
        }

        const kotaAreaFinal = lokasi_kerja || kota || 'KOTA TIDAK DIKETAHUI';

        const wa = normalizePhone(nomor_telepon);
        const ratingNum = parseFloatOrNull(rating) ?? 0.0;
        const jumlahClosingInt = 0;
        const totalOmsetNum = 0.0;
        const jumlahPenjualanInt = parseIntOrNull(jumlah_penjualan) ?? 0;

        const statusFinal = mapStatusKeanggotaan(status);
        const tanggalGabungFinal = normalizeDateString(tanggal_join);

        const idAgentLama = id_agent; // AG001 lama

        // 4) INSERT ke agent
        await client.query(
          `
          INSERT INTO public.agent (
            id_pengguna,
            nama_kantor,
            kota_area,
            jabatan,
            id_upline,
            rating,
            jumlah_closing,
            total_omset,
            nomor_whatsapp,
            foto_ktp_url,
            foto_npwp_url,
            foto_profil_url,
            nama_bank,
            nomor_rekening,
            atas_nama_rekening,
            link_instagram,
            link_tiktok,
            link_facebook,
            status_keanggotaan,
            tanggal_gabung,
            id_agent_lama
          )
          VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            $10, $11, $12,
            $13, $14, $15,
            $16, $17, $18,
            $19, $20, $21
          )
        `,
          [
            idPenggunaBaru,       // 1
            kantorFinal,          // 2
            kotaAreaFinal,        // 3
            jabatanFinal,         // 4
            null,                 // 5: id_upline (sementara NULL)
            ratingNum,            // 6
            jumlahClosingInt,     // 7
            totalOmsetNum,        // 8
            wa,                   // 9
            gambar_ktp,           // 10
            gambar_npwp,          // 11
            picture,              // 12
            null,                 // 13
            null,                 // 14
            nama,                 // 15
            instagram,            // 16
            null,                 // 17
            facebook,             // 18
            statusFinal,          // 19
            tanggalGabungFinal,   // 20
            idAgentLama,          // 21
          ],
        );

        success++;
        console.log(`OK agent: ${id_account} (${email})`);
      } catch (err) {
        fail++;
        console.error(`FAIL agent: ${id_account} (${email}):`, err.message);
      }
    }

    console.log('Migrasi agent selesai');
    console.log(
      'Sukses:',
      success,
      'Skip tanpa pengguna:',
      skippedNoUser,
      'Gagal:',
      fail,
    );
  } finally {
    await client.end();
    console.log('PostgreSQL connection closed (agents)');
  }
}

migrateAgents().catch((err) => {
  console.error('Fatal error (agents):', err);
  process.exit(1);
});
