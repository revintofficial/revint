import { REASON_LABELS } from "@/lib/labels";

interface GoogleReviewData {
  id: string;
  authorName: string;
  authorPhoto: string | null;
  rating: number;
  text: string | null;
  relativeTime: string;
  publishTime: string;
}

interface SalesOpportunityData {
  opportunityScore: number;
  /**
   * Legacy STARTER/GROWTH/SALES enum (deprecated P0.4). The export
   * still falls back to this column for legacy rows that pre-date
   * the ServicePackage migration; new rows leave it at the schema
   * default and surface their package via `recommendedPackageName`.
   */
  suggestedOffer?: string | null;
  /** Resolved ServicePackage.name (joined upstream by /api/leads). */
  recommendedPackageName?: string | null;
  /** Resolved ServicePackage.priceLabel (joined upstream by /api/leads). */
  recommendedPackagePriceLabel?: string | null;
  status: string;
  whyGoodTarget?: string | null;
  likelyPainPoints?: string[];
  bestSalesAngle?: string | null;
  personalizedFirstMessage?: string | null;
  /**
   * Legacy free-text price band (deprecated P0.4). Kept readable so
   * historic exports don't lose the column; new rows are blank and
   * the export prefers `recommendedPackagePriceLabel`.
   */
  expectedPriceBand?: string | null;
  reasonCodes?: string[];
}

export interface WatchlistExportItem {
  id: string;
  leadId: string;
  siteUrl: string | null;
  notes: string | null;
  websitePlan: string | null;
  selectedOffer: "STARTER" | "GROWTH" | "SALES" | null;
  meetingResult: "POSITIVE" | "NEGATIVE" | "IN_PROGRESS" | null;
  createdAt: string;
  updatedAt: string;
  lead: {
    id: string;
    businessName: string;
    formattedAddress: string;
    borough: string | null;
    phone: string | null;
    websiteUrl: string | null;
    analyzeStatus: string;
    googleReviews: GoogleReviewData[];
    salesOpportunity: SalesOpportunityData | null;
  };
}

function meetingLabel(result: string | null): string {
  if (result === "POSITIVE") return "Positive";
  if (result === "NEGATIVE") return "Negative";
  if (result === "IN_PROGRESS") return "In Progress";
  return "Pending";
}

