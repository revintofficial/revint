/**
 * Niche theme + imagery registry.
 *
 * Each niche pack resolves to a deterministic visual identity here:
 *   - `theme`   - the dark/light palette used by the website-mockup renderer
 *                 (hero gradient, accent buttons, panel borders).
 *   - `imagery` - curated stock photo URLs (Unsplash CDN) used as the hero
 *                 background and gallery tiles. URLs are direct CDN links
 *                 with `?w=1600&q=80&auto=format&fit=crop` so they ship
 *                 ready-to-render at HTML generation time without an
 *                 Unsplash API key.
 *
 * Why a separate file from `niches/index.ts`?
 *   `index.ts` is already ~1200 lines of classification logic. Visual
 *   identity is a different concern, edited far more often, and has zero
 *   dependency on the rule classifier. Keeping the two apart means a
 *   designer can tweak palettes and photo IDs without rebasing on top of
 *   classifier work-in-progress.
 *
 * Hybrid niche fallback:
 *   Children of `fnb` inherit the `fnb` parent's theme/imagery when not
 *   explicitly overridden, mirroring the same fallback chain that the
 *   mockup template registry uses (subNiche → parent → generic).
 *
 * Photo URL stability:
 *   Unsplash CDN URLs of the form `https://images.unsplash.com/photo-{id}`
 *   have been stable for years. Every photo in this file has been HEAD-
 *   verified live on the date it was added; if a URL ever 404s the
 *   renderer's gradient fallback covers for it gracefully (the section
 *   still ships the niche palette without a broken-image icon).
 *
 * Multiple hero options:
 *   Each niche carries 2-3 hero photo candidates. The renderer picks one
 *   deterministically based on a hash of the lead's businessName, so two
 *   leads inside the same niche don't render with literally identical
 *   stock photos but the choice is still stable across regenerations of
 *   the same lead's mockup.
 */

export interface NicheTheme {
  /** Dominant document mode. Most service-business mockups read better in dark. */
  mode: "dark" | "light";
  /** Primary CTA color (hex). The Call now / Book now buttons use this. */
  primaryHex: string;
  /** Accent color (hex). Used for the hero lede pill, icon backgrounds, links. */
  accentHex: string;
  /**
   * Optional second accent for the hero gradient overlay. When set the hero
   * background mixes `primaryHex` and `secondaryHex` in two radial gradients
   * for a richer feel (used heavily by F&B sub-verticals). When absent the
   * renderer mixes `primaryHex` + `accentHex` instead.
   */
  secondaryHex?: string;
}

export interface NicheImagery {
  /**
   * Hero background photo URLs. The renderer uses one entry as the hero
   * background image (with a gradient overlay for legibility). Multiple
   * entries are picked deterministically per businessName via
   * `pickImageryForBusiness` so two leads in the same niche read as
   * distinct without the choice flapping across regenerations.
   * Empty array → renderer falls back to the pure-gradient hero.
   */
  hero: string[];
  /**
   * Gallery / accent photo URLs. The renderer uses these in a 2-3 image
   * "see the space / see the work" gallery section between services and
   * about, and may pick one to embed as a "lifestyle" feature strip.
   * Empty array → gallery section + feature strip are both omitted.
   */
  gallery: string[];
}

/**
 * Build a stable Unsplash CDN URL for a given photo ID. Centralised so
 * we can swap the size/quality across all niches in one place if we ever
 * find the default is too heavy for slow networks.
 *
 * `auto=format` lets Unsplash serve AVIF/WebP to capable browsers and
 * `fit=crop` keeps the photo from letterboxing inside the hero panel.
 */
function unsplash(photoId: string, opts: { w?: number } = {}): string {
  const w = opts.w ?? 1600;
  return `https://images.unsplash.com/photo-${photoId}?w=${w}&q=80&auto=format&fit=crop`;
}

/**
 * Lookup table of every niche slug → its theme. A slug missing from this
 * map gets the GENERIC_THEME below; child niches missing here inherit
 * their parent's entry via `getNicheTheme()`.
 */
