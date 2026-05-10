/**
 * Phase 2 e2e visual-regression stub — SPIN board + MEDDPICC checklist.
 *
 * The Phase 2 spec calls for a Playwright snapshot at desktop AND
 * iPhone 14 Pro of the SPIN board (4-column desktop, 4-section
 * accordion mobile) and the MEDDPICC 7-row checklist. The runner
 * isn't installed yet (Phase 0 deferred this), so we ship the spec
 * file as `test.skip` stubs with TODOs — same pattern as
 * `lead-detail-flag.spec.ts`.
 *
 * STATUS — TODO before un-skipping:
 *   1. Install `@playwright/test`, add a `playwright.config.ts`, and
 *      wire `npm run e2e` + a CI job.
 *   2. Standardize a seeded fixture: a PRO workspace + a REPLIED lead
 *      with `DiscoveryItem` rows for every SPIN bucket and a populated
 *      `DealQualification` rollup.
 *   3. Snapshot baselines need to be checked in once the renderer
 *      and design tokens stabilize.
 *
 * The bodies are written out so that un-skipping is a one-line edit
 * per case rather than a re-author.
 */

const test = {
  skip: (_name: string, _fn: () => Promise<void> | void): void => {
    void _name;
    void _fn;
  },
};

test.skip("SPIN board renders four columns on desktop with items grouped per kind", async () => {
  // const lead = "<SEEDED_REPLIED_LEAD_ID>";
  // await page.setViewportSize({ width: 1440, height: 900 });
  // await page.goto(`/app/leads/${lead}?v=2`);
  // await page.getByTestId("spin-board").waitFor();
  // await expect(page).toHaveScreenshot("spin-board-desktop.png");
});

test.skip("SPIN board collapses to a 4-section accordion on iPhone 14 Pro", async () => {
  // const lead = "<SEEDED_REPLIED_LEAD_ID>";
  // await page.setViewportSize({ width: 393, height: 852 });
  // await page.goto(`/app/leads/${lead}?v=2`);
  // await page.getByTestId("spin-board-mobile").waitFor();
  // await expect(page).toHaveScreenshot("spin-board-mobile.png");
});

test.skip("MEDDPICC checklist renders 7 rows with status icons + evidence chips", async () => {
  // const lead = "<SEEDED_REPLIED_LEAD_ID>";
  // await page.goto(`/app/leads/${lead}?v=2`);
  // await page.getByTestId("meddpicc-checklist").waitFor();
  // await expect(page).toHaveScreenshot("meddpicc-checklist.png");
});

test.skip("FREE workspace renders the locked stub for MEDDPICC + SPIN", async () => {
  // await page.goto(`/app/leads/<FREE_WORKSPACE_LEAD>?v=2`);
  // await expect(page.getByTestId("plan-locked-block")).toBeVisible();
  // await expect(page.getByTestId("meddpicc-checklist")).not.toBeVisible();
});

test.skip("Predicted-vs-real objection diff buckets render with status icons", async () => {
  // const lead = "<SEEDED_REPLIED_LEAD_ID>";
  // await page.goto(`/app/leads/${lead}?v=2`);
  // await page.getByTestId("predicted-vs-real").waitFor();
  // await expect(page).toHaveScreenshot("objection-diff.png");
});
