/**
 * Niche packs are the unit of vertical specialization in Leadac AI.
 *
 * Each pack bundles together:
 *  - the Google Places search keywords that surface the right businesses,
 *  - the audit signals that matter most for that vertical (e.g. "online
 *    appointment" for dental, "no QR pay" for a bar), used both for
 *    scoring weights and for the personalized opener,
 *  - a mockup template id pointing to the niche-specific HTML scaffold the
 *    Gemini copy filler renders into,
 *  - (hybrid niches only) a `parentSlug` that points at the parent pack
 *    and a `featuredProductModules` list of the workspace's own product
 *    modules that resonate most for this sub-vertical.
 *
 * Two niche shapes coexist:
 *  - **Flat** packs: one slug, no parent (most legacy verticals like
 *    `phone-repair`, `hvac`, `dental`).
 *  - **Hybrid** packs: a `parentSlug`-less parent pack (e.g. `fnb`) plus N
 *    child packs (`fnb-fine-dining`, `fnb-bar-club`, ...). The parent pack
 *    serves as the rollup for dashboards / reports while the child pack is
 *    what discovery, audit, opener, mockup, and memory all branch on at
 *    runtime. The auto-classifier worker (`FNB_SUBVERTICAL_CLASSIFIER`)
 *    tags new leads with the most likely child slug.
 *
 * Adding a niche is intentionally lightweight: a single entry in NICHES
 * below is enough to enable it across discovery, scoring, memory scoping,
 * and the mockup engine.
 */

export interface NichePack {
  /** URL-safe identifier; used in routes like `/for/{slug}`, mockup template ids, etc. */
  slug: string;
  /**
   * Parent pack slug for hybrid niches. When set, this pack is a child
   * of `parentSlug`; the parent pack itself has no `parentSlug`. Flat
   * niches (single-level) leave this undefined.
   */
  parentSlug?: string;
  /** Display name shown in dropdowns and headings. */
  label: string;
  /** Plain-language one-liner for landing pages and tooltips. */
  tagline: string;
  /**
   * Google Places search queries. The first entry is the canonical
   * query for new discoveries; the fan-out path also iterates the
   * second entry for breadth.
   *
   * Multi-word queries should be wrapped in literal double quotes
   * (e.g. `'"food truck"'`) so Google Places treats them as a phrase
   * rather than two independent tokens — a bare "food truck" matches
   * `truck_dealer` and gas-station mini-marts.
   */
  searchQueries: string[];
  /**
   * Google Places `primaryType` values to forward as `includedType`
   * on the Text Search call. Acts as a server-side hard filter so
   * (e.g.) the `fnb-food-truck` fan-out cannot return a building-
   * materials store. Optional — when absent, no type filter is sent.
   *
   * Note: Google's `places:searchText` accepts a single
   * `includedType` per request. When this array has multiple
   * entries, the discovery layer uses the first; running additional
   * filtered passes is left to follow-up work since the dedup-by-
   * placeId already absorbs cross-query overlap.
   */
  discoveryPlaceTypes?: string[];
  /** Sales pitch angle the opener and mockup should highlight. */
  pitchAngle: string;
  /** Audit signals that make a strong cold-email opener for this vertical. */
  highValueSignals: string[];
  /** Booking provider hint — providers commonly used by this niche, used for "no-booking" segmentation. */
  commonBookingProviders: string[];
  /** Mockup template id (matches `templates/{id}.html`). Falls back to "generic" if not implemented yet. */
  mockupTemplateId: string;
  /**
   * Customer-facing offerings that THIS vertical typically sells to
   * ITS customers. Used by the website-mockup prompt to populate the
   * `courses` section on the lead's demo site so the page advertises
   * what the BUSINESS sells (e.g. driving-school: "B Sınıfı Ehliyet
   * Kursu", "A2 Motosiklet"), NOT what the agency selling the demo
   * sells (i.e. NOT the workspace's ServicePackages — those belong
   * in the opener / pitch deck only).
   *
   * Optional — when missing the prompt tells Gemini to infer
   * plausible offerings from the niche label + Google `primaryType`.
   * Free-form strings; the prompt repeats them verbatim into the
   * LLM context.
   */
  typicalCustomerOfferings?: string[];
  /**
   * Workspace product modules that are most relevant to this sub-vertical.
   * Used by the Gemini analysis prompt and opener writer to focus the
   * pitch on what the prospect actually needs (e.g. a ghost kitchen
   * does not need table management; a bar doesn't need a sommelier note).
   * Free-form labels — the prompt repeats them verbatim into the LLM
   * context window.
   */
  featuredProductModules?: string[];
  /**
   * Phase 2.4 — Hard NEGATIVE list. Modules listed here MUST NOT be
   * pitched in this niche's openers, audits, or mockups, even when a
   * weakly-related signal would otherwise tempt the LLM to mention
   * them. Beta finding §6 (Pied à Terre): the opener pitched
   * "online ordering" to a fine-dining restaurant where the entire
   * value proposition is white-glove service — wrong fit, wasted
   * outreach. The opener prompt builder injects this list as a
   * "NEVER mention" constraint; downstream auditors / package
   * selectors should also consult it before recommending a tier
   * built around an inapplicable module.
   *
   * Free-form labels are matched verbatim against
   * `featuredProductModules` and the workspace's offer copy. Keep
   * each entry short (1-5 words) so the model can parse the rule
   * cleanly.
   */
  notApplicableModules?: string[];
  /**
   * Round 2 §3.13 — chain-aware copy guard.
   *
   * When the lead carries the `chain_detected` reason code, the opener
   * prompt should know which feature areas are typically owned by the
   * chain HQ (so a per-location pitch is the wrong unit of work) and
   * which enterprise-grade modules pitch better at the brand level.
   * Empty / undefined for niches where chain dynamics don't apply.
   *
   * Used by:
   *   - `opener-writer.ts` (Sprint 1 lite) — builds a `Chain Considerations`
   *     block and forbids the `likelyCentralizedAtChainRoot` modules.
   *   - Hafta 2 PR-W2.E will plumb this into the package selector too.
   */
  chainConsiderations?: {
    /**
     * Modules that are almost always owned at the chain HQ level rather
     * than per location. Pitching them per-shop makes the rep look
     * uninformed (e.g. a cafe-chain manager doesn't decide on QR menus,
     * loyalty stamps, or order-ahead — that's a brand-level decision).
     */
    likelyCentralizedAtChainRoot: string[];
    /** Suggested chain-HQ pitch modules in place of the centralized ones. */
    chainEnterprisePitchModules: string[];
    /**
     * Names of well-known chains in this niche, used to short-circuit
     * the copy when the business is one of the obvious cases (Black
     * Sheep, Pret, Costa, …). Empty when the niche has no clear majors.
     */
    knownChainsByName: string[];
  };
  /**
   * Hints used by the auto-classifier worker to score this child slug
   * against a candidate lead. All fields optional; the classifier blends
   * whatever's available from Google Places + name + price level signals.
   */
  classifierHints?: {
    /** Google Places `primaryType` values that strongly indicate this sub-niche (e.g. ["bar", "night_club"]). */
    googlePlacesTypes?: string[];
    /** Substrings in the business name that bias toward this sub-niche (e.g. ["ghost kitchen", "cloud kitchen"]). */
    keywordsInName?: string[];
    /** Inclusive Google Places price_level range that fits this sub-niche (e.g. [3, 4] for fine dining). */
    priceLevelRange?: [number, number];
  };
}

