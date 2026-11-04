import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../../drizzle/schema";

const connectionString =
  (typeof process !== "undefined" && process.env["DATABASE_URL"]) ||
  (typeof process !== "undefined" && process.env["DATABASE_URL_DIRECT"]) ||
  "";

export const isNeonConfigured = Boolean(
  connectionString &&
  !connectionString.includes("YOUR_NEON") &&
  !connectionString.includes("placeholder")
);

// Lazy client initialization so missing credentials don't crash startup
let _sql: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!isNeonConfigured) {
    return null;
  }
  if (!_db) {
    _sql = postgres(connectionString, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    _db = drizzle(_sql, { schema });
  }
  return _db;
}

export { schema };
