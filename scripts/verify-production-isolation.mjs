import postgres from 'postgres';

const prodUrl = process.env.DATABASE_URL_DIRECT;
if (!prodUrl) {
  console.error('[ERROR] DATABASE_URL_DIRECT is not set.');
  process.exit(1);
}

const sql = postgres(prodUrl, { max: 1, ssl: 'require' });

try {
  const [tl] = await sql`SHOW neon.timeline_id`;
  const timelineId = tl ? tl['neon.timeline_id'] : null;

  const [{ count: pCount }] = await sql`
    SELECT COUNT(*) as count FROM public.profiles 
    WHERE id = 'd3300001-0000-4000-8000-000000000001'
  `;

  const [{ count: rCount }] = await sql`
    SELECT COUNT(*) as count FROM public.registrations 
    WHERE pass_code LIKE 'RNG-%'
  `;

  console.log('--- Production Database Isolation Verification ---');
  console.log('Production Neon Timeline ID   :', timelineId);
  console.log('Expected Production Timeline  : ff6dc35ad13680c0a665fbd20e4d4876');
  console.log('Timeline matches production   :', timelineId === 'ff6dc35ad13680c0a665fbd20e4d4876');
  console.log('Demo profiles in production   :', pCount, '(MUST BE 0)');
  console.log('Demo registrations in prod    :', rCount, '(MUST BE 0)');

  if (pCount === '0' && rCount === '0' && timelineId === 'ff6dc35ad13680c0a665fbd20e4d4876') {
    console.log('[PASS] Production database is 100% UNTOUCHED and pristine.');
  } else {
    console.error('[FAIL] Production database isolation violation detected!');
    process.exit(1);
  }
} finally {
  await sql.end();
}

