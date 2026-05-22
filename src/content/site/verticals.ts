/**
 * Vertical packs — positioning §10.
 *
 * Each vertical exposes the same shape so `/for/<slug>` pages render
 * identically from data. Signals are the public, observable footprints
 * that LeadAC's discovery indexes for that vertical.
 */

export type VerticalPack = {
  slug: string;
  name: string;
  /** Short label for nav / breadcrumb. */
  shortName: string;
  /** Hero headline + subhead — brand-assets §2.7 vertical variants. */
  hero: { headline: string; subhead: string };
  /** Persona who is the buyer (matches Mike or Daniel cards). */
  personaId: "daniel" | "mike";
  /** Public software signatures (footers / scripts / domain patterns). */
  signals: Array<{
    label: string;
    /** A specific observable — what LeadAC's crawler looks for. */
    observable: string;
  }>;
  /** Pain IDs (from pains.ts) the vertical page features. */
  painIds: string[];
  /** Sample CTA on the page — gated brief download. */
  sampleBrief: { href: string; label: string };
  /** Brand-assets shipping wave (1 = beachhead, 2 = secondary). */
  wave: 1 | 2;
};

export const VERTICALS: VerticalPack[] = [
  {
    slug: "field-service-saas",
    name: "Field service software vendors",
    shortName: "Field service",
    hero: {
      headline:
        "Field service software outbound, with the memory layer your SDRs are already building in their heads.",
      subhead:
        "See which HVAC companies use ServiceTitan, Jobber, or Housecall Pro — plus location count, review pattern, owner activity. Synced to HubSpot. 1-hour setup.",
    },
    personaId: "mike",
    signals: [
      {
        label: "ServiceTitan footer",
        observable:
          "Booking widget script + powered-by footer mark on multi-location HVAC sites.",
      },
      {
        label: "Jobber booking flow",
        observable:
          "Standard Jobber appointment form embed + the Jobber-hosted /book-online path.",
      },
      {
        label: "Housecall Pro install",
        observable:
          "App-store badge + Housecall-hosted scheduling subdomain.",
      },
      {
        label: "FieldEdge dispatcher",
        observable:
          "FieldEdge tracking pixel + the /dispatch path on a multi-truck operator's website.",
      },
      {
        label: "Multi-location operator",
        observable:
          "3+ Google Business Profiles tied to one owner, expansion post in last 90 days.",
      },
      {
        label: "Owner-operator activity",
        observable:
          "Owner profile on Google Business updated in last 60 days, last review responded to in <72 hours.",
      },
    ],
    painIds: ["P-001", "P-004", "P-008", "P-010", "P-012"],
    sampleBrief: {
      href: "/resources/sample-hvac-account-brief",
      label: "Download a sample HVAC account brief",
    },
    wave: 1,
  },
  {
    slug: "restaurant-tech-saas",
    name: "Restaurant tech software vendors",
    shortName: "Restaurant tech",
    hero: {
      headline:
        "Sell restaurant tech faster. We see the footer, the menu, the booking flow, and the reviews — your CRM only sees the address.",
      subhead:
        "Operational intelligence for F&B SaaS GTM. Built with FineDine and the next generation of restaurant tech vendors.",
    },
    personaId: "daniel",
    signals: [
      {
        label: "OpenTable Lite footer",
        observable:
          "OpenTable Lite reservation widget without the full OpenTable enterprise script — a migration signal.",
      },
      {
        label: "Toast install",
        observable:
          "Toast online ordering widget + Toast-hosted /order subdomain.",
      },
      {
        label: "Resy footer",
        observable:
          "Resy reservation script + Resy-hosted /reservations subdomain.",
      },
      {
        label: "Square for Restaurants",
        observable:
          "Square ordering widget plus Square-hosted gift-card flow.",
      },
      {
        label: "Multi-location restaurant group",
        observable:
          "3+ Google Business Profiles with shared owner email + recent expansion post.",
      },
      {
        label: "Reservation flow quality",
        observable:
          "Booking widget loads in <2s, has same-day availability, lists party-size up to 8.",
      },
    ],
    painIds: ["P-001", "P-004", "P-010", "P-012"],
    sampleBrief: {
      href: "/resources/sample-restaurant-account-brief",
      label: "Download a sample restaurant tech account brief",
    },
    wave: 2,
  },
  {
    slug: "dental-practice-software",
    name: "Dental practice management software vendors",
    shortName: "Dental software",
    hero: {
      headline:
        "Dental practice software outbound, built for the multi-location DSO conversation.",
      subhead:
        "See which practices use Dentrix, Eaglesoft, Open Dental, or Curve Dental — plus location count, hygienist team size, recent expansion. Synced to HubSpot.",
    },
    personaId: "mike",
    signals: [
      {
        label: "Dentrix install",
        observable:
          "Dentrix-hosted patient portal subdomain + Dentrix patient-form script.",
      },
      {
        label: "Eaglesoft install",
        observable:
          "Eaglesoft patient-portal widget + the standard /eaglesoft path.",
      },
      {
        label: "Open Dental install",
        observable:
          "Open Dental's open-source patient portal markup + the /opendental path.",
      },
      {
        label: "Curve Dental install",
        observable:
          "Curve Dental's cloud patient portal + curvedental.com referrer.",
      },
      {
        label: "Multi-location DSO",
        observable:
          "3+ Google Business Profiles + shared NPI registry footprint + recent acquisition press release.",
      },
      {
        label: "Hygienist team signal",
        observable:
          "Staff page mentioning 5+ hygienists with separate booking pages per provider.",
      },
    ],
    painIds: ["P-001", "P-004", "P-008", "P-010"],
    sampleBrief: {
      href: "/resources/sample-dental-account-brief",
      label: "Download a sample dental account brief",
    },
    wave: 2,
  },
];

export function getVertical(slug: string): VerticalPack {
  const v = VERTICALS.find((x) => x.slug === slug);
  if (!v) throw new Error(`Unknown vertical slug: ${slug}`);
  return v;
}
