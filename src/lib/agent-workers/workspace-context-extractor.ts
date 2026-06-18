/**
 * WORKSPACE_CONTEXT_EXTRACTOR worker.
 *
 * Workspace-level (leadId = null) calibration worker for the onboarding
 * wizard. Crawls the seller's company domain + pricing page, asks Gemini for
 * a structured ICP + service-package draft, and writes those drafts into
 * `WorkspaceOnboardingDraft` for the user to review/confirm. AI predictions
 * live ONLY in the draft store here — they never touch the real
 * IdealCustomerProfile / ServicePackage rows until the user confirms them.
 *
 * Graceful degradation: any crawl / extraction failure marks the draft FAILED
 * (so the wizard falls back to manual entry) and returns a SUCCEEDED skip
 * instead of throwing, so BullMQ doesn't retry-loop on a bad domain.
 *
 * Multi-tenant: company inputs are re-derived from the Workspace row by
 * `ctx.workspaceId` (never trusted from the job payload), and every write is
 * scoped to `ctx.workspaceId`.
 */
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { safeFetchFollow } from "@/lib/safe-fetch";
import { getStructuredInferenceProvider, type SchemaDefinition } from "@/lib/ai-core/providers";
import { sanitizeIcpDraft } from "@/lib/onboarding/icp";
import { sanitizePackageDrafts } from "@/lib/onboarding/packages";
import type { CompanyContext } from "@/lib/onboarding/types";
import type { AgentWorkerOutput, AgentWorkerRun } from "./types";

const MAX_PAGE_CHARS = 8000;

