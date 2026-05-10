"use client";

/**
 * PreliminaryBanner — RETHINK §3.10b / risk #5.
 *
 * When the preliminary NBA has arrived but the final hasn't AND
 * 25 seconds have elapsed since mount, surface a small banner that
 * tells the rep the preliminary is dial-able while the final keeps
 * cooking. The banner auto-hides as soon as the final arrives; it is
 * also unmounted entirely when no preliminary exists, when the final
 * has already landed, or when 25s haven't passed yet.
 *
 * The 25s threshold lives in the `use-decision-surface` hook which
 * computes `preliminaryShippable`. The banner just listens.
 */

import { motion, useReducedMotion } from "framer-motion";

export interface PreliminaryBannerProps {
  visible: boolean;
  message: string;
}

export function PreliminaryBanner({ visible, message }: PreliminaryBannerProps) {
  const reducedMotion = useReducedMotion();
  if (!visible) return null;

  const fadeOnly = reducedMotion === true;

  return (
    <motion.div
      role="status"
      aria-live="polite"
      data-testid="preliminary-banner"
      initial={fadeOnly ? { opacity: 0 } : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={fadeOnly ? { opacity: 0 } : { opacity: 0, y: -4 }}
      transition={{ duration: 0.25 }}
      className="flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px]"
      style={{
        background: "color-mix(in srgb, var(--leadac-success) 12%, transparent)",
        borderColor: "color-mix(in srgb, var(--leadac-success) 35%, transparent)",
        color: "var(--leadac-text-1)",
      }}
    >
      <span
        aria-hidden
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ background: "var(--leadac-success)" }}
      />
      <span>{message}</span>
    </motion.div>
  );
}
