import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/seo/og-image";

export const runtime = "edge";
export const alt = "Leadac AI for specialists — postcode + niche, ready-to-pitch list with a plan attached.";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({
    eyebrow: "For specialists",
    title: "Ready-to-pitch list with a plan already attached.",
    subtitle:
      "You have the vertical skill. Leadac gives you the client-acquisition muscle — postcode, niche, 47 audited leads, sent.",
    badge: "Specialists",
    accent: "#34D399",
  });
}
