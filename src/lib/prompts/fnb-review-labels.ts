/**
 * Beta finding §3 — canonical F&B KPI label enum.
 *
 * Why this exists: pre-stabilization the Gemini review-analyst was
 * free to invent its own KPI labels per run. Coffee & Beyond got
 * "Restrictive Policies" clustering "no laptops past 2pm" with
 * "WiFi requires purchase" — two unrelated complaints fused into a
 * label that didn't exist anywhere else in the corpus, breaking
 * cross-lead aggregation ("which bars in NYC have rude staff?")
 * and the per-pain mockup-section picker. The fix is a tight
 * whitelist injected into both the prompt instructions AND the
 * `responseSchema.enum` so the model physically cannot emit an
 * off-vocabulary label.
 *
 * Scope: F&B (RESTAURANT_TECH workspaces). Other verticals add their
 * own enums when they're ready — we do NOT want a 200-label union
 * that lets the model pick from a giant menu, the whole point of the
 * whitelist is forcing semantic clustering inside a small fixed set.
 *
 * Adding a label: add it to one of the lists below + verify it
 * doesn't collapse two distinct complaints. The post-process filter
 * in `kpi-filter.ts` is downstream of this and won't rescue a bad
 * label choice.
 */

/**
 * Negative-sentiment KPI labels. Each label maps to ONE distinct
 * operational failure; if a complaint doesn't fit any label exactly,
 * the prompt instructs Gemini to OMIT the KPI rather than cluster
 * unrelated complaints into the closest-fitting label.
 */
export const FNB_WEAKNESS_LABELS = [
  // Service speed / staff
  "Slow Service",
  "Long Wait Times",
  "Rude Staff",
  "Inattentive Staff",
  "Understaffed",
  "Reservation Issues",
  // Order accuracy
  "Wrong Order",
  "Missing Items",
  "Order Mix-ups",
  // Food quality
  "Food Quality",
  "Cold Food",
  "Small Portions",
  "Bland Taste",
  "Stale / Old Food",
  // Pricing
  "Overpriced",
  "Hidden Fees",
  "Service Charge Disputes",
  // Ambience
  "Noisy Atmosphere",
  "Dirty / Unclean",
  "Cramped Seating",
  "Bad Lighting / Smell",
  // Restrictions / policies (kept separate so Coffee & Beyond's
  // "no laptops" + "WiFi only with purchase" land on distinct bars)
  "WiFi Restrictions",
  "Time Limits",
  "No Reservations Accepted",
  "Cash Only",
  "Pet Policy Issues",
  // Tech / digital
  "No Online Ordering",
  "No Online Reservation",
  "Slow / Broken Website",
  "QR Menu Issues",
  "Loyalty Program Issues",
  // Delivery / pickup
  "Late Delivery",
  "Cold Delivery",
  "Delivery Errors",
  "Pickup Problems",
  // Payment
  "Payment Problems",
  "No Card Payment",
  "Tipping Disputes",
  // Allergen / dietary
  "Allergen Mishandling",
  "Limited Vegan / Vegetarian Options",
  "No Allergen Info",
  // Hours / availability
  "Inconsistent Hours",
  "Items Out of Stock",
  "Closed Earlier Than Posted",
  // Hygiene / safety
  "Hygiene Concerns",
  "Pest Sightings",
  // Misc
  "Inconsistent Quality",
  "Hard to Find / Bad Signage",
  "Crowded / Long Lines",
] as const;

export type FnbWeaknessLabel = (typeof FNB_WEAKNESS_LABELS)[number];

/**
 * Positive-sentiment KPI labels. Same single-cluster discipline:
 * "Friendly Staff" and "Knowledgeable Staff" are different bars.
 */
export const FNB_STRENGTH_LABELS = [
  // Service / staff
  "Fast Service",
  "Friendly Staff",
  "Knowledgeable Staff",
  "Attentive Staff",
  "Great Hospitality",
  // Food / drink
  "Great Food",
  "Authentic Cuisine",
  "Fresh Ingredients",
  "Generous Portions",
  "Great Coffee",
  "Great Cocktails",
  "Wine Selection",
  "Pastries / Baked Goods",
  "Vegan / Vegetarian Friendly",
  "Allergen Aware",
  // Value
  "Good Value",
  "Reasonable Prices",
  "Great Lunch Deal",
  "Happy Hour Pricing",
  // Atmosphere
  "Cozy Atmosphere",
  "Romantic Setting",
  "Family Friendly",
  "Pet Friendly",
  "Outdoor Seating",
  "Scenic View",
  "Live Music",
  "Instagrammable",
  // Logistics
  "Easy Parking",
  "Easy to Find",
  "Quick Pickup",
  "Reliable Delivery",
  "Smooth Reservation",
  // Tech / convenience
  "Smooth Online Ordering",
  "Good Loyalty Program",
  "Easy QR Menu",
  // Reliability
  "Consistent Quality",
  "Always Open When Posted",
  // Special occasions
  "Great for Groups",
  "Great for Date Night",
  "Birthday / Celebration Friendly",
  // Owner / brand
  "Owner Cares",
  "Local Favorite",
] as const;

export type FnbStrengthLabel = (typeof FNB_STRENGTH_LABELS)[number];

/**
 * True when the workspace's niche should use the F&B label enum.
 * Centralised here so both the prompt builder and the responseSchema
 * builder consult the same predicate (drift between them would re-
 * open the bug).
 *
 * Today only RESTAURANT_TECH gets the enum; other verticals fall back
 * to free-form labels until their own enums land.
 */
export function shouldEnforceFnbLabels(
  workspaceNiche: string | null | undefined,
): boolean {
  return workspaceNiche === "RESTAURANT_TECH";
}

/**
 * Inline-readable bullet list of the weakness labels for the prompt
 * body. Two columns of ~25 each so the rendered prompt isn't a
 * single 50-line block that buries the surrounding rules. The model
 * sees identical content either way (responseSchema.enum is the
 * actual hard constraint), but the rendered prompt is what shows up
 * in our debug logs and is easier to skim with the column layout.
 */
export function renderWeaknessLabelList(): string {
  return FNB_WEAKNESS_LABELS.map((l) => `  - "${l}"`).join("\n");
}

export function renderStrengthLabelList(): string {
  return FNB_STRENGTH_LABELS.map((l) => `  - "${l}"`).join("\n");
}
