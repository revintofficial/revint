/**
 * Feature flag resolvers (server-side only, pure functions).
 *
 * The Lead Detail v2 / decision-surface experiment and its
 * `isLeadDetailV2Enabled` resolver were removed in the FineDine v1
 * update — everyone is on the v1 (legacy) surface now. What remains
 * here is the Truth Layer v1 per-track kill-switch infrastructure.
 */

export interface FeatureFlagSession {
  workspaceId: string;
}

function parseOnOff(input: string | undefined | null): boolean | null {
  if (input == null) return null;
  const v = input.trim().toLowerCase();
  if (v === "on" || v === "true" || v === "1" || v === "yes") return true;
  if (v === "off" || v === "false" || v === "0" || v === "no") return false;
  return null;
}

// =====================================================================
// Truth Layer v1 — per-track kill switches.
//
// All flags are pre-declared in Wave 0 (Foundation) so Wave 1 tracks
// don't have to edit this file — avoids the file-ownership conflict
// §1.5 of the master plan warns about. Each track reads its own flag
// at the entry point of the changed code path; when the flag is off
// the track falls back to pre-Truth-Layer behavior.
//
// Defaults: every flag defaults to **on** in development (so the
// default `npm run dev` boots into the new behavior) and **off** in
// production until the Release Manager flips them per the rollout
// plan §4 (Shadow → Canary 10% → 50% → Full).
//
// Env conventions:
//   `TRUTH_LAYER_<TRACK>_<FEATURE>=on|off|true|false|1|0|yes|no`
//   `TRUTH_LAYER_<TRACK>_<FEATURE>_WORKSPACES=<id>,<id>,...`
// The workspace allow-list overrides the env default per-tenant so
// canaries can target specific workspaces without flipping global
// defaults.
// =====================================================================

export const TRUTH_LAYER_FLAG_NAMES = [
  "TRUTH_LAYER_DECISION_GATES", // T-A
  "TRUTH_LAYER_LOCALE_GATE", // T-B
  "TRUTH_LAYER_SEVERITY_V2", // T-C
  "TRUTH_LAYER_WEBSITE_VERIFY", // T-E
  "TRUTH_LAYER_BRIEF_V2", // T-D
  "TRUTH_LAYER_AVOIDANCE_VALIDATOR", // T-F
] as const;

export type TruthLayerFlag = (typeof TRUTH_LAYER_FLAG_NAMES)[number];

function fromTruthLayerEnv(flag: TruthLayerFlag): boolean | null {
  const raw = process.env[flag];
  return parseOnOff(raw ?? null);
}

function fromTruthLayerAllowList(
  flag: TruthLayerFlag,
  workspaceId: string,
): boolean | null {
  const raw = process.env[`${flag}_WORKSPACES`];
  if (!raw) return null;
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0) return null;
  return ids.includes(workspaceId) ? true : null;
}

/**
 * Default policy: dev = on, prod = off until the rollout plan flips
 * each flag through Shadow → Canary → 50% → Full per master plan §4.
 *
 * `process.env.NODE_ENV === "development"` covers `npm run dev` and
 * `npm run workers` — both should boot with the new code paths active
 * so engineers see the real behavior locally.
 */
function truthLayerDefault(): boolean {
  return process.env.NODE_ENV === "development";
}

export function isTruthLayerFlagEnabled(
  flag: TruthLayerFlag,
  session: FeatureFlagSession,
): boolean {
  const allow = fromTruthLayerAllowList(flag, session.workspaceId);
  if (allow !== null) return allow;
  const env = fromTruthLayerEnv(flag);
  if (env !== null) return env;
  return truthLayerDefault();
}
