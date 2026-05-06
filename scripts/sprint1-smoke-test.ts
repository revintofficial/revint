/**
 * Sprint 1 (Round 2 Hafta 1 Hotfix) smoke-test runner.
 *
 * The plan's §1 lists 12 acceptance criteria that 12/12 Round 2 lead
 * fixtures must pass before the deploy is signed off. This script
 * runs the matching unit assertions against synthetic fixtures so
 * operators get a single pass/fail signal in <10 seconds, BEFORE
 * burning a staging deploy slot to manually click through real leads.
 *
 * What it does
 * ------------
 * Each row in `CRITERIA` corresponds to one §1 bullet. The check
 * function imports the production code (no stubs) and asserts the
 * expected behavior. Synthetic fixtures stand in for the 12 Camden
 * leads — they exercise the code paths the bug report flagged
 * without needing live DB access. A human operator still owns the
 * final UI sign-off on staging; this just protects against deploying
 * a regression where the unit fix never reached the bundled code.
 *
 * What it DOES NOT cover
 * ----------------------
 * - End-to-end UI rendering (Tier badge actually disappears in the
 *   browser): owned by the operator's staging click-through.
 * - Real Gemini output quality (LLM hard-rails): we test the
 *   post-LLM filter, not the model itself.
 * - Production telemetry counters: enable Datadog dashboards after
 *   deploy as listed in the Definition of Done.
 *
 * Usage:
 *   npx tsx scripts/sprint1-smoke-test.ts
 *
 * Exit code 0 = all green, 1 = any failure. Suitable for CI gating.
 */
import {
  humanizePrimaryType,
  isSocialPlatformDefaultMeta,
  normalizeWedgeKey,
  SUPPRESS_WHEN_NO_WEBSITE,
} from "../src/lib/labels";
import { extractFeatures } from "../src/lib/extractor";
import { detectExpiredOrParked } from "../src/lib/crawler";
import { filterReviewKpis } from "../src/lib/review-analysis/kpi-filter";
import type { ReviewKpi } from "../src/lib/prompts/review-analysis-prompt";
import { detectSocialPlatform } from "../src/lib/agent-workers/opener-writer";
import {
  QuotaExceededError,
  PerLeadDailyCapExceededError,
  ApifyBudgetExceededError,
  PlanTooLowError,
} from "../src/lib/agent-workers/quota";
import { PermanentError, isRetryable } from "../src/lib/agent-workers/errors";

interface Result {
  id: string;
  label: string;
  pass: boolean;
  detail?: string;
}

const results: Result[] = [];

