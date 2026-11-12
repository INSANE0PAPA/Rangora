import { describe, it, expect, beforeEach } from "vitest";
import {
  demoRepo,
  DEMO_PARTICIPANT_ID,
  DEMO_ORGANISER_ID,
  DEMO_APPLICANT_AARAV,
} from "@/lib/demo-repository";

describe("Demo Repository (Stage 2 Interactive Workspace)", () => {
  beforeEach(() => {
    demoRepo.reset();
  });

  it("initializes with seeded sample data for all three roles", () => {
    const state = demoRepo.getState();
    expect(state.participantProfile.full_name).toBe("Maya Sen");
    expect(state.organisers[0]?.org_name).toBe("Campus Arts Guild");
    expect(state.events.length).toBeGreaterThanOrEqual(6);
    expect(state.registrations.some((r) => r.pass_code === "RNG-DEMO-1043")).toBe(true);
  });

  it("allows participant to book a pass with unique pass code", () => {
    const res = demoRepo.bookPass(DEMO_PARTICIPANT_ID, 2, "booked");
    expect(res.pass_code).toMatch(/^RNG-/);
    expect(res.kind).toBe("booked");
    expect(res.event_id).toBe(2);

    const counts = demoRepo.getBookedCounts();
    expect(counts[2]).toBeGreaterThan(0);
  });

  it("allows participant to cancel a pass", () => {
    const stateBefore = demoRepo.getState();
    const targetReg = stateBefore.registrations.find((r) => r.user_id === DEMO_PARTICIPANT_ID)!;
    expect(targetReg).toBeDefined();

    demoRepo.cancelPass(DEMO_PARTICIPANT_ID, targetReg.id);
    const stateAfter = demoRepo.getState();
    expect(stateAfter.registrations.some((r) => r.id === targetReg.id)).toBe(false);
  });

  it("verifies ticket attendance, awards verified_debut badge and +50 points", () => {
    const verification = demoRepo.verifyAttendance("RNG-DEMO-1043");
    expect(verification.verified).toBe(true);
    expect(verification.participantName).toBe("Maya Sen");

    const state = demoRepo.getState();
    const mayaReg = state.registrations.find((r) => r.pass_code === "RNG-DEMO-1043");
    expect(mayaReg?.verified).toBe(true);

    const hasBadge = state.userAchievements.some(
      (a) => a.user_id === DEMO_PARTICIPANT_ID && a.code === "verified_debut"
    );
    expect(hasBadge).toBe(true);

    const mayaLeaderboard = state.leaderboard.find((l) => l.user_id === DEMO_PARTICIPANT_ID);
    expect(mayaLeaderboard).toBeDefined();
    expect(mayaLeaderboard!.points).toBe(220); // Dynamically computed: bookings, verified check-ins, and badges
  });

  it("supports creating, toggling publishing, and modifying events", () => {
    const newEvent = demoRepo.createEvent(DEMO_ORGANISER_ID, {
      name: "Late Night Indie Film Screening",
      subtitle: "Student short cinema under the courtyard banyan tree",
      description: "Atmospheric 16mm student short films and open discussion circles.",
      venue: "Arts Quad Amphitheatre",
      startAt: "2026-11-20T20:00:00Z",
      endAt: "2026-11-20T23:00:00Z",
      price: 0,
      maxSeats: 80,
      categoryId: 3,
      festivalId: 1,
      poster: "hero_festival.jpg",
      artists: ["Anirudh Roy"],
      terms: "Bring student ID card.",
      published: false,
    });

    expect(newEvent.id).toBeDefined();
    expect(newEvent.published).toBe(false);

    demoRepo.updateEventPublish(newEvent.id, true);
    const updated = demoRepo.getState().events.find((e) => e.id === newEvent.id);
    expect(updated?.published).toBe(true);
  });

  it("allows admin to approve organiser applications and resets cleanly", () => {
    demoRepo.approveOrganiser(DEMO_APPLICANT_AARAV, "approved");
    let state = demoRepo.getState();
    const aarav = state.organisers.find((o) => o.user_id === DEMO_APPLICANT_AARAV);
    expect(aarav?.status).toBe("approved");

    demoRepo.reset();
    state = demoRepo.getState();
    const aaravReset = state.organisers.find((o) => o.user_id === DEMO_APPLICANT_AARAV);
    expect(aaravReset?.status).toBe("pending");
  });

  it("handles voucher issuing with stock decrement and voucher redemption", () => {
    const stateBefore = demoRepo.getState();
    const campaign = stateBefore.campaigns.find((c) => c.id === 3)!;
    const initialStock = campaign.stock;

    // Issue voucher
    const voucher = demoRepo.issueVoucher(DEMO_PARTICIPANT_ID, 3);
    expect(voucher.code).toMatch(/^RNG-/);
    expect(voucher.campaign_id).toBe(3);

    const stateAfterIssue = demoRepo.getState();
    const updatedCampaign = stateAfterIssue.campaigns.find((c) => c.id === 3)!;
    expect(updatedCampaign.stock).toBe(initialStock - 1);

    // Cannot issue duplicate voucher for same campaign to same user
    expect(() => demoRepo.issueVoucher(DEMO_PARTICIPANT_ID, 3)).toThrow("already claimed");

    // Redeem voucher
    const redeemed = demoRepo.redeemVoucher(DEMO_PARTICIPANT_ID, voucher.id);
    expect(redeemed.id).toBe(voucher.id);

    const stateAfterRedeem = demoRepo.getState();
    expect(stateAfterRedeem.userVouchers.some((v) => v.id === voucher.id)).toBe(false);
  });

  it("detects and prevents venue schedule clashes during event creation", () => {
    // Event 1 in catalog is at "Courtyard Stage"
    const state = demoRepo.getState();
    const existing = state.events[0]!;

    expect(() => {
      demoRepo.createEvent(DEMO_ORGANISER_ID, {
        name: "Clashing Event",
        venue: existing.venue,
        startAt: existing.startAt,
        endAt: existing.endAt,
      });
    }).toThrow("Schedule clash");
  });

  it("manages Event Echo submission and organiser appreciation toggle", () => {
    // Maya holds pass for event 1; check in attendance before submitting
    demoRepo.verifyAttendance("RNG-DEMO-1043");
    const echo = demoRepo.submitEcho(
      DEMO_PARTICIPANT_ID,
      "Maya Sen",
      1,
      5,
      "Incredible acoustic resonance under the courtyard stars!",
      ["Arjun Sen"]
    );
    expect(echo.id).toBeDefined();
    expect(echo.rating).toBe(5);

    // Organiser likes the echo
    const liked = demoRepo.toggleEchoLike(echo.id);
    expect(liked).toBe(true);

    const unliked = demoRepo.toggleEchoLike(echo.id);
    expect(unliked).toBe(false);
  });
});
