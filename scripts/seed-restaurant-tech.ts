/**
 * Seed SDR Brain v2 substrate for a RESTAURANT_TECH workspace.
 *
 * Idempotent — running twice will:
 *   - Upsert (workspace, default name "Default ICP") IdealCustomerProfile.
 *   - Upsert ~12 CommercialInsight rows keyed by `(workspaceId, industryMyth)`
 *     (the myth string is the natural key). Re-running updates the
 *     reframe / triggers list rather than duplicating.
 *   - Print a concise summary of what was written.
 *
 * Inputs: workspace-slug or workspace-id (one of `--workspace-slug` or
 * `--workspace-id` MUST be supplied). The workspace must already exist
 * and be on RESTAURANT_TECH niche; we don't create workspaces here.
 *
 * Usage:
 *   npx tsx scripts/seed-restaurant-tech.ts --workspace-slug finedine-beta
 *
 * Why this script exists:
 *   - Per the SDR Brain v2 plan, the "12 commercial insights + 1
 *     default ICP + niche-pack objections + discovery questions" pack
 *     is the cold-start seed for restaurant-tech workspaces. Without
 *     it the COMMERCIAL_INSIGHT_MATCHER returns nothing on day one,
 *     OUTCOME_ATTRIBUTOR has no win-rate aggregates to bump, and the
 *     ICP_SCORER returns 0/100 because there's no ICP row to match.
 *   - Niche-pack objections + discovery questions live in the
 *     in-process `niches` registry (src/lib/niches/) and are read
 *     directly by the workers; they do NOT need to be persisted per
 *     workspace.
 */

import { Client } from "pg";
import "dotenv/config";

interface Args {
  workspaceSlug?: string;
  workspaceId?: string;
}

function parseArgs(argv: string[]): Args {
  const a: Args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--workspace-slug" && next) {
      a.workspaceSlug = next;
      i += 1;
    } else if (arg === "--workspace-id" && next) {
      a.workspaceId = next;
      i += 1;
    }
  }
  if (!a.workspaceSlug && !a.workspaceId) {
    throw new Error(
      "Pass either --workspace-slug <slug> or --workspace-id <id>",
    );
  }
  return a;
}

interface InsightSeed {
  industryMyth: string;
  reframe: string;
  economicImpact: string;
  contrarianObservation?: string;
  applicableTriggers: string[];
  applicableSubNiches: string[];
  basePriority: number;
}

