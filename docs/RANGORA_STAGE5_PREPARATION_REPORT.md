# Rangora 2.0 — Stage 5 Preparation: Neon Migration Validation Report

**Date:** 2026-11-11  
**Scope:** Migration validation, SQL integrity verification, non-destructive Neon audit, and Gemini integration roadmap.  
**Mode:** Read-only inspection & preparation. Zero migrations executed against Neon; zero application records modified.

---

## 1. Migration Validation Results

### Table Inventory Reconciliation
An exhaustive comparison between TypeScript ORM definitions in [`drizzle/schema.ts`](file:///d:/Rangora%202.0/drizzle/schema.ts) and DDL statements in [`drizzle/migrations/0007_neon_complete_schema_and_functions.sql`](file:///d:/Rangora%202.0/drizzle/migrations/0007_neon_complete_schema_and_functions.sql) reveals a **100% exact match across all 21 domain tables**:

1. `profiles` (9 columns) — Stores participant/campus identities (keyed by Supabase Auth UUID).
2. `user_roles` (3 columns) — Multi-role assignment (`participant`, `organizer`, `admin`) with unique `(user_id, role)`.
3. `organiser_profiles` (10 columns) — Organiser vetting applications with `status IN ('pending', 'approved', 'rejected')`.
4. `admin_profiles` (6 columns) — Administrative office identities.
5. `categories` (5 columns) — Event category taxonomy.
6. `festivals` (9 columns) — Umbrella campus festivals (`IDENTITY START WITH 100`).
7. `events` (18 columns) — Festival events, seat caps, venues, schedules (`IDENTITY START WITH 1000`).
8. `registrations` (6 columns) — ACID pass bookings and schedule items with unique `(user_id, event_id)`.
9. `attendance` (6 columns) — Door check-in verification records with unique `(user_id, event_id)`.
10. `achievements` (6 columns) — Platform-wide badges and quests.
11. `user_achievements` (3 columns) — Earned user achievements (`PRIMARY KEY (user_id, code)`).
12. `event_badges` (8 columns) — Custom badges minted by organisers.
13. `user_event_badges` (3 columns) — Badges awarded to attendees (`PRIMARY KEY (user_id, badge_id)`).
14. `voucher_campaigns` (7 columns) — Reward discount campaigns with stock limits.
15. `user_vouchers` (5 columns) — Claimed voucher codes with unique `(user_id, campaign_id)`.
16. `reviews` (12 columns) — Event Echo memories with default `visibility = 'private'` and `moderation_status`.
17. `review_likes` (3 columns) — Organiser picks and community likes (`PRIMARY KEY (review_id, user_id)`).
18. `sponsors` (11 columns) — Campus sponsorship proposals.
19. `help_requests` (11 columns) — Support tickets routed to event organisers.
20. `reward_awards` (9 columns) — Manual administrator point allocations.
21. `leaderboard` (5 columns) — Real-time campus point rankings.

### Constraints, Triggers & Syntax Audit
- **Primary & Foreign Keys**: Foreign keys are ordered sequentially so every referenced table exists before it is referenced.
- **Triggers**: All 5 business triggers in `0007` are syntactically valid PL/pgSQL:
  - `events_no_clash_trigger`: Prevents scheduling overlaps for the same organiser using native `tstzrange` operations.
  - `route_help_request_trigger`: Automatically routes support inquiries to the designated event organiser.
  - `registrations_capacity_trigger`: Prevents overbooking by verifying available seat capacity before row insertion.
  - `organiser_review_sync_trigger`: Automatically adds or removes the `'organizer'` role in `user_roles` when status transitions to/from `'approved'`.
  - `profiles_sync_leaderboard_trigger`: Keeps the public leaderboard display name and department in sync with profile edits.

---

## 2. SQL & Schema Mismatches Found and Corrected

### Discovered Omission in Seed Data (Corrected)
- **Problem**: Inspection of [`drizzle/migrations/0008_neon_seed_catalogue_data.sql`](file:///d:/Rangora%202.0/drizzle/migrations/0008_neon_seed_catalogue_data.sql) revealed that while categories (8), festivals (6), achievements (13), and voucher campaigns (5) were present, the **38 canonical flagship events** from [`src/data/catalog.ts`](file:///d:/Rangora%202.0/src/data/catalog.ts) were omitted.
- **Correction Applied**: Generated and appended the complete 38-event catalogue insert into `0008_neon_seed_catalogue_data.sql` with full foreign-key alignment and idempotent `ON CONFLICT (id) DO UPDATE SET ...` syntax.
- **Result**: Migration `0008` now populates the complete intended festival catalogue, ensuring events are present immediately upon running migrations on Neon.

---

## 3. Fresh Database Safety Verification

- **Is 0007 safe for a fresh empty database?**: **YES**.
  - All object creation statements use `IF NOT EXISTS` or exception-handled `DO $$ BEGIN ... END $$;`.
  - No foreign keys reference nonexistent tables.
  - Triggers and functions drop existing names before creating (`DROP TRIGGER IF EXISTS ...`).
  - No Supabase-internal dependencies (`auth.users`) are required in Neon; user IDs are stored as standard `uuid` columns.
- **Is 0008 genuinely idempotent?**: **YES**.
  - Every `INSERT` statement specifies an explicit `ON CONFLICT (...) DO UPDATE` clause. Running migration 0008 multiple times will never produce duplicate records or unique constraint violations.
- **Data Preservation Guarantee**: Zero `DROP TABLE`, `TRUNCATE`, or destructive data manipulations exist in either migration file.

---

## 4. Non-Destructive Live Database Status (`DATABASE_URL_DIRECT`)

A live read-only inspection query was executed directly against Neon:

```json
{
  "database": "neondb",
  "user": "neondb_owner",
  "version": "PostgreSQL 18.6 (ac70818) on aarch64-unknown-linux-gnu",
  "schemas": ["public", "information_schema", "pg_catalog", "pg_toast"],
  "publicTablesCount": 0,
  "publicTables": [],
  "extensions": [
    { "name": "plpgsql", "version": "1.0" }
  ],
  "drizzleMigrationTracking": []
}
```

- **Database State**: Fully operational, empty (0 public tables), ready to receive migrations upon approval.
- **Zero Modifications**: No DDL or DML statements were executed on Neon during this inspection.

---

## 5. Execution Commands to Apply Migrations (Post-Approval)

When you approve applying the migrations to Neon, use either of the following verified workflows:

### Option A: Using Drizzle Kit (Standard)
```bash
npx drizzle-kit migrate
```
*(Uses `DATABASE_URL_DIRECT` configured in `drizzle.config.ts`)*

### Option B: Using Direct SQL Runner
```bash
# Apply Schema & Functions
psql "%DATABASE_URL_DIRECT%" -f drizzle/migrations/0007_neon_complete_schema_and_functions.sql

# Apply Complete Catalogue Seed
psql "%DATABASE_URL_DIRECT%" -f drizzle/migrations/0008_neon_seed_catalogue_data.sql
```

---

## 6. Gemini Integration Roadmap & Plan

### Architecture Overview
1. **Model Identifier**: Updated to `GEMINI_MODEL=gemini-3.8-flash` in `.env`. The model remains runtime-configurable via `process.env.GEMINI_MODEL`.
2. **Security**: The Gemini API key remains strictly server-side (`GEMINI_API_KEY`). No `VITE_` prefix, no client bundle leakage.
3. **UI Preservation**: The existing [`src/components/Chatbot.tsx`](file:///d:/Rangora%202.0/src/components/Chatbot.tsx) remains operational and intact.
4. **Tool Timing**: Database-dependent Gemini tools will only be wired to live Neon queries **after** the Neon migrations have been applied and verified.

### Implementation Checklist for Stage 5:
- [ ] Install `@google/genai` official SDK:
  ```bash
  npm install @google/genai
  ```
- [ ] Replace `@lovable.dev/ai-gateway` in [`src/lib/chat.functions.ts`](file:///d:/Rangora%202.0/src/lib/chat.functions.ts) with `GoogleGenAI` server-side client.
- [ ] Modernize TanStack Start server function validator:
  Replace deprecated `.inputValidator(...)` with `.validator(...)`.
- [ ] Add sliding-window in-memory rate limiter (15 requests/minute).
- [ ] Add fail-closed fallback for provider errors or 503 high-demand spikes.
- [ ] Create `src/lib/gemini-tools.ts` implementing the 8 approved analytical queries with strict user session scoping.

---

## 7. Verification & Build Results

All local changes (catalogue event seed addition in `0008` and deterministic test isolation in `vitest.config.ts`) were verified:

- **Automated Tests (`npm test`)**: **47/47 passing** across 5 test suites (exit code 0).
- **TypeScript Check (`npx tsc --noEmit`)**: **0 errors** (exit code 0).
- **Production Build (`npm run build`)**: **Built cleanly** for client, SSR, and Nitro server (exit code 0).
- **Zero Blockers**: Repository is fully prepared for Neon migration execution and Stage 5 Gemini integration.