export const NICHES: NichePack[] = [
  // ============================================================
  // Flat (single-level) niches — legacy verticals.
  // ============================================================
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
    // TR sürücü kursu (driving school) — added for the Emirhan
    // Yeşildağ web-agency tenant who targets İstanbul B-class
    // ehliyet kursları. Discovery routes the canonical Turkish
    // queries through Google Places' official `driving_school`
    // primaryType, so the rule classifier picks this pack up
    // even when the rep types "ehliyet kursu" or pastes a
    // mixed-locale string. Pitch angle anchors on online
    // booking + WhatsApp pre-fill which (per the rep's calls
    // with 30+ kurslar) is the #1 thing competitors lack.
    slug: "driving-school",
    label: "Sürücü kursu",
    tagline: "B / A2 / motosiklet ehliyet kursları ve direksiyon eğitimi merkezleri.",
    searchQueries: [
      "sürücü kursu",
      "ehliyet kursu",
      "motosiklet ehliyet kursu",
      "driving school",
    ],
    discoveryPlaceTypes: ["driving_school"],
    // `findNichePackForPrimaryType` reads classifierHints to map a
    // Google Places primaryType back to a pack — required so leads
    // discovered without `nicheSlug` (e.g. workspace default
    // discovery, free-text "sürücü kursu") still get the right
    // theme + imagery + audit pitch angle resolved by
    // `getVisualIdentityForLead`.
    classifierHints: {
      googlePlacesTypes: ["driving_school"],
      keywordsInName: ["sürücü kursu", "surucu kursu", "ehliyet", "driving school"],
    },
    pitchAngle:
      "Online randevu, eğitmen profilleri, sınav başarı oranı vitrini ve WhatsApp-ilk-temas akışı — telefon trafiğini yarıya indirir, kayıt 2x.",
    highValueSignals: [
      "no online lesson booking",
      "no instructor profile / photos",
      "no pass-rate / success indicator",
      "no price-package transparency (B, A2, motosiklet)",
      "no WhatsApp CTA",
      "no MEB / SRC certificate badge",
      "outdated mobile experience",
      "Instagram-only contact",
    ],
    commonBookingProviders: ["WhatsApp", "Calendly"],
    mockupTemplateId: "driving-school",
    typicalCustomerOfferings: [
      "B Sınıfı Ehliyet Kursu",
      "A2 Motosiklet Ehliyet Kursu",
      "A1 Motosiklet Ehliyet Kursu",
      "Direksiyon Yenileme Dersi",
      "Trafik ve İlk Yardım Dersleri",
    ],
  },

  // ============================================================
  // Hybrid niche: F&B (Food & Beverage)
  //
  // Parent: `fnb` — used for dashboards / discovery default / fallback
  // mockup template / public landing page hero. Children: 10 specialised
  // sub-verticals, one per FineDine target segment. Each child carries
  // its own search keywords, audit signals, pitch angle, and the subset
  // of FineDine product modules that resonate with that segment.
  // ============================================================
  {
    slug: "fnb",
    label: "Restaurants & F&B (all)",
    tagline: "Every food & beverage venue: fine dining, bar, cafe, ghost kitchen, food truck, hotel F&B, casual, QSR, airport, multi-location.",
    searchQueries: [
      "restaurant",
      "cafe coffee shop",
      "bar",
      "fast food restaurant",
      "fine dining restaurant",
      "food truck",
    ],
    pitchAngle:
      "FineDine bundles QR menu, payments, table management, reservations, delivery, kiosk, and CRM into one F&B platform — operators see ~20% higher revenue per cover and faster table turns.",
    highValueSignals: [
      "menu only as PDF link",
      "no QR menu",
      "no online payment",
      "no reservation widget",
      "no delivery CTA",
    ],
    commonBookingProviders: ["OpenTable", "Resy", "TheFork", "Eveve", "SevenRooms"],
    mockupTemplateId: "fnb-generic",
    featuredProductModules: [
      "QR Mobile Pay",
      "POS Lite",
      "Online Reservations",
      "Multi-branch Management",
      "CRM",
      "In-App Promotions",
      "Smart Recommendations",
    ],
  },
  {
    slug: "fnb-fine-dining",
    parentSlug: "fnb",
    label: "Fine dining",
    tagline:
      "Tasting-menu, Michelin-tier, sommelier-led restaurants where service quality is the brand.",
    searchQueries: [
      '"fine dining restaurant"',
      '"michelin restaurant"',
      '"tasting menu restaurant"',
      '"chef\'s table restaurant"',
    ],
    discoveryPlaceTypes: ["restaurant"],
    pitchAngle:
      "A premium reservation + smart recommendations + tip flow that protects the white-glove feel — guests scan, browse the chef's notes, and pay without the bill ever hitting the table.",
    highValueSignals: [
      "no premium reservation widget",
      "menu only as PDF link",
      "no sommelier / wine pairing notes",
      "no chef bio or tasting-menu page",
      "no allergen / dietary filter",
    ],
    commonBookingProviders: ["SevenRooms", "Tock", "OpenTable", "Resy"],
    mockupTemplateId: "fnb-fine-dining",
    featuredProductModules: [
      "Online Reservations (premium)",
      "Smart Recommendations (wine pairing)",
      "Restaurant CRM",
      "Tip Collection",
      "Feedback Tool",
    ],
    // Beta finding §6 — Pied à Terre opener pitched "online ordering"
    // to a Michelin-tier tasting-menu restaurant. Fine dining sells
    // white-glove service; delivery / takeaway / tablet ordering all
    // actively cheapen the brand. NEVER pitch these even if the
    // restaurant's website happens to lack them.
    notApplicableModules: [
      "Online ordering / delivery",
      "Tablet ordering",
      "QR-only ordering",
      "Order ahead",
      "Self-service kiosk",
      "Loyalty stamps",
    ],
    classifierHints: {
      // Beta finding §5 hızlı kazanç (2.3): Google Places now returns
      // many cuisine-specific subtypes ("french_restaurant",
      // "italian_restaurant" etc.) that our old type list missed —
      // Pied a Terre's primaryType comes back as "french_restaurant",
      // not "fine_dining_restaurant", so it was falling through into
      // the parent fnb pack with low confidence. Including the
      // cuisine subtypes here lets the rule-based classifier match
      // on type alone; the rating + priceLevel + reviewCount guard
      // in `findNichePackForPrimaryType` separates a casual bistro
      // from a fine-dining venue when the type is generic.
      googlePlacesTypes: [
        "fine_dining_restaurant",
        "restaurant",
        "french_restaurant",
        "italian_restaurant",
        "japanese_restaurant",
        "modern_european_restaurant",
        "scandinavian_restaurant",
        "spanish_restaurant",
        "mediterranean_restaurant",
        "steak_house",
        "seafood_restaurant",
      ],
      keywordsInName: ["fine dining", "tasting", "chef's", "michelin", "sommelier"],
      priceLevelRange: [3, 4],
    },
  },
  {
    slug: "fnb-bar-club",
    parentSlug: "fnb",
    label: "Bars & nightclubs",
    tagline:
      "Cocktail bars, wine bars, rooftop venues, and night clubs where peak-hour throughput is the bottleneck.",
    searchQueries: [
      '"cocktail bar"',
      '"wine bar"',
      '"rooftop bar"',
      '"night club"',
      '"sports bar"',
    ],
    discoveryPlaceTypes: ["bar", "night_club"],
    pitchAngle:
      "QR pay + tab/round split + tip prompt collapses the 12-minute close-the-tab queue at peak — staff stay on the floor, average tip rises 25%.",
    highValueSignals: [
      "no QR pay",
      "no tab / round-split flow",
      "no event calendar",
      "no age verification step",
      "static cocktail menu (no daily specials)",
    ],
    commonBookingProviders: ["Resy", "OpenTable", "DesignMyNight"],
    mockupTemplateId: "fnb-bar-club",
    featuredProductModules: [
      "QR Mobile Pay",
      "Fast Checkout",
      "Tip Collection",
      "Service Requests",
      "In-App Promotions",
    ],
    // Bars run on tab/round dynamics — pitching breakfast loyalty,
    // dinner reservations, or family-friendly menus is wrong-genre.
    notApplicableModules: [
      "Reservation widget",
      "Allergen filter (kids menu)",
      "Loyalty stamps (morning routine)",
    ],
    classifierHints: {
      googlePlacesTypes: ["bar", "night_club", "pub"],
      keywordsInName: ["bar", "club", "lounge", "pub", "tavern", "speakeasy"],
    },
  },
  {
    slug: "fnb-cafe-bakery",
    parentSlug: "fnb",
    label: "Cafes & bakeries",
    tagline:
      "Specialty coffee, neighborhood cafes, patisseries, and artisan bakeries with morning rush problems.",
    searchQueries: [
      '"specialty coffee shop"',
      '"bakery cafe"',
      "patisserie",
      '"coffee shop"',
      '"tea house"',
    ],
    discoveryPlaceTypes: ["cafe", "bakery", "coffee_shop"],
    pitchAngle:
      "Order-ahead QR + loyalty stamps + a like-and-comment menu turns 7am queues into pickups and grows repeat visits 30%.",
    highValueSignals: [
      "no order-ahead",
      "no loyalty program",
      "no Instagram embed",
      "menu only on chalkboard photo",
      "no allergen / vegan filter",
    ],
    commonBookingProviders: ["Square", "Toast", "Ordermark"],
    mockupTemplateId: "fnb-cafe-bakery",
    featuredProductModules: [
      "QR Mobile Pay (order-ahead)",
      "In-App Promotions",
      "Restaurant CRM (loyalty)",
      "Like & Comment",
      "Smart Recommendations",
    ],
    chainConsiderations: {
      // Round 2 §3.13 — Black Sheep / One Shot Coffee / Camden Roastery
      // are all multi-location chains where these decisions belong to
      // the brand HQ, not the per-location manager. Pitching them
      // per-shop is the "wrong unit of work" anti-pattern.
      likelyCentralizedAtChainRoot: [
        "QR Mobile Pay (order-ahead)",
        "Restaurant CRM (loyalty)",
        "loyalty stamps",
        "order-ahead",
      ],
      chainEnterprisePitchModules: [
        "multi-property analytics",
        "central menu management",
        "brand-level Restaurant CRM",
        "franchise mockup pack",
      ],
      knownChainsByName: [
        "Black Sheep Coffee",
        "Pret a Manger",
        "Pret",
        "Costa",
        "Costa Coffee",
        "Caffè Nero",
        "Starbucks",
        "Gail's",
        "One Shot Coffee",
      ],
    },
    classifierHints: {
      // Beta finding §5: include modern Places cuisine subtypes that
      // commonly come back for cafés ("brunch_restaurant",
      // "breakfast_restaurant" — mostly used for café-style daytime
      // venues), plus tea_house / juice_shop. The priceLevelRange
      // guard (1-2) prevents a high-end brunch spot from being
      // mis-bucketed into café when fine-dining is more accurate.
      googlePlacesTypes: [
        "cafe",
        "bakery",
        "coffee_shop",
        "brunch_restaurant",
        "breakfast_restaurant",
        "tea_house",
        "juice_shop",
      ],
      keywordsInName: ["cafe", "café", "coffee", "bakery", "patisserie", "espresso"],
      priceLevelRange: [1, 2],
    },
  },
  {
    slug: "fnb-ghost-kitchen",
    parentSlug: "fnb",
    label: "Ghost kitchens / cloud kitchens",
    tagline:
      "Delivery-only and virtual restaurant brands operating from shared kitchens with no walk-in service.",
    searchQueries: [
      '"ghost kitchen"',
      '"cloud kitchen"',
      '"delivery only restaurant"',
      '"virtual restaurant"',
      '"dark kitchen"',
    ],
    discoveryPlaceTypes: ["meal_takeaway", "meal_delivery"],
    pitchAngle:
      "Commission-free delivery + pickup ordering through your own branded site — every Deliveroo / UberEats commission saved is direct margin.",
    highValueSignals: [
      "delivery only via UberEats / Deliveroo (no own ordering)",
      "no commission-free CTA",
      "no own-brand storefront",
      "single channel dependence",
      "no scheduled-pickup flow",
    ],
    commonBookingProviders: ["Deliverect", "Otter", "Ordermark"],
    mockupTemplateId: "fnb-ghost-kitchen",
    featuredProductModules: [
      "Delivery & Pickup Menu (commission-free)",
      "Smart Recommendations",
      "Restaurant CRM",
      "In-App Promotions",
    ],
    // Delivery-only operations have no dining room — table /
    // reservation / sommelier modules don't apply.
    notApplicableModules: [
      "Table Management",
      "Online Reservations",
      "Tip Collection",
      "Sommelier / wine pairing",
    ],
    classifierHints: {
      keywordsInName: [
        "ghost",
        "cloud kitchen",
        "delivery only",
        "virtual",
        "dark kitchen",
      ],
    },
  },
  {
    slug: "fnb-food-truck",
    parentSlug: "fnb",
    label: "Food trucks",
    tagline:
      "Mobile food trucks and street food vendors that change location daily and live on Instagram.",
    searchQueries: [
      '"food truck"',
      '"street food vendor"',
      '"food cart"',
      '"mobile food"',
    ],
    discoveryPlaceTypes: ["meal_takeaway"],
    pitchAngle:
      "Mobile menu + QR pay + live location and schedule page — followers know where you are today and skip the cash-only line.",
    highValueSignals: [
      "no live location / schedule page",
      "Instagram-only menu",
      "cash-only signal in reviews",
      "no online ordering",
      "no QR pay",
    ],
    commonBookingProviders: ["Square", "SumUp"],
    mockupTemplateId: "fnb-food-truck",
    featuredProductModules: [
      "QR Mobile Pay",
      "POS Lite",
      "Mobile Menu",
      "In-App Promotions",
    ],
    // Mobile / pop-up — no fixed seating, no reservations, no
    // multi-room concepts. Pitch flexibility, not infrastructure.
    notApplicableModules: [
      "Table Management",
      "Online Reservations",
      "Multi-branch Management",
    ],
    classifierHints: {
      keywordsInName: ["food truck", "street food", "truck", "cart", "mobile kitchen"],
      priceLevelRange: [1, 2],
    },
  },
  {
    slug: "fnb-hotel-fnb",
    parentSlug: "fnb",
    label: "Hotel F&B",
    tagline:
      "Hotel restaurants, lobby bars, room service, and resort/spa dining run as part of a hospitality property.",
    searchQueries: [
      '"hotel restaurant"',
      '"hotel bar"',
      '"resort restaurant"',
      '"boutique hotel dining"',
    ],
    // We deliberately filter on restaurant/bar (not lodging) here so
    // Discovery surfaces the F&B outlet itself, not the parent hotel.
    // The hotel association is verified downstream by the
    // SUBVERTICAL_CLASSIFIER name guard (see Bug #8).
    discoveryPlaceTypes: ["restaurant", "bar"],
    pitchAngle:
      "One platform across room-service, lobby bar, restaurant and spa — guests order from any QR with their room number; F&B revenue per stay rises 15-20%.",
    highValueSignals: [
      "no in-room ordering",
      "no room-charge integration",
      "spa + restaurant + bar siloed",
      "no multi-outlet menu",
      "no language toggle for international guests",
    ],
    commonBookingProviders: ["SevenRooms", "Resy", "OpenTable"],
    mockupTemplateId: "fnb-hotel-fnb",
    featuredProductModules: [
      "Multi-branch Management",
      "Restaurant CRM (cross-property)",
      "Online Reservations",
      "QR Mobile Pay",
      "Service Requests",
    ],
    classifierHints: {
      // Intentionally [restaurant, bar] not [lodging, hotel,
      // resort_hotel]: this child pack targets the F&B OUTLET inside
      // a hospitality property, not the hotel-as-entity. A
      // primaryType=lodging row is a hotel itself (no F&B sale to
      // make against the receptionist) and should NOT classify here
      // — the ruleBasedClassify guard below enforces that. See Bug
      // #8 in research/finedine/discovery-bugs.md.
      googlePlacesTypes: ["restaurant", "bar"],
      keywordsInName: ["hotel", "resort", "boutique", "inn", "otel"],
    },
  },
  {
    slug: "fnb-casual-dining",
    parentSlug: "fnb",
    label: "Casual dining",
    tagline:
      "Bistros, gastropubs, family restaurants, and full-service casual venues where table turns drive revenue.",
    searchQueries: [
      '"casual dining restaurant"',
      "bistro",
      "gastropub",
      '"family restaurant"',
      '"italian restaurant"',
    ],
    discoveryPlaceTypes: ["restaurant"],
    pitchAngle:
      "Reservations + table management + service-request button cut wait complaints in half — same staff seats more guests per night.",
    highValueSignals: [
      "no reservation widget",
      "no visible table management",
      "no kids menu / family CTA",
      "long wait / slow service complaints in reviews",
      "no in-app promotions for slower nights",
    ],
    commonBookingProviders: ["OpenTable", "Resy", "TheFork", "Eveve"],
    mockupTemplateId: "fnb-casual-dining",
    featuredProductModules: [
      "Table Management",
      "Online Reservations",
      "Service Requests",
      "In-App Promotions",
      "QR Mobile Pay",
    ],
    classifierHints: {
      googlePlacesTypes: ["restaurant", "italian_restaurant", "family_restaurant"],
      keywordsInName: ["bistro", "gastropub", "trattoria", "tavern", "kitchen"],
      priceLevelRange: [2, 3],
    },
  },
  {
    slug: "fnb-qsr",
    parentSlug: "fnb",
    label: "Quick service (QSR)",
    tagline:
      "Burger, fried chicken, kebab, pizza, and other fast-food formats where speed-of-service is the entire game.",
    searchQueries: [
      '"fast food restaurant"',
      '"burger restaurant"',
      '"fried chicken restaurant"',
      '"kebab restaurant"',
      '"pizza restaurant"',
    ],
    discoveryPlaceTypes: ["fast_food_restaurant", "meal_takeaway"],
    pitchAngle:
      "Self-service kiosks + mobile order-ahead + combo upsell engine push average order value up 18% and shrink the line at lunchtime.",
    highValueSignals: [
      "no self-service kiosk option",
      "no order-ahead",
      "no combo upsell flow",
      "no loyalty / app program",
      "menu without prices",
    ],
    commonBookingProviders: ["Toast", "Square", "Lightspeed"],
    mockupTemplateId: "fnb-qsr",
    featuredProductModules: [
      "Kiosk Solutions",
      "Fast Checkout",
      "Mobile Order Ahead (Delivery & Pickup)",
      "In-App Promotions (combo upsell)",
      "Restaurant CRM (loyalty)",
    ],
    // QSR is throughput-led; reservations / sommelier / table
    // turn-time UI are wrong-genre.
    notApplicableModules: [
      "Online Reservations",
      "Sommelier / wine pairing",
      "Tasting menu builder",
    ],
    classifierHints: {
      googlePlacesTypes: ["fast_food_restaurant", "meal_takeaway"],
      keywordsInName: ["burger", "kebab", "pizza", "fried chicken", "express", "quick"],
      priceLevelRange: [1, 2],
    },
  },
  {
    slug: "fnb-airport-fnb",
    parentSlug: "fnb",
    label: "Airport F&B",
    tagline:
      "Restaurants, bars, and grab-and-go formats inside airport terminals where the boarding clock is everything.",
    searchQueries: [
      '"airport restaurant"',
      '"airport bar"',
      '"terminal restaurant"',
      '"duty free dining"',
    ],
    discoveryPlaceTypes: ["restaurant", "bar"],
    pitchAngle:
      "Boarding-time-aware ordering + fast pickup + multi-currency pay — the platform you already trust at Riga and Antalya brought to your terminal.",
    highValueSignals: [
      "no fast-pickup CTA",
      "no boarding-time aware ordering",
      "no multi-currency / multi-language",
      "no kiosk option for transit traffic",
      "static menu (no flight-delay daily updates)",
    ],
    commonBookingProviders: ["SSP", "HMSHost", "Areas"],
    mockupTemplateId: "fnb-airport-fnb",
    featuredProductModules: [
      "Fast Checkout",
      "Multi-branch Management",
      "Kiosk Solutions",
      "QR Mobile Pay (multi-currency)",
      "In-App Promotions",
    ],
    classifierHints: {
      keywordsInName: ["airport", "terminal", "duty free", "departures"],
    },
  },
  {
    slug: "fnb-multi-location",
    parentSlug: "fnb",
    label: "Restaurant chains / multi-location",
    tagline:
      "Restaurant groups, franchises, and multi-brand operators running 5+ locations under central management.",
    searchQueries: [
      '"restaurant chain"',
      '"restaurant group"',
      '"franchise restaurant"',
    ],
    discoveryPlaceTypes: ["restaurant"],
    pitchAngle:
      "Centralised menu, pricing, and analytics across every location — head office sees one dashboard, every location updates in seconds, brand stays consistent.",
    highValueSignals: [
      "menu inconsistency across locations",
      "no centralised analytics signal",
      "fragmented social presence per location",
      "different ordering flow per location",
      "no shared loyalty program",
    ],
    commonBookingProviders: ["OpenTable", "Toast", "Lightspeed"],
    mockupTemplateId: "fnb-multi-location",
    featuredProductModules: [
      "Multi-branch Management",
      "Centralised Menu Management",
      "Restaurant CRM (group-wide loyalty)",
      "Analytics Dashboard",
      "In-App Promotions (group-wide)",
    ],
    classifierHints: {
      keywordsInName: ["group", "chain", "franchise", "& co", "restaurants"],
    },
  },

  // ============================================================
  // Hybrid niche: Kuyumcu (jewelers)
  //
  // Parent: `kuyumcu` — rollup for dashboards / discovery default /
  // public landing page hero. Children: 2 specialised sub-verticals
  // tuned to İstanbul's TR jeweler market:
  //   - `kuyumcu-traditional` — Kapalıçarşı / mahalle kuyumcusu;
  //     gram altın, alyans, tamir, hurda bozdurma. TAM en geniş;
  //     claims the `jewelry_store` Google Places type so a fresh
  //     lead without a sub-niche tag still resolves to this child's
  //     theme + imagery + audit pitch angle.
  //   - `kuyumcu-luxury` — butik / designer / pırlanta; daha küçük
  //     TAM, daha yüksek bilet. Claims no Google Places type —
  //     match'i name keywords (diamond / pırlanta / atelier) +
  //     priceLevel (3-4) üzerinden alır, böylece "jewelry_store"
  //     leadleri default'ta traditional'a düşer.
  //
  // Added for the Berkay Sırakaya web-agency tenant who targets
  // İstanbul kuyumcuları with the same setup pattern as Emirhan
  // (driving-school). Auto-classifier is intentionally NOT wired up
  // here — WEB_AGENCY workspaces return null from
  // `verticalRootForWorkspace`, so the rep manually picks the child
  // slug during discovery for luxury overrides. v2 enhancement.
  // ============================================================
  {
    slug: "kuyumcu",
    label: "Kuyumcular (tümü)",
    tagline: "Geleneksel, lüks, atölye — İstanbul'un altın ve takı işletmeleri.",
    searchQueries: [
      "kuyumcu",
      "altıncı",
      "sarraf",
      "jewelry store",
      "altın bilezik",
    ],
    discoveryPlaceTypes: ["jewelry_store"],
    pitchAngle:
      "Canlı gram altın paneli, ürün galerisi, WhatsApp ile fiyat sorgu ve atölye vitrini — telefon trafiğini yarıya indirir, mağaza ziyareti ikiye katlar.",
    highValueSignals: [
      "no live gram altın price widget",
      "no product catalog (alyans, bilezik, kolye)",
      "no WhatsApp price-query CTA",
      "no workshop / atölye photography",
      "no certificate / has ayar visibility",
      "no Instagram embed",
      "no online alyans appointment",
      "Instagram-only contact",
      "outdated mobile experience",
    ],
    commonBookingProviders: ["WhatsApp", "Calendly"],
    mockupTemplateId: "kuyumcu",
    typicalCustomerOfferings: [
      "Alyans ve Nişan Yüzüğü",
      "Altın Bilezik & Bileklik",
      "Altın Kolye, Set ve Küpe",
      "Has Ayar Altın Alım-Satım",
      "Hurda Altın Bozdurma",
      "Kuyum Tamiri ve Yenileme",
      "Pırlanta ve Taşlı Ürünler",
      "Gümüş Takı Koleksiyonu",
    ],
    featuredProductModules: [
      "Canlı Gram Altın Widget",
      "WhatsApp Fiyat Sorgu",
      "Ürün Kataloğu",
      "Alyans Randevu",
      "Atölye Vitrini",
      "Google Maps + İletişim",
    ],
  },
  {
    slug: "kuyumcu-traditional",
    parentSlug: "kuyumcu",
    label: "Geleneksel kuyumcu",
    tagline:
      "Mahalle ve Kapalıçarşı tipi kuyumcular: gram altın, alyans, tamir, hurda bozdurma.",
    searchQueries: [
      '"kuyumcu"',
      '"altıncı"',
      '"sarraf"',
      '"kapalıçarşı kuyumcu"',
    ],
    discoveryPlaceTypes: ["jewelry_store"],
    pitchAngle:
      "Canlı gram fiyat banner'ı + WhatsApp ile anında sorgu + hurda altın bozdurma CTA'sı — ana cadde trafiğini siteye taşır, kapı önü beklemeyi yarıya indirir.",
    highValueSignals: [
      "no live gram altın price banner",
      "no hurda altın bozdurma CTA",
      "no WhatsApp price-query button",
      "no MASAK / certificate trust badge",
      "no atölye / usta photography",
      "no Google Maps embed",
      "Instagram-only contact",
    ],
    commonBookingProviders: ["WhatsApp"],
    mockupTemplateId: "kuyumcu-traditional",
    typicalCustomerOfferings: [
      "Gram Altın Alış-Satış",
      "Hurda Altın Bozdurma",
      "Alyans ve Nişan Yüzüğü",
      "Altın Bilezik (Gram / 22 Ayar)",
      "Altın Kolye ve Set",
      "Kuyum Tamiri ve Ölçü Değişimi",
      "Gümüş Takı",
    ],
    classifierHints: {
      googlePlacesTypes: ["jewelry_store"],
      keywordsInName: ["kuyumcu", "altıncı", "sarraf", "gold", "altın"],
      priceLevelRange: [1, 3],
    },
  },
  {
    slug: "kuyumcu-luxury",
    parentSlug: "kuyumcu",
    label: "Lüks / butik kuyumcu",
    tagline:
      "Pırlanta, designer parçalar, butik atölyeler ve markalı tasarım kuyumcular.",
    searchQueries: [
      '"diamond jewelry"',
      '"pırlanta"',
      '"luxury jewelry"',
      '"design jeweler"',
    ],
    pitchAngle:
      "Designer parça galerisi + sertifika gösterimi + alyans randevu sistemi + atölye hikayesi — vitrini brand'e dönüştürür, ortalama bilet %30 yukarı.",
    highValueSignals: [
      "no curated product gallery",
      "no diamond / gem certificate display",
      "no appointment booking for alyans selection",
      "no designer / atölye story page",
      "no high-quality product photography",
      "no premium brand voice",
    ],
    commonBookingProviders: ["Calendly", "WhatsApp"],
    mockupTemplateId: "kuyumcu-luxury",
    typicalCustomerOfferings: [
      "Pırlanta Yüzük Koleksiyonu",
      "Tasarım Alyans ve Nişan Seti",
      "Özel Sipariş ve Designer Parça",
      "Sertifikalı Pırlanta",
      "Yüksek Karat Altın Tasarım",
      "Atölyede Üretim ve Tamir",
      "Antika ve Vintage Onarım",
    ],
    notApplicableModules: [
      "Hurda altın bozdurma",
      "Gram altın live banner",
      "Sarraf-style alış-satış",
    ],
    classifierHints: {
      keywordsInName: [
        "diamond",
        "pırlanta",
        "design",
        "atelier",
        "boutique",
        "haute",
        "fine jewelry",
        "couture",
        "joaillerie",
      ],
      priceLevelRange: [3, 4],
    },
  },
];

