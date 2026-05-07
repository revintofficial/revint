"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  detectDevice,
  getOrCreateSession,
  getVisitorId,
  isDoNotTrack,
  parseUTM,
  touchSession,
  type UtmSnapshot,
} from "@/lib/analytics/visitor";
import { startScrollTracker } from "@/lib/analytics/scroll-tracker";

/**
 * First-party marketing analytics tracker.
 *
 * Mounts once per visit on the marketing route group and emits a
 * stream of events to /api/track/marketing. Events are batched and
 * flushed every 5 seconds, on `visibilitychange:hidden`, and on
 * `pagehide` via `navigator.sendBeacon` so we don't lose data when
 * the visitor clicks away.
 *
 * Bridge to PostHog: when PostHog is loaded we pull its session id
 * once it's available and ship it to the ingest endpoint. The admin
 * detail view uses that id to deep-link the session-replay player.
 *
 * What we DO NOT capture (PII / privacy):
 *   - form input values (only field names + duration)
 *   - email/name in any property
 *   - raw IP (server hashes it)
 *   - any data when navigator.doNotTrack === "1"
 */

const FLUSH_INTERVAL_MS = 5_000;
const MAX_BATCH = 50;

type TrackEvent = {
  type: string;
  ts: number;
  path: string;
  properties?: Record<string, unknown>;
};

type FlushPayload = {
  visitorId: string;
  sessionId: string;
  sessionIsNew: boolean;
  posthogSessionId: string | null;
  utm: UtmSnapshot;
  referrer: string | null;
  landingPath: string;
  device: ReturnType<typeof detectDevice>;
  userAgent: string;
  events: TrackEvent[];
};

interface PostHogLike {
  __loaded?: boolean;
  get_session_id?: () => string;
  identify?: (id: string) => void;
  capture?: (name: string, props?: Record<string, unknown>) => void;
}

function readPostHog(): PostHogLike | null {
  if (typeof window === "undefined") return null;
  const ph = (window as Window & { posthog?: PostHogLike }).posthog;
  if (!ph || !ph.__loaded) return null;
  return ph;
}

function getCtaContext(target: HTMLElement): {
  ctaId: string | null;
  text: string;
  selector: string;
  isCta: boolean;
} {
  // Walk up to find the closest interactive ancestor; clicks land on
  // child spans/icons more often than the actual button.
  const interactive = target.closest(
    "[data-cta], [data-track], a[href], button, [role='button']",
  ) as HTMLElement | null;
  if (!interactive) {
    return { ctaId: null, text: "", selector: "", isCta: false };
  }
  const cta = interactive.getAttribute("data-cta") ?? interactive.getAttribute("data-track");
  const text = (interactive.innerText || interactive.textContent || "").trim().slice(0, 120);
  const selector = buildSelector(interactive);
  return { ctaId: cta, text, selector, isCta: !!cta };
}

