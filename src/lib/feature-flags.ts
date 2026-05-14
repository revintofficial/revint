/**
 * Feature flag resolver — Phase 0 of the Lead Detail v2 redesign.
 *
 * Server-side only. Pure function. No DB round-trips. The page server
 * component awaits `requireUser()` first, then calls this resolver to
 * pick the surface (legacy 5-tab vs v2 placeholder).
 *
 * Resolution order (first non-null wins):
 *   1. URL  ?v=2  → on   /  ?v=1  → off                  (per-tab override)
 *   2. Cookie  leadac_lead_detail_v2=on|off               (per-user toggle)
 *   3. Workspace allow-list  LEAD_DETAIL_V2_WORKSPACES    (env, comma-sep)
 *   4. Env default           LEAD_DETAIL_V2_DEFAULT=on|off
 *   5. false
 *
 * Per Open Decision #1 in the build plan §8 the workspace tier reads
 * from a literal env-keyed allow-list, NOT from a `WorkspaceFeatureFlag`
 * row. Migrating to a row is a Phase 7 concern.
 */

export const LEAD_DETAIL_V2_COOKIE = "leadac_lead_detail_v2";

export interface FeatureFlagSession {
  workspaceId: string;
}

export interface FeatureFlagSearchParams {
  v?: string | string[] | undefined;
}

export interface FeatureFlagCookieStore {
  get(name: string): { value: string } | undefined;
}

function pickFirst(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseOnOff(input: string | undefined | null): boolean | null {
  if (input == null) return null;
  const v = input.trim().toLowerCase();
  if (v === "on" || v === "true" || v === "1" || v === "yes") return true;
  if (v === "off" || v === "false" || v === "0" || v === "no") return false;
  return null;
}

function fromUrl(searchParams: FeatureFlagSearchParams | null | undefined): boolean | null {
  const raw = pickFirst(searchParams?.v);
  if (!raw) return null;
  if (raw === "2") return true;
  if (raw === "1") return false;
  return null;
}

function fromCookie(cookies: FeatureFlagCookieStore | null | undefined): boolean | null {
  const raw = cookies?.get(LEAD_DETAIL_V2_COOKIE)?.value;
  return parseOnOff(raw ?? null);
}

function fromWorkspaceAllowList(workspaceId: string): boolean | null {
  const raw = process.env.LEAD_DETAIL_V2_WORKSPACES;
  if (!raw) return null;
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0) return null;
  return ids.includes(workspaceId) ? true : null;
}

function fromEnvDefault(): boolean | null {
  return parseOnOff(process.env.LEAD_DETAIL_V2_DEFAULT ?? null);
}

export function isLeadDetailV2Enabled(
  session: FeatureFlagSession,
  searchParams: FeatureFlagSearchParams | null | undefined,
  cookies: FeatureFlagCookieStore | null | undefined,
): boolean {
  const url = fromUrl(searchParams);
  if (url !== null) return url;

  const cookie = fromCookie(cookies);
  if (cookie !== null) return cookie;

  const workspace = fromWorkspaceAllowList(session.workspaceId);
  if (workspace !== null) return workspace;

  const envDefault = fromEnvDefault();
  if (envDefault !== null) return envDefault;

  return false;
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