export function getNicheBySlug(slug: string): NichePack | undefined {
  return NICHES.find((n) => n.slug === slug);
}

/**
 * Lead-level visual-identity resolver. Mirrors the same
 * subNiche → niche → generic fallback that `getMockupTemplateForLead`
 * uses, but for the niche theme + imagery (palette, hero photo,
 * gallery photos) consumed by the website-mockup renderer.
 *
 * Re-exported here (rather than from `niches/theme.ts`) so callers
 * can do the niche lookup + theme resolve in one import.
 *
 * Resolution order:
 *   1. `subNicheSlug`         — most specific match
 *   2. `nicheSlug`            — parent fallback
 *   3. `primaryType`          — Google Places type → niche pack
 *      (handles leads that haven't been classified yet, so they still
 *      get themed imagery instead of the generic palette)
 *   4. `GENERIC` palette + curated neutral business imagery
 *
 * When `businessName` is supplied, the resolved imagery is rotated
 * through `pickImageryForBusiness` so two leads in the same vertical
 * render with different hero photos (more visual variety) while the
 * same lead's mockup stays stable across regenerations.
 */
import {
  getNicheTheme,
  getNicheImagery,
  pickImageryForBusiness,
  type NicheTheme,
  type NicheImagery,
} from "@/lib/niches/theme";

