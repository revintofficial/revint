/**
 * FineDine v1 update — read HubSpot context for a lead.
 *
 * Given a lead with stored `crmContactId` / `crmCompanyId` / `crmDealId`,
 * fetch the relevant HubSpot objects (contact, company, deal), the deal
 * owner, lifecycle/pipeline stage, and a small recent-notes window so the
 * Action Sheet "HubSpot Context" panel can render the CRM state inline.
 *
 * Best-effort + resilient: any sub-fetch that fails is omitted rather
 * than failing the whole panel (HubSpot rate limits / deleted objects
 * shouldn't blank the lead sheet). Returns null when the workspace has no
 * HubSpot connection or the lead has no CRM linkage.
 */
import type { PrismaClient } from "@/generated/prisma/client";
import {
  getHubspotClient,
  HubspotNotConnectedError,
  type HubspotObject,
} from "./client";
import { logger } from "@/lib/logger";

export interface HubspotLeadContext {
  portalId: string | null;
  contact?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    lifecycleStage?: string | null;
    leadStatus?: string | null;
    lastActivityDate?: string | null;
    nextActivityDate?: string | null;
    analyticsSource?: string | null;
    firstReferrer?: string | null;
    /**
     * Captured form-intent properties (if any). Each entry mirrors a
     * HubSpot contact property whose name matches the configured intent
     * field list. The Action Sheet renders this as a "form said" panel.
     */
    formIntents?: Array<{ field: string; value: string }>;
  };
  company?: {
    id: string;
    name?: string | null;
    domain?: string | null;
    city?: string | null;
  };
  deal?: {
    id: string;
    name?: string | null;
    stageId?: string | null;
    amount?: string | null;
    closeDate?: string | null;
  };
  owner?: {
    id: string;
    email?: string;
    name?: string;
  };
}

const FORM_INTENT_FIELDS = [
  "intent",
  "form_intent",
  "inquiry_type",
  "talep_turu",
  "what_brings_you_here",
  "purpose",
  "reason_for_contact",
  "how_can_we_help",
];

const CONTACT_PROPS = [
  "firstname",
  "lastname",
  "email",
  "phone",
  "lifecyclestage",
  "hs_lead_status",
  "notes_last_updated",
  "notes_next_activity_date",
  "hubspot_owner_id",
  "hs_analytics_source",
  "hs_analytics_first_referrer",
  ...FORM_INTENT_FIELDS,
];
const COMPANY_PROPS = ["name", "domain", "city"];
const DEAL_PROPS = ["dealname", "dealstage", "amount", "closedate", "hubspot_owner_id"];

function prop(o: HubspotObject, key: string): string | null {
  return o.properties?.[key] ?? null;
}

export async function getHubspotLeadContext(
  prisma: PrismaClient,
  workspaceId: string,
  lead: {
    crmContactId: string | null;
    crmCompanyId: string | null;
    crmDealId: string | null;
  },
): Promise<HubspotLeadContext | null> {
  if (!lead.crmContactId && !lead.crmCompanyId && !lead.crmDealId) {
    return null;
  }

  let client;
  try {
    client = await getHubspotClient(prisma, workspaceId);
  } catch (err) {
    if (err instanceof HubspotNotConnectedError) return null;
    throw err;
  }

  const ctx: HubspotLeadContext = { portalId: client.portalId };
  let ownerId: string | null = null;

  if (lead.crmContactId) {
    try {
      const c = await client.getContact(lead.crmContactId, CONTACT_PROPS);
      const formIntents: Array<{ field: string; value: string }> = [];
      for (const f of FORM_INTENT_FIELDS) {
        const v = prop(c, f);
        if (v && v.trim()) formIntents.push({ field: f, value: v.trim() });
      }
      ctx.contact = {
        id: c.id,
        firstName: prop(c, "firstname"),
        lastName: prop(c, "lastname"),
        email: prop(c, "email"),
        phone: prop(c, "phone"),
        lifecycleStage: prop(c, "lifecyclestage"),
        leadStatus: prop(c, "hs_lead_status"),
        lastActivityDate: prop(c, "notes_last_updated"),
        nextActivityDate: prop(c, "notes_next_activity_date"),
        analyticsSource: prop(c, "hs_analytics_source"),
        firstReferrer: prop(c, "hs_analytics_first_referrer"),
        formIntents: formIntents.length > 0 ? formIntents : undefined,
      };
      ownerId = prop(c, "hubspot_owner_id");
    } catch (err) {
      logger.warn("hubspot.context.contact_fetch_failed", { err, workspaceId });
    }
  }

  if (lead.crmCompanyId) {
    try {
      const co = await client.getCompany(lead.crmCompanyId, COMPANY_PROPS);
      ctx.company = {
        id: co.id,
        name: prop(co, "name"),
        domain: prop(co, "domain"),
        city: prop(co, "city"),
      };
    } catch (err) {
      logger.warn("hubspot.context.company_fetch_failed", { err, workspaceId });
    }
  }

  if (lead.crmDealId) {
    try {
      const d = await client.getDeal(lead.crmDealId, DEAL_PROPS);
      ctx.deal = {
        id: d.id,
        name: prop(d, "dealname"),
        stageId: prop(d, "dealstage"),
        amount: prop(d, "amount"),
        closeDate: prop(d, "closedate"),
      };
      ownerId = ownerId ?? prop(d, "hubspot_owner_id");
    } catch (err) {
      logger.warn("hubspot.context.deal_fetch_failed", { err, workspaceId });
    }
  }

  if (ownerId) {
    try {
      const o = await client.getOwner(ownerId);
      ctx.owner = {
        id: o.id,
        email: o.email,
        name: [o.firstName, o.lastName].filter(Boolean).join(" ") || undefined,
      };
    } catch (err) {
      logger.warn("hubspot.context.owner_fetch_failed", { err, workspaceId });
    }
  }

  return ctx;
}
