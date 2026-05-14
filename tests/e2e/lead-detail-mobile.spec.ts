/**
 * V-K (Phase 5 Mobile Pass) e2e — Lead Detail v2 on phone emulation.
 *
 * The master plan §3 V-K DoD requires:
 *   - iPhone 14 Pro emulation: sticky CTA visible at viewport bottom,
 *     doesn't cover the queue strip.
 *   - Pixel 7 emulation: bottom sheet swipe-to-dismiss works (ESC/
 *     overlay-click fallback today — see "Known limitations" below),
 *     focus trap engages.
 *   - Voice note FAB has a 44px+ touch target with an accessible name.
 *   - Lead detail page on mobile: no horizontal scroll, content sits
 *     inside safe-area insets.
 *   - A11y: tab order is logical, screen reader announces the sticky
 *     CTA on focus.
 *
 * STATUS — un-executed.
 *
 * The repo has the `playwright` runtime (used by `scripts/capture/*`
 * for the video pipeline) but no `@playwright/test` runner installed,
 * no `playwright.config.ts`, and no CI job. The companion specs
 * (`lead-detail-flag.spec.ts`, `lead-detail-v2-blocks.spec.ts`) ship
 * with the same `test.skip` stub pattern so the test bodies live in
 * code review while the harness is being stood up.
 *
 * When the harness lands:
 *   1. `npm i -D @playwright/test`.
 *   2. Drop in a `playwright.config.ts` with a `webServer` block
 *      pointing at `npm run dev`.
 *   3. Replace the local `test`/`expect`/`devices` stubs at the top of
 *      this file with `import { test, expect, devices } from
 *      "@playwright/test";` and remove the `.skip` suffix.
 *   4. Seed a known PRO workspace + a REPLIED lead via
 *      `npm run db:seed:e2e` (TODO — Phase 0 deferred this) and wire a
 *      `sign-in` helper. Then swap `<SEEDED_LEAD_ID>` below for the
 *      real id.
 *
 * Known limitations covered by separate manual QA:
 *   - Swipe-to-dismiss on the BottomSheet is intentionally deferred to
 *     the `vaul` integration (see `src/components/ui/bottom-sheet.tsx`
 *     header comment). Today we ship ESC + overlay-click + close-X
 *     dismissal, all asserted here.
 *   - MediaRecorder is not available in headless Chromium without the
 *     `--use-fake-ui-for-media-stream` flag + a microphone permission
 *     grant. The voice-note FAB upload path is therefore a unit-only
 *     concern (mocked `fetch`); the e2e here only verifies presence,
 *     touch-target size, and a11y plumbing.
 */

