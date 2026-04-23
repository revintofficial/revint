"use client";

import { useReportWebVitals } from "next/web-vitals";

/**
 * Ships Core Web Vitals to /api/web-vitals as a sendBeacon payload.
 *
 * Target SLOs (tracked in GSC + dashboard):
 *   LCP < 2.0s  CLS < 0.1  INP < 200ms
 *
 * The endpoint is fire-and-forget; failures must never block the page.
 */
export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    try {
      const body = JSON.stringify({
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        id: metric.id,
        path: window.location.pathname,
        ts: Date.now(),
      });
      const url = "/api/web-vitals";
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon(url, blob);
      } else {
        fetch(url, {
          method: "POST",
          body,
          headers: { "Content-Type": "application/json" },
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // Never let a telemetry failure surface to users.
    }
  });

  return null;
}
