import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/seo/og-image";

export const runtime = "edge";
export const alt = "Leadac AI for SMMA — the productized version of the course you just bought.";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({
    eyebrow: "For SMMA",
    title: "Postcode + niche → your first 10 clients.",
    subtitle:
      "The productized version of the course you just bought. Look legit on day one with audit-grounded outreach.",
    badge: "SMMA",
    accent: "#F59E0B",
  });
}
