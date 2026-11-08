export const RECENT_SEARCHES_KEY = "rangora_recent_searches";

export function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list)
      ? list.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

export function saveRecentSearch(term: string): string[] {
  if (typeof window === "undefined") return [];
  const clean = term.trim();
  if (!clean) return getRecentSearches();
  try {
    const prev = getRecentSearches().filter((s) => s.toLowerCase() !== clean.toLowerCase());
    const next = [clean, ...prev].slice(0, 8);
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("rangora:recent-searches-updated"));
    return next;
  } catch {
    return [clean];
  }
}

export function clearRecentSearches(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(RECENT_SEARCHES_KEY);
    window.dispatchEvent(new Event("rangora:recent-searches-updated"));
  } catch {
    // Ignore
  }
}

