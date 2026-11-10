import { useEffect, useRef } from "react";

interface Dot {
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  colorIndex: number;
}

interface Palette {
  dots: string[];
}

const LIGHT_PALETTE: Palette = {
  dots: [
    "rgba(200, 90, 50, 0.70)",   // Terracotta
    "rgba(226, 157, 56, 0.75)",  // Saffron Gold
    "rgba(43, 110, 99, 0.70)",   // Sage Teal
    "rgba(140, 45, 75, 0.65)",   // Cultural Magenta
    "rgba(35, 33, 29, 0.50)",    // Charcoal Ink
  ],
};

const DARK_PALETTE: Palette = {
  dots: [
    "rgba(255, 87, 34, 0.85)",   // Electric Terracotta / Coral
    "rgba(245, 162, 1, 0.85)",   // Radiant Solar Saffron
    "rgba(60, 230, 252, 0.85)",  // Electric Cyan
    "rgba(192, 132, 252, 0.85)", // Neon Violet
    "rgba(214, 253, 82, 0.85)",  // Electric Lime
    "rgba(248, 250, 252, 0.75)", // Crisp Starlight Silver
  ],
};

function getActivePalette(): Palette {
  if (typeof document === "undefined") return LIGHT_PALETTE;
  const isDark =
    document.documentElement.classList.contains("dark") ||
    document.documentElement.dataset["theme"] === "dark";
  return isDark ? DARK_PALETTE : LIGHT_PALETTE;
}

