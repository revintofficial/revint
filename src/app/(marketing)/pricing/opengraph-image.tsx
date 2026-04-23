import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/seo/og-image";

export const runtime = "edge";
export const alt = "Leadac AI pricing — simple, fair, upgrade once you're closing.";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({
    eyebrow: "Pricing",
    title: "Start free. Upgrade once you're closing.",
    subtitle:
      "Pro $79/mo, Agency $249/mo. One booked call in this market pays for itself 1–5×.",
    badge: "Pricing",
    accent: "#FBBF24",
  });
}
