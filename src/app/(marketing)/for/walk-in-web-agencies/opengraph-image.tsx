import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/seo/og-image";

export const runtime = "edge";
export const alt = "Leadac AI for walk-in web agencies — the retainer extension, already packaged.";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({
    eyebrow: "For walk-in web agencies",
    title: "Close the sale, ship the retainer the same day.",
    subtitle:
      "The moment they sign, the tool exports what you pitched — AI receptionist, review-reply agent, lead-response tree.",
    badge: "Walk-in",
    accent: "#60A5FA",
  });
}