export function DotField({
  className = "",
  fixed = false,
}: {
  className?: string;
  fixed?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const parent = fixed ? null : canvas.parentElement;
    if (!fixed && !parent) return;

    let palette = getActivePalette();
    let dots: Dot[] = [];
    let animationFrameId: number | null = null;
    let width = 0;
    let height = 0;
    let isReducedMotion = false;

    // Pointer state
    const mouse = {
      x: -9999,
      y: -9999,
      active: false,
    };

    function checkReducedMotion(): boolean {
      if (typeof window === "undefined") return false;
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    isReducedMotion = checkReducedMotion();

    function initDots() {
      if (!canvas) return;
      dots = [];
      const spacing = 26;
      const cols = Math.ceil(width / spacing) + 1;
      const rows = Math.ceil(height / spacing) + 1;
      const startX = ((width - (cols - 1) * spacing) / 2);
      const startY = ((height - (rows - 1) * spacing) / 2);

      for (let r = 0; r < rows; r++) {
        const rowOffsetX = (r % 2) * (spacing * 0.35);
        for (let c = 0; c < cols; c++) {
          const bx = startX + c * spacing + rowOffsetX;
          const by = startY + r * spacing;

          // Distinct visible dot sizes: accent nodes and ambient dots
          const colorIndex = (c * 2 + r * 3) % palette.dots.length;
          const radius = (c + r) % 4 === 0 ? 2.6 : (c * 2 + r) % 3 === 0 ? 2.1 : 1.7;

          dots.push({
            baseX: bx,
            baseY: by,
            x: bx,
            y: by,
            vx: 0,
            vy: 0,
            radius,
            colorIndex,
          });
        }
      }
    }

    function renderStatic() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < palette.dots.length; i++) {
        ctx.beginPath();
        ctx.fillStyle = palette.dots[i] ?? "rgba(200, 90, 50, 0.3)";
        for (const dot of dots) {
          if (dot.colorIndex === i) {
            ctx.moveTo(dot.baseX + dot.radius, dot.baseY);
            ctx.arc(dot.baseX, dot.baseY, dot.radius, 0, Math.PI * 2);
          }
        }
        ctx.fill();
      }
    }

    function updateAndDraw(time: number) {
      if (!ctx) return;

      const interactionRadius = 155;
      const interactionRadiusSq = interactionRadius * interactionRadius;
      const spring = 0.042;
      const damping = 0.84;

      ctx.clearRect(0, 0, width, height);

      // Group dots by color index for optimized batch drawing
      const colorGroups: Dot[][] = palette.dots.map(() => []);

      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i];
        if (!dot) continue;

        if (mouse.active) {
          const dx = dot.x - mouse.x;
          const dy = dot.y - mouse.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < interactionRadiusSq && distSq > 0) {
            const dist = Math.sqrt(distSq);
            const normDist = dist / interactionRadius; // 0 to 1
            const influence = Math.cos(normDist * Math.PI * 0.5); // Smooth cosine curve
            const smoothPower = influence * influence;

            // Wave-like ripple responding with distance and time
            const ripple = Math.sin(dist * 0.085 - time * 0.005) * 3.5 * smoothPower;

            // Upward pull around the cursor with local falloff
            const upwardPull = -12 * smoothPower;

            // Smooth displacement force away from cursor with upward bias
            const pushX = (dx / dist) * (8 * smoothPower + ripple);
            const pushY = (dy / dist) * (6 * smoothPower + ripple) + upwardPull;

            dot.vx += pushX * 0.16;
            dot.vy += pushY * 0.16;
          }
        }

        // Spring return towards baseline
        const ax = (dot.baseX - dot.x) * spring;
        const ay = (dot.baseY - dot.y) * spring;
        dot.vx = (dot.vx + ax) * damping;
        dot.vy = (dot.vy + ay) * damping;
        dot.x += dot.vx;
        dot.y += dot.vy;

        colorGroups[dot.colorIndex]?.push(dot);
      }

      // Draw all dots in batched path calls
      for (let c = 0; c < palette.dots.length; c++) {
        const group = colorGroups[c];
        if (!group || group.length === 0) continue;

        ctx.beginPath();
        ctx.fillStyle = palette.dots[c] ?? "rgba(200, 90, 50, 0.3)";
        for (let i = 0; i < group.length; i++) {
          const dot = group[i];
          if (!dot) continue;
          ctx.moveTo(dot.x + dot.radius, dot.y);
          ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
        }
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(updateAndDraw);
    }

    function resize() {
      if (!canvas) return;
      if (fixed) {
        width = Math.floor(window.innerWidth);
        height = Math.floor(window.innerHeight);
      } else {
        if (!parent) return;
        const rect = parent.getBoundingClientRect();
        width = Math.floor(rect.width);
        height = Math.floor(rect.height);
      }

      if (width <= 0 || height <= 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx?.setTransform(1, 0, 0, 1, 0, 0);
      ctx?.scale(dpr, dpr);

      initDots();

      if (isReducedMotion) {
        renderStatic();
      }
    }

    // Pointer events
    function onPointerMove(event: PointerEvent) {
      if (isReducedMotion) return;
      if (event.pointerType !== "mouse") {
        mouse.active = false;
        return;
      }
      if (fixed) {
        mouse.x = event.clientX;
        mouse.y = event.clientY;
      } else if (parent) {
        const rect = parent.getBoundingClientRect();
        mouse.x = event.clientX - rect.left;
        mouse.y = event.clientY - rect.top;
      }
      mouse.active = true;
    }

    function onPointerLeave() {
      mouse.active = false;
    }

    // Theme changes detection
    const themeObserver = new MutationObserver(() => {
      palette = getActivePalette();
      if (isReducedMotion) {
        renderStatic();
      }
    });

    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    // Motion preference listener
    const motionMediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    function onMotionChange(event: MediaQueryListEvent) {
      isReducedMotion = event.matches;
      if (isReducedMotion) {
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
        renderStatic();
      } else if (!animationFrameId) {
        animationFrameId = requestAnimationFrame(updateAndDraw);
      }
    }

    motionMediaQuery.addEventListener("change", onMotionChange);

    // Resize observer or window listener
    let resizeObserver: ResizeObserver | null = null;
    if (fixed) {
      window.addEventListener("resize", resize);
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("pointerleave", onPointerLeave, { passive: true });
    } else if (parent) {
      resizeObserver = new ResizeObserver(() => {
        resize();
      });
      resizeObserver.observe(parent);
      parent.addEventListener("pointermove", onPointerMove, { passive: true });
      parent.addEventListener("pointerleave", onPointerLeave, { passive: true });
    }

    // Initial setup
    resize();

    if (!isReducedMotion) {
      animationFrameId = requestAnimationFrame(updateAndDraw);
    } else {
      renderStatic();
    }

    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      if (fixed) {
        window.removeEventListener("resize", resize);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerleave", onPointerLeave);
      } else if (parent) {
        parent.removeEventListener("pointermove", onPointerMove);
        parent.removeEventListener("pointerleave", onPointerLeave);
        resizeObserver?.disconnect();
      }
      themeObserver.disconnect();
      motionMediaQuery.removeEventListener("change", onMotionChange);
    };
  }, [fixed]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none ${fixed ? "fixed inset-0 z-0 h-screen w-screen" : "absolute inset-0 z-0 h-full w-full"} ${className}`}
      aria-hidden="true"
    />
  );
}