export type { NicheTheme, NicheImagery } from "@/lib/niches/theme";

export function getVisualIdentityForLead(lead: {
  subNicheSlug: string | null;
  nicheSlug: string | null;
  /**
   * Optional Google Places `primaryType` (e.g. "restaurant", "bar",
   * "dental_clinic"). When neither niche slug is set we map this
   * through `findNichePackForPrimaryType` and use the resulting pack
   * for both palette and imagery — this is the single biggest reason
   * the previous version of this resolver shipped photo-less mockups
   * (un-classified leads silently fell through to GENERIC empty arrays).
   */
  primaryType?: string | null;
  /**
   * Optional business name — used as a stable seed to pick which
   * hero / gallery photo variant to ship for this specific lead.
   * Omit it and the resolver returns the niche imagery in its
   * declared order (back-compat for unit tests that assert on the
   * exact URL strings).
   */
  businessName?: string | null;
}): {
  theme: NicheTheme;
  imagery: NicheImagery;
  resolvedFrom: "subNiche" | "niche" | "primaryType" | "generic";
} {
  let theme: NicheTheme;
  let imagery: NicheImagery;
  let resolvedFrom: "subNiche" | "niche" | "primaryType" | "generic";

  if (lead.subNicheSlug) {
    const pack = getNicheBySlug(lead.subNicheSlug);
    const parent = pack?.parentSlug ?? null;
    theme = getNicheTheme(lead.subNicheSlug, parent);
    imagery = getNicheImagery(lead.subNicheSlug, parent);
    resolvedFrom = "subNiche";
  } else if (lead.nicheSlug) {
    theme = getNicheTheme(lead.nicheSlug, null);
    imagery = getNicheImagery(lead.nicheSlug, null);
    resolvedFrom = "niche";
  } else {
    // primaryType fallback — handles leads that have not yet been
    // through the subvertical-classifier worker. Without this branch
    // every fresh lead in a workspace without per-niche classification
    // shipped a photo-less mockup (root cause of the "ruhsuz / robotumsu"
    // complaint).
    const primaryPack = lead.primaryType
      ? findNichePackForPrimaryType(lead.primaryType)
      : null;
    if (primaryPack) {
      const parent = primaryPack.parentSlug ?? null;
      theme = getNicheTheme(primaryPack.slug, parent);
      imagery = getNicheImagery(primaryPack.slug, parent);
      resolvedFrom = "primaryType";
    } else {
      theme = getNicheTheme(null, null);
      imagery = getNicheImagery(null, null);
      resolvedFrom = "generic";
    }
  }

  // Per-business deterministic photo pick. Skipped when no name is
  // supplied so unit tests calling `getVisualIdentityForLead({ ... })`
  // without a business name keep getting the imagery in its declared
  // order.
  if (lead.businessName) {
    imagery = pickImageryForBusiness(imagery, lead.businessName);
  }

  return { theme, imagery, resolvedFrom };
}

