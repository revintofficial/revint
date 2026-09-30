import { MODULE_LABELS, toDecisionCard } from "@/lib/control/decision";
export type ScoredOutput = unknown;

export type SalesClaim = {
  id: string;
  text: string;
  source: string;
  expiresOn: string;
  provisional: boolean;
};

export type ExpectedRules = {
  icpMin?: number;
  icpMax?: number;
  allowedModules?: string[];
  forbiddenClaims: string[];
  forbiddenAngles: string[];
};

export type ScoreFailure = { code: "ICP_BAND" | "MODULE" | "FORBIDDEN_CLAIM" | "FORBIDDEN_ANGLE"; detail: string };

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
  if ((expected.icpMin != null || expected.icpMax != null) && (card.salesConfidence == null || card.salesConfidence < (expected.icpMin ?? 0) || card.salesConfidence > (expected.icpMax ?? 100))) failures.push({ code: "ICP_BAND", detail: "Puan bandın dışında" });
  if (expected.allowedModules?.length && (!card.primaryModule || !expected.allowedModules.includes(card.primaryModule))) failures.push({ code: "MODULE", detail: card.primaryModule ?? "Birincil modül yok" });
  const claimText = [card.talkTrack, card.reasoning, ...card.claimSentences].filter(Boolean).join("\n").toLowerCase();
  for (const forbidden of expected.forbiddenClaims) if (forbidden.trim() && claimText.includes(forbidden.trim().toLowerCase())) failures.push({ code: "FORBIDDEN_CLAIM", detail: forbidden });
  for (const forbidden of expected.forbiddenAngles) if (forbidden.trim() && (card.primaryAngle ?? "").toLowerCase().includes(forbidden.trim().toLowerCase())) failures.push({ code: "FORBIDDEN_ANGLE", detail: forbidden });
  return { passed: failures.length === 0, failures };
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

