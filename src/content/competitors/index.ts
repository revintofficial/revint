import type { CompetitorProfile } from "./types";
import { apollo } from "./apollo";
import { clay } from "./clay";
import { instantly } from "./instantly";
import { smartlead } from "./smartlead";
import { lemlist } from "./lemlist";
import { zoominfo } from "./zoominfo";
import { lusha } from "./lusha";
import { leadForensics } from "./lead-forensics";

export { LEADAC_SELF } from "./types";
export type { CompetitorProfile } from "./types";

export const COMPETITORS: CompetitorProfile[] = [
  apollo,
  clay,
  instantly,
  smartlead,
  lemlist,
  zoominfo,
  lusha,
  leadForensics,
];

export function getCompetitor(slug: string): CompetitorProfile | null {
  return COMPETITORS.find((c) => c.slug === slug) ?? null;
}

export function listCompetitorSlugs(): string[] {
  return COMPETITORS.map((c) => c.slug);
}
