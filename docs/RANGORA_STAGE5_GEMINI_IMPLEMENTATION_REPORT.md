# Rangora 2.0 — Stage 5C: Gemini Chatbot Implementation Report

**Implementation Date:** 2026-11-12  
**Status:** **COMPLETED & VERIFIED**  
**Integration Type:** Official `@google/genai` SDK (v3.1.0) Server-Side Function Calling  
**Primary Model:** `gemini-3.8-flash`  
**Configured Fallback Model:** `gemini-3.7-flash`  
**Active Production Fallback:** `gemini-3-flash-preview`  
**API Endpoint Protocol:** `v1beta` (via `httpOptions: { apiVersion: 'v1beta', timeout: 15000 }`)  
**Database Backend:** Neon PostgreSQL (21 public domain tables, 38 events, triggers & indexes)  
**Security Boundary:** 100% Server-Side execution. Zero Gemini keys or DB credentials exposed in browser bundles.

---

## 1. Executive Summary

The Rangora AI campus festival concierge has been integrated using the official Google GenAI SDK (`@google/genai`). All dependency on the legacy `@lovable.dev/ai-gateway` has been removed from the application's chat execution path.

The chatbot UI widget (`src/components/Chatbot.tsx`) has been preserved, maintaining:
- Floating launcher and responsive chat modal.
- Message feed, auto-scroll, and accessibility announcements (`aria-live="polite"`).
- Suggestion chips ("What events are coming up?", "How do Event Echoes work?", etc.).
- Input character bounds ($\le 1200$ chars) and message history caps ($\le 10$ messages).
- Error boundaries and retry states.

All eight canonical domain tools defined in the technical handoff guide have been implemented with server-side validation, live Neon PostgreSQL queries (with safe fallback to the isolated demo repository), and strict Supabase Auth session isolation for participant-specific operations.

---

## 2. Files Modified and Created

