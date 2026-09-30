import { MODULE_LABELS, object, toDecisionCard } from "@/lib/control/decision";
import { packageLabel, stayLabel, wedgeLabel } from "@/lib/control/labels";
export type ScoredOutput = unknown;

export const EXPECTED_PACKAGES = ["starter", "growth", "premium", "none"] as const;
export type ExpectedPackage = (typeof EXPECTED_PACKAGES)[number];
export const EXPECTED_WEDGES = ["reservation", "bill_wait", "marketplace", "menu_surface", "multi_location", "guest_repeat", "none"] as const;
export type ExpectedWedge = (typeof EXPECTED_WEDGES)[number];

export type SalesClaim = {
  id: string;
  text: string;
  source: string;
  expiresOn: string;
  provisional: boolean;
};

export type ExpectedRules = {
  expectedPackage?: ExpectedPackage;
  expectedWedge?: ExpectedWedge;
  icpMin?: number;
  icpMax?: number;
  allowedModules?: string[];
  forbiddenClaims: string[];
  forbiddenAngles: string[];
};

export type ScoreFailureCode = "PACKAGE" | "WEDGE" | "ICP_BAND" | "MODULE" | "FORBIDDEN_CLAIM" | "FORBIDDEN_ANGLE";
export type ScoreFailure = { code: ScoreFailureCode; detail: string };

