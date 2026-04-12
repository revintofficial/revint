import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { crawlWebsite } from "@/lib/crawler";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { leadId, crawlAll = false } = body;

    if (crawlAll) {
      const pendingLeads = await prisma.lead.findMany({
        where: {
          crawlStatus: "PENDING",
          hasWebsite: true,
          websiteUrl: { not: null },
        },
        take: 50,
      });

      let crawled = 0;
      let failed = 0;

      for (const lead of pendingLeads) {
        if (!lead.websiteUrl) continue;

        try {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { crawlStatus: "CRAWLING" },
          });

          const features = await crawlWebsite(lead.websiteUrl);

          await prisma.websiteAudit.upsert({
            where: { leadId: lead.id },
            create: {
              leadId: lead.id,
              url: lead.websiteUrl,
              reachable: features.reachable,
              loadTimeMs: features.loadTimeMs,
              https: features.https,
              mobileFriendlyGuess: features.mobileFriendlyGuess,
              title: features.title,
              metaDescription: features.metaDescription,
              h1: features.h1,
              hasContactForm: features.hasContactForm,
              hasWhatsappLink: features.hasWhatsappLink,
              hasBookingSystem: features.hasBookingSystem,
              hasEcommerce: features.hasEcommerce,
              servicesDetected: features.servicesDetected,
              navItems: features.navItems,
              ctaLinks: features.ctaLinks,
              brokenLinksCount: features.brokenLinksCount,
              structuredDataPresent: features.structuredDataPresent,
              rawFeaturesJson: JSON.parse(JSON.stringify(features)),
            },
            update: {
              reachable: features.reachable,
              loadTimeMs: features.loadTimeMs,
              https: features.https,
              mobileFriendlyGuess: features.mobileFriendlyGuess,
              title: features.title,
              metaDescription: features.metaDescription,
              h1: features.h1,
              hasContactForm: features.hasContactForm,
              hasWhatsappLink: features.hasWhatsappLink,
              hasBookingSystem: features.hasBookingSystem,
              hasEcommerce: features.hasEcommerce,
              servicesDetected: features.servicesDetected,
              navItems: features.navItems,
              ctaLinks: features.ctaLinks,
              brokenLinksCount: features.brokenLinksCount,
              structuredDataPresent: features.structuredDataPresent,
              rawFeaturesJson: JSON.parse(JSON.stringify(features)),
            },
          });

          await prisma.lead.update({
            where: { id: lead.id },
            data: { crawlStatus: "CRAWLED" },
          });
          crawled++;
        } catch (err) {
          console.error(`Crawl failed for ${lead.websiteUrl}:`, err);
          await prisma.lead.update({
            where: { id: lead.id },
            data: { crawlStatus: "FAILED" },
          });
          failed++;
        }
      }

      return NextResponse.json({
        success: true,
        crawled,
        failed,
        total: pendingLeads.length,
      });
    }

    if (!leadId) {
      return NextResponse.json(
        { error: "leadId is required" },
        { status: 400 }
      );
    }

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead || !lead.websiteUrl) {
      return NextResponse.json(
        { error: "Lead not found or has no website" },
        { status: 404 }
      );
    }

    await prisma.lead.update({
      where: { id: leadId },
      data: { crawlStatus: "CRAWLING" },
    });

    const features = await crawlWebsite(lead.websiteUrl);

    await prisma.websiteAudit.upsert({
      where: { leadId },
      create: {
        leadId,
        url: lead.websiteUrl,
        reachable: features.reachable,
        loadTimeMs: features.loadTimeMs,
        https: features.https,
        mobileFriendlyGuess: features.mobileFriendlyGuess,
        title: features.title,
        metaDescription: features.metaDescription,
        h1: features.h1,
        hasContactForm: features.hasContactForm,
        hasWhatsappLink: features.hasWhatsappLink,
        hasBookingSystem: features.hasBookingSystem,
        hasEcommerce: features.hasEcommerce,
        servicesDetected: features.servicesDetected,
        navItems: features.navItems,
        ctaLinks: features.ctaLinks,
        brokenLinksCount: features.brokenLinksCount,
        structuredDataPresent: features.structuredDataPresent,
        rawFeaturesJson: JSON.parse(JSON.stringify(features)),
      },
      update: {
        reachable: features.reachable,
        loadTimeMs: features.loadTimeMs,
        https: features.https,
        mobileFriendlyGuess: features.mobileFriendlyGuess,
        title: features.title,
        metaDescription: features.metaDescription,
        h1: features.h1,
        hasContactForm: features.hasContactForm,
        hasWhatsappLink: features.hasWhatsappLink,
        hasBookingSystem: features.hasBookingSystem,
        hasEcommerce: features.hasEcommerce,
        servicesDetected: features.servicesDetected,
        navItems: features.navItems,
        ctaLinks: features.ctaLinks,
        brokenLinksCount: features.brokenLinksCount,
        structuredDataPresent: features.structuredDataPresent,
        rawFeaturesJson: JSON.parse(JSON.stringify(features)),
      },
    });

    await prisma.lead.update({
      where: { id: leadId },
      data: { crawlStatus: "CRAWLED" },
    });

    return NextResponse.json({ success: true, features });
  } catch (error) {
    console.error("Crawl error:", error);
    return NextResponse.json(
      { error: "Crawl failed", details: String(error) },
      { status: 500 }
    );
  }
}
