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
   * v2 — Niche-typical customer-facing offerings. The mockup is the
   * BUSINESS'S website addressed to ITS customers, so the `courses`
   * cards advertise what THIS vertical normally sells (e.g. driving
   * school: "B Sınıfı", "A2 Motor"; phone repair: "Ekran Değişimi",
   * "Batarya Değişimi"). These come from the lead's niche pack —
   * NEVER from the workspace's ServicePackage rows, which are the
   * agency's pricing aimed at the lead (different audience). Empty →
   * prompt instructs Gemini to infer 2-3 plausible offerings from
   * the niche label.
   */
  nicheTypicalOfferings?: string[];
  /**
   * v2 — Sales Opportunity inputs from SALES_OPPORTUNITY_SCORER. These
   * are AGENCY-INTERNAL signals (why this lead is a good target for
   * the workspace selling the build) — they MUST NOT leak into the
   * customer-facing copy on the demo site. The prompt only uses them
   * to inform internal hidden notes; the lead's own site copy is
   * driven exclusively by the niche pitch angle, services detected,
   * and the lead's own review evidence.
   */
  salesPainPoints?: string[];
  salesBestAngle?: string | null;
  salesWhyGoodTarget?: string | null;
  language: string; // "tr" | "en"
}

export const WEBSITE_MOCKUP_SYSTEM_CONTEXT = `You are a senior web designer and copywriter building a single-page landing website FOR a local service business that will be addressed TO that business's own customers. Audience-truth rules — read carefully:

  Audience = the business's CUSTOMERS (e.g. for a driving school: prospective students and their parents; for a phone-repair shop: people with a cracked screen; for a kuyumcu / jeweler: bir müşteri alyans bakıyor, gram altın fiyatı soruyor, hurda altın bozdurmak istiyor, ya da pırlanta yüzük seçiyor). NOT the business owner.
  Author voice = the BUSINESS speaking to its customers ("Ehliyetinizi bizden alın", "Hemen randevu alın", "Bugünkü gram fiyatımız için WhatsApp'tan yazın"). NOT an agency speaking to the business owner.
  Forbidden voice: "Daha çok öğrenci kazanın", "daha çok müşteri çekin", "satış dönüşümünüzü artırın", "müşteri memnuniyetinizi online'a taşıyın", "operasyonel verimlilik", "leads", "conversions", "ROI", "vitrini brand'e dönüştürün". These are agency-to-business pitches — they belong in the cold email, NOT on the demo site. If you catch yourself writing them, REWRITE.

Output requirements:

1. High-conversion: every section pushes the visitor (the customer) toward calling, WhatsApp-ing, booking, or visiting.
2. Grounded: use ONLY the facts provided. Do not invent hours, prices, staff count, certifications, years in business, or specific pass rates. When a detail isn't supplied, keep it general ("Yüksek başarı", "Deneyimli kadro"). NEVER quote a price unless an explicit number is supplied.
3. Vertical-native: when a niche pitch angle and typical offerings are provided, lean the headline + courses + features into that vertical's customer journey. The courses section advertises what THE BUSINESS sells to its customers (e.g. driving school: "B Sınıfı Ehliyet", "A2 Motor"), NOT agency packages.
4. Local + warm: copy should feel local, trustworthy, and urgent without being pushy. Avoid corporate jargon.
5. Design: glass panels, single accent gradient, one clear primary CTA. The theme colors are picked deterministically server-side after you respond; you may emit any reasonable theme object — it will be substituted.

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
  "courses": [                            // 2-3 cards of what THE BUSINESS sells to ITS customers
    {
      "title": string,                    // e.g. driving school: "B Sınıfı Ehliyet Kursu" — kuyumcu: "Alyans ve Nişan Yüzüğü" / "Hurda Altın Bozdurma" — phone repair: "Ekran Değişimi"
      "body": string,                     // 1-2 sentence pitch describing what the customer gets
      "price_label": string,              // "Bizden teklif al" / "Detay için arayın" / "Güncel gram fiyatı için WhatsApp" — NEVER invent a numeric price
      "duration": string | null,          // e.g. "30 saat teorik + 14 saat direksiyon" (driving school) or "Aynı gün teslim" (kuyumcu tamir) — null when not meaningful
      "feature_list": [string, ...],      // 3-6 bullets of what's included from the CUSTOMER's perspective
      "is_popular": boolean,              // mark exactly ONE card true — the vertical's flagship offering
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
    : "(not detected — infer 3-5 plausible services for this business type)";

  const nicheBlock = input.nicheLabel
    ? `- Vertical: ${input.nicheLabel}
