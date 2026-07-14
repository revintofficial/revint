/**
 * Revint App Card data-fetch endpoint.
 *
 * This is the **new** App Card backend that replaces the deprecated
 * Legacy CRM Card (`src/app/api/integrations/hubspot/card/route.ts`).
 * It is called by the React UI Extension (`hubspot-app/.../RevintCard.tsx`)
 * via `hubspot.fetch()` and returns a **flat JSON** payload (NOT the
 * legacy `{ results: [...] }` shape).
 *
 * Auth contract:
 *   - HubSpot signs the request with v3 signature (POST + URL + body +
 *     timestamp HMAC-SHA256 with the public-app client secret).
 *   - We verify the signature BEFORE any DB read.
 *   - HubSpot ships `X-HubSpot-Hub-Id` as the portal id; we resolve the
 *     workspace from `CrmConnection.portalId` and scope every query by
 *     that workspaceId. Cross-tenant portal leakage is impossible by
 *     construction (the portal id is signed input).
 *
 * Hard limits (from HubSpot's hubspot.fetch contract):
 *   - 15 s default timeout (configurable up to 120 s by the card).
 *   - 1 MB request + response payload.
 *   - 20 concurrent requests per installed portal.
 * So this handler MUST stay light:
 *   - no Gemini / Apify / AI calls,
 *   - no heavy joins,
 *   - reads denormalised `revint_*` shaped fields off the Lead +
 *     LeadQualification + (most recent) LeadNextAction only.
 *
 * Request body (sent by the card):
 *   { "objectType": "CONTACT" | "DEAL" | "COMPANY", "objectId": "12345" }
 * Response (flat JSON the card maps onto its UI):
 *   {
 *     "found": boolean,
 *     "lead": { id, businessName, ... },
 *     "actionSheetUrl": string,
 *     "signals": { temperature, qualificationStatus, ... },
 *     "decision": { recommendedAngle, pitchThis, nextBestAction, ... },
 *     "lastSyncedAt": string | null
 *   }
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { verifyHubspotRequest } from "@/lib/integrations/hubspot/webhook";
import { getHubspotClient } from "@/lib/integrations/hubspot/client";
import { getPlaybook } from "@/lib/playbook/resolve";
import { pickAngle } from "@/lib/playbook/angle";
import { resolveRecommendedPackage } from "@/lib/lead-detail/recommended-package";
import {
  REASON_LABELS,
  SUPPRESS_WHEN_NO_WEBSITE,
  normalizeWedgeKey,
} from "@/lib/labels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hard ceiling on response size we'll ever produce. HubSpot enforces
// 1 MB; we cap individual long-form fields well below that so the
// response stays comfortably inside the limit even with future
// additions.
const MAX_EVIDENCE_CHARS = 2000;
const MAX_HOOK_CHARS = 800;

// HubSpot UI extensions send the CRM object as an `objectTypeId`
// (e.g. "0-1" for contacts, "0-2" companies, "0-3" deals) rather than a
// friendly string. Normalise both shapes to our canonical type so the
// linkage lookup + association fallback target the right column.
const HUBSPOT_OBJECT_TYPE: Record<string, "CONTACT" | "COMPANY" | "DEAL"> = {
  "0-1": "CONTACT",
  "0-2": "COMPANY",
  "0-3": "DEAL",
  CONTACT: "CONTACT",
  COMPANY: "COMPANY",
  DEAL: "DEAL",
};

function normalizeObjectType(raw: string): "CONTACT" | "COMPANY" | "DEAL" {
  return HUBSPOT_OBJECT_TYPE[raw.toUpperCase()] ?? "CONTACT";
}

// A contact can be associated with several companies/deals. HubSpot marks
// the canonical one with the "Primary" association label (typeId 1). When
// resolving a lead we must follow the primary association first, otherwise
// we can surface a stray secondary company (often an unscored duplicate)
// instead of the real account.
interface HubspotAssociation {
  toObjectId: string | number;
  associationTypes?: Array<{ typeId?: number; label?: string | null }>;
}

function isPrimaryAssociation(assoc: HubspotAssociation): boolean {
  return (assoc.associationTypes ?? []).some(
    (t) => t.typeId === 1 || (t.label ?? "").toUpperCase() === "PRIMARY",
  );
}

function primaryFirst<T extends HubspotAssociation>(results: T[]): T[] {
  return [...results].sort(
    (a, b) => Number(isPrimaryAssociation(b)) - Number(isPrimaryAssociation(a)),
  );
}

const leadCardSelect = {
  id: true,
  businessName: true,
  leadTemperature: true,
  salesConfidence: true,
  icpFitScore: true,
  hasWebsite: true,
  rating: true,
  reviewCount: true,
  priceLevel: true,
  accountId: true,
  subNicheSlug: true,
  playbookStageKey: true,
  lastDisposition: true,
  inboundReceivedAt: true,
  crmLastSyncedAt: true,
  googleMapsUri: true,
  qualification: {
    select: {
      status: true,
      qualified: true,
      qualificationRisk: true,
      noShowRisk: true,
    },
  },
  nextActions: {
    where: { supersededAt: null },
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: {
      openingHook: true,
      timingWindowStart: true,
      timingWindowEnd: true,
      actionKind: true,
      confidence: true,
    },
  },
  // At-a-glance + tech-signal + social/maps context. The audit row carries
  // the deterministic "what does this venue have?" booleans (booking, contact
  // form, WhatsApp), the social-profile blob, the F&B-specific rawFeaturesJson
  // (QR menu / online reservation / delivery), and the load-time signal used
  // for the "Slow site" chip.
  websiteAudit: {
    select: {
      hasContactForm: true,
      hasWhatsappLink: true,
      hasBookingSystem: true,
      socialProfiles: true,
      rawFeaturesJson: true,
      loadTimeMs: true,
    },
  },
  // Package recommendation + "why this lead" reasoning written by the
  // SALES_OPPORTUNITY_SCORER analyst. recommendedPackageId is free-text
  // (resolved to a ServicePackage below, workspace-scoped). `reasonCodes`
  // feeds the At-a-Glance chip strip alongside the audit-derived wedges.
  salesOpportunity: {
    select: {
      opportunityScore: true,
      whyGoodTarget: true,
      likelyPainPoints: true,
      expectedPriceBand: true,
      recommendedPackageId: true,
      recommendedPackageReason: true,
      reasonCodes: true,
    },
  },
  // Review Intelligence (review-analyst worker) — lead score, sentiment,
  // weakness/strength KPIs, grounded pain/praise phrases.
  reviewAnalysis: {
    select: {
      leadScore: true,
      reviewsAnalyzedCount: true,
      sentimentBreakdown: true,
      weaknessKpis: true,
      strengthKpis: true,
      painPhrases: true,
      strengthPhrases: true,
      summary: true,
    },
  },
} as const;

type LeadCardRow = Awaited<
  ReturnType<
    typeof prisma.lead.findFirst<{ select: typeof leadCardSelect }>
  >
>;

/**
 * Resolve a Revint lead for the HubSpot record the card is embedded on.
 * CONTACT records often lack a direct `crmContactId` link when the lead
 * was ingested from a company webhook/import — fall back to HubSpot
 * associations (contact → company/deal) and backfill `crmContactId` so
 * future lookups + writebacks target the right record.
 */
