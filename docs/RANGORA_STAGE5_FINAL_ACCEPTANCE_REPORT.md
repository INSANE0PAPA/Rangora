# Rangora 2.0 — Stage 5 Final Acceptance & Chatbot Integration Audit Report

**Date**: November 12, 2026  
**Status**: ACCEPTED & COMPLETED  
**Scope**: Stage 5 — Gemini Chatbot Integration, Security Verification & Production Neon Parity  
**Target Neon Database**: Production Timeline `ff6dc35ad13680c0a665fbd20e4d4876` (`neondb`)  

---

## Executive Summary

Stage 5 of the Rangora 2.0 campus festival platform has achieved full acceptance. The legacy chatbot relying on `@lovable.dev/ai-gateway` has been completely replaced with an enterprise-grade AI architecture powered by the official `@google/genai` SDK (version 3.1.0).

All 8 domain tools, the consequential action proposal mechanism, cryptographic Supabase authentication verification, sliding-window rate limiting, and the primary/fallback model orchestration (`gemini-3.8-flash` primary, `gemini-3.7-flash` fallback) have been implemented, tested, and validated.

All quality gates passed with zero regressions:
- **Test Suite**: 12/12 test files, 120/120 tests passing (100% GREEN).
- **TypeScript Typecheck**: 0 errors (`npx tsc --noEmit`).
- **Production Build**: Clean client (`.output/public/`) and Nitro SSR (`.output/server/`) builds.
- **Production Safety**: Zero database mutations; 21 domain tables, 5 business triggers, and 38 seeded events remain intact and untampered.

---

## 1. Authentication Security Audit

The authentication security model of the Rangora Gemini chatbot was audited across `src/lib/chat.functions.ts`, `src/lib/gemini-tools.ts`, `src/lib/auth-middleware.ts`, and `src/components/Chatbot.tsx`.

### 1.1 Cryptographic Token Verification
- **Mechanism**: The server extracts the Supabase bearer token from `data.authToken` and passes it to `supabase.auth.getClaims(token)`.
- **Cryptographic Enforcement**: Unlike naive `jwt.decode()` implementations that trust unverified header/payload data, `supabase.auth.getClaims()` cryptographically verifies the signature against the Supabase Auth project key and enforces expiration timestamps (`exp`).
- **Audit Verification**:
  - Valid tokens extract verified identity (`sub` claim mapped to `userId`).
  - Tampered signatures return `data: null` and `error: AuthApiError: invalid JWT: signature is invalid`.
  - Expired tokens return `data: null` and `error: AuthApiError: invalid JWT: token is expired`.
  - Validated by unit test suite `src/test/auth-verification.test.ts` (2/2 passing).

### 1.2 Session Identity Derivation & Parameter Isolation
- **Model Inability to Override `userId`**: The Gemini model is never provided with `userId` as an input parameter in any tool declaration. All tool parameters (`eventId`, `query`, `categoryId`, etc.) exclude user identifiers.
- **Context Injection**: The verified `userId` is injected strictly by the server runtime into the execution context (`ToolContext.userId`).
- **Ownership Isolation**:
  - `get_my_registration_status`: Queries `registrations` where `userId = context.userId`.
  - `get_my_itinerary`: Queries `registrations` and `events` where `userId = context.userId`.
  - `check_my_schedule_conflicts`: Analyzes bookings belonging exclusively to `context.userId`.
  - `get_my_vouchers`: Queries `user_vouchers` where `userId = context.userId`.
- **Unauthenticated Participant Handling**:
  - When `context.userId` is `null`, personalized tools return `{ authenticated: false, message: "Please sign in to view your..." }`.
  - No private data, pass codes, or itineraries can ever leak to unauthenticated callers.

---

## 2. Gemini Model Configuration and Fallback Policy

### 2.1 Configuration & SDK Integration
- **SDK**: Official `@google/genai` version 3.1.0 (`import { GoogleGenAI } from "@google/genai"`).
- **API Version**: `v1beta` endpoint (`httpOptions: { apiVersion: 'v1beta', timeout: 15000 }`), required for Gemini 3.x Flash series.
- **Environment Configuration**:
  - Primary Model: `GEMINI_MODEL=gemini-3.8-flash` (default in `.env` and `.env.example`).
  - Fallback Model: `GEMINI_FALLBACK_MODEL=gemini-3.7-flash` (default in `.env` and `.env.example`).
  - Zero hardcoded API keys; strictly sourced from `process.env["GEMINI_API_KEY"]`.