function check(id: string, label: string, fn: () => void | Promise<void>) {
  return async () => {
    try {
      await fn();
      results.push({ id, label, pass: true });
    } catch (err) {
      results.push({
        id,
        label,
        pass: false,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  };
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

// §1.1 — Tier ↔ Package çelişkisi yok (Tier badge UI'dan kalkmış).
const checkTierBadge = check("§1.1", "Tier badge removed from UI", async () => {
  // PR-W1.A removed the `<Badge>Tier:…</Badge>` block from
  // `src/app/app/leads/[id]/page.tsx`. We can't import a JSX file
  // directly in a Node script, so grep the source for the literal
  // we removed.
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const src = await fs.readFile(
    path.resolve("src/app/app/leads/[id]/page.tsx"),
    "utf8",
  );
  assert(
    !/Badge[^>]*>\s*Tier/.test(src),
    "Tier badge JSX still present in lead detail page",
  );
});

// §1.2 — "No WhatsApp ×2" / "No Website + Weak website" duplication yok.
const checkWedgeDedup = check(
  "§1.2",
  "Wedge dedupe + NO_WEBSITE suppression",
  () => {
    // The HeroPriorityStrip dedupes via `normalizeWedgeKey` and
    // suppresses `SUPPRESS_WHEN_NO_WEBSITE` when NO_WEBSITE is in the
    // reasonCodes. Validate both at the util level.
    const a = normalizeWedgeKey("No Website");
    const b = normalizeWedgeKey("no_website");
    const c = normalizeWedgeKey("NO_WEBSITE");
    assert(a === b && b === c, "normalizeWedgeKey is not idempotent");
    assert(
      SUPPRESS_WHEN_NO_WEBSITE.has("weak_seo"),
      "OQ.4 suppression list missing weak_seo",
    );
    assert(
      SUPPRESS_WHEN_NO_WEBSITE.has("high_rating_weak_site"),
      "OQ.4 suppression list missing high_rating_weak_site",
    );
  },
);

// §1.3 — coffee_shop / food_store / acai_shop snake_case kalmamış.
const checkPrimaryType = check(
  "§1.3",
  "primaryType humanized (coffee_shop → Coffee Shop, food_store → Grocery Store)",
  () => {
    assert(
      humanizePrimaryType("coffee_shop") === "Coffee Shop",
      "coffee_shop not humanized",
    );
    // food_store overrides to "Grocery Store" per the registry; we
    // accept either format as long as it's not raw snake_case.
    const food = humanizePrimaryType("food_store");
    assert(!food.includes("_"), `food_store still snake_case: ${food}`);
    const acai = humanizePrimaryType("acai_shop");
    assert(!acai.includes("_"), `acai_shop still snake_case: ${acai}`);
  },
);

// §1.4 — IG / FB default meta description maskelenmiş.
const checkIgDefaultMeta = check(
  "§1.4",
  "Instagram/Facebook default meta description masked",
  () => {
    assert(
      isSocialPlatformDefaultMeta(
        "Create an account or log in to Instagram. A simple, fun & creative way to capture, edit & share photos…",
      ),
      "Instagram default not detected",
    );
    assert(
      isSocialPlatformDefaultMeta("Log into Facebook to start sharing and connecting with your friends, family, and people you know."),
      "Facebook default not detected",
    );
    assert(
      !isSocialPlatformDefaultMeta(
        "Camden's best espresso bar — open 7am till late.",
      ),
      "False positive on real meta description",
    );
  },
);

// §1.5 — LUMI Camden hasOnlineReservation=true (false-pos) sıfır.
const checkReservationSignal = check(
  "§1.5",
  "hasOnlineReservation requires hostname/JSON-LD, not body text",
  () => {
    // Body text mentioning a competitor reservation provider must
    // NOT flip the flag — this was the LUMI Camden false-positive.
    const html = `<html><body>We considered using OpenTable but ended up
      taking reservations by phone. Call us at 020-1234-5678.</body></html>`;
    const f = extractFeatures(html, "https://lumi-camden.example");
    assert(
      f.hasOnlineReservation === false,
      "hasOnlineReservation false-positives on body text",
    );
  },
);

// §1.6 — E-Menu detectedMenuTool false-pos sıfır.
const checkEmenuRemoved = check(
  "§1.6",
  "QR_MENU detection no longer matches 'e-menu' substring",
  () => {
    const html = `<html><body>
      <p>The menu changes weekly — call to enquire.</p>
    </body></html>`;
    const f = extractFeatures(html, "https://glasscamden.example");
    assert(
      f.detectedMenuTool !== "E-Menu",
      `false E-Menu match: ${String(f.detectedMenuTool)}`,
    );
  },
);

// §1.7 — Fable and Falcon WEBSITE_EXPIRED set + opener "sitenizi inceledim" demiyor.
const checkExpiredDetection = check(
  "§1.7",
  "Squarespace expired domain → detectExpiredOrParked=true",
  () => {
    const exp = detectExpiredOrParked(
      "Squarespace - Website Expired",
      "https://www.fableandfalcon.example",
      "<html><body>This account has been suspended.</body></html>",
    );
    assert(exp === true, "Squarespace expired title not detected");
    const ok = detectExpiredOrParked(
      "Coffee shop expired its menu",
      "https://example.com",
      "<html><body>We rotate beans seasonally.</body></html>",
    );
    assert(
      ok === false,
      "regex too greedy — matched legitimate 'expired' wording",
    );
  },
);

// §1.8 — S.O.S 14-review "Expensive 100%" patlamaları sıfır (pool floor=3).
const checkPoolFloor = check(
  "§1.8",
  "Negative pool < 3 → weaknessKpis = []",
  () => {
    const kpis: ReviewKpi[] = [
      {
        label: "expensive",
        count: 1,
        percent: 100,
        examples: ["The prices are way too high here.", "It's not worth the money."],
      },
    ];
    const corpusTokens =
      "the prices are way too high here it s not worth the money".split(/\s+/);
    const out = filterReviewKpis(kpis, /* poolCount */ 1, corpusTokens, {
      kind: "weakness",
    });
    assert(
      out.kpis.length === 0,
      `expected pool floor to drop the KPI, got ${out.kpis.length}`,
    );
    assert(
      out.stats.droppedForPoolFloor === 1,
      "stats.droppedForPoolFloor not bumped",
    );
  },
);

// §1.9 — YBA "automatic tip" label-echo, S.O.S "£7.10" 1-token, The Drip "Rude Staff & Toilet Access" fusion sıfır.
const checkLlmGates = check(
  "§1.9",
  "Label fusion + tiny example + label echo gates fire",
  () => {
    const corpusTokens = (
      "rude staff and toilet access is awful price seven ten is steep but ok " +
      "the automatic tip request annoyed me automatic tip request " +
      "annoyed everyone we saw automatic tip request being asked of " +
      "every customer in the queue every single visit"
    ).split(/\s+/);
    const kpis: ReviewKpi[] = [
      {
        label: "Rude Staff & Toilet Access",
        count: 3,
        percent: 50,
        examples: [
          "rude staff and toilet access is awful",
          "rude staff and toilet access is awful again",
        ],
      },
      {
        label: "Pricing",
        count: 3,
        percent: 50,
        examples: ["£7.10", "way too expensive"],
      },
      {
        label: "automatic tip request",
        count: 3,
        percent: 50,
        examples: ["Automatic tip request.", "automatic tip request"],
      },
    ];
    const out = filterReviewKpis(kpis, /* poolCount */ 6, corpusTokens, {
      kind: "weakness",
    });
    // All three should fail one of the gates; we just need none to
    // survive the filter.
    assert(
      out.kpis.length === 0,
      `expected 0 surviving KPIs, got ${out.kpis.length}: ${out.kpis.map((k) => k.label).join(", ")}`,
    );
  },
);

// §1.10 — One Shot Coffee chain/social branş çakışması yok.
const checkSocialPlatformDetect = check(
  "§1.10",
  "detectSocialPlatform returns the right key for each platform",
  () => {
    assert(
      detectSocialPlatform("https://www.facebook.com/oneshotcoffee") === "facebook",
      "facebook URL not detected",
    );
    assert(
      detectSocialPlatform("https://instagram.com/oneshotcoffee") === "instagram",
      "instagram URL not detected",
    );
    assert(
      detectSocialPlatform("https://oneshot-coffee.com") === null,
      "real website misclassified as social",
    );
  },
);

// §1.11 — "44/50000 quota exceeded" sıfır; per-lead cap doğru error class'ı.
const checkQuotaTaxonomy = check(
  "§1.11",
  "Quota errors are PermanentError + retain status=402",
  () => {
    const errors = [
      new QuotaExceededError(44, 50000, "REVIEW_ANALYST"),
      new PerLeadDailyCapExceededError("lead-1", 50, 50),
      new ApifyBudgetExceededError(500, 500),
      new PlanTooLowError("APIFY_GMAPS_DEEP", "PRO"),
    ];
    for (const err of errors) {
      assert(
        err instanceof PermanentError,
        `${err.name} not extending PermanentError`,
      );
      assert(isRetryable(err) === false, `${err.name} marked retryable`);
      assert(err.status === 402, `${err.name} status !== 402`);
    }
  },
);

const checks = [
  checkTierBadge,
  checkWedgeDedup,
  checkPrimaryType,
  checkIgDefaultMeta,
  checkReservationSignal,
  checkEmenuRemoved,
  checkExpiredDetection,
  checkPoolFloor,
  checkLlmGates,
  checkSocialPlatformDetect,
  checkQuotaTaxonomy,
];

async function main() {
  console.log("\n=== Sprint 1 smoke test (§1 acceptance criteria) ===\n");

  for (const c of checks) await c();

  let pass = 0;
  let fail = 0;
  for (const r of results) {
    const tag = r.pass ? "PASS" : "FAIL";
    console.log(`[${tag}] ${r.id.padEnd(6)} ${r.label}`);
    if (!r.pass) {
      console.log(`        ${r.detail}`);
      fail++;
    } else {
      pass++;
    }
  }

  console.log(`\n${pass}/${results.length} acceptance criteria satisfied.`);
  if (fail > 0) {
    console.error(
      "\nSmoke test FAILED. Block deploy and triage above before merging.",
    );
    process.exit(1);
  }
  console.log(
    "\nCode-level smoke green. Operator: proceed with manual staging click-through on the 12 Round 2 leads.",
  );
}

main().catch((err) => {
  console.error("smoke test runner crashed:", err);
  process.exit(2);
});
