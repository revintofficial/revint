/**
 * Website Mockup Generator - Gemini JSON-mode prompt.
 *
 * Produces structured landing-page content for a single lead. The
 * response schema is strict (see WEBSITE_MOCKUP_SCHEMA below) so the
 * showcase renderer (`src/lib/mockups/renderers/leadac-showcase.ts`)
 * can map fields to HTML without any free-text inference.
 *
 * Schema evolution:
 *   v1 (leadac-hero)   — hero, services, testimonial, about, cta_final
 *   v2 (leadac-showcase, current) — adds stat_strip, stats, features,
 *     courses (priced packages), trust_points, testimonials (array),
 *     faqs, booking_widget, contact_form, map, expanded about with
 *     instructors, expanded cta_final. Every new field is optional /
 *     defaults to an empty array so older `WebsiteMockup` rows still
 *     parse cleanly through `parseSections()` in
 *     `src/lib/agent-workers/website-mockup.ts`.
 *
 * Guardrails:
 *   - All business identity fields (name, phone, address) are
 *     injected by the server BEFORE rendering; the model cannot
 *     change them.
 *   - The model is explicitly told not to invent service hours,
 *     prices, or claims not grounded in the lead input.
 *   - Language is workspace-scoped (`tr` or `en`); the model replies
 *     in the same language the business's customers would read.
 *   - Course prices come from the workspace's `ServicePackage` rows,
 *     not Gemini, so the rep never sees an invented price tag on
 *     their own /m/<slug> demo.
 */

export interface WebsiteMockupStatChip {
  /** Short numeric / icon-able value. e.g. "%92", "4.8★", "1.500+". */
  value: string;
  /** Short label under the value. e.g. "Sınav başarısı". */
  label: string;
}

export interface WebsiteMockupStatCard extends WebsiteMockupStatChip {
  /** Icon hint matching `_shared.ts`'s ICONS map (renderer ignores unknown). */
  icon_hint: string;
}

export interface WebsiteMockupHero {
  headline: string;
  subline: string;
  cta_primary_text: string;
  /**
   * Secondary CTA label — WhatsApp / "Yol tarifi" / similar. Optional;
   * renderer skips the secondary button when the workspace has no
   * phone (waHref + mapsHref both null).
   */
  cta_secondary_text?: string | null;
  trust_line: string | null;
  /**
   * 3 quick numeric chips next to the hero illustration (showcase
   * renderer). Empty array → renderer omits the strip. Examples:
   *  - "%92 sınav başarısı"
   *  - "1.500+ mezun"
   *  - "12 yıllık tecrübe"
   */
  stat_strip?: WebsiteMockupStatChip[];
}

export interface WebsiteMockupService {
  title: string;
  body: string;
  icon_hint: string;
}

export interface WebsiteMockupFeatureStep {
  /** "Kayıt", "Teorik", "Direksiyon", "Sınav" — short verb / noun. */
  title: string;
  body: string;
  icon_hint: string;
}

export interface WebsiteMockupCourse {
  /** Package name, e.g. "B Sınıfı Ehliyet Kursu" / "Pro Paket". */
  title: string;
  /** 1-2 sentence pitch. */
  body: string;
  /** Renderer-displayed price label, e.g. "7.000 TL" or "Bizden teklif al". */
  price_label: string;
  /** Optional duration line under the price. e.g. "30 saat". */
  duration?: string | null;
  /** Bullet-list features (up to ~6). */
  feature_list: string[];
  /**
   * Renderer scales-up + adds a "Popüler" badge to the popular card.
   * Resolved from the workspace's ServicePackage.isPopular when the
   * mockup worker maps a Gemini-named title back to a row.
   */
  is_popular: boolean;
  /** Icon hint matching `_shared.ts`'s ICONS map. */
  icon_hint: string;
}

export interface WebsiteMockupTrustPoint {
  /** Numbered title — e.g. "MEB onaylı eğitmenler". */
  title: string;
  /** 1-2 sentence body explaining why this matters. */
  body: string;
}