const NICHE_THEMES: Record<string, NicheTheme> = {
  // ============================================================
  // Flat (single-level) niches.
  // ============================================================
  "phone-repair": {
    // Tech-forward: deep navy + electric cyan. Reads "modern repair lab",
    // not "back-of-shop with a clipboard".
    mode: "dark",
    primaryHex: "#3b82f6",
    accentHex: "#22d3ee",
    secondaryHex: "#1e3a8a",
  },
  hvac: {
    // Heating/cooling duality: cool teal + warm amber accent for the
    // emergency call-out CTA the niche pitches around.
    mode: "dark",
    primaryHex: "#0ea5e9",
    accentHex: "#f59e0b",
    secondaryHex: "#0c4a6e",
  },
  plumbing: {
    // Water + steel. Saturated steel-blue + a brighter aqua so the page
    // reads "trustworthy infrastructure" not "stock-photo plumber".
    mode: "dark",
    primaryHex: "#2563eb",
    accentHex: "#38bdf8",
    secondaryHex: "#1e293b",
  },
  dental: {
    // Medical clean: light mode, mint accent + soft sky-blue. Light mode
    // is intentional - dental sites read "clean / hygienic" in light.
    mode: "light",
    primaryHex: "#0891b2",
    accentHex: "#34d399",
    secondaryHex: "#bae6fd",
  },
  locksmith: {
    // Brass key + black leather. Dark mode with warm brass accent
    // matches the trust-of-the-physical-key visual cue.
    mode: "dark",
    primaryHex: "#d97706",
    accentHex: "#fbbf24",
    secondaryHex: "#1c1917",
  },
  "auto-detail": {
    // Showroom black + chrome. Premium automotive look.
    mode: "dark",
    primaryHex: "#dc2626",
    accentHex: "#e5e7eb",
    secondaryHex: "#0a0a0a",
  },
  opticians: {
    // Sophisticated charcoal + warm gold (eyewear / frames).
    mode: "light",
    primaryHex: "#1f2937",
    accentHex: "#ca8a04",
    secondaryHex: "#f3f4f6",
  },
  "beauty-salon": {
    // Rose gold + dusty pink. Reads salon, not nail-bar; the renderer's
    // light mode lets the warm tones breathe.
    mode: "light",
    primaryHex: "#be185d",
    accentHex: "#f9a8d4",
    secondaryHex: "#fce7f3",
  },
  gym: {
    // High-energy: saturated red + black + chartreuse accent. The CTA
    // feels like a class-pass button, not a doctor's office.
    mode: "dark",
    primaryHex: "#dc2626",
    accentHex: "#a3e635",
    secondaryHex: "#0a0a0a",
  },
  "driving-school": {
    // Beyaz arka plan + trafik mavisi: TR sürücü kursu sektörü tarayan
    // bir veliye "kurumsal / güvenilir / okul" hissi vermesi gerek.
    // Siyah arka plan klüp/spor gibi okuyordu; light moda geçildi,
    // aynı navy/cyan ikilisi accent olarak korundu (yol levhası
    // çağrışımı için). MEB onaylı kurumlar nedeniyle WHITE > DARK.
    mode: "light",
    primaryHex: "#1d4ed8",
    accentHex: "#0ea5e9",
    secondaryHex: "#dbeafe",
  },

  // ============================================================
  // Hybrid F&B parent + children.
  // ============================================================
  fnb: {
    // Generic warm-amber default. Children below override.
    mode: "dark",
    primaryHex: "#ea580c",
    accentHex: "#fbbf24",
    secondaryHex: "#431407",
  },
  "fnb-fine-dining": {
    // Burgundy + champagne gold + ivory. The "white-glove" pack the
    // niche pitch is built around; do NOT use neon or flat reds here.
    mode: "dark",
    primaryHex: "#7f1d1d",
    accentHex: "#d4af37",
    secondaryHex: "#1c1917",
  },
  "fnb-bar-club": {
    // Nightlife neon. Magenta + electric purple over deep navy.
    mode: "dark",
    primaryHex: "#d946ef",
    accentHex: "#a855f7",
    secondaryHex: "#0c0a1a",
  },
  "fnb-cafe-bakery": {
    // Cozy morning: warm caramel + cream. Light mode reads "specialty
    // coffee + croissant" rather than "QSR lunchtime crush".
    mode: "light",
    primaryHex: "#92400e",
    accentHex: "#fbbf24",
    secondaryHex: "#fef3c7",
  },
  "fnb-ghost-kitchen": {
    // Tech-forward: neon green + dark slate (cloud-kitchen / delivery
    // app aesthetic). The pitch is "your own branded site, no
    // commission" - the page should feel software, not restaurant.
    mode: "dark",
    primaryHex: "#10b981",
    accentHex: "#34d399",
    secondaryHex: "#0f172a",
  },
  "fnb-food-truck": {
    // Street-food: bold sun-yellow + tomato red on matte black.
    // Maps to the "Instagram-loud" feel of the niche.
    mode: "dark",
    primaryHex: "#facc15",
    accentHex: "#ef4444",
    secondaryHex: "#0a0a0a",
  },
  "fnb-hotel-fnb": {
    // Hospitality: muted bronze + ivory + dark navy. Quietly luxurious.
    mode: "dark",
    primaryHex: "#a16207",
    accentHex: "#fde68a",
    secondaryHex: "#172554",
  },
  "fnb-casual-dining": {
    // Bistro: terracotta + cream + olive. Warm, family-friendly, reads
    // bistro / gastropub rather than fine-dining or QSR.
    mode: "light",
    primaryHex: "#c2410c",
    accentHex: "#84cc16",
    secondaryHex: "#fef3c7",
  },
  "fnb-qsr": {
    // Classic fast-food: bold red + bright yellow. Yes it's tropey;
    // yes it converts. The pitch is throughput + combo upsell.
    mode: "light",
    primaryHex: "#dc2626",
    accentHex: "#facc15",
    secondaryHex: "#fff7ed",
  },
  "fnb-airport-fnb": {
    // Transit: clean blue + slate gray + chrome. Reads "boarding
    // gate signage" without leaning into airline brand colors.
    mode: "dark",
    primaryHex: "#1d4ed8",
    accentHex: "#60a5fa",
    secondaryHex: "#1e293b",
  },
  "fnb-multi-location": {
    // Brand-neutral corporate: slate + warm-amber accent. Used as the
    // pitch wrapper for restaurant groups; the chain's own colors will
    // override at render time when WorkspaceBranding is present.
    mode: "dark",
    primaryHex: "#475569",
    accentHex: "#f59e0b",
    secondaryHex: "#0f172a",
  },

  // ============================================================
  // Hybrid Kuyumcu (jewelers) parent + children.
  // ============================================================
  kuyumcu: {
    // Parent fallback — light mode + warm gold. Used when a lead
    // resolves to the parent (not yet sub-niched) or when the child
    // is missing imagery/theme entries.
    mode: "light",
    primaryHex: "#a16207",
    accentHex: "#d4af37",
    secondaryHex: "#fef9c3",
  },
  "kuyumcu-traditional": {
    // Geleneksel mahalle / Kapalıçarşı: warm amber-gold + sun gold +
    // cream. Light mode reads "vitrin / sıcak / güvenilir esnaf"
    // rather than "lüks butik". The deeper amber primary pulls the
    // CTA toward Türk altıncı aesthetics (think gram fiyat tabelası).
    mode: "light",
    primaryHex: "#b45309",
    accentHex: "#fbbf24",
    secondaryHex: "#fef3c7",
  },
  "kuyumcu-luxury": {
    // Lüks butik / pırlanta: champagne gold on deep onyx. Dark mode
    // for the Tiffany / Cartier / Bulgari editorial feel — premium
    // brand voice, sertifika + designer pieces ön planda.
    mode: "dark",
    primaryHex: "#d4af37",
    accentHex: "#fbbf24",
    secondaryHex: "#1c1917",
  },
};

