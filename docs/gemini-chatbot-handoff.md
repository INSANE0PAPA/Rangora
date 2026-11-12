# Rangora 2.0 — Stage 5 Gemini Chatbot Technical Handoff Guide

This document provides the complete technical specification, tool contracts, database integration requirements, SDK setup, and security guardrails for integrating the **Rangora AI Festival Companion** powered by the official Google Gemini SDK.

---

## 1. Executive Architecture & Role Definition

### Assistant Identity
- **Name**: Rangora AI — *Your Personal Festival Companion*
- **Role**: Intelligent, context-aware festival concierge assisting participants with discovering events, checking seat availability, reviewing personal itineraries, resolving scheduling conflicts (Plan Rescue), discovering voucher rewards, and understanding campus festival policies.
- **Execution Boundary**: **100% Server-Side**. The Google Gemini SDK and API keys are strictly confined to TanStack Start server functions (`createServerFn`). No Gemini credentials, prompt templates, or raw tool declarations are exposed to browser bundles.
- **Data Boundary**: Operates directly against Neon PostgreSQL (in production) or the isolated demo repository (in demo mode). The model never fabricates dates, ticket availability, or voucher codes; all factual claims must be resolved through controlled backend tools.

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser Client (React)                   │
│   Chatbot Widget / Floating Launcher (src/components/Chatbot.tsx) │
└──────────────────────────────▲──────────────────────────────┘
                               │ HTTPS (POST /_server)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│             TanStack Start Server Function                  │
│               (src/lib/chat.functions.ts)                   │
│  - Rate Limiter (15 req/min per IP/User)                   │
│  - Session Auth (Extract verified userId from session)     │
│  - Gemini Multi-Turn Tool Loop                              │
└───────────────▲─────────────────────────────▲───────────────┘
                │                             │
    Function Call / Returns         Function Call / Returns
                │                             │
┌───────────────▼──────────────┐ ┌────────────▼───────────────┐
│       Google Gemini API      │ │    Approved Rangora Tools  │
│  (Official @google/genai SDK)│ │  - Neon PostgreSQL (Drizzle)│
│  - gemini-2.5-flash / 1.5    │ │  - Demo Repository (Fallback)│
│  - Configurable GEMINI_MODEL │ │  - Pure Role Rules         │
└──────────────────────────────┘ └────────────────────────────┘
```

---

## 2. Server-Side Tool Contracts (Approved Functions)

The model is equipped with **8 read-only analytical tools** and **1 proposal tool** for consequential actions.

### Tool 1: `search_events`
Searches published festival events matching user criteria.
```typescript
export const searchEventsSchema = z.object({
  query: z.string().optional().describe("Text search keyword in title, subtitle, or description"),
  categoryId: z.number().int().optional().describe("Category ID filter (e.g. 1=Music, 2=Dance, 3=Theatre, 4=Tech, 5=Film)"),
  festivalId: z.number().int().optional().describe("Festival ID filter"),
  maxPrice: z.number().int().min(0).optional().describe("Maximum ticket price in INR (0 for free events)"),
  onlyAvailable: z.boolean().optional().describe("True to only show events with remaining seats"),
});

// Returns:
export type SearchEventsResult = Array<{
  id: number;
  name: string;
  category: string;
  festivalName: string;
  venue: string;
  startAt: string;
  endAt: string;
  price: number;
  availableSeats: number;
  featured: boolean;
}>;
```

### Tool 2: `get_event_details`
Retrieves full canonical details for a specific event.
```typescript
export const getEventDetailsSchema = z.object({
  eventId: z.number().int().describe("The numeric event ID"),
});

// Returns:
export type EventDetailsResult = {
  id: number;
  name: string;
  subtitle: string;
  description: string;
  category: string;
  venue: string;
  startAt: string;
  endAt: string;
  price: number;
  maxSeats: number;
  bookedSeats: number;
  availableSeats: number;
  artists: Array<{ name: string; role?: string }>;
  terms: string;
  badges: Array<{ id: string; title: string; points: number }>;
} | null;
```

### Tool 3: `get_live_seat_availability`
Returns live Seat Pulse status and remaining capacity.
```typescript
export const getLiveSeatAvailabilitySchema = z.object({
  eventId: z.number().int().describe("The numeric event ID"),
});

