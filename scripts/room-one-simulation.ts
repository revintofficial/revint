// scripts/room-one-simulation.ts
/**
 * Read-only: runs the CURRENT Room 1 rules over the analyses already in
 * the database and prints how the decisions fall.
 *
 *   npx tsx scripts/room-one-simulation.ts "FineDine Beta"          # workspace by name
 *   npx tsx scripts/room-one-simulation.ts <workspaceId> --json      # per-lead rows
 *   npx tsx scripts/room-one-simulation.ts --all                     # every workspace
 *   npx tsx scripts/room-one-simulation.ts --all --relabel           # re-label stored reviews in memory
 *   npx tsx scripts/room-one-simulation.ts --all --relabel --max 10  # …at most 10 leads
 *
 * Nothing is written to the database. Every query is scoped to one
 * workspace. `--relabel` calls the review analyst's model on the stored
 * reviews of leads that have at least 30 of them and feeds the result to
 * Room 1 in memory, so the report shows what the current prompt and
 * counting would produce without re-running the chain (it costs model
 * tokens; older rows carry no categories or counts).
 *
 * Reports the three numbers of the v2 plan: the "no angle" rate, the
 * wedge distribution, and how many leads are stopped as hotel or chain.
 */
import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { analyzeReviewsWithGemini } from "@/lib/gemini";
import { loadMapFacts, toRoomOneAudit, loadOperatorSignals } from "@/lib/agent-workers/lead-intelligence-brief";
import { evaluateRoomOne, normalizePainPhrases, REVIEW_CORPUS_MIN } from "@/lib/ai-core/agent/head-agent";
import { toPainPhrases } from "@/lib/review-analysis/pain-phrases";
import { countReviewLabels, mergeLabelCounts, verifyPainQuotes } from "@/lib/review-analysis/quote-verify";

const RESTAURANT = /restaurant|cafe|coffee|bar\b|food|bakery|pizza|bistro|pub\b|diner|kebab|meal|steak|sushi|grill/i;

function pct(n: number, of: number): string {
  return of === 0 ? "0%" : `${Math.round((n / of) * 100)}%`;
}
function bump(into: Record<string, number>, key: string): void {
  into[key] = (into[key] ?? 0) + 1;
}
function table(head: string[], body: Array<Array<string | number>>): string {
  return [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...body.map((r) => `| ${r.join(" | ")} |`)].join("\n");
}

function loadLeads(workspaceId: string, relabel: boolean) {
  return prisma.lead.findMany({
    // With --relabel a lead needs stored reviews, not an existing analysis row.
    where: relabel ? { workspaceId, googleReviews: { some: {} } } : { workspaceId, reviewAnalysis: { isNot: null } },
    orderBy: { createdAt: "desc" },
    include: { websiteAudit: true, reviewAnalysis: true },
  });
}

