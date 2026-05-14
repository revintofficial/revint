/**
 * Truth Layer contracts — barrel export + version map.
 *
 * Per §1.3 of the master plan, every track in the pipeline imports
 * contracts ONLY from this barrel. The ESLint rule
 * `no-restricted-imports` blocks importing the individual files outside
 * this directory. This lets us:
 *   - run `git grep "@/lib/sdr-brain/contracts"` and instantly see
 *     every consumer of every contract;
 *   - bump a contract's `__contractVersion` and have CI fail-fast on
 *     downstream consumers that are still pinned to the old shape;
 *   - dispatch parallel agents that all type-check against the same
 *     surface area (no "I'll just import a private helper" drift).
 *
 * `__contractVersions` is the runtime mirror of every contract's
 * `__contractVersion` constant. `scripts/check-contracts.ts` reads
 * this and the `git diff` to enforce the bump-on-change protocol.
 *
 * NOTE on re-exports: each per-file `__contractVersion` is imported
 * here under a renamed binding so the barrel can build the version
 * map. Below we re-export only the *types* and helper symbols — the
 * per-file `__contractVersion` constant is INTENTIONALLY not
 * re-exported as a named member because that would collide across
 * files (every file declares the same identifier). Consumers always
 * read versions via `__contractVersions["pain-point"]` etc.
 */

import { __contractVersion as nbaTypesV } from "./nba-types";
import { __contractVersion as painPointV } from "./pain-point";
import { __contractVersion as switchSignalV } from "./switch-signal";
import { __contractVersion as websiteVerificationV } from "./website-verification";
import { __contractVersion as severityV } from "./severity";
import { __contractVersion as localeOutputV } from "./locale-output";

// nba-types
export type {
  NextBestActionType,
  BlockingGate,
  NbaOutput,
} from "./nba-types";

// pain-point
export type {
  PainPointSource,
  LeadEvidenceField,
  PainPointEvidenceRef,
  PainPoint,
  Hypothesis,
  AvoidanceReason,
  AvoidanceTopic,
} from "./pain-point";

// switch-signal
export type { SwitchDirection, SwitchSignal } from "./switch-signal";

// website-verification
export type {
  WebsiteVerificationStatus,
  WebsiteVerificationSource,
  WebsiteVerificationSourceResult,
  WebsiteVerificationSourceCheck,
  WebsiteVerificationResult,
} from "./website-verification";
export { deriveWebsiteVerificationStatus } from "./website-verification";

// severity
export type { SeverityScore, SeverityCalcInput } from "./severity";
export { normalizeSeverity } from "./severity";

// locale-output
export type {
  OutreachLocale,
  LocaleResolutionSource,
  LocaleResolution,
} from "./locale-output";
export { COUNTRY_TO_LOCALE, resolveLocaleFromCountry } from "./locale-output";

export const __contractVersions = Object.freeze({
  "nba-types": nbaTypesV,
  "pain-point": painPointV,
  "switch-signal": switchSignalV,
  "website-verification": websiteVerificationV,
  severity: severityV,
  "locale-output": localeOutputV,
} as const);

export type ContractName = keyof typeof __contractVersions;
