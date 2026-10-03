/**
 * Detects which third-party booking system (if any) a website embeds.
 *
 * Detection runs against rendered HTML (post-JS) and a list of all link hrefs.
 * Returns the canonical provider name when found (e.g. "Calendly", "Setmore"),
 * or null when no booking system is detected.
 *
 * Why this matters: in Revint's outbound flow, "no booking system" is the
 * highest-conviction segment for the "modernize their site" pitch. Confidently
 * detecting Calendly / Setmore / etc. prevents false-positive outreach to
 * prospects who already solved the problem.
 *
 * Website-audit eval (2026-10, 40 real restaurant sites): SevenRooms, Dojo,
 * ResDiary and Quandoo were the most common providers we could not name;
 * BentoBox sites preconnect to `widgets.resy.com` whatever they book with,
 * a Square gift-card link read as "Square Appointments", and a hotel's
 * Booking.com link read as a table provider. Hence: host matching on real
 * link hosts (not substrings), resource hints ignored, no lodging OTA.
 */

export const BOOKING_PROVIDERS = [
  "Calendly",
  "Cal.com",
  "Setmore",
  "SimplyBook",
  "Booksy",
  "Square Appointments",
  "Acuity",
  "Timely",
  "OpenTable",
  "Resy",
  "SevenRooms",
  "Dojo",
  "ResDiary",
  "Quandoo",
  "Tock",
  "TableCheck",
  "Eat App",
  "Formitable",
  "Yelp Reservations",
  "Vagaro",
  "Mindbody",
  "Fresha",
  "Treatwell",
  "Eveve",
  "Tablein",
  "TheFork",
] as const;

export type BookingProvider = (typeof BOOKING_PROVIDERS)[number];

interface ProviderRule {
  provider: BookingProvider;
  /**
   * Link targets. A bare host (`resy.com`) matches that host and its
   * subdomains; an entry with a path (`squareup.com/appointments`) also
   * requires the URL path to start with that path.
   */
  hostnames: string[];
  /** Substrings of the HTML (script / iframe src, widget markers). */
  htmlPatterns: string[];
}