async function resolveLeadForCard(args: {
  workspaceId: string;
  objectType: string;
  objectId: string;
}): Promise<LeadCardRow | null> {
  const { workspaceId, objectType, objectId } = args;

  const directWhere =
    objectType === "DEAL"
      ? { workspaceId, crmDealId: objectId }
      : objectType === "COMPANY"
        ? { workspaceId, crmCompanyId: objectId }
        : { workspaceId, crmContactId: objectId };

  const direct = await prisma.lead.findFirst({
    where: directWhere,
    select: leadCardSelect,
  });
  if (direct) return direct;

  if (objectType !== "CONTACT") return null;

  try {
    const client = await getHubspotClient(prisma, workspaceId);

    const companyAssocs = await client.getAssociations(
      "contacts",
      objectId,
      "companies",
    );
    for (const assoc of primaryFirst(companyAssocs.results ?? [])) {
      const companyId = String(assoc.toObjectId);
      const viaCompany = await prisma.lead.findFirst({
        where: { workspaceId, crmCompanyId: companyId },
        select: leadCardSelect,
      });
      if (viaCompany) {
        await prisma.lead.updateMany({
          where: { id: viaCompany.id, workspaceId, crmContactId: null },
          data: { crmContactId: objectId },
        });
        return viaCompany;
      }
    }

    const dealAssocs = await client.getAssociations(
      "contacts",
      objectId,
      "deals",
    );
    for (const assoc of primaryFirst(dealAssocs.results ?? [])) {
      const dealId = String(assoc.toObjectId);
      const viaDeal = await prisma.lead.findFirst({
        where: { workspaceId, crmDealId: dealId },
        select: leadCardSelect,
      });
      if (viaDeal) {
        await prisma.lead.updateMany({
          where: { id: viaDeal.id, workspaceId, crmContactId: null },
          data: { crmContactId: objectId },
        });
        return viaDeal;
      }
    }
  } catch (err) {
    logger.warn("api.hubspot.card_data.association_lookup_failed", {
      workspaceId,
      objectId,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  return null;
}

function actionSheetUrl(leadId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base}/app/leads/${leadId}`;
}

/**
 * Build every plausible public-URL representation HubSpot might have
 * signed. On Vercel the route handler's `request.url` can surface the
 * internal scheme/host rather than the custom domain the card actually
 * called, which breaks the v3 HMAC. We hand the verifier the env override
 * plus a forwarded-header reconstruction so a host/scheme drift no longer
 * forces a 401.
 */
function cardUrlCandidates(request: Request): string[] {
  const out: string[] = [];
  if (process.env.HUBSPOT_CARD_URL) out.push(process.env.HUBSPOT_CARD_URL);
  if (process.env.NEXT_PUBLIC_APP_URL) {
    out.push(`${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/hubspot/card-data`);
  }
  try {
    const u = new URL(request.url);
    const fwdHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    const fwdProto = request.headers.get("x-forwarded-proto") ?? "https";
    if (fwdHost) out.push(`${fwdProto}://${fwdHost}${u.pathname}`);
  } catch {
    // request.url not parseable — verifier still tries it raw.
  }
  return out;
}

function truncate(s: string | null | undefined, max: number): string | null {
  if (!s) return null;
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

// ---- JSON-field coercion helpers (SalesOpportunity + ReviewAnalysis carry
// loosely-typed Json columns; coerce defensively before sending to the card).

function asStringList(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((s) => s.trim())
    .slice(0, max);
}

interface CardKpi {
  label: string;
  percent: number | null;
}

function asKpis(v: unknown, max: number): CardKpi[] {
  if (!Array.isArray(v)) return [];
  const out: CardKpi[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const label = typeof row.label === "string" ? row.label.trim() : "";
    if (!label) continue;
    out.push({
      label,
      percent: typeof row.percent === "number" ? Math.round(row.percent) : null,
    });
    if (out.length >= max) break;
  }
  return out;
}

/** Read a 0..1 sentiment fraction off the Json blob and return a 0..100 %. */
function sentimentPct(blob: unknown, key: string): number | null {
  if (!blob || typeof blob !== "object") return null;
  const v = (blob as Record<string, unknown>)[key];
  if (typeof v !== "number" || Number.isNaN(v)) return null;
  return Math.round(v * 100);
}

// ---- F&B rawFeaturesJson shape (audit-derived restaurant signals). ---------

interface RestaurantFeatures {
  hasQrMenu?: boolean;
  hasOnlineReservation?: boolean;
  hasDeliveryIntegration?: boolean;
  detectedMenuTool?: string | null;
}

function asRestaurantFeatures(v: unknown): RestaurantFeatures | null {
  if (!v || typeof v !== "object") return null;
  return v as RestaurantFeatures;
}

/**
 * "Restaurant tech signals" tiles (QR menu / Online reservation / Delivery
 * integration). Mirrors the in-app `RestaurantSignalsSection` shape from
 * `src/components/app/website-intelligence-panel.tsx` so the HubSpot card
 * and Revint UI surface the SAME signals/copy in the SAME order.
 *
 * Returns `null` (not an empty array) when the audit has no
 * `rawFeaturesJson` — that's how the card knows to omit the section
 * entirely instead of rendering three "Not detected" tiles for a venue
 * that was never F&B-classified.
 */
function buildTechSignals(features: RestaurantFeatures | null): Array<{
  label: string;
  present: boolean;
  detail: string;
  priority: "critical" | "important" | "nice_to_have";
}> | null {
  if (!features) return null;
  return [
    {
      label: "QR menu",
      present: !!features.hasQrMenu,
      detail: features.detectedMenuTool
        ? `Detected: ${features.detectedMenuTool}`
        : features.hasQrMenu
          ? "QR menu found on site"
          : "Not detected — primary sales opportunity",
      priority: "critical",
    },
    {
      label: "Online reservation",
      present: !!features.hasOnlineReservation,
      detail: features.hasOnlineReservation
        ? "Reservation system found"
        : "No reservation integration",
      priority: "important",
    },
    {
      label: "Delivery integration",
      present: !!features.hasDeliveryIntegration,
      detail: features.hasDeliveryIntegration
        ? "Delivery platform link found"
        : "No delivery platform embed",
      priority: "nice_to_have",
    },
  ];
}

// ---- At-a-Glance chips ------------------------------------------------------

/**
 * Server-side mirror of `AtAGlanceStrip` in
 * `src/components/app/leads/LegacyLeadDetailClient.tsx`. The wedges (audit-
 * derived booleans) are the high-trust source; Gemini `reasonCodes` that
 * collide under `normalizeWedgeKey` get dropped so the chip strip never
 * shows the same fact twice under different copy.
 *
 * Kept SERVER-SIDE so the HubSpot card stays render-only (no derivation
 * in the iframe runtime) and so a single tweak to the chip rules
 * propagates to both UI surfaces.
 */
function buildGlanceChips(args: {
  audit: {
    hasContactForm: boolean;
    hasWhatsappLink: boolean;
    loadTimeMs: number | null;
  } | null;
  features: RestaurantFeatures | null;
  reasonCodes: unknown;
  reviewLeadScore: number | null;
  packageName: string | null;
}): string[] {
  const { audit, features, reasonCodes, reviewLeadScore, packageName } = args;

  const chips: string[] = [];

  // Package + review sub-score lead the strip (highest-information chips).
  if (packageName) chips.push(`Package: ${packageName}`);
  if (reviewLeadScore != null) {
    chips.push(`Review sub-score ${reviewLeadScore}/100`);
  }

  // Slow site label uses the same 3.5s threshold as the in-app strip.
  if (audit?.loadTimeMs != null && audit.loadTimeMs >= 3500) {
    chips.push(`Slow site ~${Math.round(audit.loadTimeMs / 1000)}s`);
  }

  // Audit-derived wedges (boolean signals). Match the in-app copy verbatim
  // so chip text stays consistent across HubSpot + Revint.
  const wedges: string[] = [];
  if (audit?.hasWhatsappLink === false) wedges.push("No WhatsApp");
  if (audit?.hasContactForm === false) wedges.push("No contact form");
  if (features?.hasQrMenu === true) wedges.push("QR menu detected");
  for (const w of wedges) chips.push(w);

  // Gemini scorer reasonCodes, mapped through REASON_LABELS and deduped
  // against the high-trust audit wedges by normalized text.
  const raw = Array.from(
    new Set(
      Array.isArray(reasonCodes)
        ? (reasonCodes as unknown[]).filter(
            (x): x is string => typeof x === "string" && x.trim().length > 0,
          )
        : [],
    ),
  );
  const hasNoWebsite = raw.includes("no_website");
  const wedgeKeys = new Set(wedges.map(normalizeWedgeKey));
  const filtered = raw
    .filter((code) => {
      if (hasNoWebsite && SUPPRESS_WHEN_NO_WEBSITE.has(code)) return false;
      const labelText = REASON_LABELS[code] ?? code.replace(/_/g, " ");
      if (wedgeKeys.has(normalizeWedgeKey(labelText))) return false;
      return true;
    })
    .slice(0, 5)
    .map((code) => REASON_LABELS[code] ?? code.replace(/_/g, " "));
  for (const c of filtered) chips.push(c);

  // Hard cap so the card stays well under the 1MB ceiling no matter how
  // chip-heavy a lead is.
  return chips.slice(0, 8);
}

// ---- Social links + Maps ----------------------------------------------------

/**
 * Allowed social platforms the card surfaces. Whitelisted (not iterated
 * over the blob) so a stray junk key in `socialProfiles` can't leak into
 * the card UI. Order matches the mockup (instagram first → tiktok last).
 */
const SOCIAL_PLATFORMS = [
  "instagram",
  "facebook",
  "linkedin",
  "youtube",
  "tiktok",
  "twitter",
  "whatsapp",
  "pinterest",
] as const;

function buildSocialLinks(blob: unknown): Record<string, string> {
  if (!blob || typeof blob !== "object") return {};
  const out: Record<string, string> = {};
  const obj = blob as Record<string, unknown>;
  for (const key of SOCIAL_PLATFORMS) {
    const v = obj[key];
    if (typeof v === "string" && v.trim().length > 0) out[key] = v.trim();
  }
  return out;
}

// ---- AgentRun outputJson helpers --------------------------------------------

function asJsonObject(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object") return null;
  return v as Record<string, unknown>;
}

/**
 * Extract a short summary from the dossier markdown for the HubSpot card.
 * The Revint UI renders the FULL markdown; the card only needs a teaser
 * so the SDR can decide whether to open the action sheet. Takes the first
 * non-heading paragraph, strips markdown syntax, and caps at `max` chars.
 */
function extractDossierSummary(markdown: unknown, max = 280): string | null {
  if (typeof markdown !== "string") return null;
  const blocks = markdown.split(/\n{2,}/);
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue;
    // Strip basic markdown: bold/italic, code ticks, links → label text.
    const plain = trimmed
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[`*_]+/g, "")
      .replace(/^[>\-*]\s+/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!plain) continue;
    if (plain.length <= max) return plain;
    return `${plain.slice(0, max - 1)}…`;
  }
  return null;
}

interface CardRequestBody {
  objectType?: string;
  objectId?: string | number;
  portalId?: string | number;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hubspot-signature-v3");
  const timestamp = request.headers.get("x-hubspot-request-timestamp");

  const verify = verifyHubspotRequest({
    method: "POST",
    requestUrl: request.url,
    rawBody,
    clientSecret: process.env.HUBSPOT_CLIENT_SECRET,
    urlOverride: cardUrlCandidates(request),
    signatureV3: signature,
    timestamp,
    signatureV2: request.headers.get("x-hubspot-signature"),
    signatureVersion: request.headers.get("x-hubspot-signature-version"),
  });
  if (!verify.valid) {
    logger.warn("api.hubspot.card_data.invalid_signature", {
      reason: verify.reason,
      observedUrl: request.url,
      signatureVersion: request.headers.get("x-hubspot-signature-version"),
      hasClientSecret: !!process.env.HUBSPOT_CLIENT_SECRET,
      hasCardUrlEnv: !!process.env.HUBSPOT_CARD_URL,
      urlCandidates: cardUrlCandidates(request),
    });
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let body: CardRequestBody;
  try {
    body = rawBody ? (JSON.parse(rawBody) as CardRequestBody) : {};
  } catch {
    logger.warn("api.hubspot.card_data.reject", { at: "invalid_body" });
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const objectType = normalizeObjectType((body.objectType ?? "CONTACT").toString());
  const objectId = body.objectId == null ? "" : String(body.objectId);
  if (!objectId) {
    logger.warn("api.hubspot.card_data.reject", {
      at: "missing_object_id",
      keys: Object.keys(body ?? {}),
    });
    return NextResponse.json({ error: "missing_object_id" }, { status: 400 });
  }

  // Portal id resolution. `hubspot.fetch` CANNOT set custom request headers,
  // but HubSpot automatically appends `portalId` (and userId/userEmail/appId)
  // as query params — and the full URL is covered by the v3 signature, so
  // the query param is trustworthy. We accept, in order: the query param
  // (real card), the body (card also sends it), then the x-hubspot-hub-id
  // header (server-to-server / smoke tests).
  const portalId =
    new URL(request.url).searchParams.get("portalId") ??
    (body.portalId != null ? String(body.portalId) : null) ??
    request.headers.get("x-hubspot-hub-id");
  if (!portalId) {
    logger.warn("api.hubspot.card_data.reject", {
      at: "missing_portal_id",
      keys: Object.keys(body ?? {}),
    });
    return NextResponse.json({ error: "missing_portal_id" }, { status: 400 });
  }

  // Resolve workspace from portal — non-throwing query so an unknown
  // portal returns an empty payload (the card renders "not connected").
  // A portal *should* map to one workspace, but during testing the same
  // portal can end up connected to several. Resolve deterministically to the
  // most recently updated active connection so the card never flip-flops
  // between workspaces (and their duplicate leads) across requests.
  const conn = await prisma.crmConnection.findFirst({
    where: { portalId, provider: "HUBSPOT", status: { not: "REVOKED" } },
    orderBy: { updatedAt: "desc" },
    select: { workspaceId: true },
  });
  if (!conn) {
    return NextResponse.json({
      found: false,
      reason: "workspace_not_found",
    });
  }
  const { workspaceId } = conn;

  const lead = await resolveLeadForCard({ workspaceId, objectType, objectId });

  if (!lead) {
    return NextResponse.json({
      found: false,
      reason: "lead_not_found",
      actionSheetUrl: actionSheetUrl(""),
    });
  }

  // Recommend the best angle for the card's "Best Angle" + "Pitch This"
  // rows. `pickAngle` is pure (no IO besides the playbook resolve), so
  // staying inside the 15 s envelope is comfortable.
  const playbook = await getPlaybook(prisma, workspaceId);
  const picked = pickAngle(playbook, {
    hasWebsite: lead.hasWebsite,
    rating: lead.rating,
    reviewCount: lead.reviewCount,
    priceLevel: lead.priceLevel,
    isMultiLocation: !!lead.accountId,
  });

  const hoursSinceInbound = lead.inboundReceivedAt
    ? Math.max(
        0,
        Math.floor((Date.now() - lead.inboundReceivedAt.getTime()) / 3_600_000),
      )
    : null;

  const nextAction = lead.nextActions[0] ?? null;
  const stage = playbook.stages.find((s) => s.key === lead.playbookStageKey);

  // Compose a single-line "why this risk?" string so the SDR can see
  // the reasoning without opening the action sheet. Kept terse on
  // purpose (the card is decision-only; deep evidence lives in the
  // action sheet).
  const qualificationRiskReason = (() => {
    if (!lead.qualification) return null;
    if (lead.qualification.status === "info_only") {
      return "Caller only after info — not in buying mode.";
    }
    if (lead.qualification.qualificationRisk === "high") {
      return "Decision-maker contact + concrete next step still missing.";
    }
    if (lead.qualification.qualificationRisk === "medium") {
      return "Partial qualification — one required item still open.";
    }
    return null;
  })();

  const opp = lead.salesOpportunity;
  const review = lead.reviewAnalysis;

  // Three workspace-scoped reads in parallel:
  //   1. Resolve the analyst's recommended ServicePackage (free-text id
  //      tolerates deleted/renamed packages by returning null).
  //   2. Latest dossier markdown for the card's "AI Dossier" teaser. We
  //      pull only `outputJson` from the most recent SUCCEEDED run, so
  //      this is a single indexed lookup on `(workspaceId, leadId,
  //      workerKind, status)` — comfortably inside the 15s envelope.
  //   3. Latest brief run, used to surface the head-agent `primaryAngle`
  //      + `talkTrack` for the "Pitch Angle" section. Falls back to the
  //      deterministic `pickAngle` output below when the head agent
  //      hasn't run for this lead (non-F&B, flag off, etc.).
  const [recommendedPackage, dossierRun, briefRun] = await Promise.all([
    resolveRecommendedPackage({
      workspaceId,
      recommendedPackageId: opp?.recommendedPackageId,
      recommendedPackageReason: opp?.recommendedPackageReason,
    }),
    prisma.agentRun.findFirst({
      where: {
        workspaceId,
        leadId: lead.id,
        workerKind: "LEAD_DOSSIER_GENERATOR",
        status: { in: ["SUCCEEDED", "SUCCEEDED_NO_MEMORY"] },
      },
      orderBy: { finishedAt: "desc" },
      select: { outputJson: true },
    }),
    prisma.agentRun.findFirst({
      where: {
        workspaceId,
        leadId: lead.id,
        workerKind: "LEAD_INTELLIGENCE_BRIEF",
        status: { in: ["SUCCEEDED", "SUCCEEDED_NO_MEMORY"] },
      },
      orderBy: { finishedAt: "desc" },
      select: { outputJson: true },
    }),
  ]);

  // ---- Dossier teaser ------------------------------------------------------
  // Card stays a render-only teaser; the full markdown opens in Revint via
  // the deep link below. Keeps the 1 MB response envelope safe even for
  // dossiers with multi-thousand-word narratives.
  const dossierObj = asJsonObject(dossierRun?.outputJson);
  const dossierSummary = extractDossierSummary(dossierObj?.markdown ?? null);

  // ---- Head-agent pitch (with deterministic fallback) ----------------------
  // The mockup's "Pitch Angle" is a lead-specific sentence-style pitch,
  // which is what the Claude head agent emits as `talkTrack`. When it
  // hasn't run (non-F&B niche, flag off) we fall back to the most recent
  // `LeadNextAction.openingHook` (also AI-written), and finally to the
  // deterministic playbook `whenToPitch` so the field is never empty.
  const briefObj = asJsonObject(briefRun?.outputJson);
  const headAgent = asJsonObject(briefObj?.headAgent ?? null);
  const headAgentAngle =
    typeof headAgent?.primaryAngle === "string" && headAgent.primaryAngle.trim()
      ? String(headAgent.primaryAngle).trim()
      : null;
  const headAgentTalkTrack =
    typeof headAgent?.talkTrack === "string" && headAgent.talkTrack.trim()
      ? String(headAgent.talkTrack).trim()
      : null;

  const pitchHeadline = headAgentAngle ?? picked?.angle.label ?? null;
  const pitchSentence =
    headAgentTalkTrack ??
    nextAction?.openingHook ??
    picked?.angle.whenToPitch ??
    null;

  // ---- At-a-Glance + tech signals + links ----------------------------------
  const audit = lead.websiteAudit;
  const features = asRestaurantFeatures(audit?.rawFeaturesJson ?? null);
  const techSignals = buildTechSignals(features);
  const glanceChips = buildGlanceChips({
    audit: audit
      ? {
          hasContactForm: audit.hasContactForm,
          hasWhatsappLink: audit.hasWhatsappLink,
          loadTimeMs: audit.loadTimeMs ?? null,
        }
      : null,
    features,
    reasonCodes: opp?.reasonCodes ?? null,
    reviewLeadScore: review?.leadScore ?? null,
    packageName: recommendedPackage?.name ?? null,
  });
  const socialLinks = buildSocialLinks(audit?.socialProfiles ?? null);

  // ---- Deep-link URLs ------------------------------------------------------
  // The card uses these to render "See the full analysis" / "Continue
  // dossier in Revint" / "Open Action Sheet" actions. We pre-build them
  // here so the card never has to concatenate URLs in the iframe runtime.
  const baseActionUrl = actionSheetUrl(lead.id);
  const reviewsUrl = `${baseActionUrl}?tab=reviews`;
  const dossierUrl = `${baseActionUrl}?tab=overview#dossier`;

  return NextResponse.json({
    found: true,
    lead: {
      id: lead.id,
      businessName: lead.businessName,
    },
    actionSheetUrl: baseActionUrl,
    timing: {
      hoursSinceInbound,
      inboundReceivedAt: lead.inboundReceivedAt?.toISOString() ?? null,
      lastSyncedAt: lead.crmLastSyncedAt?.toISOString() ?? null,
    },
    signals: {
      temperature: lead.leadTemperature, // "HOT" | "WARM" | "COLD" | null
      salesConfidence: lead.salesConfidence ?? null,
      icpFitScore: lead.icpFitScore ?? null,
      stageKey: lead.playbookStageKey,
      stageLabel: stage?.label ?? null,
      subNicheSlug: lead.subNicheSlug,
      qualificationStatus: lead.qualification?.status ?? null,
      qualified: lead.qualification?.qualified ?? false,
      qualificationRisk: lead.qualification?.qualificationRisk ?? null,
      qualificationRiskReason,
      // Card UI expects uppercase HIGH/MEDIUM/LOW; storage holds
      // lowercase (low/medium/high) so map here.
      noShowRisk: lead.qualification?.noShowRisk?.toUpperCase() ?? null,
    },
    decision: {
      recommendedAngle: picked?.angle.label ?? null,
      recommendedAngleKey: picked?.angle.key ?? null,
      pitchThis: picked?.angle.whenToPitch ?? null,
      whatNotToPitch: picked?.angle.whenNotToPitch ?? null,
      nextBestAction: truncate(nextAction?.openingHook ?? null, MAX_HOOK_CHARS),
      nextBestActionConfidence: nextAction?.confidence ?? null,
      timingWindowStart: nextAction?.timingWindowStart?.toISOString() ?? null,
      timingWindowEnd: nextAction?.timingWindowEnd?.toISOString() ?? null,
      channel: nextAction?.actionKind ?? null,
      evidenceSummary:
        picked && picked.matchedTriggers.length > 0
          ? truncate(
              `Signals: ${picked.matchedTriggers.join(", ")}`,
              MAX_EVIDENCE_CHARS,
            )
          : null,
    },
    // AI-with-fallback pitch (head-agent talkTrack → opening hook → static
    // playbook `whenToPitch`). The card's "Pitch Angle" section reads this.
    pitch: {
      headline: pitchHeadline,
      sentence: truncate(pitchSentence, MAX_HOOK_CHARS),
    },
    // Analyst-recommended service package (name + price + why).
    package: recommendedPackage
      ? {
          name: recommendedPackage.name,
          priceLabel: recommendedPackage.priceLabel,
          reason: truncate(recommendedPackage.reason, MAX_HOOK_CHARS),
          features: recommendedPackage.features.slice(0, 6),
        }
      : null,
    // "Why they're a fit" + likely pain points (sales-opportunity scorer).
    fit: {
      opportunityScore: opp?.opportunityScore ?? null,
      expectedPriceBand: opp?.expectedPriceBand ?? null,
      whyGoodTarget: truncate(opp?.whyGoodTarget ?? null, MAX_EVIDENCE_CHARS),
      painPoints: asStringList(opp?.likelyPainPoints, 5),
    },
    // At-a-Glance chip strip — server-derived from audit wedges +
    // reasonCodes. See `buildGlanceChips` for the dedupe/suppression
    // rules (kept in lockstep with the in-app strip).
    glance: { chips: glanceChips },
    // F&B "Restaurant Tech Signals" tiles (QR menu / Reservation / Delivery).
    // `null` when the audit has no `rawFeaturesJson` so the card omits the
    // whole section for non-F&B leads.
    techSignals,
    // Google Maps URL + social-profile links rendered as small icon row
    // in the card header.
    links: {
      googleMapsUrl: lead.googleMapsUri ?? null,
      social: socialLinks,
    },
    // Dossier teaser. `summary` is the first paragraph of the markdown
    // narrative (capped at 280 chars); the full read happens in Revint.
    dossier:
      dossierSummary || dossierObj
        ? {
            summary: dossierSummary,
            url: dossierUrl,
          }
        : null,
    // Review Intelligence summary (review-analyst worker). Extended with
    // praise phrases + a deep link to the full analysis in Revint. The
    // verbose `summary` field is kept for backward compatibility but the
    // new card UI surfaces only sentiment + phrases on the card body.
    reviews: review
      ? {
          leadScore: review.leadScore ?? null,
          reviewsAnalyzed: review.reviewsAnalyzedCount ?? null,
          totalReviews: lead.reviewCount ?? null,
          rating: lead.rating ?? null,
          sentiment: {
            positive: sentimentPct(review.sentimentBreakdown, "positive"),
            neutral: sentimentPct(review.sentimentBreakdown, "neutral"),
            negative: sentimentPct(review.sentimentBreakdown, "negative"),
          },
          topComplaints: asKpis(review.weaknessKpis, 3),
          topPraise: asKpis(review.strengthKpis, 3),
          painPhrases: asStringList(review.painPhrases, 3),
          praisePhrases: asStringList(review.strengthPhrases, 3),
          summary: truncate(review.summary ?? null, MAX_EVIDENCE_CHARS),
          fullAnalysisUrl: reviewsUrl,
        }
      : null,
  });
}
