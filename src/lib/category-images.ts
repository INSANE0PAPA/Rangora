import { img } from "@/assets/rangora";

const map: Record<string, string> = {
  music: "music_concert.jpg",
  cultural: "cultural_dance.jpg",
  technical: "tech_robotics.jpg",
  workshops: "workshop_craft.jpg",
  gaming: "gaming_arcade.jpg",
  community: "theatre_carnival.jpg",
  sports: "sports_arena.jpg",
  entrepreneurship: "entrepreneur_pitch.jpg",
};

export const catImage = (slug: string) => img(map[slug]);
