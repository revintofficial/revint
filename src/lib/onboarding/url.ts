/**
 * Domain + pricing URL normalization for onboarding calibration input.
 *
 * The user pastes whatever they have ("example.com", "www.example.com/",
 * "https://example.com/pricing"). We normalize to a canonical https origin
 * for the domain and a fully-qualified https URL for the pricing page so the
 * crawler has a stable, SSRF-checkable target.
 */

/** Strip protocol, leading www., trailing slash, path, and lowercase. */
export function extractHostname(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  let host = url.hostname.toLowerCase();
  if (host.startsWith("www.")) host = host.slice(4);
  // Reject obviously invalid hosts (no dot, localhost, IPs are allowed
  // through but the crawler's SSRF guard handles private ranges).
  if (!host.includes(".")) return null;
  return host;
}

/**
 * Normalize a company domain to a canonical `https://host` origin.
 * Returns null when the input can't be parsed into a plausible domain.
 */
export function normalizeCompanyDomain(input: string): string | null {
  const host = extractHostname(input);
  if (!host) return null;
  return `https://${host}`;
}

/**
 * Normalize a pricing page URL. Accepts a bare domain (assumes /pricing is
 * NOT appended — we keep exactly what the user pointed at) or a full URL.
 * Returns a fully-qualified https URL or null when unparseable.
 */
export function normalizePricingUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!url.hostname.includes(".")) return null;
  // Force https for the canonical stored form.
  url.protocol = "https:";
  return url.toString();
}
