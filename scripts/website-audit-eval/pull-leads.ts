// scripts/website-audit-eval/pull-leads.ts
/**
 * Read-only: list restaurant/cafe leads with a website in one workspace,
 * plus the stored WebsiteAudit summary, for the website-audit accuracy eval.
 *
 *   npx tsx scripts/website-audit-eval/pull-leads.ts "<workspace name>" [limit] > leads.json
 *
 * Writes nothing. Every Lead / WebsiteAudit query is scoped by workspaceId.
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";

async function main() {
  const name = process.argv[2] ?? "FineDine Beta";
  const limit = Number(process.argv.find((a, i) => i > 2 && /^\d+$/.test(a)) ?? 60);
  const workspaces = await prisma.workspace.findMany({
    where: { name: { contains: name, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (workspaces.length === 0) throw new Error(`no workspace named like ${name}`);
  const ws = workspaces[0];
  const leads = await prisma.lead.findMany({
    where: {
      workspaceId: ws.id,
      websiteUrl: { not: null },
      ...(process.argv.includes("--any") ? {} : { websiteAudit: { isNot: null } }),
    },
    select: {
      id: true,
      businessName: true,
      websiteUrl: true,
      primaryType: true,
      formattedAddress: true,
      websiteAudit: {
        select: {
          reachable: true,
          crawlError: true,
          bookingProvider: true,
          hasBookingSystem: true,
          rawFeaturesJson: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  const out = leads.map((l) => {
    const raw = (l.websiteAudit?.rawFeaturesJson ?? {}) as Record<string, unknown>;
    return {
      id: l.id,
      name: l.businessName,
      url: l.websiteUrl,
      type: l.primaryType,
      address: l.formattedAddress,
      audit: l.websiteAudit
        ? {
            reachable: l.websiteAudit.reachable,
            crawlError: l.websiteAudit.crawlError,
            bookingProvider: l.websiteAudit.bookingProvider,
            hasBookingSystem: l.websiteAudit.hasBookingSystem,
            detectedMenuTool: raw.detectedMenuTool ?? null,
            hasQrMenu: raw.hasQrMenu ?? null,
            hasOnlineOrdering: raw.hasOnlineOrdering ?? null,
            siteFacts: raw.siteFacts ?? null,
          }
        : null,
    };
  });
  console.log(JSON.stringify({ workspace: ws, all: workspaces, leads: out }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