### 2.2 Strict Fallback Policy
The fallback model chain is strictly bounded to `[GEMINI_MODEL, GEMINI_FALLBACK_MODEL]`:
- **Transient Provider Errors (Fallback Permitted)**:
  - HTTP `429` (Rate limit or daily quota exhaustion).
  - HTTP `503` (Transient model overload / "high demand").
  - Request timeouts (>15 seconds).
- **Non-Transient Errors (Fallback Prohibited & Immediate Abort)**:
  - HTTP `400` (Bad request / invalid argument schemas).
  - HTTP `401` / `403` (Invalid API key or unauthorized access).
  - Client parameter errors.
- **No Hidden Alternatives**: The architecture completely avoids falling back to preview models (such as experimental checkpoints) or hidden hardcoded alternatives. If both configured models fail transiently, the system returns a polite campus desk notification.

### 2.3 Provider Behaviors & Findings
1. **Free Tier Daily Quota Limit**: `gemini-3.8-flash` on the Google AI Studio free tier enforces a strict limit of 20 requests per day per project. When exhausted, the provider returns `429 RESOURCE_EXHAUSTED`. The implemented fallback chain cleanly captures this and cascades to `gemini-3.7-flash`.
2. **Thought Signature Requirement**: In multi-turn function calling with Gemini 3.x Flash, synthesizing partial `functionCall` objects without the model's generated `thought_signature` causes HTTP `400: Function call is missing a thought_signature`. The implementation resolves this by preserving `candidate.content` verbatim in the multi-turn conversation history.

---

## 3. Eight-Tool Implementation & Neon Data Parity

All eight domain tools plus the consequential action proposal tool were implemented in `src/lib/gemini-tools.ts` and tested against live Neon database tables:

| # | Tool Name | Scope & Canonical Data Source | Live Neon Query Validation |
|---|---|---|---|
| 1 | `search_events` | Queries `schema.events`, `schema.categories`, `schema.festivals`, `schema.registrations`. Filters by query, category ID, festival ID, maximum price, and available seats. | Verified against 38 seeded events. Price filter (`<= 100`) returned 21 matching events. |
| 2 | `get_event_details` | Queries `schema.events`, `schema.categories`, `schema.festivals`, `schema.registrations`. Returns full description, venue, ISO 8601 timings, pricing, maximum seats, and terms. | Verified on Event #1 (`Dusk Raga`) and Event #4 (`Mitti & Indigo`). |
| 3 | `get_live_seat_availability` | Computes live capacity ratio (`bookedSeats / maxSeats`) and determines Seat Pulse status (`available`, `warm`, `critical`, `sold_out`). | Verified on Event #4 (`maxSeats: 5`, status: `available` under 0 bookings). |
| 4 | `get_my_registration_status` | Queries `schema.registrations` and `schema.attendance` for `context.userId` and `args.eventId`. | Verified: returns `registered: false` for unbooked events; rejects unauthenticated callers. |
| 5 | `get_my_itinerary` | Joins `schema.registrations` with `schema.events` for `context.userId`. Formats dates, venues, pass codes. | Verified: returns clean chronological schedule for authenticated user; rejects unauthenticated callers. |
| 6 | `check_my_schedule_conflicts` | Compares time intervals `[startAt, endAt]` for all confirmed passes belonging to `context.userId`. | Verified: reports 0 conflicts when passes do not overlap; provides rescue advice when overlapping. |
| 7 | `search_rangora_faq` | Queries curated campus policy database covering passes, ticketing, venue directions, and Event Echo guidelines. | Verified: queries for "Echo" correctly return verified attendance and consent guidelines. |
| 8 | `get_my_vouchers` | Queries `schema.userVouchers` and `schema.voucherCampaigns` for `context.userId`. | Verified: returns personalized list of voucher codes, discounts, and expiration dates. |
| 9 | `propose_consequential_action` | Consequential action proposal pattern. Generates structured proposal for pass booking, pass cancellation, or voucher redemption. | Verified: generates structured proposal requiring user click confirmation rather than executing direct mutations. |

### 3.1 Strict Argument Validation
All tool invocations parse incoming arguments through Zod schemas before running any database logic:
- Invalid types (e.g. string passed as `eventId`) throw Zod validation errors immediately.
- Queries are sanitized and parameter-bound via Drizzle ORM, completely eliminating SQL injection vectors.

---

## 4. Chatbot UI and Conversational Experience Audit