export interface WebsiteMockupTestimonial {
  body: string;
  attribution: string;
  /**
   * null when Gemini did not return a valid rating in [1,5] - the
   * showcase renderer drops the stars rather than fabricating a
   * 5-star rating. See `clampRating` in `website-mockup.ts`.
   */
  rating: number | null;
}

export interface WebsiteMockupFaq {
  question: string;
  answer: string;
}

export interface WebsiteMockupAboutInstructor {
  /** Display name, e.g. "Mehmet Y.". */
  name: string;
  /** Role / specialty, e.g. "Baş eğitmen, 18 yıl tecrübe". */
  role: string;
}

export interface WebsiteMockupAbout {
  paragraph: string;
  /**
   * Optional instructor / staff grid (0-3 entries). Renderer omits
   * the grid when the array is empty.
   */
  instructors?: WebsiteMockupAboutInstructor[];
}

export interface WebsiteMockupBookingWidget {
  /** Section title, e.g. "Hemen Randevu Al". */
  title: string;
  /** Subtitle / reassurance, e.g. "Direksiyon dersleri için boş slotlar". */
  subtitle: string;
  /** Localised label for column #1, e.g. "Bugün". */
  slot_label_today: string;
  /** Localised label for column #2, e.g. "Yarın". */
  slot_label_tomorrow: string;
  /** Localised label for column #3, e.g. "Çarşamba". */
  slot_label_day3: string;
  /** Time slot labels, e.g. ["09:00", "10:30", "13:00", "15:30", "17:00"]. */
  time_slots: string[];
}

export interface WebsiteMockupContactForm {
  title: string;
  subtitle: string;
  name_label: string;
  phone_label: string;
  /** Vertical-specific dropdown label, e.g. "B sınıfı / A2 / Direksiyon". */
  class_label: string;
  message_label: string;
  submit_text: string;
  /** Small print under the submit. e.g. "Mesajınız WhatsApp'a iletilir.". */
  privacy_note: string;
}

export interface WebsiteMockupMap {
  /**
   * Free-text query Gemini fills in with `${businessName} ${formattedAddress}`
   * (or similar). The renderer URL-encodes this through
   * `buildMapsEmbedUrl` from `_shared.ts`. Empty / null → map section
   * is omitted.
   */
  iframe_query: string;
}

export interface WebsiteMockupTheme {
  mode: "dark" | "light";
  accent_hex: string;
  primary_hex: string;
}

export interface WebsiteMockupSections {
  hero: WebsiteMockupHero;
  /** Legacy v1 services section — still emitted for `leadac-hero` rows. */
  services: WebsiteMockupService[];
  /**
   * v2 numeric KPIs (3-4 cards). Empty for legacy rows; the showcase
   * renderer drops the section when empty.
   */
  stats?: WebsiteMockupStatCard[];
  /**
   * v2 process steps (3-4 numbered cards). For a sürücü kursu:
   * Kayıt → Teorik → Direksiyon → Sınav. Empty for legacy rows.
   */
  features?: WebsiteMockupFeatureStep[];
  /**
   * v2 priced course cards (1-3). Mapped from the workspace's
   * `ServicePackage` rows when available; Gemini only writes the
   * `body` / `feature_list` flavour text. Empty for legacy rows /
   * workspaces without any ServicePackage configured.
   */
  courses?: WebsiteMockupCourse[];
  /** v2 trust columns (3 numbered cards). Empty for legacy rows. */
  trust_points?: WebsiteMockupTrustPoint[];
  /**
   * v2 multi-review block. The renderer reads this array first;
   * when empty it falls back to the legacy single `testimonial`
   * object below for back-compat with old WebsiteMockup rows.
   */
  testimonials?: WebsiteMockupTestimonial[];
  /** Legacy v1 single testimonial. Showcase prefers `testimonials`. */
  testimonial: WebsiteMockupTestimonial | null;
  /** v2 accordion FAQs (5-6 entries). Empty for legacy rows. */
  faqs?: WebsiteMockupFaq[];
  about: WebsiteMockupAbout;
  /**
   * v2 booking-slot widget. null → showcase omits the section,
   * legacy rows ship without booking.
   */
  booking_widget?: WebsiteMockupBookingWidget | null;
  /** v2 contact form fields. null → showcase omits the section. */
  contact_form?: WebsiteMockupContactForm | null;
  /** v2 Google Maps embed. null → showcase omits the section. */
  map?: WebsiteMockupMap | null;
  cta_final: {
    headline: string;
    /** v2 sub-headline under the CTA banner. Optional. */
    subline?: string | null;
    button_text: string;
    /** v2 secondary (WhatsApp) button label. Optional. */
    secondary_button_text?: string | null;
  };
  theme: WebsiteMockupTheme;
  section_order: string[];
}

