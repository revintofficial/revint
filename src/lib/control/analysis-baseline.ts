// src/lib/control/analysis-baseline.ts
/**
 * Analysis baseline: what the four-step lead chain produces and what
 * reaches HubSpot, as numbers. Pure summarizers; the DB reads live in
 * scripts/analysis-baseline.ts.
 */
import { normalizeForGrounding } from "@/lib/review-analysis/kpi-filter";

export const CHAIN_WORKERS = [
  "APIFY_GMAPS_DEEP",
  "WEBSITE_AUDITOR",
  "REVIEW_ANALYST",
  "LEAD_INTELLIGENCE_BRIEF",
] as const;
export type ChainWorker = (typeof CHAIN_WORKERS)[number];

/** Room 1 rule inputs (`RoomOneAudit` in head-agent.ts). */
export const RULE_INPUTS = [
  "bookingProvider",
  "hasBookingSystem",
  "hasOnlineReservation",
  "hasPrepayment",
  "tableCount",
  "hasQrMenu",
  "menuUrl",
  "hasOnlineOrdering",
  "deliveryPlatforms",
  "languageCount",
  "tastingMenu",
  "centralPurchasing",
] as const;
export type RuleInput = (typeof RULE_INPUTS)[number];

export type StepState = "ok" | "skipped" | "failed" | "missing";

export interface BaselineRun {
  id: string;
  status: string;
  outputJson: unknown;
  finishedAt: Date | null;
}

export interface BaselineLeadInput {
  leadId: string;
  businessName: string;
  runs: Partial<Record<ChainWorker, BaselineRun | null>>;
  /** The audit Room 1 would read for this lead (`toRoomOneAudit`). */
  roomOneAudit: Record<string, unknown> | null;
  reviewTexts: string[];
  /** Newest non-superseded LeadNextAction. */
  nextActionCreatedAt: Date | null;
  /** What `buildRevintProperties` would write right now. */
  hubspotProps: Record<string, string> | null;
}

export interface LeadBaseline {
  leadId: string;
  businessName: string;
  steps: Record<ChainWorker, StepState>;
  known: Record<RuleInput, boolean>;
  brief: {
    mode: string | null;
    wedge: string | null;
    plan: string | null;
    roomTwo: string | null;
    missingSources: string[];
    skipped: string | null;
  };
  reviewQuotes: { total: number; verified: number };
  flags: { staleNextAction: boolean; skippedBriefWritesHubspot: boolean };
  hubspotFilled: string[];
}

export interface BaselineReport {
  leads: number;
  stepRate: Record<ChainWorker, Record<StepState, number>>;
  knownRate: Record<RuleInput, number>;
  wedges: Record<string, number>;
  plans: Record<string, number>;
  roomTwo: Record<string, number>;
  missingSources: Record<string, number>;
  reviewQuotes: { total: number; verified: number };
  flags: { staleNextAction: number; skippedBriefWritesHubspot: number };
  hubspotFillRate: Record<string, number>;
}