export async function exportToExcel(items: WatchlistExportItem[]) {
  if (items.length === 0) return;
  const XLSX = await import("xlsx");

  const businessNames = items.map((item) => item.lead.businessName);

  const fieldRows: { label: string; values: (string | number)[] }[] = [
    { label: "Address", values: items.map((i) => i.lead.formattedAddress) },
    { label: "Area", values: items.map((i) => i.lead.borough || "") },
    { label: "Phone", values: items.map((i) => i.lead.phone || "") },
    { label: "Current Website", values: items.map((i) => i.lead.websiteUrl || "") },
    { label: "Built Site", values: items.map((i) => i.siteUrl || "") },
    { label: "Notes", values: items.map((i) => i.notes || "") },
    { label: "Selected Package", values: items.map((i) => i.selectedOffer || "") },
    { label: "Meeting Result", values: items.map((i) => meetingLabel(i.meetingResult)) },
    { label: "Opportunity Score", values: items.map((i) => i.lead.salesOpportunity?.opportunityScore ?? "") },
    {
      label: "Recommended Package",
      values: items.map(
        (i) =>
          i.lead.salesOpportunity?.recommendedPackageName ||
          i.lead.salesOpportunity?.suggestedOffer ||
          "",
      ),
    },
    {
      label: "Price",
      values: items.map(
        (i) =>
          i.lead.salesOpportunity?.recommendedPackagePriceLabel ||
          i.lead.salesOpportunity?.expectedPriceBand ||
          "",
      ),
    },
    { label: "Status", values: items.map((i) => i.lead.salesOpportunity?.status || "") },
    { label: "Why Good Target", values: items.map((i) => i.lead.salesOpportunity?.whyGoodTarget || "") },
    {
      label: "Issues",
      values: items.map((i) =>
        ((i.lead.salesOpportunity?.reasonCodes || []) as string[]).map((c) => REASON_LABELS[c] || c).join(", ")
      ),
    },
    {
      label: "Pain Points",
      values: items.map((i) =>
        ((i.lead.salesOpportunity?.likelyPainPoints || []) as string[]).map((p) => REASON_LABELS[p] || p).join(", ")
      ),
    },
    { label: "Sales Angle", values: items.map((i) => i.lead.salesOpportunity?.bestSalesAngle || "") },
    { label: "Personalized Message", values: items.map((i) => i.lead.salesOpportunity?.personalizedFirstMessage || "") },
    { label: "Google Review Count", values: items.map((i) => (i.lead.googleReviews || []).length) },
    {
      label: "Average Rating",
      values: items.map((i) => {
        const r = i.lead.googleReviews || [];
        return r.length > 0 ? (r.reduce((s, rv) => s + rv.rating, 0) / r.length).toFixed(1) : "";
      }),
    },
    { label: "Date Added", values: items.map((i) => new Date(i.createdAt).toLocaleDateString("en-US")) },
  ];

  const header: (string | number)[] = ["", ...businessNames];
  const dataRows = fieldRows.map((f) => [f.label, ...f.values]);
  const sheetData = [header, ...dataRows];

  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  ws["!cols"] = [
    { wch: 25 },
    ...businessNames.map((name) => ({ wch: Math.max(name.length + 2, 20) })),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Shortlist");
  XLSX.writeFile(wb, `shortlist_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function exportToPDF(items: WatchlistExportItem[]) {
  if (items.length === 0) return;
  const { default: jsPDF } = await import("jspdf");

  const toBase64 = async (url: string) => {
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const chunks: string[] = [];
    for (let i = 0; i < bytes.length; i += 8192) {
      chunks.push(String.fromCharCode(...bytes.slice(i, i + 8192)));
    }
    return btoa(chunks.join(""));
  };

  const [regularB64, boldB64] = await Promise.all([
    toBase64("/fonts/Roboto-Regular.ttf"),
    toBase64("/fonts/Roboto-Bold.ttf"),
  ]);

  const pdf = new jsPDF("p", "mm", "a4");
  pdf.addFileToVFS("Roboto-Regular.ttf", regularB64);
  pdf.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  pdf.addFileToVFS("Roboto-Bold.ttf", boldB64);
  pdf.addFont("Roboto-Bold.ttf", "Roboto", "bold");
  pdf.setFont("Roboto", "normal");

  const pageW = 210;
  const pageH = 297;
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  const checkPage = (needed: number) => {
    if (y + needed > pageH - margin) {
      pdf.addPage();
      y = margin;
    }
  };

  const writeWrapped = (text: string, indent = 0) => {
    const lines = pdf.splitTextToSize(text, contentW - indent);
    for (const line of lines) {
      checkPage(5);
      pdf.text(line, margin + indent, y);
      y += 5;
    }
  };

  // Title
  pdf.setFontSize(20);
  pdf.setTextColor(24, 24, 27);
  pdf.setFont("Roboto", "bold");
  pdf.text("Shortlist Report", margin, y);
  y += 8;
  pdf.setFontSize(10);
  pdf.setTextColor(113, 113, 122);
  pdf.setFont("Roboto", "normal");
  pdf.text(`${items.length} leads | ${new Date().toLocaleDateString("en-US")}`, margin, y);
  y += 4;

  const analyzed = items.filter((i) => i.lead.salesOpportunity);
  if (analyzed.length > 0) {
    const avg = Math.round(analyzed.reduce((s, i) => s + (i.lead.salesOpportunity?.opportunityScore || 0), 0) / analyzed.length);
    pdf.text(`Average Opportunity Score: ${avg}/100`, margin, y);
  }
  y += 8;
  pdf.setDrawColor(228, 228, 231);
  pdf.line(margin, y, pageW - margin, y);
  y += 8;

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const opp = item.lead.salesOpportunity;
    const reviews = item.lead.googleReviews || [];

    checkPage(30);

    pdf.setFontSize(14);
    pdf.setTextColor(24, 24, 27);
    pdf.setFont("Roboto", "bold");
    pdf.text(`${idx + 1}. ${item.lead.businessName}`, margin, y);
    y += 6;

    if (opp) {
      const scoreColor: [number, number, number] =
        opp.opportunityScore >= 60 ? [5, 150, 105] : opp.opportunityScore >= 35 ? [217, 119, 6] : [113, 113, 122];
      pdf.setFontSize(10);
      pdf.setFont("Roboto", "bold");
      pdf.setTextColor(...scoreColor);
      pdf.text(`Score: ${opp.opportunityScore}/100`, pageW - margin - 25, y - 6);
    }

    pdf.setFontSize(9);
    pdf.setTextColor(113, 113, 122);
    pdf.setFont("Roboto", "normal");
    pdf.text(item.lead.formattedAddress, margin, y);
    y += 5;

    if (item.lead.borough) { pdf.text(`Area: ${item.lead.borough}`, margin, y); y += 5; }
    if (item.lead.phone) { pdf.text(`Phone: ${item.lead.phone}`, margin, y); y += 5; }
    if (item.lead.websiteUrl) { pdf.setTextColor(79, 70, 229); pdf.text(`Website: ${item.lead.websiteUrl}`, margin, y); y += 5; }
    if (item.siteUrl) { pdf.setTextColor(79, 70, 229); pdf.text(`Built Site: ${item.siteUrl}`, margin, y); y += 5; }

    if (item.notes) {
      y += 2;
      pdf.setFontSize(9);
      pdf.setTextColor(63, 63, 70);
      pdf.setFont("Roboto", "bold");
      pdf.text("Notes:", margin, y);
      y += 4;
      pdf.setFont("Roboto", "normal");
      writeWrapped(item.notes, 2);
    }

    if (opp) {
      y += 3;
      checkPage(25);
      pdf.setFontSize(11);
      pdf.setTextColor(24, 24, 27);
      pdf.setFont("Roboto", "bold");
      pdf.text("AI Analysis", margin, y);
      y += 5;
      pdf.setFontSize(9);
      pdf.setFont("Roboto", "normal");
      pdf.setTextColor(63, 63, 70);

      const packageLabel =
        opp.recommendedPackageName ?? opp.suggestedOffer ?? null;
      const priceLabel =
        opp.recommendedPackagePriceLabel ?? opp.expectedPriceBand ?? null;
      if (packageLabel) {
        pdf.text(`Recommended Package: ${packageLabel}`, margin + 2, y); y += 5;
      }
      if (priceLabel) { pdf.text(`Price: ${priceLabel}`, margin + 2, y); y += 5; }
      if (opp.status) { pdf.text(`Status: ${opp.status}`, margin + 2, y); y += 5; }

      if (opp.whyGoodTarget) {
        checkPage(10);
        pdf.setFont("Roboto", "bold"); pdf.text("Why Good Target:", margin + 2, y); y += 4;
        pdf.setFont("Roboto", "normal"); writeWrapped(opp.whyGoodTarget, 4);
      }

      const reasonCodes = opp.reasonCodes || [];
      if (reasonCodes.length > 0) {
        checkPage(8);
        pdf.setFont("Roboto", "bold"); pdf.text("Issues:", margin + 2, y); y += 4;
        pdf.setFont("Roboto", "normal");
        writeWrapped(reasonCodes.map((c) => REASON_LABELS[c] || c).join(", "), 4);
      }

      const painPoints = opp.likelyPainPoints || [];
      if (painPoints.length > 0) {
        checkPage(8);
        pdf.setFont("Roboto", "bold"); pdf.text("Pain Points:", margin + 2, y); y += 4;
        pdf.setFont("Roboto", "normal");
        for (const p of painPoints) { checkPage(5); pdf.text(`• ${REASON_LABELS[p] || p}`, margin + 4, y); y += 4.5; }
      }

      if (opp.bestSalesAngle) {
        checkPage(8);
        pdf.setFont("Roboto", "bold"); pdf.text("Sales Angle:", margin + 2, y); y += 4;
        pdf.setFont("Roboto", "normal"); writeWrapped(opp.bestSalesAngle, 4);
      }

      if (opp.personalizedFirstMessage) {
        checkPage(10);
        pdf.setFont("Roboto", "bold"); pdf.setTextColor(5, 150, 105); pdf.text("Personalized Message:", margin + 2, y); y += 4;
        pdf.setFont("Roboto", "normal"); pdf.setTextColor(6, 95, 70); writeWrapped(opp.personalizedFirstMessage, 4);
      }
    }

    if (reviews.length > 0) {
      y += 3;
      checkPage(15);
      const avgR = (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1);
      pdf.setFontSize(9);
      pdf.setTextColor(113, 113, 122);
      pdf.setFont("Roboto", "bold");
      pdf.text(`Google Reviews (${reviews.length} reviews, avg: ${avgR})`, margin, y);
      y += 5;

      const maxReviews = Math.min(reviews.length, 5);
      for (let ri = 0; ri < maxReviews; ri++) {
        const r = reviews[ri];
        checkPage(12);
        pdf.setFontSize(8);
        pdf.setTextColor(113, 113, 122);
        pdf.setFont("Roboto", "normal");
        const stars = "★".repeat(r.rating) + "☆".repeat(5 - r.rating);
        pdf.text(`${r.authorName}  ${stars}  ${r.relativeTime}`, margin + 2, y);
        y += 4;
        if (r.text) {
          pdf.setTextColor(82, 82, 91);
          const trimmed = r.text.length > 200 ? r.text.slice(0, 200) + "..." : r.text;
          writeWrapped(trimmed, 4);
        }
        y += 2;
      }
      if (reviews.length > 5) {
        pdf.setTextColor(161, 161, 170);
        pdf.text(`... and ${reviews.length - 5} more reviews`, margin + 2, y);
        y += 5;
      }
    }

    y += 4;
    pdf.setDrawColor(228, 228, 231);
    pdf.line(margin, y, pageW - margin, y);
    y += 8;
  }

  pdf.save(`shortlist_report_${new Date().toISOString().slice(0, 10)}.pdf`);
}
