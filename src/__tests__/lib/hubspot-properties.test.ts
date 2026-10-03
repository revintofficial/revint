/**
 * `ensureRevintProperties` must be honest: it provisions the 14
 * `revint_*` properties on BOTH contacts and companies (restaurants
 * arrive in HubSpot as Companies), treats "already exists" as success,
 * and surfaces every real failure — especially a missing schema-write
 * scope — instead of reporting a clean provision.
 */
import { describe, expect, it, vi } from "vitest";

import {
  ensureRevintProperties,
  missingWritebackScopes,
  REQUIRED_WRITEBACK_SCOPES,
  REVINT_PROPERTY_NAMES,
  REVINT_PROPERTY_OBJECT_TYPES,
} from "@/lib/integrations/hubspot/properties";
import type { HubspotClient } from "@/lib/integrations/hubspot/client";

function httpError(status: number, body = "{}") {
  const err = new Error(`HubSpot → ${status}: ${body}`) as Error & { status?: number };
  err.status = status;
  return err;
}

function fakeClient(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    listProperties: vi.fn().mockResolvedValue({ results: [] }),
    createPropertyGroup: vi.fn().mockResolvedValue({}),
    createProperty: vi.fn().mockResolvedValue({}),
    ...overrides,
  } as unknown as HubspotClient & {
    listProperties: ReturnType<typeof vi.fn>;
    createPropertyGroup: ReturnType<typeof vi.fn>;
    createProperty: ReturnType<typeof vi.fn>;
  };
}

describe("REVINT property contract", () => {
  it("has exactly 14 canonical properties", () => {
    expect(REVINT_PROPERTY_NAMES).toHaveLength(14);
    expect(REVINT_PROPERTY_NAMES.every((n) => n.startsWith("revint_"))).toBe(true);
  });

  it("provisions on contacts and companies", () => {
    expect(REVINT_PROPERTY_OBJECT_TYPES).toEqual(["contacts", "companies"]);
  });
});

describe("missingWritebackScopes", () => {
  it("returns nothing for a fully-scoped token", () => {
    expect(missingWritebackScopes([...REQUIRED_WRITEBACK_SCOPES, "oauth"])).toEqual([]);
  });

  it("lists the schema-write scopes a legacy token lacks", () => {
    const missing = missingWritebackScopes([
      "oauth",
      "crm.objects.contacts.write",
      "crm.objects.companies.write",
      "crm.schemas.contacts.read",
    ]);
    expect(missing).toContain("crm.schemas.contacts.write");
    expect(missing).toContain("crm.schemas.companies.write");
  });

  it("treats null scopes as missing everything", () => {
    expect(missingWritebackScopes(null)).toEqual([...REQUIRED_WRITEBACK_SCOPES]);
  });
});

describe("ensureRevintProperties", () => {
  it("creates all 14 properties on contacts and companies in a clean portal", async () => {
    const client = fakeClient();
    const res = await ensureRevintProperties(client);
    expect(client.createProperty).toHaveBeenCalledTimes(28);
    expect(client.createProperty).toHaveBeenCalledWith(
      "companies",
      expect.objectContaining({ name: "revint_recommended_angle", groupName: "revint" }),
    );
    expect(res.ok).toBe(true);
    expect(res.created).toHaveLength(28);
    expect(res.errors).toEqual([]);
    expect(res.missingScope).toBe(false);
  });

  it("skips properties that already exist and treats a 409 on create as existing", async () => {
    const client = fakeClient({
      listProperties: vi.fn(async (objectType: string) => ({
        results:
          objectType === "contacts"
            ? REVINT_PROPERTY_NAMES.map((name) => ({ name }))
            : [],
      })),
      createPropertyGroup: vi.fn().mockRejectedValue(httpError(409)),
      createProperty: vi.fn().mockRejectedValue(httpError(409, '{"category":"OBJECT_ALREADY_EXISTS"}')),
    });
    const res = await ensureRevintProperties(client);
    expect(res.ok).toBe(true);
    expect(res.skipped).toHaveLength(28);
    expect(res.errors).toEqual([]);
  });

  it("reports a missing scope (403) as a failure — never as success", async () => {
    const client = fakeClient({
      createPropertyGroup: vi.fn().mockRejectedValue(httpError(403, '{"category":"MISSING_SCOPES"}')),
      createProperty: vi.fn().mockRejectedValue(httpError(403, '{"category":"MISSING_SCOPES"}')),
    });
    const res = await ensureRevintProperties(client);
    expect(res.ok).toBe(false);
    expect(res.missingScope).toBe(true);
    expect(res.created).toEqual([]);
    expect(res.errors).toContain("contacts.revint_sales_confidence");
    expect(res.errorDetails[0]).toEqual(
      expect.objectContaining({ status: 403, message: expect.stringContaining("MISSING_SCOPES") }),
    );
  });

  it("falls back to create-and-409 when listing fails, and still reports real create errors", async () => {
    const client = fakeClient({
      listProperties: vi.fn().mockRejectedValue(httpError(500)),
      createProperty: vi.fn(async (_o: string, def: { name: string }) => {
        if (def.name === "revint_action_sheet_url") throw httpError(400, '{"message":"bad"}');
        throw httpError(409);
      }),
    });
    const res = await ensureRevintProperties(client);
    expect(res.ok).toBe(false);
    expect(res.skipped).toHaveLength(26);
    expect(res.errors).toEqual([
      "contacts.revint_action_sheet_url",
      "companies.revint_action_sheet_url",
    ]);
  });
});
