// Rangora Dynamic SVG Achievement Badge Generator
// Produces scalable vector artwork in Rangora's visual language
// Palette: Ivory (#FBF8EE), Terracotta (#C85A32), Saffron (#E29D38), Charcoal (#23211D), Sage (#2B6E63)

export type BadgeShape = "shield" | "circle" | "star" | "diamond" | "hexagon";
export type BadgeTemplate = "crest" | "minimal" | "ornate" | "ribbon";

export type BadgeDesign = {
  title: string;
  description?: string;
  shape: BadgeShape;
  template: BadgeTemplate;
  primaryColor: string;
  accentColor: string;
  icon: string;
  points: number;
};

export const BADGE_SHAPES: Array<{ id: BadgeShape; label: string }> = [
  { id: "shield", label: "Heritage Shield" },
  { id: "circle", label: "Medallion Circle" },
  { id: "star", label: "Octagram Star" },
  { id: "diamond", label: "Geometric Diamond" },
  { id: "hexagon", label: "Guild Hexagon" },
];

export const BADGE_TEMPLATES: Array<{ id: BadgeTemplate; label: string }> = [
  { id: "crest", label: "Campus Crest" },
  { id: "minimal", label: "Modern Clean" },
  { id: "ornate", label: "Festival Ornate" },
  { id: "ribbon", label: "Honorary Ribbon" },
];

export const BADGE_COLORS = {
  primary: [
    { label: "Terracotta", value: "#C85A32" },
    { label: "Saffron Gold", value: "#E29D38" },
    { label: "Sage Green", value: "#2B6E63" },
    { label: "Charcoal Ink", value: "#23211D" },
    { label: "Crimson Festival", value: "#9E2A2B" },
  ],
  accent: [
    { label: "Warm Ivory", value: "#FBF8EE" },
    { label: "Saffron Glow", value: "#E29D38" },
    { label: "Terracotta Hue", value: "#C85A32" },
    { label: "Soft Sage", value: "#4D8B7E" },
    { label: "Bright Parchment", value: "#FFFBEA" },
  ],
};

export const BADGE_ICONS: Array<{ id: string; label: string; path: string }> = [
  {
    id: "sparkles",
    label: "Sparkles",
    path: "M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z",
  },
  {
    id: "star",
    label: "Star",
    path: "M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z",
  },
  {
    id: "trophy",
    label: "Trophy",
    path: "M6 2H18V5C18 8.31 15.31 11 12 11C8.69 11 6 8.31 6 5V2ZM4 4H6V8C4.9 8 4 7.1 4 6V4ZM20 4V6C20 7.1 19.1 8 18 8V4H20ZM10 13H14V17H10V13ZM7 19H17V21H7V19Z",
  },
  {
    id: "music",
    label: "Music",
    path: "M12 3V13.55C11.41 13.21 10.73 13 10 13C7.79 13 6 14.79 6 17C6 19.21 7.79 21 10 21C12.21 21 14 19.21 14 17V7H18V3H12Z",
  },
  {
    id: "palette",
    label: "Art & Craft",
    path: "M12 2C6.49 2 2 6.49 2 12C2 17.51 6.49 22 12 22C12.55 22 13 21.55 13 21C13 20.75 12.9 20.52 12.75 20.35C12.6 20.18 12.5 19.95 12.5 19.7C12.5 19.15 12.95 18.7 13.5 18.7H15C18.86 18.7 22 15.56 22 11.7C22 6.34 17.52 2 12 2ZM6.5 11.5C5.67 11.5 5 10.83 5 10C5 9.17 5.67 8.5 6.5 8.5C7.33 8.5 8 9.17 8 10C8 10.83 7.33 11.5 6.5 11.5ZM9.5 7.5C8.67 7.5 8 6.83 8 6C8 5.17 8.67 4.5 9.5 4.5C10.33 4.5 11 5.17 11 6C11 6.83 10.33 7.5 9.5 7.5ZM14.5 7.5C13.67 7.5 13 6.83 13 6C13 5.17 13.67 4.5 14.5 4.5C15.33 4.5 16 5.17 16 6C16 6.83 15.33 7.5 14.5 7.5ZM17.5 11.5C16.67 11.5 16 10.83 16 10C16 9.17 16.67 8.5 17.5 8.5C18.33 8.5 19 9.17 19 10C19 10.83 18.33 11.5 17.5 11.5Z",
  },
  {
    id: "flame",
    label: "Festival Flame",
    path: "M12 23C7.58 23 4 19.42 4 15C4 11.45 6.33 8.44 9.56 7.37C10.05 7.21 10.5 7.63 10.39 8.13C9.93 10.22 10.74 12.44 12.45 13.66C12.85 13.94 13.4 13.66 13.38 13.17C13.25 10.54 14.93 8.08 17.38 7.08C17.84 6.89 18.32 7.31 18.2 7.8C17.44 10.83 18.88 14.07 19.78 15.5C20 15.85 20 16.31 20 16.73C20 20.19 16.42 23 12 23Z",
  },
  {
    id: "code",
    label: "Robotics & Tech",
    path: "M9.4 16.6L4.8 12L9.4 7.4L8 6L2 12L8 18L9.4 16.6ZM14.6 16.6L19.2 12L14.6 7.4L16 6L22 12L16 18L14.6 16.6Z",
  },
  {
    id: "award",
    label: "Honor Ribbon",
    path: "M12 15C15.87 15 19 11.87 19 8C19 4.13 15.87 1 12 1C8.13 1 5 4.13 5 8C5 11.87 8.13 15 12 15ZM12 3C14.76 3 17 5.24 17 8C17 10.76 14.76 13 12 13C9.24 13 7 10.76 7 8C7 5.24 9.24 3 12 3ZM7 16.5L4 23L12 19L20 23L17 16.5L12 18.5L7 16.5Z",
  },
];