/**
 * Workspace ServicePackage shape consumed by the prompt. Mirrors
 * the columns Prisma returns in `website-mockup.ts` so the prompt
 * builder is decoupled from the generated client.
 */
export interface WorkspaceServicePackage {
  name: string;
  priceLabel: string;
  features: string[];
  isPopular: boolean;
}

export interface RecommendedPackageInput {
  name: string;
  priceLabel: string;
  features: string[];
  /**
   * Free-text reason from the analyst worker
   * (`SalesOpportunity.recommendedPackageReason`). When present the
   * prompt instructs Gemini to lean into this reason for the
   * `is_popular: true` card so the rep can defend the pick verbally.
   */
  reason: string | null;
}

export interface WebsiteMockupPromptInput {
  businessName: string;
  formattedAddress: string;
  borough: string | null;
  phone: string | null;
  websiteUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  primaryType: string | null;
  servicesDetected: string[];
  topReviews: { authorName: string; rating: number; text: string | null }[];
  painPhrases: string[];
  strengthPhrases: string[];
  workspaceOfferName: string | null;
  workspaceValueProposition: string | null;
  /**
   * Niche pack metadata for the lead. Lets the model lean into the
   * vertical's actual sales angle (e.g. "QR pay + tab split for bars",
   * "premium reservation widget for fine dining") rather than producing
   * generic local-business copy. Theme/colors are NOT included here —
   * those are resolved server-side from the niche pack and overwritten
   * into `sections.theme` after the model returns.
   */
  nicheLabel: string | null;
  nichePitchAngle: string | null;
  nicheHighValueSignals: string[];
  /**
   * v2 — Sales Opportunity inputs. These flow from the upstream
   * SALES_OPPORTUNITY_SCORER worker (now a hard prerequisite of the
   * mockup worker per the `user_one_click_pitch` chain rewire). When
   * the scorer hasn't run yet (legacy callers / older chains) every
   * field is null/empty and the prompt falls back to the v1
   * niche-only grounding.
   */
  salesPainPoints?: string[];
  salesBestAngle?: string | null;
  salesWhyGoodTarget?: string | null;
  recommendedPackage?: RecommendedPackageInput | null;
  /**
   * v2 — All priced tiers the workspace sells, in display order.
   * Drives the `courses` section so the rep's own /m/<slug> demo
   * carries their actual price card (instead of Gemini inventing
   * generic "STARTER / GROWTH / PRO" copy). Empty array → showcase
   * renderer omits the courses section.
   */
  workspaceServicePackages?: WorkspaceServicePackage[];
  language: string; // "tr" | "en"
}

