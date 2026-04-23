import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/seo/og-image";

export const runtime = "edge";
export const alt = "Leadac AI — Postcode and a niche. Fresh local leads, audited and pitched.";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function HomeOpengraphImage() {
  return renderOgImage({
    eyebrow: "Leadac AI",
    title: "Postcode and a niche. Fresh local leads, audited and pitched.",
    subtitle:
      "Live Google Maps discovery. 20-signal audit on every site. A personalised opener that references what the crawl actually found.",
    badge: "For outbound",
  });
}
