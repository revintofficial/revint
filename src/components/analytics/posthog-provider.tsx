"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { getVisitorId, isDoNotTrack } from "@/lib/analytics/visitor";

/**
 * PostHog bootstrap. Only loads when NEXT_PUBLIC_POSTHOG_KEY is set, so
 * local dev and preview environments are opt-in. Uses /ingest as a proxy
 * path (configured via next.config rewrites in production) to bypass ad
 * blockers without rerouting all telemetry through our server.
 *
 * Surface:
 *   - autocapture + manual pageviews + page leaves
 *   - session replay with PII masking on (mask_all_text + mask_all_inputs)
 *   - identify(visitorId) so the /admin session detail can deep-link
 *     into the PostHog replay player by sharing distinct_id with the
 *     first-party tracker
 *
 * We respect Do Not Track at the project level (PostHog's
 * `respect_dnt` flag is on), and additionally short-circuit init
 * here when DNT/GPC is set so the SDK never loads.
 */
export function PostHogProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (isDoNotTrack()) return;
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host =
      process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
    if (!key) return;
    if (posthog.__loaded) return;
    posthog.init(key, {
      api_host: host,
      capture_pageview: false,
      capture_pageleave: true,
      autocapture: true,
      persistence: "localStorage+cookie",
      // Honor DNT / GPC at the SDK level too. If the visitor opted
      // out, don't even ship the recording payload.
      respect_dnt: true,
      // Session replay. PII masking is mandatory because the marketing
      // pages do NOT enforce a consent banner; we treat replay like
      // a privileged forensic tool and mask everything by default.
      // Founders flip individual elements to recordable via
      // data-ph-capture-attribute-* if needed.
      disable_session_recording: false,
      session_recording: {
        maskAllInputs: true,
        // mask all text content. The replay still shows layout,
        // clicks, scroll, hover — which is 90% of the diagnostic value.
        maskTextSelector: "*",
      },
      loaded: (ph) => {
        if (process.env.NODE_ENV === "development") ph.debug(false);
        // Bridge to the first-party tracker. Sharing the distinct_id
        // means the /admin session detail can reach into PostHog and
        // resolve the matching replay even if PostHog rotated its
        // own anonymous id.
        const visitorId = getVisitorId();
        if (visitorId) {
          try {
            ph.identify(visitorId);
          } catch {
            // identify failures are non-fatal
          }
        }
      },
    });
  }, []);

  useEffect(() => {
    if (!pathname) return;
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    if (!posthog.__loaded) return;
    const url =
      pathname + (searchParams?.toString() ? `?${searchParams}` : "");
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}
