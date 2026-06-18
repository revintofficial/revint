/**
 * FineDine v1 update — HubSpot one-time import / backfill.
 *
 * Connecting HubSpot only wires up live webhooks; it does NOT pull the
 * contacts/companies that already exist in the portal (and webhooks
 * can't reach a localhost dev server at all). This admin-only route
 * pages through existing contacts + companies and runs each through the
 * same place-first `ingestHubspotLead` path the webhook uses, so they
 * surface on the Leads page.
 *
 * Safe to re-run: ingestion dedups on `(workspaceId, crmContactId)` /
 * `(workspaceId, crmCompanyId)` / `(workspaceId, placeId)`, so existing
 * leads are updated rather than duplicated.
 *
 * Bounded by a wall-clock budget (so it returns within the serverless
 * timeout) and hard record caps. For very large portals, re-run until
 * `hasMore` is false.
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  requireWorkspaceAdminApi,
  UnauthorizedError,
  ForbiddenError,
} from "@/lib/auth";
import {
  getHubspotClient,
  HubspotNotConnectedError,
} from "@/lib/integrations/hubspot/client";
import { ingestHubspotLead } from "@/lib/integrations/hubspot/ingest";
import { planMeetsMinimum } from "@/lib/agent-workers/registry";
import { logger } from "@/lib/logger";
import { internalError } from "@/lib/api-errors";

export const runtime = "nodejs";
export const maxDuration = 60;

// Stop pulling new pages once we're this close to the timeout so the
// in-flight work flushes and the response returns cleanly.
const TIME_BUDGET_MS = 45_000;
const MAX_CONTACTS = 1_000;
const MAX_COMPANIES = 1_000;
const PAGE_SIZE = 100;

const CONTACT_PROPS = [
  "firstname",
  "lastname",
  "company",
  "phone",
  "address",
  "city",
  "state",
  "zip",
  "website",
  "hubspot_owner_id",
  "createdate",
];

const COMPANY_PROPS = [
  "name",
  "phone",
  "address",
  "city",
  "state",
  "zip",
  "domain",
  "website",
];

interface SyncTally {
  scanned: number;
  created: number;
  updated: number;
  matched: number;
  skipped: number;
  failed: number;
  hasMore: boolean;
}

export async function POST() {
  const startedAt = Date.now();
  try {
    const session = await requireWorkspaceAdminApi();
    const { workspaceId } = session;

    // Bulk import burns a meaningful slice of the customer's HubSpot
    // rate limit + costs us 1k inbound webhook-equivalent work. Gate
    // it to paid plans (FREE is sunsetted anyway). Connect/route does
    // the same check at OAuth start; this is the worker-side mirror
    // so a workspace that downgrades after connecting can't keep
    // batch-importing under the new plan.
    if (!planMeetsMinimum(session.workspace.plan, "PRO")) {
      return NextResponse.json(
        {
          error: "plan_too_low",
          required: "PRO",
          message: "HubSpot import requires a Solo (PRO) plan or higher.",
        },
        { status: 402 },
      );
    }

    const client = await getHubspotClient(prisma, workspaceId);

    const contacts: SyncTally = {
      scanned: 0,
      created: 0,
      updated: 0,
      matched: 0,
      skipped: 0,
      failed: 0,
      hasMore: false,
    };
    const companies: SyncTally = { ...contacts };

    const timeLeft = () => Date.now() - startedAt < TIME_BUDGET_MS;

    // ---- Contacts ----------------------------------------------------
    let after: string | undefined;
    while (contacts.scanned < MAX_CONTACTS && timeLeft()) {
      const resp = await client.listContacts(CONTACT_PROPS, after, PAGE_SIZE);
      for (const c of resp.results) {
        const p = c.properties;
        const businessName =
          p.company ||
          [p.firstname, p.lastname].filter(Boolean).join(" ").trim();
        if (!businessName) {
          contacts.skipped += 1;
          continue;
        }
        const address = [p.address, p.city, p.state, p.zip]
          .filter(Boolean)
          .join(", ");
        try {
          const res = await ingestHubspotLead(prisma, {
            workspaceId,
            crmContactId: c.id,
            crmOwnerId: p.hubspot_owner_id ?? null,
            businessName,
            address: address || null,
            phone: p.phone ?? null,
            websiteUrl: p.website ?? null,
            leadSource: "HUBSPOT_IMPORT",
            inboundReceivedAt: p.createdate ? new Date(p.createdate) : new Date(),
          });
          contacts.scanned += 1;
          if (res.created) contacts.created += 1;
          else contacts.updated += 1;
          if (res.matched) contacts.matched += 1;
        } catch (err) {
          contacts.failed += 1;
          logger.warn("api.hubspot.sync.contact_failed", {
            workspaceId,
            contactId: c.id,
            err: err instanceof Error ? err.message : String(err),
          });
        }
      }
      after = resp.paging?.next?.after;
      if (!after) break;
    }
    if (after) contacts.hasMore = true;

    // ---- Companies ---------------------------------------------------
    let cAfter: string | undefined;
    while (companies.scanned < MAX_COMPANIES && timeLeft()) {
      const resp = await client.listCompanies(COMPANY_PROPS, cAfter, PAGE_SIZE);
      for (const co of resp.results) {
        const p = co.properties;
        const businessName = (p.name || "").trim();
        if (!businessName) {
          companies.skipped += 1;
          continue;
        }
        const address = [p.address, p.city, p.state, p.zip]
          .filter(Boolean)
          .join(", ");
        try {
          const res = await ingestHubspotLead(prisma, {
            workspaceId,
            crmCompanyId: co.id,
            businessName,
            address: address || null,
            phone: p.phone ?? null,
            websiteUrl: p.website ?? p.domain ?? null,
            leadSource: "HUBSPOT_IMPORT",
          });
          companies.scanned += 1;
          if (res.created) companies.created += 1;
          else companies.updated += 1;
          if (res.matched) companies.matched += 1;
        } catch (err) {
          companies.failed += 1;
          logger.warn("api.hubspot.sync.company_failed", {
            workspaceId,
            companyId: co.id,
            err: err instanceof Error ? err.message : String(err),
          });
        }
      }
      cAfter = resp.paging?.next?.after;
      if (!cAfter) break;
    }
    if (cAfter) companies.hasMore = true;

    const totalCreated = contacts.created + companies.created;
    logger.info("api.hubspot.sync.done", {
      workspaceId,
      contacts,
      companies,
      ms: Date.now() - startedAt,
    });

    return NextResponse.json({
      ok: true,
      contacts,
      companies,
      totalCreated,
      hasMore: contacts.hasMore || companies.hasMore,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof HubspotNotConnectedError) {
      return NextResponse.json(
        { error: "hubspot_not_connected" },
        { status: 409 },
      );
    }
    return internalError("api.hubspot.sync_error", err);
  }
}
