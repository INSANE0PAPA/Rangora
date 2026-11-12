declare module '*/apply-neon-migrations.mjs' {
  export function parseEnvKeys(filePath?: string): Record<string, string>;
  export function getDirectDatabaseUrl(env?: Record<string, string>, processEnv?: NodeJS.ProcessEnv): string;
  export function redactDatabaseUrl(rawUrl: string): {
    protocol?: string;
    endpointPrefix?: string;
    isPooler?: boolean;
    domain?: string;
    database?: string;
    port?: string;
    sslmode?: string;
    error?: string;
  };
  export function calculateChecksum(content: string): string;
  export function loadMigrationFiles(baseDir?: string): Array<{
    id: string;
    fileName: string;
    description: string;
    fullPath: string;
    sql: string;
    checksum: string;
    bytes: number;
    lines: number;
  }>;
  export function evaluateMigrationPlan(
    existingLedger: any[],
    migrationFiles: any[]
  ): Array<any>;
  export function runDryRun(options: { directUrl: string; migrationFiles: any[]; expectTimelineId?: string | null }): void;
  export function applyMigrations(options: { directUrl: string; migrationFiles: any[]; expectTimelineId?: string | null }): Promise<void>;
  export function main(): Promise<void>;
}
