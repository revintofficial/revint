"use client";

/**
 * Block — single section primitive for Lead Detail v2 (Phase 0).
 *
 * Three states: `expanded`, `collapsed-stub`, `hidden`. Owns the
 * AnimatePresence + `layout` boundary so the ancestor never reflows
 * during a stage-driven section reorder. Phases 1–4 declare blocks
 * by id and render their own content; the primitive owns motion +
 * stub chrome + the section heading.
 *
 * Risk callouts in build plan §6:
 *   - #2  layout shift on slow connections           → AnimatePresence is here, NOT in children
 *   - #12 collapse animation reflows ancestors       → `layout="position"`, NOT `layout="size"`
 *   - reduced-motion users get a fade-only fallback  → `useReducedMotion()`
 *   - CLS prevention: stub reserves min-height       → `data-state="stub"` style hook
 */

import { type ReactNode, useId } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

export type BlockState = "expanded" | "collapsed-stub" | "hidden";

export interface BlockProps {
  /** Stable id used as the AnimatePresence key + scroll target. */
  id: string;
  /** User-facing section title rendered inside the `<h2>`. */
  title: string;
  /** Three-state visibility. `hidden` removes the block from the layout entirely. */
  state: BlockState;
  /** Expanded body. Required for `expanded`; ignored otherwise. */
  children?: ReactNode;
  /** One-line summary rendered when `state === 'collapsed-stub'`. */
  stub?: ReactNode;
  /** Click target on the stub row. Phase 1 wires this to setState('expanded'). */
  onExpand?: () => void;
  /** Optional override for the stub's reserved min-height (px). Defaults to 44. */
  stubMinHeightPx?: number;
}

const STUB_MIN_HEIGHT_PX_DEFAULT = 44;

/**
 * Tiny easing/duration block kept consistent with the rest of the v2
 * surface so phases 1–4 don't fork motion params.
 */
const SPRING = { type: "spring" as const, stiffness: 320, damping: 38, mass: 0.6 };

export function Block({
  id,
  title,
  state,
  children,
  stub,
  onExpand,
  stubMinHeightPx = STUB_MIN_HEIGHT_PX_DEFAULT,
}: BlockProps) {
  const headingId = useId();
  const reducedMotion = useReducedMotion();

  if (state === "hidden") return null;

  const fadeOnly = reducedMotion === true;

  return (
    <motion.section
      id={id}
      data-block-id={id}
      data-state={state}
      aria-labelledby={headingId}
      layout={fadeOnly ? false : "position"}
      transition={fadeOnly ? { duration: 0.15 } : SPRING}
      className="relative rounded-xl border border-white/8 bg-white/2 backdrop-blur-sm"
      style={{ contain: "layout paint" }}
    >
      <header className="flex items-center justify-between gap-3 px-4 py-2.5">
        <h2
          id={headingId}
          className="text-[12px] font-medium uppercase tracking-[0.08em]"
          style={{ color: "var(--leadac-text-3)" }}
        >
          {title}
        </h2>
      </header>

      <AnimatePresence mode="popLayout" initial={false}>
        {state === "expanded" ? (
          <motion.div
            key={`${id}-expanded`}
            initial={fadeOnly ? { opacity: 0 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={fadeOnly ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={fadeOnly ? { duration: 0.15 } : SPRING}
            className="px-4 pb-4"
          >
            {children}
          </motion.div>
        ) : (
          <motion.button
            key={`${id}-stub`}
            type="button"
            onClick={onExpand}
            initial={fadeOnly ? { opacity: 0 } : { opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={fadeOnly ? { opacity: 0 } : { opacity: 0, y: 2 }}
            transition={fadeOnly ? { duration: 0.15 } : SPRING}
            className="flex w-full items-center justify-between gap-3 rounded-b-xl px-4 pb-3 pt-1 text-left text-[13px] transition-colors hover:bg-white/3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--leadac-500)/55"
            style={{
              color: "var(--leadac-text-2)",
              minHeight: stubMinHeightPx,
            }}
            aria-expanded={false}
            aria-controls={id}
          >
            <span className="truncate">{stub}</span>
            <span aria-hidden className="opacity-60">▸</span>
          </motion.button>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