// Returns:
export type SeatAvailabilityResult = {
  eventId: number;
  eventName: string;
  maxSeats: number;
  bookedSeats: number;
  availableSeats: number;
  percentageBooked: number;
  status: "available" | "warm" | "critical" | "sold_out";
};
```

### Tool 4: `get_my_registration_status`
Checks if the current authenticated user has planned or booked a specific event.
> **Security Rule**: `userId` is never accepted as a model parameter; it is injected strictly by the server session.
```typescript
export const getMyRegistrationStatusSchema = z.object({
  eventId: z.number().int().describe("The numeric event ID to check registration for"),
});

// Returns:
export type MyRegistrationStatusResult = {
  eventId: number;
  registered: boolean;
  kind: "booked" | "planned" | null;
  passCode?: string;
  attendanceVerified?: boolean;
};
```

### Tool 5: `get_my_itinerary`
Fetches all events the current participant has booked or added to their schedule.
> **Security Rule**: Zero arguments. Scoped strictly to authenticated user session.
```typescript
// Returns:
export type MyItineraryResult = Array<{
  eventId: number;
  eventName: string;
  venue: string;
  startAt: string;
  endAt: string;
  kind: "booked" | "planned";
  passCode: string;
  attendanceVerified: boolean;
}>;
```

### Tool 6: `check_my_schedule_conflicts`
Executes Rangora's **Plan Rescue** conflict-detection algorithm over the user's registered timeline.
> **Security Rule**: Zero arguments. Scoped strictly to user session.
```typescript
// Returns:
export type ScheduleConflictsResult = {
  hasConflicts: boolean;
  conflictPairs: Array<{
    eventA: { id: number; name: string; startAt: string; endAt: string };
    eventB: { id: number; name: string; startAt: string; endAt: string };
    overlapMinutes: number;
  }>;
  recommendation: string;
};
```

### Tool 7: `search_rangora_faq`
Searches curated Rangora festival policies, guidelines, voucher mechanics, and Event Echo rules.
```typescript
export const searchRangoraFaqSchema = z.object({
  query: z.string().min(2).describe("Search term or policy question"),
});

// Returns:
export type FaqSearchResult = Array<{
  question: string;
  answer: string;
  category: "passes" | "echoes" | "vouchers" | "badges" | "venues" | "general";
}>;
```

### Tool 8: `get_my_vouchers`
Lists active, redeemed, and available discount vouchers for the participant.
> **Security Rule**: Zero arguments. Scoped strictly to authenticated user session.
```typescript
// Returns:
export type MyVouchersResult = Array<{
  voucherId: string;
  campaignTitle: string;
  code: string;
  discountPct: number;
  validUntil: string;
  isRedeemed: boolean;
}>;
```

### Proposal Pattern for Consequential Actions
For actions that change state (booking a pass, cancelling a registration, redeeming a voucher), the model **MUST NOT** execute mutations directly. Instead, it issues a `ProposedAction`:
```typescript
export type ProposedAction = {
  action: "book_pass" | "cancel_pass" | "redeem_voucher";
  eventId?: number;
  voucherId?: string;
  summary: string;
  buttonLabel: string;
};
```
The browser chat UI renders an interactive confirmation button. When clicked by the user, the browser calls the standard validated server function (`executeEventBooking` in `src/lib/api.functions.ts`).

---

## 3. Database Function & Data Resolution Layer

When handling tool calls, query the authoritative database source:

```typescript
// src/lib/gemini-tools.ts (Sample Implementation Architecture)
import { db } from "@/lib/db";
import * as schema from "../../drizzle/schema";
import { demoRepo } from "@/lib/demo-repository";
import { eq, and, sql, ilike } from "drizzle-orm";

