import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ build: vi.fn(), enqueue: vi.fn() }));

vi.mock("@/lib/integrations/hubspot/writeback", () => ({
  buildRevintProperties: mocks.build,
  enqueueCrmWriteback: mocks.enqueue,
}));

import { runHubspotBackfill, verifyRevintProperties } from "@/lib/integrations/hubspot/verify";
import { REVINT_PROPERTY_NAMES } from "@/lib/integrations/hubspot/properties";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.build.mockResolvedValue({ properties: { revint_sales_confidence: "70" } });
  mocks.enqueue.mockResolvedValue({ status: "SUCCESS", targets: ["company:c1"] });
});

describe("verifyRevintProperties", () => {
  it("reports which of the 14 properties exist and are filled per object", async () => {
    const client = {
      listProperties: vi.fn(async (o: string) => ({
        results: o === "companies" ? REVINT_PROPERTY_NAMES.map((name) => ({ name })) : [],
      })),
      getCompany: vi.fn(async () => ({
        id: "c1",
        properties: { revint_sales_confidence: "70", revint_lead_temperature: "", revint_recommended_angle: "QR" },
      })),
      getContact: vi.fn(),
    };
    const res = await verifyRevintProperties(client as never, { companies: "c1" });
    const companies = res.find((r) => r.objectType === "companies")!;
    const contacts = res.find((r) => r.objectType === "contacts")!;
    expect(companies.existsCount).toBe(14);
    expect(companies.filledCount).toBe(2);
    expect(companies.properties.find((p) => p.name === "revint_lead_temperature")!.filled).toBe(false);
    expect(contacts.existsCount).toBe(0);
    expect(contacts.recordId).toBeNull();
    expect(client.getContact).not.toHaveBeenCalled();
  });

  it("captures API errors instead of throwing", async () => {
    const client = {
      listProperties: vi.fn().mockRejectedValue(new Error("403 MISSING_SCOPES")),
      getCompany: vi.fn().mockRejectedValue(new Error("404")),
      getContact: vi.fn(),
    };
    const res = await verifyRevintProperties(client as never, { companies: "c1" });
    expect(res[0].definitionsError).toContain("MISSING_SCOPES");
    expect(res.find((r) => r.objectType === "companies")!.recordError).toContain("404");
  });
});

describe("runHubspotBackfill", () => {
  function prisma(leads: Array<Record<string, unknown>>, runId: string | null = "run_9") {
    return {
      lead: { findMany: vi.fn(async () => leads) },
      agentRun: { findFirst: vi.fn(async () => (runId ? { id: runId } : null)) },
    };
  }
  const LEAD = { id: "l1", businessName: "Hawksmoor", crmCompanyId: "c1", crmContactId: null, crmDealId: null };

  it("is a dry run by default — builds payloads, never writes", async () => {
    const p = prisma([LEAD]);
    const res = await runHubspotBackfill(p as never, { workspaceId: "ws_1" });
    expect(res[0]).toEqual(
      expect.objectContaining({ status: "DRY_RUN", briefRunId: "run_9", targets: ["company:c1"] }),
    );
    expect(mocks.build).toHaveBeenCalledWith(p, "ws_1", "l1", { briefRunId: "run_9" });
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(p.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ workspaceId: "ws_1" }) }),
    );
  });

  it("applies with the latest brief run id (idempotent per run)", async () => {
    const p = prisma([LEAD]);
    const res = await runHubspotBackfill(p as never, { workspaceId: "ws_1", apply: true });
    expect(mocks.enqueue).toHaveBeenCalledWith(p, {
      workspaceId: "ws_1",
      leadId: "l1",
      reason: "analysis",
      briefRunId: "run_9",
    });
    expect(res[0].status).toBe("SUCCESS");
  });

  it("skips leads that never had a successful brief", async () => {
    const res = await runHubspotBackfill(prisma([LEAD], null) as never, { workspaceId: "ws_1", apply: true });
    expect(res[0]).toEqual(expect.objectContaining({ status: "SKIPPED", reason: "no_successful_brief" }));
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
});
