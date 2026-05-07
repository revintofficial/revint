/**
 * Visitor + session identity for the first-party marketing tracker.
 *
 * Browser-only module; do not import from server code. The functions
 * are written to be safe under SSR (return null when window is
 * unavailable) so a client component that calls them during the
 * initial render won't blow up.
 *
 * Storage choice:
 *   - visitorId  -> localStorage  (persists across browser restarts)
 *   - sessionId  -> sessionStorage + idle clock
 *
 * Why not cookies? First-party localStorage is enough for analytics
 * (no cross-site delivery needed) and dodges the cookie-banner
 * conversation for legitimate-interest first-party tracking. We still
 * respect Do Not Track in the tracker itself.
 */

const VISITOR_KEY = "leadac_v";
const SESSION_KEY = "leadac_s";
const SESSION_LAST_ACTIVITY_KEY = "leadac_s_last";
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30min idle -> new session

export interface VisitorIdentity {
  visitorId: string;
  sessionId: string;
  sessionIsNew: boolean;
}

function uuid(): string {
  // crypto.randomUUID is available in all evergreen browsers we care
  // about. The fallback is a non-cryptographic id; analytics doesn't
  // need crypto-grade entropy.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function safeLocalGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage quota / private mode — silently degrade. We'd rather lose
    // analytics for this visitor than break the page.
  }
}

function safeSessionGet(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSessionSet(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // see safeLocalSet
  }
}

/**
 * Returns the long-lived visitor id, creating one on first call.
 * Returns null on the server (no window).
 */
export function getVisitorId(): string | null {
  if (typeof window === "undefined") return null;
  let v = safeLocalGet(VISITOR_KEY);
  if (!v) {
    v = uuid();
    safeLocalSet(VISITOR_KEY, v);
  }
  return v;
}

/**
 * Returns the current session id, rolling it over when idle for
 * 30 minutes. Returns null on the server. The `sessionIsNew` flag is
 * used by the tracker to know whether to send a fresh attribution
 * snapshot (UTM/referrer) on the next event.
 */
export function getOrCreateSession(): { sessionId: string; isNew: boolean } | null {
  if (typeof window === "undefined") return null;
  const now = Date.now();
  const last = Number(safeSessionGet(SESSION_LAST_ACTIVITY_KEY) ?? 0);
  let sid = safeSessionGet(SESSION_KEY);
  let isNew = false;

  if (!sid || now - last > IDLE_TIMEOUT_MS || !Number.isFinite(last)) {
    sid = uuid();
    isNew = true;
    safeSessionSet(SESSION_KEY, sid);
  }
  safeSessionSet(SESSION_LAST_ACTIVITY_KEY, String(now));
  return { sessionId: sid, isNew };
}

/** Touch the session activity timestamp without rotating. */
export function touchSession(): void {
  if (typeof window === "undefined") return;
  safeSessionSet(SESSION_LAST_ACTIVITY_KEY, String(Date.now()));
}

export interface UtmSnapshot {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

const UTM_KEYS: (keyof UtmSnapshot)[] = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
];

/** Pulls UTM params from the current URL. Empty object if none present. */
export function parseUTM(search: string = window.location.search): UtmSnapshot {
  const out: UtmSnapshot = {};
  if (!search) return out;
  try {
    const sp = new URLSearchParams(search);
    for (const k of UTM_KEYS) {
      const v = sp.get(k);
      if (v) out[k] = v.slice(0, 200);
    }
  } catch {
    // malformed query string — return what we have
  }
  return out;
}

export interface DeviceSnapshot {
  device: "mobile" | "tablet" | "desktop";
  browser: string;
  os: string;
  viewportWidth: number;
  viewportHeight: number;
}

/**
 * Lightweight UA parse. We don't ship a full UA-parser library
 * because the tracker bundle has to stay small; this is enough for
 * "show me a device-class breakdown" admin slicing. The actual
 * userAgent string is also persisted on the session so a future
 * heavier parse can run server-side without rewriting the client.
 */
export function detectDevice(): DeviceSnapshot {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isMobile = /iPhone|Android.*Mobile|Mobile.*Firefox|webOS|BlackBerry/i.test(ua);
  const isTablet = /iPad|Android(?!.*Mobile)|Tablet/i.test(ua);
  const device: DeviceSnapshot["device"] = isMobile ? "mobile" : isTablet ? "tablet" : "desktop";

  let browser = "unknown";
  if (/Edg\//.test(ua)) browser = "edge";
  else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = "chrome";
  else if (/Firefox\//.test(ua)) browser = "firefox";
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = "safari";

  let os = "unknown";
  if (/Windows/i.test(ua)) os = "windows";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macos";
  else if (/Android/i.test(ua)) os = "android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "ios";
  else if (/Linux/i.test(ua)) os = "linux";

  return {
    device,
    browser,
    os,
    viewportWidth: typeof window !== "undefined" ? window.innerWidth : 0,
    viewportHeight: typeof window !== "undefined" ? window.innerHeight : 0,
  };
}

/**
 * Honor Do Not Track. Returns true when the visitor has explicitly
 * opted out (DNT === "1"). The tracker uses this to no-op all
 * track() calls; we still allow PostHog because PostHog handles its
 * own DNT logic via project settings.
 */
export function isDoNotTrack(): boolean {
  if (typeof navigator === "undefined") return false;
  // Standard DNT and the Safari `globalPrivacyControl` signal.
  const dnt =
    (navigator as Navigator & { doNotTrack?: string; globalPrivacyControl?: boolean }).doNotTrack;
  const gpc = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl;
  return dnt === "1" || gpc === true;
}