const RULES: ProviderRule[] = [
  {
    provider: "Calendly",
    hostnames: ["calendly.com"],
    htmlPatterns: ["calendly-badge-widget", "calendly.initpopupwidget"],
  },
  {
    provider: "Cal.com",
    hostnames: ["cal.com"],
    htmlPatterns: ["cal-namespace", "data-cal-link"],
  },
  {
    provider: "Setmore",
    hostnames: ["setmore.com"],
    htmlPatterns: ["setmore-button", "setmore_iframe"],
  },
  {
    provider: "SimplyBook",
    hostnames: ["simplybook.me", "simplybook.it"],
    htmlPatterns: ["simplybook.me/v2", "simplybook-widget"],
  },
  {
    provider: "Booksy",
    hostnames: ["booksy.com"],
    htmlPatterns: ["booksy-widget", "booksy.com/widget"],
  },
  {
    provider: "Square Appointments",
    // `squareup.com` alone also carries gift cards and online stores.
    hostnames: ["squareup.com/appointments", "book.squareup.com", "app.squareup.com/appointments"],
    htmlPatterns: ["squareup.com/appointments", "data-square-appointments"],
  },
  {
    provider: "Acuity",
    hostnames: ["acuityscheduling.com"],
    htmlPatterns: ["acuityscheduling.com/schedule", "embed.acuityscheduling.com"],
  },
  {
    provider: "Timely",
    hostnames: ["gettimely.com"],
    htmlPatterns: ["gettimely.com/book"],
  },
  {
    provider: "OpenTable",
    hostnames: [
      "opentable.com",
      "opentable.co.uk",
      "opentable.ie",
      "opentable.de",
      "opentable.es",
      "opentable.it",
      "opentable.nl",
      "opentable.com.au",
      "opentable.ca",
      "opentable.jp",
      "opentable.com.mx",
    ],
    htmlPatterns: ["opentable.com/widget", "opentable.co.uk/widget", "ot-dtp-picker", "ot-widget-container"],
  },
  {
    provider: "Resy",
    hostnames: ["resy.com"],
    htmlPatterns: ["resy_button_widget", "widgets.resy.com"],
  },
  {
    provider: "SevenRooms",
    hostnames: ["sevenrooms.com"],
    htmlPatterns: ["sevenrooms.com/widget", "sevenrooms.com/reservations", "sevenrooms.com/explore"],
  },
  {
    provider: "Dojo",
    // Dojo Bookings. `app.walkup.co/create_booking` has the same booking path;
    // Padella labels its Walkup queue link "the Dojo App".
    hostnames: ["web.dojo.app/create_booking", "dojo.app/create_booking", "app.walkup.co/create_booking"],
    htmlPatterns: ["web.dojo.app/create_booking"],
  },
  {
    provider: "ResDiary",
    hostnames: ["resdiary.com"],
    htmlPatterns: ["booking.resdiary.com", "resdiary.com/widget"],
  },
  {
    provider: "Quandoo",
    hostnames: [
      "quandoo.com",
      "quandoo.co.uk",
      "quandoo.de",
      "quandoo.at",
      "quandoo.ch",
      "quandoo.it",
      "quandoo.nl",
      "quandoo.com.tr",
      "quandoo.com.au",
      "quandoo.sg",
      "quandoo.fi",
    ],
    htmlPatterns: ["quandoo.com/widget"],
  },
  {
    provider: "Tock",
    hostnames: ["exploretock.com"],
    htmlPatterns: ["exploretock.com/"],
  },
  {
    provider: "TableCheck",
    hostnames: ["tablecheck.com"],
    htmlPatterns: ["tablecheck.com/"],
  },
  {
    provider: "Eat App",
    hostnames: ["eatapp.co"],
    htmlPatterns: ["eatapp.co/"],
  },
  {
    provider: "Formitable",
    hostnames: ["formitable.com"],
    htmlPatterns: ["widget.formitable.com", "ft-widget"],
  },
  {
    provider: "Yelp Reservations",
    hostnames: ["yelp.com/reservations"],
    htmlPatterns: ["yelp.com/reservations"],
  },
  {
    provider: "Vagaro",
    hostnames: ["vagaro.com"],
    htmlPatterns: ["vagaro.com/widget"],
  },
  {
    provider: "Mindbody",
    hostnames: ["mindbodyonline.com"],
    htmlPatterns: ["healcode", "mindbody-widget"],
  },
  {
    provider: "Fresha",
    hostnames: ["fresha.com"],
    htmlPatterns: ["fresha.com/book"],
  },
  {
    provider: "Treatwell",
    hostnames: ["treatwell.com", "treatwell.co.uk"],
    htmlPatterns: ["treatwell.com/widget"],
  },
  {
    provider: "Eveve",
    hostnames: ["eveve.com"],
    htmlPatterns: ["eveve.com/install"],
  },
  {
    provider: "Tablein",
    hostnames: ["tablein.com"],
    htmlPatterns: ["tablein.com/widget"],
  },
  {
    provider: "TheFork",
    hostnames: ["thefork.com", "thefork.co.uk", "thefork.fr", "thefork.it", "thefork.es", "lafourchette.com"],
    htmlPatterns: ["thefork.com/widget", "tf-widget"],
  },
];

export interface BookingDetectionInput {
  html: string;
  links: { href: string }[];
}

/** A provider's legal / privacy pages are cookie-banner noise, not a booking link. */
const LEGAL_PATH = /\/(legal|privacy|privacy-policy|terms|terms-of-service|terms-and-conditions|cookies?|cookie-policy)(\/|$|-)/i;

/**
 * Resource hints name hosts a site *might* talk to (BentoBox preconnects to
 * `widgets.resy.com` on every venue). Only loaded resources and links count.
 */
