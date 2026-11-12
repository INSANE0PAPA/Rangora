import { describe, it, expect } from "vitest";
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
} from "@/lib/gemini-tools";

describe("Eight Rangora Tools — Live Neon Read-Only Verification", { timeout: 15000 }, () => {
  // -------------------------------------------------------------------------
  // 1. search_events
  // -------------------------------------------------------------------------
  describe("1. search_events", () => {
    it("should query live Neon database and return published events", async () => {
      const results = await searchEvents({ query: "" }, { isDemo: false });
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      const first = results[0]!;
      expect(first.id).toBeGreaterThan(0);
      expect(first.name).toBeDefined();
      expect(first.venue).toBeDefined();
      expect(first.category).toBeDefined();
      expect(first.availableSeats).toBeGreaterThanOrEqual(0);
    });

    it("should filter by maximum ticket price in live Neon database", async () => {
      const freeEvents = await searchEvents({ maxPrice: 0 }, { isDemo: false });
      expect(freeEvents.length).toBeGreaterThan(0);
      freeEvents.forEach(e => expect(e.price).toBe(0));
    });

    it("should reject invalid maxPrice with Zod validation error", async () => {
      await expect(
        executeGeminiTool("search_events", { maxPrice: -25 }, { isDemo: false })
      ).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // 2. get_event_details
  // -------------------------------------------------------------------------
  describe("2. get_event_details", () => {
    it("should retrieve canonical event details from live Neon events table", async () => {
      const details = await getEventDetails({ eventId: 4 }, { isDemo: false });
      expect(details).not.toBeNull();
      expect(details?.id).toBe(4);
      expect(details?.name).toContain("Mitti & Indigo");
      expect(details?.venue).toBeDefined();
      expect(details?.maxSeats).toBe(5);
      expect(details?.category).toBeDefined();
      expect(details?.terms).toBeDefined();
    });

    it("should return null for non-existent event IDs in Neon", async () => {
      const details = await getEventDetails({ eventId: 999999 }, { isDemo: false });
      expect(details).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 3. get_live_seat_availability
  // -------------------------------------------------------------------------
  describe("3. get_live_seat_availability", () => {
    it("should calculate Seat Pulse capacity from live Neon records", async () => {
      const res = await getLiveSeatAvailability({ eventId: 4 }, { isDemo: false });
      expect("error" in res).toBe(false);
      if (!("error" in res)) {
        expect(res.eventId).toBe(4);
        expect(res.maxSeats).toBe(5);
        expect(res.availableSeats).toBeLessThanOrEqual(5);
        expect(["available", "warm", "critical", "sold_out"]).toContain(res.status);
      }
    });

    it("should return clean error for nonexistent event", async () => {
      const res = await getLiveSeatAvailability({ eventId: 888888 }, { isDemo: false });
      expect("error" in res).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 4. get_my_registration_status
  // -------------------------------------------------------------------------
  describe("4. get_my_registration_status", () => {
    it("should reject unauthenticated caller", async () => {
      const res = await getMyRegistrationStatus({ eventId: 4 }, { userId: null, isDemo: false });
      expect(res.authenticated).toBe(false);
      expect(res.message).toContain("sign in");
    });

    it("should query Neon registrations table for authenticated user", async () => {
      const testUserId = "00000000-0000-0000-0000-000000000001";
      const res = await getMyRegistrationStatus({ eventId: 4 }, { userId: testUserId, isDemo: false });
      expect(res.registered).toBe(false);
      expect(res.eventId).toBe(4);
      expect(res.kind).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 5. get_my_itinerary
  // -------------------------------------------------------------------------
  describe("5. get_my_itinerary", () => {
    it("should reject unauthenticated caller", async () => {
      const res = await getMyItinerary({}, { userId: null, isDemo: false });
      expect(res.authenticated).toBe(false);
      expect(res.itinerary).toHaveLength(0);
    });

    it("should query Neon registrations table and return empty itinerary for new user", async () => {
      const testUserId = "00000000-0000-0000-0000-000000000001";
      const res = await getMyItinerary({}, { userId: testUserId, isDemo: false });
      expect(res.userId).toBe(testUserId);
      expect(res.count).toBe(0);
      expect(res.itinerary).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // 6. check_my_schedule_conflicts
  // -------------------------------------------------------------------------
  describe("6. check_my_schedule_conflicts", () => {
    it("should reject unauthenticated caller", async () => {
      const res = await checkMyScheduleConflicts({}, { userId: null, isDemo: false });
      expect(res.hasConflicts).toBe(false);
      expect(res.recommendation).toContain("sign in");
    });

    it("should report clear schedule for user with no overlapping passes", async () => {
      const testUserId = "00000000-0000-0000-0000-000000000001";
      const res = await checkMyScheduleConflicts({}, { userId: testUserId, isDemo: false });
      expect(res.hasConflicts).toBe(false);
      expect(res.conflictPairs).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // 7. search_rangora_faq
  // -------------------------------------------------------------------------
  describe("7. search_rangora_faq", () => {
    it("should return curated policy answers on passes", async () => {
      const results = await searchRangoraFaq({ query: "pass" });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.answer).toBeDefined();
    });

    it("should return curated policy answers on Event Echoes", async () => {
      const results = await searchRangoraFaq({ query: "Echo" });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.answer).toContain("verified");
    });
  });

  // -------------------------------------------------------------------------
  // 8. get_my_vouchers
  // -------------------------------------------------------------------------
  describe("8. get_my_vouchers", () => {
    it("should reject unauthenticated caller", async () => {
      const res = await getMyVouchers({}, { userId: null, isDemo: false });
      expect(res.authenticated).toBe(false);
      expect(res.vouchers).toHaveLength(0);
    });

    it("should query Neon user_vouchers table for authenticated user", async () => {
      const testUserId = "00000000-0000-0000-0000-000000000001";
      const res = await getMyVouchers({}, { userId: testUserId, isDemo: false });
      expect(res.userId).toBe(testUserId);
      expect(res.count).toBe(0);
      expect(res.vouchers).toHaveLength(0);
    });
  });
});
