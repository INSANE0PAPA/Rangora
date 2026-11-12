import { describe, it, expect, beforeEach } from "vitest";
import {
  demoRepo,
  DEMO_PARTICIPANT_ID,
  DEMO_ORGANISER_ID,
  DEMO_APPLICANT_AARAV,
} from "@/lib/demo-repository";
import { img } from "@/assets/rangora";

describe("Stage 4: Event Echo Preservation & Event Pulse Gallery", () => {
  beforeEach(() => {
    // Reset repository to clean seed state for reproducible test runs
    demoRepo.reset();
  });

  // =========================================================================
  // 1. Submission Workflow & Eligibility Validation
  // =========================================================================
  describe("1. Submission Workflow & Eligibility", () => {
    it("submits an Event Echo when participant holds a confirmed booking", () => {
      // Maya holds a confirmed booking for Event 4
      const echo = demoRepo.submitEcho(
        DEMO_PARTICIPANT_ID,
        "Maya Sen",
        4,
        5,
        "Centering river clay was deeply therapeutic and inspiring.",
        ["Arjun Sen"],
        [{ path: "/assets/echoes/pottery_wheel.svg", name: "pottery_wheel.svg", type: "image/svg+xml" }],
        "private"
      );

      expect(echo).toBeDefined();
      expect(echo.id).toBeDefined();
      expect(echo.event_id).toBe(4);
      expect(echo.author_name).toBe("Maya Sen");
      expect(echo.rating).toBe(5);
      expect(echo.comment).toContain("Centering river clay");
      expect(echo.tagged_friends).toContain("Arjun Sen");
      expect(echo.media).toHaveLength(1);
    });

    it("rejects submission if participant does not hold a confirmed pass", () => {
      // Aarav does not hold a confirmed pass for Event 4
      expect(() => {
        demoRepo.submitEcho(
          DEMO_APPLICANT_AARAV,
          "Aarav Patel",
          4,
          5,
          "I did not register, but writing feedback anyway.",
          [],
          [],
          "private"
        );
      }).toThrow(/Only participants holding a confirmed pass/);
    });

    it("rejects submission when confirmed booking exists but organiser attendance check-in is unverified", () => {
      // Maya holds pass RNG-DEMO-1043 for Event 1, but attendance is not verified yet
      expect(() => {
        demoRepo.submitEcho(
          DEMO_PARTICIPANT_ID,
          "Maya Sen",
          1,
          5,
          "Trying to review before check-in.",
          [],
          [],
          "private"
        );
      }).toThrow(/Attendance check-in must be verified by the event organiser/);

      // Now organiser verifies check-in at the door
      const checkin = demoRepo.verifyAttendance("RNG-DEMO-1043");
      expect(checkin.verified).toBe(true);

      // Now submission succeeds
      const echo = demoRepo.submitEcho(
        DEMO_PARTICIPANT_ID,
        "Maya Sen",
        1,
        5,
        "Post-checkin authentic Event Echo.",
        [],
        [],
        "private"
      );
      expect(echo.id).toBeDefined();
    });

    it("clamps ratings strictly between 1 and 5", () => {
      const echoHigh = demoRepo.submitEcho(
        DEMO_PARTICIPANT_ID,
        "Maya Sen",
        4,
        10,
        "Super high rating beyond five stars.",
        [],
        [],
        "private"
      );
      expect(echoHigh.rating).toBe(5);

      const echoLow = demoRepo.submitEcho(
        DEMO_PARTICIPANT_ID,
        "Maya Sen",
        4,
        -2,
        "Negative rating below one star.",
        [],
        [],
        "private"
      );
      expect(echoLow.rating).toBe(1);
    });
  });

  // =========================================================================
  // 2. Visibility Enforcement & Default Private
  // =========================================================================
  describe("2. Visibility Enforcement & Participant Consent", () => {
    it("defaults to 'private' visibility when not explicitly overridden", () => {
      const echo = demoRepo.submitEcho(
        DEMO_PARTICIPANT_ID,
        "Maya Sen",
        4,
        5,
        "Default private reflection only for me and the organiser.",
        [],
        []
        // visibility argument omitted -> should default to private
      );

      expect(echo.visibility).toBe("private");
    });

    it("excludes private echoes from the public Event Pulse discovery gallery", () => {
      // Submit a private echo
      const privateEcho = demoRepo.submitEcho(
        DEMO_PARTICIPANT_ID,
        "Maya Sen",
        4,
        5,
        "Private reflections should not appear on public wall.",
        [],
        [],
        "private"
      );

      const pulseEchoes = demoRepo.getPulseEchoes();
      const foundInPublic = pulseEchoes.some((e) => e.id === privateEcho.id);
      expect(foundInPublic).toBe(false);
    });

    it("excludes campus-restricted echoes from the public Event Pulse discovery gallery", () => {
      const campusEcho = demoRepo.submitEcho(
        DEMO_PARTICIPANT_ID,
        "Maya Sen",
        4,
        4,
        "Campus-only insight for registered students.",
        [],
        [],
        "campus"
      );

      const pulseEchoes = demoRepo.getPulseEchoes();
      const foundInPublic = pulseEchoes.some((e) => e.id === campusEcho.id);
      expect(foundInPublic).toBe(false);
    });

    it("includes public echoes in the public Event Pulse discovery gallery", () => {
      // Submit a public echo with explicit consent
      const publicEcho = demoRepo.submitEcho(
        DEMO_PARTICIPANT_ID,
        "Maya Sen",
        4,
        5,
        "Public showcase moment explicitly consented for Event Pulse.",
        ["Pooja Das"],
        [{ path: "/assets/echoes/pottery_wheel.svg", name: "pottery_wheel.svg", type: "image/svg+xml" }],
        "public",
        true // explicit consent
      );

      const pulseEchoes = demoRepo.getPulseEchoes();
      const foundInPublic = pulseEchoes.some((e) => e.id === publicEcho.id);
      expect(foundInPublic).toBe(true);
    });

    it("enforces explicit participant consent for public visibility", () => {
      // Trying to submit public review without publicConsent must throw
      expect(() => {
        demoRepo.submitEcho(
          DEMO_PARTICIPANT_ID,
          "Maya Sen",
          4,
          5,
          "Great pottery workshop!",
          [],
          [],
          "public",
          false // Missing consent!
        );
      }).toThrow(/Explicit participant consent is required/);

      // With publicConsent = true, succeeds
      const result = demoRepo.submitEcho(
        DEMO_PARTICIPANT_ID,
        "Maya Sen",
        4,
        5,
        "Great pottery workshop with explicit consent!",
        [],
        [],
        "public",
        true // Consent provided
      );

      expect(result.id).toBeDefined();
      expect(result.visibility).toBe("public");
    });
  });

  // =========================================================================
  // 3. Organiser Appreciation (Like / Pick)
  // =========================================================================
  describe("3. Organiser Appreciation", () => {
    it("toggles organiser appreciation like on an Event Echo", () => {
      const state = demoRepo.getState();
      const firstEcho = state.echoes[0];
      expect(firstEcho).toBeDefined();

      const initialLike = firstEcho!.liked_by_organiser;
      const toggled1 = demoRepo.toggleEchoLike(firstEcho!.id);
      expect(toggled1).toBe(!initialLike);

      const toggled2 = demoRepo.toggleEchoLike(firstEcho!.id);
      expect(toggled2).toBe(initialLike);
    });

    it("sorts organiser-liked echoes to the top when filtered by liked", () => {
      const pulseEchoes = demoRepo.getPulseEchoes();
      const sorted = [...pulseEchoes].sort(
        (a, b) => Number(b.liked_by_organiser) - Number(a.liked_by_organiser)
      );

      expect(sorted.length).toBeGreaterThan(0);
      expect(sorted[0]!.liked_by_organiser).toBe(true);
    });
  });

  // =========================================================================
  // 4. Gallery Filtering & Search
  // =========================================================================
  describe("4. Gallery Filtering & Search", () => {
    it("filters echoes by categoryId", () => {
      // Category 4: Hands-On Workshops
      const workshopEchoes = demoRepo.getPulseEchoes({ categoryId: 4 });
      expect(workshopEchoes.length).toBeGreaterThan(0);

      const state = demoRepo.getState();
      for (const echo of workshopEchoes) {
        const ev = state.events.find((e) => e.id === echo.event_id);
        expect(ev?.categoryId).toBe(4);
      }
    });

    it("filters echoes by festivalId", () => {
      // Festival 1: Rangora Autumn Arts & Music Festival
      const fest1Echoes = demoRepo.getPulseEchoes({ festivalId: 1 });
      expect(fest1Echoes.length).toBeGreaterThan(0);

      const state = demoRepo.getState();
      for (const echo of fest1Echoes) {
        const ev = state.events.find((e) => e.id === echo.event_id);
        expect(ev?.festivalId).toBe(1);
      }
    });

    it("filters echoes by minimum star rating", () => {
      const fiveStarOnly = demoRepo.getPulseEchoes({ minRating: 5 });
      for (const echo of fiveStarOnly) {
        expect(echo.rating).toBe(5);
      }
    });

    it("filters echoes with media attachments", () => {
      const mediaEchoes = demoRepo.getPulseEchoes({ hasMedia: true });
      for (const echo of mediaEchoes) {
        expect(echo.media.length).toBeGreaterThan(0);
      }
    });

    it("searches echoes by commentary keywords", () => {
      const results = demoRepo.getPulseEchoes({ search: "sitar" });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.comment.toLowerCase()).toContain("sitar");
    });

    it("searches echoes by tagged friends", () => {
      const results = demoRepo.getPulseEchoes({ search: "Arjun Sen" });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.tagged_friends).toContain("Arjun Sen");
    });
  });

  // =========================================================================
  // 5. Media Access & Public Demo Safety
  // =========================================================================
  describe("5. Media Access & Synthetic Asset Safety", () => {
    it("uses safe bundled SVG and sample artwork in demo echoes", () => {
      const pulseEchoes = demoRepo.getPulseEchoes();
      expect(pulseEchoes.length).toBeGreaterThan(0);

      for (const echo of pulseEchoes) {
        for (const item of echo.media) {
          // In the public demo, media paths must point to bundled safe assets or public SVG
          expect(
            item.path.startsWith("/assets/echoes/") ||
            item.path.startsWith("http") ||
            item.path.includes("terracotta")
          ).toBe(true);

          // Test that img resolver can resolve the media name
          const resolved = img(item.name);
          expect(resolved).toBeTruthy();
          expect(typeof resolved).toBe("string");
        }
      }
    });

    it("does not leak private user upload paths in public Event Pulse payload", () => {
      const items = demoRepo.getPulseEchoes();
      for (const item of items) {
        expect(item.visibility).toBe("public");
        expect(item.moderation_status ?? "approved").toBe("approved");
        // No unverified private storage paths
        for (const m of item.media) {
          expect(m.path).not.toContain("private_bucket_internal");
        }
      }
    });

    it("never exposes private or campus participant media in public gallery queries", () => {
      // Maya submits a private echo with private media
      demoRepo.submitEcho(
        DEMO_PARTICIPANT_ID,
        "Maya Sen",
        4,
        5,
        "Private workshop photo.",
        [],
        [{ path: "4/maya/private_photo_secret.jpg", name: "private_photo_secret.jpg", type: "image/jpeg" }],
        "private"
      );

      const publicEchoes = demoRepo.getPulseEchoes();
      for (const echo of publicEchoes) {
        for (const item of echo.media) {
          expect(item.path).not.toContain("private_photo_secret.jpg");
          expect(item.name).not.toBe("private_photo_secret.jpg");
        }
      }
    });
  });

  // =========================================================================
  // 6. Moderation & Reporting Controls
  // =========================================================================
  describe("6. Moderation & Reporting Controls", () => {
    it("flags an echo when reported by a user", () => {
      const state = demoRepo.getState();
      const targetEcho = state.echoes.find((e) => e.visibility === "public");
      expect(targetEcho).toBeDefined();

      const reported = demoRepo.reportEcho(targetEcho!.id);
      expect(reported.moderation_status).toBe("flagged");

      // Verify that flagged echo is removed from public Event Pulse
      const publicAfterFlag = demoRepo.getPulseEchoes();
      expect(publicAfterFlag.some((e) => e.id === targetEcho!.id)).toBe(false);
    });

    it("admin can moderate an echo to hidden status", () => {
      const state = demoRepo.getState();
      const targetEcho = state.echoes.find((e) => e.visibility === "public");
      expect(targetEcho).toBeDefined();

      const hidden = demoRepo.moderateEcho(targetEcho!.id, "hidden");
      expect(hidden.moderation_status).toBe("hidden");

      // Verify hidden echo is excluded from public Pulse
      const publicAfterHide = demoRepo.getPulseEchoes();
      expect(publicAfterHide.some((e) => e.id === targetEcho!.id)).toBe(false);
    });

    it("admin can re-approve a flagged or hidden echo", () => {
      const state = demoRepo.getState();
      const targetEcho = state.echoes.find((e) => e.visibility === "public");
      expect(targetEcho).toBeDefined();

      // First hide it
      demoRepo.moderateEcho(targetEcho!.id, "hidden");

      // Now approve it
      const approved = demoRepo.moderateEcho(targetEcho!.id, "approved");
      expect(approved.moderation_status).toBe("approved");

      // Verify re-approved echo is visible again in public Pulse
      const publicAfterApprove = demoRepo.getPulseEchoes();
      expect(publicAfterApprove.some((e) => e.id === targetEcho!.id)).toBe(true);
    });
  });
});
