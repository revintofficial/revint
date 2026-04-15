import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync } from "fs";
import { resolve } from "path";
import "dotenv/config";

const BACKUP_PATH = resolve(
  process.env.BACKUP_PATH ||
    "C:/Users/meert/Downloads/lead-engine-backup-2026-04-15T00-00-23.json"
);

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

interface BackupData {
  exportedAt: string;
  tables: {
    leads: any[];
    websiteAudits: any[];
    salesOpportunities: any[];
    watchlistItems: any[];
    googleReviews: any[];
    teamTodos: any[];
  };
}

async function main() {
  console.log(`Reading backup from: ${BACKUP_PATH}`);
  const raw = readFileSync(BACKUP_PATH, "utf-8");
  const backup: BackupData = JSON.parse(raw);
  console.log(`Backup exported at: ${backup.exportedAt}`);

  const { leads, salesOpportunities, watchlistItems, googleReviews, teamTodos } =
    backup.tables;

  // --- 1. Leads ---
  console.log(`\nSeeding ${leads.length} leads...`);
  let leadCount = 0;
  for (const l of leads) {
    await prisma.lead.upsert({
      where: { placeId: l.placeId },
      update: {},
      create: {
        id: l.id,
        placeId: l.placeId,
        businessName: l.businessName,
        formattedAddress: l.formattedAddress,
        borough: l.borough,
        phone: l.phone,
        websiteUrl: l.websiteUrl,
        hasWebsite: l.hasWebsite,
        googleMapsUri: l.googleMapsUri,
        rating: l.rating,
        reviewCount: l.reviewCount,
        businessStatus: l.businessStatus,
        primaryType: l.primaryType,
        sourceQuery: l.sourceQuery,
        sourceLat: l.sourceLat,
        sourceLng: l.sourceLng,
        crawlStatus: l.crawlStatus,
        analyzeStatus: l.analyzeStatus,
        createdAt: new Date(l.createdAt),
        updatedAt: new Date(l.updatedAt),
      },
    });
    leadCount++;
    if (leadCount % 50 === 0) console.log(`  ${leadCount}/${leads.length}`);
  }
  console.log(`  Done: ${leadCount} leads`);

  // --- 2. Website Audits (from nested lead data) ---
  const auditsFromLeads = leads
    .filter((l: any) => l.websiteAudit)
    .map((l: any) => l.websiteAudit);
  console.log(`\nSeeding ${auditsFromLeads.length} website audits...`);
  for (const a of auditsFromLeads) {
    await prisma.websiteAudit.upsert({
      where: { leadId: a.leadId },
      update: {},
      create: {
        id: a.id,
        leadId: a.leadId,
        url: a.url,
        reachable: a.reachable,
        loadTimeMs: a.loadTimeMs,
        https: a.https,
        mobileFriendlyGuess: a.mobileFriendlyGuess,
        title: a.title,
        metaDescription: a.metaDescription,
        h1: a.h1,
        hasContactForm: a.hasContactForm,
        hasWhatsappLink: a.hasWhatsappLink,
        hasBookingSystem: a.hasBookingSystem,
        hasEcommerce: a.hasEcommerce,
        servicesDetected: a.servicesDetected ?? [],
        navItems: a.navItems ?? [],
        ctaLinks: a.ctaLinks ?? [],
        brokenLinksCount: a.brokenLinksCount ?? 0,
        structuredDataPresent: a.structuredDataPresent ?? false,
        rawFeaturesJson: a.rawFeaturesJson,
        createdAt: new Date(a.createdAt),
      },
    });
  }
  console.log(`  Done: ${auditsFromLeads.length} website audits`);

  // Build set of valid lead IDs in DB
  const validLeadIds = new Set(
    (await prisma.lead.findMany({ select: { id: true } })).map((l) => l.id)
  );

  // --- 3. Sales Opportunities ---
  console.log(`\nSeeding ${salesOpportunities.length} sales opportunities...`);
  let soCount = 0;
  for (const s of salesOpportunities) {
    if (!validLeadIds.has(s.leadId)) {
      console.log(`  Skipping SO for missing lead: ${s.leadId}`);
      continue;
    }
    await prisma.salesOpportunity.upsert({
      where: { leadId: s.leadId },
      update: {},
      create: {
        id: s.id,
        leadId: s.leadId,
        opportunityScore: s.opportunityScore,
        reasonCodes: s.reasonCodes ?? [],
        whyGoodTarget: s.whyGoodTarget,
        likelyPainPoints: s.likelyPainPoints ?? [],
        bestSalesAngle: s.bestSalesAngle,
        suggestedOffer: s.suggestedOffer,
        personalizedFirstMessage: s.personalizedFirstMessage,
        expectedPriceBand: s.expectedPriceBand,
        status: s.status,
        createdAt: new Date(s.createdAt),
        updatedAt: new Date(s.updatedAt),
      },
    });
    soCount++;
  }
  console.log(`  Done: ${soCount} sales opportunities`);

  // --- 4. Watchlist Items ---
  console.log(`\nSeeding ${watchlistItems.length} watchlist items...`);
  let wlCount = 0;
  for (const w of watchlistItems) {
    if (!validLeadIds.has(w.leadId)) {
      console.log(`  Skipping watchlist for missing lead: ${w.leadId}`);
      continue;
    }
    await prisma.watchlistItem.upsert({
      where: { leadId: w.leadId },
      update: {},
      create: {
        id: w.id,
        leadId: w.leadId,
        siteUrl: w.siteUrl,
        notes: w.notes,
        websitePlan: w.websitePlan,
        pipelineNotes: w.pipelineNotes,
        selectedOffer: w.selectedOffer,
        meetingResult: w.meetingResult,
        createdAt: new Date(w.createdAt),
        updatedAt: new Date(w.updatedAt),
      },
    });
    wlCount++;
  }
  console.log(`  Done: ${wlCount} watchlist items`);

  // --- 5. Google Reviews ---
  console.log(`\nSeeding ${googleReviews.length} google reviews...`);
  const existingReviewIds = new Set(
    (await prisma.googleReview.findMany({ select: { id: true } })).map(
      (r) => r.id
    )
  );
  let reviewCount = 0;
  for (const r of googleReviews) {
    if (existingReviewIds.has(r.id)) continue;
    if (!validLeadIds.has(r.leadId)) continue;
    await prisma.googleReview.create({
      data: {
        id: r.id,
        leadId: r.leadId,
        authorName: r.authorName,
        authorPhoto: r.authorPhoto,
        rating: r.rating,
        text: r.text,
        relativeTime: r.relativeTime,
        publishTime: new Date(r.publishTime),
        createdAt: new Date(r.createdAt),
      },
    });
    reviewCount++;
  }
  console.log(`  Done: ${reviewCount} google reviews`);

  // --- 6. Team Todos ---
  console.log(`\nSeeding ${teamTodos.length} team todos...`);
  const existingTodoIds = new Set(
    (await prisma.teamTodo.findMany({ select: { id: true } })).map((t) => t.id)
  );
  let todoCount = 0;
  for (const t of teamTodos) {
    if (existingTodoIds.has(t.id)) continue;
    await prisma.teamTodo.create({
      data: {
        id: t.id,
        column: t.column,
        text: t.text,
        done: t.done,
        sortOrder: t.sortOrder,
        createdAt: new Date(t.createdAt),
        updatedAt: new Date(t.updatedAt),
      },
    });
    todoCount++;
  }
  console.log(`  Done: ${todoCount} team todos`);

  console.log("\nSeed complete!");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
