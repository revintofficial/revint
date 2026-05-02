import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/seo/og-image";

export const runtime = "edge";
export const alt = "Leadac AI for agencies — fresh leads with the homework already done.";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  // Omit `accent` so the template uses the shared DEFAULT_ACCENT derived
  // from LEADAC_HUE/SATURATION. Per-page overrides go here only when a
  // vertical explicitly needs to diverge from the brand accent.
  return renderOgImage({
    eyebrow: "For agencies",
    title: "Fresh leads with the homework already done.",
    subtitle:
      "Replace the saturated Apollo dump with postcode + niche discovery and a per-lead website plan you attach to the first reply.",
    badge: "Agencies",
  });
}
