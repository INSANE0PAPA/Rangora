import { describe, it, expect, vi } from 'vitest';
// @ts-ignore — Importing ES module runner for unit testing
import {
  getDirectDatabaseUrl,
  redactDatabaseUrl,
  calculateChecksum,
  loadMigrationFiles,
  evaluateMigrationPlan,
  runDryRun
} from '../../scripts/apply-neon-migrations.mjs';
import packageJson from '../../package.json';

describe('apply-neon-migrations.mjs — Migration Runner Safety & History Logic', () => {
  describe('1. Fallback Removal & Direct Connection Guard', () => {
    it('strictly requires DATABASE_URL_DIRECT and throws when missing', () => {
      const mockEnv = {
        DATABASE_URL: 'postgresql://user:pass@ep-pooler.neon.tech/neondb'
      };
      const mockProcessEnv = {};

      expect(() => getDirectDatabaseUrl(mockEnv, mockProcessEnv)).toThrow(
        /DATABASE_URL_DIRECT is not configured/
      );
    });

    it('never falls back to DATABASE_URL even if available', () => {
      const mockEnv = {
        DATABASE_URL: 'postgresql://user:secret@ep-pooler.neon.tech/neondb'
      };
      const mockProcessEnv = {
        DATABASE_URL: 'postgresql://user:secret@ep-pooler.neon.tech/neondb'
      };

      expect(() => getDirectDatabaseUrl(mockEnv, mockProcessEnv)).toThrow(
        /Pooled connections \(DATABASE_URL\) and Supabase connections must never be used/
      );
    });

    it('returns trimmed DATABASE_URL_DIRECT when present in env', () => {
      const mockEnv = {
        DATABASE_URL_DIRECT: '  postgresql://user:pass@ep-direct.neon.tech/neondb?sslmode=require  '
      };
      const result = getDirectDatabaseUrl(mockEnv, {});
      expect(result).toBe('postgresql://user:pass@ep-direct.neon.tech/neondb?sslmode=require');
    });

    it('falls back to process.env.DATABASE_URL_DIRECT if not in .env object', () => {
      const mockEnv = {};
      const mockProcessEnv = {
        DATABASE_URL_DIRECT: 'postgresql://user:pass@ep-direct.neon.tech/neondb'
      };
      const result = getDirectDatabaseUrl(mockEnv, mockProcessEnv);
      expect(result).toBe('postgresql://user:pass@ep-direct.neon.tech/neondb');
    });
  });

  describe('2. Connection URI Redaction & Credential Hygiene', () => {
    it('redacts sensitive user and password credentials', () => {
      const rawUri = 'postgresql://sensitive_user:super_secret_pw@ep-shy-water-123456.c-9.us-east-2.aws.neon.tech/neondb?sslmode=require';
      const redacted = redactDatabaseUrl(rawUri);

      expect(redacted.protocol).toBe('postgresql:');
      expect(redacted.endpointPrefix).toBe('ep-shy-w...');
      expect(redacted.isPooler).toBe(false);
      expect(redacted.domain).toBe('c-9.us-east-2.aws.neon.tech');
      expect(redacted.database).toBe('neondb');
      expect(redacted.port).toBe('5432');
      expect(redacted.sslmode).toBe('require');

      // Verify no password or username leakage
      const serialized = JSON.stringify(redacted);
      expect(serialized).not.toContain('sensitive_user');
      expect(serialized).not.toContain('super_secret_pw');
      expect(serialized).not.toContain('123456');
    });

    it('detects PgBouncer pooler mode in connection URI', () => {
      const poolerUri = 'postgresql://usr:pwd@ep-shy-water-123456-pooler.c-9.us-east-2.aws.neon.tech/neondb';
      const redacted = redactDatabaseUrl(poolerUri);
      expect(redacted.isPooler).toBe(true);
      expect(redacted.endpointPrefix).toBe('ep-shy-w...');
    });
  });

  describe('3. Migration Files & Checksum Calculation', () => {
    it('loads 0007 and 0008 migration files successfully', () => {
      const files = loadMigrationFiles();
      expect(files).toHaveLength(2);

      const m0007 = files[0]!;
      const m0008 = files[1]!;
      expect(m0007.id).toBe('0007_neon_complete_schema_and_functions');
      expect(m0007.fileName).toBe('0007_neon_complete_schema_and_functions.sql');
      expect(m0007.sql.length).toBeGreaterThan(10000);
      expect(m0007.checksum).toMatch(/^[a-f0-9]{64}$/);

      expect(m0008.id).toBe('0008_neon_seed_catalogue_data');
      expect(m0008.fileName).toBe('0008_neon_seed_catalogue_data.sql');
      expect(m0008.sql.length).toBeGreaterThan(15000);
      expect(m0008.checksum).toMatch(/^[a-f0-9]{64}$/);
    });

    it('computes deterministic SHA-256 digests', () => {
      const sample = 'SELECT 1;';
      const hash1 = calculateChecksum(sample);
      const hash2 = calculateChecksum(sample);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });
  });

  describe('4. Migration History & Plan Evaluation (_rangora_migrations)', () => {
    it('marks all migrations PENDING on a fresh database', () => {
      const files = loadMigrationFiles();
      const plan = evaluateMigrationPlan([], files);

      expect(plan).toHaveLength(2);
      expect(plan[0]!.status).toBe('PENDING');
      expect(plan[1]!.status).toBe('PENDING');
    });

    it('skips migrations when ID and checksum match recorded ledger', () => {
      const files = loadMigrationFiles();
      const file0 = files[0]!;
      const file1 = files[1]!;
      const mockLedger = [
        {
          migration_id: file0.id,
          checksum: file0.checksum,
          applied_at: new Date('2026-11-10T12:00:00Z'),
          execution_ms: 1250
        },
        {
          migration_id: file1.id,
          checksum: file1.checksum,
          applied_at: new Date('2026-11-10T12:00:02Z'),
          execution_ms: 850
        }
      ];

      const plan = evaluateMigrationPlan(mockLedger, files);
      expect(plan[0]!.status).toBe('ALREADY_APPLIED');
      expect(plan[1]!.status).toBe('ALREADY_APPLIED');
    });

    it('allows 0007 to be skipped while 0008 remains pending', () => {
      const files = loadMigrationFiles();
      const file0 = files[0]!;
      const partialLedger = [
        {
          migration_id: file0.id,
          checksum: file0.checksum,
          applied_at: new Date('2026-11-10T12:00:00Z'),
          execution_ms: 1250
        }
      ];

      const plan = evaluateMigrationPlan(partialLedger, files);
      expect(plan[0]!.status).toBe('ALREADY_APPLIED');
      expect(plan[1]!.status).toBe('PENDING');
    });

    it('aborts and throws CHECKSUM MISMATCH if a migration file was altered after application', () => {
      const files = loadMigrationFiles();
      const file0 = files[0]!;
      const corruptLedger = [
        {
          migration_id: file0.id,
          checksum: '0000000000000000000000000000000000000000000000000000000000000000', // tampered
          applied_at: new Date('2026-11-10T12:00:00Z'),
          execution_ms: 1250
        }
      ];

      expect(() => evaluateMigrationPlan(corruptLedger, files)).toThrow(
        /CHECKSUM MISMATCH DETECTED/
      );
    });
  });

  describe('5. Dry Run Safety & Execution Protection', () => {
    it('executes dry run without error and without modifying database', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const files = loadMigrationFiles();
      const mockDirectUrl = 'postgresql://user:pass@ep-shy-water-123456.c-9.us-east-2.aws.neon.tech/neondb?sslmode=require';

      expect(() => runDryRun({ directUrl: mockDirectUrl, migrationFiles: files })).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('RANGORA 2.0 — NEON MIGRATION RUNNER (DRY RUN MODE)')
      );
      consoleSpy.mockRestore();
    });

    it('displays expected timeline guard in dry run output when specified', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const files = loadMigrationFiles();
      const mockDirectUrl = 'postgresql://user:pass@ep-shy-water-123456.c-9.us-east-2.aws.neon.tech/neondb?sslmode=require';

      expect(() => runDryRun({
        directUrl: mockDirectUrl,
        migrationFiles: files,
        expectTimelineId: '5f158bb406de27fe9f592ee841655ebe'
      })).not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Timeline Guard: EXPECTED 5f158bb406de27fe9f592ee841655ebe')
      );
      consoleSpy.mockRestore();
    });
  });

  describe('6. Gemini Package Version Confirmation', () => {
    it('confirms @google/genai version 3.1.0 is installed in package.json', () => {
      expect(packageJson.dependencies['@google/genai']).toBe('^3.1.0');
    });
  });
});
