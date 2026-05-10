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
