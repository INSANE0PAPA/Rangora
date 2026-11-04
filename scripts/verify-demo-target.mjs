import postgres from 'postgres';

const demoUrl = process.env.DATABASE_URL_DEMO;
const expectedTimeline = process.env.EXPECTED_DEMO_TIMELINE_ID;
const PROD_TIMELINE = 'ff6dc35ad13680c0a665fbd20e4d4876';
const VALIDATION_TIMELINE = '5f158bb406de27fe9f592ee841655ebe';

if (!demoUrl) {
  console.error('[ERROR] DATABASE_URL_DEMO is not set.');
  process.exit(1);
}

try {
  const parsed = new URL(demoUrl);
  console.log('--- Phase 1: Read-Only Target Verification ---');
  console.log('Host:', parsed.hostname);
  console.log('Pathname (DB):', parsed.pathname);
  console.log('Is pooled endpoint:', parsed.hostname.includes('-pooler'));
} catch (e) {
  console.error('[ERROR] Failed to parse DATABASE_URL_DEMO:', e.message);
  process.exit(1);
}

const sql = postgres(demoUrl, {
  max: 1,
  connect_timeout: 10,
  idle_timeout: 5,
  ssl: 'require',
});

try {
  // 1 & 2. Verify current_database(), current_user, version()
  const [dbInfo] = await sql`SELECT current_database(), current_user, version()`;
  console.log('Database:', dbInfo.current_database);
  console.log('User:', dbInfo.current_user);
  console.log('PostgreSQL Version:', dbInfo.version.split(' on ')[0]);

  if (dbInfo.current_database !== 'neondb') {
    throw new Error(`Expected current_database() to be 'neondb', got '${dbInfo.current_database}'`);
  }

  // 3. Query SHOW neon.timeline_id
  const [tl] = await sql`SHOW neon.timeline_id`;
  const actualTimeline = tl ? tl['neon.timeline_id'] : null;
  console.log('Actual Neon Timeline ID:', actualTimeline);
  console.log('Expected Demo Timeline ID:', expectedTimeline || '(not set in env)');

  // 4. Compare against EXPECTED_DEMO_TIMELINE_ID if set
  if (expectedTimeline && actualTimeline !== expectedTimeline) {
    throw new Error(`Timeline MISMATCH! Expected ${expectedTimeline}, got ${actualTimeline}`);
  }

  // 5. Verify different from production timeline
  if (actualTimeline === PROD_TIMELINE) {
    throw new Error(`CRITICAL ABORT! Timeline matches PRODUCTION (${PROD_TIMELINE})!`);
  }
  console.log('Verified: Distinct from production timeline (ff6dc35ad13680c0a665fbd20e4d4876): PASS');

  // 6. Verify different from validation timeline
  if (actualTimeline === VALIDATION_TIMELINE) {
    throw new Error(`CRITICAL ABORT! Timeline matches VALIDATION branch (${VALIDATION_TIMELINE})!`);
  }
  console.log('Verified: Distinct from validation timeline (5f158bb406de27fe9f592ee841655ebe): PASS');

  // 8. Check existing 21 domain tables and catalogue counts
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `;
  console.log('Total public tables found:', tables.length);
  const tableNames = tables.map(t => t.table_name);
  console.log('Tables:', tableNames.join(', '));

  // Check catalogue row counts
  const [eventsCount] = await sql`SELECT count(*)::int as count FROM public.events`;
  const [festivalsCount] = await sql`SELECT count(*)::int as count FROM public.festivals`;
  const [categoriesCount] = await sql`SELECT count(*)::int as count FROM public.categories`;
  const [achievementsCount] = await sql`SELECT count(*)::int as count FROM public.achievements`;
  const [voucherCampaignsCount] = await sql`SELECT count(*)::int as count FROM public.voucher_campaigns`;
  const [migrationsCount] = await sql`SELECT count(*)::int as count FROM public._rangora_migrations`;

  console.log('Catalogue counts:');
  console.log('  events:', eventsCount.count);
  console.log('  festivals:', festivalsCount.count);
  console.log('  categories:', categoriesCount.count);
  console.log('  achievements:', achievementsCount.count);
  console.log('  voucher_campaigns:', voucherCampaignsCount.count);
  console.log('  _rangora_migrations:', migrationsCount.count);

  console.log('--- Phase 1 Target Verification: ALL CHECKS PASSED ---');
} catch (err) {
  console.error('[ABORT] Target check failed:', err.message);
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}

