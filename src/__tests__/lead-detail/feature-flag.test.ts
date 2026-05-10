/**
 * Phase 0 unit — feature-flag resolver precedence.
 *
 * Resolution order asserted: URL > cookie > workspace allow-list > env default.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isLeadDetailV2Enabled,
  LEAD_DETAIL_V2_COOKIE,
  type FeatureFlagCookieStore,
  type FeatureFlagSearchParams,
} from "@/lib/feature-flags";

const SESSION = { workspaceId: "ws_phase0_seed_1" } as const;

function cookieStore(value: string | undefined): FeatureFlagCookieStore {
  return {
    get: (name) =>
      name === LEAD_DETAIL_V2_COOKIE && value !== undefined
        ? { value }
        : undefined,
  };
}

const EMPTY_COOKIES = cookieStore(undefined);
const EMPTY_SP: FeatureFlagSearchParams = {};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isLeadDetailV2Enabled — precedence", () => {
  it("URL ?v=2 forces ON even if cookie/env say OFF", () => {
    vi.stubEnv("LEAD_DETAIL_V2_DEFAULT", "off");
    const result = isLeadDetailV2Enabled(
      SESSION,
      { v: "2" },
      cookieStore("off"),
    );
    expect(result).toBe(true);
  });

  it("URL ?v=1 forces OFF even if cookie/env say ON", () => {
    vi.stubEnv("LEAD_DETAIL_V2_DEFAULT", "on");
    const result = isLeadDetailV2Enabled(
      SESSION,
      { v: "1" },
      cookieStore("on"),
    );
    expect(result).toBe(false);
  });

  it("cookie=on wins when URL is silent and env says off", () => {
    vi.stubEnv("LEAD_DETAIL_V2_DEFAULT", "off");
    const result = isLeadDetailV2Enabled(SESSION, EMPTY_SP, cookieStore("on"));
    expect(result).toBe(true);
  });

  it("cookie=off wins when URL is silent and env says on", () => {
    vi.stubEnv("LEAD_DETAIL_V2_DEFAULT", "on");
    const result = isLeadDetailV2Enabled(SESSION, EMPTY_SP, cookieStore("off"));
    expect(result).toBe(false);
  });

  it("workspace allow-list flips ON when URL+cookie are silent", () => {
    vi.stubEnv("LEAD_DETAIL_V2_DEFAULT", "off");
    vi.stubEnv("LEAD_DETAIL_V2_WORKSPACES", `${SESSION.workspaceId},ws_other`);
    const result = isLeadDetailV2Enabled(SESSION, EMPTY_SP, EMPTY_COOKIES);
    expect(result).toBe(true);
  });

  it("workspace allow-list does NOT flip OFF — only env default can deny when allow-list misses", () => {
    vi.stubEnv("LEAD_DETAIL_V2_DEFAULT", "on");
    vi.stubEnv("LEAD_DETAIL_V2_WORKSPACES", "ws_someone_else");
    const result = isLeadDetailV2Enabled(SESSION, EMPTY_SP, EMPTY_COOKIES);
    expect(result).toBe(true);
  });

  it("env default applies when nothing else matches", () => {
    vi.stubEnv("LEAD_DETAIL_V2_DEFAULT", "on");
    const result = isLeadDetailV2Enabled(SESSION, EMPTY_SP, EMPTY_COOKIES);
    expect(result).toBe(true);
  });

  it("default-off when no flag at any layer is set", () => {
    vi.stubEnv("LEAD_DETAIL_V2_DEFAULT", "");
    vi.stubEnv("LEAD_DETAIL_V2_WORKSPACES", "");
    const result = isLeadDetailV2Enabled(SESSION, EMPTY_SP, EMPTY_COOKIES);
    expect(result).toBe(false);
  });

  it("ignores unrelated cookies", () => {
    vi.stubEnv("LEAD_DETAIL_V2_DEFAULT", "off");
    const cookies: FeatureFlagCookieStore = {
      get: (name) =>
        name === "some_other_cookie" ? { value: "on" } : undefined,
    };
    const result = isLeadDetailV2Enabled(SESSION, EMPTY_SP, cookies);
    expect(result).toBe(false);
  });

  it("array-shaped searchParams (Next.js multi-value) picks the first", () => {
    vi.stubEnv("LEAD_DETAIL_V2_DEFAULT", "off");
    const result = isLeadDetailV2Enabled(
      SESSION,
      { v: ["2", "1"] },
      EMPTY_COOKIES,
    );
    expect(result).toBe(true);
  });

  it("malformed cookie value falls through to next tier", () => {
    vi.stubEnv("LEAD_DETAIL_V2_DEFAULT", "on");
    const result = isLeadDetailV2Enabled(
      SESSION,
      EMPTY_SP,
      cookieStore("maybe"),
    );
    expect(result).toBe(true);
  });
});