export function getNicheByQuery(query: string): NichePack | undefined {
  // Some niche searchQueries are wrapped in literal double quotes
  // (e.g. `'"food truck"'`) so Google Places treats them as a phrase
  // (Bug #2). Strip those wrapper quotes here so callers pass either
  // the bare phrase or the quoted form interchangeably.
  const stripQuotes = (s: string) =>
    s.toLowerCase().trim().replace(/^"+|"+$/g, "").trim();
  const normalized = stripQuotes(query);
  return NICHES.find((n) =>
    n.searchQueries.some((q) => stripQuotes(q) === normalized)
  );
}

/**
 * Returns every child pack of `parentSlug`. Empty array when the parent
 * has no children (i.e. flat niches like `dental`).
 */
export function getChildrenOf(parentSlug: string): NichePack[] {
  return NICHES.filter((n) => n.parentSlug === parentSlug);
}

/**
 * Resolves a child slug to its parent slug. Returns the input slug
 * unchanged if it has no parent (already a parent or a flat niche), so
 * callers can use this to normalise to "the rollup level."
 */
export function getParentOf(slug: string): string {
  const pack = getNicheBySlug(slug);
  return pack?.parentSlug ?? slug;
}

/**
 * True when the slug is a parent pack with at least one child. Used by
 * the discovery picker to render a two-level select for hybrid niches
 * (parent picker + child picker) instead of a flat dropdown.
 */
