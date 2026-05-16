import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/seo/og-image";

export const runtime = "edge";
export const alt =
  "LeadAC for restaurant agencies — reservation flow, review velocity, delivery dependency.";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  // Omit `accent` so the template uses the shared DEFAULT_ACCENT derived
  // from LEADAC_HUE / LEADAC_SATURATION. The warm-ochre brand accent is
  // the right F&B-themed tone for this vertical.
  return renderOgImage({
    eyebrow: "For restaurant agencies",
    title: "AI outbound for restaurant agencies",
    subtitle: "Reservation flow · review velocity · delivery dependency",
    badge: "F&B",
  });
}
