// Shared types for the Deals kanban board + side panel. Mirrors the JSON
// shape returned by GET /api/watchlist.

export type PipelineStage = "NEW" | "REACHED_OUT" | "IN_TALKS" | "WON" | "LOST";

export type OfferValue = "STARTER" | "GROWTH" | "SALES";

export interface DealLeadSummary {
  id: string;
  businessName: string;
  formattedAddress: string;
  borough: string | null;
  phone: string | null;
  websiteUrl: string | null;
  googleMapsUri: string | null;
  analyzeStatus: string;
  salesOpportunity: {
    opportunityScore: number;
    suggestedOffer: string;
    status: string;
    whyGoodTarget?: string | null;
    likelyPainPoints?: string[];
    bestSalesAngle?: string | null;
    personalizedFirstMessage?: string | null;
    expectedPriceBand?: string | null;
    reasonCodes?: string[];
  } | null;
}

export interface DealItem {
  id: string;
  leadId: string;
  siteUrl: string | null;
  notes: string | null;
  websitePlan: string | null;
  pipelineNotes: string | null;
  selectedOffer: OfferValue | null;
  meetingResult: "POSITIVE" | "NEGATIVE" | "IN_PROGRESS" | null;
  pipelineStage: PipelineStage;
  stageOrder: number;
  createdAt: string;
  updatedAt: string;
  lead: DealLeadSummary;
}
