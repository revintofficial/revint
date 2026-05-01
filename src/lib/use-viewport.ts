"use client";

import { useEffect, useState } from "react";
import { breakpoints, type Viewport } from "./tokens";

/**
 * Returns the current viewport bucket — `'phone' | 'tablet' | 'desktop'`.
 *
 * Buckets:
 *   phone:   < 768px
 *   tablet:  768 – 1023px
 *   desktop: ≥ 1024px
 *
 * SSR-safe: returns `'desktop'` until hydration to avoid layout flash on
 * the server (most authed routes are desktop-biased today). The mobile shell
 * mounts CSS-driven fallbacks so this is purely a refinement after hydration.
 *
 * Subscribes to `matchMedia` rather than `resize` for fewer re-renders.
 */
export function useViewport(): Viewport {
  const [viewport, setViewport] = useState<Viewport>("desktop");

  useEffect(() => {
    const phoneMQ = window.matchMedia(`(max-width: ${breakpoints.tablet - 1}px)`);
    const tabletMQ = window.matchMedia(
      `(min-width: ${breakpoints.tablet}px) and (max-width: ${breakpoints.desktop - 1}px)`,
    );

    const compute = (): Viewport => {
      if (phoneMQ.matches) return "phone";
      if (tabletMQ.matches) return "tablet";
      return "desktop";
    };

    setViewport(compute());

    const onChange = () => setViewport(compute());
    phoneMQ.addEventListener("change", onChange);
    tabletMQ.addEventListener("change", onChange);
    return () => {
      phoneMQ.removeEventListener("change", onChange);
      tabletMQ.removeEventListener("change", onChange);
    };
  }, []);

  return viewport;
}

export function useIsPhone(): boolean {
  return useViewport() === "phone";
}

export function useIsTablet(): boolean {
  return useViewport() === "tablet";
}

export function useIsTouch(): boolean {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    setTouch(mq.matches);
    const onChange = () => setTouch(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return touch;
}

/**
 * Returns true if `prefers-reduced-motion: reduce` is honored.
 * Components should treat motion as decorative and skip it when this is true.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const onChange = () => setReduce(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduce;
}
