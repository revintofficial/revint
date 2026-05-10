/**
 * Phase 0 e2e smoke — Lead Detail flag flip.
 *
 * Goal:
 *   - Open a known seeded lead with `?v=2` and assert the
 *     "Lead Detail v2 — coming soon" placeholder is visible.
 *   - Open the same lead with `?v=1` and assert the legacy 5-tab
 *     `<TabsList>` is in the DOM.
 *
 * STATUS — TODO before un-skipping:
 *   1. Add `@playwright/test` to devDependencies. The repo currently
 *      has the `playwright` runtime (used by capture scripts) but no
 *      `@playwright/test` runner, no `playwright.config.ts`, and no
 *      e2e CI step. Adding those is out of scope for Phase 0 PR #1.
 *   2. Wire a deterministic seeded login + a known lead id. The
 *      product has no existing e2e harness today; the v2 PR should
 *      not be blocked on standing one up. Once `npm run db:seed:e2e`
 *      (or equivalent) lands and a sign-in helper exists, swap the
 *      `test.skip` calls below for `test(...)` and replace the
 *      `<SEEDED_LEAD_ID>` placeholder with the real id.
 *
 * The bodies are written out so that un-skipping is a one-line edit
 * per case rather than a re-author.
 */

// Local stub so this file type-checks without `@playwright/test`
// installed. Swap to `import { test, expect } from "@playwright/test";`
// once the dep + config land. The runtime never executes — vitest
// only matches `*.test.ts`, and there is no Playwright runner
// configured to discover `*.spec.ts` yet.
const test = {
  skip: (_name: string, _fn: () => Promise<void> | void): void => {
    void _name;
    void _fn;
  },
};

test.skip("v=2 shows the Lead Detail v2 placeholder", async () => {
  // const lead = "<SEEDED_LEAD_ID>";
  // await page.goto(`/app/leads/${lead}?v=2`);
  // await expect(page.getByTestId("lead-detail-v2-placeholder")).toBeVisible();
  // await expect(page.getByText(/lead detail v2 — coming soon/i)).toBeVisible();
});

test.skip("v=1 shows the legacy 5-tab surface", async () => {
  // const lead = "<SEEDED_LEAD_ID>";
  // await page.goto(`/app/leads/${lead}?v=1`);
  // // Legacy marker: the 5-tab Radix TabsList rendered by
  // // `LegacyLeadDetailClient`. Triggers: overview / website /
  // // workers / reviews / outreach.
  // await expect(page.getByRole("tab", { name: /overview/i })).toBeVisible();
  // await expect(page.getByRole("tab", { name: /website/i })).toBeVisible();
  // await expect(page.getByRole("tab", { name: /workers/i })).toBeVisible();
  // await expect(page.getByRole("tab", { name: /reviews/i })).toBeVisible();
  // await expect(page.getByRole("tab", { name: /outreach/i })).toBeVisible();
});

test.skip("cookie toggle flips the surface without a hard reload", async () => {
  // Documented in PLAN §9 "Suggested first PR" — manual smoke #3.
  // Implementation: set the `leadac_lead_detail_v2` cookie via the
  // browser's CDP session, then re-fetch the page and assert the
  // placeholder/legacy switch.
});