const SUCCEEDED = new Set(["SUCCEEDED", "SUCCEEDED_NO_MEMORY"]);

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
function text(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function isKnown(v: unknown): boolean {
  if (v === null || v === undefined || v === "") return false;
  return Array.isArray(v) ? v.length > 0 : true;
}
function pct(n: number, of: number): number {
  return of === 0 ? 0 : Math.round((n / of) * 100);
}
function bump(into: Record<string, number>, key: string | null): void {
  if (key) into[key] = (into[key] ?? 0) + 1;
}

export function stepState(run: BaselineRun | null | undefined): StepState {
  if (!run) return "missing";
  if (!SUCCEEDED.has(run.status)) return "failed";
  return obj(run.outputJson).skipped ? "skipped" : "ok";
}

/** Quoted text of `yorum: "…"` / `yorum (3/80): "…"` evidence lines. */
export function reviewQuotesOf(evidence: unknown): string[] {
  if (!Array.isArray(evidence)) return [];
  const out: string[] = [];
  for (const e of evidence) {
    if (typeof e !== "string" || !e.startsWith("yorum")) continue;
    const m = e.match(/"([\s\S]+)"\s*$/);
    if (m) out.push(m[1]);
  }
  return out;
}

export function summarizeLead(input: BaselineLeadInput): LeadBaseline {
  const steps = Object.fromEntries(
    CHAIN_WORKERS.map((k) => [k, stepState(input.runs[k])]),
  ) as Record<ChainWorker, StepState>;
  const briefRun = input.runs.LEAD_INTELLIGENCE_BRIEF ?? null;
  const out = obj(briefRun?.outputJson);
  const head = obj(out.headAgent);
  const audit = input.roomOneAudit ?? {};
  const known = Object.fromEntries(RULE_INPUTS.map((k) => [k, isKnown(audit[k])])) as Record<RuleInput, boolean>;

  const corpus = input.reviewTexts.map((t) => normalizeForGrounding(t));
  const quotes = reviewQuotesOf(obj(head.roomOne).evidence);
  const verified = quotes.filter((q) => {
    const n = normalizeForGrounding(q);
    return n.length > 0 && corpus.some((c) => c.includes(n));
  }).length;

  const props = input.hubspotProps ?? {};
  return {
    leadId: input.leadId,
    businessName: input.businessName,
    steps,
    known,
    brief: {
      mode: text(out.briefMode),
      wedge: text(head.wedge),
      plan: text(head.recommendedPackage),
      roomTwo: text(obj(head.roomTwo).status),
      missingSources: Array.isArray(out.missingSources) ? out.missingSources.map(String) : [],
      skipped: out.skipped ? String(out.skipped) : null,
    },
    reviewQuotes: { total: quotes.length, verified },
    flags: {
      staleNextAction: Boolean(
        input.nextActionCreatedAt && briefRun?.finishedAt && input.nextActionCreatedAt < briefRun.finishedAt,
      ),
      skippedBriefWritesHubspot:
        steps.LEAD_INTELLIGENCE_BRIEF === "skipped" && isKnown(props.revint_recommended_angle),
    },
    hubspotFilled: Object.keys(props)
      .filter((k) => isKnown(props[k]))
      .sort(),
  };
}

export function aggregateBaseline(rows: LeadBaseline[]): BaselineReport {
  const n = rows.length;
  const stepRate = Object.fromEntries(
    CHAIN_WORKERS.map((k) => {
      const c: Record<StepState, number> = { ok: 0, skipped: 0, failed: 0, missing: 0 };
      for (const r of rows) c[r.steps[k]] += 1;
      return [k, c];
    }),
  ) as Record<ChainWorker, Record<StepState, number>>;
  const knownRate = Object.fromEntries(
    RULE_INPUTS.map((k) => [k, pct(rows.filter((r) => r.known[k]).length, n)]),
  ) as Record<RuleInput, number>;

  const wedges: Record<string, number> = {};
  const plans: Record<string, number> = {};
  const roomTwo: Record<string, number> = {};
  const missingSources: Record<string, number> = {};
  const filled: Record<string, number> = {};
  const reviewQuotes = { total: 0, verified: 0 };
  const flags = { staleNextAction: 0, skippedBriefWritesHubspot: 0 };
  for (const r of rows) {
    bump(wedges, r.brief.wedge);
    bump(plans, r.brief.plan);
    bump(roomTwo, r.brief.roomTwo);
    for (const s of r.brief.missingSources) bump(missingSources, s);
    for (const k of r.hubspotFilled) bump(filled, k);
    reviewQuotes.total += r.reviewQuotes.total;
    reviewQuotes.verified += r.reviewQuotes.verified;
    if (r.flags.staleNextAction) flags.staleNextAction += 1;
    if (r.flags.skippedBriefWritesHubspot) flags.skippedBriefWritesHubspot += 1;
  }
  const hubspotFillRate = Object.fromEntries(
    Object.keys(filled)
      .sort()
      .map((k) => [k, pct(filled[k], n)]),
  );
  return { leads: n, stepRate, knownRate, wedges, plans, roomTwo, missingSources, reviewQuotes, flags, hubspotFillRate };
}

function table(head: string[], body: Array<Array<string | number>>): string {
  return [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...body.map((r) => `| ${r.join(" | ")} |`)].join("\n");
}

export function renderBaselineMarkdown(report: BaselineReport): string {
  const counts = (o: Record<string, number>) => Object.entries(o).map(([k, v]) => [k, v]);
  return [
    `# Analiz tabanı: ${report.leads} lead`,
    "## Zincir adımları",
    table(
      ["Adım", "ok", "skipped", "failed", "missing"],
      CHAIN_WORKERS.map((k) => [k, report.stepRate[k].ok, report.stepRate[k].skipped, report.stepRate[k].failed, report.stepRate[k].missing]),
    ),
    "## Oda 1 girdileri (bilinen oranı)",
    table(["Alan", "Bilinen"], RULE_INPUTS.map((k) => [k, `${report.knownRate[k]}%`])),
    "## Karar dağılımı",
    table(["Kaçak", "Adet"], counts(report.wedges)),
    table(["Paket", "Adet"], counts(report.plans)),
    table(["Oda 2", "Adet"], counts(report.roomTwo)),
    table(["Eksik kaynak", "Adet"], counts(report.missingSources)),
    "## Yorum alıntıları",
    `Kartlardaki alıntı: ${report.reviewQuotes.total}, gerçek yorumda bulunan: ${report.reviewQuotes.verified}`,
    "## HubSpot",
    table(["Alan", "Dolu"], Object.entries(report.hubspotFillRate).map(([k, v]) => [k, `${v}%`])),
    `Bayat sonraki-adım cümlesi: ${report.flags.staleNextAction} · Atlanan brief yine de yazıyor: ${report.flags.skippedBriefWritesHubspot}`,
  ].join("\n\n");
}
