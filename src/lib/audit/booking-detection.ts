/**
 * Detects which third-party booking system (if any) a website embeds.
 *
 * Detection runs against rendered HTML (post-JS) and a list of all link hrefs.
 * Returns the canonical provider name when found (e.g. "Calendly", "Setmore"),
 * or null when no booking system is detected.
 *
 * Why this matters: in Leadac AI's outbound flow, "no booking system" is the
 * highest-conviction segment for the "modernize their site" pitch. Confidently
 * detecting Calendly / Setmore / etc. prevents false-positive outreach to
 * prospects who already solved the problem.
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
  "Vagaro",
  "Mindbody",
  "Fresha",
  "Treatwell",
  "Booking.com",
  "Eveve",
  "Tablein",
  "TheFork",
] as const;

export type BookingProvider = (typeof BOOKING_PROVIDERS)[number];

interface ProviderRule {
  provider: BookingProvider;
  hostnames: string[];
  htmlPatterns: string[];
}

const RULES: ProviderRule[] = [
  {
    provider: "Calendly",
    hostnames: ["calendly.com", "assets.calendly.com"],
    htmlPatterns: ["calendly-badge-widget", "calendly.initpopupwidget"],
  },
  {
    provider: "Cal.com",
    hostnames: ["cal.com", "app.cal.com"],
    htmlPatterns: ["cal-namespace", "data-cal-link"],
  },
  {
    provider: "Setmore",
    hostnames: ["setmore.com", "my.setmore.com", "booking-page.setmore.com"],
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
    hostnames: ["squareup.com", "square.site"],
    htmlPatterns: ["squareup.com/appointments", "data-square-appointments"],
  },
  {
    provider: "Acuity",
    hostnames: ["acuityscheduling.com", "app.acuityscheduling.com"],
    htmlPatterns: ["acuityscheduling.com/schedule", "embed.acuityscheduling.com"],
  },
  {
    provider: "Timely",
    hostnames: ["gettimely.com", "book.gettimely.com"],
    htmlPatterns: ["gettimely.com/book"],
  },
  {
    provider: "OpenTable",
    hostnames: ["opentable.com", "opentable.co.uk"],
    htmlPatterns: ["opentable.com/widget", "ot-dtp-picker"],
  },
  {
    provider: "Resy",
    hostnames: ["resy.com"],
    htmlPatterns: ["resy_button_widget", "widgets.resy.com"],
  },
  {
    provider: "Vagaro",
    hostnames: ["vagaro.com"],
    htmlPatterns: ["vagaro.com/widget"],
  },
  {
    provider: "Mindbody",
    hostnames: ["mindbodyonline.com", "clients.mindbodyonline.com"],
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
    provider: "Booking.com",
    hostnames: ["booking.com"],
    htmlPatterns: ["booking.com/searchresults", "bookingcom-widget"],
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
    hostnames: ["thefork.com", "thefork.co.uk", "thefork.fr"],
    htmlPatterns: ["thefork.com/widget", "tf-widget"],
  },
];

export interface BookingDetectionInput {
  html: string;
  links: { href: string }[];
}

export function detectBookingProvider(
  input: BookingDetectionInput
): BookingProvider | null {
  const lowerHtml = input.html.toLowerCase();

  for (const rule of RULES) {
    if (rule.htmlPatterns.some((p) => lowerHtml.includes(p.toLowerCase()))) {
      return rule.provider;
    }

    const matchInLinks = input.links.some((link) => {
      const href = (link.href || "").toLowerCase();
      return rule.hostnames.some((h) => href.includes(h));
    });

    if (matchInLinks) {
      return rule.provider;
    }
  }

  return null;
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
