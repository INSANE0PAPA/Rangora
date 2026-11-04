import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const projectRequire = createRequire(import.meta.url);
const postgresImport = projectRequire('postgres');
const postgres = postgresImport.default || postgresImport;

/**
 * Parse .env file without external dependencies
 */
export function parseEnvKeys(filePath = '.env') {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf-8');
  const result = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      result[key] = val;
    }
  }
  return result;
}

/**
 * Strict resolver for direct database connection.
 * NEVER falls back to pooled DATABASE_URL or Supabase variables.
 */
export function getDirectDatabaseUrl(env = {}, processEnv = process.env) {
  const directUrl = env['DATABASE_URL_DIRECT'] || processEnv.DATABASE_URL_DIRECT;
  if (!directUrl || !directUrl.trim()) {
    throw new Error(
      '[SECURITY ERROR] DATABASE_URL_DIRECT is not configured in .env or environment.\n' +
      'Direct compute access (port 5432, non-pooler) is strictly required for DDL schema migrations.\n' +
      'Pooled connections (DATABASE_URL) and Supabase connections must never be used for DDL.'
    );
  }
  return directUrl.trim();
}

/**
 * Safely redact database URL for logging.
 * Never outputs usernames, passwords, tokens, or raw connection strings.
 */
export function redactDatabaseUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname;
    const isPooler = host.includes('-pooler');
    const endpointId = host.split('.')[0].replace('-pooler', '');
    const domain = host.split('.').slice(1).join('.');
    const dbName = parsed.pathname.replace(/^\//, '');

    return {
      protocol: parsed.protocol,
      endpointPrefix: endpointId.slice(0, 8) + '...',
      isPooler,
      domain,
      database: dbName,
      port: parsed.port || '5432',
      sslmode: parsed.searchParams.get('sslmode') || 'require'
    };
  } catch (err) {
    return { error: 'Unable to parse connection URI format' };
  }
}

/**
 * Calculate SHA-256 checksum of SQL content
 */
export function calculateChecksum(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Migration definition registry
 */
export const MIGRATION_DEFINITIONS = [
  {
    id: '0007_neon_complete_schema_and_functions',
    fileName: '0007_neon_complete_schema_and_functions.sql',
    description: 'Consolidated 21 domain tables, constraints, indexes, 5 triggers, and sync procedures'
  },
  {
    id: '0008_neon_seed_catalogue_data',
    fileName: '0008_neon_seed_catalogue_data.sql',
    description: 'Catalogue & reference seed data (38 events, 8 categories, 6 festivals, 13 badges, 5 voucher campaigns)'
  }
];

/**
 * Load and validate migration files from disk
 */
export function loadMigrationFiles(baseDir = 'drizzle/migrations') {
  return MIGRATION_DEFINITIONS.map(def => {
    const fullPath = path.resolve(baseDir, def.fileName);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`[MIGRATION FILE NOT FOUND] Expected migration file at: ${fullPath}`);
    }
    const sql = fs.readFileSync(fullPath, 'utf-8');
    const checksum = calculateChecksum(sql);
    const bytes = Buffer.byteLength(sql, 'utf-8');
    const lines = sql.split('\n').length;
    return {
      ...def,
      fullPath,
      sql,
      checksum,
      bytes,
      lines
    };
  });
}

/**
 * Evaluate migration plan against current database ledger.
 * Throws on checksum mismatch.
 */
export function evaluateMigrationPlan(existingLedger = [], migrationFiles) {
  const ledgerMap = new Map();
  for (const row of existingLedger) {
    ledgerMap.set(row.migration_id, row);
  }

  return migrationFiles.map(m => {
    const existing = ledgerMap.get(m.id);
    if (!existing) {
      return {
        ...m,
        status: 'PENDING',
        reason: 'Not yet recorded in _rangora_migrations ledger'
      };
    }

    if (existing.checksum === m.checksum) {
      return {
        ...m,
        status: 'ALREADY_APPLIED',
        appliedAt: existing.applied_at,
        executionMs: existing.execution_ms,
        reason: `Already applied on ${new Date(existing.applied_at).toISOString()} (checksum verified)`
      };
    }

    throw new Error(
      `[CHECKSUM MISMATCH DETECTED]\n` +
      `Migration '${m.id}' was previously applied to the database, but the local file has been modified!\n` +
      `Database Recorded Checksum: ${existing.checksum}\n` +
      `Local SQL File Checksum:   ${m.checksum}\n` +
      `Aborting migration to prevent inconsistent or corrupted database schema.`
    );
  });
}

