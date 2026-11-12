import { describe, it, expect, vi } from "vitest";
import {
  searchEvents,
  getEventDetails,
  getLiveSeatAvailability,
  getMyRegistrationStatus,
  getMyItinerary,
  checkMyScheduleConflicts,
  searchRangoraFaq,
  getMyVouchers,
  executeGeminiTool,
  proposeConsequentialAction,
} from "@/lib/gemini-tools";
import { DEMO_PARTICIPANT_ID } from "@/lib/demo-repository";

describe("Rangora Gemini Chatbot Integration Tests", () => {
  // -------------------------------------------------------------------------
  // 1. Public Event Search
  // -------------------------------------------------------------------------
  describe("1. Public Event Search", () => {
    it("should search events by keyword across title and venue", async () => {
      const results = await searchEvents({ query: "folk" }, { isDemo: true });
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      const matched = results.some((e) =>
        e.name.toLowerCase().includes("folk") ||
        e.subtitle.toLowerCase().includes("folk") ||
        e.venue.toLowerCase().includes("folk")
      );
      expect(matched).toBe(true);
    });

    it("should filter events by maximum ticket price (free events)", async () => {
      const results = await searchEvents({ maxPrice: 0 }, { isDemo: true });
      expect(results.length).toBeGreaterThan(0);
      results.forEach((e) => {
        expect(e.price).toBe(0);
      });
    });

    it("should filter events by valid category ID", async () => {
      const results = await searchEvents({ categoryId: 1 }, { isDemo: true });
      expect(results.length).toBeGreaterThan(0);
      results.forEach((e) => {
        expect(e.categoryId).toBe(1);
      });
    });
  });

  // -------------------------------------------------------------------------
  // 2. Event Details Retrieval
  // -------------------------------------------------------------------------
  describe("2. Event Details Retrieval", () => {
    it("should retrieve full canonical details for an existing event", async () => {
      const details = await getEventDetails({ eventId: 1 }, { isDemo: true });
      expect(details).not.toBeNull();
      expect(details?.id).toBe(1);
      expect(details?.name).toBeDefined();
      expect(details?.venue).toBeDefined();
      expect(details?.maxSeats).toBeGreaterThan(0);
      expect(details?.category).toBeDefined();
    });

    it("should return null for non-existent event IDs", async () => {
      const details = await getEventDetails({ eventId: 99999 }, { isDemo: true });
      expect(details).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 3. Live Seat Availability Retrieval
  // -------------------------------------------------------------------------
  describe("3. Live Seat Availability Retrieval", () => {
    it("should return Seat Pulse calculations and capacity statuses", async () => {
      const seatInfo = await getLiveSeatAvailability({ eventId: 1 }, { isDemo: true });
      expect("error" in seatInfo).toBe(false);
      if (!("error" in seatInfo)) {
        expect(seatInfo.eventId).toBe(1);
        expect(seatInfo.maxSeats).toBeGreaterThan(0);
        expect(seatInfo.availableSeats).toBeLessThanOrEqual(seatInfo.maxSeats);
        expect(["available", "warm", "critical", "sold_out"]).toContain(seatInfo.status);
      }
    });

    it("should return friendly error object for invalid event IDs", async () => {
      const seatInfo = await getLiveSeatAvailability({ eventId: 99999 }, { isDemo: true });
      expect("error" in seatInfo).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Unauthenticated Personalized-Tool Rejection
  // -------------------------------------------------------------------------
  describe("4. Unauthenticated Personalized-Tool Rejection", () => {
    it("should reject unauthenticated registration status requests", async () => {
      const res = await getMyRegistrationStatus({ eventId: 1 }, { userId: null, isDemo: false });
      expect(res.authenticated).toBe(false);
      expect(res.message).toContain("sign in");
    });

    it("should reject unauthenticated itinerary requests", async () => {
      const res = await getMyItinerary({}, { userId: null, isDemo: false });
      expect(res.authenticated).toBe(false);
      expect(res.itinerary).toHaveLength(0);
    });

    it("should reject unauthenticated schedule conflict checks", async () => {
      const res = await checkMyScheduleConflicts({}, { userId: null, isDemo: false });
      expect(res.hasConflicts).toBe(false);
      expect(res.recommendation).toContain("sign in");
    });

    it("should reject unauthenticated voucher queries", async () => {
      const res = await getMyVouchers({}, { userId: null, isDemo: false });
      expect(res.authenticated).toBe(false);
      expect(res.vouchers).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Authenticated Participant Queries
  // -------------------------------------------------------------------------
  describe("5. Authenticated Participant Queries (Demo Workspace)", () => {
    it("should return registration status for authenticated participant", async () => {
      const res = await getMyRegistrationStatus(
        { eventId: 1 },
        { userId: DEMO_PARTICIPANT_ID, isDemo: true }
      );
      expect(res.registered).toBe(true);
      expect(res.kind).toBe("booked");
      expect(res.passCode).toBeDefined();
    });

    it("should retrieve personalized itinerary with verified attendance flags", async () => {
      const res = await getMyItinerary({}, { userId: DEMO_PARTICIPANT_ID, isDemo: true });
      expect(res.userId).toBe(DEMO_PARTICIPANT_ID);
      expect(Array.isArray(res.itinerary)).toBe(true);
      expect(res.count).toBeGreaterThan(0);
      const first = res.itinerary[0];
      expect(first?.eventName).toBeDefined();
      expect(first?.passCode).toBeDefined();
      expect(typeof first?.attendanceVerified).toBe("boolean");
    });

    it("should retrieve vouchers claimed by the authenticated participant", async () => {
      const res = await getMyVouchers({}, { userId: DEMO_PARTICIPANT_ID, isDemo: true });
      expect(res.userId).toBe(DEMO_PARTICIPANT_ID);
      expect(Array.isArray(res.vouchers)).toBe(true);
      expect(res.count).toBeGreaterThan(0);
      expect(res.vouchers[0]?.code).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // 6. User Ownership Isolation
  // -------------------------------------------------------------------------
  describe("6. User Ownership Isolation", () => {
    it("should isolate participant schedules across different user IDs", async () => {
      const userA = "d3300001-0000-4000-8000-000000000001";
      const userB = "d3300002-0000-4000-8000-000000000002";

      const itinA = await getMyItinerary({}, { userId: userA, isDemo: true });
      const itinB = await getMyItinerary({}, { userId: userB, isDemo: true });

      expect(itinA.userId).not.toBe(itinB.userId);
      // User B is an organiser and has 0 attendee bookings in demo repo
      expect(itinA.count).toBeGreaterThan(0);
      expect(itinB.count).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // 7. Invalid Tool Arguments & Schema Guards
  // -------------------------------------------------------------------------
  describe("7. Invalid Tool Arguments & Schema Guards", () => {
    it("should reject invalid tool name with clear exception", async () => {
      await expect(
        executeGeminiTool("malicious_tool_exec", {})
      ).rejects.toThrow('Unknown Gemini tool function: "malicious_tool_exec"');
    });

    it("should reject negative prices in search_events", async () => {
      await expect(
        executeGeminiTool("search_events", { maxPrice: -50 })
      ).rejects.toThrow();
    });

    it("should reject missing eventId in get_event_details", async () => {
      await expect(
        executeGeminiTool("get_event_details", {})
      ).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // 8. FAQ Knowledge Base Search
  // -------------------------------------------------------------------------
  describe("8. FAQ Knowledge Base Search", () => {
    it("should find policies on Event Echoes and verification", async () => {
      const matches = await searchRangoraFaq({ query: "Echoes" });
      expect(matches.length).toBeGreaterThan(0);
      const echoFaq = matches.find((f) => f.category === "echoes");
      expect(echoFaq?.answer).toContain("verified");
      expect(echoFaq?.answer).toContain("consent");
    });

    it("should find cancellation policies for event passes", async () => {
      const matches = await searchRangoraFaq({ query: "cancellation" });
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.answer).toContain("cancelled");
    });
  });

  // -------------------------------------------------------------------------
  // 9. Consequential Action Proposal Pattern
  // -------------------------------------------------------------------------
  describe("9. Consequential Action Proposal Pattern", () => {
    it("should create proposal without executing live mutation", async () => {
      const { result, proposal } = await executeGeminiTool("propose_consequential_action", {
        action: "book_pass",
        eventId: 4,
        summary: "Reserve 1 seat for Rhythm of Bengal: Chhau & Baul Fusion at ₹0",
        buttonLabel: "Confirm Pass Booking",
      });

      expect(result.status).toBe("proposal_created");
      expect(proposal).toBeDefined();
      expect(proposal?.action).toBe("book_pass");
      expect(proposal?.eventId).toBe(4);
      expect(proposal?.buttonLabel).toBe("Confirm Pass Booking");
    });
  });

  // -------------------------------------------------------------------------
  // 10. Live Neon Database Parity (Read-Only)
  // -------------------------------------------------------------------------
  describe("10. Live Neon Database Parity (Read-Only)", () => {
    it("should execute read-only queries against live Neon tables without throwing", async () => {
      const events = await searchEvents({ query: "" }, { isDemo: false });
      // When Neon is connected, rows will be retrieved from PostgreSQL public.events
      expect(Array.isArray(events)).toBe(true);
      if (events.length > 0) {
        expect(events[0]?.name).toBeDefined();
        expect(events[0]?.venue).toBeDefined();
        expect(events[0]?.availableSeats).toBeGreaterThanOrEqual(0);
      }
    }, 30000);
  });

  // -------------------------------------------------------------------------
  // 11. Multi-Provider & Resilient Fallback Chat Turns
  // -------------------------------------------------------------------------
  describe("11. Multi-Provider & Resilient Fallback Chat Turns", () => {
    it("should answer 'What events are coming up?' with campus events and seat availability", async () => {
      const { handleChatTurn } = await import("@/lib/chat.server");
      const res = await handleChatTurn(
        { messages: [{ role: "user", content: "What events are coming up?" }] },
        { isDemo: true }
      );
      expect(res.text).toBeDefined();
      expect(res.text.length).toBeGreaterThan(30);
      expect(res.text.toLowerCase()).toContain("events");
    });

    it("should explain Event Echoes when asked", async () => {
      const { handleChatTurn } = await import("@/lib/chat.server");
      const res = await handleChatTurn(
        { messages: [{ role: "user", content: "How do Event Echoes work?" }] },
        { isDemo: true }
      );
      expect(res.text).toContain("Event Echoes");
      expect(res.text.toLowerCase()).toContain("pulse");
    });

    it("should explain how to organise an event when asked", async () => {
      const { handleChatTurn } = await import("@/lib/chat.server");
      const res = await handleChatTurn(
        { messages: [{ role: "user", content: "How can I organise an event?" }] },
        { isDemo: true }
      );
      expect(res.text).toContain("Campus Organiser");
      expect(res.text).toContain("/auth");
    });
  });
});

