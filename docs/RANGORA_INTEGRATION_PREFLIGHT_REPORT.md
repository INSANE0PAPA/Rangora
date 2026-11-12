# Rangora 2.0 — Automated Integration Preflight Audit Report

**Generated:** 2026-11-11  
**Scope:** Automated live integration preflight audit across Supabase Auth, Supabase Storage, Neon PostgreSQL, Google Gemini API, Chatbot readiness, Schema consistency, and Application safety.  
**Operating Mode:** Read-Only Non-Destructive Audit. No migrations executed, no database records modified, and no user accounts touched.

---

## Executive Summary & Status Matrix

| Component / Service | Target | Environment Key(s) | Status | Details |
|:---|:---|:---|:---:|:---|
| **Supabase Auth** | Project Gateway | `VITE_SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | **VERIFIED** | Auth HTTP 200 OK; Project reachable; Publishable key accepted; Session API intact. |
| **Supabase Storage** | Event Echo Bucket | `rangora-event-echo` | **VERIFIED** | Storage API accessible; Bucket exists; Bucket verified **private** (NoSuchBucket on public CDN). |
| **Neon Production DB** | Pooled Instance | `DATABASE_URL` | **VERIFIED** | Connected cleanly to PostgreSQL 18.6 (ac70818); DB: `neondb`; User: `neondb_owner`. Clean DB (0 tables). |
| **Neon Direct DB** | Direct Instance | `DATABASE_URL_DIRECT` | **VERIFIED** | Connected directly (non-pooled) to `neondb` on PostgreSQL 18.6. |
| **Neon Demo DB** | Isolated Demo DB | `DATABASE_URL_DEMO` | **MISSING** | Key absent in `.env`. Safe fallback to persistent `.demo-data/demo-state.json` active. |
| **Gemini API Key** | AI Studio Key | `GEMINI_API_KEY` | **VERIFIED** | Key accepted by Google AI Studio; 50 available models returned via REST API. |
| **Gemini Model** | Model Target | `GEMINI_MODEL` (`gemini-2.5-flash`) | **FAILED** | Google AI Studio returned HTTP 404: `gemini-2.5-flash` retired for new users; recommends update. |
| **Gemini GenAI SDK** | Package Dependency | `@google/genai` | **MISSING** | Neither `@google/genai` nor `@google/generative-ai` installed in `package.json`. |
| **Chatbot Architecture** | Concierge Service | `src/lib/chat.functions.ts` | **CONFIGURED BUT NOT VERIFIED** | UI operational; currently wired to `@lovable.dev/ai-gateway`; awaiting Stage 5 wiring. |
| **Demo Reset Protection**| Admin Auth Secret | `DEMO_RESET_SECRET` | **MISSING** | Variable unset; demo reset fails closed by design (no unauthorized resets possible). |
| **Repository Safety** | Leak Prevention | `.gitignore`, bundles | **VERIFIED** | `.env`, `backup/`, `.demo-data/` excluded in git; 0 database or secret leaks in bundles. |
| **Automated Tests** | Vitest Test Suites | `npm test` | **VERIFIED** | 5/5 test suites passed (47/47 tests green, exit code 0). |
| **TypeScript Typecheck** | Strict Compiler | `npx tsc --noEmit` | **VERIFIED** | 0 errors, exit code 0. |
| **Production Build** | Vite + Nitro SSR | `npm run build` | **VERIFIED** | Client and SSR builds completed cleanly, exit code 0. |

---

## 1. Environment Configuration Audit

Inspection of `.env` and repository root:

- **`.env.example`**: **MISSING**. A template configuration file does not currently exist in the repository root.
- **Variables Audit**:
  - `VITE_SUPABASE_URL`: **CONFIGURED** (HTTPS URL format, 40 chars, points to valid Supabase project).
  - `VITE_SUPABASE_PUBLISHABLE_KEY`: **CONFIGURED** (Modern format `sb_publishable_...`, 46 chars).
  - `SUPABASE_URL`: **CONFIGURED** (HTTPS URL format, identical to client URL).
  - `SUPABASE_PUBLISHABLE_KEY`: **CONFIGURED** (Modern format `sb_publishable_...`, identical to client key).
  - `DATABASE_URL`: **CONFIGURED** (PostgreSQL URI, 151 chars, points to Neon pooled endpoint `-pooler.c-3...neon.tech/neondb`).
  - `DATABASE_URL_DIRECT`: **CONFIGURED** (PostgreSQL URI, 144 chars, points to direct Neon instance `ep-calm-frost...neon.tech/neondb`).
  - `DATABASE_URL_DEMO`: **MISSING** (No dedicated demo database URL configured; defaults safely to server JSON state).
  - `GEMINI_API_KEY`: **CONFIGURED** (Google AI Studio Key, 53 chars, alphanumeric string).
  - `GEMINI_MODEL`: **CONFIGURED** (String value: `gemini-2.5-flash`).
  - `DEMO_RESET_SECRET`: **MISSING** (Fail-closed authorization active).
  - `DEMO_SESSION_SECRET`: **MISSING** (Uses fallback in demo repository).
  - `RANGORA_DEMO_MODE`: **MISSING** in `.env` (Interpreted as `false` for application traffic; `/demo` route runs isolated demo repository).

---

## 2. Supabase Auth Connectivity Audit

- **HTTP Gateway Reachability**: **VERIFIED**. Direct request to `${SUPABASE_URL}/auth/v1/health` with publishable key header returned HTTP 200 OK.
- **Publishable Key Acceptance**: **VERIFIED**. Supabase accepted the modern `sb_publishable_` key format without bearer authorization collision.
- **Client Initialization**: **VERIFIED**. `createClient(url, key)` initialized without runtime errors.
- **Session API**: **VERIFIED**. `supabase.auth.getSession()` executed cleanly with no session anomalies.
- **Auth Endpoint Probe**: **VERIFIED**. Probe authentication request to `supabase.auth.signInWithPassword(...)` returned expected HTTP 400 `Invalid login credentials` (`AuthApiError`), verifying that the authentication service is actively processing requests and accepting project keys. Zero accounts were modified.

---

## 3. Supabase Storage Connectivity Audit

- **Bucket Identification (`rangora-event-echo`)**: **VERIFIED**.
  - Querying `supabase.storage.from('rangora-event-echo').list('', { limit: 1 })` returned HTTP 200 OK with `fileCount: 0`. The bucket exists and is reachable through the Storage API.
- **Bucket Privacy Enforcement**: **VERIFIED**.
  - Attempting to access the bucket through the public CDN endpoint (`/storage/v1/object/public/rangora-event-echo/test-file.jpg`) returned:
    `HTTP 400 Bad Request: NoSuchBucket / Bucket not found or private`.
  - This proves the bucket is strictly configured as **private** and protected against unauthorized public file scraping.
- **Signed URL Workflow**: **VERIFIED**.
  - Calling `createSignedUrl('test-nonexistent.jpg', 60)` returned `error: "Object not found"`. This verifies that the Storage service authenticated the request, resolved the bucket, and rejected only the nonexistent file path.

---

## 4. Neon PostgreSQL Connectivity Audit

Live safe read-only SQL queries were executed against Neon:

```sql
SELECT current_database(), current_user, NOW(), version();
```

### A. Production Connection (`DATABASE_URL` — Pooled)
- **Status**: **VERIFIED**
- **Connected Host**: `ep-calm-frost-...-pooler.c-3.neon.tech`
- **Database Name**: `neondb`
- **Connected Role**: `neondb_owner`
- **Server Engine**: `PostgreSQL 18.6 (ac70818)`
- **Current Tables in `public`**: **0 tables** (`tables: []`).
- **Extensions Installed**: `plpgsql` (1.0). `pgvector` is not yet installed.
- **Finding**: The database connection string is fully functional. The database itself is a fresh, pristine instance awaiting migration.

### B. Direct Connection (`DATABASE_URL_DIRECT` — Direct)
- **Status**: **VERIFIED**
- **Connected Host**: `ep-calm-frost-...neon.tech` (direct non-pooled port 5432)
- **Database Name**: `neondb`
- **Connected Role**: `neondb_owner`
- **Server Engine**: `PostgreSQL 18.6 (ac70818)`
- **Finding**: Direct migration-ready connection is fully functional.

### C. Demo Connection (`DATABASE_URL_DEMO`)
- **Status**: **MISSING / BLOCKED**
- **Finding**: `DATABASE_URL_DEMO` is not defined in `.env`.
- **Safety Mechanism**: The application safely isolates demo activity inside `.demo-data/demo-state.json`. Live production tables will not be contaminated with demo data.

---

## 5. Google Gemini API & Model Verification

### A. API Key Validity
- **Status**: **VERIFIED**
- **Result**: Sending a request to `https://generativelanguage.googleapis.com/v1beta/models?key=...` returned **HTTP 200 OK**.
- **Model Inventory**: Google AI Studio confirmed the key is active and returned **50 available models** associated with the account.

