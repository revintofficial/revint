import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [noWebsite, poorWebsite, noBooking, highPotential] =
      await Promise.all([
        prisma.lead.count({ where: { hasWebsite: false } }),
        prisma.websiteAudit.count({
          where: {
            OR: [
              { mobileFriendlyGuess: false },
              { reachable: false },
              { https: false },
            ],
          },
        }),
        prisma.websiteAudit.count({
          where: { hasBookingSystem: false },
        }),
        prisma.salesOpportunity.count({
          where: { opportunityScore: { gte: 60 } },
        }),
      ]);

    const campaigns = [
      {
        id: "no-website",
        name: "Website Yok",
        description: "Web sitesi olmayan isletmeler - en kolay satis firsati",
        leadCount: noWebsite,
        filter: { hasWebsite: "false" },
        color: "red",
      },
      {
        id: "poor-website",
        name: "Eski/Kotu Website",
        description:
          "Mobilde kotu, HTTPS yok veya ulasılamayan siteler",
        leadCount: poorWebsite,
        filter: { poorWebsite: "true" },
        color: "orange",
      },
      {
        id: "no-booking",
        name: "Booking Yok",
        description:
          "Online randevu/booking sistemi olmayan isletmeler",
        leadCount: noBooking,
        filter: { noBooking: "true" },
        color: "yellow",
      },
      {
        id: "high-potential",
        name: "Yuksek Potansiyel",
        description: "Skor 60+ olan en sicak lead'ler",
        leadCount: highPotential,
        filter: { minScore: "60" },
        color: "green",
      },
    ];

    return NextResponse.json(campaigns);
  } catch (error) {
    console.error("Campaigns error:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}
