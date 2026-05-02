/**
 * M19 regression - fetch effects in offer-form, dashboard, and
 * copilot-drawer used to call setState unconditionally inside the
 * .then chain, leaving an in-flight request alive when the
 * component unmounted. React 19 logs a "setState on unmounted
 * component" warning AND the dangling request kept its socket
 * open for tens of seconds.
 *
 * The fix is the cancel-on-unmount pattern:
 *   const ctrl = new AbortController();
 *   let cancelled = false;
 *   fetch(url, { signal: ctrl.signal }).then((r) => { if (cancelled) return; ... });
 *   return () => { cancelled = true; ctrl.abort(); };
 *
 * Source-presence test (functional RTL would need stubs for
 * Supabase + Toast + the entire form schema; the contract here is
 * the pattern, not the form behavior).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const TARGETS = [
  "src/components/app/offer-form.tsx",
  "src/app/app/dashboard/page.tsx",
  "src/components/app/copilot-drawer.tsx",
];

describe("M19 - fetch effects implement cancel-on-unmount", () => {
  for (const file of TARGETS) {
    const src = readFileSync(resolve(process.cwd(), file), "utf-8");

    it(`${file} creates an AbortController inside the effect`, () => {
      expect(src).toMatch(/new AbortController\(\)/);
    });

    it(`${file} passes the signal to fetch`, () => {
      expect(src).toMatch(/signal:\s*ctrl\.signal/);
    });

    it(`${file} declares a cancelled flag`, () => {
      expect(src).toMatch(/let cancelled = false/);
    });

    it(`${file} returns a cleanup function from the effect that aborts`, () => {
      expect(src).toMatch(/return\s*\(\)\s*=>\s*\{[\s\S]{0,200}?cancelled\s*=\s*true[\s\S]{0,200}?ctrl\.abort\(\)/);
    });

    it(`${file} guards setState calls with the cancelled flag`, () => {
      expect(src).toMatch(/if\s*\(\s*(?:opts\?\.isCancelled\(\)|isCancelled\(\)|cancelled)\s*\)\s*return/);
    });

    it(`${file} silently swallows AbortError (expected on unmount)`, () => {
      expect(src).toMatch(/AbortError/);
    });
  }
});