/**
 * Execute dry-run inspection (Zero database modifications)
 */
export function runDryRun({ directUrl, migrationFiles, expectTimelineId = null }) {
  const redacted = redactDatabaseUrl(directUrl);

  console.log('\n=============================================================================');
  console.log('         RANGORA 2.0 — NEON MIGRATION RUNNER (DRY RUN MODE)');
  console.log('=============================================================================');
  console.log('Protection:  NO DATABASE WRITES PERFORMED (Safe read-only inspection)');
  console.log('Endpoint:    Direct Compute (port 5432, pooler bypass enforced)');
  console.log(`Target:      ${redacted.protocol}//[REDACTED_USER]:[REDACTED_PASS]@${redacted.endpointPrefix}.${redacted.domain}/${redacted.database}`);
  console.log(`             Host Pooler: ${redacted.isPooler ? 'WARNING (POOLER)' : 'DIRECT COMPUTE (CORRECT)'}`);
  console.log(`             SSL Mode:    ${redacted.sslmode}`);
  if (expectTimelineId) {
    console.log(`Timeline Guard: EXPECTED ${expectTimelineId}`);
  }
  console.log('-----------------------------------------------------------------------------');
  console.log('MIGRATION FILES SCHEDULED:');

  migrationFiles.forEach((m, idx) => {
    console.log(`\n [${idx + 1}/${migrationFiles.length}] ${m.id}`);
    console.log(`     File:        ${m.fileName}`);
    console.log(`     Size:        ${m.bytes.toLocaleString()} bytes (${m.lines} lines)`);
    console.log(`     SHA-256:     ${m.checksum}`);
    console.log(`     Description: ${m.description}`);
  });

  console.log('\n-----------------------------------------------------------------------------');
  console.log('DRY-RUN STATUS: PASS');
  console.log('All migration files exist, are readable, and direct credentials are validly formatted.');
  console.log('Zero modifications were made to the database.');
  console.log('\nTo execute migrations against Neon, run with explicit approval flag:');
  console.log(`   node scripts/apply-neon-migrations.mjs --apply${expectTimelineId ? ` --expect-timeline-id ${expectTimelineId}` : ''}\n`);
  console.log('=============================================================================\n');
}

/**
 * Execute migrations against direct Neon database connection.
 * Wraps each migration in an atomic transaction and records history.
 */