export function isParentNiche(slug: string): boolean {
  return getChildrenOf(slug).length > 0;
}

/**
 * Maps a Google Places `primaryType` value (e.g. "restaurant", "bar",
 * "coffee_shop") to the most specific NichePack that claims it via
 * `classifierHints.googlePlacesTypes`. Used by the public directory
 * pages to swap their generic hero / FAQ copy for vertical-specific
 * angle + featured product modules when a known type comes through.
 *
 * Match order: child packs first (most specific), then flat / parent
 * packs. Returns `null` when nothing claims the type — the caller
 * should fall back to its existing generic copy in that case.
 */
export function findNichePackForPrimaryType(
  primaryType: string | null | undefined,
): NichePack | null {
  if (!primaryType) return null;
  const t = primaryType.toLowerCase().trim();
  const children = NICHES.filter((n) => n.parentSlug);
  for (const pack of children) {
    const types = pack.classifierHints?.googlePlacesTypes;
    if (types?.some((x) => x.toLowerCase() === t)) return pack;
  }
  const flat = NICHES.filter((n) => !n.parentSlug);
  for (const pack of flat) {
    const types = pack.classifierHints?.googlePlacesTypes;
    if (types?.some((x) => x.toLowerCase() === t)) return pack;
  }
  return null;
}

