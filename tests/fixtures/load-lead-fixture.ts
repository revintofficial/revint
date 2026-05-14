/**
 * Fixture loader for Truth Layer v1 reference leads.
 *
 * Wave 0 (Foundation) ships 3 reference fixtures used by every Wave 1
 * track's tests:
 *   - greenwich-morning: NBA gates / locale / website-verify edge cases
 *   - casa-polanco:      regression baseline + grounded painPoints
 *   - maido-bar:         high-traffic operator / inbound switch direction
 *
 * Each fixture is a typed projection of the inputs Truth Layer workers
 * actually consume — NOT a full Prisma row. This keeps fixtures small
 * and focused; tests call `loadLeadFixture("greenwich-morning")` and
 * pass the relevant slice into the worker under test.
 */

import fs from "node:fs";
import path from "node:path";

import type {
  WebsiteVerificationStatus,
  WebsiteVerificationSourceCheck,
} from "@/lib/sdr-brain/contracts";

export type LeadFixtureId = "greenwich-morning" | "casa-polanco" | "maido-bar";

export interface LeadFixture {
  fixtureId: LeadFixtureId;
  name: string;
  description: string;
  lead: {
    id: string;
    workspaceId: string;
    placeId: string;
    businessName: string;
    formattedAddress: string;
    borough: string | null;
    phone: string | null;
    websiteUrl: string | null;
    hasWebsite: boolean;
    websiteVerificationStatus: WebsiteVerificationStatus | null;
    googleMapsUri: string | null;
    rating: number | null;
    reviewCount: number | null;
    businessStatus: string | null;
    primaryType: string | null;
    priceLevel: number | null;
    country: string | null;
    nicheSlug: string | null;
    subNicheSlug: string | null;
    icpFitScore: number | null;
    salesConfidence: number | null;
  };
  workspace: {
    id: string;
    name: string;
    country: string | null;
    defaultLocale: string;
    niche: string;
  };
  reviewAnalysis: {
    reviewsAnalyzedCount: number;
    weaknessKpis: Array<{ label: string; count?: number; percent?: number }>;
    strengthKpis: Array<{ label: string; count?: number; percent?: number }>;
    sentimentBreakdown: { positive: number; neutral: number; negative: number };
    painPhrases: string[];
    switchSignals: string[];
    leadScore: number;
    _negCount: number;
    _totalCount: number;
    _ownerReplyExample?: string;
  };
  triggers: Array<{
    type: string;
    severity: number;
    confidence: number;
    detectedAt: string;
    urgencyWindowDays: number | null;
  }>;
  stakeholders: Array<{
    isEconomicBuyer: boolean;
    championLikelihood: number | null;
    influence: number | null;
  }>;
  websiteVerificationSources: WebsiteVerificationSourceCheck[];
}

const FIXTURES_DIR = path.join(process.cwd(), "tests", "fixtures", "leads");

const cache = new Map<LeadFixtureId, LeadFixture>();

export function loadLeadFixture(id: LeadFixtureId): LeadFixture {
  const cached = cache.get(id);
  if (cached) return cached;
  const file = path.join(FIXTURES_DIR, `${id}.json`);
  const raw = fs.readFileSync(file, "utf8");
  const parsed = JSON.parse(raw) as LeadFixture;
  if (parsed.fixtureId !== id) {
    throw new Error(
      `Fixture file ${file} has mismatched fixtureId "${parsed.fixtureId}" (expected "${id}")`,
    );
  }
  cache.set(id, parsed);
  return parsed;
}

export function loadAllLeadFixtures(): LeadFixture[] {
  return (
    ["greenwich-morning", "casa-polanco", "maido-bar"] as const
  ).map(loadLeadFixture);
}
