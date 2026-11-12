import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import {
  getDemoConnectionString,
  verifyDemoTarget,
  PRODUCTION_TIMELINE_ID,
  isDemoDbConfigured,
  closeDemoDb,
  getDemoDb,
} from "@/lib/demo-db";
import {
  demoDbRepo,
} from "@/lib/demo-db/repository";
import {
  DEMO_PARTICIPANT_ID,
  DEMO_ORGANISER_ID,
  DEMO_ADMIN_ID,
  DEMO_APPLICANT_AARAV,
  resolveDemoUserId,
} from "@/lib/demo-db/seed";

describe("Stage 6: Dedicated Neon Demo Database Architecture & Journeys", { timeout: 60000 }, () => {
  afterAll(async () => {
    await closeDemoDb();
  });

  // -------------------------------------------------------------------------
  // 1. Connection Safety & Fail-Closed Guard Verification
  // -------------------------------------------------------------------------
  describe("1. Target Safety & Production Protection", () => {
    it("should fail closed if DATABASE_URL_DEMO is not configured", () => {
      const original = process.env["DATABASE_URL_DEMO"];
      try {
        delete process.env["DATABASE_URL_DEMO"];
        expect(() => getDemoConnectionString()).toThrow(/DEMO DB NOT CONFIGURED/i);
      } finally {
        if (original) process.env["DATABASE_URL_DEMO"] = original;
      }
    });

    it("should fail closed if DATABASE_URL_DEMO contains placeholder strings", () => {
      const original = process.env["DATABASE_URL_DEMO"];
      try {
        process.env["DATABASE_URL_DEMO"] = "postgresql://neondb_owner:YOUR_PASSWORD@ep-demo.neon.tech/neondb";
        expect(() => getDemoConnectionString()).toThrow(/DEMO DB NOT CONFIGURED/i);
      } finally {
        if (original) process.env["DATABASE_URL_DEMO"] = original;
        else delete process.env["DATABASE_URL_DEMO"];
      }
    });

    it("should strictly reject pointing DATABASE_URL_DEMO to production DATABASE_URL", () => {
      const originalDemo = process.env["DATABASE_URL_DEMO"];
      const prodUrl = process.env["DATABASE_URL"];
      if (prodUrl) {
        try {
          process.env["DATABASE_URL_DEMO"] = prodUrl;
          expect(() => getDemoConnectionString()).toThrow(/CRITICAL SAFETY VIOLATION.*identical to the production DATABASE_URL/i);
        } finally {
          if (originalDemo) process.env["DATABASE_URL_DEMO"] = originalDemo;
          else delete process.env["DATABASE_URL_DEMO"];
        }
      }
    });

    it("should strictly reject pointing DATABASE_URL_DEMO to production DATABASE_URL_DIRECT", () => {
      const originalDemo = process.env["DATABASE_URL_DEMO"];
      const prodDirectUrl = process.env["DATABASE_URL_DIRECT"];
      if (prodDirectUrl) {
        try {
          process.env["DATABASE_URL_DEMO"] = prodDirectUrl;
          expect(() => getDemoConnectionString()).toThrow(/CRITICAL SAFETY VIOLATION.*identical to the production DATABASE_URL_DIRECT/i);
        } finally {
          if (originalDemo) process.env["DATABASE_URL_DEMO"] = originalDemo;
          else delete process.env["DATABASE_URL_DEMO"];
        }
      }
    });

    it("should define PRODUCTION_TIMELINE_ID matching the canonical production timeline", () => {
      expect(PRODUCTION_TIMELINE_ID).toBe("ff6dc35ad13680c0a665fbd20e4d4876");
    });
  });

  // -------------------------------------------------------------------------
  // 2. Demo Identity & Role Resolution Isolation
  // -------------------------------------------------------------------------
  describe("2. Demo Identity & Role Resolution Isolation", () => {
    it("should map demo alias strings to canonical RFC 4122 v4 UUIDs", () => {
      expect(resolveDemoUserId("demo-participant-maya")).toBe(DEMO_PARTICIPANT_ID);
      expect(resolveDemoUserId("demo-organiser-ritwik")).toBe(DEMO_ORGANISER_ID);
      expect(resolveDemoUserId("demo-admin-console")).toBe(DEMO_ADMIN_ID);
      expect(resolveDemoUserId("demo-applicant-aarav")).toBe(DEMO_APPLICANT_AARAV);
    });

    it("should preserve standard UUIDs if already valid RFC 4122 format", () => {
      const arbitraryUuid = "12345678-1234-4234-8234-123456789abc";
      expect(resolveDemoUserId(arbitraryUuid)).toBe(arbitraryUuid);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Database-Backed Operations & Journeys (Executed when DATABASE_URL_DEMO is configured)
  // -------------------------------------------------------------------------
  const hasDemoDb = isDemoDbConfigured();

  describe.skipIf(!hasDemoDb)("3. Live Neon Demo Database Journeys (A through G)", { timeout: 120000 }, () => {
    beforeAll(async () => {
      // Enforce: Every live database test must verify the expected demo timeline
      await verifyDemoTarget();
      await demoDbRepo.reset();
    }, 120000);

    // Journey A: Booking & Seat Pulse
    it("Journey A: Participant books pass, updates Seat Pulse, rejects duplicates, and cancels cleanly", async () => {
      const initialCounts = await demoDbRepo.getBookedCounts();
      const event5Initial = initialCounts[5] ?? 0;

      // 1. Maya books pass for Event 5 ("Echoes of the Baul Trail")
      const booking = await demoDbRepo.bookPass(DEMO_PARTICIPANT_ID, 5, "booked");
      expect(booking.pass_code).toMatch(/^RNG-DEMO-/);
      expect(booking.kind).toBe("booked");
      expect(booking.verified).toBe(false);

      // 2. Seat Pulse increments
      const updatedCounts = await demoDbRepo.getBookedCounts();
      expect(updatedCounts[5]).toBe(event5Initial + 1);

      // 3. Duplicate booking rejected
      await expect(demoDbRepo.bookPass(DEMO_PARTICIPANT_ID, 5, "booked")).rejects.toThrow(
        /already hold this pass/i
      );

      // 4. Maya cancels pass
      await demoDbRepo.cancelPass(DEMO_PARTICIPANT_ID, booking.id);

      // 5. Seat Pulse decrements back
      const finalCounts = await demoDbRepo.getBookedCounts();
      expect(finalCounts[5] ?? 0).toBe(event5Initial);
    });

    // Journey B: Attendance & Rewards
    it("Journey B: Organiser verifies attendance, awards verified_debut badge and syncs leaderboard", async () => {
      const checkin = await demoDbRepo.verifyAttendance("RNG-DEMO-1043");
      expect(checkin.verified).toBe(true);
      expect(checkin.participantName).toBe("Maya Sen");

      const state = await demoDbRepo.getState();
      const hasDebutBadge = state.userAchievements.some(
        (a) => a.user_id === DEMO_PARTICIPANT_ID && a.code === "verified_debut"
      );
      expect(hasDebutBadge).toBe(true);

      const mayaLeader = state.leaderboard.find((l) => l.user_id === DEMO_PARTICIPANT_ID);
      expect(mayaLeader?.points).toBeGreaterThanOrEqual(110);
    });

    // Journey C: Organiser Event Creation & Schedule Clash Prevention
    it("Journey C: Prevents venue/time conflicts and creates new campus event", async () => {
      const state = await demoDbRepo.getState();
      const existing = state.events[0]!;

      // 1. Conflict prevention
      await expect(
        demoDbRepo.createEvent(DEMO_ORGANISER_ID, {
          name: "Conflicting Concert",
          venue: existing.venue,
          startAt: existing.startAt,
          endAt: existing.endAt,
        })
      ).rejects.toThrow(/Schedule clash/i);

      // 2. Valid new event creation
      const newEvent = await demoDbRepo.createEvent(
        DEMO_ORGANISER_ID,
        {
          name: "Neon Sitar Courtyard Jam",
          venue: "Heritage Open Amphitheatre",
          startAt: "2026-11-26T16:00:00Z",
          endAt: "2026-11-26T18:30:00Z",
          maxSeats: 80,
          price: 50,
        },
        false
      );
      expect(newEvent.published).toBe(false);

      // 3. Publish event
      await demoDbRepo.updateEventPublish(newEvent.id, true);
      const updatedState = await demoDbRepo.getState();
      const published = updatedState.events.find((e) => e.id === newEvent.id);
      expect(published?.published).toBe(true);
    });

    // Journey D: Admin Organiser Application Review & Approval
    it("Journey D: Admin approves pending organiser application and assigns role", async () => {
      await demoDbRepo.approveOrganiser(DEMO_APPLICANT_AARAV, "approved");

      const state = await demoDbRepo.getState();
      const org = state.organisers.find((o) => o.user_id === DEMO_APPLICANT_AARAV);
      expect(org?.status).toBe("approved");
    });

    // Journey E: Voucher Stock & Redemption Lifecycle
    it("Journey E: Admin manages voucher stock, participant claims and redeems pass", async () => {
      // 1. Admin updates stock
      await demoDbRepo.updateVoucherStock(3, 50);

      // 2. Participant claims voucher
      const voucher = await demoDbRepo.issueVoucher(DEMO_PARTICIPANT_ID, 3);
      expect(voucher.code).toMatch(/^RNG-/);
      expect(voucher.campaign_id).toBe(3);

      // 3. Duplicate claim rejected
      await expect(
        demoDbRepo.issueVoucher(DEMO_PARTICIPANT_ID, 3)
      ).rejects.toThrow(/already claimed a voucher/i);

      // 4. Participant redeems voucher
      await demoDbRepo.redeemVoucher(DEMO_PARTICIPANT_ID, voucher.id);

      // 5. Voucher removed from active wallet
      const state = await demoDbRepo.getState();
      const exists = state.userVouchers.some((v) => v.id === voucher.id);
      expect(exists).toBe(false);
    });

    // Journey F: Event Echo Lifecycle & Moderation
    it("Journey F: Participant submits Echo with verified attendance check and organiser likes it", async () => {
      // Event 4 has verified attendance for Maya Sen
      const echo = await demoDbRepo.submitEcho(
        DEMO_PARTICIPANT_ID,
        "Maya Sen",
        4,
        5,
        "Superb wheel pottery session! The terracotta vessel is a great souvenir.",
        ["Pooja Das"],
        [],
        "public",
        true
      );
      expect(echo.author_name).toBe("Maya Sen");
      expect(echo.rating).toBe(5);

      // Organiser likes echo
      const liked = await demoDbRepo.toggleEchoLike(echo.id);
      expect(liked).toBe(true);

      // Admin flags echo
      await demoDbRepo.moderateEcho(echo.id, "flagged");
      const state = await demoDbRepo.getState();
      const updated = state.echoes.find((e) => e.id === echo.id);
      expect(updated?.moderation_status).toBe("flagged");
    });

    // Journey G: Helpdesk & Sponsorship Workflows
    it("Journey G: Participant sends helpdesk request and organiser answers it", async () => {
      // 1. Participant asks question about Event 4
      const help = await demoDbRepo.createHelpRequest(
        DEMO_PARTICIPANT_ID,
        "Maya Sen",
        "event",
        "Wheel clay texture",
        "What clay body is used in the studio session?",
        4
      );
      expect(help.status).toBe("open");
      expect(help.routed_to).toBe(DEMO_ORGANISER_ID);

      // 2. Organiser answers
      await demoDbRepo.answerHelp(help.id, "We use natural Gangetic alluvial river clay.");
      const state = await demoDbRepo.getState();
      const resolved = state.helpRequests.find((h) => h.id === help.id);
      expect(resolved?.status).toBe("resolved");
      expect(resolved?.answer).toContain("Gangetic");

      // 3. Sponsorship request and approval
      const sponsor = await demoDbRepo.requestSponsor(
        DEMO_ORGANISER_ID,
        "Chai Culture Co.",
        "Silver",
        25000,
        "sponsor@chaiculture.in",
        "Tea stall partnership"
      );
      expect(sponsor.status).toBe("requested");

      await demoDbRepo.updateSponsorStatus(sponsor.id, "active");
      const sponsorState = await demoDbRepo.getState();
      const activeSponsor = sponsorState.sponsors.find((s) => s.id === sponsor.id);
      expect(activeSponsor?.status).toBe("active");
    });
  });
});