/**
 * Phase 2.3: Fine-dining auto-assign rule.
 *
 * Beta finding §5 — Pied à Terre's Google primaryType comes back as
 * "french_restaurant" with no fine_dining marker, so neither the
 * type-only matcher nor keyword rules promoted it past low-confidence.
 * For F&B leads where the rule classifier returned `null` (or our
 * normal scoring falls below 0.4), we apply a single deterministic
 * promotion rule:
 *
 *   rating ≥ 4.5 AND reviewCount ≥ 200 AND priceLevel ≥ 3
 *   → fnb-fine-dining at confidence 0.85
 *
 * This is intentionally conservative: all three thresholds together
 * describe a small, expensive, well-reviewed restaurant — exactly
 * the fine-dining footprint. The 0.85 confidence sits above the
 * trust gate (0.7) so the opener pitches the fine-dining pack
 * without needing manual confirmation.
 *
 * Returns `null` when the lead doesn't meet the bar; callers should
 * keep their existing classification (or none) in that case.
 */
export function autoAssignFineDining(input: {
  parentSlug: string | null;
  rating: number | null | undefined;
  reviewCount: number | null | undefined;
  priceLevel: number | null | undefined;
}): { slug: string; confidence: number; reason: string } | null {
  if (input.parentSlug !== "fnb") return null;
  const rating = input.rating ?? 0;
  const reviewCount = input.reviewCount ?? 0;
  const priceLevel = input.priceLevel ?? 0;
  if (rating >= 4.5 && reviewCount >= 200 && priceLevel >= 3) {
    return {
      slug: "fnb-fine-dining",
      confidence: 0.85,
      reason: `auto-assign fine-dining: rating=${rating}, reviews=${reviewCount}, priceLevel=${priceLevel}`,
    };
  }
  return null;
}

/**
 * Workspace niche → primary lead niche slug mapping. Discovery uses this
 * to default the picker when the user opens the page; the picker then
 * lets reps drill into a child slug if the niche is hybrid. Workspaces
 * whose niche has no canonical lead niche (e.g. WEB_AGENCY) return null
 * — the picker stays on "all niches" in that case.
 */
export function defaultNicheForWorkspaceNiche(
  workspaceNiche: string | null | undefined,
): string | null {
  switch (workspaceNiche) {
    case "RESTAURANT_TECH":
      return "fnb";
    case "DENTAL":
      return "dental";
    default:
      return null;
  }
}

/**
 * Resolves a workspace niche enum value to the slug of the parent pack
 * its leads should be classified against. Identical semantics to
 * `defaultNicheForWorkspaceNiche` today — kept as a separate name
 * because the *classifier* dispatcher uses it as a guard (workspaces
 * with no parent → skip classifier entirely) and a future caller might
 * want a different fallback (e.g. send WEB_AGENCY workspaces through
 * a generic "local-services" parent). Splitting the names lets us
 * change one without touching the other.
 */
export function verticalRootForWorkspace(
  workspaceNiche: string | null | undefined,
): string | null {
  return defaultNicheForWorkspaceNiche(workspaceNiche);
}

/**
 * Lightweight lead shape the rule-based classifier consumes. We do
 * NOT take the full Prisma `Lead` here so the helper stays callable
 * from API routes, workers, and tests with synthetic inputs alike.
 * Only fields the rules read are required.
 */
export interface ClassifierLeadSignals {
  businessName: string | null | undefined;
  /**
   * Formatted address string. Used by the hotel-F&B guard to confirm
   * the F&B outlet is actually inside a hospitality property when
   * the business name doesn't carry the brand (e.g. "Lobby Lounge").
   */
  formattedAddress?: string | null;
  /** Google Places `primaryType` (e.g. "bar", "fast_food_restaurant"). */
  primaryType?: string | null;
  /** Google Places `price_level` (0..4). */
  priceLevel?: number | null;
  /** Discovery query text that surfaced this lead, if known. */
  discoverySourceQuery?: string | null;
  /** Booking provider detected by the audit, if any (e.g. "OpenTable"). */
  bookingProvider?: string | null;
  /** Audit signals — pass `null` when the audit hasn't run yet. */
  audit?: {
    hasOnlineReservation?: boolean | null;
    hasDeliveryIntegration?: boolean | null;
    hasQrMenu?: boolean | null;
  } | null;
}

export interface RuleClassificationResult {
  slug: string;
  confidence: number;
  /** Per-rule contributions for debug + telemetry. */
  reasons: { rule: string; weight: number }[];
}

/**
 * Rule-based pre-classifier. Scores the lead's signals against each
 * candidate child pack's `classifierHints` and returns the best match
 * + confidence. Returns null when no child clears the floor (0.5),
 * which the classifier worker takes as the signal to fall back to a
 * Gemini call.
 *
 * Confidence scale (rough — sums clamped at 1.0):
 *   - exact discovery query match     → +0.25 (was 0.45 — too strong
 *                                              when the fan-out fired
 *                                              two queries per child;
 *                                              query alone now needs
 *                                              a second corroborating
 *                                              signal to clear the
 *                                              0.5 floor — Bug #6)
 *   - googlePlacesTypes match         → +0.35 (raised — Google's own
 *                                              primary type is the
 *                                              most reliable single
 *                                              signal post Bug #2's
 *                                              includedTypes filter)
 *   - keywordsInName match            → +0.30 (raised — the business
 *                                              name itself anchors
 *                                              the classification)
 *   - priceLevelRange match           → +0.15
 *   - audit signal heuristics         → +0.10..+0.20 per signal
 *
 * The new shape implicitly requires confidence ≥ 0.5 from at least
 * two corroborating signals (e.g. type + name = 0.65, query + type =
 * 0.6). A bare query match is no longer enough to classify, so the
 * old "every airport-restaurant query lead got tagged fnb-airport-fnb
 * even when the place is a chain QSR" failure mode disappears.
 *
 * Pure / deterministic — same input always returns the same output.
 * Free of any Prisma access; the worker hydrates the inputs.
 */
export function ruleBasedClassify(
  lead: ClassifierLeadSignals,
  children: NichePack[],
): RuleClassificationResult | null {
  const best = rankAllChildren(lead, children);
  // Floor: don't return a classification we don't actually believe in.
  // The classifier worker reads `null` as "punt to Gemini".
  if (!best || best.confidence < 0.5) return null;
  return best;
}

/**
 * Floorless variant of `ruleBasedClassify`. Returns the highest-scoring
 * child slug regardless of how weak the score is. Used by the
 * SUBVERTICAL_CLASSIFIER worker as a last-resort fallback when the
 * Gemini API is unavailable: rather than parking the lead with a null
 * sub-niche (which loses ALL vertical context downstream), we persist
 * the rule pass's best guess with a low confidence so the dossier and
 * UI can still surface the most likely sub-vertical with a "low
 * confidence" caveat.
 *
 * The 0.7 confidence gate in scoring/opener still rejects this output
 * (it falls back to the parent niche framing), so a low-confidence
 * misclass cannot ship a wrong-vertical pitch — it only enriches the
 * memory layer + dossier metadata.
 */
export function rankAllChildren(
  lead: ClassifierLeadSignals,
  children: NichePack[],
): RuleClassificationResult | null {
  const ranked = rankAllChildrenAll(lead, children);
  return ranked[0] ?? null;
}