const RESTAURANT_TECH_INSIGHTS: InsightSeed[] = [
  {
    industryMyth:
      "Customers don't actually book online — they walk in or call.",
    reframe:
      "Reservation share has flipped: in 2024 ~62% of bookings at independent restaurants started on mobile, and ghost reservations cost the average 80-cover restaurant 11 covers/week.",
    economicImpact:
      "11 lost covers/week × $48 avg ticket × 52 weeks = ~$27K/year per location.",
    contrarianObservation:
      "Restaurants that added mobile-first booking and SMS confirmation cut no-shows ~38% in 90 days (Toast Industry Report 2024).",
    applicableTriggers: ["BOOKING_PROVIDER_CHANGE", "BAD_SERVICE_REVIEWS"],
    applicableSubNiches: ["fnb-fine-dining", "fnb-bar-club", "fnb-hotel-fnb"],
    basePriority: 70,
  },
  {
    industryMyth:
      "POS data is enough — we don't need a separate CDP / loyalty stack.",
    reframe:
      "POS captures the transaction, not the diner. Without enriched profiles, repeat-visit rate plateaus at the industry-average 23%; restaurants that join POS + CDP push it to 38–45% in a year.",
    economicImpact:
      "Each +1pt repeat-visit lift is worth ~$8K/year for a 80-cover venue.",
    applicableTriggers: ["RATING_DROP", "BAD_SERVICE_REVIEWS"],
    applicableSubNiches: ["fnb-fine-dining", "fnb-cafe-bakery"],
    basePriority: 60,
  },
  {
    industryMyth:
      "We get enough Google reviews — we don't need to actively ask.",
    reframe:
      "Half of dine-in guests would leave a review if asked at the right moment (post-meal SMS within 30min). Most restaurants don't ask, and the ones who do see 4× the review velocity and a +0.3 star Google score in 6 months.",
    economicImpact:
      "+0.3 stars correlates with ~6% lift in Google Maps clicks → covers.",
    applicableTriggers: ["RATING_DROP", "BAD_SERVICE_REVIEWS"],
    applicableSubNiches: [
      "fnb-fine-dining",
      "fnb-bar-club",
      "fnb-cafe-bakery",
      "fnb-hotel-fnb",
    ],
    basePriority: 65,
  },
  {
    industryMyth:
      "Phone reservations work fine — voice AI is for big chains.",
    reframe:
      "Reception staff miss 22–30% of inbound calls during peak service. AI receptionist handles 80% of routine reservation + hours questions for ~$200/mo, freeing FOH and recovering lost covers.",
    economicImpact:
      "If 25% of missed calls would have booked, that's ~6 covers/week recovered per location.",
    applicableTriggers: ["HIRING_OPS", "BAD_SERVICE_REVIEWS"],
    applicableSubNiches: ["fnb-fine-dining", "fnb-bar-club", "fnb-hotel-fnb"],
    basePriority: 55,
  },
  {
    industryMyth:
      "Online ordering belongs to UberEats / DoorDash — let them keep their cut.",
    reframe:
      "Marketplace fees are 25–30% of order value. A direct ordering page (Square / Toast / your own) keeps that margin and grows a first-party customer list. Independent restaurants that launch direct ordering recover the build cost in ~4 months.",
    economicImpact:
      "$200 in monthly direct orders = ~$60 saved on marketplace fees.",
    applicableTriggers: ["DELIVERY_EXPANSION", "MENU_REDESIGN_SIGNAL"],
    applicableSubNiches: ["fnb-cafe-bakery", "fnb-ghost-kitchen", "fnb-food-truck"],
    basePriority: 60,
  },
  {
    industryMyth:
      "Email marketing is dead — Instagram is enough.",
    reframe:
      "Instagram organic reach for restaurants is now ~3% of followers. Email open-rate for restaurant lists averages 28% (Klaviyo benchmark) and drives 5–8× the revenue per send vs. paid social.",
    economicImpact:
      "A 2,000-subscriber list with one weekly campaign typically books $4–6K/mo in repeat covers.",
    applicableTriggers: ["HIRING_MARKETING", "RATING_DROP"],
    applicableSubNiches: ["fnb-fine-dining", "fnb-cafe-bakery", "fnb-bar-club"],
    basePriority: 50,
  },
  {
    industryMyth:
      "We tried QR menus during COVID — diners hated them.",
    reframe:
      "Diners didn't hate QR menus, they hated unstyled PDF menus. Modern menu engineering (high-quality photography, allergen tags, prix fixe upsells) drives a 6–12% AOV lift and reduces server-error returns.",
    economicImpact:
      "+$3 AOV × 60 covers/night × 6 nights = +$1,080/week in incremental revenue.",
    applicableTriggers: ["MENU_REDESIGN_SIGNAL", "RATING_DROP"],
    applicableSubNiches: ["fnb-fine-dining", "fnb-cafe-bakery", "fnb-hotel-fnb"],
    basePriority: 55,
  },
  {
    industryMyth:
      "Multi-location reporting can wait — we'll figure it out at 5 stores.",
    reframe:
      "Operators who delay multi-location BI to store #5 typically lose 6 months of comparable-sales visibility. The right time to standardize KPIs (covers/labor%, food cost%, NPS) is between locations 2 and 3 — when correcting course is cheap.",
    economicImpact:
      "Group-level food-cost variance of just 1.5pt across 3 locations = ~$45K/year leak.",
    applicableTriggers: ["NEW_LOCATION_OPENING", "CHAIN_EXPANSION"],
    applicableSubNiches: ["fnb-fine-dining", "fnb-bar-club", "fnb-hotel-fnb"],
    basePriority: 70,
  },
  {
    industryMyth:
      "AI-driven dynamic pricing is for airlines, not restaurants.",
    reframe:
      "Demand-based pricing on prix fixe and high-margin add-ons (wine pairings, chef's tasting upgrade) is now standard at top 50 US restaurants. The lift is 8–14% revenue at zero incremental customer acquisition cost.",
    economicImpact:
      "10% lift on $80K monthly bar revenue = $8K/mo with no extra labor.",
    applicableTriggers: ["RATING_DROP", "MENU_REDESIGN_SIGNAL"],
    applicableSubNiches: ["fnb-fine-dining", "fnb-bar-club"],
    basePriority: 45,
  },
  {
    industryMyth:
      "Tipping reform doesn't affect retention — staff understand the math.",
    reframe:
      "Across 2024 wage-reform analyses, restaurants that paired tip-credit elimination with transparent service-charge dashboards retained tipped staff 41% longer. The dashboard is the unlock, not the policy.",
    economicImpact:
      "Replacing one $22/hr server costs ~$4K in recruit + train + ramp.",
    applicableTriggers: ["HIRING_OPS"],
    applicableSubNiches: ["fnb-fine-dining", "fnb-hotel-fnb"],
    basePriority: 40,
  },
  {
    industryMyth:
      "Loyalty programs don't work — diners just want a free coffee.",
    reframe:
      "Tier-based loyalty with surprise-and-delight (anniversary table, early access to wine dinners) drives 2.8× the repeat-spend of stamp-card programs. The format matters more than the discount.",
    economicImpact:
      "Top 20% loyalty members spend ~$1,200/year vs $310 for casual diners.",
    applicableTriggers: ["RATING_DROP"],
    applicableSubNiches: ["fnb-fine-dining", "fnb-cafe-bakery", "fnb-bar-club"],
    basePriority: 50,
  },
  {
    industryMyth:
      "Our Google Business Profile is fine — we don't need an SEO strategy.",
    reframe:
      "GBP-only restaurants compete in a single search lane. Restaurants that publish weekly menu / event posts and respond to every review within 24h see a +18% Maps impression lift in 90 days.",
    economicImpact:
      "+18% impressions ≈ +12% direction-requests ≈ +6% covers/month.",
    applicableTriggers: ["RATING_DROP", "BAD_SERVICE_REVIEWS"],
    applicableSubNiches: [
      "fnb-fine-dining",
      "fnb-bar-club",
      "fnb-cafe-bakery",
      "fnb-hotel-fnb",
      "fnb-food-truck",
    ],
    basePriority: 60,
  },
];