/**
 * Niche → photo URL map. Slugs missing here resolve to the parent (for
 * children) or to GENERIC_IMAGERY (for flat / parent niches).
 *
 * Photos are picked from broadly-shared, long-stable Unsplash uploads
 * AND every URL in this file has been HEAD-verified live. If a URL ever
 * 404s the renderer's gradient fallback covers for it gracefully — the
 * page still ships the niche palette without a broken image icon.
 *
 * Each `hero` array is intentionally 2-3 entries so the renderer can
 * pick one deterministically by `pickImageryForBusiness(businessName, ...)`,
 * giving two leads in the same vertical visually distinct heroes without
 * the choice flapping across regenerations of the same lead.
 */
const NICHE_IMAGERY: Record<string, NicheImagery> = {
  "phone-repair": {
    hero: [
      unsplash("1605236453806-6ff36851218e"),
      unsplash("1592434134753-a70baf7979d5"),
      unsplash("1601784551446-20c9e07cdbdb"),
    ],
    gallery: [
      unsplash("1556656793-08538906a9f8", { w: 800 }),
      unsplash("1592434134753-a70baf7979d5", { w: 800 }),
    ],
  },
  hvac: {
    hero: [
      unsplash("1581094794329-c8112a89af12"),
      unsplash("1621905251189-08b45d6a269e"),
      unsplash("1633409361618-c73427e4e206"),
    ],
    gallery: [
      unsplash("1581094794329-c8112a89af12", { w: 800 }),
      unsplash("1621905251189-08b45d6a269e", { w: 800 }),
    ],
  },
  plumbing: {
    hero: [
      unsplash("1607472586893-edb57bdc0e39"),
      unsplash("1581244277943-fe4a9c777189"),
      unsplash("1633409361618-c73427e4e206"),
    ],
    gallery: [
      unsplash("1607472586893-edb57bdc0e39", { w: 800 }),
      unsplash("1581244277943-fe4a9c777189", { w: 800 }),
    ],
  },
  dental: {
    hero: [
      unsplash("1606811971618-4486d14f3f99"),
      unsplash("1588776814546-1ffcf47267a5"),
      unsplash("1609840114035-3c981b782dfe"),
    ],
    gallery: [
      unsplash("1588776814546-1ffcf47267a5", { w: 800 }),
      unsplash("1609840114035-3c981b782dfe", { w: 800 }),
    ],
  },
  locksmith: {
    hero: [
      unsplash("1582139329536-e7284fece509"),
      unsplash("1556909114-f6e7ad7d3136"),
      unsplash("1558002038-1055907df827"),
    ],
    gallery: [
      unsplash("1558002038-1055907df827", { w: 800 }),
      unsplash("1556909114-f6e7ad7d3136", { w: 800 }),
    ],
  },
  "auto-detail": {
    hero: [
      unsplash("1503376780353-7e6692767b70"),
      unsplash("1525609004556-c46c7d6cf023"),
      unsplash("1605559424843-9e4c228bf1c2"),
    ],
    gallery: [
      unsplash("1605559424843-9e4c228bf1c2", { w: 800 }),
      unsplash("1492144534655-ae79c964c9d7", { w: 800 }),
    ],
  },
  opticians: {
    hero: [
      unsplash("1574258495973-f010dfbb5371"),
      unsplash("1591076482161-42ce6da69f67"),
      unsplash("1577803645773-f96470509666"),
    ],
    gallery: [
      unsplash("1577803645773-f96470509666", { w: 800 }),
      unsplash("1591076482161-42ce6da69f67", { w: 800 }),
    ],
  },
  "beauty-salon": {
    hero: [
      unsplash("1560066984-138dadb4c035"),
      unsplash("1487412947147-5cebf100ffc2"),
      unsplash("1522337360788-8b13dee7a37e"),
    ],
    gallery: [
      unsplash("1522337360788-8b13dee7a37e", { w: 800 }),
      unsplash("1562322140-8baeececf3df", { w: 800 }),
    ],
  },
  gym: {
    hero: [
      unsplash("1534438327276-14e5300c3a48"),
      unsplash("1605296867424-35fc25c9212a"),
      unsplash("1571019613454-1cb2f99b2d8b"),
    ],
    gallery: [
      unsplash("1571019613454-1cb2f99b2d8b", { w: 800 }),
      unsplash("1517836357463-d25dfeac3438", { w: 800 }),
    ],
  },
  "driving-school": {
    // Direksiyon başında öğrenci, çift pedal aracı, sınıf, eğitmen.
    // All HEAD-verified Unsplash photo ids — the renderer's
    // `pickSafePhotoUrl` rejects anything outside the allowlist so a
    // future 404 silently falls back to the gradient hero.
    hero: [
      unsplash("1449965408869-eaa3f722e40d"), // driver behind wheel
      unsplash("1502877338535-766e1452684a"), // student + instructor
      unsplash("1471174466529-de76a4f5fa7d"), // car interior, hands on wheel
    ],
    gallery: [
      unsplash("1486006920555-c77dcf18193c", { w: 800 }), // road / open lane
      unsplash("1532751203793-812308a10d8e", { w: 800 }), // driving lesson
    ],
  },

  // ----- F&B -----
  fnb: {
    hero: [
      unsplash("1414235077428-338989a2e8c0"),
      unsplash("1517248135467-4c7edcad34c4"),
      unsplash("1514933651103-005eec06c04b"),
    ],
    gallery: [
      unsplash("1517248135467-4c7edcad34c4", { w: 800 }),
      unsplash("1559339352-11d035aa65de", { w: 800 }),
      unsplash("1546833999-b9f581a1996d", { w: 800 }),
    ],
  },
  "fnb-fine-dining": {
    hero: [
      unsplash("1559339352-11d035aa65de"),
      unsplash("1546833999-b9f581a1996d"),
      unsplash("1414235077428-338989a2e8c0"),
    ],
    gallery: [
      unsplash("1414235077428-338989a2e8c0", { w: 800 }),
      unsplash("1546833999-b9f581a1996d", { w: 800 }),
      unsplash("1551782450-a2132b4ba21d", { w: 800 }),
    ],
  },
  "fnb-bar-club": {
    hero: [
      unsplash("1543007630-9710e4a00a20"),
      unsplash("1514228742587-6b1558fcca3d"),
      unsplash("1572116469696-31de0f17cc34"),
    ],
    gallery: [
      unsplash("1551024709-8f23befc6f87", { w: 800 }),
      unsplash("1572116469696-31de0f17cc34", { w: 800 }),
    ],
  },
  "fnb-cafe-bakery": {
    hero: [
      unsplash("1554118811-1e0d58224f24"),
      unsplash("1509042239860-f550ce710b93"),
      unsplash("1499636136210-6f4ee915583e"),
    ],
    gallery: [
      unsplash("1509042239860-f550ce710b93", { w: 800 }),
      unsplash("1499636136210-6f4ee915583e", { w: 800 }),
    ],
  },
  "fnb-ghost-kitchen": {
    hero: [
      unsplash("1556909114-f6e7ad7d3136"),
      unsplash("1565299624946-b28f40a0ae38"),
      unsplash("1583394293214-28ded15ee548"),
    ],
    gallery: [
      unsplash("1565299624946-b28f40a0ae38", { w: 800 }),
      unsplash("1583394293214-28ded15ee548", { w: 800 }),
    ],
  },
  "fnb-food-truck": {
    hero: [
      unsplash("1565299507177-b0ac66763828"),
      unsplash("1565299585323-38d6b0865b47"),
      unsplash("1551024601-bec78aea704b"),
    ],
    gallery: [
      unsplash("1565299585323-38d6b0865b47", { w: 800 }),
      unsplash("1551024601-bec78aea704b", { w: 800 }),
    ],
  },
  "fnb-hotel-fnb": {
    hero: [
      unsplash("1551918120-9739cb430c6d"),
      unsplash("1564013799919-ab600027ffc6"),
      unsplash("1542314831-068cd1dbfeeb"),
    ],
    gallery: [
      unsplash("1542314831-068cd1dbfeeb", { w: 800 }),
      unsplash("1564013799919-ab600027ffc6", { w: 800 }),
    ],
  },
  "fnb-casual-dining": {
    hero: [
      unsplash("1555396273-367ea4eb4db5"),
      unsplash("1567620905732-2d1ec7ab7445"),
      unsplash("1517248135467-4c7edcad34c4"),
    ],
    gallery: [
      unsplash("1517248135467-4c7edcad34c4", { w: 800 }),
      unsplash("1559339352-11d035aa65de", { w: 800 }),
    ],
  },
  "fnb-qsr": {
    hero: [
      unsplash("1568901346375-23c9450c58cd"),
      unsplash("1513104890138-7c749659a591"),
      unsplash("1571091718767-18b5b1457add"),
    ],
    gallery: [
      unsplash("1513104890138-7c749659a591", { w: 800 }),
      unsplash("1571091718767-18b5b1457add", { w: 800 }),
    ],
  },
  "fnb-airport-fnb": {
    hero: [
      unsplash("1556388158-158ea5ccacbd"),
      unsplash("1542314831-068cd1dbfeeb"),
      unsplash("1559339352-11d035aa65de"),
    ],
    gallery: [
      unsplash("1542314831-068cd1dbfeeb", { w: 800 }),
      unsplash("1559339352-11d035aa65de", { w: 800 }),
    ],
  },
  "fnb-multi-location": {
    hero: [
      unsplash("1414235077428-338989a2e8c0"),
      unsplash("1517248135467-4c7edcad34c4"),
      unsplash("1555396273-367ea4eb4db5"),
    ],
    gallery: [
      unsplash("1517248135467-4c7edcad34c4", { w: 800 }),
      unsplash("1555396273-367ea4eb4db5", { w: 800 }),
    ],
  },

  // ----- Kuyumcu (jewelers) -----
  // All Unsplash ids HEAD-verified live (HTTP 200 with the
  // `?w=1600&q=80&auto=format&fit=crop` query). When a future 404
  // happens `pickSafePhotoUrl` silently falls back to the gradient
  // hero — page still ships the niche palette intact.
  kuyumcu: {
    // Parent fallback — neutral jewelry imagery for un-classified
    // jewelry_store leads (children inherit this when their own
    // arrays are absent / partial).
    hero: [
      unsplash("1685489807405-fdffb06aef2c"), // jewelry on a table
      unsplash("1626136978522-b67ac41126e9"), // display case filled with jewelry
      unsplash("1611955167811-4711904bb9f8"), // gold diamond studded ring on white
    ],
    gallery: [
      unsplash("1576723417715-6b408c988c23", { w: 800 }), // necklaces + pendants + boxes
      unsplash("1611107683227-e9060eccd846", { w: 800 }), // gold chain on white surface
      unsplash("1660860547079-fd4845880af9", { w: 800 }), // group of jewelry on table
    ],
  },
  "kuyumcu-traditional": {
    // Mahalle / Kapalıçarşı kuyumcusu — warm, in-store, "vitrin"
    // hissi. Wooden shelves, full display cases, silver trays of
    // gold jewelry. Türk altıncı aesthetic.
    hero: [
      unsplash("1604306354577-68136efdf03b"), // brown wooden shelf, assorted items
      unsplash("1626136978522-b67ac41126e9"), // display case filled with jewelry
      unsplash("1646624867902-b970108e9137"), // store with items on display
    ],
    gallery: [
      unsplash("1650455221359-3aebf920bcc5", { w: 800 }), // silver tray with lots of gold jewelry
      unsplash("1667286266946-4bbb7969b32b", { w: 800 }), // antique furniture display room
      unsplash("1576723417715-6b408c988c23", { w: 800 }), // assorted-color necklaces with boxes
    ],
  },
  "kuyumcu-luxury": {
    // Lüks / butik — minimal, editorial, white-textile + chain-on-
    // marble. Tiffany / Cartier / Bulgari-leaning compositions.
    hero: [
      unsplash("1611955167811-4711904bb9f8"), // gold diamond studded ring on white textile
      unsplash("1631982690223-8aa4be0a2497"), // three gold rings in a white box
      unsplash("1599643477877-530eb83abc8e"), // silver + blue gemstone pendant necklace
    ],
    gallery: [
      unsplash("1602173574767-37ac01994b2a", { w: 800 }), // gold chain bracelet on a magazine (editorial)
      unsplash("1611107683227-e9060eccd846", { w: 800 }), // gold chain on white surface (minimal premium)
      unsplash("1629212093109-354efe3fc541", { w: 800 }), // gold and silver pendant necklace lot
    ],
  },
};

