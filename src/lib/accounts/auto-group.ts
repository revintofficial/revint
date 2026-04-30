import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * Phase 2 — best-effort auto-group during discovery.
 *
 * When a new lead has a websiteUrl we extract the apex domain and
 * look for an existing Account in the same workspace with a matching
 * `apexDomain`. If we find one, we link the lead. If we don't and
 * there are already 2+ leads in this workspace pointing at the same
 * apex domain, we MAYBE create an Account on the fly (only when the
 * count crosses 3 — below that the user might genuinely have two
 * unrelated leads, like two restaurants under "linkedin.com").
 *
 * Designed to be cheap (one or two queries per lead) and called
 * AFTER the lead row is created so the auto-group is opportunistic.
 * Never blocks discovery — failures are logged and swallowed.
 */
export function extractApexDomain(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (!host || host.includes(":")) return null;
    // Reject too-generic / aggregator hosts that would over-group.
    const blacklist = [
      "linkedin.com",
      "facebook.com",
      "instagram.com",
      "tripadvisor.com",
      "yelp.com",
      "google.com",
      "apple.com",
      "wix.com",
      "squarespace.com",
      "wordpress.com",
      "shopify.com",
    ];
    if (blacklist.some((b) => host === b || host.endsWith(`.${b}`))) {
      return null;
    }
    return host;
  } catch {
    return null;
  }
}

export async function autoGroupLeadIntoAccount(leadId: string, workspaceId: string): Promise<void> {
  try {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId },
      select: { id: true, websiteUrl: true, businessName: true, accountId: true },
    });
    if (!lead || lead.accountId) return;

    const apex = extractApexDomain(lead.websiteUrl);
    if (!apex) return;

    // Existing match.
    const existing = await prisma.account.findFirst({
      where: { workspaceId, apexDomain: apex, archivedAt: null },
      select: { id: true },
    });
    if (existing) {
      await prisma.lead.update({
        where: { id: leadId },
        data: { accountId: existing.id },
      });
      logger.info("accounts.auto_group.matched_existing", {
        leadId,
        accountId: existing.id,
        apex,
      });
      return;
    }

    // Cluster discovery: are there 2+ siblings already? If yes, mint
    // a new Account and pull all of them in.
    const sameApexLeads = await prisma.lead.findMany({
      where: {
        workspaceId,
        accountId: null,
        websiteUrl: { contains: apex },
      },
      select: { id: true, businessName: true },
      take: 10,
    });
    if (sameApexLeads.length < 3) return;

    // Use the most common business-name token as the brand name —
    // dumb heuristic but works for FineDine's scenario where the
    // brand name shows up in every location's businessName.
    const brand = pickBrandNameFromLeads(sameApexLeads);
    const account = await prisma.account.create({
      data: {
        workspaceId,
        name: brand ?? apex,
        apexDomain: apex,
      },
    });
    await prisma.lead.updateMany({
      where: { id: { in: sameApexLeads.map((l) => l.id) } },
      data: { accountId: account.id },
    });

    logger.info("accounts.auto_group.created_account", {
      accountId: account.id,
      apex,
      siblingCount: sameApexLeads.length,
    });
  } catch (err) {
    logger.warn("accounts.auto_group.failed", {
      leadId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

function pickBrandNameFromLeads(leads: Array<{ businessName: string }>): string | null {
  if (leads.length === 0) return null;
  // Tokenize each name, keep tokens that appear in >50% of the leads.
  const tokenCounts = new Map<string, number>();
  for (const lead of leads) {
    const tokens = new Set(
      lead.businessName
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 2),
    );
    for (const token of tokens) {
      tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
    }
  }
  const threshold = Math.ceil(leads.length / 2);
  const shared = [...tokenCounts.entries()]
    .filter(([, c]) => c >= threshold)
    .map(([t]) => t);
  if (shared.length === 0) return leads[0].businessName;
  return shared
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
    .join(" ");
}