function getShapePath(shape: BadgeShape): string {
  switch (shape) {
    case "shield":
      return "M 50 10 L 85 22 C 85 58 70 82 50 92 C 30 82 15 58 15 22 Z";
    case "circle":
      return "M 50 10 A 40 40 0 1 0 50 90 A 40 40 0 1 0 50 10 Z";
    case "star":
      return "M 50 8 L 61 28 L 83 23 L 74 43 L 90 58 L 69 66 L 68 89 L 50 76 L 32 89 L 31 66 L 10 58 L 26 43 L 17 23 L 39 28 Z";
    case "diamond":
      return "M 50 10 L 88 50 L 50 90 L 12 50 Z";
    case "hexagon":
      return "M 50 10 L 85 30 L 85 70 L 50 90 L 15 70 L 15 30 Z";
    default:
      return "M 50 10 A 40 40 0 1 0 50 90 A 40 40 0 1 0 50 10 Z";
  }
}

function getInnerShapePath(shape: BadgeShape): string {
  switch (shape) {
    case "shield":
      return "M 50 16 L 79 26 C 79 54 66 76 50 85 C 34 76 21 54 21 26 Z";
    case "circle":
      return "M 50 16 A 34 34 0 1 0 50 84 A 34 34 0 1 0 50 16 Z";
    case "star":
      return "M 50 16 L 59 32 L 76 28 L 69 44 L 82 56 L 65 62 L 64 81 L 50 70 L 36 81 L 35 62 L 18 56 L 31 44 L 24 28 L 41 32 Z";
    case "diamond":
      return "M 50 18 L 80 50 L 50 82 L 20 50 Z";
    case "hexagon":
      return "M 50 16 L 79 33 L 79 67 L 50 84 L 21 67 L 21 33 Z";
    default:
      return "M 50 16 A 34 34 0 1 0 50 84 A 34 34 0 1 0 50 16 Z";
  }
}

/**
 * Generate a standalone SVG markup string for a badge design
 */
