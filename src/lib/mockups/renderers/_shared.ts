/**
 * Shared primitives for the website-mockup renderer family.
 *
 * Centralised so the legacy `leadac-hero.ts` and the new
 * `leadac-showcase.ts` cannot drift apart on the safety boundary.
 * Every Gemini-produced string lands in the document via these
 * helpers; every business-supplied URL crosses through the
 * allowlist guard. A future renderer (e.g. a checkout/quote
 * builder) imports from here too — never re-implement.
 *
 * No DOM, no React, no fetch. Pure functions, deterministic, safe
 * to call from a Node worker, an Edge route handler, or a unit
 * test. The renderer files themselves do all the layout work; this
 * file is the trust boundary.
 */

/**
 * HTML-escape arbitrary text. Used on every Gemini-produced string
 * before it lands in the document — headlines, services, FAQ
 * answers, anything keyed by Gemini. Also runs on caller-supplied
 * business fields (`businessName`, `formattedAddress`, …) for a
 * second layer of defense; even though those are read from Google
 * Places + workspace settings (not user input), the renderer cannot
 * tell the difference, so it treats every string the same.
 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Accepts only `#RGB` and `#RRGGBB` hex literals. Anything else
 * (RGBA, named colors, `javascript:`, function calls) returns null
 * so the renderer falls back to its baked-in default instead of
 * letting an unsanitised value land inside a `<style>` body —
 * `style { background: <attacker-input> }` is a real attack surface.
 */
export function sanitizeHex(input: string | undefined | null): string | null {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (!/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Mix a hex literal with an alpha channel into an `rgba(...)` string.
 * Used pervasively for radial gradients + glass panels. We expand
 * `#RGB` short form to `#RRGGBB` before parsing so two-digit channels
 * always succeed; a bad hex returns black at the requested alpha so
 * the layout never collapses (the niche palette degrades gracefully
 * instead of disappearing).
 */
export function hexWithAlpha(hex: string, alpha: number): string {
  const h = sanitizeHex(hex) ?? "#000000";
  const full =
    h.length === 4
      ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`
      : h;
  const r = parseInt(full.slice(1, 3), 16);
  const g = parseInt(full.slice(3, 5), 16);
  const b = parseInt(full.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Build a `tel:` href from an arbitrary phone string. Strips every
 * non-digit except a leading `+` so a Google Places-returned
 * "+90 533 123 45 67" lands as a working dialer href. Returns the
 * raw `tel:` prefix on an empty input rather than throwing — the
 * caller skips the CTA when no phone is set.
 */
export function encodeTelHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return `tel:${digits}`;
}

/**
 * Build a `https://wa.me/<digits>` href. Drops the leading `+` and
 * any whitespace / formatting per WhatsApp's documented click-to-
 * chat scheme. Returns a bare URL with no `?text=` query so the
 * caller can append a pre-filled message via `withWhatsappMessage`.
 */
export function encodeWhatsappHref(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}`;
}

/**
 * Append a `?text=...` query to a `wa.me/<digits>` URL so the
 * WhatsApp app pops the chat with a pre-filled message. Used by the
 * showcase renderer's booking slots ("Selam, Çarşamba 10:30 için
 * randevu istiyorum") + contact form submit fallback. We
 * encodeURIComponent the message ourselves so the caller can hand
 * us a raw human string.
 */
export function withWhatsappMessage(waHref: string, message: string): string {
  if (!message) return waHref;
  return `${waHref}?text=${encodeURIComponent(message)}`;
}

/**
 * Validates a photo URL before it lands in a
 * `style="background-image:url('...')"` attribute. We accept ONLY
 * https URLs from a fixed allowlist of CDN hosts (Unsplash + Pexels
 * for niche stock imagery; Google's photo CDN for the real business
 * photos Apify Gmaps Deep pulls into `Lead.photoUrls`).
 *
 * Google CDN host allowance details (kuyumcu-pro Phase 3):
 *   - `lh3.googleusercontent.com` (most common — public Places photos)
 *   - `lh4 / lh5 / lh6.googleusercontent.com` (rotated edges)
 *   - any other `*.googleusercontent.com` sub-host (Google reshuffles
 *     these regularly; an exact list goes stale within months)
 *   - `*.gstatic.com` (Google's secondary static CDN; sometimes
 *     serves the same photo bytes when the primary is geo-throttled)
 *
 * This guard exists in addition to `escapeHtml` because the URL is
 * embedded inside a CSS `url('...')` token: a quote-balanced
 * injection could escape the property even after HTML-encoding.
 * Returning null for anything outside the allowlist makes the
 * renderer fall back to the gradient hero / skip the gallery, which
 * is always safe.
 *
 * Why suffix-match the Google hosts but exact-match the others:
 *   - Unsplash + Pexels only serve from a single canonical host each
 *     (`images.unsplash.com` / `images.pexels.com`); exact match is
 *     enough and tighter is better.
 *   - Google's photo CDN is split across many sub-hosts and they
 *     rotate over time; suffix match keeps us on the right edge as
 *     `lh3.*` → `lh5.*` shifts happen.
 *
 * URL stripping: we strip any quote / whitespace characters from the
 * final string so even a quirky URL that passed parsing can't escape
 * the `url('...')` context.
 */
export function pickSafePhotoUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = String(input).trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  const host = parsed.hostname.toLowerCase();

  // Exact-match stock photo hosts.
  const ALLOWED_HOSTS = ["images.unsplash.com", "images.pexels.com"];
  if (ALLOWED_HOSTS.includes(host)) {
    return parsed.toString().replace(/['"\s]/g, "");
  }

  // Suffix-match Google CDN hosts (Places photo gallery).
  if (
    host === "googleusercontent.com" ||
    host.endsWith(".googleusercontent.com") ||
    host === "gstatic.com" ||
    host.endsWith(".gstatic.com")
  ) {
    return parsed.toString().replace(/['"\s]/g, "");
  }

  return null;
}

/**
 * Build a Google Maps embed iframe URL from a free-text query
 * (typically `${businessName} ${formattedAddress}`). Uses the
 * keyless `maps.google.com/maps?...&output=embed` endpoint which
 * works on every domain without requiring an API key.
 *
 * The caller hands us a raw string; we URL-encode it so a comma /
 * `&` in the address cannot break out of the query parameter.
 * Returns null on empty input so the renderer omits the map
 * section entirely.
 */
export function buildMapsEmbedUrl(query: string | null | undefined): string | null {
  const trimmed = (query ?? "").trim();
  if (!trimmed) return null;
  return `https://maps.google.com/maps?q=${encodeURIComponent(trimmed)}&output=embed`;
}