const DEFAULT_RESTAURANT_TECH_ICP = {
  name: "Restaurant Tech default ICP",
  // Sub-niche weights — fine-dining first, then bar/club, hotel F&B,
  // cafe/bakery. Values are multiplicative weights (0..1) used by
  // ICP_SCORER. See `src/lib/sdr-brain/icp-scorer.ts`.
  industryWeights: { RESTAURANT_TECH: 1.0 },
  subNicheWeights: {
    "fnb-fine-dining": 1.0,
    "fnb-bar-club": 0.9,
    "fnb-hotel-fnb": 0.85,
    "fnb-cafe-bakery": 0.7,
    "fnb-ghost-kitchen": 0.5,
    "fnb-food-truck": 0.4,
  },
  priceLevelMin: 2,
  priceLevelMax: 4,
  minReviewCount: 30,
  minRating: 3.8,
  digitalMaturityFloor: 30,
  highValueSignals: [
    "hasBookingSystem",
    "hasOnlineOrdering",
    "multiLocation",
    "hasInstagram",
    "hasGoogleBusinessProfile",
  ],
  negativeSignals: ["temporarilyClosed", "noWebsite"],
  locationFit: {
    countriesAllowed: ["US", "GB", "AE", "TR"],
    metroPopulationMin: 100_000,
  },
  meddpiccRequiredFields: [
    "metric.monthlyRevenue",
    "metric.locationsCount",
    "economicBuyer.name",
    "decisionProcess.timeline",
  ],
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const conn = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!conn) {
    throw new Error("DIRECT_URL or DATABASE_URL must be set in env");
  }
  const client = new Client({ connectionString: conn });
  await client.connect();

  try {
    const ws = await resolveWorkspace(client, args);
    console.log(
      `\n[seed-restaurant-tech] Target workspace: ${ws.id} (${ws.slug ?? "no-slug"}, niche=${ws.niche})`,
    );

    if (ws.niche !== "RESTAURANT_TECH") {
      console.warn(
        `  WARNING: workspace niche is ${ws.niche}, not RESTAURANT_TECH. The seed will still run but the matcher may downrank these insights for non-fnb leads.`,
      );
    }

    const icpId = await upsertIcp(client, ws.id);
    console.log(`  + IdealCustomerProfile id=${icpId}`);

    let inserted = 0;
    let updated = 0;
    for (const seed of RESTAURANT_TECH_INSIGHTS) {
      const result = await upsertCommercialInsight(client, ws.id, seed);
      if (result === "INSERTED") inserted += 1;
      else updated += 1;
    }

    console.log(
      `\n[seed-restaurant-tech] Done. Insights inserted=${inserted}, updated=${updated}, total=${RESTAURANT_TECH_INSIGHTS.length}`,
    );
  } finally {
    await client.end();
  }
}

interface ResolvedWorkspace {
  id: string;
  slug: string | null;
  niche: string;
}

async function resolveWorkspace(client: Client, args: Args): Promise<ResolvedWorkspace> {
  const where = args.workspaceId
    ? { sql: 'WHERE id = $1', params: [args.workspaceId] }
    : { sql: 'WHERE slug = $1', params: [args.workspaceSlug] };

  const res = await client.query<{ id: string; slug: string | null; niche: string }>(
    `SELECT id, slug, niche FROM workspaces ${where.sql} LIMIT 1`,
    where.params,
  );
  if (res.rows.length === 0) {
    throw new Error(
      `No workspace found for ${JSON.stringify(args)}. Create the workspace first.`,
    );
  }
  return res.rows[0];
}

