/**
 * Persona quotes — sourced verbatim from positioning §2.3 + §3.1.
 * Every page that includes a customer-voice block pulls from this file
 * so the same quote never gets rephrased into three different versions.
 */

export type Persona = {
  id: "daniel" | "sarah" | "mike";
  name: string;
  role: string;
  /** Plain-language description used as a caption under the quote. */
  contextLine: string;
  quote: string;
  source: {
    name: string;
    url: string;
    date: string; // ISO 8601, used for `datePublished` in schema
  };
};

export const PERSONAS: Record<Persona["id"], Persona> = {
  daniel: {
    id: "daniel",
    name: "Daniel",
    role: "VP Sales at a vertical SaaS company",
    contextLine: "60–200 person vertical SaaS, $15M ARR, HubSpot + Apollo",
    quote:
      "Account research and call prep consume 14% of the workweek. That's roughly 5.6 hours per rep. For a 10-rep team, $130,000 of selling time per year, gone.",
    source: {
      name: "Salesforce State of Sales 2026, via Salesmotion",
      url: "https://salesmotion.io/blog/sales-team-manual-account-research-time",
      date: "2026-02-15",
    },
  },
  sarah: {
    id: "sarah",
    name: "Sarah",
    role: "Head of Marketing at a vertical SaaS company",
    contextLine: "Influencer / champion — finds the tool, hands it to Daniel",
    quote:
      "70% of our own users still spray and pray because it's easier. Positioning doesn't change behavior, enablement does.",
    source: {
      name: "Domitille de Saint-Exupéry, CMO Lemlist, The Executive podcast",
      url: "https://www.listennotes.com/podcasts/the-executive/scaling-in-a-crowded-market-QCxpyOilRo4/",
      date: "2026-05-08",
    },
  },
  mike: {
    id: "mike",
    name: "Mike",
    role: "SDR Manager at a vertical SaaS company",
    contextLine: "30–150 person vertical SaaS, 5–10 SDRs, Apollo + HubSpot",
    quote:
      "For a team of 10 SDRs working standard 40-hour weeks, 148 of those 400 collective hours per week get consumed by research alone. At an average SDR salary of $60,000, that translates to $22,200 per rep per year burned on research, or $222,000 annually for a team of ten.",
    source: {
      name: "r/sales community thread, captured via Kwanzoo benchmark synthesis",
      url: "https://www.kwanzoo.com/blog/sdrs-spend-40-percent-researching-leads",
      date: "2026-03-22",
    },
  },
};

export const PERSONA_LIST: Persona[] = [
  PERSONAS.daniel,
  PERSONAS.mike,
  PERSONAS.sarah,
];
