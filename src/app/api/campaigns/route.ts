import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const { workspaceId } = await requireUser();
    const [noWebsite, poorWebsite, noBooking, highPotential] = await Promise.all([
      prisma.lead.count({ where: { workspaceId, hasWebsite: false } }),
      prisma.websiteAudit.count({
        where: {
          lead: { workspaceId },
          OR: [
            { mobileFriendlyGuess: false },
            { reachable: false },
            { https: false },
          ],
        },
      }),
      prisma.websiteAudit.count({
        where: { lead: { workspaceId }, hasBookingSystem: false },
      }),
      prisma.salesOpportunity.count({
        where: { lead: { workspaceId }, opportunityScore: { gte: 60 } },
      }),
    ]);

    const campaigns = [
      {
        id: "no-website",
        name: "No website",
        description: "Businesses with no website at all — easiest pitch.",
        leadCount: noWebsite,
        filter: { hasWebsite: "false" },
        color: "red",
      },
      {
        id: "poor-website",
        name: "Weak website",
        description: "Bad on mobile, no HTTPS, or unreachable.",
        leadCount: poorWebsite,
        filter: { poorWebsite: "true" },
        color: "orange",
      },
      {
        id: "no-booking",
        name: "No booking system",
        description: "Businesses without an online booking flow.",
        leadCount: noBooking,
        filter: { noBooking: "true" },
        color: "yellow",
      },
      {
        id: "high-potential",
        name: "High potential",
        description: "Score 60+ — your hottest leads.",
        leadCount: highPotential,
        filter: { minScore: "60" },
        color: "green",
      },
    ];

    return NextResponse.json(campaigns);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.campaigns.error", { err: error });
    return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 });
  }
}
