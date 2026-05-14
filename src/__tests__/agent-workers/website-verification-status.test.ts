/**
 * Truth Layer v1 / T-E — verification status tests.
 *
 * Covers:
 *   1. The canonical `deriveWebsiteVerificationStatus` decision rule
 *      from `@/lib/sdr-brain/contracts` (every fan-out branch).
 *   2. The website-auditor side-effect: when the orchestrator
 *      finishes, the worker writes `Lead.websiteVerificationStatus`
 *      via `prisma.lead.updateMany` (workspace-scoped per
 *      multi-tenant rules) and emits `truth.website.verify_started`
 *      + `truth.website.verify_completed` log records that T-H
 *      Observability can hoist into PostHog.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deriveWebsiteVerificationStatus,
  type WebsiteVerificationSourceCheck,
} from "@/lib/sdr-brain/contracts";

const { prismaMock, loggerInfoMock } = vi.hoisted(() => ({
  prismaMock: {
    lead: {
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    websiteAudit: { upsert: vi.fn().mockResolvedValue({}) },
  },
  loggerInfoMock: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/logger", () => ({
  logger: {
    info: loggerInfoMock,
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { __test } from "@/lib/agent-workers/website-auditor";
import type { WebsiteMultiVerifyRunners } from "@/lib/agent-workers/website-multi-verify";

function check(
  name: WebsiteVerificationSourceCheck["name"],
  result: WebsiteVerificationSourceCheck["result"],
  url: string | null = null,
): WebsiteVerificationSourceCheck {
  return { name, result, url, checkedAt: new Date().toISOString() };
}

function makeRunners(
  bing: WebsiteVerificationSourceCheck,
  ch: WebsiteVerificationSourceCheck,
  ig: WebsiteVerificationSourceCheck,
): WebsiteMultiVerifyRunners {
  return {
    bingBrandSearch: vi.fn().mockResolvedValue(bing),
    companiesHouse: vi.fn().mockResolvedValue(ch),
    instagramBio: vi.fn().mockResolvedValue(ig),
  };
}

type LeadArg = Parameters<typeof __test.runWebsiteVerification>[0];

function makeLead(overrides: Partial<LeadArg> = {}): LeadArg {
  return {
    id: "lead_greenwich",
    workspaceId: "ws_truth",
    businessName: "Greenwich Morning",
    formattedAddress: "12 Greenwich High Rd, London SE10 8JL, United Kingdom",
    websiteUrl: null,
    placeId: "p1",
    borough: null,
    phone: null,
    hasWebsite: false,
    rating: 4.1,
    reviewCount: 397,
    businessStatus: "OPERATIONAL",
    primaryType: "cafe",
    sourceQuery: null,
    sourceLat: null,
    sourceLng: null,
    crawlStatus: "PENDING",
    analyzeStatus: "PENDING",
    reviewAnalysisStatus: "PENDING",
    websiteAudit: null,
    salesOpportunity: null,
    reviewAnalysis: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as LeadArg;
}

describe("deriveWebsiteVerificationStatus — contract decision rule", () => {
  it("zero sources → uncertain", () => {
    expect(deriveWebsiteVerificationStatus([])).toBe("uncertain");
  });

  it("1 negative source only → uncertain", () => {
    expect(
      deriveWebsiteVerificationStatus([check("bing_brand_search", "absent")]),
    ).toBe("uncertain");
  });

  it("2 negatives → uncertain", () => {
    expect(
      deriveWebsiteVerificationStatus([
        check("bing_brand_search", "absent"),
        check("instagram_bio", "absent"),
      ]),
    ).toBe("uncertain");
  });

  it("3 negatives → confirmed_absent", () => {
    expect(
      deriveWebsiteVerificationStatus([
        check("bing_brand_search", "absent"),
        check("companies_house", "absent"),
        check("instagram_bio", "absent"),
      ]),
    ).toBe("confirmed_absent");
  });

  it("any positive → confirmed_present (overrides negatives)", () => {
    expect(
      deriveWebsiteVerificationStatus([
        check("bing_brand_search", "absent"),
        check("companies_house", "absent"),
        check("instagram_bio", "present", "https://x.test"),
      ]),
    ).toBe("confirmed_present");
  });

  it("errors do not count toward negatives", () => {
    // 2 absent + 2 errors → uncertain (need ≥3 absents for confirmed_absent).
    expect(
      deriveWebsiteVerificationStatus([
        check("bing_brand_search", "absent"),
        check("companies_house", "error"),
        check("instagram_bio", "absent"),
        check("google_business_field", "error"),
      ]),
    ).toBe("uncertain");
  });
});

describe("runWebsiteVerification — Lead column write", () => {
  beforeEach(() => {
    prismaMock.lead.updateMany.mockClear().mockResolvedValue({ count: 1 });
    loggerInfoMock.mockClear();
  });

  it("writes confirmed_absent and emits the verify_completed event for Greenwich (3 negative sources)", async () => {
    const lead = makeLead();
    const runners = makeRunners(
      check("bing_brand_search", "absent"),
      check("companies_house", "absent"),
      check("instagram_bio", "absent"),
    );

    const result = await __test.runWebsiteVerification(lead, runners);

    expect(result.status).toBe("confirmed_absent");
    expect(prismaMock.lead.updateMany).toHaveBeenCalledTimes(1);
    const args = prismaMock.lead.updateMany.mock.calls[0][0] as {
      where: { id: string; workspaceId: string };
      data: { websiteVerificationStatus: string };
    };
    expect(args.where).toEqual({
      id: "lead_greenwich",
      workspaceId: "ws_truth",
    });
    expect(args.data.websiteVerificationStatus).toBe("confirmed_absent");

    const startedEvents = loggerInfoMock.mock.calls.filter((c) => {
      const payload = c[1] as { event?: string } | undefined;
      return payload?.event === "truth.website.verify_started";
    });
    const completedEvents = loggerInfoMock.mock.calls.filter((c) => {
      const payload = c[1] as { event?: string } | undefined;
      return payload?.event === "truth.website.verify_completed";
    });
    expect(startedEvents).toHaveLength(1);
    expect(completedEvents).toHaveLength(1);
    expect(completedEvents[0][1]).toMatchObject({
      event: "truth.website.verify_completed",
      leadId: "lead_greenwich",
      workspaceId: "ws_truth",
      status: "confirmed_absent",
      sourcesChecked: 3,
      sourcesPositive: 0,
      sourcesNegative: 3,
    });
  });

  it("writes confirmed_present (and short-circuits) when lead.websiteUrl is set", async () => {
    const lead = makeLead({
      id: "lead_casa",
      workspaceId: "ws_truth",
      businessName: "Casa Polanco",
      formattedAddress:
        "Av. Presidente Masaryk 421, Polanco, 11550 Ciudad de México, México",
      websiteUrl: "https://casapolanco.example",
    } as Partial<LeadArg>);

    const bing = vi.fn();
    const ch = vi.fn();
    const ig = vi.fn();
    const runners: WebsiteMultiVerifyRunners = {
      bingBrandSearch: bing,
      companiesHouse: ch,
      instagramBio: ig,
    };

    const result = await __test.runWebsiteVerification(lead, runners);

    expect(result.status).toBe("confirmed_present");
    expect(bing).not.toHaveBeenCalled();
    expect(ch).not.toHaveBeenCalled();
    expect(ig).not.toHaveBeenCalled();

    expect(prismaMock.lead.updateMany).toHaveBeenCalledTimes(1);
    const args = prismaMock.lead.updateMany.mock.calls[0][0] as {
      where: { id: string; workspaceId: string };
      data: { websiteVerificationStatus: string };
    };
    expect(args.where).toEqual({
      id: "lead_casa",
      workspaceId: "ws_truth",
    });
    expect(args.data.websiteVerificationStatus).toBe("confirmed_present");

    const completedEvents = loggerInfoMock.mock.calls.filter((c) => {
      const payload = c[1] as { event?: string } | undefined;
      return payload?.event === "truth.website.verify_completed";
    });
    expect(completedEvents).toHaveLength(1);
    expect(completedEvents[0][1]).toMatchObject({
      status: "confirmed_present",
      sourcesChecked: 1,
      sourcesPositive: 1,
      sourcesNegative: 0,
    });
  });

  it("writes uncertain when 2 sources return absent + 1 errors", async () => {
    const lead = makeLead();
    const runners = makeRunners(
      check("bing_brand_search", "absent"),
      check("companies_house", "error"),
      check("instagram_bio", "absent"),
    );

    const result = await __test.runWebsiteVerification(lead, runners);

    expect(result.status).toBe("uncertain");
    const args = prismaMock.lead.updateMany.mock.calls[0][0] as {
      data: { websiteVerificationStatus: string };
    };
    expect(args.data.websiteVerificationStatus).toBe("uncertain");
  });

  it("scopes the column write by workspaceId — never updates by id alone", async () => {
    const lead = makeLead({
      id: "lead_x",
      workspaceId: "ws_x",
    } as Partial<LeadArg>);
    const runners = makeRunners(
      check("bing_brand_search", "absent"),
      check("companies_house", "absent"),
      check("instagram_bio", "absent"),
    );

    await __test.runWebsiteVerification(lead, runners);

    expect(prismaMock.lead.update).not.toHaveBeenCalled();
    expect(prismaMock.lead.updateMany).toHaveBeenCalledTimes(1);
    const where = prismaMock.lead.updateMany.mock.calls[0][0]
      .where as { workspaceId: string };
    expect(where.workspaceId).toBe("ws_x");
  });
});
