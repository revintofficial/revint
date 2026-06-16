/**
 * Page → psych model map (plan §3.3 codified).
 *
 * Each page's primary psych models live here. Section primitives can read
 * the map to decide whether to render certain props (e.g. the home hero
 * uses the Gong anchor when `anchoring` is in the list).
 *
 * Audit checklist: every page in `src/app/(site)/` whose route appears in
 * `SECTION_PSYCH_MAP` must declare its model here.
 */

export type PsychModel =
  | "anchoring"
  | "specificity"
  | "mimetic"
  | "curse-of-knowledge"
  | "confirmation-bias"
  | "unity"
  | "decoy"
  | "loss-aversion"
  | "mental-accounting"
  | "goal-gradient"
  | "foot-in-the-door"
  | "regret-aversion"
  | "activation-energy"
  | "default-effect"
  | "endowment"
  | "contrast"
  | "authority"
  | "door-in-the-face"
  | "bundle-reframe"
  | "liking-similarity"
  | "reciprocity"
  | "ikea-effect"
  | "social-proof"
  | "availability-heuristic"
  | "bandwagon"
  | "pratfall"
  | "status-quo-antidote"
  | "mere-exposure"
  | "recency"
  | "lindy-effect";

export const PAGE_PSYCH_MAP: Record<string, PsychModel[]> = {
  "/": [
    "anchoring",
    "specificity",
    "mimetic",
    "curse-of-knowledge",
    "status-quo-antidote",
    "loss-aversion",
  ],
  "/manifesto": ["confirmation-bias", "unity"],
  "/pricing": [
    "decoy",
    "anchoring",
    "mental-accounting",
    "loss-aversion",
    "goal-gradient",
  ],
  "/demo": ["foot-in-the-door", "regret-aversion", "activation-energy"],
  "/login": ["activation-energy", "default-effect"],
  "/signup": ["activation-energy", "default-effect", "endowment"],
  "/vs/apollo-clay-gong": ["bundle-reframe", "mental-accounting", "contrast"],
  "/vs/apollo": ["contrast", "authority", "specificity"],
  "/vs/clay": ["contrast", "authority", "specificity"],
  "/vs/gong": ["contrast", "authority", "door-in-the-face"],
  "/for/field-service-saas": [
    "liking-similarity",
    "specificity",
    "goal-gradient",
  ],
  "/for/restaurant-tech-saas": [
    "liking-similarity",
    "specificity",
    "goal-gradient",
  ],
  "/for/dental-practice-software": [
    "liking-similarity",
    "specificity",
  ],
  "/about": ["authority", "liking-similarity", "pratfall"],
  "/security": ["authority", "loss-aversion", "status-quo-antidote"],
  "/integrations/hubspot": ["endowment", "ikea-effect", "default-effect"],
  "/integrations/smartlead": ["endowment", "ikea-effect"],
  "/changelog": ["mere-exposure", "recency"],
  "/resources/apollo-bounce-rate-fix": ["authority", "reciprocity"],
  "/resources/closed-loop-icp-refinement": ["authority", "reciprocity"],
  "/resources/2026-vertical-saas-gtm-benchmark": [
    "reciprocity",
    "authority",
    "lindy-effect",
  ],
  "/tools/apollo-stack-cost-calculator": [
    "reciprocity",
    "ikea-effect",
    "endowment",
  ],
  "/tools/sdr-ramp-estimator": ["reciprocity", "ikea-effect"],
  "/tools/hubspot-signal-coverage-checker": [
    "reciprocity",
    "ikea-effect",
    "endowment",
  ],
};

export function psychFor(path: string): PsychModel[] {
  return PAGE_PSYCH_MAP[path] ?? [];
}