/** Fetch a page and reduce it to plain text. Returns null on any failure. */
async function fetchPageText(url: string): Promise<string | null> {
  try {
    const { response } = await safeFetchFollow(url, {
      init: {
        headers: { "user-agent": "RevintBot/1.0 (+https://revint.app)" },
      },
      perHopTimeoutMs: 12_000,
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return null;
    }
    const html = await response.text();
    return htmlToText(html).slice(0, MAX_PAGE_CHARS);
  } catch (err) {
    logger.warn("agent_workers.workspace_context_extractor.fetch_failed", {
      url,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Strip scripts/styles/tags and collapse whitespace into readable text. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

const EXTRACTION_SCHEMA: SchemaDefinition = {
  type: "OBJECT",
  properties: {
    company: {
      type: "OBJECT",
      properties: {
        summary: { type: "STRING" },
        valueProposition: { type: "STRING" },
        targetCustomers: { type: "STRING" },
      },
    },
    icp: {
      type: "OBJECT",
      properties: {
        description: { type: "STRING" },
        highValueSignals: { type: "ARRAY", items: { type: "STRING" } },
        negativeSignals: { type: "ARRAY", items: { type: "STRING" } },
        confidence: { type: "NUMBER" },
      },
      required: ["description"],
    },
    packages: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          priceLabel: { type: "STRING" },
          features: { type: "ARRAY", items: { type: "STRING" } },
          isPopular: { type: "BOOLEAN" },
          confidence: { type: "NUMBER" },
        },
        required: ["name"],
      },
    },
  },
  required: ["icp"],
};

interface ExtractionResult {
  company?: {
    summary?: string;
    valueProposition?: string;
    targetCustomers?: string;
  };
  icp: {
    description: string;
    highValueSignals?: string[];
    negativeSignals?: string[];
    confidence?: number;
  };
  packages?: Array<{
    name: string;
    priceLabel?: string;
    features?: string[];
    isPopular?: boolean;
    confidence?: number;
  }>;
}

async function markFailed(workspaceId: string, message: string): Promise<void> {
  await prisma.workspaceOnboardingDraft.upsert({
    where: { workspaceId },
    create: { workspaceId, status: "FAILED", error: message },
    update: { status: "FAILED", error: message },
  });
}

export const run: AgentWorkerRun = async (ctx): Promise<AgentWorkerOutput> => {
  const { workspaceId } = ctx;

  // Re-derive the company inputs from the row (never trust the payload).
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { companyName: true, companyDomain: true, pricingPageUrl: true, name: true },
  });

  if (!workspace?.companyDomain) {
    await markFailed(workspaceId, "No company website on file. Add your ICP and packages manually.");
    return { output: { skipped: true, reason: "no_company_domain" }, costTokens: 0 };
  }

  // Crawl homepage + pricing page (pricing optional).
  const [homeText, pricingText] = await Promise.all([
    fetchPageText(workspace.companyDomain),
    workspace.pricingPageUrl ? fetchPageText(workspace.pricingPageUrl) : Promise.resolve(null),
  ]);

  if (!homeText && !pricingText) {
    await markFailed(
      workspaceId,
      "We couldn't read your website. Add your ICP and packages manually below.",
    );
    return { output: { skipped: true, reason: "crawl_failed" }, costTokens: 0 };
  }

  const sources: { url: string; evidence: string }[] = [];
  if (homeText) sources.push({ url: workspace.companyDomain, evidence: homeText.slice(0, 280) });
  if (pricingText && workspace.pricingPageUrl) {
    sources.push({ url: workspace.pricingPageUrl, evidence: pricingText.slice(0, 280) });
  }

  const prompt = `You are calibrating a B2B sales-intelligence workspace for a company that sells services to other businesses. Using ONLY the website content below, draft:

1. An Ideal Customer Profile (ICP) describing the company's best-fit customers: who they are, their use cases, the customer types to exclude, and the vertical language they use. Write "icp.description" as a clear paragraph the seller can read and edit. Add concrete "highValueSignals" (things that make a prospect a great fit) and "negativeSignals" (disqualifiers). Set "confidence" 0..1.
2. The service packages / plans the company sells, from the pricing content if present: name, priceLabel (keep the company's own wording, e.g. "From $499/mo"), features (short bullets), and whether it's the popular tier. If no pricing is visible, return an empty packages array.

Company name: ${workspace.companyName || workspace.name}

=== HOMEPAGE / SITE CONTENT ===
${homeText ?? "(unavailable)"}

=== PRICING PAGE CONTENT ===
${pricingText ?? "(unavailable)"}

Return JSON only.`;

  let result: ExtractionResult;
  let costTokens = 0;
  try {
    const provider = getStructuredInferenceProvider();
    const inference = await provider.structuredInfer<ExtractionResult>({
      prompt,
      schema: EXTRACTION_SCHEMA,
      temperature: 0.3,
      maxTokens: 2048,
      timeoutMs: 40_000,
      label: "workspace_context_extractor",
    });
    result = inference.data;
    costTokens = inference.tokensIn + inference.tokensOut;
  } catch (err) {
    logger.warn("agent_workers.workspace_context_extractor.gemini_failed", {
      workspaceId,
      err: err instanceof Error ? err.message : String(err),
    });
    await markFailed(
      workspaceId,
      "Automatic calibration didn't finish. Add your ICP and packages manually below.",
    );
    return { output: { skipped: true, reason: "extraction_failed" }, costTokens: 0 };
  }

  // Shape the model output into our draft contracts (sanitized + clamped).
  const icpDraft = sanitizeIcpDraft({
    description: result.icp?.description ?? "",
    highValueSignals: result.icp?.highValueSignals ?? [],
    negativeSignals: result.icp?.negativeSignals ?? [],
    confidence: result.icp?.confidence,
    sources,
  });

  const { packages } = sanitizePackageDrafts(
    (result.packages ?? []).map((p, i) => ({
      ...p,
      sortOrder: i,
      sourceUrl: workspace.pricingPageUrl ?? workspace.companyDomain,
    })),
  );

  const warnings: string[] = [];
  if (packages.length === 0) {
    warnings.push("No packages were detected from your pricing page — add them manually.");
  }

  const companyContext: CompanyContext = {
    companyName: workspace.companyName ?? undefined,
    summary: result.company?.summary,
    valueProposition: result.company?.valueProposition,
    targetCustomers: result.company?.targetCustomers,
    warnings: warnings.length ? warnings : undefined,
    sources,
  };

  await prisma.workspaceOnboardingDraft.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      status: "READY",
      error: null,
      companyContextJson: companyContext as never,
      icpDraftJson: icpDraft as never,
      packagesDraftJson: packages as never,
    },
    update: {
      status: "READY",
      error: null,
      companyContextJson: companyContext as never,
      icpDraftJson: icpDraft as never,
      packagesDraftJson: packages as never,
    },
  });

  logger.info("agent_workers.workspace_context_extractor.done", {
    workspaceId,
    packagesFound: packages.length,
    icpConfidence: icpDraft.confidence ?? null,
  });

  return {
    output: {
      icpConfidence: icpDraft.confidence ?? null,
      packagesFound: packages.length,
      warnings,
    },
    costTokens,
  };
};
