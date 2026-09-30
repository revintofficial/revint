type ClaimCarrier = {
  primaryAngle: string;
  talkTrack: string;
  reasoning: string;
  recommendedPackage: string | null;
  recommendedModules: Array<{ why: string }>;
  excludedModules: Array<{ why: string }>;
  sourceConflicts: Array<{ claim: string }>;
};

const PERCENT = /\d+\s*%[^\n.]{0,80}/gi;
const UPSELL = /[^\n.]*\bupsell\b[^\n.]*/gi;

function covers(fragment: string, approved: string[]): boolean {
  const norm = fragment.trim().toLowerCase();
  if (!norm) return true;
  return approved.some((item) => item === norm || item.includes(norm));
}

function scrub(text: string, approved: string[]): { text: string; dropped: boolean } {
  let dropped = false;
  const next = text
    .replace(PERCENT, (match) => {
      if (covers(match, approved)) return match;
      dropped = true;
      return "";
    })
    .replace(UPSELL, (match) => {
      if (covers(match, approved)) return match;
      dropped = true;
      return "";
    })
    .replace(/\s{2,}/g, " ")
    .trim();
  return { text: next, dropped };
}

/** Drops claim-like strings that are not on the approved list. Empty list leaves the decision unchanged. */
export function applyApprovedClaimGate<T extends ClaimCarrier>(decision: T, approvedTexts: string[], warnings: string[]): T {
  const approved = approvedTexts.map((text) => text.trim().toLowerCase()).filter(Boolean);
  if (approved.length === 0) return decision;
  let dropped = false;
  const clean = (value: string) => {
    const result = scrub(value, approved);
    if (result.dropped) dropped = true;
    return result.text;
  };
  decision.primaryAngle = clean(decision.primaryAngle);
  decision.talkTrack = clean(decision.talkTrack);
  decision.reasoning = clean(decision.reasoning);
  if (decision.recommendedPackage) {
    const next = clean(decision.recommendedPackage);
    decision.recommendedPackage = next || null;
  }
  for (const moduleRec of decision.recommendedModules) moduleRec.why = clean(moduleRec.why);
  for (const moduleRec of decision.excludedModules) moduleRec.why = clean(moduleRec.why);
  decision.sourceConflicts = decision.sourceConflicts.filter((conflict) => {
    const claim = conflict.claim.trim().toLowerCase();
    if (!claim) return false;
    if (covers(conflict.claim, approved) && approved.some((item) => claim === item || claim.includes(item))) return true;
    dropped = true;
    return false;
  });
  if (dropped && !warnings.includes("unapproved claim dropped")) warnings.push("unapproved claim dropped");
  return decision;
}
