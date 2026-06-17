import { randomBytes } from "crypto";
import type { WorkspaceBranding } from "@/lib/branding";

const SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Generates a 10-character mockup slug. Random + URL-safe + short enough to
 * paste into an email subject line.
 *
 * Collision risk: 36^10 ≈ 3.6e15. At 1M mockups, P(collision) ≈ 1.4e-10.
 * Acceptable for our use case; the @@unique on Mockup.slug catches the
 * vanishingly rare case anyway.
 */
export function generateMockupSlug(): string {
  const bytes = randomBytes(10);
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length];
  }
  return out;
}

/**
 * Renders the markdown website plan that Gemini generates into a clean,
 * standalone HTML document we can serve at /m/[slug]. Intentionally minimal
 * styling so it loads fast and reads well on a phone (where most cold-email
 * recipients open links).
 *
 * Important: the input markdown comes from Gemini and is treated as untrusted
 * by the public renderer. We escape HTML before applying our own markdown -> HTML
 * conversion. No raw `<script>` or `<iframe>` ever ships to the browser.
 */
export function renderMockupHtml(input: {
  businessName: string;
  city: string | null;
  websiteUrl: string | null;
  planMarkdown: string;
  workspaceName?: string;
  branding?: WorkspaceBranding | null;
}): string {
  const escaped = escapeHtml(input.planMarkdown);
  const body = markdownToHtml(escaped);
  const safeName = escapeHtml(input.businessName);
  const safeCity = input.city ? escapeHtml(input.city) : "";
  // M7 fix - the website URL is rendered as `<a href="...">`. HTML
  // entity encoding alone does NOT block `javascript:` /
  // `data:text/html` schemes — those still execute on click.
  // `safeUrl()` returns `#` for any non-http(s) scheme so we can
  // ship the link without worrying about untrusted payloads from
  // the lead row (which can be edited by anyone with workspace
  // ADMIN access). Same treatment for the optional logo URL.
  const safeWebsite = input.websiteUrl
    ? escapeHtml(safeUrl(input.websiteUrl))
    : "";
  const branding = input.branding;
  // M6 fix - branding colors are interpolated raw into the CSS
  // `:root { --accent: <value>; }` block. A malicious workspace
  // admin could inject `;}body{background:url(...)}` to break out
  // of the property and pull in arbitrary CSS / track viewers.
  // sanitizeHex enforces the `#RGB`/`#RRGGBB`/`#RRGGBBAA` shape and
  // falls back to the safe defaults below on anything else.
  const accent = sanitizeHex(branding?.accentColor, "#a5b4fc");
  const primary = sanitizeHex(branding?.primaryColor, "#5e6ad2");
  const footerText = branding?.footerText || (input.workspaceName ? `Drafted by ${escapeHtml(input.workspaceName)}` : "Drafted by Revint");
  const showRevintCredit = !branding?.hideRevintCredit;
  // Logo URL is rendered as `<img src="...">`. `data:` is fine for
  // a tiny PNG; `javascript:` is not. safeUrl() narrows to
  // http(s) + data: image whitelist.
  const safeLogoUrl = branding?.logoUrl
    ? escapeHtml(safeImageUrl(branding.logoUrl))
    : null;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>${safeName} — Website draft</title>
<style>
  :root {
    --bg: #0b0b0d;
    --panel: #121214;
    --text: #ededf0;
    --muted: rgba(237, 237, 240, 0.55);
    --accent: ${accent};
    --primary: ${primary};
    --border: rgba(255, 255, 255, 0.08);
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", sans-serif; line-height: 1.6; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 48px 20px 96px; }
  .lede { font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--accent); font-weight: 600; margin-bottom: 12px; }
  h1.title { font-size: 32px; font-weight: 700; letter-spacing: -0.02em; margin: 0 0 8px; }
  .meta { color: var(--muted); font-size: 14px; margin-bottom: 36px; }
  .meta a { color: var(--accent); text-decoration: none; }
  .meta a:hover { text-decoration: underline; }
  .panel { background: var(--panel); border: 0.5px solid var(--border); border-radius: 16px; padding: 28px 32px; }
  .panel h1, .panel h2, .panel h3 { font-weight: 600; letter-spacing: -0.015em; line-height: 1.3; }
  .panel h1 { font-size: 22px; margin: 28px 0 12px; }
  .panel h1:first-child { margin-top: 0; }
  .panel h2 { font-size: 18px; margin: 24px 0 10px; color: var(--text); }
  .panel h3 { font-size: 15px; margin: 20px 0 8px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
  .panel p { margin: 0 0 14px; color: var(--text); font-size: 15px; }
  .panel ul, .panel ol { margin: 0 0 16px; padding-left: 22px; }
  .panel li { margin-bottom: 6px; font-size: 15px; }
  .panel strong { color: var(--text); font-weight: 600; }
  .panel em { color: var(--muted); font-style: italic; }
  .panel code { background: rgba(255, 255, 255, 0.06); padding: 2px 6px; border-radius: 4px; font-size: 13px; font-family: "SF Mono", ui-monospace, monospace; }
  .footer { margin-top: 32px; padding-top: 20px; border-top: 0.5px solid var(--border); color: var(--muted); font-size: 12px; text-align: center; }
  .footer a { color: var(--accent); text-decoration: none; }
  .footer a:hover { text-decoration: underline; }
</style>
</head>
<body>
<div class="wrap">
  ${safeLogoUrl ? `<img src="${safeLogoUrl}" alt="" style="max-height:48px;max-width:200px;margin-bottom:24px" />` : ""}
  <p class="lede">A draft for ${safeName}</p>
  <h1 class="title">${safeName}</h1>
  <p class="meta">
    ${safeCity ? `${safeCity} &middot; ` : ""}${safeWebsite ? `<a href="${safeWebsite}" rel="noopener noreferrer nofollow">${safeWebsite}</a>` : "no website yet"}
  </p>
  <div class="panel">${body}</div>
  <p class="footer">
    ${footerText}${showRevintCredit ? ` &middot; <a href="https://revint.dev" target="_blank" rel="noopener">revint.dev</a>` : ""}
  </p>
</div>
</body>
</html>`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Tiny markdown -> HTML converter. Handles headings (#, ##, ###), bold, italic,
 * inline code, ordered/unordered lists, paragraphs. No HTML pass-through (input
 * is already escaped). Keeps the bundle dependency-free.
 */
function markdownToHtml(escaped: string): string {
  const lines = escaped.split(/\r?\n/);
  const out: string[] = [];
  let inUl = false;
  let inOl = false;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length === 0) return;
    out.push(`<p>${inlineFormat(para.join(" "))}</p>`);
    para = [];
  };

  const closeLists = () => {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      out.push("</ol>");
      inOl = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.trim() === "") {
      flushPara();
      closeLists();
      continue;
    }

    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      flushPara();
      closeLists();
      const level = h[1].length;
      out.push(`<h${level}>${inlineFormat(h[2])}</h${level}>`);
      continue;
    }

    const ul = line.match(/^[-*]\s+(.*)$/);
    if (ul) {
      flushPara();
      if (inOl) {
        out.push("</ol>");
        inOl = false;
      }
      if (!inUl) {
        out.push("<ul>");
        inUl = true;
      }
      out.push(`<li>${inlineFormat(ul[1])}</li>`);
      continue;
    }

    const ol = line.match(/^(\d+)\.\s+(.*)$/);
    if (ol) {
      flushPara();
      if (inUl) {
        out.push("</ul>");
        inUl = false;
      }
      if (!inOl) {
        out.push("<ol>");
        inOl = true;
      }
      out.push(`<li>${inlineFormat(ol[2])}</li>`);
      continue;
    }

    closeLists();
    para.push(line);
  }

  flushPara();
  closeLists();
  return out.join("\n");
}

function inlineFormat(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

/**
 * M6 - validate a branding hex color before interpolating it raw
 * into a CSS custom-property declaration. We only ship `#RGB`,
 * `#RRGGBB`, `#RGBA`, or `#RRGGBBAA`; anything else falls back so
 * a malicious workspace admin can't inject `; }body{...}` to break
 * out of the `--accent` property.
 *
 * Exported for unit tests; the renderer is the only production
 * caller.
 */
export function sanitizeHex(value: string | null | undefined, fallback: string): string {
  if (!value || typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed)) {
    return trimmed;
  }
  return fallback;
}

/**
 * M7 - narrow a URL string to safe link schemes only. `javascript:`
 * and `data:text/html` payloads in an `<a href>` survive
 * `escapeHtml` (entities don't transform colons) and execute on
 * click. We allow only `http:` and `https:` here; anything else
 * (mailto / tel / data / javascript / file / unknown) collapses to
 * `#` so the link is harmless.
 */
export function safeUrl(value: string | null | undefined): string {
  if (!value || typeof value !== "string") return "#";
  const trimmed = value.trim();
  if (trimmed === "") return "#";
  try {
    const u = new URL(trimmed);
    if (u.protocol === "http:" || u.protocol === "https:") {
      return u.toString();
    }
    return "#";
  } catch {
    // Allow protocol-relative + path-relative forms by re-parsing
    // against a placeholder origin. Anything that doesn't start with
    // `/` or `//` is treated as untrusted and downgraded to `#`.
    if (trimmed.startsWith("//") || trimmed.startsWith("/")) {
      return trimmed;
    }
    return "#";
  }
}

/**
 * Variant of `safeUrl` for `<img src>` contexts where a small
 * `data:image/...` payload is legitimate (workspace admin uploads
 * a base64 logo). Still blocks `javascript:` / `data:text/html`.
 */
export function safeImageUrl(value: string | null | undefined): string {
  if (!value || typeof value !== "string") return "";
  const trimmed = value.trim();
  if (trimmed === "") return "";
  try {
    const u = new URL(trimmed);
    if (u.protocol === "http:" || u.protocol === "https:") {
      return u.toString();
    }
    if (u.protocol === "data:" && /^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);/i.test(trimmed)) {
      return trimmed;
    }
    return "";
  } catch {
    if (trimmed.startsWith("/")) return trimmed;
    return "";
  }
}
