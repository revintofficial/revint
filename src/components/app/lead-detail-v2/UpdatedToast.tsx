"use client";

/**
 * UpdatedToast — replaces the "glow on final" pattern from the legacy
 * NbaCard. RETHINK §4.5 specifies: when the final NBA arrives, fade
 * a small "✨ updated 18s ago" toast in for 4 seconds and then fade
 * out. The toast lives in a portal so it cannot push the queue strip
 * (Phase 3) up — CLS budget is 0 (PLAN §5.6 layout-shift policy).
 *
 * Accessibility: `role="status"` + `aria-live="polite"` so a screen
 * reader announces it once; `pointer-events: none` so it never
 * intercepts a click on the underlying CTA.
 */

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";

const TOAST_DURATION_MS = 4_000;

export interface UpdatedToastProps {
  /**
   * A stable identifier that changes whenever the data the toast is
   * announcing has refreshed. Most commonly the `final.id` of the
   * Next Best Action — when SDR_BRAIN ships a new final action this
   * id changes and the toast reappears.
   */
  triggerId: string | null;
  /** Localized message; supports a `{seconds}` placeholder. */
  template: string;
}

function subscribeNoop(): () => void {
  return () => {};
}

function readMounted(): boolean {
  return typeof document !== "undefined";
}

function readMountedServer(): boolean {
  return false;
}

export function UpdatedToast({ triggerId, template }: UpdatedToastProps) {
  const reducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const mounted = useSyncExternalStore(
    subscribeNoop,
    readMounted,
    readMountedServer,
  );

  useEffect(() => {
    if (!triggerId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(true);
    setSeconds(0);
    const start = Date.now();
    const tick = setInterval(() => {
      setSeconds(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    }, 1_000);
    const dismiss = setTimeout(() => setVisible(false), TOAST_DURATION_MS);
    return () => {
      clearInterval(tick);
      clearTimeout(dismiss);
    };
  }, [triggerId]);

  if (!mounted) return null;

  const message = template.replace("{seconds}", String(seconds));
  const fadeOnly = reducedMotion === true;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 top-[68px] z-40 flex justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence>
        {visible ? (
          <motion.div
            key={triggerId ?? "idle"}
            initial={fadeOnly ? { opacity: 0 } : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={fadeOnly ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-none flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] backdrop-blur-md"
            style={{
              background: "hsl(var(--leadac-h) var(--leadac-ns) 14% / 0.85)",
              color: "var(--leadac-text-1)",
              border: "0.5px solid hsl(0 0% 100% / 0.14)",
              boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
            }}
          >
            <Sparkles
              className="h-3 w-3"
              aria-hidden
              style={{ color: "var(--leadac-500)" }}
            />
            <span>{message}</span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
