/**
 * P0.5 - Genişletilmiş social profile scraping.
 *
 * Mapileads' "scrape verified social media profiles" feature parity.
 * Reads all <a href> values + raw HTML and pulls out the first hit per
 * platform. Follows the conservative "first match wins, no fan accounts"
 * principle - if multiple LinkedIn URLs found, we take the first matching the
 * /company/, /in/, or /school/ paths and ignore intent.linkedin.com share links.
 *
 * Output shape feeds `WebsiteAudit.socialProfiles` JSON column and the
 * `SocialProfileIcons` UI component on the lead detail page.
 */

export interface SocialProfiles {
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
  tiktok: string | null;
  youtube: string | null;
  twitter: string | null;
  whatsapp: string | null;
  pinterest: string | null;
}

const EMPTY: SocialProfiles = {
  instagram: null,
  facebook: null,
  linkedin: null,
  tiktok: null,
  youtube: null,
  twitter: null,
  whatsapp: null,
  pinterest: null,
};

const PATTERNS: { platform: keyof SocialProfiles; regex: RegExp; reject?: RegExp }[] = [
  {
    platform: "instagram",
    regex: /https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._]{2,30})\/?/i,
    reject: /\/(p|reel|tv|stories|explore|accounts)\//i,
  },
  {
    platform: "facebook",
    regex: /https?:\/\/(?:www\.|m\.|web\.)?facebook\.com\/(?!sharer|tr|dialog|plugins)([A-Za-z0-9.\-_]{2,80})\/?/i,
    reject: /facebook\.com\/(sharer|tr|dialog|plugins)/i,
  },
  {
    platform: "linkedin",
    regex: /https?:\/\/(?:www\.|[a-z]{2}\.)?linkedin\.com\/(company|in|school|showcase)\/([A-Za-z0-9.\-_%]{2,100})\/?/i,
    reject: /linkedin\.com\/(shareArticle|sharing|cws)/i,
  },
  {
    platform: "tiktok",
    regex: /https?:\/\/(?:www\.|vm\.|vt\.)?tiktok\.com\/(@[A-Za-z0-9._]{2,30})\/?/i,
  },
  {
    platform: "youtube",
    regex: /https?:\/\/(?:www\.)?youtube\.com\/(@[A-Za-z0-9._\-]{2,40}|c\/[A-Za-z0-9._\-]+|channel\/[A-Za-z0-9_\-]+|user\/[A-Za-z0-9._\-]+)\/?/i,
    reject: /youtube\.com\/(watch|embed|oembed|playlist|results|hashtag)/i,
  },
  {
    platform: "twitter",
    regex: /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/(?!intent|share|home|search|i|hashtag|messages)([A-Za-z0-9_]{2,15})\/?/i,
    reject: /(twitter|x)\.com\/(intent|share|home|search)/i,
  },
  {
    platform: "whatsapp",
    regex: /https?:\/\/(?:wa\.me|api\.whatsapp\.com\/send|chat\.whatsapp\.com)\/[^\s"'<>]+/i,
  },
  {
    platform: "pinterest",
    regex: /https?:\/\/(?:[a-z]{2,3}\.)?pinterest\.[a-z]{2,4}\/([A-Za-z0-9._\-/]{2,80})/i,
    reject: /pinterest\.com\/pin\//i,
  },
];

export function extractSocialProfiles(input: {
  html: string;
  links: { href: string }[];
}): SocialProfiles {
  const result: SocialProfiles = { ...EMPTY };
  const candidates: string[] = [];

  for (const link of input.links) {
    if (link.href && typeof link.href === "string") {
      candidates.push(link.href);
    }
  }
  candidates.push(input.html);

  const blob = candidates.join("\n");

  for (const { platform, regex, reject } of PATTERNS) {
    if (result[platform]) continue;
    const matches = blob.matchAll(new RegExp(regex.source, regex.flags + "g"));
    for (const m of matches) {
      const url = m[0];
      if (reject && reject.test(url)) continue;
      result[platform] = normalizeUrl(url);
      break;
    }
  }

  return result;
}

function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    u.search = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return raw.trim();
  }
}
