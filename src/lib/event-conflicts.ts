// Rangora Two-Level Event Scheduling Conflict Detection
// Level 1: Same Organiser Conflict (an organiser cannot host overlapping events even at different venues)
// Level 2: Venue Conflict (two different events cannot occupy the same venue during overlapping time)
// Overlap condition: new_start < existing_end AND new_end > existing_start

export type SchedulableEvent = {
  id?: number;
  name: string;
  venue: string;
  startAt: string | Date;
  endAt: string | Date;
  organiserId?: string | null;
  published?: boolean;
};

export type ConflictResult = {
  hasConflict: boolean;
  type?: "organiser" | "venue" | "invalid_time";
  conflictingEventName?: string;
  conflictingVenue?: string;
  conflictingTime?: string;
  reason?: string;
};

export function checkEventConflicts(
  existingEvents: SchedulableEvent[],
  proposed: SchedulableEvent
): ConflictResult {
  const newStart = new Date(proposed.startAt).getTime();
  const newEnd = new Date(proposed.endAt).getTime();

  if (isNaN(newStart) || isNaN(newEnd)) {
    return {
      hasConflict: true,
      type: "invalid_time",
      reason: "Please specify valid start and end dates and times.",
    };
  }

  if (newEnd <= newStart) {
    return {
      hasConflict: true,
      type: "invalid_time",
      reason: "Event end time must be after the start time.",
    };
  }

  for (const existing of existingEvents) {
    if (proposed.id && existing.id === proposed.id) continue;
    if (existing.published === false) continue;

    const exStart = new Date(existing.startAt).getTime();
    const exEnd = new Date(existing.endAt).getTime();

    if (isNaN(exStart) || isNaN(exEnd)) continue;

    // Overlap formula: new_start < existing_end AND new_end > existing_start
    const overlaps = newStart < exEnd && newEnd > exStart;
    if (!overlaps) continue;

    const timeRangeStr = `${new Date(existing.startAt).toLocaleDateString([], { month: "short", day: "numeric" })} ${new Date(existing.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – ${new Date(existing.endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

    // Level 1: Same organiser conflict (even across different venues)
    if (
      proposed.organiserId &&
      existing.organiserId &&
      proposed.organiserId === existing.organiserId
    ) {
      return {
        hasConflict: true,
        type: "organiser",
        conflictingEventName: existing.name,
        conflictingVenue: existing.venue,
        conflictingTime: timeRangeStr,
        reason: `ORGANISER CLASH: You already have another event "${existing.name}" scheduled at this time (${timeRangeStr}). Organisers cannot host concurrent overlapping events.`,
      };
    }

    // Level 2: Venue conflict (different events cannot occupy the same venue at the same time)
    if (
      existing.venue &&
      proposed.venue &&
      existing.venue.trim().toLowerCase() === proposed.venue.trim().toLowerCase()
    ) {
      return {
        hasConflict: true,
        type: "venue",
        conflictingEventName: existing.name,
        conflictingVenue: existing.venue,
        conflictingTime: timeRangeStr,
        reason: `VENUE CLASH: "${existing.name}" is already occupying "${existing.venue}" during this time (${timeRangeStr}). Please choose another campus venue or time slot.`,
      };
    }
  }

  return { hasConflict: false };
}

// Level 3: Participant Booking Conflict (a participant cannot physically attend two overlapping events simultaneously)
export function checkParticipantBookingConflict(
  bookedEvents: SchedulableEvent[],
  proposed: SchedulableEvent
): ConflictResult {
  const newStart = new Date(proposed.startAt).getTime();
  const newEnd = new Date(proposed.endAt).getTime();

  if (isNaN(newStart) || isNaN(newEnd)) {
    return { hasConflict: false };
  }

  for (const booked of bookedEvents) {
    if (proposed.id && booked.id === proposed.id) continue;

    const bStart = new Date(booked.startAt).getTime();
    const bEnd = new Date(booked.endAt).getTime();

    if (isNaN(bStart) || isNaN(bEnd)) continue;

    // Overlap condition
    if (newStart < bEnd && newEnd > bStart) {
      const timeRangeStr = `${new Date(booked.startAt).toLocaleDateString([], { month: "short", day: "numeric" })} ${new Date(booked.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – ${new Date(booked.endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
      return {
        hasConflict: true,
        type: "organiser", // using organiser/time conflict
        conflictingEventName: booked.name,
        conflictingVenue: booked.venue,
        conflictingTime: timeRangeStr,
        reason: `Schedule Clash: You already hold a reserved pass for "${booked.name}" at ${booked.venue} (${timeRangeStr}). Both celebrations occur concurrently.`,
      };
    }
  }

  return { hasConflict: false };
}

export type EventClashPair = {
  eventA: SchedulableEvent;
  eventB: SchedulableEvent;
  venue: string;
  overlapTime: string;
  type: "venue" | "time";
};

// Admin level: Scan all catalogue events for any venue or timing clashes
export function findAllCatalogueClashes(events: SchedulableEvent[]): EventClashPair[] {
  const clashes: EventClashPair[] = [];

  for (let i = 0; i < events.length; i++) {
    const a = events[i];
    if (!a || a.published === false) continue;
    const aStart = new Date(a.startAt).getTime();
    const aEnd = new Date(a.endAt).getTime();
    if (isNaN(aStart) || isNaN(aEnd)) continue;

    for (let j = i + 1; j < events.length; j++) {
      const b = events[j];
      if (!b || b.published === false) continue;
      const bStart = new Date(b.startAt).getTime();
      const bEnd = new Date(b.endAt).getTime();
      if (isNaN(bStart) || isNaN(bEnd)) continue;

      // Check overlap
      if (aStart < bEnd && aEnd > bStart) {
        const sameVenue = a.venue.trim().toLowerCase() === b.venue.trim().toLowerCase();
        const overlapStr = `${new Date(Math.max(aStart, bStart)).toLocaleDateString([], { month: "short", day: "numeric" })} ${new Date(Math.max(aStart, bStart)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
        clashes.push({
          eventA: a,
          eventB: b,
          venue: sameVenue ? a.venue : `${a.venue} & ${b.venue}`,
          overlapTime: overlapStr,
          type: sameVenue ? "venue" : "time",
        });
      }
    }
  }

  return clashes;
}

