/**
 * M18 regression - same hydration mismatch as M17 but on
 * /app/leads. The previous initializer read localStorage inside
 * the useRef + useState initial values, so the SSR-rendered HTML
 * (no localStorage) and first CSR render (with persisted filters)
 * produced different DOM trees. Beyond the hydration warning, the
 * brief filter-state flicker fired a duplicate /api/leads request
 * on every visit.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(
  resolve(process.cwd(), "src/app/app/leads/page.tsx"),
  "utf-8",
);

describe("M18 - leads page uses SSR-stable initial filter state", () => {
  it("buildInitialFilters is invoked WITHOUT the localStorage payload on first render", () => {
    // The fix passes `null` (or omits the saved-state arg) so
    // initial filters are built only from URL params (which ARE
    // available on the server via searchParams).
    expect(SRC).toMatch(
      /buildInitialFilters\([\s\S]*?new URLSearchParams\([\s\S]*?\),[\s\S]*?null,?\s*\)/,
    );
  });

  it("density state initializes to a literal default on first render", () => {
    // The old version called getSavedState inside a useState
    // initializer function. The new version uses a string literal
    // and rehydrates in useEffect.
    expect(SRC).toMatch(/useState<"comfortable" \| "compact">\(\s*\n?\s*"comfortable"/);
  });

  it("rehydrates from localStorage in a useEffect", () => {
    expect(SRC).toMatch(/getSavedState<Partial<LeadsFilters>>\(STORAGE_KEY\)/);
    expect(SRC).toMatch(/setFilters\(\(prev\) => \(\{ \.\.\.prev, \.\.\.saved \}\)\)/);
  });

  it("URL params win over local storage when both are present", () => {
    // Shared deep-link should override local memory; without this
    // a user clicking a colleague's link would see the colleague's
    // filters mixed with their own.
    expect(SRC).toMatch(/sp\.size === 0/);
  });
});
