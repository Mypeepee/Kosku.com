// scripts/update-references.js
import pg from 'pg';

const { Client } = pg;

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:01082003Jason@127.0.0.1:5432/kosku?schema=public';

async function updateReferences() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log('Connected to PostgreSQL (update references)');

  try {
    // 1) Update kode_referral di pengguna (dari AG001 lama → AG1 baru)
    console.log('\n=== Update kode_referral di pengguna ===');
    
    const { rows: penggunaRows } = await client.query(`
      SELECT p.id_pengguna, acc.kode_referal
      FROM public.pengguna p
      JOIN public.mapping_pengguna mp ON mp.id_pengguna_baru = p.id_pengguna
      JOIN public.account acc ON acc.id_account = mp.id_account_lama
      WHERE acc.kode_referal IS NOT NULL
    `);

    let updatedKodeRef = 0;
    for (const row of penggunaRows) {
      const { id_pengguna, kode_referal } = row;

      // Cari id_agent_baru dari mapping
      const mapRes = await client.query(
        `SELECT id_agent_baru FROM public.mapping_agent WHERE id_agent_lama = $1`,
        [kode_referal]
      );

      if (mapRes.rowCount > 0) {
        const idAgentBaru = mapRes.rows[0].id_agent_baru;

        await client.query(
          `UPDATE public.pengguna SET kode_referral = $1 WHERE id_pengguna = $2`,
          [idAgentBaru, id_pengguna]
        );

        updatedKodeRef++;
        console.log(`  Update kode_referral: ${id_pengguna} -> ${idAgentBaru}`);
      }
    }

    console.log(`Total kode_referral diupdate: ${updatedKodeRef}`);

    // 2) Update id_upline di agent (dari AG001 lama → AG1 baru)
    console.log('\n=== Update id_upline di agent ===');

    const { rows: agentRows } = await client.query(`
      SELECT ag.id_agent, at.upline_id
      FROM public.agent ag
      JOIN public.mapping_agent ma ON ma.id_agent_baru = ag.id_agent
      JOIN public.agent_tampungan at ON at.id_agent = ma.id_agent_lama
      WHERE at.upline_id IS NOT NULL
    `);

    let updatedUpline = 0;
    for (const row of agentRows) {
      const { id_agent, upline_id } = row;

      const mapRes = await client.query(
        `SELECT id_agent_baru FROM public.mapping_agent WHERE id_agent_lama = $1`,
        [upline_id]
      );

      if (mapRes.rowCount > 0) {
        const idUplineBaru = mapRes.rows[0].id_agent_baru;

        await client.query(
          `UPDATE public.agent SET id_upline = $1 WHERE id_agent = $2`,
          [idUplineBaru, id_agent]
        );

        updatedUpline++;
        console.log(`  Update id_upline: ${id_agent} -> upline ${idUplineBaru}`);
      }
    }

    console.log(`Total id_upline diupdate: ${updatedUpline}`);

    console.log('\n=== Update referensi selesai ===');
  } catch (err) {
    console.error('Error update references:', err.message);
  } finally {
    await client.end();
    console.log('PostgreSQL connection closed (update references)');
  }
}

updateReferences().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
