/**
 * FineDine v1 update — place-first ingestion of HubSpot leads.
 *
 * When HubSpot tells us about a contact/company (inbound webhook or a
 * manual sync), we try to match it to a Google Place first. On a
 * confident match we set `Lead.placeId` and fire the `lead_created`
 * chain (full restaurant analysis). On no/low-confidence match the lead
 * lives as a "CRM-only" row (no placeId, no analysis) until a later
 * match promotes it.
 *
 * Idempotency: leads dedup on `(workspaceId, crmContactId)` /
 * `(workspaceId, placeId)`; a `CrmSyncLog` row guards against duplicate
 * webhook deliveries.
 */
import type { PrismaClient } from "@/generated/prisma/client";
import type { PlaceResult } from "@/types";
import { textSearch, extractBoroughFromAddress, normalizePriceLevel } from "@/lib/google-places";
import { emit } from "@/lib/ai-core/events";
import { logger } from "@/lib/logger";

/** Minimum match confidence (0..1) to bind a Google Place to the lead. */
const MATCH_CONFIDENCE_THRESHOLD = 0.6;

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\b(restaurant|cafe|bar|grill|kitchen|the|ltd|limited)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function digitsOnly(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(a.split(" ").filter(Boolean));
  const tb = new Set(b.split(" ").filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let hit = 0;
  for (const t of ta) if (tb.has(t)) hit += 1;
  return hit / Math.max(ta.size, tb.size);
}

export interface PlaceMatch {
  place: PlaceResult;
  confidence: number;
}

/**
 * Best-effort match of a HubSpot business to a Google Place. Returns the
 * top candidate with a confidence score, or null when nothing clears the
 * threshold (or Places isn't configured). Confidence blends name overlap
 * with phone-number agreement.
 */
export async function matchGooglePlace(input: {
  businessName: string;
  address?: string | null;
  phone?: string | null;
}): Promise<PlaceMatch | null> {
  if (!process.env.GOOGLE_PLACES_API_KEY) return null;
  const queryText = [input.businessName, input.address].filter(Boolean).join(" ");
  if (!queryText.trim()) return null;

  let resp;
  try {
    resp = await textSearch({ textQuery: queryText, languageCode: "en" });
  } catch (err) {
    logger.warn("hubspot.ingest.place_search_failed", { err });
    return null;
  }
  const candidates = resp.places ?? [];
  if (candidates.length === 0) return null;

  const wantName = normalizeName(input.businessName);
  const wantPhone = digitsOnly(input.phone);

  let best: PlaceMatch | null = null;
  for (const place of candidates.slice(0, 5)) {
    const candName = normalizeName(place.displayName?.text ?? "");
    const nameScore = tokenOverlap(wantName, candName);
    const candPhone = digitsOnly(place.nationalPhoneNumber);
    const phoneMatch =
      wantPhone.length >= 7 &&
      candPhone.length >= 7 &&
      wantPhone.slice(-9) === candPhone.slice(-9);
    // Name carries most of the weight; a phone match is a strong
    // corroborator that lifts an otherwise-borderline name match.
    const confidence = Math.min(1, nameScore * 0.7 + (phoneMatch ? 0.4 : 0));
    if (!best || confidence > best.confidence) {
      best = { place, confidence };
    }
  }

  if (best && best.confidence >= MATCH_CONFIDENCE_THRESHOLD) return best;
  return null;
}

export interface IngestInput {
  workspaceId: string;
  crmContactId?: string | null;
  crmCompanyId?: string | null;
  crmDealId?: string | null;
  crmOwnerId?: string | null;
  crmStageId?: string | null;
  businessName: string;
  address?: string | null;
  phone?: string | null;
  websiteUrl?: string | null;
  leadSource?: string;
  inboundReceivedAt?: Date | null;
}

export interface IngestResult {
  leadId: string;
  created: boolean;
  matched: boolean;
  placeId: string | null;
  confidence: number | null;
}

/**
 * Ingest a HubSpot lead with place-first matching. Resolution order:
 *   1. If a confident Google Place match exists and a lead already has
 *      that placeId → link CRM ids onto it.
 *   2. Else if a lead already exists for this contact id → update it
 *      (re-delivery / enrichment).
 *   3. Else create a new lead (place-matched → analysis fires; otherwise
 *      CRM-only, no analysis).
 */
export async function ingestHubspotLead(
  prisma: PrismaClient,
  input: IngestInput,
): Promise<IngestResult> {
  const { workspaceId } = input;

  const match = await matchGooglePlace({
    businessName: input.businessName,
    address: input.address,
    phone: input.phone,
  });
  const placeId = match?.place.id ?? null;

  const crmFields = {
    crmContactId: input.crmContactId ?? null,
    crmCompanyId: input.crmCompanyId ?? null,
    crmDealId: input.crmDealId ?? null,
    crmOwnerId: input.crmOwnerId ?? null,
    crmStageId: input.crmStageId ?? null,
    leadSource: input.leadSource ?? "HUBSPOT_INBOUND",
    inboundReceivedAt: input.inboundReceivedAt ?? new Date(),
    crmLastSyncedAt: new Date(),
  };

  // Derived place fields (only when matched).
  const placeData = match
    ? {
        placeId: match.place.id,
        businessName: match.place.displayName?.text || input.businessName,
        formattedAddress: match.place.formattedAddress || input.address || "",
        borough: extractBoroughFromAddress(
          match.place.formattedAddress || "",
          match.place.addressComponents,
        ),
        phone: match.place.nationalPhoneNumber || input.phone || null,
        websiteUrl: match.place.websiteUri || input.websiteUrl || null,
        hasWebsite: !!(match.place.websiteUri || input.websiteUrl),
        googleMapsUri: match.place.googleMapsUri || null,
        rating: match.place.rating || null,
        reviewCount: match.place.userRatingCount || null,
        businessStatus: match.place.businessStatus || null,
        primaryType: match.place.primaryType || null,
        priceLevel: normalizePriceLevel(match.place.priceLevel),
        crawlStatus: (match.place.websiteUri || input.websiteUrl
          ? "PENDING"
          : "NO_WEBSITE") as "PENDING" | "NO_WEBSITE",
      }
    : null;

  // 1 / 2 — find an existing lead to link/update.
  let existing = placeId
    ? await prisma.lead.findUnique({
        where: { workspaceId_placeId: { workspaceId, placeId } },
        select: { id: true, placeId: true },
      })
    : null;
  if (!existing && input.crmContactId) {
    existing = await prisma.lead.findUnique({
      where: {
        workspaceId_crmContactId: { workspaceId, crmContactId: input.crmContactId },
      },
      select: { id: true, placeId: true },
    });
  }

  if (existing) {
    const wasUnmatched = !existing.placeId;
    await prisma.lead.update({
      where: { id: existing.id },
      data: {
        ...crmFields,
        ...(placeData && wasUnmatched ? placeData : {}),
      },
    });
    // Promote a CRM-only lead to analyzed once it gets a place.
    if (placeData && wasUnmatched) {
      void emit("lead_created", { workspaceId, leadId: existing.id }).catch((err) => {
        logger.error("hubspot.ingest.emit_failed", { leadId: existing!.id, err });
      });
    }
    return {
      leadId: existing.id,
      created: false,
      matched: !!placeId,
      placeId: existing.placeId ?? placeId,
      confidence: match?.confidence ?? null,
    };
  }

  // 3 — create. CRM-only when no place match.
  const lead = await prisma.lead.create({
    data: placeData
      ? { workspaceId, ...placeData, ...crmFields }
      : {
          workspaceId,
          placeId: null,
          businessName: input.businessName,
          formattedAddress: input.address || "",
          phone: input.phone || null,
          websiteUrl: input.websiteUrl || null,
          hasWebsite: !!input.websiteUrl,
          // CRM-only: no Google Place yet → skip the analysis pipeline.
          crawlStatus: "NO_WEBSITE",
          analyzeStatus: "PENDING",
          ...crmFields,
        },
    select: { id: true },
  });

  if (placeData) {
    void emit("lead_created", { workspaceId, leadId: lead.id }).catch((err) => {
      logger.error("hubspot.ingest.emit_failed", { leadId: lead.id, err });
    });
  }

  return {
    leadId: lead.id,
    created: true,
    matched: !!placeId,
    placeId,
    confidence: match?.confidence ?? null,
  };
}
