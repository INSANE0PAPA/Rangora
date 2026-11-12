// Rangora Asset & Poster Image Registry
// Self-hosted static festival imagery with CDN fallback

const localAssets: Record<string, string> = {
  "hero_festival.jpg": "/assets/events/festival-concert.jpg",
  "music_concert.jpg": "/assets/events/festival-concert.jpg",
  "cultural_dance.jpg": "/assets/events/festival-dance.jpg",
  "workshop_craft.jpg": "/assets/events/festival-craft.jpg",
  "tech_robotics.jpg": "/assets/events/festival-robotics.jpg",
  "gaming_arcade.jpg": "/assets/events/festival-robotics.jpg",
  "sports_arena.jpg": "/assets/events/festival-dance.jpg",
  "entrepreneur_pitch.jpg": "/assets/events/festival-robotics.jpg",
  "theatre_carnival.jpg": "/assets/events/festival-dance.jpg",
  "avatar_portrait_1.jpg": "/assets/events/festival-dance.jpg",
  "avatar_portrait_2.jpg": "/assets/events/festival-concert.jpg",
  "pottery_wheel.svg": "/assets/echoes/pottery_wheel.svg",
  "raga_concert.svg": "/assets/echoes/raga_concert.svg",
  "dance_kathak.svg": "/assets/echoes/dance_kathak.svg",
  "robotics_sprint.svg": "/assets/echoes/robotics_sprint.svg",
  "cinema_circle.svg": "/assets/echoes/cinema_circle.svg",
  "terracotta-vessel.jpg": "/assets/echoes/pottery_wheel.svg",
  "rangora-crest.svg": "/assets/events/rangora-crest.svg",
  "festival-concert.jpg": "/assets/events/festival-concert.jpg",
  "festival-craft.jpg": "/assets/events/festival-craft.jpg",
  "festival-dance.jpg": "/assets/events/festival-dance.jpg",
  "festival-robotics.jpg": "/assets/events/festival-robotics.jpg",
};

const DEFAULT_EVENT_IMAGE = "/assets/events/festival-concert.jpg";

export function img(name?: string | null): string {
  if (!name) return DEFAULT_EVENT_IMAGE;

  // Intercept old __l5e Lovable preview paths and resolve to local static files
  if (name.includes("/__l5e/assets-v1/") || name.includes("/assets-v1/")) {
    const filename = name.split("/").pop() ?? "";
    if (localAssets[filename]) {
      return localAssets[filename];
    }
    // Remote fallback if not mapped locally
    if (name.startsWith("/")) {
      return `https://4988b2fb-016a-4213-8914-120ca1d37a76.lovableproject.com${name}`;
    }
    return name;
  }

  // Handle local public paths like /assets/echoes/... or /assets/events/...
  if (name.startsWith("/assets/")) {
    return name;
  }

  // Handle full external URLs (https://...)
  if (name.startsWith("http://") || name.startsWith("https://")) {
    return name;
  }

  const key = name.split("/").pop() ?? "";
  return localAssets[key] ?? DEFAULT_EVENT_IMAGE;
}
