import postgres from 'postgres';

const demoUrl = process.env.DATABASE_URL_DEMO;
if (!demoUrl) {
  console.error('DATABASE_URL_DEMO missing');
  process.exit(1);
}

const sql = postgres(demoUrl, { max: 1, ssl: 'require' });

try {
  const tables = [
    'events',
    'profiles',
    'registrations',
    'attendance',
    'reviews',
    'review_likes',
    'help_requests',
    'sponsors',
    'user_vouchers',
    'voucher_campaigns',
    'user_achievements',
    'user_roles',
    'festivals',
    'categories',
    'achievements',
    '_rangora_migrations',
  ];

  console.log('--- Canonical Baseline Table Counts on rangora-demo ---');
  for (const t of tables) {
    const [{ count }] = await sql.unsafe(`SELECT COUNT(*) as count FROM public.${t}`);
    console.log(`  ${t.padEnd(20)}: ${count}`);
  }

  // Also verify profiles count matches exactly 10 deterministic demo users
  const demoProfiles = await sql`
    SELECT p.id, p.email, p.full_name, r.role 
    FROM public.profiles p
    LEFT JOIN public.user_roles r ON p.id = r.user_id
    WHERE p.id = ANY(ARRAY[
      'd3300001-0000-4000-8000-000000000001',
      'd3300002-0000-4000-8000-000000000002',
      'd3300003-0000-4000-8000-000000000003',
      'd3300004-0000-4000-8000-000000000004',
      'd3300005-0000-4000-8000-000000000005',
      'd3300010-0000-4000-8000-000000000010',
      'd3300011-0000-4000-8000-000000000011',
      'd3300012-0000-4000-8000-000000000012',
      'd3300013-0000-4000-8000-000000000013',
      'd3300014-0000-4000-8000-000000000014'
    ]::uuid[])
    ORDER BY p.id
  `;
  console.log(`\nDeterministic demo profiles found: ${demoProfiles.length} / 10`);
  for (const p of demoProfiles) {
    console.log(`  - [${(p.role || 'none').padEnd(11)}] ${p.full_name} (${p.email})`);
  }

} finally {
  await sql.end();
}