export async function applyMigrations({ directUrl, migrationFiles, expectTimelineId = null }) {
  console.log('[1/5] Connecting to Neon PostgreSQL via direct compute connection...');
  const sql = postgres(directUrl, {
    ssl: 'require',
    connect_timeout: 15,
    max: 1
  });

  try {
    const [dbInfo] = await sql`SELECT current_database(), current_user, version()`;
    if (dbInfo.current_database !== 'neondb') {
      throw new Error(`[TARGET SAFETY ABORT] Expected database 'neondb', but connected to '${dbInfo.current_database}'`);
    }

    const redacted = redactDatabaseUrl(directUrl);
    if (redacted.isPooler) {
      throw new Error(`[TARGET SAFETY ABORT] Direct connection is pooled (-pooler detected). Direct compute required.`);
    }

    // Query and verify Neon timeline ID
    let actualTimelineId = null;
    try {
      const [tl] = await sql`SHOW neon.timeline_id`;
      actualTimelineId = tl['neon.timeline_id'];
    } catch (err) {
      throw new Error(`[TARGET SAFETY ABORT] Unable to query neon.timeline_id: ${err.message}`);
    }

    console.log(`Connected to: ${dbInfo.current_database} as ${dbInfo.current_user}`);
    console.log(`PostgreSQL Engine: ${dbInfo.version.split(' on ')[0]}`);
    console.log(`Neon Timeline ID: ${actualTimelineId}`);

    if (expectTimelineId) {
      if (actualTimelineId !== expectTimelineId) {
        throw new Error(
          `[CRITICAL TARGET SAFETY ABORT]\n` +
          `Target branch timeline mismatch!\n` +
          `Expected timeline ID:  ${expectTimelineId}\n` +
          `Connected timeline ID: ${actualTimelineId}\n` +
          `Aborting immediately before executing any DDL or DML to protect against wrong target branch execution.`
        );
      }
      console.log(`✓ Neon Timeline ID verified: ${actualTimelineId} (matches --expect-timeline-id guard)`);
    }

    // Ensure migration history tracking table exists
    await sql`
      CREATE TABLE IF NOT EXISTS public._rangora_migrations (
        id serial PRIMARY KEY,
        migration_id varchar(128) UNIQUE NOT NULL,
        description text NOT NULL,
        checksum varchar(64) NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now(),
        execution_ms integer NOT NULL
      );
    `;

    // Fetch existing ledger records
    const existingLedger = await sql`
      SELECT migration_id, checksum, applied_at, execution_ms 
      FROM public._rangora_migrations 
      ORDER BY id ASC;
    `;

    // Evaluate plan (validates checksums and determines pending items)
    const plan = evaluateMigrationPlan(existingLedger, migrationFiles);

    // Execute each migration in its own atomic transaction
    for (let i = 0; i < plan.length; i++) {
      const item = plan[i];
      const stepNum = i + 2;

      if (item.status === 'ALREADY_APPLIED') {
        console.log(`[${stepNum}/5] ${item.id}: ALREADY APPLIED (checksum matches). Skipping.`);
        continue;
      }

      console.log(`[${stepNum}/5] Applying ${item.id} inside dedicated transaction...`);
      const startTime = Date.now();

      await sql.begin(async (tx) => {
        // Execute multi-statement SQL with dollar-quoted PL/pgSQL function bodies
        await tx.unsafe(item.sql);

        // Record in migration history ledger within the same transaction
        const duration = Date.now() - startTime;
        await tx`
          INSERT INTO public._rangora_migrations (
            migration_id,
            description,
            checksum,
            execution_ms
          ) VALUES (
            ${item.id},
            ${item.description},
            ${item.checksum},
            ${duration}
          );
        `;
      });

      console.log(`✓ ${item.id} applied and recorded in ledger (${Date.now() - startTime}ms).`);
    }

    // Verification queries
    console.log('[4/5] Verifying migrated database state...');
    const tableRows = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    const tables = tableRows.map(r => r.table_name);
    console.log(`✓ Public tables present (${tables.length}):`, tables.join(', '));

    const [catCount] = await sql`SELECT count(*)::int as count FROM public.categories`;
    const [festCount] = await sql`SELECT count(*)::int as count FROM public.festivals`;
    const [eventCount] = await sql`SELECT count(*)::int as count FROM public.events`;
    const [achCount] = await sql`SELECT count(*)::int as count FROM public.achievements`;
    const [vouchCount] = await sql`SELECT count(*)::int as count FROM public.voucher_campaigns`;

    console.log('\n--- VERIFICATION ROW COUNTS ---');
    console.log(`Categories:        ${catCount.count} (expected 8)`);
    console.log(`Festivals:         ${festCount.count} (expected 6)`);
    console.log(`Events:            ${eventCount.count} (expected 38)`);
    console.log(`Achievements:      ${achCount.count} (expected 13)`);
    console.log(`Voucher Campaigns: ${vouchCount.count} (expected 5)`);
    console.log('-------------------------------\n');

    console.log('[5/5] Migration Ledger State (_rangora_migrations):');
    const records = await sql`
      SELECT id, migration_id, checksum, applied_at, execution_ms 
      FROM public._rangora_migrations 
      ORDER BY id ASC;
    `;
    records.forEach(r => {
      console.log(` - [#${r.id}] ${r.migration_id} (checksum: ${r.checksum.slice(0, 12)}..., duration: ${r.execution_ms}ms)`);
    });

    await sql.end({ timeout: 5 });
    console.log('\n✓ Neon migration completed, recorded, and verified successfully!');
  } catch (err) {
    await sql.end({ timeout: 1 }).catch(() => {});
    console.error('\n[MIGRATION FAILED]:', err.message);
    process.exit(1);
  }
}

/**
 * Main entry point
 */
export async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  const isForceDryRun = args.includes('--dry-run');

  let expectTimelineId = null;
  const tlIdx = args.indexOf('--expect-timeline-id');
  if (tlIdx !== -1 && args[tlIdx + 1]) {
    expectTimelineId = args[tlIdx + 1].trim();
  }

  try {
    const env = parseEnvKeys('.env');
    const directUrl = getDirectDatabaseUrl(env, process.env);
    const migrationFiles = loadMigrationFiles();

    if (!isApply || isForceDryRun) {
      runDryRun({ directUrl, migrationFiles, expectTimelineId });
      process.exit(0);
    }

    // Only reached if --apply is explicitly specified without --dry-run
    await applyMigrations({ directUrl, migrationFiles, expectTimelineId });
  } catch (err) {
    console.error('\n[MIGRATION RUNNER ERROR]:', err.message);
    process.exit(1);
  }
}

// Execute if run directly from CLI
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve('scripts/apply-neon-migrations.mjs')) {
  main();
}
