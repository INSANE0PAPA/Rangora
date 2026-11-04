import postgres from 'postgres';

async function check(name, url) {
  if (!url) return console.log(name, 'not set');
  const sql = postgres(url, { ssl: 'require' });
  try {
    const rows = await sql`SELECT * FROM public.leaderboard LIMIT 10`;
    console.log(`--- ${name} Leaderboard (${rows.length} rows) ---`);
    for (const r of rows) {
      console.log(' ', r);
    }
  } catch (err) {
    console.error(`Error querying ${name}:`, err.message);
  } finally {
    await sql.end();
  }
}

await check('Production', process.env.DATABASE_URL_DIRECT);
await check('Demo', process.env.DATABASE_URL_DEMO);