/**
 * Last-resort fallback when neither the niche nor its parent has a theme
 * registered. Keep in sync with the renderer's hard-coded defaults so
 * the rendered page looks identical whether the lead has a niche or not.
 */
export const GENERIC_THEME: NicheTheme = {
  mode: "dark",
  primaryHex: "#5e6ad2",
  accentHex: "#a5b4fc",
  secondaryHex: "#1e1b4b",
};

/**
 * Generic-business imagery. Used as the LAST imagery fallback when a
 * lead has no niche slug AND no `primaryType` we can map to one. Earlier
 * versions of this file shipped empty arrays here, which silently turned
 * "soulless / photo-less mockup" into a customer complaint. Better to
 * ship a neutral storefront / workspace photo than nothing at all — the
 * niche palette still owns the page, the photo just gives the hero
 * something to anchor against.
 */
export const GENERIC_IMAGERY: NicheImagery = {
  hero: [
    unsplash("1556745757-8d76bdb6984b"),
    unsplash("1521737711867-e3b97375f902"),
    unsplash("1497366754035-f200968a6e72"),
  ],
  gallery: [
    unsplash("1556745757-8d76bdb6984b", { w: 800 }),
    unsplash("1497215842964-222b430dc094", { w: 800 }),
    unsplash("1497366216548-37526070297c", { w: 800 }),
  ],
};