The UI implementation in `src/components/Chatbot.tsx` was verified in both desktop and mobile viewports:
- **Widget Launcher**: Floating action button with accessible `aria-label="Open Rangora chat"` located at the bottom-right corner.
- **Visual Parity**: Preserves warm terracotta styling, dark background cards, translucent glassmorphism borders, and compact message bubbles.
- **Suggestion Chips**: 3 initial quick-prompts ("What events are coming up?", "How do Event Echoes work?", "How can I organise an event?") populate the input on click.
- **Input Bounds & Safety**:
  - `maxLength={1200}` enforced on the text area.
  - Submit disabled during pending inference (`busy` state).
  - Loading indicator with pulse animation while awaiting model responses.
- **Conversational Scenarios (A - E) Test Results**:
  - **Scenario A** ("Find upcoming robotics events."): Tool `search_events` executed with query `robot` -> returns robotics events in Foundry Makerspace. (PASSED)
  - **Scenario B** ("Show me details about this event."): Tool `get_event_details` executed with event ID -> returns comprehensive details, timing, venue, terms. (PASSED)
  - **Scenario C** ("How many seats are still available?"): Tool `get_live_seat_availability` executed -> returns live Seat Pulse capacity, remaining seats, and status badge. (PASSED)
  - **Scenario D** ("What is the difference between a registration and verified attendance?"): Tool `search_rangora_faq` executed -> explains registration is booking pass, while attendance requires on-site QR verification needed to post Event Echoes. (PASSED)
  - **Scenario E** (Unauthenticated: "Show me my registrations."): Tool `get_my_registration_status` detects `userId = null` -> politely prompts user to sign in without leaking data. (PASSED)

---

## 5. Security & Deployment Audit

1. **Client Bundle Credential Protection**:
   - Inspected `.output/public/` client chunks: 0 occurrences of `GEMINI_API_KEY`, 0 occurrences of `postgresql://`, 0 occurrences of `@google/genai`.
   - The `@google/genai` SDK and Drizzle database drivers are bundled strictly within `.output/server/` SSR chunks.
2. **No Arbitrary SQL Execution**:
   - No generic SQL execution tool exists.
   - The model can only invoke the 8 declared domain tools and the action proposer.
3. **Sliding-Window Rate Limiting**:
   - In-memory rate limiter enforces a sliding window limit of 15 requests per 60 seconds per client identifier.
   - Requests exceeding this threshold receive a rate-limit notice without consuming Gemini quota.
4. **Log Privacy & Data Protection**:
   - Server logs do not print user passwords, tokens, full JWT payloads, or PII.
   - Database connection strings are never emitted in logs or client-facing errors.

---

## 6. Verification and Quality Gates Summary

### 6.1 Test Suite Execution
Command: `npm test`  
Result: **12/12 Test Files Passed, 120/120 Tests Passed**

```text
 ✓ src/test/neon-live-eight-tools.test.ts (17 tests)
 ✓ src/test/gemini-chatbot.test.ts (22 tests)
 ✓ src/test/gemini-models-dual-probe.test.ts (7 tests)
 ✓ src/test/gemini-live-server.test.ts (2 tests)
 ✓ src/test/chatbot-ui-and-scenarios.test.tsx (8 tests)
 ✓ src/test/event-pulse.test.ts (23 tests)
 ✓ src/test/demo-journeys.test.ts (9 tests)
 ✓ src/test/migration-runner.test.ts (15 tests)
 ✓ src/test/demo-repository.test.ts (9 tests)
 ✓ src/test/app-routing.test.tsx (2 tests)
 ✓ src/test/auth-verification.test.ts (2 tests)
 ✓ src/test/role-rules.test.ts (4 tests)

Test Files  12 passed (12)
Tests       120 passed (120)
```

### 6.2 TypeScript Compilation
Command: `npx tsc --noEmit`  
Result: **0 Errors** (Code 0)

### 6.3 Production Application Build
Command: `npm run build`  
Result: **Successful Vite + Nitro Build** (Code 0)
- Client bundle (`.output/public/`): 2200 modules transformed, 0 bundle leaks.
- Server bundle (`.output/server/`): Nitro server worker generated with `@google/genai` and Neon database drivers.

---

## 7. Stage 5 Sign-Off & Conclusion

Stage 5 (Neon Migration Validation & Gemini Chatbot Implementation) is hereby **CLOSED & FULLY ACCEPTED**.

The Rangora 2.0 application features:
1. Canonical 21-table production schema on Neon (`ff6dc35ad13680c0a665fbd20e4d4876`).
2. Five automated database triggers and 38 seeded campus events.
3. Official `@google/genai` v3.1.0 integration on `v1beta`.
4. Eight secure domain tools and consequential action proposals.
5. Cryptographic Supabase token verification and ownership isolation.
6. 100% test pass rate across 120 unit, integration, and scenario tests.

