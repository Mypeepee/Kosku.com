// scripts/migrate-agents.js
import pg from 'pg';

const { Client } = pg;

// SESUAIKAN koneksi
const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:01082003Jason@127.0.0.1:5432/kosku?schema=public';

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
    // Ambil semua agent_tampungan dengan email (seperti script lama)
    const { rows } = await client.query(`
      SELECT *
      FROM public.agent_tampungan
      WHERE email IS NOT NULL
      ORDER BY id_account
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
        jumlah_penjualan,
        lokasi_kerja,
        gambar_ktp,
        gambar_npwp,
        upline_id,    // untuk mapping kantor
      } = row;

      try {
        // 1) Ambil id_pengguna baru dari mapping_pengguna (bukan cari by email)
        const mapUserRes = await client.query(
          `SELECT id_pengguna_baru FROM public.mapping_pengguna WHERE id_account_lama = $1`,
          [id_account],
        );
        if (mapUserRes.rowCount === 0) {
          skippedNoUser++;
          console.warn(
            `SKIP (tidak ada mapping pengguna): ${id_account} (${email})`,
          );
          continue;
        }
        const idPenggunaBaru = mapUserRes.rows[0].id_pengguna_baru;

        // 2) ambil roles dari account untuk jabatan
        const accRes = await client.query(
          `SELECT roles FROM public.account WHERE id_account = $1`,
          [id_account],
        );
        const rolesAccount = accRes.rowCount ? accRes.rows[0].roles : roles;
        const jabatanFinal = mapJabatanFromRoles(rolesAccount);

        // 3) nama_kantor & kota_area (logika lama dipertahankan)
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

        // 4) INSERT ke agent (schema baru, TANPA kolom id_agent_lama)
        const insertRes = await client.query(
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
            poin,
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
            tanggal_gabung
          )
          VALUES (
            $1, $2, $3, $4, NULL,
            $5, $6, $7, $8,
            0,
            $9, $10, $11,
            NULL, NULL, $12,
            $13, NULL, $14,
            $15, $16
          )
          RETURNING id_agent
        `,
          [
            idPenggunaBaru,      // 1
            kantorFinal,         // 2
            kotaAreaFinal,       // 3
            jabatanFinal,        // 4
            ratingNum,           // 5
            jumlahClosingInt,    // 6
            totalOmsetNum,       // 7
            wa,                  // 8
            gambar_ktp,          // 9
            gambar_npwp,         // 10
            picture,             // 11
            nama,                // 12 (atas_nama_rekening)
            instagram,           // 13
            facebook,            // 14
            statusFinal,         // 15
            tanggalGabungFinal,  // 16
          ],
        );

        const idAgentBaru = insertRes.rows[0].id_agent;

        // 5) Simpan mapping agent lama -> baru
        if (idAgentLama) {
          await client.query(
            `
            INSERT INTO public.mapping_agent (id_agent_lama, id_agent_baru)
            VALUES ($1, $2)
            ON CONFLICT (id_agent_lama) DO NOTHING
          `,
            [idAgentLama, idAgentBaru],
          );
        }

        success++;
        console.log(`OK agent: ${id_account} (${email}) => ${idAgentBaru}`);
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
