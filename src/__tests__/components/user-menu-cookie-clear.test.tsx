/**
 * M15 regression - the signOut() handler in user-menu.tsx used to
 * call only `supabase.auth.signOut()` + `router.push("/login")`.
 * That clears the auth session cookie but NOT our active-workspace
 * pointer (`leadac_active_workspace_id`). The next user to sign in
 * on the same browser would land in the previous user's workspace
 * until they explicitly switched.
 *
 * Verifying via the `signOut` function alone keeps the test small:
 * mocking the entire UserMenu component (which depends on Radix
 * dropdown + supabase client + lucide icons + plan-badge styling)
 * adds noise without exercising the contract. We assert two things:
 *   1. Source-presence - user-menu.tsx writes a Max-Age=0 cookie for
 *      `leadac_active_workspace_id` in the signOut handler.
 *   2. Behavior - the same `document.cookie = "...Max-Age=0..."` line
 *      actually clears the cookie when executed against a jsdom
 *      document.
 */
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

afterEach(() => {
  // Reset the cookie to a known seeded value between tests so we
  // don't accidentally rely on prior-test state.
  document.cookie =
    "leadac_active_workspace_id=ws_seeded; Max-Age=86400; path=/; SameSite=Lax";
});

describe("M15 - signOut clears active-workspace cookie", () => {
  it("user-menu.tsx writes a Max-Age=0 cookie for leadac_active_workspace_id", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/components/app/user-menu.tsx"),
      "utf-8",
    );
    expect(src).toMatch(
      /document\.cookie\s*=\s*["'`]\s*leadac_active_workspace_id\s*=[^"'`]*Max-Age\s*=\s*0/i,
    );
  });

  it("user-menu.tsx specifies path=/ on the clearing cookie (mirrors the set call)", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/components/app/user-menu.tsx"),
      "utf-8",
    );
    // The browser only matches a Set-Cookie deletion against a
    // (name,path,domain) triple. Without `path=/` the deletion
    // wouldn't apply to the original / -scoped cookie.
    const clearLine = src
      .split("\n")
      .find((l) => l.includes("Max-Age=0") && l.includes("leadac_active_workspace_id"));
    expect(clearLine, "no clearing line found").toBeDefined();
    expect(clearLine).toMatch(/path\s*=\s*\//i);
  });

  it("the cookie clearing pattern actually removes the cookie under jsdom", () => {
    document.cookie =
      "leadac_active_workspace_id=ws_before; Max-Age=86400; path=/; SameSite=Lax";
    expect(document.cookie).toContain("leadac_active_workspace_id=ws_before");

    // Same string the production code uses.
    document.cookie =
      "leadac_active_workspace_id=; Max-Age=0; path=/; SameSite=Lax";
    expect(document.cookie).not.toContain("leadac_active_workspace_id=ws_before");
  });
});
