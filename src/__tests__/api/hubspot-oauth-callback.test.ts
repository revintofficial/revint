// @vitest-environment node

/**
 * HubSpot OAuth callback regression.
 *
 * The HubSpot app can redirect to the apex host (`revint.dev`) even when
 * the connect flow started from `app.revint.dev`. Old sessions may only
 * have an app-host Supabase cookie, so the callback must not depend on
 * `requireWorkspaceAdminApi()` before it can finish the OAuth exchange.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  cookieSet: vi.fn(),
  workspaceMemberFindFirst: vi.fn(),
  crmConnectionUpsert: vi.fn(),
  crmConnectionUpdate: vi.fn(),
  exchangeHubspotCode: vi.fn(),
  getHubspotTokenInfo: vi.fn(),
  ensureRevintProperties: vi.fn(),
  listDealPipelines: vi.fn(),
  getPlaybook: vi.fn(),
  buildDefaultStageMapping: vi.fn(),
  planMeetsMinimum: vi.fn(),
  getOptionalUser: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: mocks.cookieGet,
    set: mocks.cookieSet,
  })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workspaceMember: {
      findFirst: (...args: unknown[]) => mocks.workspaceMemberFindFirst(...args),
    },
    crmConnection: {
      upsert: (...args: unknown[]) => mocks.crmConnectionUpsert(...args),
      update: (...args: unknown[]) => mocks.crmConnectionUpdate(...args),
    },
  },
}));

vi.mock("@/lib/integrations/hubspot/oauth", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/integrations/hubspot/oauth")>(
      "@/lib/integrations/hubspot/oauth",
    );
  return {
    ...actual,
    exchangeHubspotCode: (...args: unknown[]) => mocks.exchangeHubspotCode(...args),
    getHubspotTokenInfo: (...args: unknown[]) => mocks.getHubspotTokenInfo(...args),
  };
});

vi.mock("@/lib/integrations/crypto", () => ({
  encryptSecret: (value: string) => `enc:${value}`,
}));

vi.mock("@/lib/integrations/hubspot/client", () => ({
  HubspotClient: vi.fn().mockImplementation(() => ({
    listDealPipelines: (...args: unknown[]) => mocks.listDealPipelines(...args),
  })),
}));

vi.mock("@/lib/integrations/hubspot/properties", () => ({
  ensureRevintProperties: (...args: unknown[]) => mocks.ensureRevintProperties(...args),
}));

vi.mock("@/lib/integrations/hubspot/field-map", () => ({
  buildDefaultStageMapping: (...args: unknown[]) =>
    mocks.buildDefaultStageMapping(...args),
}));

vi.mock("@/lib/playbook/resolve", () => ({
  getPlaybook: (...args: unknown[]) => mocks.getPlaybook(...args),
}));

vi.mock("@/lib/agent-workers/registry", () => ({
  planMeetsMinimum: (...args: unknown[]) => mocks.planMeetsMinimum(...args),
}));

vi.mock("@/lib/auth", () => ({
  getOptionalUser: (...args: unknown[]) => mocks.getOptionalUser(...args),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/api-errors", () => ({
  internalError: (_scope: string, err: unknown) =>
    NextResponse.json(
      { error: "Internal error", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    ),
}));

import { GET } from "@/app/api/integrations/hubspot/callback/route";
import { signHubspotOAuthState } from "@/lib/integrations/hubspot/oauth";

const WORKSPACE_ID = "ws_hubspot_oauth";
const USER_ID = "00000000-0000-0000-0000-000000000123";

function signedState(returnTo = "/app/settings/integrations") {
  return signHubspotOAuthState({
    workspaceId: WORKSPACE_ID,
    userId: USER_ID,
    nonce: "nonce_123",
    returnTo,
  });
}

function requestFor(state: string) {
  return new Request(
    `https://revint.dev/api/integrations/hubspot/callback?code=code_123&state=${encodeURIComponent(
      state,
    )}`,
  );
}

describe("GET /api/integrations/hubspot/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("HUBSPOT_CLIENT_SECRET", "hubspot_test_secret");

    mocks.cookieGet.mockImplementation((name: string) => {
      if (name === "hubspot_oauth_state") return { name, value: "nonce_123" };
      if (name === "hubspot_pkce_verifier") return { name, value: "verifier_123" };
      return undefined;
    });
    mocks.workspaceMemberFindFirst.mockResolvedValue({
      workspaceId: WORKSPACE_ID,
      userId: USER_ID,
      role: "OWNER",
      workspace: { id: WORKSPACE_ID, plan: "PRO" },
      user: { id: USER_ID, email: "owner@example.com" },
    });
    mocks.planMeetsMinimum.mockReturnValue(true);
    // Default: no Revint session on the (apex) callback host — exercises
    // the legacy cross-host path where the callback runs without a session.
    mocks.getOptionalUser.mockResolvedValue(null);
    mocks.exchangeHubspotCode.mockResolvedValue({
      access_token: "access_123",
      refresh_token: "refresh_123",
      expires_in: 3600,
      token_type: "bearer",
    });
    mocks.getHubspotTokenInfo.mockResolvedValue({
      hub_id: 123456,
      scopes: ["oauth", "crm.objects.contacts.read"],
    });
    mocks.crmConnectionUpsert.mockResolvedValue({
      id: "crm_conn_123",
      workspaceId: WORKSPACE_ID,
      portalId: "123456",
    });
    mocks.ensureRevintProperties.mockResolvedValue({ created: [], skipped: [] });
    mocks.listDealPipelines.mockResolvedValue({ results: [] });
    mocks.crmConnectionUpdate.mockResolvedValue({});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("completes OAuth from signed state without requiring a Supabase session on the callback host", async () => {
    const res = await GET(requestFor(signedState()));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "https://revint.dev/app/settings/integrations?hubspot_connected=1",
    );
    expect(mocks.workspaceMemberFindFirst).toHaveBeenCalledWith({
      where: { workspaceId: WORKSPACE_ID, userId: USER_ID },
      include: { workspace: true, user: true },
    });
    expect(mocks.crmConnectionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId_provider: {
            workspaceId: WORKSPACE_ID,
            provider: "HUBSPOT",
          },
        },
      }),
    );
    // The single-use nonce/verifier cookies must be cleared on the
    // returned redirect response itself (a hand-built NextResponse.redirect
    // does not inherit mutations made to the next/headers cookie store).
    expect(res.cookies.get("hubspot_oauth_state")?.value).toBe("");
    expect(res.cookies.get("hubspot_pkce_verifier")?.value).toBe("");
  });

  it("rejects when a Revint session on the callback host does not match the signed state user (confused-deputy)", async () => {
    mocks.getOptionalUser.mockResolvedValue({
      user: { id: "00000000-0000-0000-0000-0000000000ff", email: "victim@example.com" },
      workspaceId: "ws_victim",
      role: "OWNER",
    });

    const res = await GET(requestFor(signedState()));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "https://revint.dev/app/settings/integrations?hubspot_error=session_mismatch",
    );
    expect(mocks.exchangeHubspotCode).not.toHaveBeenCalled();
    expect(mocks.crmConnectionUpsert).not.toHaveBeenCalled();
  });

  it("redirects back with a HubSpot error flag when the nonce cookie is missing", async () => {
    mocks.cookieGet.mockImplementation((name: string) => {
      if (name === "hubspot_pkce_verifier") return { name, value: "verifier_123" };
      return undefined;
    });

    const res = await GET(requestFor(signedState("/app/onboarding?step=6")));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "https://revint.dev/app/onboarding?step=6&hubspot_error=state_nonce_mismatch",
    );
    expect(mocks.exchangeHubspotCode).not.toHaveBeenCalled();
    expect(mocks.crmConnectionUpsert).not.toHaveBeenCalled();
  });
});
