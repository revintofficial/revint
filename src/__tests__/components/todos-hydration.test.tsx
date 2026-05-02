/**
 * M17 regression - hydration mismatch on /app/todos. The previous
 * page.tsx used `useState(getSavedColumns)` with a function that
 * read localStorage synchronously at first render. SSR returns
 * `["Team"]` and the first CSR render returned the persisted set,
 * triggering a React hydration warning + a brief column flash.
 *
 * The fix initializes both renders to `["Team"]` and rehydrates
 * from localStorage in a useEffect after first paint. This test
 * scans the source for the right shape because exercising the
 * full page through RTL would pull in Radix dialogs / drag-drop /
 * Prisma stubs and slow CI without testing the hydration shape
 * itself.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(
  resolve(process.cwd(), "src/app/app/todos/page.tsx"),
  "utf-8",
);

describe("M17 - todos page uses SSR-stable initial state", () => {
  it("does NOT pass a localStorage-reading initializer to useState directly", () => {
    // The old anti-pattern was `useState(getSavedColumns)` (passing
    // the function REF, which React invokes on first render). We
    // assert the initial state literal is the SSR-stable default,
    // not a function that touches localStorage.
    expect(SRC).toMatch(/useState<string\[\]>\(\s*\[\s*\.\.\.DEFAULT_COLUMNS\s*\]\s*\)/);
  });

  it("rehydrates from localStorage in a useEffect", () => {
    // The mount-effect wrapper is the right shape: it runs only on
    // the client after first paint, so SSR HTML and first CSR
    // render produce identical output.
    expect(SRC).toMatch(/readPersistedColumns\(\)/);
    expect(SRC).toMatch(/setHydrated\(true\)/);
  });

  it("gates the localStorage WRITE on hydrated flag", () => {
    // Without this gate the write effect fires on first commit
    // BEFORE the read effect has rehydrated, overwriting the
    // saved value with the default placeholder. The `hydrated`
    // gate fixes that race.
    expect(SRC).toMatch(/if\s*\(\s*!hydrated\s*\)\s*return/);
  });

  it("validates the localStorage payload shape before applying it", () => {
    // Defense against tampered localStorage values: parse must
    // succeed AND yield a string[]. Anything else falls back to
    // the SSR default, not crashes the page.
    expect(SRC).toMatch(/Array\.isArray\(parsed\)/);
    expect(SRC).toMatch(/typeof c === "string"/);
  });
});