async function upsertIcp(client: Client, workspaceId: string): Promise<string> {
  // INSERT ... ON CONFLICT (workspace_id) DO UPDATE — the schema has
  // `@unique workspaceId` on IdealCustomerProfile.
  const sql = `
    INSERT INTO ideal_customer_profiles (
      id, workspace_id, name,
      industry_weights, sub_niche_weights,
      price_level_min, price_level_max,
      min_review_count, min_rating,
      digital_maturity_floor,
      high_value_signals, negative_signals,
      location_fit, meddpicc_required_fields,
      version, created_at, updated_at
    ) VALUES (
      $1, $2, $3,
      $4::jsonb, $5::jsonb,
      $6, $7, $8, $9, $10,
      $11, $12,
      $13::jsonb, $14,
      1, NOW(), NOW()
    )
    ON CONFLICT (workspace_id) DO UPDATE SET
      name = EXCLUDED.name,
      industry_weights = EXCLUDED.industry_weights,
      sub_niche_weights = EXCLUDED.sub_niche_weights,
      price_level_min = EXCLUDED.price_level_min,
      price_level_max = EXCLUDED.price_level_max,
      min_review_count = EXCLUDED.min_review_count,
      min_rating = EXCLUDED.min_rating,
      digital_maturity_floor = EXCLUDED.digital_maturity_floor,
      high_value_signals = EXCLUDED.high_value_signals,
      negative_signals = EXCLUDED.negative_signals,
      location_fit = EXCLUDED.location_fit,
      meddpicc_required_fields = EXCLUDED.meddpicc_required_fields,
      version = ideal_customer_profiles.version + 1,
      updated_at = NOW()
    RETURNING id;
  `;
  const id = `icp_${workspaceId.slice(0, 12)}`;
  const res = await client.query<{ id: string }>(sql, [
    id,
    workspaceId,
    DEFAULT_RESTAURANT_TECH_ICP.name,
    JSON.stringify(DEFAULT_RESTAURANT_TECH_ICP.industryWeights),
    JSON.stringify(DEFAULT_RESTAURANT_TECH_ICP.subNicheWeights),
    DEFAULT_RESTAURANT_TECH_ICP.priceLevelMin,
    DEFAULT_RESTAURANT_TECH_ICP.priceLevelMax,
    DEFAULT_RESTAURANT_TECH_ICP.minReviewCount,
    DEFAULT_RESTAURANT_TECH_ICP.minRating,
    DEFAULT_RESTAURANT_TECH_ICP.digitalMaturityFloor,
    DEFAULT_RESTAURANT_TECH_ICP.highValueSignals,
    DEFAULT_RESTAURANT_TECH_ICP.negativeSignals,
    JSON.stringify(DEFAULT_RESTAURANT_TECH_ICP.locationFit),
    DEFAULT_RESTAURANT_TECH_ICP.meddpiccRequiredFields,
  ]);
  return res.rows[0].id;
}

async function upsertCommercialInsight(
  client: Client,
  workspaceId: string,
  seed: InsightSeed,
): Promise<"INSERTED" | "UPDATED"> {
  // Natural key is (workspaceId, industryMyth) since the schema has no
  // unique index on (workspaceId, industryMyth). Manual lookup +
  // create/update.
  const existing = await client.query<{ id: string }>(
    `SELECT id FROM commercial_insights
     WHERE workspace_id = $1 AND industry_myth = $2
     LIMIT 1`,
    [workspaceId, seed.industryMyth],
  );

  if (existing.rows.length > 0) {
    await client.query(
      `UPDATE commercial_insights SET
         reframe = $1,
         economic_impact = $2,
         contrarian_observation = $3,
         applicable_triggers = $4::"LeadTriggerType"[],
         applicable_sub_niches = $5,
         base_priority = $6
       WHERE id = $7`,
      [
        seed.reframe,
        seed.economicImpact,
        seed.contrarianObservation ?? null,
        seed.applicableTriggers,
        seed.applicableSubNiches,
        seed.basePriority,
        existing.rows[0].id,
      ],
    );
    return "UPDATED";
  }

  await client.query(
    `INSERT INTO commercial_insights (
       id, workspace_id, niche_slug, industry_myth, reframe,
       economic_impact, contrarian_observation,
       applicable_triggers, applicable_sub_niches,
       base_priority, created_at
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, $7,
       $8::"LeadTriggerType"[], $9,
       $10, NOW()
     )`,
    [
      `ci_${cryptoRandomSuffix()}`,
      workspaceId,
      "fnb",
      seed.industryMyth,
      seed.reframe,
      seed.economicImpact,
      seed.contrarianObservation ?? null,
      seed.applicableTriggers,
      seed.applicableSubNiches,
      seed.basePriority,
    ],
  );
  return "INSERTED";
}

function cryptoRandomSuffix(): string {
  return Math.random().toString(36).slice(2, 12);
}

main().catch((err) => {
  console.error("[seed-restaurant-tech] FAILED:", err);
  process.exit(1);
});
