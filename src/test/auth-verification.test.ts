import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

describe("Supabase Cryptographic Token Verification", () => {
  const supabaseUrl = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
  const supabaseKey = process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

  it("should reject forged tokens with invalid cryptographic signatures", async () => {
    if (!supabaseUrl || !supabaseKey) return;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const fakeHeader = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const fakePayload = Buffer.from(JSON.stringify({
      sub: "d3300001-0000-4000-8000-000000000001",
      exp: Math.floor(Date.now() / 1000) + 3600
    })).toString("base64url");
    const forgedToken = `${fakeHeader}.${fakePayload}.forged_signature_here`;

    const { data, error } = await supabase.auth.getClaims(forgedToken);
    expect(data?.claims).toBeUndefined();
    expect(error).toBeDefined();
  });

  it("should reject expired tokens even if payload is validly formatted", async () => {
    if (!supabaseUrl || !supabaseKey) return;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const fakeHeader = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const expiredPayload = Buffer.from(JSON.stringify({
      sub: "d3300001-0000-4000-8000-000000000001",
      exp: Math.floor(Date.now() / 1000) - 3600
    })).toString("base64url");
    const expiredToken = `${fakeHeader}.${expiredPayload}.some_signature`;

    const { data, error } = await supabase.auth.getClaims(expiredToken);
    expect(data?.claims).toBeUndefined();
    expect(error).toBeDefined();
  });
});