const isDemo = process.env.RANGORA_DEMO_MODE === "true" || !process.env.DATABASE_URL;

export async function resolveLiveSeatAvailability(eventId: number) {
  if (isDemo) {
    const event = demoRepo.getEvents().find((e) => e.id === eventId);
    if (!event) return null;
    const booked = demoRepo.getRegistrations().filter((r) => r.eventId === eventId && r.kind === "booked").length;
    return {
      eventId,
      eventName: event.name,
      maxSeats: event.maxSeats,
      bookedSeats: booked,
      availableSeats: Math.max(0, event.maxSeats - booked),
      percentageBooked: Math.round((booked / event.maxSeats) * 100),
      status: booked >= event.maxSeats ? "sold_out" : (booked / event.maxSeats) > 0.85 ? "critical" : "available",
    };
  }

  // Neon PostgreSQL via Drizzle
  const [event] = await db.select().from(schema.events).where(eq(schema.events.id, eventId));
  if (!event) return null;

  const [bookingCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.registrations)
    .where(and(eq(schema.registrations.eventId, eventId), eq(schema.registrations.kind, "booked")));

  const booked = bookingCount?.count ?? 0;
  return {
    eventId,
    eventName: event.name,
    maxSeats: event.maxSeats,
    bookedSeats: booked,
    availableSeats: Math.max(0, event.maxSeats - booked),
    percentageBooked: Math.round((booked / event.maxSeats) * 100),
    status: booked >= event.maxSeats ? "sold_out" : (booked / event.maxSeats) > 0.85 ? "critical" : "available",
  };
}
```

---

## 4. Google GenAI SDK Setup & Configuration

### Package Installation
Install the official Google GenAI SDK:
```bash
npm install @google/genai
```

### Environment Variables
Configure in `.env` (Server only; never prefix with `VITE_`):
```ini
# Google Gemini API Configuration
GEMINI_API_KEY=AIzaSy...your_actual_key_here
GEMINI_MODEL=gemini-2.5-flash
```

### SDK Initialisation & Tool Declaration
```typescript
import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const ai = new GoogleGenAI({ apiKey });

// Tool declaration for Gemini SDK
export const geminiToolDeclarations = [
  {
    name: "search_events",
    description: "Search for campus festival events by keyword, category, max price, or availability.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: "Search query" },
        categoryId: { type: Type.INTEGER, description: "Category ID (1-5)" },
        maxPrice: { type: Type.INTEGER, description: "Max price in INR" },
      },
    },
  },
  {
    name: "get_live_seat_availability",
    description: "Check remaining seats and capacity status for an event.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        eventId: { type: Type.INTEGER, description: "The event ID" },
      },
      required: ["eventId"],
    },
  },
  {
    name: "get_my_itinerary",
    description: "Fetch the logged-in user's booked events and pass codes.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "check_my_schedule_conflicts",
    description: "Inspect user's schedule for overlapping event times and get Plan Rescue suggestions.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
];
```

---

## 5. Security Guardrails & Best Practices

1. **Strict User Scoping**:
   - Tools accessing private data (`get_my_registration_status`, `get_my_itinerary`, `get_my_vouchers`, `check_my_schedule_conflicts`) **MUST NEVER** take `userId` as an LLM argument. The server handler extracts the authenticated user ID from the encrypted session cookie / auth token.
2. **In-Memory Rate Limiting**:
   - Enforce a strict sliding window rate limiter: maximum 15 chat queries per minute per client IP or authenticated session.
3. **Payload Bounds**:
   - User prompt length: $\le 1200$ characters.
   - Message history length: $\le 10$ items passed to model context.
4. **Graceful Fallbacks**:
   - If `GEMINI_API_KEY` is not set, the chat function must return a friendly static response:
     > *"Rangora AI is currently undergoing scheduled maintenance. Please browse our Events catalog or ask at the campus help desk."*
   - Never throw raw 500 errors or expose API connection strings to the client.
5. **Zero Raw SQL Execution**:
   - The LLM interacts solely through strongly-typed Drizzle query helper functions.

