/**
 * Legacy-hash → v2 mapping table — Phase 0/6 of Lead Detail v2.
 *
 * The old 5-tab page used hash links (`#overview`, `#workers`,
 * `#anchor-workers-top`, `#reviews`, `#website`, `#outreach`,
 * `#anchor-sales-opportunity`) for deep-links from emails, Slack
 * threads and Zapier flows. v2 has no tabs — this pure module
 * answers "what should the v2 page do when it boots with one of
 * those hashes in the URL?"
 *
 * Phase 6 promoted `#workers` and `#anchor-workers-top` from
 * `scroll` to a relative `navigate` action. Consumers turn it
 * into `router.replace(`/app/leads/${leadId}${target}`)`. The
 * anchor target stays for `target` is a relative path (starts
 * with "/").
 *
 * Telemetry for `lead_detail.legacy_hash_consumed` and
 * `lead_detail.legacy_workers_link_followed` lives in the
 * consuming effect, not in this pure module — we want the module
 * to stay importable from server-side test harnesses.
 *
 * Mapping (from PLAN §3.2 + Phase 6):
 *
 *   #overview                            noop (scroll top)
 *   #outreach                            scroll → next-gesture-block
 *   #anchor-sales-opportunity            scroll → next-gesture-block
 *   #workers                             navigate → /workers (relative)
 *   #anchor-workers-top                  navigate → /workers (relative)
 *   #reviews                             scroll → history-block
 *   #website                             scroll → why-now-block
 *
 * Anything else → noop.
 */

export type LegacyHashAction =
  | { kind: "scroll"; target: string }
  | { kind: "navigate"; target: string }
  | { kind: "noop"; target?: undefined };

const TABLE: Readonly<Record<string, LegacyHashAction>> = {
  overview: { kind: "noop" },
  outreach: { kind: "scroll", target: "next-gesture-block" },
  "anchor-sales-opportunity": { kind: "scroll", target: "next-gesture-block" },
  workers: { kind: "navigate", target: "/workers" },
  "anchor-workers-top": { kind: "navigate", target: "/workers" },
  reviews: { kind: "scroll", target: "history-block" },
  website: { kind: "scroll", target: "why-now-block" },
};

function normalize(hash: string): string {
  return hash.replace(/^#/, "").trim().toLowerCase();
}

export function getRedirectTarget(hash: string | null | undefined): LegacyHashAction {
  if (!hash) return { kind: "noop" };
  const key = normalize(hash);
  if (!key) return { kind: "noop" };
  return TABLE[key] ?? { kind: "noop" };
}

export const LEGACY_HASHES = Object.freeze(Object.keys(TABLE));