function pickText(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  const raw = object(value);
  for (const key of ["id", "code", "key", "wedge", "package", "name"]) {
    const v = raw[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/**
 * The card's package as one of the closed set, null when the card has
 * none, or "unknown". Head-agent may write an exact catalog name
 * ("FineDine Growth"), so the tier word is matched inside it. An
 * unrecognised name fails an expectedPackage rule instead of passing.
 */
export function normalizePackage(value: unknown): ExpectedPackage | "unknown" | null {
  const text = pickText(value);
  if (!text) return null;
  const lower = text.toLowerCase();
  if (lower === "none") return "none";
  const hits = (["starter", "growth", "premium"] as const).filter(tier => lower.includes(tier));
  return hits.length === 1 ? hits[0] : "unknown";
}

export function normalizeWedge(value: unknown): ExpectedWedge | "unknown" | null {
  const text = pickText(value);
  if (!text) return null;
  const key = text.toLowerCase().replace(/[\s-]+/g, "_");
  return (EXPECTED_WEDGES as readonly string[]).includes(key) ? key as ExpectedWedge : "unknown";
}

/**
 * Package and wedge are read defensively: the decision card field first
 * (decision.ts is gaining `recommendedPackage` / `wedge`), else the raw
 * `headAgent.recommendedPackage` / `headAgent.wedge` of the brief output.
 */
export function readPackageAndWedge(output: unknown): { recommendedPackage: ExpectedPackage | "unknown" | null; wedge: ExpectedWedge | "unknown" | null } {
  const card = toDecisionCard(output) as Record<string, unknown>;
  const head = object(object(output).headAgent);
  const roomOne = object(head.roomOne);
  return {
    recommendedPackage: normalizePackage(card.recommendedPackage ?? head.recommendedPackage ?? roomOne.plan),
    wedge: normalizeWedge(card.wedge ?? head.wedge ?? roomOne.wedge),
  };
}

function inRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

export function parseExpected(value: unknown): ExpectedRules {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("invalid expected");
  const raw = value as Record<string, unknown>;
  const expected: ExpectedRules = {
    forbiddenClaims: [],
    forbiddenAngles: [],
  };
  if (raw.expectedPackage != null) {
    if (typeof raw.expectedPackage !== "string" || !(EXPECTED_PACKAGES as readonly string[]).includes(raw.expectedPackage)) throw new Error("invalid expected");
    expected.expectedPackage = raw.expectedPackage as ExpectedPackage;
  }
  if (raw.expectedWedge != null) {
    if (typeof raw.expectedWedge !== "string" || !(EXPECTED_WEDGES as readonly string[]).includes(raw.expectedWedge)) throw new Error("invalid expected");
    expected.expectedWedge = raw.expectedWedge as ExpectedWedge;
  }
  if (raw.icpMin != null) {
    if (!inRange(raw.icpMin, 0, 100)) throw new Error("invalid expected");
    expected.icpMin = raw.icpMin;
  }
  if (raw.icpMax != null) {
    if (!inRange(raw.icpMax, 0, 100)) throw new Error("invalid expected");
    expected.icpMax = raw.icpMax;
  }
  if (raw.allowedModules != null) {
    if (!Array.isArray(raw.allowedModules) || raw.allowedModules.some((item) => typeof item !== "string" || !Object.hasOwn(MODULE_LABELS, item))) {
      throw new Error("invalid expected");
    }
    expected.allowedModules = raw.allowedModules;
  }
  if (raw.forbiddenClaims != null) {
    if (!Array.isArray(raw.forbiddenClaims) || raw.forbiddenClaims.some((item) => typeof item !== "string")) {
      throw new Error("invalid expected");
    }
    expected.forbiddenClaims = raw.forbiddenClaims;
  }
  if (raw.forbiddenAngles != null) {
    if (!Array.isArray(raw.forbiddenAngles) || raw.forbiddenAngles.some((item) => typeof item !== "string")) {
      throw new Error("invalid expected");
    }
    expected.forbiddenAngles = raw.forbiddenAngles;
  }
  if (expected.icpMin != null && expected.icpMax != null && expected.icpMin > expected.icpMax) throw new Error("invalid expected");
  return expected;
}

export function scoreOutput(output: unknown, expected: ExpectedRules): { passed: boolean; failures: ScoreFailure[] } {
  const card = toDecisionCard(output);
  const failures: ScoreFailure[] = [];
  const decided = readPackageAndWedge(output);
  if (expected.expectedPackage != null && (decided.recommendedPackage ?? "none") !== expected.expectedPackage) {
    failures.push({ code: "PACKAGE", detail: `Kart: ${packageLabel(decided.recommendedPackage ?? "none")} · Beklenen: ${packageLabel(expected.expectedPackage)}` });
  }
  if (expected.expectedWedge != null && (decided.wedge ?? "none") !== expected.expectedWedge) {
    failures.push({ code: "WEDGE", detail: `Kart: ${wedgeLabel(decided.wedge ?? "none")} · Beklenen: ${wedgeLabel(expected.expectedWedge)}` });
  }
  if ((expected.icpMin != null || expected.icpMax != null) && (card.salesConfidence == null || card.salesConfidence < (expected.icpMin ?? 0) || card.salesConfidence > (expected.icpMax ?? 100))) failures.push({ code: "ICP_BAND", detail: "Puan bandın dışında" });
  if (expected.allowedModules?.length && (!card.primaryModule || !expected.allowedModules.includes(card.primaryModule))) failures.push({ code: "MODULE", detail: card.primaryModule ?? "Birincil modül yok" });
  const claimText = [card.talkTrack, card.reasoning, ...card.claimSentences].filter(Boolean).join("\n").toLowerCase();
  for (const forbidden of expected.forbiddenClaims) if (forbidden.trim() && claimText.includes(forbidden.trim().toLowerCase())) failures.push({ code: "FORBIDDEN_CLAIM", detail: forbidden });
  for (const forbidden of expected.forbiddenAngles) if (forbidden.trim() && (card.primaryAngle ?? "").toLowerCase().includes(forbidden.trim().toLowerCase())) failures.push({ code: "FORBIDDEN_ANGLE", detail: forbidden });
  return { passed: failures.length === 0, failures };
}

/**
 * Pure preview for the promote form: scores a frozen output snapshot
 * against candidate rules. Saves nothing, calls no model.
 * Throws "invalid expected" for rules parseExpected rejects.
 */
export function previewScore(outputSnapshot: unknown, expected: unknown): { passed: boolean; failures: { code: ScoreFailureCode; message: string }[] } {
  const result = scoreOutput(outputSnapshot, parseExpected(expected));
  return { passed: result.passed, failures: result.failures.map(f => ({ code: f.code, message: `${stayLabel(f.code)}: ${f.detail}` })) };
}

export function scoreClaims(claims: SalesClaim[], now: Date): SalesClaim[] {
  const today = now.toISOString().slice(0, 10);
  return claims.filter((claim) => !claim.provisional && claim.expiresOn >= today);
}

export function parseClaims(value: unknown): SalesClaim[] {
  const list = Array.isArray(value)
    ? value
    : typeof value === "object" && value !== null && "claims" in value && Array.isArray(value.claims)
      ? value.claims
      : [];
  return list.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const raw = item as Record<string, unknown>;
    if (typeof raw.id !== "string" || typeof raw.text !== "string") return [];
    return [{
      id: raw.id,
      text: raw.text,
      source: typeof raw.source === "string" ? raw.source : "",
      expiresOn: typeof raw.expiresOn === "string" ? raw.expiresOn : "9999-12-31",
      provisional: raw.provisional === true,
    }];
  });
}

export function listApprovedClaimsFromJson(value: unknown, now: Date): SalesClaim[] {
  return scoreClaims(parseClaims(value), now);
}

