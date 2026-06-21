/**
 * FineDine v1 update — HubSpot inbound webhook.
 *
 * Receives contact/company/deal creation + stage-change events, verifies
 * the v3 signature, resolves the workspace from `portalId`, and applies:
 *   - contact/company creation → place-first ingestion (Phase 2).
 *   - deal stage change → map to playbook stage → reflect on the lead.
 *
 * Idempotent: each event is guarded by a `CrmSyncLog` INBOUND row keyed
 * on a hash of the event. Always returns 200 (after signature check) so
 * HubSpot doesn't retry-storm on a single bad event; per-event failures
 * are logged + marked FAILED for the reconcile tick.
 *
 * NOTE: this route intentionally bypasses `requireUser()` — it is
 * server-to-server and authenticated by the HubSpot signature instead.
 */
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  verifyHubspotSignatureV3,
  type HubspotWebhookEvent,
} from "@/lib/integrations/hubspot/webhook";
import { getHubspotClient, HubspotNotConnectedError } from "@/lib/integrations/hubspot/client";
import { ingestHubspotLead } from "@/lib/integrations/hubspot/ingest";
import { getPlaybook } from "@/lib/playbook/resolve";
import {
  mapHubspotStageToPlaybook,
  type CrmFieldMapping,
} from "@/lib/integrations/hubspot/field-map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function eventHash(evt: HubspotWebhookEvent): string {
  const key = `${evt.eventId}:${evt.subscriptionType}:${evt.objectId}:${evt.propertyName ?? ""}:${evt.propertyValue ?? ""}`;
  return createHash("sha256").update(key).digest("hex");
}

/** Mark an inbound event as seen; returns false when it's a duplicate. */
async function claimEvent(
  workspaceId: string,
  leadId: string | null,
  objectType: string,
  hash: string,
): Promise<boolean> {
  try {
    await prisma.crmSyncLog.create({
      data: {
        workspaceId,
        leadId,
        direction: "INBOUND",
        objectType,
        payloadHash: hash,
        status: "PENDING",
        attempts: 1,
      },
    });
    return true;
  } catch {
    // Unique violation on (workspaceId, direction, payloadHash) → dup.
    return false;
  }
}

async function finishEvent(
  workspaceId: string,
  hash: string,
  status: "SUCCESS" | "FAILED" | "SKIPPED",
  leadId: string | null,
  error?: string,
): Promise<void> {
  await prisma.crmSyncLog.updateMany({
    where: { workspaceId, direction: "INBOUND", payloadHash: hash },
    data: { status, leadId: leadId ?? undefined, lastError: error ?? null },
  });
}

// Property names we believe are likely to carry form intent. Most
// HubSpot orgs use one of these — we read them all and persist the
// non-empty subset on the lead as a NOTE activity so the brief can
// consume them as raw signal. Scoring of intent values is a separate
// plan (the writeback only carries this through).
const FORM_INTENT_PROPERTIES = [
  "intent",
  "form_intent",
  "inquiry_type",
  "talep_turu",
  "what_brings_you_here",
  "purpose",
  "reason_for_contact",
  "how_can_we_help",
];

const CONTACT_INBOUND_PROPS = [
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
  "lifecyclestage",
  "hs_lead_status",
  "hs_analytics_source",
  "hs_analytics_source_data_1",
  "hs_analytics_source_data_2",
  "hs_analytics_first_referrer",
  "hs_analytics_first_url",
  "notes_last_updated",
  "notes_next_activity_date",
  ...FORM_INTENT_PROPERTIES,
];

interface FormIntentSnapshot {
  field: string;
  value: string;
}

function captureFormIntent(
  properties: Record<string, string | null>,
): FormIntentSnapshot[] {
  const snapshots: FormIntentSnapshot[] = [];
  for (const field of FORM_INTENT_PROPERTIES) {
    const v = properties[field];
    if (v && v.trim()) snapshots.push({ field, value: v.trim() });
  }
  return snapshots;
}

