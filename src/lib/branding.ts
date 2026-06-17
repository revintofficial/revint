/**
 * Workspace-level branding for the white-label tier.
 *
 * Agency plan customers can override the Revint logo, primary color, and
 * footer text on public mockup pages so the prospect sees the agency's brand,
 * not ours. Pro and Free fall back to the defaults below.
 */

export interface WorkspaceBranding {
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  footerText: string | null;
  hideRevintCredit: boolean;
}

export const DEFAULT_BRANDING: WorkspaceBranding = {
  logoUrl: null,
  primaryColor: null,
  accentColor: null,
  footerText: null,
  hideRevintCredit: false,
};

/**
 * Coerce a free-form Json field into a branding object, dropping unknown
 * fields and clamping color strings to safe values.
 *
 * Backwards compatibility: rows persisted before the Revint rename still
 * carry `hideLeadacCredit` in their JSON blob. We read either key and
 * always write the new one (see `branding-form.tsx`). New deploys can
 * remove the legacy fallback once a one-shot DB rewrite migrates the
 * existing rows.
 */
export function parseBranding(raw: unknown): WorkspaceBranding {
  if (!raw || typeof raw !== "object") return DEFAULT_BRANDING;
  const obj = raw as Record<string, unknown>;
  return {
    logoUrl: typeof obj.logoUrl === "string" && isHttpUrl(obj.logoUrl) ? obj.logoUrl : null,
    primaryColor: typeof obj.primaryColor === "string" ? clampColor(obj.primaryColor) : null,
    accentColor: typeof obj.accentColor === "string" ? clampColor(obj.accentColor) : null,
    footerText: typeof obj.footerText === "string" ? obj.footerText.slice(0, 200) : null,
    hideRevintCredit:
      obj.hideRevintCredit === true || obj.hideLeadacCredit === true,
  };
}

function clampColor(input: string): string | null {
  const trimmed = input.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return null;
}

function isHttpUrl(input: string): boolean {
  try {
    const url = new URL(input);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Plans that unlock the white-label UI. Used by both the settings tab and the
 * mockup renderer.
 */
export function planAllowsWhiteLabel(plan: string): boolean {
  return plan === "AGENCY";
}