async function main() {
  const args = process.argv.slice(2);
  const flagValues = new Set<string>();
  const maxAt = args.indexOf("--max");
  if (maxAt >= 0 && args[maxAt + 1]) flagValues.add(args[maxAt + 1]);
  const key = args.includes("--all") ? "--all" : args.find((a) => !a.startsWith("--") && !flagValues.has(a));
  if (!key) throw new Error('usage: room-one-simulation.ts <workspaceId | "workspace name" | --all> [--json] [--relabel [--max N]]');
  const relabel = args.includes("--relabel");
  const maxRelabel = maxAt >= 0 ? Math.max(1, Number(args[maxAt + 1]) || 1) : Number.POSITIVE_INFINITY;

  // "--all": every workspace, each queried under its own workspaceId.
  const workspaces =
    key === "--all"
      ? await prisma.workspace.findMany({ select: { id: true, name: true } })
      : [
          (await prisma.workspace.findUnique({ where: { id: key }, select: { id: true, name: true } })) ??
            (await prisma.workspace.findFirst({ where: { name: { equals: key, mode: "insensitive" } }, select: { id: true, name: true } })),
        ].filter((w): w is { id: string; name: string } => w !== null);
  if (workspaces.length === 0) throw new Error(`workspace not found: ${key}`);
  const title = key === "--all" ? `${workspaces.length} workspace` : workspaces[0].name;

  const leads: Array<Awaited<ReturnType<typeof loadLeads>>[number]> = [];
  for (const w of workspaces) leads.push(...(await loadLeads(w.id, relabel)));
  const restaurants = leads.filter(
    (l) => (l.nicheSlug ?? "").startsWith("fnb") || RESTAURANT.test(`${l.primaryType ?? ""} ${l.subNicheSlug ?? ""}`),
  );

  const rows: Array<Record<string, unknown>> = [];
  const wedges: Record<string, number> = {};
  const plans: Record<string, number> = {};
  const tiers: Record<string, number> = {};
  const operators: Record<string, number> = {};
  const signalKinds: Record<string, number> = {};
  const categoryLeads: Record<string, number> = {};
  let blocked = 0;
  let none = 0;
  let thinCorpus = 0;
  let withQuestions = 0;
  let assumed = 0;
  let relabelled = 0;
  let relabelFailed = 0;

  for (const lead of restaurants) {
    const workspaceId = lead.workspaceId;
    const map = await loadMapFacts(workspaceId, lead.id);
    const operator = await loadOperatorSignals(workspaceId, lead);
    const audit = toRoomOneAudit(lead as never, map.facts, operator);

    let corpus = lead.reviewAnalysis?.reviewsAnalyzedCount ?? 0;
    let phrases = normalizePainPhrases(lead.reviewAnalysis?.painPhrases);
    let labelInfo: Record<string, unknown> | null = null;

    if (relabel && relabelled < maxRelabel) {
      const reviews = await prisma.googleReview.findMany({
        where: { leadId: lead.id, lead: { workspaceId } },
        orderBy: { publishTime: "desc" },
        take: 200,
      });
      if (reviews.length >= REVIEW_CORPUS_MIN) {
        try {
          const analysis = await analyzeReviewsWithGemini({
            businessName: lead.businessName,
            address: lead.formattedAddress,
            rating: lead.rating,
            reviewCount: lead.reviewCount,
            reviews: reviews.map((r) => ({ authorName: r.authorName, rating: r.rating, text: r.text, relativeTime: r.relativeTime })),
            ourOffer: null,
            workspaceNiche: "RESTAURANT_TECH",
          });
          const refs = reviews.map((r) => ({ text: r.text, publishTime: r.publishTime }));
          const counts = countReviewLabels(analysis.reviewLabels ?? [], refs);
          const merged = mergeLabelCounts(verifyPainQuotes(toPainPhrases(analysis.painPhrases), refs), counts);
          phrases = normalizePainPhrases(merged);
          corpus = reviews.length;
          relabelled += 1;
          labelInfo = {
            labels: analysis.reviewLabels?.length ?? 0,
            complaintReviews: counts.complaintReviews,
            byCategory: Object.fromEntries(
              Object.entries(counts.byCategory).map(([k, v]) => [k, `${v.mentions} (son 12 ay: ${v.recentMentions ?? "?"})`]),
            ),
          };
          for (const k of Object.keys(counts.byCategory)) bump(categoryLeads, k);
        } catch (err) {
          relabelFailed += 1;
          console.error(`relabel failed for ${lead.businessName}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
    // Without --relabel only leads that already have an analysis row are loaded.
    if (!lead.reviewAnalysis && !labelInfo) continue;

    if (corpus < REVIEW_CORPUS_MIN) thinCorpus += 1;
    const ev = evaluateRoomOne({
      audit,
      reviews: { count: corpus, painPhrases: phrases },
      locationCount: operator.locationCount,
      size: { reviewCount: lead.reviewCount, priceLevel: lead.priceLevel },
    });
    const r1 = ev.output;
    bump(wedges, r1.wedge);
    bump(plans, r1.plan);
    bump(tiers, r1.tier ?? "-");
    bump(operators, audit?.operator ?? "unknown");
    for (const s of ev.wedgeSignals) bump(signalKinds, `${s.wedge}:${s.strength}:${s.source}`);
    if (ev.blocked) blocked += 1;
    if (r1.wedge === "none") none += 1;
    if (r1.wedge === "none" && ev.discoveryQuestions.length > 0) withQuestions += 1;
    if (r1.planAssumption) assumed += 1;
    rows.push({
      lead: lead.businessName,
      corpus,
      relabelled: labelInfo !== null,
      labels: labelInfo,
      operator: audit?.operator ?? null,
      operatorEvidence: audit?.operatorEvidence ?? null,
      wedge: r1.wedge,
      tier: r1.tier,
      plan: r1.plan,
      planAssumption: r1.planAssumption,
      backup: r1.backup,
      blocked: ev.blocked,
      blockReason: ev.blockReason,
      evidence: r1.evidence,
      questions: ev.discoveryQuestions,
    });
  }

  if (args.includes("--json")) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  const n = rows.length;
  const counts = (o: Record<string, number>) =>
    Object.entries(o)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => [k, v, pct(v, n)]);
  const open = n - blocked;
  console.log(
    [
      `# Oda 1 simülasyonu — ${title} (${n} restoran)`,
      [
        `Kaçak yok: ${none}/${n} (${pct(none, n)})`,
        `Engellenen (otel/zincir): ${blocked}`,
        `Aranabilir lead'lerde kaçak yok: ${none - blocked}/${open} (${pct(none - blocked, open)})`,
        `İnce corpus (<${REVIEW_CORPUS_MIN}): ${thinCorpus}`,
        `Keşif sorulu "yok" kartı: ${withQuestions}/${none - blocked}`,
        `Paket varsayımla: ${assumed}`,
        relabel ? `Yeniden etiketlenen: ${relabelled} (hata: ${relabelFailed})` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      "## Kaçak dağılımı",
      table(["Kaçak", "Adet", "Oran"], counts(wedges)),
      "## Kademe",
      table(["Kademe", "Adet", "Oran"], counts(tiers)),
      "## Paket",
      table(["Paket", "Adet", "Oran"], counts(plans)),
      "## Operatör",
      table(["Operatör", "Adet", "Oran"], counts(operators)),
      "## Seçilen kaçağın sinyalleri (kaçak:kuvvet:kaynak)",
      table(["Sinyal", "Adet", "Oran"], counts(signalKinds)),
      relabel ? "## Yeniden etiketlenen lead'lerde görülen şikayet kategorileri (lead sayısı)" : null,
      relabel ? table(["Kategori", "Lead", "Oran"], Object.entries(categoryLeads).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v, pct(v, relabelled)])) : null,
    ]
      .filter(Boolean)
      .join("\n\n"),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
