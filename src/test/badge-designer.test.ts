import { describe, expect, it } from "vitest";
import { generateBadgeSvg, parseBadgeDesign } from "@/lib/badge-designer";

describe("Dynamic SVG Achievement Badge Generator", () => {
  it("should generate valid scalable SVG with Rangora palette", () => {
    const svg = generateBadgeSvg({
      title: "Mitti & Indigo Craft Guild",
      shape: "shield",
      template: "crest",
      primaryColor: "#C85A32",
      accentColor: "#FBF8EE",
      icon: "palette",
      points: 50,
    });

    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("#C85A32");
    expect(svg).toContain("#FBF8EE");
    expect(svg).toContain("+50P");
    expect(svg).toContain("badge-shadow-shield");
  });

  it("should generate ribbon template with JetBrains Mono typography", () => {
    const svg = generateBadgeSvg({
      title: "Robotics Sprint Champion",
      shape: "hexagon",
      template: "ribbon",
      primaryColor: "#23211D",
      accentColor: "#E29D38",
      icon: "code",
      points: 100,
    });

    expect(svg).toContain("+100 PTS");
    expect(svg).toContain("#23211D");
    expect(svg).toContain("#E29D38");
  });

  it("should parse embedded design metadata from badge description", () => {
    const design = parseBadgeDesign({
      title: "Pottery Master",
      description: "Throw a terracotta vessel | design:{\"shape\":\"shield\",\"template\":\"crest\",\"primaryColor\":\"#C85A32\",\"accentColor\":\"#FBF8EE\",\"icon\":\"palette\",\"points\":50}",
      points: 50,
    });

    expect(design.shape).toBe("shield");
    expect(design.template).toBe("crest");
    expect(design.icon).toBe("palette");
    expect(design.primaryColor).toBe("#C85A32");
    expect(design.description).toBe("Throw a terracotta vessel |");
  });

  it("should fall back to deterministic shape and colors when no design JSON is present", () => {
    const design = parseBadgeDesign({
      title: "Verified Debut",
      emoji: "🏆",
      description: "Attended first verified festival event",
      points: 50,
    });

    expect(design.shape).toBe("circle");
    expect(design.icon).toBe("trophy");
    expect(design.primaryColor).toBe("#E29D38");
  });
});

