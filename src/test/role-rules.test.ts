import { describe, expect, it } from "vitest";
import { canActivateAdminInvite, canBookAsRole, canManageEvents, canSubmitEventReview } from "@/lib/role-rules";

describe("Rangora account boundaries", () => {
  it("does not allow organiser event management until approved", () => {
    expect(canManageEvents(["organizer"], "pending")).toBe(false);
    expect(canManageEvents(["organizer"], "rejected")).toBe(false);
    expect(canManageEvents(["organizer"], "approved")).toBe(true);
  });

  it("allows bookings only for participants", () => {
    expect(canBookAsRole(["participant"])).toBe(true);
    expect(canBookAsRole(["organizer"])).toBe(false);
    expect(canBookAsRole(["admin"])).toBe(false);
  });

  it("requires pending status, confirmed email, and valid invite before administrator activation", () => {
    expect(canActivateAdminInvite({ status: "pending" }, true, true)).toBe(true);
    expect(canActivateAdminInvite({ status: "approved" }, true, true)).toBe(false);
    expect(canActivateAdminInvite({ status: "pending" }, false, true)).toBe(false);
    expect(canActivateAdminInvite({ status: "pending" }, true, false)).toBe(false);
  });

  it("requires confirmed booking, concluded event, AND verified attendance for Event Echo submission", () => {
    // Only all 3 conditions true allows review
    expect(canSubmitEventReview(true, true, true)).toBe(true);

    // Confirmed booking alone must not qualify
    expect(canSubmitEventReview(true, true, false)).toBe(false);

    // Cannot submit if event is still ongoing
    expect(canSubmitEventReview(true, false, true)).toBe(false);

    // Cannot submit if not registered
    expect(canSubmitEventReview(false, true, true)).toBe(false);
  });
});