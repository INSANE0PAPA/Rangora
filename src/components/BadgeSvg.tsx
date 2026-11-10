import { useMemo } from "react";
import { generateBadgeSvg, parseBadgeDesign, type BadgeDesign } from "@/lib/badge-designer";

export function BadgeSvg({
  badge,
  className = "w-16 h-16",
  designOverride,
}: {
  badge: {
    title: string;
    description?: string | null;
    emoji?: string | null;
    points?: number;
  };
  className?: string;
  designOverride?: Partial<BadgeDesign>;
}) {
  const design = useMemo(() => {
    const base = parseBadgeDesign(badge);
    return designOverride ? { ...base, ...designOverride } : base;
  }, [badge, designOverride]);

  const svgContent = useMemo(() => generateBadgeSvg(design), [design]);

  return (
    <div
      className={`inline-block shrink-0 transition-transform hover:scale-105 ${className}`}
      title={`${design.title} (+${design.points} pts)`}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}