export const WEBSITE_MOCKUP_SYSTEM_CONTEXT = `You are a senior web designer and copywriter building a single-page landing website for a local service business. Your output must be:

1. High-conversion: every section exists to push the visitor toward calling, booking, or requesting a quote.
2. Grounded: use ONLY the facts provided about this business. Do not invent hours, prices, staff count, certifications, or years in business. If a detail is not supplied, keep the copy general.
3. Audience-aware: the reader is a local homeowner or small business owner looking for this service NOW. Copy should feel local, trustworthy, and urgent without being pushy.
4. Vertical-aware: when a niche pitch angle and high-value signals are provided, lean the headline + services + CTA into that angle. Example: a bar's hero should mention peak-hour throughput / tab split, not generic "great drinks"; a fine-dining hero should sell the experience, not online ordering.
5. Sales-aware: when SALES OPPORTUNITY signals are provided (best_sales_angle, likely_pain_points), the hero headline IS a tight rewrite of best_sales_angle and the subline counters the top 2 pain points. The recommendedPackage (when provided) is the card the prompt marks is_popular:true and its name MUST match one of the workspaceServicePackages entries.
6. Design-system-aligned: use Leadac's landing-page aesthetic - dark background, glass panels, single accent gradient, one clear primary CTA. The theme colors are picked deterministically by the system based on the business's vertical; you may still emit a "theme" object in the response (the renderer ignores it and substitutes the niche palette), but do not waste effort tuning it.

Respond ONLY with valid JSON matching the schema exactly. No markdown, no preface, no trailing prose.`;

export const WEBSITE_MOCKUP_SCHEMA_DESCRIPTION = `Response schema (every field required unless marked optional):
{
  "hero": {
    "headline": string,                   // 5-9 words, active voice, benefit-first; if best_sales_angle supplied, rewrite it tight
    "subline": string,                    // 10-20 words, counter the top 1-2 pain points or echo strongest review evidence
    "cta_primary_text": string,           // 2-4 words, action verb
    "cta_secondary_text": string | null,  // 2-4 words; WhatsApp / "Yol tarifi" / similar
    "trust_line": string | null,          // "4.8★ on Google · 127 reviews" style — null if no rating
    "stat_strip": [                       // 3 entries
      { "value": string, "label": string }
    ]
  },
  "services": [                           // 3-6 short service cards (legacy v1 field, still emit)
    { "title": string, "body": string, "icon_hint": string }
  ],
  "stats": [                              // 3-4 numeric KPI cards
    { "value": string, "label": string, "icon_hint": string }
  ],
  "features": [                           // 4 process steps; for a driving school: Kayıt → Teorik → Direksiyon → Sınav
    { "title": string, "body": string, "icon_hint": string }
  ],
  "courses": [                            // 1-3 priced cards; ONE has is_popular:true (the recommendedPackage)
    {
      "title": string,                    // MUST match a workspaceServicePackages.name when packages are supplied
      "body": string,
      "price_label": string,              // ECHO the package's priceLabel verbatim — do NOT invent
      "duration": string | null,          // e.g. "30 saat" / "4 hafta", optional
      "feature_list": [string, ...],      // 3-6 bullets
      "is_popular": boolean,
      "icon_hint": string
    }
  ],
  "trust_points": [                       // 3 numbered trust columns
    { "title": string, "body": string }
  ],
  "testimonials": [                       // 2-3 reviews; paraphrase from topReviews when provided
    { "body": string, "attribution": string, "rating": 4 | 5 | null }
  ],
  "testimonial": null,                    // legacy v1 single — emit null when "testimonials" has entries
  "faqs": [                               // 5-6 accordion Q&A; FIRST question MUST be price-related ("Kurs ücretleri ne kadar?" in TR)
    { "question": string, "answer": string }
  ],
  "about": {
    "paragraph": string,
    "instructors": [                      // 0-3 optional staff cards
      { "name": string, "role": string }
    ]
  },
  "booking_widget": {                     // null to omit
    "title": string,
    "subtitle": string,
    "slot_label_today": string,
    "slot_label_tomorrow": string,
    "slot_label_day3": string,
    "time_slots": [string, string, string, string, string]   // 5 entries, vertical-appropriate hours
  } | null,
  "contact_form": {                       // null to omit
    "title": string, "subtitle": string,
    "name_label": string, "phone_label": string,
    "class_label": string,                // vertical-specific dropdown label
    "message_label": string, "submit_text": string,
    "privacy_note": string                // e.g. "Mesajınız WhatsApp'a iletilir."
  } | null,
  "map": { "iframe_query": string } | null,   // raw query, renderer URL-encodes
  "cta_final": {
    "headline": string,
    "subline": string | null,
    "button_text": string,
    "secondary_button_text": string | null  // WhatsApp variant
  },
  "theme": {
    "mode": "dark" | "light",
    "accent_hex": "#RRGGBB",
    "primary_hex": "#RRGGBB"
  },
  "section_order": ["nav", "hero", "stats", "process", "courses", "trust", "testimonials", "faq", "booking", "about", "map", "contact", "cta", "footer"]
}`;

