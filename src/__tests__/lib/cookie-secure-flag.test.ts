/**
 * M16 regression - non-Supabase cookies (`leadac_active_workspace_id`,
 * `NEXT_LOCALE`) used to be set without the `Secure` attribute, so a
 * man-in-the-middle on a downgraded HTTP request could read them and
 * pivot CSRF attempts to the right tenant. The fix marks them
 * `secure: process.env.NODE_ENV === "production"` everywhere they're
 * set.
 *
 * This test scans the cookie-setting code paths for the right shape
 * rather than wiring up a full Next.js request cycle. Three checks:
 *   1. workspaces/switch sets Secure conditionally on production.
 *   2. workspaces (POST create) sets Secure conditionally on production.
 *   3. proxy.ts NEXT_LOCALE sets Secure conditionally on production.
 *   4. oauth/callback + oauth/start already had Secure (regression catch).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SECURE_PROD_RE = /secure\s*:\s*process\.env\.NODE_ENV\s*===\s*["']production["']/;

const TARGETS = [
  "src/app/api/workspaces/switch/route.ts",
  "src/app/api/workspaces/route.ts",
  "src/proxy.ts",
  "src/app/api/oauth/callback/route.ts",
  "src/app/api/oauth/start/[provider]/route.ts",
];

interface SetCall {
  file: string;
  text: string;
}

/**
 * Extract every `cookieStore.set(...)` / `cookies().set(...)` /
 * `res.cookies.set(...)` call from a source file with its full
 * argument list (including the options bag) so we can assert on the
 * `secure:` flag.
 */
function findSetCalls(file: string): SetCall[] {
  const src = readFileSync(resolve(process.cwd(), file), "utf-8");
  const re = /(?:cookieStore|cookies\(\)|res\.cookies)\.set\s*\(/g;
  const out: SetCall[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    let depth = 0;
    let i = m.index + m[0].length - 1;
    for (; i < src.length; i++) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")") {
        depth--;
        if (depth === 0) break;
      }
    }
    out.push({ file, text: src.slice(m.index, i + 1) });
  }
  return out;
}

describe("M16 - non-Supabase Set-Cookie sites carry Secure in production", () => {
  for (const file of TARGETS) {
    it(`${file} marks every cookie set with secure: NODE_ENV === production`, () => {
      const calls = findSetCalls(file);
      expect(
        calls.length,
        `expected at least 1 cookie set in ${file}`,
      ).toBeGreaterThan(0);
      for (const call of calls) {
        expect(
          call.text,
          `${file}: missing secure: process.env.NODE_ENV === "production" in:\n${call.text}`,
        ).toMatch(SECURE_PROD_RE);
      }
    });
  }

  it("no Set-Cookie call site in any target file omits the secure key", () => {
    // Defense-in-depth: catches a future PR that adds a new cookie
    // call but forgets the secure flag entirely.
    const offenders: string[] = [];
    for (const file of TARGETS) {
      for (const call of findSetCalls(file)) {
        if (!/secure\s*:/.test(call.text)) {
          offenders.push(`${file}: ${call.text.replace(/\s+/g, " ").slice(0, 160)}`);
        }
      }
    }
    expect(
      offenders,
      `Found cookie set calls without secure flag:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
