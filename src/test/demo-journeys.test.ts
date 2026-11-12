import { describe, it, expect, beforeEach } from "vitest";
import {
  demoRepo,
  DEMO_PARTICIPANT_ID,
  DEMO_ORGANISER_ID,
  DEMO_ADMIN_ID,
  DEMO_APPLICANT_AARAV,
} from "@/lib/demo-repository";

describe("Stage 3: Full Cross-Dashboard Journeys (A through G)", () => {
  beforeEach(() => {
    demoRepo.reset();
  });

  // -------------------------------------------------------------------------
  // Journey A: Registration & Seat Pulse
  // -------------------------------------------------------------------------
  it("Journey A: Participant books pass, updates Seat Pulse, and cancels cleanly", () => {
    // 1. Initial counts
    const initialCounts = demoRepo.getBookedCounts();
    const event2Initial = initialCounts[2] ?? 0;

    // 2. Maya books pass for Event 2 ("Katha & Kinetic")
    const booking = demoRepo.bookPass(DEMO_PARTICIPANT_ID, 2, "booked");
    expect(booking.pass_code).toMatch(/^RNG-/);
    expect(booking.kind).toBe("booked");
    expect(booking.verified).toBe(false);

    // 3. Seat Pulse reflects the new booking
    const updatedCounts = demoRepo.getBookedCounts();
    expect(updatedCounts[2]).toBe(event2Initial + 1);

    // 4. Maya cancels the booking
    demoRepo.cancelPass(DEMO_PARTICIPANT_ID, booking.id);

    // 5. Seat Pulse decrements back
    const finalCounts = demoRepo.getBookedCounts();
    expect(finalCounts[2] ?? 0).toBe(event2Initial);
  });

  // -------------------------------------------------------------------------
  // Journey B: Attendance, Badges & Leaderboard
  // -------------------------------------------------------------------------
  it("Journey B: Organiser checks in attendee, awards verified_debut badge and updates leaderboard", () => {
    // Maya holds pass RNG-DEMO-1043 for Event 1
    const initialLeaderboard = demoRepo.getState().leaderboard;
    const mayaInitial = initialLeaderboard.find((l) => l.user_id === DEMO_PARTICIPANT_ID);
    const initialPoints = mayaInitial?.points ?? 0;

    // Organiser scans pass
    const checkin = demoRepo.verifyAttendance("RNG-DEMO-1043");
    expect(checkin.verified).toBe(true);
    expect(checkin.participantName).toBe("Maya Sen");

    // Attendance persisted
    const state = demoRepo.getState();
    const verifiedReg = state.registrations.find((r) => r.pass_code === "RNG-DEMO-1043");
    expect(verifiedReg?.verified).toBe(true);

    // Achievement awarded
    const hasDebutBadge = state.userAchievements.some(
      (a) => a.user_id === DEMO_PARTICIPANT_ID && a.code === "verified_debut"
    );
    expect(hasDebutBadge).toBe(true);

    // Leaderboard score updated
    const mayaUpdated = state.leaderboard.find((l) => l.user_id === DEMO_PARTICIPANT_ID);
    expect(mayaUpdated?.points).toBeGreaterThan(initialPoints);
  });

  // -------------------------------------------------------------------------
  // Journey C: Organiser Event Creation, Conflict Check & Publishing
  // -------------------------------------------------------------------------
  it("Journey C: Detects venue schedule conflicts and manages event publication", () => {
    const existing = demoRepo.getState().events[0]!;

    // 1. Conflict prevention: same venue & overlapping time
    expect(() => {
      demoRepo.createEvent(DEMO_ORGANISER_ID, {
        name: "Conflicting Concert",
        venue: existing.venue,
        startAt: existing.startAt,
        endAt: existing.endAt,
      });
    }).toThrow(/Schedule clash/i);

    // 2. Valid new event in draft
    const newEvent = demoRepo.createEvent(
      DEMO_ORGANISER_ID,
      {
        name: "Acoustic Courtyard Baul Jam",
        venue: "Heritage Open Amphitheatre",
        startAt: "2026-11-25T16:00:00Z",
        endAt: "2026-11-25T18:30:00Z",
        maxSeats: 120,
        price: 0,
      },
      false
    );
    expect(newEvent.published).toBe(false);

    // 3. Publish event
    const published = demoRepo.updateEventPublish(newEvent.id, true);
    expect(published.published).toBe(true);

    const inState = demoRepo.getState().events.find((e) => e.id === newEvent.id);
    expect(inState?.published).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Journey D: Admin Organiser Application Approval
  // -------------------------------------------------------------------------
  it("Journey D: Admin approves pending organiser application", () => {
    const stateBefore = demoRepo.getState();
    const applicant = stateBefore.organisers.find((o) => o.user_id === DEMO_APPLICANT_AARAV);
    expect(applicant?.status).toBe("pending");

    // Admin reviews and approves
    const approved = demoRepo.approveOrganiser(DEMO_APPLICANT_AARAV, "approved");
    expect(approved.status).toBe("approved");

    const stateAfter = demoRepo.getState();
    const updatedApplicant = stateAfter.organisers.find((o) => o.user_id === DEMO_APPLICANT_AARAV);
    expect(updatedApplicant?.status).toBe("approved");
  });

  // -------------------------------------------------------------------------
  // Journey E: Voucher Campaign Stock, Issuance & Redemption
  // -------------------------------------------------------------------------
  it("Journey E: Issues voucher to participant, decrements stock, and redeems at counter", () => {
    const stateBefore = demoRepo.getState();
    const campaign = stateBefore.campaigns.find((c) => c.id === 3)!;
    const initialStock = campaign.stock;

    // 1. Issue voucher
    const voucher = demoRepo.issueVoucher(DEMO_PARTICIPANT_ID, 3);
    expect(voucher.code).toMatch(/^RNG-/);
    expect(voucher.campaign_id).toBe(3);

    // 2. Stock decrements
    const stateAfterIssue = demoRepo.getState();
    const updatedCampaign = stateAfterIssue.campaigns.find((c) => c.id === 3)!;
    expect(updatedCampaign.stock).toBe(initialStock - 1);

    // 3. Appears in participant wallet
    const inWallet = stateAfterIssue.userVouchers.some((v) => v.id === voucher.id);
    expect(inWallet).toBe(true);

    // 4. Redeem voucher
    const redeemed = demoRepo.redeemVoucher(DEMO_PARTICIPANT_ID, voucher.id);
    expect(redeemed.id).toBe(voucher.id);

    // 5. Consumed from wallet
    const stateAfterRedeem = demoRepo.getState();
    expect(stateAfterRedeem.userVouchers.some((v) => v.id === voucher.id)).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Journey F: Event Echo Submission & Organiser Like
  // -------------------------------------------------------------------------
  it("Journey F: Participant shares Event Echo, organiser appreciates it", () => {
    // Maya holds confirmed pass RNG-DEMO-1043 for event 1, but has not checked in yet
    expect(() => {
      demoRepo.submitEcho(
        DEMO_PARTICIPANT_ID,
        "Maya Sen",
        1,
        5,
        "Attempt before check-in",
        [],
        [],
        "public",
        true
      );
    }).toThrow(/Attendance check-in must be verified/);

    // Organiser scans pass and verifies attendance
    demoRepo.verifyAttendance("RNG-DEMO-1043");

    // Now verified, participant shares Event Echo
    const echo = demoRepo.submitEcho(
      DEMO_PARTICIPANT_ID,
      "Maya Sen",
      1,
      5,
      "Soul-stirring Baul acoustic session in the courtyard!",
      ["Ritwik Das", "Aanya Sen"],
      [],
      "public",
      true // explicit participant consent
    );

    expect(echo.id).toBeDefined();
    expect(echo.rating).toBe(5);
    expect(echo.visibility).toBe("public");
    expect(echo.liked_by_organiser).toBe(false);

    // Organiser likes the echo
    const liked = demoRepo.toggleEchoLike(echo.id);
    expect(liked).toBe(true);

    const state = demoRepo.getState();
    const inState = state.echoes.find((e) => e.id === echo.id);
    expect(inState?.liked_by_organiser).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Journey G: Helpdesk Routing & Sponsorship Approval
  // -------------------------------------------------------------------------
  it("Journey G: Routes helpdesk requests to event organisers, and manages sponsorship approvals", () => {
    // 1. Participant submits help request for Craft Workshop (event 4)
    const helpReq = demoRepo.createHelpRequest(
      DEMO_PARTICIPANT_ID,
      "Maya Sen",
      "event",
      "Studio kiln firing collection schedule",
      "When can we collect our terracotta vessels after kiln firing?",
      4
    );
    expect(helpReq.routed_to).toBe(DEMO_ORGANISER_ID);
    expect(helpReq.status).toBe("open");

    // 2. Organiser answers
    const answered = demoRepo.answerHelp(
      helpReq.id,
      "Vessels will be fired overnight and ready for glazing pickup by Friday 4 PM at Studio 4B."
    );
    expect(answered.status).toBe("resolved");
    expect(answered.answer).toContain("glazing pickup");

    // 3. Organiser requests sponsorship
    const sponsor = demoRepo.requestSponsor(
      DEMO_ORGANISER_ID,
      "Bengal Artisan Tools Co.",
      "Silver",
      25000,
      "contact@bengalartisan.in",
      "Providing 20 woodblock carving knives and natural indigo vats."
    );
    expect(sponsor.status).toBe("requested");

    // 4. Admin reviews and approves sponsorship
    const approvedSponsor = demoRepo.updateSponsorStatus(sponsor.id, "active");
    expect(approvedSponsor.status).toBe("active");
  });

  // -------------------------------------------------------------------------
  // Persistence Across Restarts
  // -------------------------------------------------------------------------
  it("Persistence: Persists mutated state to .demo-data on disk and reloads after cache flush/restart", () => {
    // 1. Perform distinct mutations (use campaign 4 since 1 and 2 are in initial seed)
    const booking = demoRepo.bookPass(DEMO_PARTICIPANT_ID, 2, "booked");
    const voucher = demoRepo.issueVoucher(DEMO_PARTICIPANT_ID, 4);
    demoRepo.approveOrganiser("demo-applicant-aarav", "approved");

    // 2. Simulate server restart / memory wipe by reloading directly from disk
    const reloaded = demoRepo.reloadFromDisk();

    // 3. Verify all mutations persisted on disk
    expect(reloaded.registrations.some((r) => r.id === booking.id)).toBe(true);
    expect(reloaded.userVouchers.some((v) => v.id === voucher.id)).toBe(true);
    expect(reloaded.organisers.find((o) => o.user_id === DEMO_APPLICANT_AARAV)?.status).toBe("approved");
  });

  // -------------------------------------------------------------------------
  // Workspace Reset
  // -------------------------------------------------------------------------
  it("Workspace Reset: Resets all mutations cleanly to original reference seed", () => {
    // Mutate state
    demoRepo.bookPass(DEMO_PARTICIPANT_ID, 2, "booked");
    demoRepo.approveOrganiser(DEMO_APPLICANT_AARAV, "approved");

    // Reset
    const fresh = demoRepo.reset();
    expect(fresh.registrations.some((r) => r.event_id === 2 && r.kind === "booked")).toBe(false);
    expect(fresh.organisers.find((o) => o.user_id === DEMO_APPLICANT_AARAV)?.status).toBe("pending");
  });
});