### B. Configured Model (`GEMINI_MODEL=gemini-2.5-flash`)
- **Status**: **FAILED**
- **Result**: Generation request to `gemini-2.5-flash` returned:
  ```json
  {
    "code": 404,
    "status": "NOT_FOUND",
    "message": "This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.8-flash for the latest features and improvements. We recommend you to use the Interactions API (https://aistudio.google.com/docs/get-started)."
  }
  ```
- **Finding**: Google AI Studio has deprecated new-user access to the older `gemini-2.5-flash` endpoint identifier.
- **Recommended Action**: Update `GEMINI_MODEL` in `.env` to a supported active model such as `gemini-1.5-flash`, `gemini-flash-latest`, or `gemini-3.8-flash`.

### C. SDK Installation Status
- **Status**: **MISSING**
- **Finding**: Neither `@google/genai` nor `@google/generative-ai` is currently installed in `package.json`. The package must be added during Stage 5 implementation.

---

## 6. Existing Chatbot Inspection

- **File Inspected**: [`src/lib/chat.functions.ts`](file:///d:/Rangora%202.0/src/lib/chat.functions.ts)
  - **Current AI Provider**: `@lovable.dev/ai-gateway` calling `openai/gpt-6-astra`.
  - **Context Strategy**: Injects a static string mapping `catalog.festivals` and `catalog.events`.
  - **Validation Note**: Uses deprecated `createServerFn().inputValidator(...)` instead of `.validator(...)`.
- **File Inspected**: [`src/components/Chatbot.tsx`](file:///d:/Rangora%202.0/src/components/Chatbot.tsx)
  - **Chatbot UI**: Fully operational floating launcher with message bubbles, suggestion chips, and responsive layout.
- **Tool Functions Readiness**:
  - `search_events`: Exists in domain layer ([`src/lib/api.functions.ts`](file:///d:/Rangora%202.0/src/lib/api.functions.ts#L330)), not yet wrapped as a Gemini function tool.
  - `get_event_details`: Exists in domain layer ([`src/lib/api.functions.ts`](file:///d:/Rangora%202.0/src/lib/api.functions.ts#L365)), not yet wrapped.
  - `get_live_seat_availability`: Exists in domain layer ([`src/lib/api.functions.ts`](file:///d:/Rangora%202.0/src/lib/api.functions.ts#L410)), not yet wrapped.
  - `get_my_registration_status`: Exists in domain layer, requires session-scoped wrapper.
  - `get_my_itinerary`: Exists in domain layer, requires session-scoped wrapper.
  - `check_my_schedule_conflicts`: Exists in domain rules ([`src/lib/role-rules.ts`](file:///d:/Rangora%202.0/src/lib/role-rules.ts)), requires wrapper.
  - `search_rangora_faq`: Defined in [`docs/gemini-chatbot-handoff.md`](file:///d:/Rangora%202.0/docs/gemini-chatbot-handoff.md), requires implementation.
  - `get_my_vouchers`: Exists in domain layer, requires session-scoped wrapper.
- **Stage 5 Work Remaining**:
  1. Install official `@google/genai` SDK.
  2. Implement `src/lib/gemini-tools.ts` containing the 8 read-only analytical queries against Neon / demo repository.
  3. Wire the tool calling loop in `src/lib/chat.functions.ts`.
  4. Implement client confirmation dialog/button for consequential actions.

---

## 7. Database & Project Safety Audit

1. **Table Schema Synchronization**: **VERIFIED**.
   - Exactly **21 domain tables** defined in [`drizzle/schema.ts`](file:///d:/Rangora%202.0/drizzle/schema.ts).
   - Exactly **21 domain tables** defined in [`drizzle/migrations/0007_neon_complete_schema_and_functions.sql`](file:///d:/Rangora%202.0/drizzle/migrations/0007_neon_complete_schema_and_functions.sql).
2. **Seed Coverage**: **VERIFIED**.
   - [`drizzle/migrations/0008_neon_seed_catalogue_data.sql`](file:///d:/Rangora%202.0/drizzle/migrations/0008_neon_seed_catalogue_data.sql) contains idempotent `ON CONFLICT DO UPDATE` seed logic for 8 categories, 6 festivals, 13 badges/achievements, and 5 voucher campaigns.
3. **Repository Secret Protection**: **VERIFIED**.
   - `.gitignore` explicitly excludes `.env`, `.env.*`, `backup/`, and `.demo-data/`.
4. **Client Bundle Leak Audit**: **VERIFIED**.
   - Inspection of client production bundles (`.output/public/assets/*.js`) confirmed **zero** occurrences of `postgres://`, `DATABASE_URL`, or `GEMINI_API_KEY`.
   - Private environment variables remain strictly isolated to server functions.

---

## 8. Application Build & Test Results

```
1. Automated Tests (npm test):
   RUN  v4.1.11 D:/Rangora 2.0
   ✓ src/test/demo-repository.test.ts (9 tests)
   ✓ src/test/demo-journeys.test.ts (9 tests)
   ✓ src/test/event-pulse.test.ts (23 tests)
   ✓ src/test/role-rules.test.ts (4 tests)
   ✓ src/test/app-routing.test.tsx (2 tests)
   Test Files: 5 passed (5)
   Tests:      47 passed (47)
   Exit Code:  0

2. TypeScript Typecheck (npx tsc --noEmit):
   Status:     0 errors
   Exit Code:  0

3. Production Build (npm run build):
   Status:     Client, SSR, and Nitro server bundles generated cleanly
   Exit Code:  0
```

---

## 9. Actionable Next Steps Required from Shrijit

To complete the setup and prepare for Stage 5:

1. **Update `GEMINI_MODEL` in `.env`**:
   Replace `GEMINI_MODEL=gemini-2.5-flash` with a currently active model in your Google AI Studio account (e.g., `gemini-1.5-flash` or `gemini-3.8-flash`).
2. **Apply Neon Database Migrations (When ready)**:
   The Neon database is verified online but contains 0 tables. When you wish to migrate the live schema, run migration `0007_neon_complete_schema_and_functions.sql` and `0008_neon_seed_catalogue_data.sql` via Drizzle Kit or direct SQL execution against `DATABASE_URL_DIRECT`.
3. **Configure Demo Protection Secrets (Optional)**:
   Add `DEMO_RESET_SECRET=...` in `.env` if you wish to enable authorized remote demo workspace resets.
4. **Add Dedicated Demo Branch (Optional)**:
   If you create a separate Neon database branch for the demo, supply `DATABASE_URL_DEMO=...` in `.env`. Otherwise, the local JSON state will continue serving the interactive demo safely.
5. **Create `.env.example`**:
   Add a sanitized `.env.example` template to the repository for documentation.

---

*Report filed at `docs/RANGORA_INTEGRATION_PREFLIGHT_REPORT.md`.*

