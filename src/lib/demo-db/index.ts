import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../../drizzle/schema";

/**
 * Production Neon Timeline ID that MUST NEVER be targeted by demo operations.
 */
export const PRODUCTION_TIMELINE_ID = "ff6dc35ad13680c0a665fbd20e4d4876";

/**
 * Redact connection string for safe server logging.
 * Never leaks passwords, credentials, or full URLs.
 */
export function redactDemoUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname;
    const isPooler = host.includes("-pooler");
    const endpointId = host.split(".")[0]?.replace("-pooler", "") ?? "unknown";
    const domain = host.split(".").slice(1).join(".");
    const dbName = parsed.pathname.replace(/^\//, "");

    return {
      endpointPrefix: endpointId.slice(0, 8) + "...",
      isPooler,
      domain,
      database: dbName,
      port: parsed.port || "5432",
      sslmode: parsed.searchParams.get("sslmode") || "require",
    };
  } catch {
    return { error: "Unable to parse connection URI format" };
  }
}

export function getDemoConnectionString(): string {
  const url = typeof process !== "undefined" ? process.env["DATABASE_URL_DEMO"] : undefined;
  if (!url || url.includes("YOUR_") || url.includes("placeholder") || url.trim() === "") {
    throw new Error(
      "[DEMO DB NOT CONFIGURED] DATABASE_URL_DEMO is not configured in .env.\n" +
      "The interactive demo workspace requires a dedicated Neon PostgreSQL database branch ('rangora-demo').\n" +
      "Please set DATABASE_URL_DEMO in your .env file with your demo pooled connection string."
    );
  }

  // Cross-check: Ensure DATABASE_URL_DEMO is not identical to production DATABASE_URL
  const prodUrl = typeof process !== "undefined" ? process.env["DATABASE_URL"] : undefined;
  if (prodUrl && url.trim() === prodUrl.trim()) {
    throw new Error(
      "[CRITICAL SAFETY VIOLATION] DATABASE_URL_DEMO is identical to the production DATABASE_URL!\n" +
      "Demo operations must NEVER run on the production database branch. Aborting immediately."
    );
  }

  const prodDirectUrl = typeof process !== "undefined" ? process.env["DATABASE_URL_DIRECT"] : undefined;
  if (prodDirectUrl && url.trim() === prodDirectUrl.trim()) {
    throw new Error(
      "[CRITICAL SAFETY VIOLATION] DATABASE_URL_DEMO is identical to the production DATABASE_URL_DIRECT!\n" +
      "Demo operations must NEVER run on the production database branch. Aborting immediately."
    );
  }

  return url.trim();
}

export interface DemoVerificationResult {
  verified: boolean;
  database: string;
  user: string;
  version: string;
  timelineId: string;
  isPooler: boolean;
  endpointPrefix: string;
}

let _demoSql: ReturnType<typeof postgres> | null = null;
let _demoDb: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _verifiedTimelineId: string | null = null;

/**
 * Verifies that the connected demo database is healthy and strictly distinct
 * from the production database branch.
 */
export async function verifyDemoTarget(options?: {
  expectTimelineId?: string | undefined;
}): Promise<DemoVerificationResult> {
  const demoUrl = getDemoConnectionString();
  const redacted = redactDemoUrl(demoUrl);

  const testSql = postgres(demoUrl, {
    max: 1,
    connect_timeout: 10,
    idle_timeout: 5,
  });

  try {
    const [dbInfo] = await testSql<
      { current_database: string; current_user: string; version: string }[]
    >`SELECT current_database(), current_user, version()`;

    if (!dbInfo) {
      throw new Error("[TARGET SAFETY ABORT] No database response received from demo target.");
    }

    if (dbInfo.current_database !== "neondb") {
      throw new Error(
        `[TARGET SAFETY ABORT] Expected database 'neondb', but connected to '${dbInfo.current_database}'`
      );
    }

    // Query Neon timeline ID
    const [tl] = await testSql<{ "neon.timeline_id": string }[]>`SHOW neon.timeline_id`;
    const actualTimelineId = tl ? tl["neon.timeline_id"] : null;

    if (!actualTimelineId) {
      throw new Error("[TARGET SAFETY ABORT] Unable to retrieve neon.timeline_id from connected database.");
    }

    // CRITICAL: Reject production timeline ID
    if (actualTimelineId === PRODUCTION_TIMELINE_ID) {
      throw new Error(
        `[CRITICAL TARGET SAFETY ABORT]\n` +
        `DATABASE_URL_DEMO is connected to the PRODUCTION database timeline (${PRODUCTION_TIMELINE_ID})!\n` +
        `Demo operations and sample writes are strictly prohibited on the production branch.\n` +
        `Please ensure DATABASE_URL_DEMO points to the dedicated 'rangora-demo' branch.`
      );
    }

    // Expected timeline check (if configured in env or options)
    const expectedTimeline =
      options?.expectTimelineId ||
      (typeof process !== "undefined" ? process.env["EXPECTED_DEMO_TIMELINE_ID"] : undefined);

    if (expectedTimeline && actualTimelineId !== expectedTimeline) {
      throw new Error(
        `[TARGET SAFETY ABORT]\n` +
        `Demo branch timeline mismatch!\n` +
        `Expected timeline ID:  ${expectedTimeline}\n` +
        `Connected timeline ID: ${actualTimelineId}\n` +
        `Aborting to protect against target branch confusion.`
      );
    }

    _verifiedTimelineId = actualTimelineId;

    return {
      verified: true,
      database: dbInfo.current_database,
      user: dbInfo.current_user,
      version: dbInfo.version.split(" on ")[0] ?? dbInfo.version,
      timelineId: actualTimelineId,
      isPooler: "isPooler" in redacted ? Boolean(redacted.isPooler) : false,
      endpointPrefix: "endpointPrefix" in redacted ? String(redacted.endpointPrefix) : "unknown",
    };
  } finally {
    await testSql.end({ timeout: 5 });
  }
}

/**
 * Returns the verified timeline ID of the demo database, or null if unverified.
 */
export function getVerifiedDemoTimelineId(): string | null {
  return _verifiedTimelineId;
}

/**
 * Returns the Drizzle ORM client for the isolated Neon demo database.
 * Throws a clean, descriptive error if the demo database is not configured.
 */
export function getDemoDb() {
  const connectionString = getDemoConnectionString();

  if (!_demoDb) {
    _demoSql = postgres(connectionString, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    _demoDb = drizzle(_demoSql, { schema });
  }

  return _demoDb;
}

/**
 * Returns the underlying postgres.js SQL client for the isolated Neon demo database.
 */
export function getDemoSql(): ReturnType<typeof postgres> {
  getDemoDb();
  if (!_demoSql) {
    throw new Error("[DEMO DB ERROR] Postgres client failed to initialize.");
  }
  return _demoSql;
}

/**
 * Check whether DATABASE_URL_DEMO is configured in the environment.
 */
export function isDemoDbConfigured(): boolean {
  try {
    getDemoConnectionString();
    return true;
  } catch {
    return false;
  }
}

/**
 * Disconnect and reset client instances (useful during test teardown).
 */
export async function closeDemoDb(): Promise<void> {
  if (_demoSql) {
    await _demoSql.end({ timeout: 5 });
    _demoSql = null;
    _demoDb = null;
    _verifiedTimelineId = null;
  }
}

export { schema };

