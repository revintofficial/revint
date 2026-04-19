import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";

type ExportFormat = "smartlead" | "instantly" | "csv";

interface ExportBody {
  leadIds?: string[];
  format?: ExportFormat;
}

const SMARTLEAD_HEADERS = [
  "email",
  "first_name",
  "last_name",
  "company",
  "phone",
  "website",
  "city",
  "audit_summary",
  "mockup_url",
  "opportunity_score",
  "personalized_opener",
];

const INSTANTLY_HEADERS = [
  "email",
  "firstName",
  "lastName",
  "companyName",
  "phone",
  "website",
  "city",
  "customVariable1",
  "customVariable2",
  "customVariable3",
  "personalization",
];

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toRow(values: (string | number | null | undefined)[]): string {
  return values.map(csvEscape).join(",");
}

function splitName(businessName: string): { first: string; last: string } {
  // Google Places gives a business name, not a person. We populate `first_name`
  // with the business name (Smartlead/Instantly use it for the {{firstName}}
  // template variable in cold email subject lines, where the agency typically
  // wants to address the business directly) and leave `last_name` empty.
  return { first: businessName, last: "" };
}

function buildAuditSummary(audit: {
  loadTimeMs: number | null;
  https: boolean;
  mobileFriendlyGuess: boolean;
  hasBookingSystem: boolean;
  bookingProvider: string | null;
}): string {
  const parts: string[] = [];
  if (audit.loadTimeMs !== null) {
    const seconds = (audit.loadTimeMs / 1000).toFixed(1);
    parts.push(`loads in ${seconds}s`);
  }
  if (!audit.https) parts.push("no HTTPS");
  if (!audit.mobileFriendlyGuess) parts.push("not mobile-friendly");
  if (!audit.hasBookingSystem) {
    parts.push("no online booking");
  } else if (audit.bookingProvider) {
    parts.push(`uses ${audit.bookingProvider}`);
  }
  return parts.join(", ");
}

export async function POST(request: Request) {
  try {
    const { workspaceId } = await requireUser();
    const body = (await request.json()) as ExportBody;
    const format: ExportFormat = body.format || "csv";
    const leadIds = body.leadIds;

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json(
        { error: "leadIds (non-empty array) is required" },
        { status: 400 }
      );
    }

    if (leadIds.length > 5000) {
      return NextResponse.json(
        { error: "Cannot export more than 5,000 leads in one request" },
        { status: 400 }
      );
    }

    const leads = await prisma.lead.findMany({
      where: {
        id: { in: leadIds },
        workspaceId,
      },
      include: {
        websiteAudit: true,
        salesOpportunity: true,
        mockups: {
          where: { isPublic: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (leads.length === 0) {
      return NextResponse.json(
        { error: "No matching leads found in this workspace" },
        { status: 404 }
      );
    }

    const proto = request.headers.get("x-forwarded-proto") || "https";
    const host = request.headers.get("host") || "leadengine.app";
    const baseUrl = `${proto}://${host}`;

    const headers =
      format === "smartlead" ? SMARTLEAD_HEADERS :
      format === "instantly" ? INSTANTLY_HEADERS :
      SMARTLEAD_HEADERS;

    const rows: string[] = [headers.join(",")];

    let leadsWithoutEmail = 0;

    for (const lead of leads) {
      const audit = lead.websiteAudit;
      const opp = lead.salesOpportunity;
      const mockup = lead.mockups[0];
      const emails = (audit?.contactEmails as string[] | undefined) || [];
      const email = emails[0] || "";
      if (!email) leadsWithoutEmail++;

      const { first, last } = splitName(lead.businessName);
      const auditSummary = audit ? buildAuditSummary(audit) : "";
      const mockupUrl = mockup ? `${baseUrl}/m/${mockup.slug}` : "";
      const score = opp?.opportunityScore ?? "";
      const opener = opp?.personalizedFirstMessage || "";
      const city = lead.borough || "";

      if (format === "smartlead") {
        rows.push(
          toRow([
            email,
            first,
            last,
            lead.businessName,
            lead.phone || "",
            lead.websiteUrl || "",
            city,
            auditSummary,
            mockupUrl,
            score,
            opener,
          ])
        );
      } else if (format === "instantly") {
        rows.push(
          toRow([
            email,
            first,
            last,
            lead.businessName,
            lead.phone || "",
            lead.websiteUrl || "",
            city,
            mockupUrl,        // customVariable1
            auditSummary,     // customVariable2
            score,            // customVariable3
            opener,
          ])
        );
      } else {
        rows.push(
          toRow([
            email,
            first,
            last,
            lead.businessName,
            lead.phone || "",
            lead.websiteUrl || "",
            city,
            auditSummary,
            mockupUrl,
            score,
            opener,
          ])
        );
      }
    }

    const csv = rows.join("\r\n") + "\r\n";
    const filename = `leadengine-${format}-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Lead-Count": String(leads.length),
        "X-Leads-Without-Email": String(leadsWithoutEmail),
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error("Export error:", message);
    return NextResponse.json(
      { error: "Export failed", detail: message },
      { status: 500 }
    );
  }
}