async function persistFormIntent(
  workspaceId: string,
  leadId: string,
  source: { properties: Record<string, string | null> },
): Promise<void> {
  const intents = captureFormIntent(source.properties);
  if (intents.length === 0) return;
  try {
    // Cast through unknown: the generated Prisma client's
    // `InputJsonValue` constrains objects to a string-index signature,
    // and our typed `FormIntentSnapshot[]` doesn't satisfy that. The
    // shape is plain JSON-serialisable at runtime, the cast is purely
    // a TypeScript escape.
    const payload = {
      source: "hubspot_form_intent",
      intents,
      analytics: {
        source: source.properties.hs_analytics_source ?? null,
        firstReferrer: source.properties.hs_analytics_first_referrer ?? null,
        firstUrl: source.properties.hs_analytics_first_url ?? null,
      },
      lifecycle: source.properties.lifecyclestage ?? null,
      leadStatus: source.properties.hs_lead_status ?? null,
    } as unknown as Prisma.InputJsonValue;
    await prisma.leadActivity.create({
      data: {
        workspaceId,
        leadId,
        kind: "NOTE",
        payload,
      },
    });
  } catch (err) {
    logger.warn("api.hubspot.webhook.form_intent_persist_failed", {
      workspaceId,
      leadId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

async function handleContactCreation(
  workspaceId: string,
  objectId: number,
): Promise<string | null> {
  const client = await getHubspotClient(prisma, workspaceId);
  const contact = await client.getContact(String(objectId), CONTACT_INBOUND_PROPS);
  const p = contact.properties;
  const businessName =
    p.company ||
    [p.firstname, p.lastname].filter(Boolean).join(" ") ||
    "Unknown";
  const address = [p.address, p.city, p.state, p.zip].filter(Boolean).join(", ");

  const res = await ingestHubspotLead(prisma, {
    workspaceId,
    crmContactId: String(objectId),
    crmOwnerId: p.hubspot_owner_id ?? null,
    businessName,
    address: address || null,
    phone: p.phone ?? null,
    websiteUrl: p.website ?? null,
    leadSource: deriveLeadSource(p.hs_analytics_source, "HUBSPOT_INBOUND"),
    inboundReceivedAt: p.createdate ? new Date(p.createdate) : new Date(),
  });

  // Form-intent + lifecycle/source snapshot — raw signal for the brief.
  // Scoring is intentionally separate (handled by future workers).
  await persistFormIntent(workspaceId, res.leadId, contact);

  return res.leadId;
}

function deriveLeadSource(
  analyticsSource: string | null | undefined,
  fallback: string,
): string {
  if (!analyticsSource) return fallback;
  return `HUBSPOT_${analyticsSource.toUpperCase()}`;
}

async function handleContactPropertyChange(
  workspaceId: string,
  objectId: number,
  propertyName: string,
  propertyValue: string,
): Promise<string | null> {
  const lead = await prisma.lead.findFirst({
    where: { workspaceId, crmContactId: String(objectId) },
    select: { id: true },
  });
  if (!lead) return null;

  // Lifecycle / lead-status changes don't move the playbook stage
  // (that's `dealstage`-driven) — but they DO affect prioritisation
  // and the brief. Persist as a NOTE so the timeline tells the story.
  await prisma.leadActivity.create({
    data: {
      workspaceId,
      leadId: lead.id,
      kind: "NOTE",
      payload: {
        source: "hubspot_property_change",
        propertyName,
        propertyValue,
      },
    },
  });
  await prisma.lead.update({
    where: { id: lead.id },
    data: { crmLastSyncedAt: new Date() },
  });
  return lead.id;
}

async function handleCompanyCreation(
  workspaceId: string,
  objectId: number,
): Promise<string | null> {
  const client = await getHubspotClient(prisma, workspaceId);
  const company = await client.getCompany(String(objectId), [
    "name",
    "phone",
    "address",
    "city",
    "state",
    "zip",
    "domain",
    "website",
  ]);
  const p = company.properties;
  const address = [p.address, p.city, p.state, p.zip].filter(Boolean).join(", ");

  const res = await ingestHubspotLead(prisma, {
    workspaceId,
    crmCompanyId: String(objectId),
    businessName: p.name || "Unknown",
    address: address || null,
    phone: p.phone ?? null,
    websiteUrl: p.website ?? p.domain ?? null,
    leadSource: "HUBSPOT_INBOUND",
  });
  return res.leadId;
}

async function handleDealStageChange(
  workspaceId: string,
  objectId: number,
  newStageId: string,
): Promise<string | null> {
  const lead = await prisma.lead.findFirst({
    where: { workspaceId, crmDealId: String(objectId) },
    select: { id: true },
  });
  if (!lead) return null;

  const [playbook, conn] = await Promise.all([
    getPlaybook(prisma, workspaceId),
    prisma.crmConnection.findUnique({
      where: { workspaceId_provider: { workspaceId, provider: "HUBSPOT" } },
      select: { fieldMappingJson: true },
    }),
  ]);
  const mapping = (conn?.fieldMappingJson as unknown as CrmFieldMapping | null) ?? null;
  const stageKey = mapHubspotStageToPlaybook(newStageId, undefined, playbook, mapping);

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      crmStageId: newStageId,
      crmLastSyncedAt: new Date(),
      ...(stageKey ? { playbookStageKey: stageKey } : {}),
    },
  });
  return lead.id;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hubspot-signature-v3");
  const timestamp = request.headers.get("x-hubspot-request-timestamp");

  const verify = verifyHubspotSignatureV3({
    method: "POST",
    requestUrl: request.url,
    rawBody,
    signature,
    timestamp,
    clientSecret: process.env.HUBSPOT_CLIENT_SECRET,
    urlOverride: process.env.HUBSPOT_WEBHOOK_URL,
  });
  if (!verify.valid) {
    logger.warn("api.hubspot.webhook.invalid_signature", { reason: verify.reason });
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let events: HubspotWebhookEvent[];
  try {
    const parsed = JSON.parse(rawBody);
    events = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // Resolve workspaces by portalId once (cache across events).
  const portalToWorkspace = new Map<string, string | null>();
  async function resolveWorkspace(portalId: number): Promise<string | null> {
    const key = String(portalId);
    if (portalToWorkspace.has(key)) return portalToWorkspace.get(key)!;
    const conn = await prisma.crmConnection.findFirst({
      where: { portalId: key, provider: "HUBSPOT", status: { not: "REVOKED" } },
      orderBy: { updatedAt: "desc" },
      select: { workspaceId: true },
    });
    const wsId = conn?.workspaceId ?? null;
    portalToWorkspace.set(key, wsId);
    return wsId;
  }

  let processed = 0;
  for (const evt of events) {
    const workspaceId = await resolveWorkspace(evt.portalId);
    if (!workspaceId) continue; // unknown / disconnected portal

    const hash = eventHash(evt);
    const objectType = evt.subscriptionType.split(".")[0] || "unknown";
    const claimed = await claimEvent(workspaceId, null, objectType, hash);
    if (!claimed) continue; // duplicate delivery

    try {
      let leadId: string | null = null;
      switch (evt.subscriptionType) {
        case "contact.creation":
          leadId = await handleContactCreation(workspaceId, evt.objectId);
          break;
        case "contact.propertyChange":
          if (evt.propertyName && evt.propertyValue != null) {
            leadId = await handleContactPropertyChange(
              workspaceId,
              evt.objectId,
              evt.propertyName,
              evt.propertyValue,
            );
          }
          break;
        case "company.creation":
          leadId = await handleCompanyCreation(workspaceId, evt.objectId);
          break;
        case "deal.creation":
          // Deal creation alone doesn't change our lead model — we only
          // care once a stage is set. Mark SUCCESS so we don't keep
          // re-trying an event we've intentionally chosen not to
          // process; the corresponding deal.propertyChange (dealstage)
          // will arrive separately if/when the rep moves the deal.
          break;
        case "deal.propertyChange":
          if (evt.propertyName === "dealstage" && evt.propertyValue) {
            leadId = await handleDealStageChange(
              workspaceId,
              evt.objectId,
              evt.propertyValue,
            );
          }
          break;
        default:
          await finishEvent(workspaceId, hash, "SKIPPED", null);
          continue;
      }
      await finishEvent(workspaceId, hash, "SUCCESS", leadId);
      processed += 1;
    } catch (err) {
      const isNoConn = err instanceof HubspotNotConnectedError;
      logger.error("api.hubspot.webhook.event_failed", {
        workspaceId,
        subscriptionType: evt.subscriptionType,
        objectId: evt.objectId,
        err: err instanceof Error ? err.message : String(err),
      });
      await finishEvent(
        workspaceId,
        hash,
        isNoConn ? "SKIPPED" : "FAILED",
        null,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  return NextResponse.json({ ok: true, processed });
}