function withoutResourceHints(html: string): string {
  return html.replace(/<link\b[^>]*\brel=["']?(?:preconnect|dns-prefetch|prefetch|preload)["']?[^>]*>/gi, "");
}

function hostMatches(url: URL, entry: string): boolean {
  const slash = entry.indexOf("/");
  const host = (slash === -1 ? entry : entry.slice(0, slash)).toLowerCase();
  const path = slash === -1 ? "" : entry.slice(slash).toLowerCase();
  const h = url.hostname.toLowerCase();
  if (h !== host && !h.endsWith(`.${host}`)) return false;
  return path === "" || url.pathname.toLowerCase().startsWith(path);
}

/** The provider whose link or widget the page carries, with the evidence. */
export function detectBookingProviderEvidence(
  input: BookingDetectionInput,
): { provider: BookingProvider; evidence: string } | null {
  const lowerHtml = withoutResourceHints(input.html).toLowerCase();
  const urls: URL[] = [];
  const legal: URL[] = [];
  for (const link of input.links) {
    try {
      const u = new URL(link.href || "");
      if (/^https?:$/.test(u.protocol)) (LEGAL_PATH.test(u.pathname) ? legal : urls).push(u);
    } catch {
      // relative or malformed: cannot be a third-party provider
    }
  }

  for (const rule of RULES) {
    const link = urls.find((u) => rule.hostnames.some((h) => hostMatches(u, h)));
    if (link) return { provider: rule.provider, evidence: link.href };
    const pattern = rule.htmlPatterns.find((p) => lowerHtml.includes(p.toLowerCase()));
    if (pattern) return { provider: rule.provider, evidence: pattern };
  }
  // Last resort: an embedded widget's own terms link ("you agree to the
  // OpenTable terms") or a cookie banner naming the provider's cookies.
  // Both mean the provider's code runs on the page.
  for (const rule of RULES) {
    const link = legal.find((u) => rule.hostnames.some((h) => hostMatches(u, h)));
    if (link) return { provider: rule.provider, evidence: link.href };
  }
  return null;
}

export function detectBookingProvider(input: BookingDetectionInput): BookingProvider | null {
  return detectBookingProviderEvidence(input)?.provider ?? null;
}


/**
 * Lightweight email scraper. Pulls mailto: hrefs and conservative text-pattern
 * matches, then filters obvious junk (image filenames, sentry tokens, etc.).
 *
 * Conservative on purpose: a false-positive email in an outbound CSV burns
 * deliverability. Better to return zero emails than wrong ones.
 */
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const EMAIL_BLOCKLIST_DOMAINS = new Set([
  "sentry.io",
  "sentry-next.wixpress.com",
  "wixpress.com",
  "example.com",
  "domain.com",
  "yoursite.com",
  "mysite.com",
  "youremail.com",
]);
const EMAIL_BLOCKLIST_LOCAL = new Set([
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "mailer-daemon",
  "postmaster",
]);

export function extractContactEmails(input: {
  html: string;
  links: { href: string }[];
}): string[] {
  const found = new Set<string>();

  for (const link of input.links) {
    if (!link.href.toLowerCase().startsWith("mailto:")) continue;
    const raw = link.href.slice(7).split("?")[0].trim().toLowerCase();
    if (raw && isLikelyRealEmail(raw)) {
      found.add(raw);
    }
  }

  const matches = input.html.match(EMAIL_RE);
  if (matches) {
    for (const raw of matches) {
      const email = raw.toLowerCase();
      if (isLikelyRealEmail(email)) {
        found.add(email);
      }
    }
  }

  return Array.from(found).slice(0, 5);
}

function isLikelyRealEmail(email: string): boolean {
  const [local, domain] = email.split("@");
  if (!local || !domain) return false;
  if (EMAIL_BLOCKLIST_DOMAINS.has(domain)) return false;
  if (EMAIL_BLOCKLIST_LOCAL.has(local)) return false;
  if (local.length > 64 || domain.length > 253) return false;
  if (/[a-f0-9]{20,}/.test(local)) return false; // sentry-style hashes
  if (domain.endsWith(".png") || domain.endsWith(".jpg") || domain.endsWith(".gif")) return false;
  return true;
}