- Pitch angle (customer-facing): ${input.nichePitchAngle ?? "(none)"}
- High-value signals: ${input.nicheHighValueSignals.length ? input.nicheHighValueSignals.join("; ") : "(none)"}`
    : "(no niche metadata available — treat as generic local service business)";

  const offerings = input.nicheTypicalOfferings ?? [];
  const offeringsBlock = offerings.length
    ? offerings.map((o, i) => `  ${i + 1}. ${o}`).join("\n")
    : "(none supplied — infer 2-3 plausible customer-facing offerings for this vertical from the niche label and primaryType)";

  // Sales opportunity — INTERNAL CONTEXT ONLY, must not leak into copy.
  const salesPains = input.salesPainPoints ?? [];
  const salesContextBlock =
    input.salesBestAngle || input.salesWhyGoodTarget || salesPains.length
      ? `(Reference only — these describe why an agency might pitch THIS business. DO NOT echo them into the customer-facing copy. They exist to remind you what NOT to write on the demo site.)
- Agency's pitch angle to the business owner: ${input.salesBestAngle ?? "(none)"}
- Why this is a good agency target: ${input.salesWhyGoodTarget ?? "(none)"}
- Operational gaps the agency sees:
${salesPains.length ? salesPains.map((p) => `  · ${p}`).join("\n") : "  · (none)"}`
      : "(no agency-side context — fine, the demo site never needed it anyway)";

  return `${WEBSITE_MOCKUP_SYSTEM_CONTEXT}

${WEBSITE_MOCKUP_SCHEMA_DESCRIPTION}

LANGUAGE FOR ALL COPY: ${langTag}. Every headline, body line, CTA, FAQ, and label must be in this language.

==== THE BUSINESS THIS SITE IS FOR (this is who is speaking on the page) ====
- Name: ${input.businessName}
- Type: ${input.primaryType ?? "(not specified)"}
- Address: ${input.formattedAddress}
- Neighborhood: ${input.borough ?? "(not specified)"}
- Phone: ${input.phone ?? "(not available)"}
- Current website: ${input.websiteUrl ?? "(none)"}
- Google rating: ${input.rating ?? "(no rating)"} (${input.reviewCount ?? 0} reviews)
- Services detected on their current site / Google profile: ${servicesBlock}

NICHE CONTEXT:
${nicheBlock}

TYPICAL CUSTOMER-FACING OFFERINGS for this vertical (use these to seed the courses section):
${offeringsBlock}