export function generateBadgeSvg(design: BadgeDesign): string {
  const outerPath = getShapePath(design.shape);
  const innerPath = getInnerShapePath(design.shape);
  const iconDef = BADGE_ICONS.find((i) => i.id === design.icon) || BADGE_ICONS[0]!;

  const primary = design.primaryColor || "#C85A32";
  const accent = design.accentColor || "#FBF8EE";
  const title = (design.title || "Campus Award").slice(0, 24);
  const points = design.points ?? 25;

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" class="rangora-badge-svg" width="100%" height="100%">
  <defs>
    <filter id="badge-shadow-${design.shape}" x="-10%" y="-10%" width="125%" height="125%">
      <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#23211D" flood-opacity="0.25" />
    </filter>
    <linearGradient id="badge-grad-${design.shape}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${primary}" />
      <stop offset="100%" stop-color="${primary}" stop-opacity="0.85" />
    </linearGradient>
  </defs>

  <!-- Outer Shape Base -->
  <path d="${outerPath}" fill="url(#badge-grad-${design.shape})" stroke="#23211D" stroke-width="2.5" stroke-linejoin="round" filter="url(#badge-shadow-${design.shape})" />

  <!-- Inner Inset Border -->
  <path d="${innerPath}" fill="none" stroke="${accent}" stroke-width="1.2" stroke-dasharray="${design.template === "ornate" ? "3,2" : "none"}" opacity="0.85" />

  <!-- Icon Center Symbol -->
  <g transform="translate(36, 28) scale(1.15)">
    <path d="${iconDef.path}" fill="${accent}" stroke="#23211D" stroke-width="0.8" />
  </g>

  <!-- Center Decorative Ring if Crest Template -->
  ${
    design.template === "crest"
      ? `<circle cx="50" cy="42" r="18" fill="none" stroke="${accent}" stroke-width="0.75" stroke-dasharray="2,2" opacity="0.7"/>`
      : ""
  }

  <!-- Ribbon Bar at Bottom -->
  ${
    design.template === "ribbon"
      ? `
    <rect x="18" y="68" width="64" height="15" rx="3" fill="#23211D" stroke="${accent}" stroke-width="1" />
    <text x="50" y="79" font-family="'JetBrains Mono', monospace" font-size="7.5" font-weight="bold" fill="${accent}" text-anchor="middle" letter-spacing="0.5">
      +${points} PTS
    </text>
  `
      : `
    <!-- Simple Points Indicator -->
    <rect x="32" y="66" width="36" height="12" rx="6" fill="#23211D" opacity="0.85" />
    <text x="50" y="75" font-family="'JetBrains Mono', monospace" font-size="7.5" font-weight="bold" fill="${accent}" text-anchor="middle">
      +${points}P
    </text>
  `
  }
</svg>
`.trim();
}

/**
 * Parse design configuration from badge description or return default
 */
export function parseBadgeDesign(
  badge: {
    title: string;
    description?: string | null;
    emoji?: string | null;
    points?: number;
  }
): BadgeDesign {
  const desc = badge.description ?? "";
  const match = desc.match(/design:({.+})/);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      return {
        title: badge.title,
        description: desc.replace(/design:{.+}/, "").trim(),
        shape: parsed.shape || "shield",
        template: parsed.template || "crest",
        primaryColor: parsed.primaryColor || "#C85A32",
        accentColor: parsed.accentColor || "#FBF8EE",
        icon: parsed.icon || "sparkles",
        points: badge.points ?? 20,
      };
    } catch {
      // Fall through to deterministic mapping
    }
  }

  // Deterministic mapping from emoji/title to ensure variety
  const emoji = badge.emoji ?? "✦";
  let icon = "sparkles";
  let shape: BadgeShape = "shield";
  let primaryColor = "#C85A32";

  if (emoji.includes("🏆") || badge.title.toLowerCase().includes("champ") || badge.title.toLowerCase().includes("debut")) {
    icon = "trophy";
    shape = "circle";
    primaryColor = "#E29D38";
  } else if (emoji.includes("🎵") || badge.title.toLowerCase().includes("raga") || badge.title.toLowerCase().includes("music")) {
    icon = "music";
    shape = "circle";
    primaryColor = "#2B6E63";
  } else if (emoji.includes("🎨") || badge.title.toLowerCase().includes("craft") || badge.title.toLowerCase().includes("pottery")) {
    icon = "palette";
    shape = "shield";
    primaryColor = "#C85A32";
  } else if (emoji.includes("🤖") || badge.title.toLowerCase().includes("robo") || badge.title.toLowerCase().includes("code")) {
    icon = "code";
    shape = "hexagon";
    primaryColor = "#23211D";
  } else if (badge.title.toLowerCase().includes("flame") || badge.title.toLowerCase().includes("spirit")) {
    icon = "flame";
    shape = "star";
    primaryColor = "#9E2A2B";
  }

  return {
    title: badge.title,
    description: desc,
    shape,
    template: "crest",
    primaryColor,
    accentColor: "#FBF8EE",
    icon,
    points: badge.points ?? 20,
  };
}

/**
 * Serialize badge design into description string
 */
export function serializeBadgeDesign(
  description: string,
  design: {
    shape: BadgeShape;
    template: BadgeTemplate;
    primaryColor: string;
    accentColor: string;
    icon: string;
  }
): string {
  const cleanDesc = description.replace(/\s*design:\{.+\}/, "").trim();
  const designJson = JSON.stringify({
    shape: design.shape,
    template: design.template,
    primaryColor: design.primaryColor,
    accentColor: design.accentColor,
    icon: design.icon,
  });
  return cleanDesc ? `${cleanDesc}\ndesign:${designJson}` : `design:${designJson}`;
}
