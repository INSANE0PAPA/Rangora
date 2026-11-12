import { describe, expect, it } from "vitest";
import { checkEventConflicts, type SchedulableEvent } from "@/lib/event-conflicts";

describe("Event Conflict Detection (Level 1 & Level 2)", () => {
  const existingEvents: SchedulableEvent[] = [
    {
      id: 1,
      name: "Dusk Raga & Indie Folk Session",
      venue: "Banyan Open-Air Amphitheatre",
      startAt: "2026-11-12T17:30:00+05:30",
      endAt: "2026-11-12T20:30:00+05:30",
      organiserId: "d3300002-0000-4000-8000-000000000002", // Priya Nambiar
      published: true,
    },
    {
      id: 2,
      name: "Katha & Kinetic: Contemporary Dance Showcase",
      venue: "Gulmohar Conservatory Hall",
      startAt: "2026-11-12T18:00:00+05:30",
      endAt: "2026-11-12T20:00:00+05:30",
      organiserId: "d3300005-0000-4000-8000-000000000005", // Sneha Sen
      published: true,
    },
  ];

  it("should permit non-overlapping event at same venue", () => {
    const res = checkEventConflicts(existingEvents, {
      name: "Late Night Stargazing",
      venue: "Banyan Open-Air Amphitheatre",
      startAt: "2026-11-12T21:00:00+05:30",
      endAt: "2026-11-12T23:00:00+05:30",
      organiserId: "d3300002-0000-4000-8000-000000000002",
    });
    expect(res.hasConflict).toBe(false);
  });

  it("should reject Level 1 same-organiser conflict even at different venue", () => {
    const res = checkEventConflicts(existingEvents, {
      name: "Parallel Workshop",
      venue: "Student Innovation Studio", // Different venue!
      startAt: "2026-11-12T18:00:00+05:30",
      endAt: "2026-11-12T19:30:00+05:30",
      organiserId: "d3300002-0000-4000-8000-000000000002", // Same organiser!
    });
    expect(res.hasConflict).toBe(true);
    expect(res.type).toBe("organiser");
    expect(res.reason).toContain("ORGANISER CLASH");
    expect(res.reason).toContain("Dusk Raga");
  });

  it("should reject Level 2 venue conflict even with different organiser", () => {
    const res = checkEventConflicts(existingEvents, {
      name: "Rock Band Showdown",
      venue: "Banyan Open-Air Amphitheatre", // Same venue!
      startAt: "2026-11-12T19:00:00+05:30",
      endAt: "2026-11-12T21:30:00+05:30",
      organiserId: "d3300005-0000-4000-8000-000000000005", // Different organiser!
    });
    expect(res.hasConflict).toBe(true);
    expect(res.type).toBe("venue");
    expect(res.reason).toContain("VENUE CLASH");
    expect(res.reason).toContain("Banyan Open-Air Amphitheatre");
  });

  it("should reject invalid end time earlier than start time", () => {
    const res = checkEventConflicts(existingEvents, {
      name: "Time Traveler Session",
      venue: "Main Lawn",
      startAt: "2026-11-12T20:00:00+05:30",
      endAt: "2026-11-12T19:00:00+05:30",
      organiserId: "d3300002-0000-4000-8000-000000000002",
    });
    expect(res.hasConflict).toBe(true);
    expect(res.type).toBe("invalid_time");
  });
});