REVIEW SIGNAL (the business's actual customers in their own words):
Top reviews:
${reviewsBlock}

Pains visitors might worry about (counter these in the copy):
${painsBlock}

Strengths to lean into (these are the business's actual edge):
${strengthsBlock}

==== AGENCY-INTERNAL CONTEXT — DO NOT WRITE THIS INTO THE SITE ====
${salesContextBlock}

==== INSTRUCTIONS ====

1. Voice check before every block: am I writing as ${input.businessName} talking to its customers? If not, rewrite. Never address the business owner.

2. Hero: headline (5-9 words) is what a CUSTOMER scanning the page in 2 seconds needs to know — "${input.businessName}'da ehliyetinizi alın" / "Beylikdüzü'nün güvenilir sürücü kursu". DO NOT use phrases like "daha çok öğrenci" / "memnuniyeti online'a taşıyın" / "verimlilik" — those are agency pitches, not customer hooks. Subline (10-20 words) reassures the customer (location, experience, certification) — counter visitor anxieties, not agency-perceived gaps. stat_strip = 3 short proof numbers; keep generic ("Yüksek başarı", "Tecrübeli kadro", "MEB onaylı") when no concrete data is supplied — NEVER invent percentages.

3. Stats: 3-4 KPI cards complementing the stat_strip — different angle (years operating, modern fleet, etc.). Same generic-when-unknown rule.

4. Features (process steps): 4 entries describing the customer journey for THIS vertical FROM THE CUSTOMER'S POV. Driving school: Kayıt → Teorik → Direksiyon → Sınav. Kuyumcu: Sor (WhatsApp / vitrine gel) → İncele (ürünü dene / sertifikayı gör) → Onayla (gramaj + ayar + fiyat) → Teslim al (kutulu, garantili). Phone repair: Tanı → Teklif → Onay → Teslim. Each body explains what the CUSTOMER does / experiences at that step.

5. Courses: 2-3 cards. Each card is ONE customer-facing offering from the typical-offerings list (driving school: "B Sınıfı Ehliyet Kursu", "A2 Motosiklet" — kuyumcu: "Alyans ve Nişan Yüzüğü", "Hurda Altın Bozdurma", "Pırlanta Yüzük Koleksiyonu"). price_label is "Bizden teklif al" / "Detay için arayın" / "Güncel gram fiyatı için WhatsApp" — NEVER quote a numeric price unless one is explicitly provided in the input (it never is). Body = what the customer gets. feature_list = what's included (driving school: "30 saat teorik", "14 saat direksiyon" — kuyumcu: "Sertifikalı has ayar", "Kutulu teslim", "Ücretsiz ölçü değişimi"). Mark the most-bought tier is_popular:true — for a kuyumcu that's usually "Alyans ve Nişan Yüzüğü" (geleneksel) or "Pırlanta Yüzük Koleksiyonu" (lüks).

6. Trust points: 3 numbered cards from the customer's perspective ("MEB onaylı", "Tecrübeli kadro", "Modern araç filosu"). NEVER mention agency-side concepts ("online conversion", "lead capture").

7. Testimonials: 2-3 paraphrased Google reviews. Attribution = first name + initial. When no reviews are supplied, emit an empty array and testimonial:null.

8. FAQs: 5-6 entries. FIRST question MUST be price/availability-related from the customer's POV (driving school: "Kurs ücretleri ne kadar?" — kuyumcu: "Bugünkü gram altın fiyatı / hurda altın alış fiyatı ne kadar?" — phone repair: "Onarım kaç para?"). Answer points them to phone/WhatsApp and NEVER quotes a number — gram altın fiyatı saatlik değiştiği için "günlük güncel fiyat WhatsApp'ta paylaşılır" şeklinde yanıtlanır. Subsequent FAQs cover the vertical's other common questions (driving school: required documents, class duration, scheduling — kuyumcu: sertifika / has ayar nasıl kontrol edilir, alyans ölçü değişimi ücretsiz mi, hurda altın hangi ayardan kabul edilir, kutulu teslim + garanti şartları).

9. About: 2-4 sentence paragraph in the business's voice. instructors = 0-3 generic role cards ("Baş eğitmen", "Teorik dersleri uzmanı") — only emit when role types are universal to the vertical; names stay generic if the business hasn't shared real ones.

10. Booking widget: time_slots = 5 vertical-appropriate hours (driving school: 09:00–18:00 weekdays). Localised day labels.

11. Contact form: class_label is vertical-specific (driving school: "B sınıfı / A2 / Direksiyon"; kuyumcu: "Alyans / Hurda Altın / Tamir / Genel Soru"; phone repair: "iPhone / Android / Tablet / Diğer"). privacy_note tells the visitor where their message goes ("Mesajınız WhatsApp'a iletilir.").

12. Map: iframe_query = "${input.businessName} ${input.formattedAddress}" raw, no encoding.

13. cta_final: headline urges the CUSTOMER to act ("Hayalinizdeki ehliyete bir adım kaldı"). secondary_button_text = WhatsApp label.

14. Theme: emit any hex pair — the system substitutes the niche palette before rendering.

FINAL VOICE AUDIT before emitting JSON: scan every headline / body / CTA. Strike anything that addresses a business owner, sells agency services, or mentions "leads / conversion / verimlilik / dijital dönüşüm / vitrini brand'e dönüştürün / daha çok müşteri kazanın / satış dönüşümü". Replace with copy aimed at the END CUSTOMER:
 - Driving school example: a parent in Beylikdüzü googling "Beylikdüzü ehliyet kursu" who wants their kid to pass first try.
 - Kuyumcu example: bir müşteri Kapalıçarşı'da gram altın fiyatına bakıyor / nişanlısıyla alyans seçiyor / hurda altın bozdurmak için en yakın güvenilir kuyumcuyu arıyor.
 - Phone repair example: someone with a cracked iPhone screen who needs same-day fix.
If unsure, ask: "Would I see this copy on a real working ${input.nicheLabel ? input.nicheLabel.toLowerCase() : "local business"}'s website?" — only emit when the answer is yes.

Respond with ONLY the JSON object. No prose before or after.`;
}