// Stubbed surfaces so the file type-checks and parses today even
// without `@playwright/test` installed. Match the pattern used by
// `lead-detail-flag.spec.ts` and `lead-detail-v2-blocks.spec.ts`.
type StubBoundingBox = { x: number; y: number; width: number; height: number };
type StubLocator = {
  click: (opts?: unknown) => Promise<void>;
  waitFor: (opts?: unknown) => Promise<void>;
  boundingBox: () => Promise<StubBoundingBox | null>;
  evaluate: <T = unknown>(fn: (el: Element) => T) => Promise<T>;
  getAttribute: (name: string) => Promise<string | null>;
  isVisible: () => Promise<boolean>;
  focus: () => Promise<void>;
};
type StubPage = {
  goto: (url: string, opts?: unknown) => Promise<void>;
  viewportSize: () => { width: number; height: number };
  evaluate: <T = unknown>(fn: () => T) => Promise<T>;
  keyboard: { press: (key: string) => Promise<void> };
  locator: (selector: string) => StubLocator;
  getByTestId: (id: string) => StubLocator;
  getByRole: (
    role: string,
    opts?: { name?: string | RegExp },
  ) => StubLocator;
  mouse: { click: (x: number, y: number) => Promise<void> };
};
const devices = {
  "iPhone 14 Pro": {
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  "Pixel 7": {
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
  },
} as const;
const test = {
  skip: (
    _name: string,
    _fn: (args: { page: StubPage }) => Promise<void> | void,
  ): void => {
    void _name;
    void _fn;
  },
  describe: (_name: string, _fn: () => void): void => {
    void _name;
    _fn();
  },
};
const expect = (value: unknown): {
  toBeVisible: () => Promise<void>;
  toBeFocused: () => Promise<void>;
  toHaveAttribute: (name: string, value: string | RegExp) => Promise<void>;
  toBeLessThanOrEqual: (n: number) => void;
  toBeGreaterThanOrEqual: (n: number) => void;
  toBe: (other: unknown) => void;
} => {
  void value;
  return {
    toBeVisible: async () => {},
    toBeFocused: async () => {},
    toHaveAttribute: async () => {},
    toBeLessThanOrEqual: () => {},
    toBeGreaterThanOrEqual: () => {},
    toBe: () => {},
  };
};

const LEAD = "<SEEDED_LEAD_ID>";

test.describe("Lead Detail v2 — iPhone 14 Pro (V-K Phase 5)", () => {
  test.skip("sticky CTA is visible above the queue strip and doesn't cover it", async ({ page }) => {
    // Setup (per real Playwright): test.use({ ...devices["iPhone 14 Pro"] })
    await page.goto(`/app/leads/${LEAD}?v=2`, { waitUntil: "networkidle" });

    const cta = page.getByTestId("mobile-sticky-cta");
    const queue = page.locator("[data-queue-strip-wrapper]");

    await expect(cta).toBeVisible();
    await expect(queue).toBeVisible();

    const ctaBox = await cta.boundingBox();
    const queueBox = await queue.boundingBox();
    if (!ctaBox || !queueBox) throw new Error("missing layout box");

    const vh = page.viewportSize().height;
    // CTA bottom edge is within the viewport.
    expect(ctaBox.y + ctaBox.height).toBeLessThanOrEqual(vh);
    // CTA sits ABOVE the queue strip (smaller `y` = higher on screen).
    expect(ctaBox.y + ctaBox.height).toBeLessThanOrEqual(queueBox.y + 1);
    // Queue strip is still fully visible — nothing covers it.
    expect(queueBox.y + queueBox.height).toBeLessThanOrEqual(vh);
  });

  test.skip("voice-note FAB has a 44px+ touch target and accessible name", async ({ page }) => {
    await page.goto(`/app/leads/${LEAD}?v=2`, { waitUntil: "networkidle" });

    const fab = page.getByTestId("voice-note-fab-mobile");
    await expect(fab).toBeVisible();

    const box = await fab.boundingBox();
    if (!box) throw new Error("missing FAB box");
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);

    await expect(fab).toHaveAttribute("aria-label", /record voice note/i);
  });

  test.skip("voice-note FAB does NOT overlap the MobileStickyCTA bar", async ({ page }) => {
    await page.goto(`/app/leads/${LEAD}?v=2`, { waitUntil: "networkidle" });

    const fab = page.getByTestId("voice-note-fab-mobile");
    const cta = page.getByTestId("mobile-sticky-cta");

    const fabBox = await fab.boundingBox();
    const ctaBox = await cta.boundingBox();
    if (!fabBox || !ctaBox) throw new Error("missing layout box");

    // The FAB's BOTTOM edge sits ABOVE the sticky CTA's TOP edge.
    // (`y` grows downward; "above" = lower y value.)
    expect(fabBox.y + fabBox.height).toBeLessThanOrEqual(ctaBox.y + 1);
  });

  test.skip("the page has no horizontal scroll on iPhone 14 Pro", async ({ page }) => {
    await page.goto(`/app/leads/${LEAD}?v=2`, { waitUntil: "networkidle" });

    const overflowed = await page.evaluate(() => {
      return document.documentElement.scrollWidth >
        document.documentElement.clientWidth;
    });
    expect(overflowed).toBe(false);
  });

  test.skip("Tab moves focus through dial → voice → more in document order", async ({ page }) => {
    await page.goto(`/app/leads/${LEAD}?v=2`, { waitUntil: "networkidle" });

    // Focus the dial entry first, then Tab through the bar.
    await page.getByTestId("mobile-cta-dial").focus();
    await expect(page.getByTestId("mobile-cta-dial")).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(page.getByTestId("mobile-cta-voice-note")).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(page.getByTestId("mobile-cta-more")).toBeFocused();
  });

  test.skip("the sticky CTA region carries an accessible name SR can announce", async ({ page }) => {
    await page.goto(`/app/leads/${LEAD}?v=2`, { waitUntil: "networkidle" });

    const region = page.getByRole("region", { name: /lead quick actions/i });
    await expect(region).toBeVisible();
  });
});

