import { categories, events, festivals, type REvent } from "@/data/catalog";

export const catById = (id: number) => categories.find((c) => c.id === id);
export const festById = (id: number) => festivals.find((f) => f.id === id);

export function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export function pulse(booked: number, max: number) {
  const ratio = max ? booked / max : 0;
  const left = Math.max(0, max - booked);
  if (left === 0) return { cls: "pulse-full", label: "Sold out", left, ratio };
  if (ratio >= 0.85) return { cls: "pulse-urgent", label: "Almost full", left, ratio };
  if (ratio >= 0.5) return { cls: "pulse-warm", label: "Filling fast", left, ratio };
  return { cls: "pulse-available", label: "Plenty of places", left, ratio };
}

/** Events matching the participant's preferred category slugs, featured first. */
export function matchedEvents(prefs: string[], limit = 6, source: REvent[] = events): REvent[] {
  const ids = categories.filter((c) => prefs.includes(c.slug)).map((c) => c.id);
  return source
    .filter((e) => ids.includes(e.categoryId))
    .sort((a, b) => Number(b.featured) - Number(a.featured) || a.startAt.localeCompare(b.startAt))
    .slice(0, limit);
}

/** "Hidden gems": smaller, non-featured events with open seats. */
export function hiddenGems(counts: Record<number, number>, limit = 6, source: REvent[] = events): REvent[] {
  return source
    .filter((e) => !e.featured && (counts[e.id] ?? 0) < e.maxSeats)
    .sort((a, b) => a.maxSeats - b.maxSeats)
    .slice(0, limit);
}