export function buildWebsiteMockupPrompt(input: WebsiteMockupPromptInput): string {
  const langTag = input.language === "tr" ? "Turkish (tr)" : "English (en)";
  const reviewsBlock = input.topReviews.length
    ? input.topReviews
        .slice(0, 3)
        .map(
          (r, i) =>
            `${i + 1}. ${r.authorName} (${r.rating}/5): ${r.text ?? "[no text]"}`,
        )
        .join("\n")
    : "(no reviews provided)";

  const painsBlock = input.painPhrases.length
    ? input.painPhrases.slice(0, 5).map((p) => `- ${p}`).join("\n")
    : "(none identified)";
  const strengthsBlock = input.strengthPhrases.length
    ? input.strengthPhrases.slice(0, 5).map((s) => `- ${s}`).join("\n")
    : "(none identified)";

  const servicesBlock = input.servicesDetected.length
    ? input.servicesDetected.join(", ")
    : "(not detected - infer 3-5 plausible services for this business type)";

  const nicheBlock = input.nicheLabel
    ? `- Vertical: ${input.nicheLabel}
- Pitch angle: ${input.nichePitchAngle ?? "(none)"}
- High-value signals to lean into: ${input.nicheHighValueSignals.length ? input.nicheHighValueSignals.join("; ") : "(none)"}`
    : "(no niche metadata available - treat as generic local service business)";

  // ---------- v2 sales opportunity ----------
  const salesPains = input.salesPainPoints ?? [];
  const salesBlock =
    input.salesBestAngle || input.salesWhyGoodTarget || salesPains.length
      ? `- Best sales angle: ${input.salesBestAngle ?? "(none)"}
- Why good target: ${input.salesWhyGoodTarget ?? "(none)"}
- Likely pain points (counter these in hero subline + courses body):
${salesPains.length ? salesPains.map((p) => `  · ${p}`).join("\n") : "  · (none surfaced)"}`
      : "(no sales-opportunity signals available — fall back to niche + review evidence)";

  // ---------- v2 service packages ----------
  const packages = input.workspaceServicePackages ?? [];
  const packagesBlock = packages.length
    ? packages
        .map((p, i) => {
          const star = p.isPopular ? " [POPULAR]" : "";
          const feats = p.features.length
            ? p.features.map((f) => `      · ${f}`).join("\n")
            : "      · (no features listed)";
          return `  ${i + 1}. ${p.name} — ${p.priceLabel}${star}
${feats}`;
        })
        .join("\n")
    : "(no priced packages configured — emit an empty courses array)";

  const recPkg = input.recommendedPackage;
  const recBlock = recPkg
    ? `Recommended package (must be the courses card with is_popular:true):
  - Name: ${recPkg.name}
  - Price: ${recPkg.priceLabel}
  - Features: ${recPkg.features.join(" · ") || "(none)"}
  - Why: ${recPkg.reason ?? "(no reason from scorer)"}`
    : "(no recommended package — pick the workspaceServicePackages entry whose isPopular:true is_popular; otherwise the middle entry)";

  return `${WEBSITE_MOCKUP_SYSTEM_CONTEXT}

${WEBSITE_MOCKUP_SCHEMA_DESCRIPTION}

LANGUAGE FOR ALL COPY: ${langTag}. Every headline, body line, CTA, FAQ, and label must be in this language.

BUSINESS CONTEXT:
- Name: ${input.businessName}
- Type: ${input.primaryType ?? "(not specified)"}
- Address: ${input.formattedAddress}
- Neighborhood: ${input.borough ?? "(not specified)"}
- Phone: ${input.phone ?? "(not available)"}
- Current website: ${input.websiteUrl ?? "(none)"}
- Google rating: ${input.rating ?? "(no rating)"} (${input.reviewCount ?? 0} reviews)
- Services detected: ${servicesBlock}

NICHE CONTEXT:
${nicheBlock}

SALES OPPORTUNITY:
${salesBlock}

REVIEW SIGNAL:
Top reviews:
${reviewsBlock}

Top customer pains (address these in your copy or counter them):
${painsBlock}

Top customer strengths (lean into these):
${strengthsBlock}

AGENCY OFFER CONTEXT (the agency selling this site):
- Offer name: ${input.workspaceOfferName ?? "(generic)"}
- Value proposition: ${input.workspaceValueProposition ?? "(generic)"}

WORKSPACE SERVICE PACKAGES (use as the source-of-truth for courses):
${packagesBlock}

${recBlock}

INSTRUCTIONS:
1. Hero: headline is a 5-9 word rewrite of best_sales_angle if available, otherwise the niche pitch angle. Subline counters the top 1-2 pain points OR echoes the strongest review evidence. stat_strip = 3 short proof numbers (e.g. "%92 sınav başarısı", "1.500+ mezun"); do not invent specifics — keep them generic ("Yüksek başarı", "Mezunlarımız") when no review/audit data backs them.
2. Stats: 3-4 KPI cards, complement the stat_strip (different angle — e.g. years operating, fleet size).
3. Features (process steps): 4 entries describing the customer journey for THIS vertical. For a driving school the canonical flow is Kayıt → Teorik → Direksiyon → Sınav. For other verticals: Discovery → Teklif → Uygulama → Teslim.
4. Courses: 1-3 priced cards drawn from workspaceServicePackages. Each card's title MUST match a package name verbatim; price_label MUST be the package's priceLabel verbatim. The recommendedPackage card (or the workspace's isPopular:true package) gets is_popular:true and a slightly stronger body. Never invent a tier that isn't in the input.
5. Trust points: 3 numbered cards drawn from the workspace valueProposition + the counters of the top pain points.
6. Testimonials: 2-3 paraphrased Google reviews. Attribution = first name + initial. Skip the section (empty array + testimonial:null) when no reviews are provided.
7. FAQs: 5-6 entries. The FIRST question MUST address price (e.g. "Kurs ücretleri ne kadar?" / "How much do courses cost?"). Subsequent questions: registration, class types, duration, required documents, lesson scheduling.
8. About: 2-4 sentence paragraph, no invented dates / staff counts. instructors = 0-3 generic role cards (e.g. "Baş eğitmen", "Teorik dersleri") — names stay as initials only if you don't have evidence; OK to leave empty.
9. Booking widget: time_slots = 5 vertical-appropriate hours (driving school 09:00–18:00 weekday window). Labels are localised today / tomorrow / day-after-tomorrow names.
10. Contact form: class_label is vertical-specific (e.g. "B sınıfı / A2 / Direksiyon"); privacy_note explains that submissions open WhatsApp on the user's device.
11. Map: iframe_query = "${input.businessName} ${input.formattedAddress}". Raw string, no encoding.
12. cta_final: headline urges action; secondary_button_text is the WhatsApp label.
13. Theme: emit any reasonable hex pair — the system will substitute the niche palette before rendering. mode "dark" is the sensible default.

Respond with ONLY the JSON object. No prose before or after.`;
}