| File | Purpose / Change Description |
|:---|:---|
| [`src/lib/gemini-tools.ts`](file:///D:/Rangora%202.0/src/lib/gemini-tools.ts) | Created complete Eight Tools suite + `propose_consequential_action`. Full Zod argument schemas, official GenAI `Type` declarations, and live Neon Drizzle queries. |
| [`src/lib/chat.functions.ts`](file:///D:/Rangora%202.0/src/lib/chat.functions.ts) | Replaced Lovable AI Gateway with official `@google/genai` multi-turn loop. Added session authentication extraction, client rate limiting, model fallback chain, and error handling. |
| [`.env`](file:///D:/Rangora%202.0/.env) | Configured `GEMINI_FALLBACK_MODEL=gemini-3.7-flash` alongside `GEMINI_MODEL=gemini-3.8-flash` and `GEMINI_API_KEY`. |
| [`.env.example`](file:///D:/Rangora%202.0/.env.example) | Updated template documenting `GEMINI_MODEL` and `GEMINI_FALLBACK_MODEL` environment variables. |
| [`src/test/gemini-chatbot.test.ts`](file:///D:/Rangora%202.0/src/test/gemini-chatbot.test.ts) | Comprehensive test suite (22 unit tests) verifying search, details, seat pulse, unauthenticated rejection, ownership isolation, FAQ, and proposals. |
| [`src/test/gemini-live-server.test.ts`](file:///D:/Rangora%202.0/src/test/gemini-live-server.test.ts) | Server-side integration test verifying live model invocation, tool calling loop, and leak-free output. |
| [`docs/RANGORA_STAGE5_GEMINI_IMPLEMENTATION_REPORT.md`](file:///D:/Rangora%202.0/docs/RANGORA_STAGE5_GEMINI_IMPLEMENTATION_REPORT.md) | Official Stage 5C implementation deliverable. |

---

## 3. Official `@google/genai` SDK and Model Configuration

### Model Probing and Discovery Findings
During pre-implementation probes using Google AI Studio:
1. `gemini-3.8-flash` (Primary): Available in the developer's Google AI Studio account. Emits thinking tokens and function calls. On the Free Tier, a daily quota limit of 20 requests was detected (HTTP 429).
2. `gemini-3.7-flash` (Fallback Candidate): Available in model listings, but periodically returned HTTP 503 ("high demand") or rate limits under burst load.
3. `gemini-3-flash-preview` / `gemini-3.1-flash-lite` (Active Stable Fallback): Consistently returned HTTP 200 in 1.1–1.4 seconds with instant function calling.

### Multi-Model Fallback Chain
To guarantee 100% uptime for campus participants, `src/lib/chat.functions.ts` implements a resilient multi-model fallback chain:

```mermaid
flowchart TD
    A[User Chat Request] --> B[Check Rate Limit: 15 req/min]
    B --> C[Verify Supabase Auth Session]
    C --> D[Attempt Primary: GEMINI_MODEL / gemini-3.8-flash]
    D -->|Success| H[Enter Tool Calling Loop]
    D -->|429 / 503 / Quota / Timeout| E[Attempt Fallback: GEMINI_FALLBACK_MODEL / gemini-3.7-flash]
    E -->|Success| H
    E -->|429 / 503 / Quota / Timeout| F[Attempt Active Fallback: gemini-3-flash-preview]
    F -->|Success| H
    F -->|429 / 503 / Quota / Timeout| G[Attempt Lite Fallback: gemini-3.1-flash-lite]
    G -->|Success| H
    G -->|Failure| I[Return Friendly Maintenance Message]
```

### SDK Initialisation
```typescript
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    apiVersion: "v1beta",
    timeout: 15000,
  },
});
```

> [!NOTE]
> `apiVersion: "v1beta"` is explicitly configured on the GenAI client. The SDK defaults to `v1` if unspecified, which rejects 3.x Flash and Preview models with HTTP 404.

---

## 4. The Eight Rangora Tools and Data Sources

All eight tools operate read-only against live PostgreSQL data or curated application constants:

| # | Tool Name | Scope | Primary Data Source | Validation Schema | Return Information |
|:---:|:---|:---:|:---|:---|:---|
| 1 | `search_events` | Public | Neon `public.events` (joined with `categories` and `festivals`) | `query?`, `categoryId?`, `festivalId?`, `maxPrice?`, `onlyAvailable?` | ID, name, category, venue, start/end ISO, price, availableSeats, featured |
| 2 | `get_event_details` | Public | Neon `public.events`, `categories`, `festivals`, `registrations` | `eventId: number` | Full description, artists array, terms, pricing, seat counts |
| 3 | `get_live_seat_availability` | Public | Neon `public.events` + count of `public.registrations` | `eventId: number` | Total seats, booked seats, available seats, booked percentage, Seat Pulse status (`available`, `warm`, `critical`, `sold_out`) |
| 4 | `get_my_registration_status` | **Authenticated** | Neon `public.registrations` + `public.attendance` | `eventId: number` (userId from Session) | Registered (`true`/`false`), pass code, pass kind (`booked`/`planned`), verified attendance flag |
| 5 | `get_my_itinerary` | **Authenticated** | Neon `public.registrations` + `public.events` + `public.attendance` | Zero arguments (userId from Session) | User's booked/planned events, venues, timestamps, pass codes, attendance status |
| 6 | `check_my_schedule_conflicts` | **Authenticated** | Live itinerary calculation (Plan Rescue) | Zero arguments (userId from Session) | Has conflicts (`true`/`false`), conflict pairs with overlap minutes, rescheduling recommendation |
| 7 | `search_rangora_faq` | Public | Curated `RANGORA_FAQ` knowledge base | `query: string (min 2 chars)` | Official policies on passes, echoes, badges, venues, vouchers, organiser onboarding |
| 8 | `get_my_vouchers` | **Authenticated** | Neon `public.user_vouchers` + `public.voucher_campaigns` | Zero arguments (userId from Session) | Active discount vouchers, campaign titles, discount percentage, validity dates |

### Fallback to Isolated Demo State
When `RANGORA_DEMO_MODE=true` or database connections are unconfigured, tools transparently resolve against `demoRepo.getState()` using deterministic RFC 4122 v4 UUIDs (`DEMO_PARTICIPANT_ID`).

---

## 5. Authentication and Authorization Design

### The Golden Security Rule: Zero Model-Controlled Identity
Personalized tools (`get_my_registration_status`, `get_my_itinerary`, `check_my_schedule_conflicts`, `get_my_vouchers`) **MUST NEVER** accept `userId` as a function-call parameter. The model cannot specify whose itinerary it is querying.

### Server Session Resolution Flow
1. Client sends chat request containing message history.
2. Server function inspects `getRequest().headers.get("authorization")`.
3. If Bearer token exists:
   - Validates cryptographic JWT claims using Supabase Auth client (`supabase.auth.getClaims(token)`).
   - Extracts subject identifier: `userId = data.claims.sub`.
4. If unauthenticated or token is expired/invalid:
   - `userId = null`.
5. When Gemini calls a personalized tool with `userId = null`:
   - The tool immediately returns:
     ```json
     {
       "authenticated": false,
       "message": "Please sign in to view your festival itinerary."
     }
     ```
   - The model informs the participant that authentication is required.

---

## 6. Consequential Operations & Proposal Pattern

The LLM is strictly prohibited from executing mutations:
- No booking confirmations (`INSERT INTO registrations`).
- No pass cancellations (`DELETE FROM registrations`).
- No voucher redemptions (`UPDATE user_vouchers`).
- No organizer reviews or attendance check-ins.

### Proposal Pattern
When a user asks: *"Book a pass for Rhythm of Bengal"*, the model uses `propose_consequential_action`:

```json
{
  "action": "book_pass",
  "eventId": 4,
  "summary": "Reserve 1 seat for Rhythm of Bengal: Chhau & Baul Fusion at ₹0",
  "buttonLabel": "Confirm Pass Booking"
}
```

The tool registers the proposal and returns a status to the model:
`"Created proposal: Reserve 1 seat for Rhythm of Bengal... Awaiting explicit confirmation click from participant."`

The assistant explains the booking terms to the user and directs them to confirm. Consequential actions are only executed when the user explicitly clicks the authenticated action button on the event page or participant space.

---

## 7. Function-Calling Loop & Thought Signature Preservation

### Gemini Multi-Turn Protocol
The Google GenAI SDK v3.1.0 requires that model candidate turns returned by Gemini are echoed back verbatim in subsequent turns to preserve cryptographic **thought signatures** (`thought_signature`):

```typescript
// 1. Send user message with tool declarations
let response = await ai.models.generateContent({
  model: selectedModel,
  contents,
  config: { systemInstruction, tools }
});

// 2. Loop while functionCalls are emitted (bounded to MAX_TOOL_ITERATIONS = 4)
while (response?.functionCalls?.length > 0 && iterations < 4) {
  iterations++;

  // IMPORTANT: Push the exact candidate content (preserving thought signatures)
  contents.push(response.candidates[0].content);

  // Execute allowlisted tools
  const toolResponseParts = [];
  for (const call of response.functionCalls) {
    const { result, proposal } = await executeGeminiTool(call.name, call.args, toolContext);
    toolResponseParts.push({
      functionResponse: { name: call.name, response: result }
    });
  }

  // Push tool results as a user turn
  contents.push({ role: "user", parts: toolResponseParts });

  // Call model again for synthesis or further tools
  response = await ai.models.generateContent({
    model: selectedModel,
    contents,
    config: { systemInstruction, tools }
  });
}
```

---

## 8. Failure Handling and Security Guardrails

1. **In-Memory Rate Limiting:** 15 requests per minute per IP address. Prevents abusive model querying and denial-of-wallet.
2. **Payload Bounds:** Input message text constrained to $\le 1200$ characters via Zod. Maximum 10 messages retained in conversational context.
3. **Execution Loop Bounding:** Maximum 4 tool iterations per turn. Avoids runaway recursive tool-calling loops.
4. **Leak Prevention:** API keys are never included in error responses or logs. Log entries record only model names and sanitized error messages.
5. **Fail-Safe User Messages:** On provider downtime or network loss, users receive a friendly apology directing them to the physical help desk or events catalog.
6. **Zero Raw SQL:** The model interacts exclusively through strongly-typed Drizzle ORM helper functions and Zod-validated parameters.

---

## 9. Verification & Quality Gate Results

### Automated Test Suite: 86 / 86 Tests Passing (Exit Code 0)
```
 ✓ src/test/event-pulse.test.ts (23 tests)
 ✓ src/test/migration-runner.test.ts (15 tests)
 ✓ src/test/demo-journeys.test.ts (9 tests)
 ✓ src/test/demo-repository.test.ts (9 tests)
 ✓ src/test/gemini-chatbot.test.ts (22 tests)
 ✓ src/test/app-routing.test.tsx (2 tests)
 ✓ src/test/role-rules.test.ts (4 tests)
 ✓ src/test/gemini-live-server.test.ts (2 tests)

Test Files  8 passed (8)
     Tests  86 passed (86)
  Duration  26.32s
```

### TypeScript Static Typecheck (`npx tsc --noEmit`)
- **Status:** **0 errors (Exit code 0)**.
- Strict compiler compatibility verified across all Drizzle models and GenAI SDK types.

### Production Build (`npm run build`)
- **Status:** **SUCCESS (Exit code 0)**.
- Client bundle (`.output/public/`): Cleanly bundled without any `@google/genai` or API keys.
- SSR bundle (`.output/server/`): Nitro server functions cleanly generated with `@google/genai` bundled in server chunks.

### Live Server-Side Gemini Test
- Verified end-to-end execution of `search_events` and `get_live_seat_availability` with real responses synthesized and returned.
- Output verified free of credentials, tokens, or raw SQL.

---

## 10. Conclusion

Stage 5C Gemini Chatbot implementation is complete, thoroughly tested, and ready for production usage. The Rangora AI festival concierge provides accurate event discovery, seat pulse tracking, policy guidance, and participant assistance without compromising security, data integrity, or database safety.

