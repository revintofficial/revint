/**
 * Niche packs are the unit of vertical specialization in Lead Engine.
 *
 * Each pack bundles together:
 *  - the Google Places search keywords that surface the right businesses,
 *  - the audit signals that matter most for that vertical (e.g. "online
 *    appointment" for dental, "emergency call" for HVAC), used both for
 *    scoring weights and for the personalized opener,
 *  - a mockup template id pointing to the niche-specific HTML scaffold the
 *    Gemini copy filler renders into.
 *
 * Adding a niche is intentionally lightweight: a single entry in NICHES below
 * is enough to enable it across discovery, scoring, and the mockup engine.
 */

export interface NichePack {
  /** URL-safe identifier; used in routes like `/for/{slug}`, mockup template ids, etc. */
  slug: string;
  /** Display name shown in dropdowns and headings. */
  label: string;
  /** Plain-language one-liner for landing pages and tooltips. */
  tagline: string;
  /** Google Places search queries. The first entry is the canonical query for new discoveries. */
  searchQueries: string[];
  /** Sales pitch angle the opener and mockup should highlight. */
  pitchAngle: string;
  /** Audit signals that make a strong cold-email opener for this vertical. */
  highValueSignals: string[];
  /** Booking provider hint — providers commonly used by this niche, used for "no-booking" segmentation. */
  commonBookingProviders: string[];
  /** Mockup template id (matches `templates/{id}.html`). Falls back to "generic" if not implemented yet. */
  mockupTemplateId: string;
}

export const NICHES: NichePack[] = [
  {
    slug: "phone-repair",
    label: "Phone & device repair",
    tagline: "iPhone, Samsung, screen + battery shops with weak booking flows.",
    searchQueries: ["phone repair shop", "iphone repair", "mobile repair store", "computer repair"],
    pitchAngle: "Most repair shops still take calls. Online booking + price quote = 3x lead capture.",
    highValueSignals: ["no online booking", "no price list", "no instant quote form", "missing whatsapp link"],
    commonBookingProviders: ["Calendly", "Setmore", "Booksy"],
    mockupTemplateId: "phone-repair",
  },
  {
    slug: "hvac",
    label: "HVAC & climate",
    tagline: "Heating, AC, and emergency call-out specialists with referral-only pipelines.",
    searchQueries: ["hvac contractor", "air conditioning installation", "boiler repair", "heating engineer"],
    pitchAngle: "Emergency call-out CTA + 24/7 contact form is the difference between booked and lost.",
    highValueSignals: ["no emergency CTA", "no 24/7 indicator", "no service-area page", "no schema.org LocalBusiness"],
    commonBookingProviders: ["Setmore", "Calendly"],
    mockupTemplateId: "hvac",
  },
  {
    slug: "plumbing",
    label: "Plumbing",
    tagline: "Independent plumbers and small crews with phone-only intake.",
    searchQueries: ["plumber", "emergency plumber", "drain cleaning service", "boiler installation"],
    pitchAngle: "Same-day booking widget + Trustpilot embed = double the call-back rate.",
    highValueSignals: ["no booking widget", "no Trustpilot/Google review badge", "no service area map"],
    commonBookingProviders: ["Setmore", "Calendly", "ServiceM8"],
    mockupTemplateId: "plumbing",
  },
  {
    slug: "dental",
    label: "Dental practice",
    tagline: "Independent dentists and small practices missing online booking.",
    searchQueries: ["dentist", "dental practice", "dental clinic", "cosmetic dentist"],
    pitchAngle: "Online appointment + new-patient form removes the receptionist bottleneck.",
    highValueSignals: ["no online appointment", "no new patient form", "no insurance/payment info", "outdated copyright year"],
    commonBookingProviders: ["SimplyBook", "Setmore", "Acuity"],
    mockupTemplateId: "dental",
  },
  {
    slug: "locksmith",
    label: "Locksmith",
    tagline: "24/7 emergency locksmiths with weak local SEO and no quote flow.",
    searchQueries: ["locksmith", "emergency locksmith", "auto locksmith", "lock repair"],
    pitchAngle: "Click-to-call + service-area map = capture the panic-Google searcher.",
    highValueSignals: ["no click-to-call header", "no service area map", "no instant quote", "missing local schema"],
    commonBookingProviders: ["Calendly"],
    mockupTemplateId: "locksmith",
  },
  {
    slug: "auto-detail",
    label: "Auto detailing & valet",
    tagline: "Mobile detailers and shopfront valets monetizing Instagram, not their site.",
    searchQueries: ["auto detailing", "car valet", "mobile car detailing", "ceramic coating"],
    pitchAngle: "Package menu + booking calendar replaces the DM-for-a-quote workflow.",
    highValueSignals: ["no package menu", "no booking calendar", "no before/after gallery on site"],
    commonBookingProviders: ["Booksy", "Vagaro", "Calendly"],
    mockupTemplateId: "auto-detail",
  },
  {
    slug: "opticians",
    label: "Opticians",
    tagline: "Independent opticians and eye-care practices with template sites.",
    searchQueries: ["optician", "eye care clinic", "opticians", "vision center"],
    pitchAngle: "Online eye-test booking + frame catalog with 'try in store' CTA.",
    highValueSignals: ["no online eye-test booking", "no frame catalog", "no insurance info"],
    commonBookingProviders: ["SimplyBook", "Setmore"],
    mockupTemplateId: "opticians",
  },
  {
    slug: "beauty-salon",
    label: "Beauty salons & barbers",
    tagline: "Salons and barbershops on outdated Squarespace templates.",
    searchQueries: ["beauty salon", "hair salon", "barber shop", "nail salon"],
    pitchAngle: "Booksy/Fresha booking embed + service price list converts walk-by traffic.",
    highValueSignals: ["no booking embed", "no service price list", "outdated stylist photos"],
    commonBookingProviders: ["Booksy", "Fresha", "Treatwell", "Vagaro"],
    mockupTemplateId: "beauty-salon",
  },
  {
    slug: "gym",
    label: "Gym & fitness",
    tagline: "Independent gyms, CrossFit boxes, PT studios with no trial-class flow.",
    searchQueries: ["gym fitness centre", "crossfit gym", "personal training studio", "yoga studio"],
    pitchAngle: "Free trial class CTA + class schedule + member testimonials.",
    highValueSignals: ["no free trial CTA", "no class schedule", "no testimonial section", "outdated member photos"],
    commonBookingProviders: ["Mindbody", "Calendly", "Setmore"],
    mockupTemplateId: "gym",
  },
  {
    slug: "restaurant",
    label: "Restaurants & cafes",
    tagline: "Independent restaurants without OpenTable / Resy and no menu PDF.",
    searchQueries: ["restaurant", "cafe coffee shop", "bistro", "fine dining restaurant"],
    pitchAngle: "Reservation widget + photo menu + delivery integration = 2x peak-hour bookings.",
    highValueSignals: ["no reservation widget", "menu only as PDF link", "no delivery CTA", "no Instagram embed"],
    commonBookingProviders: ["OpenTable", "Resy", "TheFork", "Eveve"],
    mockupTemplateId: "restaurant",
  },
];

export function getNicheBySlug(slug: string): NichePack | undefined {
  return NICHES.find((n) => n.slug === slug);
}

export function getNicheByQuery(query: string): NichePack | undefined {
  const normalized = query.toLowerCase().trim();
  return NICHES.find((n) =>
    n.searchQueries.some((q) => q.toLowerCase() === normalized)
  );
}
