/**
 * End-to-end HubSpot writeback verification + backfill helpers.
 *
 * Used by `scripts/hubspot-verify.ts` and `scripts/hubspot-backfill.ts`
 * (kept here so they're unit-testable without a DB / HubSpot).
 */
import type { PrismaClient } from "@/generated/prisma/client";
import type { HubspotClient } from "./client";
import {
  REVINT_PROPERTY_NAMES,
  REVINT_PROPERTY_OBJECT_TYPES,
  type RevintPropertyObjectType,
} from "./properties";
import { buildRevintProperties, enqueueCrmWriteback, type WritebackResult } from "./writeback";

export interface PropertyCheck {
  name: string;
  /** Definition exists on the object type in the portal. */
  exists: boolean;
  /** Record-level value (only when a record id was given). */
  value: string | null;
  filled: boolean;
}

export interface ObjectVerification {
  objectType: RevintPropertyObjectType;
  recordId: string | null;
  definitionsError: string | null;
  recordError: string | null;
  properties: PropertyCheck[];
  existsCount: number;
  filledCount: number;
}

function errText(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 500);
}

/**
 * For each object type: which of the 14 `revint_*` definitions exist in
 * the portal, and (when a record id is passed) which are filled on it.
 */
export async function verifyRevintProperties(
  client: HubspotClient,
  records: Partial<Record<RevintPropertyObjectType, string | null>>,
): Promise<ObjectVerification[]> {
  const out: ObjectVerification[] = [];
  for (const objectType of REVINT_PROPERTY_OBJECT_TYPES) {
    const recordId = records[objectType] ?? null;
    let defined = new Set<string>();
    let definitionsError: string | null = null;
    try {
      const res = await client.listProperties(objectType);
      defined = new Set(res.results.map((p) => p.name));
    } catch (err) {
      definitionsError = errText(err);
    }

    let values: Record<string, string | null> = {};
    let recordError: string | null = null;
    if (recordId) {
      try {
        const rec =
          objectType === "companies"
            ? await client.getCompany(recordId, REVINT_PROPERTY_NAMES)
            : await client.getContact(recordId, REVINT_PROPERTY_NAMES);
        values = rec.properties ?? {};
      } catch (err) {
        recordError = errText(err);
      }
    }

    const properties = REVINT_PROPERTY_NAMES.map((name) => {
      const value = values[name] ?? null;
      return {
        name,
        exists: defined.has(name),
        value,
        filled: typeof value === "string" && value.trim() !== "",
      };
    });
    out.push({
      objectType,
      recordId,
      definitionsError,
      recordError,
      properties,
      existsCount: properties.filter((p) => p.exists).length,
      filledCount: properties.filter((p) => p.filled).length,
    });
  }
  return out;
}

export interface BackfillLeadResult {
  leadId: string;
  businessName: string | null;
  briefRunId: string | null;
  targets: string[];
  status: "DRY_RUN" | WritebackResult["status"];
  reason?: string;
  properties?: Record<string, string>;
}

/**
 * Push each CRM-linked lead's latest successful brief to HubSpot.
 * Dry-run by default: builds and returns the property payload without
 * calling HubSpot or writing CrmSyncLog. `apply` reuses the post-run
 * writeback keyed on the brief run id, so re-running is idempotent.
 */
export async function runHubspotBackfill(
  prisma: PrismaClient,
  opts: { workspaceId: string; apply?: boolean; limit?: number },
): Promise<BackfillLeadResult[]> {
  const { workspaceId, apply = false, limit = 500 } = opts;
  const leads = await prisma.lead.findMany({
    where: {
      workspaceId,
      OR: [
        { crmCompanyId: { not: null } },
        { crmContactId: { not: null } },
        { crmDealId: { not: null } },
      ],
    },
    select: {
      id: true,
      businessName: true,
      crmCompanyId: true,
      crmContactId: true,
      crmDealId: true,
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  const results: BackfillLeadResult[] = [];
  for (const lead of leads) {
    const targets = [
      lead.crmCompanyId ? `company:${lead.crmCompanyId}` : null,
      lead.crmContactId ? `contact:${lead.crmContactId}` : null,
    ].filter((t): t is string => !!t);
    const run = await prisma.agentRun.findFirst({
      where: {
        workspaceId,
        leadId: lead.id,
        workerKind: "LEAD_INTELLIGENCE_BRIEF",
        status: { in: ["SUCCEEDED", "SUCCEEDED_NO_MEMORY"] },
      },
      orderBy: { finishedAt: "desc" },
      select: { id: true },
    });
    const base = {
      leadId: lead.id,
      businessName: lead.businessName,
      briefRunId: run?.id ?? null,
      targets,
    };
    if (!run) {
      results.push({ ...base, status: "SKIPPED", reason: "no_successful_brief" });
      continue;
    }
    if (!apply) {
      const built = await buildRevintProperties(prisma, workspaceId, lead.id, { briefRunId: run.id });
      results.push({ ...base, status: "DRY_RUN", properties: built?.properties ?? {} });
      continue;
    }
    const res = await enqueueCrmWriteback(prisma, {
      workspaceId,
      leadId: lead.id,
      reason: "analysis",
      briefRunId: run.id,
    });
    results.push({ ...base, status: res.status, reason: res.reason, targets: res.targets ?? targets });
  }
  return results;
}
