import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/seo/og-image";

export const runtime = "edge";
export const alt = "Leadac AI — pre-call briefs for BD pods.";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function HomeOpengraphImage() {
  return renderOgImage({
    eyebrow: "Leadac AI",
    title: "The pre-call brief in front of every dial.",
    subtitle:
      "Fresh dossier on every restaurant your BD pod will phone this morning, with the first 30 seconds ready to read.",
    badge: "For BD pods",
  });
}
