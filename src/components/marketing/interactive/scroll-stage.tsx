"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

export interface ScrollScene {
  id: string;
  eyebrow?: string;
  title: string;
  body: string;
  visual: ReactNode;
}

interface ScrollStageProps {
  scenes: ScrollScene[];
  className?: string;
}

/**
 * Scroll-driven stage. On desktop the visual area pins on the right (via
 * `position: sticky`) while text scenes scroll past on the left.
 *
 * Two non-obvious things to know if you touch this:
 *
 * 1. Every visual is mounted at the same time and stacked with absolute
 *    positioning inside the sticky stage. We do NOT toggle `display: none`
 *    on the inactive visuals, because the inner demo components
 *    (DiscoveryDemo, MockupGeneratorDemo, OpenerComposer) use
 *    IntersectionObserver to kick off their autoplay. An element with
 *    `display: none` has no layout box, so it never reports as intersecting
 *    — which would leave steps 2/3/4 stuck in their empty "idle" state.
 *
 * 2. `position: sticky` here pins relative to the viewport, which means NO
 *    ancestor of this component may have `overflow: hidden` / `overflow: auto`
 *    (including `overflow-x: hidden`, which the spec coerces overflow-y to
 *    `auto`). The marketing layout uses `overflow-x-clip` for that reason —
 *    `clip` doesn't create a scroll container.
 */
export function ScrollStage({ scenes, className = "" }: ScrollStageProps) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const sceneRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    function recompute() {
      const center = window.innerHeight / 2;
      let bestIdx = 0;
      let bestDist = Infinity;
      sceneRefs.current.forEach((el, i) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        // Skip refs whose layout box is gone (e.g. desktop refs while the
        // mobile layout is the one actually showing).
        if (rect.height === 0 && rect.width === 0) return;
        const elCenter = rect.top + rect.height / 2;
        const dist = Math.abs(elCenter - center);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      });
      setActive(bestIdx);
    }
    recompute();
    window.addEventListener("scroll", recompute, { passive: true });
    window.addEventListener("resize", recompute);
    return () => {
      window.removeEventListener("scroll", recompute);
      window.removeEventListener("resize", recompute);
    };
  }, [scenes.length]);

  return (
    <div className={`relative ${className}`}>
      {/* Mobile / tablet: vertically stacked scenes, visual right under its text */}
      <div className="lg:hidden space-y-20">
        {scenes.map((s, i) => (
          <div key={s.id} className="space-y-5">
            <SceneText scene={s} index={i} total={scenes.length} />
            <div>{s.visual}</div>
          </div>
        ))}
      </div>

      {/* Desktop: sticky right stage, scrolling left text.
          Default `align-items: stretch` makes the right grid cell match the
          left column's height, giving sticky the full scroll range to pin. */}
      <div className="hidden lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-12 xl:gap-16">
        <div className="space-y-[60vh] pt-[20vh] pb-[20vh]">
          {scenes.map((s, i) => (
            <div
              key={s.id}
              ref={(el) => {
                sceneRefs.current[i] = el;
              }}
              className="min-h-[40vh] flex flex-col justify-center"
            >
              <motion.div
                animate={{
                  opacity: active === i ? 1 : 0.32,
                  filter: active === i ? "blur(0px)" : "blur(0.5px)",
                }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              >
                <SceneText scene={s} index={i} total={scenes.length} />
              </motion.div>
            </div>
          ))}
        </div>

        <div className="relative h-full">
          <div className="sticky top-[12vh] h-[76vh]">
            <div className="relative w-full h-full flex items-center">
              {scenes.map((s, i) => (
                <motion.div
                  key={s.id}
                  className="absolute inset-0 flex items-center"
                  initial={false}
                  animate={{ opacity: active === i ? 1 : 0 }}
                  transition={{
                    duration: reduce ? 0 : 0.35,
                    ease: "easeOut",
                  }}
                  style={{
                    pointerEvents: active === i ? "auto" : "none",
                    zIndex: active === i ? 2 : 1,
                  }}
                  aria-hidden={active !== i}
                >
                  <div className="w-full">{s.visual}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SceneText({
  scene,
  index,
  total,
}: {
  scene: ScrollScene;
  index?: number;
  total?: number;
}) {
  return (
    <div>
      {scene.eyebrow && (
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[#C49AFF]">
            {scene.eyebrow}
          </span>
          {index !== undefined && total !== undefined && (
            <span className="text-[10px] font-mono text-white/30">
              {String(index + 1).padStart(2, "0")} /{" "}
              {String(total).padStart(2, "0")}
            </span>
          )}
        </div>
      )}
      <h3
        className="text-[28px] sm:text-[36px] font-semibold tracking-tight leading-[1.1] mb-3"
        style={{ letterSpacing: "-0.025em" }}
      >
        {scene.title}
      </h3>
      <p className="text-[15px] text-white/60 leading-relaxed max-w-md">
        {scene.body}
      </p>
    </div>
  );
}