test.describe("Lead Detail v2 — Pixel 7 (V-K Phase 5)", () => {
  test.skip("'More' opens a bottom sheet that traps focus on a Pixel 7 viewport", async ({ page }) => {
    // Setup: test.use({ ...devices["Pixel 7"] })
    await page.goto(`/app/leads/${LEAD}?v=2`, { waitUntil: "networkidle" });

    await page.getByTestId("mobile-cta-more").click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Radix Dialog moves focus into the sheet on open — assert the
    // title node receives it (the BottomSheet forwards focus there
    // via `onOpenAutoFocus`).
    const title = page.locator('[data-sheet-title]');
    await expect(title).toBeFocused();

    // The trigger button reflects the open state for AT.
    const trigger = page.getByTestId("mobile-cta-more");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  test.skip("ESC dismisses the bottom sheet (swipe-to-dismiss fallback)", async ({ page }) => {
    await page.goto(`/app/leads/${LEAD}?v=2`, { waitUntil: "networkidle" });

    await page.getByTestId("mobile-cta-more").click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.keyboard.press("Escape");

    // Dialog is gone from the DOM (portal unmounts).
    const stillThere = await page
      .getByRole("dialog")
      .isVisible()
      .catch(() => false);
    expect(stillThere).toBe(false);

    // And the trigger's aria-expanded snaps back to false.
    await expect(page.getByTestId("mobile-cta-more")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  test.skip("backdrop tap dismisses the bottom sheet", async ({ page }) => {
    await page.goto(`/app/leads/${LEAD}?v=2`, { waitUntil: "networkidle" });

    await page.getByTestId("mobile-cta-more").click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Tap the top-left corner of the viewport — that's the overlay,
    // not the sheet (which sits at the bottom).
    await page.mouse.click(10, 10);

    const stillThere = await page
      .getByRole("dialog")
      .isVisible()
      .catch(() => false);
    expect(stillThere).toBe(false);
  });

  test.skip("close (X) button inside the sheet dismisses it and restores focus to the trigger", async ({ page }) => {
    await page.goto(`/app/leads/${LEAD}?v=2`, { waitUntil: "networkidle" });

    await page.getByTestId("mobile-cta-more").click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByRole("button", { name: /close/i }).click();

    const stillThere = await page
      .getByRole("dialog")
      .isVisible()
      .catch(() => false);
    expect(stillThere).toBe(false);

    // Radix returns focus to the trigger that opened the sheet.
    await expect(page.getByTestId("mobile-cta-more")).toBeFocused();
  });

  test.skip("content respects safe-area-inset-bottom on Pixel 7", async ({ page }) => {
    await page.goto(`/app/leads/${LEAD}?v=2`, { waitUntil: "networkidle" });

    // The sticky CTA's wrapper applies `padding-bottom:
    // env(safe-area-inset-bottom)`. We can't directly query the env()
    // value, but we can assert the inline style declares it — that
    // way a regression that drops the env() reference (e.g. someone
    // accidentally setting `padding-bottom: 0`) fails the test.
    const paddingBottom = await page
      .getByTestId("mobile-sticky-cta")
      .evaluate((el) => (el as HTMLElement).style.paddingBottom);
    expect(paddingBottom).toBe("env(safe-area-inset-bottom, 0px)");
  });
});

test.describe("Lead Detail v2 — desktop guard (V-K Phase 5)", () => {
  test.skip("MobileStickyCTA + VoiceNoteFAB are NOT in the viewport at md+ widths", async ({ page }) => {
    // No emulation override → default desktop 1280×720.
    await page.goto(`/app/leads/${LEAD}?v=2`, { waitUntil: "networkidle" });

    const ctaVisible = await page
      .getByTestId("mobile-sticky-cta")
      .isVisible()
      .catch(() => false);
    const fabVisible = await page
      .getByTestId("voice-note-fab-mobile")
      .isVisible()
      .catch(() => false);

    expect(ctaVisible).toBe(false);
    expect(fabVisible).toBe(false);
  });
});

// Type-stub forwards so the local stub `test` / `expect` / `devices`
// don't generate "declared but not read" lints on TS strict.
export const __vk_phase5_devices_used = devices;