/**
 * Beta finding §5 — full ranked list of every child that scored > 0.
 * The classifier worker uses this to surface top-3 alternatives so a
 * hybrid lead (e.g. hotel-bar) carries multiple viable sub-niche tags
 * downstream rather than collapsing to a single primary. Sorted
 * descending by confidence; ties retain the order in `children`.
 *
 * Returns an empty array when no child scored at all (all rules
 * missed). The single-best caller (`rankAllChildren`) takes element
 * 0; `ruleBasedClassify` further applies a 0.5 floor to that single
 * pick to decide whether to escalate to Gemini.
 *
 * Pure / deterministic: same input always returns the same ordering.
 */
export function rankAllChildrenAll(
  lead: ClassifierLeadSignals,
  children: NichePack[],
): RuleClassificationResult[] {
  if (children.length === 0) return [];

  const nameLower = (lead.businessName ?? "").toLowerCase();
  const queryLower = (lead.discoverySourceQuery ?? "").toLowerCase();
  const addressLower = (lead.formattedAddress ?? "").toLowerCase();

  const results: RuleClassificationResult[] = [];

  for (const child of children) {
    const hints = child.classifierHints;
    if (!hints) continue;

    // Bug #8 guard: fnb-hotel-fnb is "F&B outlet INSIDE a hotel"
    // (lobby bar, hotel restaurant, rooftop). Pre-fix it was matching
    // every Best Western and BoutiqueHotel.com listing because the
    // `lodging` Places type was in its hints. Now we require BOTH:
    //   1. The primaryType is an F&B outlet type (restaurant / bar /
    //      cafe / similar) — i.e. the row is genuinely an F&B venue,
    //      not a hotel-as-entity.
    //   2. There's a hospitality marker in the name or address (so we
    //      know it's the hotel's outlet, not a standalone restaurant).
    // If either is missing we skip this child entirely (continue
    // before scoring), so it can't even partial-match on a single
    // signal and clear the floor by accident.
    if (child.slug === "fnb-hotel-fnb") {
      const FNB_OUTLET_TYPES = new Set([
        "restaurant",
        "bar",
        "cafe",
        "fast_food_restaurant",
        "fine_dining_restaurant",
        "meal_takeaway",
      ]);
      const HOSPITALITY_MARKERS = ["hotel", "resort", "otel", "inn"];
      const ptype = (lead.primaryType ?? "").toLowerCase();
      const isFnbOutlet = FNB_OUTLET_TYPES.has(ptype);
      const hasHospitalityMarker = HOSPITALITY_MARKERS.some(
        (m) => nameLower.includes(m) || addressLower.includes(m),
      );
      if (!isFnbOutlet || !hasHospitalityMarker) continue;
    }

    const reasons: { rule: string; weight: number }[] = [];
    let score = 0;

    // 1) Discovery query match — if the rep searched specifically for
    //    a query that maps to this child, that's a prior. We strip
    //    surrounding double quotes from both sides because Bug #2's
    //    fix wraps multi-word queries in literal quotes (e.g.
    //    `'"food truck"'`) for Google Places phrase matching.
    if (queryLower) {
      const stripQuotes = (s: string) => s.replace(/^"+|"+$/g, "").trim();
      const queryStripped = stripQuotes(queryLower);
      const childQueryHit = child.searchQueries.some((q) => {
        const qLower = stripQuotes(q.toLowerCase());
        return queryStripped === qLower || queryStripped.includes(qLower);
      });
      if (childQueryHit) {
        score += 0.25;
        reasons.push({ rule: "discovery_query", weight: 0.25 });
      }
    }

    // 2) Google Places primaryType match — the most reliable single
    //    signal post Bug #2 (Discovery's includedType filter means a
    //    "bar" leg almost certainly returns Google-tagged bars).
    if (hints.googlePlacesTypes && lead.primaryType) {
      const ptype = lead.primaryType.toLowerCase();
      if (hints.googlePlacesTypes.some((t) => t.toLowerCase() === ptype)) {
        score += 0.35;
        reasons.push({ rule: "google_places_type", weight: 0.35 });
      }
    }

    // 3) Business name keyword match. Multiple matches don't compound;
    //    one hit is enough — we don't want "Bar Cafe Lounge" to score
    //    +0.75 on a single child.
    if (hints.keywordsInName && nameLower) {
      const matched = hints.keywordsInName.some((kw) =>
        nameLower.includes(kw.toLowerCase()),
      );
      if (matched) {
        score += 0.3;
        reasons.push({ rule: "name_keyword", weight: 0.3 });
      }
    }

    // 4) Price level in range.
    if (
      hints.priceLevelRange &&
      typeof lead.priceLevel === "number" &&
      lead.priceLevel >= hints.priceLevelRange[0] &&
      lead.priceLevel <= hints.priceLevelRange[1]
    ) {
      score += 0.15;
      reasons.push({ rule: "price_level", weight: 0.15 });
    }

    // 5) Audit-signal heuristics — sub-niche-specific rules. We hard-code
    //    these instead of pushing them into NichePack.classifierHints so
    //    they stay readable; cross-cutting feature flags belong in code,
    //    not data. Only fire when the audit ran (`lead.audit != null`).
    const a = lead.audit;
    if (a) {
      switch (child.slug) {
        case "fnb-ghost-kitchen":
          // Delivery integration but NO reservation and NO QR menu →
          // strong ghost-kitchen signal.
          if (a.hasDeliveryIntegration && !a.hasOnlineReservation && !a.hasQrMenu) {
            score += 0.2;
            reasons.push({ rule: "audit_delivery_only", weight: 0.2 });
          }
          break;
        case "fnb-fine-dining":
          // Premium booking provider on the audit.
          if (
            a.hasOnlineReservation &&
            lead.bookingProvider &&
            ["sevenrooms", "tock", "opentable", "resy"].includes(
              lead.bookingProvider.toLowerCase(),
            )
          ) {
            score += 0.15;
            reasons.push({ rule: "audit_premium_booking", weight: 0.15 });
          }
          break;
        case "fnb-casual-dining":
          // Reservation widget without premium provider hints points
          // to casual rather than fine dining.
          if (a.hasOnlineReservation && !lead.bookingProvider) {
            score += 0.1;
            reasons.push({ rule: "audit_basic_reservation", weight: 0.1 });
          }
          break;
        case "fnb-cafe-bakery":
        case "fnb-qsr":
          // Order-ahead / QR menu without table-service signals. We
          // can't tell apart cafe vs QSR from audit alone, so this
          // bucket lifts both — name + priceLevel will break the tie.
          if (a.hasQrMenu && !a.hasOnlineReservation) {
            score += 0.1;
            reasons.push({ rule: "audit_quick_service", weight: 0.1 });
          }
          break;
      }
    }

    if (score === 0) continue;

    results.push({
      slug: child.slug,
      confidence: Math.min(score, 1),
      reasons,
    });
  }

  // Sort by confidence descending. Stable for equal scores (insertion
  // order in `children` decides ties), which keeps the "first
  // declared" pack winning on perfect ties — matters for tests that
  // assert specific tie-breaking behaviour.
  results.sort((a, b) => b.confidence - a.confidence);
  return results;
}