function buildSelector(el: HTMLElement): string {
  const parts: string[] = [];
  let cur: HTMLElement | null = el;
  let depth = 0;
  while (cur && depth < 4) {
    let token = cur.tagName.toLowerCase();
    if (cur.id) {
      token += `#${cur.id}`;
      parts.unshift(token);
      break;
    }
    const cls = (cur.getAttribute("class") || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .join(".");
    if (cls) token += `.${cls}`;
    parts.unshift(token);
    cur = cur.parentElement;
    depth++;
  }
  return parts.join(">").slice(0, 200);
}

export function MarketingTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Refs hold mutable state that must NOT cause re-renders. The tracker
  // lives for the whole tab lifetime; React only re-runs the effect
  // when `pathname` changes (SPA nav).
  const buffer = useRef<TrackEvent[]>([]);
  const sessionRef = useRef<{
    visitorId: string;
    sessionId: string;
    sessionIsNew: boolean;
    posthogSessionId: string | null;
    landingPath: string;
    referrer: string | null;
    utm: UtmSnapshot;
    userAgent: string;
    device: ReturnType<typeof detectDevice>;
  } | null>(null);
  const dntRef = useRef<boolean>(false);
  const lastPathRef = useRef<string | null>(null);
  const pageEnterRef = useRef<number>(0);

  // ---- one-time bootstrap ----
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isDoNotTrack()) {
      dntRef.current = true;
      return;
    }
    const visitorId = getVisitorId();
    const sess = getOrCreateSession();
    if (!visitorId || !sess) return;

    sessionRef.current = {
      visitorId,
      sessionId: sess.sessionId,
      sessionIsNew: sess.isNew,
      posthogSessionId: null,
      landingPath: window.location.pathname,
      referrer: document.referrer || null,
      utm: parseUTM(),
      userAgent: navigator.userAgent.slice(0, 1000),
      device: detectDevice(),
    };

    // Bridge PostHog as soon as it loads. PostHog's init is async so
    // we poll for ~3 seconds; if we never see it we just leave
    // posthogSessionId null and replay deep-links won't render.
    let phTries = 0;
    const phInterval = window.setInterval(() => {
      const ph = readPostHog();
      phTries++;
      if (ph) {
        try {
          ph.identify?.(visitorId);
        } catch {
          // identify failures are non-fatal
        }
        try {
          const sid = ph.get_session_id?.();
          if (sid && sessionRef.current) {
            sessionRef.current.posthogSessionId = sid;
          }
        } catch {
          // ignore
        }
        window.clearInterval(phInterval);
      } else if (phTries > 30) {
        window.clearInterval(phInterval);
      }
    }, 100);

    // Periodic flush
    const flushTimer = window.setInterval(() => {
      void flush();
    }, FLUSH_INTERVAL_MS);

    // Flush on tab hide / page unload — sendBeacon is guaranteed to
    // reach the server even if the tab is closing.
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        void flush(true);
      }
    };
    const onPageHide = () => {
      void flush(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    // Capture-phase delegated click listener so we see clicks that
    // stopPropagation() in their handler.
    const onClick = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return;
      const t = e.target as HTMLElement;
      const ctx = getCtaContext(t);
      if (!ctx.selector) return;
      track("click", {
        selector: ctx.selector,
        text: ctx.text,
        x: Math.round(e.clientX),
        y: Math.round(e.clientY),
      });
      if (ctx.isCta) {
        track("cta_click", {
          ctaId: ctx.ctaId,
          text: ctx.text,
          location: window.location.pathname,
        });
      }
    };
    document.addEventListener("click", onClick, true);

    // Form lifecycle. We never read field VALUES — only field NAMES
    // and timing. The form_focus event lets us see where the visitor
    // hesitated; form_submit lets us measure form-completion time.
    const focusedAt = new Map<string, number>();
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as HTMLInputElement | HTMLTextAreaElement | null;
      if (!el || !("form" in el)) return;
      if (!(el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) return;
      const formName = el.form?.getAttribute("name") || el.form?.id || "(unnamed)";
      const fieldName = el.getAttribute("name") || el.id || "(unnamed)";
      focusedAt.set(`${formName}::${fieldName}`, Date.now());
      track("form_focus", { formName, fieldName });
    };
    const onFocusOut = (e: FocusEvent) => {
      const el = e.target as HTMLInputElement | HTMLTextAreaElement | null;
      if (!el || !("form" in el)) return;
      if (!(el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) return;
      const formName = el.form?.getAttribute("name") || el.form?.id || "(unnamed)";
      const fieldName = el.getAttribute("name") || el.id || "(unnamed)";
      const key = `${formName}::${fieldName}`;
      const enteredAt = focusedAt.get(key);
      if (enteredAt) {
        focusedAt.delete(key);
        track("form_blur", {
          formName,
          fieldName,
          durationMs: Date.now() - enteredAt,
        });
      }
    };
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement | null;
      if (!form) return;
      const formName = form.getAttribute("name") || form.id || "(unnamed)";
      const fieldCount = form.querySelectorAll("input, textarea, select").length;
      track("form_submit", { formName, fieldCount });
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("submit", onSubmit, true);

    // JS errors — surfaced in /admin/errors so we can spot bugs even
    // on a single visit.
    const onError = (e: ErrorEvent) => {
      track("error", {
        message: (e.message || "").slice(0, 500),
        source: (e.filename || "").slice(0, 200),
        lineno: e.lineno ?? null,
        colno: e.colno ?? null,
      });
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = (e.reason ?? "") as unknown;
      const msg =
        reason instanceof Error ? reason.message : String(reason ?? "").slice(0, 500);
      track("error", { message: msg, source: "unhandledrejection" });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      window.clearInterval(flushTimer);
      window.clearInterval(phInterval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      void flush(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- per-navigation page_view + scroll tracker ----
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (dntRef.current) return;
    if (!sessionRef.current) return;

    const path = pathname || window.location.pathname;
    const url = path + (searchParams?.toString() ? `?${searchParams}` : "");

    // If this is a SPA navigation (lastPath set), close out the prior
    // page's max scroll into a synthetic page_leave first.
    if (lastPathRef.current && lastPathRef.current !== path && scrollHandleRef.current) {
      const enterMs = pageEnterRef.current;
      const durationMs = enterMs ? Date.now() - enterMs : null;
      track("page_leave", {
        path: lastPathRef.current,
        durationMs,
        maxScrollPct: scrollHandleRef.current.getMaxPct(),
        milestones: scrollHandleRef.current.getMilestones(),
      });
      scrollHandleRef.current.stop();
      scrollHandleRef.current = null;
    }

    pageEnterRef.current = Date.now();
    lastPathRef.current = path;
    touchSession();

    track("page_view", {
      title: document.title?.slice(0, 200) ?? null,
      url,
      referrer: document.referrer || null,
    });

    scrollHandleRef.current = startScrollTracker(path, (pct, p) => {
      track("scroll", { pct, path: p });
    });

    // Conversion shortcut: signup completion lives at /signup/success
    // (or whatever success path your flow uses). We tag it here so
    // the funnel page doesn't have to reimplement the rule.
    if (path === "/signup/success" || path === "/welcome") {
      track("signup", { method: "email" });
    }

    return () => {
      // SPA nav cleanup happens in the next effect tick (above). On
      // hard unload pageEnterRef is captured by the page-leave below.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  const scrollHandleRef = useRef<ReturnType<typeof startScrollTracker> | null>(null);

  // ---- internal helpers (defined inside component to share refs) ----
  function track(type: string, properties?: Record<string, unknown>): void {
    if (dntRef.current) return;
    if (!sessionRef.current) return;
    if (typeof window === "undefined") return;
    if (buffer.current.length >= MAX_BATCH) {
      // Drop oldest event rather than the page's tail. In practice
      // the flush interval keeps us well under this cap.
      buffer.current.shift();
    }
    buffer.current.push({
      type,
      ts: Date.now(),
      path: window.location.pathname,
      properties,
    });
  }

  async function flush(useBeacon: boolean = false): Promise<void> {
    if (dntRef.current) return;
    if (!sessionRef.current) return;
    if (buffer.current.length === 0) return;

    // On unload include the current page's exit snapshot.
    if (useBeacon && scrollHandleRef.current && lastPathRef.current) {
      const enterMs = pageEnterRef.current;
      const durationMs = enterMs ? Date.now() - enterMs : null;
      buffer.current.push({
        type: "page_leave",
        ts: Date.now(),
        path: lastPathRef.current,
        properties: {
          durationMs,
          maxScrollPct: scrollHandleRef.current.getMaxPct(),
          milestones: scrollHandleRef.current.getMilestones(),
        },
      });
    }

    const events = buffer.current.splice(0, buffer.current.length);
    const payload: FlushPayload = {
      visitorId: sessionRef.current.visitorId,
      sessionId: sessionRef.current.sessionId,
      sessionIsNew: sessionRef.current.sessionIsNew,
      posthogSessionId: sessionRef.current.posthogSessionId,
      utm: sessionRef.current.utm,
      referrer: sessionRef.current.referrer,
      landingPath: sessionRef.current.landingPath,
      device: sessionRef.current.device,
      userAgent: sessionRef.current.userAgent,
      events,
    };

    // Mark session as no-longer-new after the first successful flush.
    sessionRef.current.sessionIsNew = false;

    const body = JSON.stringify(payload);
    const url = "/api/track/marketing";

    if (useBeacon && typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      try {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon(url, blob);
        return;
      } catch {
        // fall through to fetch
      }
    }

    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      });
    } catch {
      // Re-buffer the events so the next flush retries them. We trim
      // to MAX_BATCH to avoid unbounded growth on a long outage.
      const head = events.slice(-MAX_BATCH);
      buffer.current = [...head, ...buffer.current];
    }
  }

  return null;
}
