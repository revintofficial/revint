/**
 * One-shot diagnostic: dump every Phase-0..3 artifact for a single
 * lead so we can pinpoint exactly which worker silently fell over.
 *
 * Usage:
 *   npx tsx scripts/diag-lead-brain.ts <leadId>
 *
 * Reads the same Railway DB the Next.js dev server uses (.env
 * DATABASE_URL). Multi-tenant safe: emits the workspaceId of the
 * lead and asserts every row read carries the same workspaceId.
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";

async function main() {
  const leadId = process.argv[2]?.trim();
  if (!leadId) throw new Error("Usage: npx tsx scripts/diag-lead-brain.ts <leadId>");

  const lead = await prisma.lead.findFirst({
    where: { id: leadId },
    include: {
      websiteAudit: { select: { id: true, createdAt: true, title: true, servicesDetected: true } },
      salesOpportunity: {
        select: {
          id: true,
          opportunityScore: true,
          whyGoodTarget: true,
          likelyPainPoints: true,
          reasonCodes: true,
          suggestedOffer: true,
        },
      },
      reviewAnalysis: {
        select: {
          id: true,
          leadScore: true,
          painPhrases: true,
          weaknessKpis: true,
          switchSignals: true,
        },
      },
      account: { select: { id: true, name: true, tier: true, locationsCount: true } },
    },
  });
  if (!lead) {
    console.log(`Lead ${leadId} not found.`);
    return;
  }

  console.log(`\n=== Lead "${lead.businessName}" (${lead.id})`);
  console.log(`workspaceId: ${lead.workspaceId}`);
  console.log(`pipelineStatus: ${lead.pipelineStatus}`);
  console.log(`hasWebsite: ${lead.hasWebsite}  priceLevel: ${lead.priceLevel}  reviewCount: ${lead.reviewCount}  rating: ${lead.rating}`);
  console.log(`icpFitScore: ${lead.icpFitScore}  salesConfidence: ${lead.salesConfidence}`);
  console.log(`createdAt: ${lead.createdAt.toISOString()}`);

  console.log("\n--- websiteAudit ---");
  console.log(
    lead.websiteAudit
      ? `id=${lead.websiteAudit.id}  createdAt=${lead.websiteAudit.createdAt.toISOString()}  title="${lead.websiteAudit.title}"`
      : "NULL",
  );

  console.log("\n--- salesOpportunity ---");
  if (lead.salesOpportunity) {
    console.log(
      `id=${lead.salesOpportunity.id}  opportunityScore=${lead.salesOpportunity.opportunityScore}  suggestedOffer=${lead.salesOpportunity.suggestedOffer}`,
    );
    console.log(`whyGoodTarget: ${lead.salesOpportunity.whyGoodTarget?.slice(0, 200) ?? "null"}`);
    console.log(`likelyPainPoints: ${JSON.stringify(lead.salesOpportunity.likelyPainPoints).slice(0, 300)}`);
    console.log(`reasonCodes: ${JSON.stringify(lead.salesOpportunity.reasonCodes)}`);
  } else {
    console.log("NULL");
  }

  console.log("\n--- reviewAnalysis ---");
  if (lead.reviewAnalysis) {
    const pp = lead.reviewAnalysis.painPhrases as unknown[];
    const wk = lead.reviewAnalysis.weaknessKpis as unknown[];
    const ss = lead.reviewAnalysis.switchSignals as unknown[];
    console.log(`id=${lead.reviewAnalysis.id}  leadScore=${lead.reviewAnalysis.leadScore}`);
    console.log(`painPhrases (${Array.isArray(pp) ? pp.length : "n/a"}): ${JSON.stringify(pp).slice(0, 250)}`);
    console.log(`weaknessKpis (${Array.isArray(wk) ? wk.length : "n/a"}): ${JSON.stringify(wk).slice(0, 250)}`);
    console.log(`switchSignals (${Array.isArray(ss) ? ss.length : "n/a"}): ${JSON.stringify(ss).slice(0, 250)}`);
  } else {
    console.log("NULL");
  }

  console.log("\n--- account ---");
  console.log(lead.account ? `id=${lead.account.id} tier=${lead.account.tier} locationsCount=${lead.account.locationsCount}` : "NULL");

  console.log("\n--- LeadTrigger rows ---");
  const triggers = await prisma.leadTrigger.findMany({
    where: { workspaceId: lead.workspaceId, leadId: lead.id },
    orderBy: { detectedAt: "desc" },
    select: { id: true, type: true, severity: true, confidence: true, decayedAt: true, detectedAt: true },
    take: 20,
  });
  if (triggers.length === 0) console.log("(none)");
  for (const t of triggers) {
    console.log(`  ${t.detectedAt.toISOString()}  ${t.type}  sev=${t.severity}  conf=${t.confidence}  decayed=${t.decayedAt?.toISOString() ?? "no"}`);
  }

  console.log("\n--- LeadNextAction rows (newest first) ---");
  const nbas = await prisma.leadNextAction.findMany({
    where: { workspaceId: lead.workspaceId, leadId: lead.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      version: true,
      isPreliminary: true,
      actionKind: true,
      channel: true,
      confidence: true,
      supersededAt: true,
      predictedObjections: true,
      qualificationGap: true,
      createdAt: true,
    },
    take: 5,
  });
  if (nbas.length === 0) console.log("(none)");
  for (const n of nbas) {
    console.log(
      `  v${n.version} ${n.isPreliminary ? "PRELIM" : "FINAL "} ${n.actionKind} ${n.channel ?? "-"} conf=${n.confidence} superseded=${n.supersededAt ? "yes" : "no"} createdAt=${n.createdAt.toISOString()}`,
    );
    console.log(`    predictedObjections=${JSON.stringify(n.predictedObjections)}`);
    console.log(`    qualificationGap=${JSON.stringify(n.qualificationGap)}`);
  }

  console.log("\n--- Stakeholder rows ---");
  const stakeholders = await prisma.stakeholder.findMany({
    where: { workspaceId: lead.workspaceId, leadId: lead.id },
    select: { id: true, name: true, role: true, isEconomicBuyer: true, championLikelihood: true, influence: true },
    take: 10,
  });
  if (stakeholders.length === 0) console.log("(none)");
  for (const s of stakeholders) {
    console.log(`  role=${s.role ?? "?"} | ${s.name ?? "?"} | ec=${s.isEconomicBuyer} champ=${s.championLikelihood} infl=${s.influence}`);
  }

  console.log("\n--- AgentRun rows (last 25 for this lead, newest first) ---");
  const runs = await prisma.agentRun.findMany({
    where: { workspaceId: lead.workspaceId, leadId: lead.id },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      workerKind: true,
      status: true,
      errorMsg: true,
      startedAt: true,
      finishedAt: true,
    },
    take: 30,
  });
  if (runs.length === 0) console.log("(none)");
  for (const r of runs) {
    const dur =
      r.finishedAt && r.startedAt
        ? `${Math.round((r.finishedAt.getTime() - r.startedAt.getTime()) / 1000)}s`
        : "-";
    const err = r.errorMsg ? ` ERR=${r.errorMsg.slice(0, 160)}` : "";
    console.log(
      `  ${r.startedAt?.toISOString() ?? "n/a"}  ${r.workerKind.padEnd(28)} ${r.status.padEnd(10)} ${dur}${err}`,
    );
  }

  console.log("\n--- Recent PlannerSessions for this lead ---");
  const sessions = await prisma.plannerSession.findMany({
    where: { workspaceId: lead.workspaceId, leadId: lead.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, event: true, status: true, createdAt: true },
    take: 5,
  });
  if (sessions.length === 0) console.log("(none)");
  for (const s of sessions) {
    console.log(`  ${s.createdAt.toISOString()}  ${s.event.padEnd(25)} ${s.status}`);
  }
}

main()
  .catch((e) => {
    console.error("FATAL:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