/**
 * Resolve theme for a slug. Falls back to parent slug for hybrid
 * children, then to GENERIC_THEME. Pure / deterministic - no DB access.
 *
 * `parentSlug` is passed in (rather than re-resolved here) so callers can
 * keep `niches/index.ts` and `niches/theme.ts` in two separate files
 * without `theme.ts` importing the full NICHES table.
 */
export function getNicheTheme(
  slug: string | null | undefined,
  parentSlug?: string | null,
): NicheTheme {
  if (slug && NICHE_THEMES[slug]) return NICHE_THEMES[slug];
  if (parentSlug && NICHE_THEMES[parentSlug]) return NICHE_THEMES[parentSlug];
  return GENERIC_THEME;
}

/**
 * Resolve imagery for a slug. Same fallback semantics as `getNicheTheme`.
 * Returns GENERIC_IMAGERY (curated neutral business photos) when the
 * slug + parent both miss, which the renderer treats as "use a
 * neutral hero photo + generic gallery". Earlier versions returned
 * empty arrays here; that produced photo-less mockups for any lead
 * we had not classified yet.
 */
export function getNicheImagery(
  slug: string | null | undefined,
  parentSlug?: string | null,
): NicheImagery {
  if (slug && NICHE_IMAGERY[slug]) return NICHE_IMAGERY[slug];
  if (parentSlug && NICHE_IMAGERY[parentSlug]) return NICHE_IMAGERY[parentSlug];
  return GENERIC_IMAGERY;
}

