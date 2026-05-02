/**
 * Detects URLs that point at a social media profile rather than a
 * real first-party website.
 *
 * Beta finding (research/finedine/beta-test-analysis-report.md §1):
 * Black Eye Coffee, Brewed, Blackheath Cafe and similar leads stored
 * Instagram / Facebook URLs in `Lead.websiteUrl` because they have no
 * actual website. The crawler then loaded the social page, the
 * extractor matched substrings like "book" inside the surrounding
 * social-platform chrome ("Facebook" → "book"), and the audit row
 * incorrectly reported "has booking system: true". The opener and
 * mockup workers downstream then pitched fixes for non-existent
 * problems.
 *
 * Gate the URL at crawl entry: if it's a social profile, refuse to
 * audit it and surface SOCIAL_MEDIA_ONLY to the UI so the SDR sees
 * "Yalnızca Instagram profili" instead of a wrong audit.
 */

const SOCIAL_DOMAINS = new Set<string>([
  "instagram.com",
  "www.instagram.com",
  "m.instagram.com",
  "facebook.com",
  "www.facebook.com",
  "m.facebook.com",
  "web.facebook.com",
  "tiktok.com",
  "www.tiktok.com",
  "vm.tiktok.com",
  "linkedin.com",
  "www.linkedin.com",
  "twitter.com",
  "www.twitter.com",
  "x.com",
  "www.x.com",
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "pinterest.com",
  "www.pinterest.com",
  "snapchat.com",
  "www.snapchat.com",
  "threads.net",
  "www.threads.net",
  "linktr.ee",
  "www.linktr.ee",
  "linkin.bio",
  "www.linkin.bio",
  "beacons.ai",
  "www.beacons.ai",
  "wa.me",
  "api.whatsapp.com",
  "chat.whatsapp.com",
]);

/**
 * Returns the social platform name when the URL is a social profile
 * (so the UI can render a specific badge), or null when it looks like
 * a normal first-party website.
 *
 * Conservative on purpose: a URL hosted on `instagram.com/<handle>` is
 * social; a URL hosted on `mybiz.com/instagram-feed/` is NOT — that's
 * just a page on a real site. Hostname-only check, no path inspection.
 */
export function detectSocialMediaPlatform(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (!SOCIAL_DOMAINS.has(host)) return null;
    if (host.includes("instagram")) return "Instagram";
    if (host.includes("facebook")) return "Facebook";
    if (host.includes("tiktok")) return "TikTok";
    if (host.includes("linkedin")) return "LinkedIn";
    if (host.includes("twitter") || host === "x.com" || host === "www.x.com") return "Twitter/X";
    if (host.includes("youtube") || host === "youtu.be") return "YouTube";
    if (host.includes("pinterest")) return "Pinterest";
    if (host.includes("threads")) return "Threads";
    if (host.includes("snapchat")) return "Snapchat";
    if (host.includes("whatsapp") || host === "wa.me") return "WhatsApp";
    if (host.includes("linktr.ee") || host.includes("linkin.bio") || host.includes("beacons")) {
      return "Link-in-bio";
    }
    return host;
  } catch {
    return null;
  }
}

/** Boolean wrapper for callers that don't need the platform name. */
export function isSocialMediaUrl(url: string): boolean {
  return detectSocialMediaPlatform(url) !== null;
}
