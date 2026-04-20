/**
 * Workspace-level branding for the white-label tier.
 *
 * Agency plan customers can override the Leadac AI logo, primary color, and
 * footer text on public mockup pages so the prospect sees the agency's brand,
 * not ours. Pro and Free fall back to the defaults below.
 */

export interface WorkspaceBranding {
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  footerText: string | null;
  hideLeadacCredit: boolean;
}

export const DEFAULT_BRANDING: WorkspaceBranding = {
  logoUrl: null,
  primaryColor: null,
  accentColor: null,
  footerText: null,
  hideLeadacCredit: false,
};

/**
 * Coerce a free-form Json field into a branding object, dropping unknown
 * fields and clamping color strings to safe values.
 */
export function parseBranding(raw: unknown): WorkspaceBranding {
  if (!raw || typeof raw !== "object") return DEFAULT_BRANDING;
  const obj = raw as Record<string, unknown>;
  return {
    logoUrl: typeof obj.logoUrl === "string" && isHttpUrl(obj.logoUrl) ? obj.logoUrl : null,
    primaryColor: typeof obj.primaryColor === "string" ? clampColor(obj.primaryColor) : null,
    accentColor: typeof obj.accentColor === "string" ? clampColor(obj.accentColor) : null,
    footerText: typeof obj.footerText === "string" ? obj.footerText.slice(0, 200) : null,
    hideLeadacCredit: obj.hideLeadacCredit === true,
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