/**
 * Deterministic 32-bit FNV-1a hash of a string. Used by
 * `pickImageryForBusiness` to pick which hero variant to ship for a
 * given lead. Same input → same hash → same photo across regenerations,
 * which keeps the mockup visually stable when we regenerate copy.
 *
 * Not cryptographic — only used as a stable selection seed.
 */
function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

/**
 * Picks a stable hero photo + gallery ordering for one lead inside a
 * niche. Two leads in the same vertical render with different photos
 * (more visual variety in the mockup gallery / agency dashboard), but
 * regenerating the SAME lead produces the same photo (no flapping when
 * the user clicks "Regenerate").
 *
 * Returns a fresh `NicheImagery` object — never mutates the source map.
 */
export function pickImageryForBusiness(
  imagery: NicheImagery,
  businessName: string,
): NicheImagery {
  const heroes = imagery.hero;
  const gallery = imagery.gallery;
  if (heroes.length === 0 && gallery.length === 0) return imagery;

  const seed = fnv1a((businessName || "").toLowerCase().trim() || "leadac");

  // Hero: pick a single deterministic candidate but expose it as the
  // first element of an array so the renderer (which always reads
  // `hero[0]`) gets the picked one. Keep the rest as runners-up in
  // case the renderer ever wants A/B variants.
  const heroIdx = heroes.length ? seed % heroes.length : 0;
  const reorderedHero = heroes.length
    ? [heroes[heroIdx], ...heroes.filter((_, i) => i !== heroIdx)]
    : [];

  // Gallery: rotate the array starting at a different offset so two
  // leads inside one niche don't show identical gallery tiles in the
  // same order. We keep all entries — the renderer caps to 3 anyway.
  const galleryStart = gallery.length ? (seed * 31) % gallery.length : 0;
  const reorderedGallery = gallery.length
    ? [...gallery.slice(galleryStart), ...gallery.slice(0, galleryStart)]
    : [];

  return { hero: reorderedHero, gallery: reorderedGallery };
}
