/**
 * Revint → HubSpot writeback.
 *
 * Pushes Revint intelligence onto the HubSpot **Company** (restaurants
 * arrive in HubSpot as companies) and **Contact** via the canonical
 * `revint_*` custom properties, optionally logs a call engagement, and
 * updates the deal stage. Every attempt is recorded in `CrmSyncLog`
 * (OUTBOUND) so failures are visible and retryable:
 *
 *   - brief-triggered writebacks (`briefRunId` set) are keyed on the run
 *     id → at most one successful writeback per LEAD_INTELLIGENCE_BRIEF
 *     run, no matter how often BullMQ retries the job;
 *   - other writebacks are keyed on the property payload hash, so
 *     re-running with the same data is a no-op.
 *
 * Failures are marked FAILED (with the HubSpot error) for the reconcile
 * tick to retry — there is no new BullMQ queue (per the workspace rule).
 * `enqueueCrmWriteback` never throws for HubSpot errors.
 *
 * The property map is the single source of truth for what Revint
 * exposes to HubSpot — see `properties.ts` for the canonical set.
 */
import { createHash } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";
import {
  getHubspotClient,
  HubspotNotConnectedError,
  type HubspotClient,
} from "./client";
import { getPlaybook } from "@/lib/playbook/resolve";
import { absenceSignalsFromAudit, hasSlowServiceSignal, pickAngle } from "@/lib/playbook/angle";
import {
  mapPlaybookStageToHubspot,
  type CrmFieldMapping,
} from "./field-map";
import { REVINT_ENUM_PROPERTY_NAMES } from "./properties";

export type WritebackReason =
  | "qualification"
  | "disposition"
  | "analysis"
  | "stage";

export interface EnqueueWritebackInput {
  workspaceId: string;
  leadId: string;
  reason: WritebackReason;
  /** Optional rep note for a disposition engagement. */
  engagementNote?: string;
  /** HubSpot call disposition GUID (when reason = "disposition"). */
  callDisposition?: string;
  /**
   * The LEAD_INTELLIGENCE_BRIEF AgentRun that triggered this writeback.
   * When set, the brief output is read from THIS run (not "latest") and
   * the sync log is keyed on the run id → one writeback per run.
   */
  briefRunId?: string;
}

export interface WritebackResult {
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  reason?: string;
  /** HubSpot objects written, e.g. ["company:123", "contact:456"]. */
  targets?: string[];
}

const BRIEF_WORKER_KIND = "LEAD_INTELLIGENCE_BRIEF";
/** HubSpot text properties cap at 65,536 chars; keep the CRM readable. */
const MAX_TEXT = 4000;

function hashProps(obj: Record<string, string>, reason: string): string {
  const stable = Object.keys(obj)
    .sort()
    .map((k) => `${k}=${obj[k]}`)
    .join("&");
  return createHash("sha256").update(`${reason}:${stable}`).digest("hex");
}

/** CrmSyncLog payload hash for a brief-run-triggered writeback. */
export function briefRunSyncHash(runId: string): string {
  return createHash("sha256").update(`analysis_run:${runId}`).digest("hex");
}

function actionSheetUrl(leadId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base}/app/leads/${leadId}`;
}

function clip(s: string): string {
  return s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT - 1)}…` : s;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function errText(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 1500);
}

const RISK_TO_UPPER: Record<string, string> = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
};

const TEMPERATURES = new Set(["HOT", "WARM", "COLD"]);

const PACKAGE_LABEL: Record<string, string> = {
  starter: "Starter",
  growth: "Growth",
  premium: "Premium",
};

function packageLabel(raw: unknown): string | null {
  const k = str(raw)?.toLowerCase();
  return k ? (PACKAGE_LABEL[k] ?? null) : null;
}

/** Head-agent wedge ids (see the brief contract) → CRM-readable labels. */
const WEDGE_LABEL: Record<string, string> = {
  reservation: "Reservations",
  bill_wait: "Bill wait / Order & Pay",
  marketplace: "Marketplace commission / direct ordering",
  menu_surface: "Digital menu",
  multi_location: "Multi-location",
  guest_repeat: "Guest repeat / loyalty",
};

/** Label for a wedge id; null for "none"/empty. Unknown ids are prettified. */
export function wedgeLabel(raw: unknown): string | null {
  const k = str(raw);
  if (!k || k.toLowerCase() === "none") return null;
  return WEDGE_LABEL[k.toLowerCase()] ?? k.replace(/_/g, " ");
}

/**
 * Head Agent decision as consumed by write-back. Accepts both the
 * current shape (`wedge` id, `primaryAngle` display text, `talkTrack`,
 * `recommendedPackage` plan id) and the legacy one (`primaryAngle` only).
 */
export interface HeadAgentWritebackView {
  briefMode: string | null;
  /** Display angle: `primaryAngle` verbatim (already "<wedge> → <plan>"). */
  primaryAngle: string | null;
  /** Wedge id, e.g. "reservation" | "none". */
  wedge: string | null;
  talkTrack: string | null;
  recommendedPackage: string | null;
  confidence: number | null;
  evidenceRefs: string[];
  sourceConflicts: Array<{ claim: string; sources: string[]; note: string }>;
  /** Room 1 bans: sentences the rep must not say. */
  bans: string[];
  excludedModules: Array<{ module: string; why: string }>;
  /** Unknown rule inputs phrased as questions for the call. */
  openQuestions: string[];
  missingSources: string[];
  /** "attached" = Claude's talk passed QA; anything else is a plain card. */
  roomTwoStatus: string | null;
  generatedAt: string | null;
}

/** Defensive parser for a LEAD_INTELLIGENCE_BRIEF `outputJson`. */
export function parseHeadAgentOutput(out: unknown): HeadAgentWritebackView | null {
  if (!out || typeof out !== "object") return null;
  const o = out as Record<string, unknown>;
  const ha = o.headAgent;
  if (!ha || typeof ha !== "object") return null;
  const h = ha as Record<string, unknown>;
  const conflicts = Array.isArray(h.sourceConflicts)
    ? h.sourceConflicts
        .map((c) => {
          if (!c || typeof c !== "object") return null;
          const r = c as Record<string, unknown>;
          return {
            claim: String(r.claim ?? ""),
            sources: Array.isArray(r.sources) ? r.sources.map(String) : [],
            note: String(r.note ?? ""),
          };
        })
        .filter((c): c is { claim: string; sources: string[]; note: string } => c !== null && c.claim !== "")
    : [];
  const evidenceRefs = Array.isArray(h.evidenceRefs)
    ? h.evidenceRefs
        .map((e) => {
          if (typeof e === "string") return e;
          if (e && typeof e === "object") {
            const r = e as Record<string, unknown>;
            return String(r.ref ?? r.id ?? "");
          }
          return "";
        })
        .filter(Boolean)
    : [];
  const strList = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];
  const roomOne = h.roomOne && typeof h.roomOne === "object" ? (h.roomOne as Record<string, unknown>) : {};
  const roomTwo = h.roomTwo && typeof h.roomTwo === "object" ? (h.roomTwo as Record<string, unknown>) : {};
  const excludedModules = Array.isArray(h.excludedModules)
    ? h.excludedModules
        .map((m) => {
          if (!m || typeof m !== "object") return null;
          const r = m as Record<string, unknown>;
          return { module: String(r.module ?? ""), why: String(r.why ?? "") };
        })
        .filter((m): m is { module: string; why: string } => m !== null && m.module !== "")
    : [];
  return {
    briefMode: str(o.briefMode),
    primaryAngle: str(h.primaryAngle),
    wedge: str(h.wedge),
    talkTrack: str(h.talkTrack),
    recommendedPackage: str(h.recommendedPackage),
    confidence: typeof h.confidence === "number" ? h.confidence : null,
    evidenceRefs,
    sourceConflicts: conflicts,
    bans: strList(roomOne.bans),
    excludedModules,
    openQuestions: strList(h.openQuestions),
    missingSources: strList(o.missingSources),
    roomTwoStatus: str(roomTwo.status),
    generatedAt: str(h.generatedAt),
  };
}

/**
 * Read the Head Agent decision from a LEAD_INTELLIGENCE_BRIEF run: the
 * specific run when `briefRunId` is given (post-run hook), otherwise
 * the latest successful one. Always workspace + lead scoped.
 */
async function readHeadAgentDecision(
  prisma: PrismaClient,
  workspaceId: string,
  leadId: string,
  briefRunId?: string,
): Promise<HeadAgentWritebackView | null> {
  const run = await prisma.agentRun.findFirst({
    where: {
      ...(briefRunId ? { id: briefRunId } : {}),
      workspaceId,
      leadId,
      workerKind: BRIEF_WORKER_KIND,
      status: { in: ["SUCCEEDED", "SUCCEEDED_NO_MEMORY"] },
    },
    orderBy: { finishedAt: "desc" },
    select: { outputJson: true },
  });
  return parseHeadAgentOutput(run?.outputJson);
}

export interface BuiltRevintProperties {
  properties: Record<string, string>;
  playbookStageKey: string | null;
  lead: {
    crmContactId: string | null;
    crmCompanyId: string | null;
    crmDealId: string | null;
  };
}

/**
 * Build the `revint_*` property map for a lead. Only includes
 * properties we have a value for: HubSpot rejects empty enumeration
 * writes, and unset string properties are best left untouched so manual
 * edits in HubSpot aren't clobbered.
 *
 * Sources (first non-empty wins):
 *   sales_confidence   Lead.salesConfidence (= SalesOpportunity lead score)
 *   lead_temperature   Lead.leadTemperature
 *   today_priority     rank of salesConfidence within the workspace (snapshot
 *                      at writeback time; 1 = highest score)
 *   recommended_angle  headAgent.primaryAngle ("<wedge> → <plan>") →
 *                      headAgent.wedge label (+ package) →
 *                      SalesOpportunity.recommendedPackageReason /
 *                      bestSalesAngle → playbook angle
 *   next_best_action   LeadNextAction.openingHook → headAgent.talkTrack
 *   qualification      LeadQualification.status, default "not_started"
 *   no_show_risk       LeadQualification.noShowRisk
 *   sub_niche          Lead.subNicheSlug
 *   evidence_summary   head agent confidence + package + wedge + evidence refs,
 *                      else deterministic matched triggers
 *   source_conflicts   head agent conflicts (explicit "none" when it ran)
 *   action_sheet_url   Revint deep link
 */
export async function buildRevintProperties(
  prisma: PrismaClient,
  workspaceId: string,
  leadId: string,
  opts: { briefRunId?: string } = {},
): Promise<BuiltRevintProperties | null> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, workspaceId },
    include: {
      qualification: true,
      websiteAudit: {
        select: {
          reachable: true,
          hasBookingSystem: true,
          hasEcommerce: true,
          rawFeaturesJson: true,
        },
      },
      reviewAnalysis: { select: { weaknessKpis: true } },
    },
  });
  if (!lead) return null;

  const playbook = await getPlaybook(prisma, workspaceId);
  const picked = pickAngle(playbook, {
    hasWebsite: lead.hasWebsite,
    rating: lead.rating,
    reviewCount: lead.reviewCount,
    priceLevel: lead.priceLevel,
    isMultiLocation: !!lead.accountId,
    ...absenceSignalsFromAudit(lead.websiteAudit),
    slowServiceReviews: hasSlowServiceSignal(lead.reviewAnalysis?.weaknessKpis),
  });
  const nextAction = await prisma.leadNextAction.findFirst({
    where: { workspaceId, leadId, supersededAt: null },
    orderBy: { createdAt: "desc" },
    select: { openingHook: true, timingWindowStart: true },
  });
  // SalesOpportunity has no workspaceId column — scope via the lead.
  const opportunity = await prisma.salesOpportunity.findFirst({
    where: { leadId, lead: { workspaceId } },
    select: { bestSalesAngle: true, recommendedPackageReason: true },
  });
  const headAgent = await readHeadAgentDecision(prisma, workspaceId, leadId, opts.briefRunId);

  const props: Record<string, string> = {};

  // --- A. Skorlama -------------------------------------------------------
  if (typeof lead.salesConfidence === "number") {
    props.revint_sales_confidence = String(Math.round(lead.salesConfidence));
    const higher = await prisma.lead.count({
      where: { workspaceId, salesConfidence: { gt: lead.salesConfidence } },
    });
    props.revint_today_priority = String(higher + 1);
  }
  const temp = lead.leadTemperature ? String(lead.leadTemperature).toUpperCase() : null;
  if (temp && TEMPERATURES.has(temp)) {
    props.revint_lead_temperature = temp;
  }

  // --- B. Karar / pitch sinyalleri ---------------------------------------
  // Angle precedence:
  //   1. headAgent.primaryAngle — display text, already "<wedge> → <plan>"
  //      for head-agent briefs (or the legacy free-text angle);
  //   2. headAgent.wedge id → label (+ package);
  //   3. SalesOpportunity projection: recommendedPackageReason
  //      ("Growth · Rezervasyon"), else bestSalesAngle wedge id → label;
  //   4. deterministic playbook angle.
  // A head-agent brief is the only decision for this lead. The old scorer,
  // the playbook angle and an older LeadNextAction are a different narrative.
  const ha = headAgent?.briefMode === "head-agent" ? headAgent : null;
  const pkg = packageLabel(headAgent?.recommendedPackage);
  const wedgeFromAgent = wedgeLabel(headAgent?.wedge);
  const angle =
    headAgent?.primaryAngle ??
    (wedgeFromAgent ? (pkg ? `${wedgeFromAgent} — Package: ${pkg}` : wedgeFromAgent) : null) ??
    (ha
      ? null
      : (str(opportunity?.recommendedPackageReason) ??
        wedgeLabel(opportunity?.bestSalesAngle) ??
        picked?.angle.label ??
        null));
  if (angle) props.revint_recommended_angle = clip(angle);
  if (ha) {
    // "" clears a talk left by an earlier run when this card is plain.
    props.revint_next_best_action = clip(ha.talkTrack ?? "");
  } else {
    const nba = str(nextAction?.openingHook) ?? headAgent?.talkTrack ?? null;
    if (nba) props.revint_next_best_action = clip(nba);
  }
  props.revint_qualification_status = lead.qualification?.status ?? "not_started";
  if (lead.qualification?.noShowRisk) {
    const upper = RISK_TO_UPPER[String(lead.qualification.noShowRisk).toLowerCase()];
    if (upper) props.revint_no_show_risk = upper;
  }
  if (lead.subNicheSlug) {
    props.revint_detected_sub_niche = lead.subNicheSlug;
  }

  // --- C. Kanıt / provenance --------------------------------------------
  if (headAgent && (headAgent.evidenceRefs.length > 0 || headAgent.confidence !== null)) {
    const header = [
      `Head Agent${headAgent.confidence !== null ? ` (${headAgent.confidence}%)` : ""}`,
      pkg ? `Package: ${pkg}` : null,
      wedgeFromAgent ? `Wedge: ${wedgeFromAgent}` : null,
      headAgent.roomTwoStatus ? `Card: ${headAgent.roomTwoStatus === "attached" ? "talk passed QA" : `plain (${headAgent.roomTwoStatus})`}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    props.revint_evidence_summary = clip(
      [header, ...headAgent.evidenceRefs.map((e) => `- ${e}`)].join("\n"),
    );
  } else if (picked && picked.matchedTriggers.length > 0) {
    props.revint_evidence_summary = clip(`Signals: ${picked.matchedTriggers.join(", ")}`);
  }
  if (headAgent) {
    props.revint_source_conflicts = clip(
      headAgent.sourceConflicts.length > 0
        ? headAgent.sourceConflicts
            .map(
              (c) =>
                `${c.claim}${c.sources.length ? ` [${c.sources.join(" vs ")}]` : ""}${c.note ? ` — ${c.note}` : ""}`,
            )
            .join("\n")
        : "No cross-source conflicts detected",
    );
  }
  if (ha) {
    const bullets = (lines: string[]) => lines.map((l) => `- ${l}`).join("\n");
    props.revint_do_not_pitch = clip(
      bullets([...ha.bans, ...ha.excludedModules.map((m) => `${m.module}: ${m.why}`)]),
    );
    props.revint_open_questions = clip(
      bullets([...ha.openQuestions, ...ha.missingSources.map((s) => `Eksik kaynak: ${s}`)]),
    );
    if (ha.generatedAt) props.revint_analyzed_at = ha.generatedAt;
  }
  props.revint_action_sheet_url = actionSheetUrl(leadId);

  // HubSpot rejects empty enum writes with a 400 that fails the whole
  // PATCH — drop any that ended up empty.
  for (const key of Object.keys(props)) {
    if (REVINT_ENUM_PROPERTY_NAMES.has(key) && !props[key]) delete props[key];
  }

  return {
    properties: props,
    playbookStageKey: lead.playbookStageKey,
    lead: {
      crmContactId: lead.crmContactId,
      crmCompanyId: lead.crmCompanyId,
      crmDealId: lead.crmDealId,
    },
  };
}

const NEW_PROPERTY_NAMES = ["revint_do_not_pitch", "revint_open_questions", "revint_analyzed_at"] as const;

/**
 * HubSpot fails the whole PATCH with a 400 when one property does not
 * exist. A portal that has not re-provisioned still gets the original
 * eleven: drop the new three and try once more.
 */
async function patchWithFallback<T>(
  patch: (props: Record<string, string>) => Promise<T>,
  props: Record<string, string>,
): Promise<T> {
  try {
    return await patch(props);
  } catch (err) {
    if (!/does not exist|PROPERTY_DOESNT_EXIST/i.test(errText(err))) throw err;
    const slim = { ...props };
    for (const k of NEW_PROPERTY_NAMES) delete slim[k];
    logger.warn("hubspot.writeback.unprovisioned_properties", { dropped: NEW_PROPERTY_NAMES });
    return patch(slim);
  }
}

function isPrimaryAssociation(a: {
  associationTypes?: Array<{ label?: string | null; typeId?: number }>;
}): boolean {
  return (a.associationTypes ?? []).some(
    (t) => (t.label ?? "").toLowerCase() === "primary" || t.typeId === 1,
  );
}

/**
 * Resolve the Company to write for a contact-only lead: the contact's
 * primary associated company — unless another lead in this workspace
 * already owns that company (its own brief writes it).
 */
async function resolveAssociatedCompany(
  prisma: PrismaClient,
  client: HubspotClient,
  workspaceId: string,
  leadId: string,
  contactId: string,
): Promise<string | null> {
  try {
    const assocs = await client.getAssociations("contacts", contactId, "companies");
    const sorted = [...(assocs.results ?? [])].sort(
      (a, b) => Number(isPrimaryAssociation(b)) - Number(isPrimaryAssociation(a)),
    );
    const first = sorted[0];
    if (!first) return null;
    const companyId = String(first.toObjectId);
    const owner = await prisma.lead.findFirst({
      where: { workspaceId, crmCompanyId: companyId, id: { not: leadId } },
      select: { id: true },
    });
    return owner ? null : companyId;
  } catch (err) {
    logger.warn("hubspot.writeback.company_association_failed", {
      workspaceId,
      leadId,
      err: errText(err),
    });
    return null;
  }
}

/**
 * Perform a single writeback for a lead. Idempotent (see module doc).
 * Returns the sync outcome; never throws for HubSpot failures.
 */
export async function enqueueCrmWriteback(
  prisma: PrismaClient,
  input: EnqueueWritebackInput,
): Promise<WritebackResult> {
  const { workspaceId, leadId, reason, briefRunId } = input;

  // An "analysis" writeback fired from INSIDE a running brief (the legacy
  // in-run call in lead-intelligence-brief.ts) would read the previous
  // run's output and a stale next action. The post-run hook
  // (`writebackAfterBriefRun`) does it with the fresh output instead.
  if (reason === "analysis" && !briefRunId) {
    const running = await prisma.agentRun.findFirst({
      where: { workspaceId, leadId, workerKind: BRIEF_WORKER_KIND, status: "RUNNING" },
      select: { id: true },
    });
    if (running) return { status: "SKIPPED", reason: "deferred_to_brief_completion" };
  }

  const built = await buildRevintProperties(prisma, workspaceId, leadId, { briefRunId });
  if (!built) return { status: "SKIPPED", reason: "lead_not_found" };

  const { crmContactId, crmCompanyId, crmDealId } = built.lead;
  if (!crmContactId && !crmDealId && !crmCompanyId) {
    return { status: "SKIPPED", reason: "no_crm_linkage" };
  }

  const payloadHash = briefRunId
    ? briefRunSyncHash(briefRunId)
    : hashProps(built.properties, reason);

  // Idempotency: an identical successful writeback already happened.
  const prior = await prisma.crmSyncLog.findUnique({
    where: {
      workspaceId_direction_payloadHash: {
        workspaceId,
        direction: "OUTBOUND",
        payloadHash,
      },
    },
  });
  if (prior?.status === "SUCCESS") {
    return { status: "SKIPPED", reason: "duplicate" };
  }

  // Record the attempt (PENDING). Upsert so a prior FAILED row is retried.
  const log = await prisma.crmSyncLog.upsert({
    where: {
      workspaceId_direction_payloadHash: {
        workspaceId,
        direction: "OUTBOUND",
        payloadHash,
      },
    },
    create: {
      workspaceId,
      leadId,
      direction: "OUTBOUND",
      objectType: crmCompanyId ? "company" : crmContactId ? "contact" : "deal",
      payloadHash,
      status: "PENDING",
      attempts: 1,
    },
    update: { status: "PENDING", attempts: { increment: 1 } },
  });

  let client: HubspotClient;
  try {
    client = await getHubspotClient(prisma, workspaceId);
  } catch (err) {
    const skip = err instanceof HubspotNotConnectedError;
    await prisma.crmSyncLog.update({
      where: { id: log.id },
      data: {
        status: skip ? "SKIPPED" : "FAILED",
        lastError: errText(err),
      },
    });
    return { status: skip ? "SKIPPED" : "FAILED", reason: skip ? "not_connected" : errText(err) };
  }

  const companyId =
    crmCompanyId ??
    (crmContactId
      ? await resolveAssociatedCompany(prisma, client, workspaceId, leadId, crmContactId)
      : null);

  const targets: string[] = [];
  const failures: string[] = [];
  let externalId: string | undefined;

  // Company first: it's where FineDine's restaurants live.
  if (companyId) {
    try {
      const res = await patchWithFallback((p) => client.updateCompany(companyId, p), built.properties);
      externalId = res?.id ?? companyId;
      targets.push(`company:${companyId}`);
    } catch (err) {
      failures.push(`company:${companyId} → ${errText(err)}`);
    }
  }

  if (crmContactId) {
    try {
      const res = await patchWithFallback((p) => client.updateContact(crmContactId, p), built.properties);
      externalId = externalId ?? res?.id ?? crmContactId;
      targets.push(`contact:${crmContactId}`);

      if (reason === "disposition" && input.engagementNote) {
        try {
          await client.createCall({
            contactId: crmContactId,
            body: input.engagementNote,
            title: "Revint call disposition",
            dealId: crmDealId,
            disposition: input.callDisposition,
          });
        } catch (err) {
          logger.warn("hubspot.writeback.engagement_failed", { leadId, err: errText(err) });
        }
      }
    } catch (err) {
      failures.push(`contact:${crmContactId} → ${errText(err)}`);
    }
  }

  // Deal stage writeback (stage reason carries the rolled-up playbook
  // stage; the field-map resolves pipeline + stage ids).
  if (reason === "stage" && crmDealId && built.playbookStageKey) {
    try {
      const conn = await prisma.crmConnection.findUnique({
        where: { workspaceId_provider: { workspaceId, provider: "HUBSPOT" } },
        select: { fieldMappingJson: true, defaultPipelineId: true },
      });
      const mapping =
        (conn?.fieldMappingJson as unknown as CrmFieldMapping | null) ?? null;
      const playbook = await getPlaybook(prisma, workspaceId);
      const target = mapPlaybookStageToHubspot(
        built.playbookStageKey,
        playbook,
        mapping,
        conn?.defaultPipelineId,
      );
      if (target) {
        await client.updateDeal(crmDealId, { dealstage: target.stageId });
        targets.push(`deal:${crmDealId}`);
      }
    } catch (err) {
      failures.push(`deal:${crmDealId} → ${errText(err)}`);
    }
  }

  if (failures.length > 0) {
    const lastError = [
      ...failures,
      ...(targets.length ? [`partial success: ${targets.join(", ")}`] : []),
    ]
      .join("\n")
      .slice(0, 4000);
    logger.error("hubspot.writeback.failed", { workspaceId, leadId, reason, briefRunId, lastError });
    await prisma.crmSyncLog.update({
      where: { id: log.id },
      data: { status: "FAILED", lastError },
    });
    return { status: "FAILED", reason: lastError, targets };
  }

  if (targets.length === 0) {
    await prisma.crmSyncLog.update({
      where: { id: log.id },
      data: { status: "SKIPPED", lastError: "no_writable_target" },
    });
    return { status: "SKIPPED", reason: "no_writable_target" };
  }

  await prisma.$transaction([
    prisma.crmSyncLog.update({
      where: { id: log.id },
      data: { status: "SUCCESS", externalId, lastError: null },
    }),
    prisma.lead.updateMany({
      where: { id: leadId, workspaceId },
      data: { crmLastSyncedAt: new Date() },
    }),
  ]);
  logger.info("hubspot.writeback.success", { workspaceId, leadId, reason, briefRunId, targets });
  return { status: "SUCCESS", targets };
}

/**
 * Reconcile tick — retry FAILED outbound syncs. Call from a cron route
 * or the workers supervisor. Bounded to avoid hammering HubSpot; gives
 * up on a row after `maxAttempts`.
 *
 * The retry re-builds the CURRENT properties (a fresh payload hash), so
 * the original FAILED row is closed out here: SUCCESS/SKIPPED when the
 * retry resolved it, otherwise its `attempts` is bumped so it eventually
 * ages out instead of being retried forever.
 */
export async function reconcileCrmWriteback(
  prisma: PrismaClient,
  opts: { workspaceId?: string; limit?: number; maxAttempts?: number } = {},
): Promise<{
  retried: number;
  succeeded: number;
  failed: number;
  failures: Array<{ leadId: string; status: string; reason?: string }>;
}> {
  const { limit = 50, maxAttempts = 5 } = opts;
  const rows = await prisma.crmSyncLog.findMany({
    where: {
      direction: "OUTBOUND",
      status: "FAILED",
      attempts: { lt: maxAttempts },
      ...(opts.workspaceId ? { workspaceId: opts.workspaceId } : {}),
      leadId: { not: null },
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
    select: { id: true, workspaceId: true, leadId: true },
  });

  let succeeded = 0;
  let failed = 0;
  const failures: Array<{ leadId: string; status: string; reason?: string }> =
    [];
  for (const row of rows) {
    if (!row.leadId) continue;
    const res = await enqueueCrmWriteback(prisma, {
      workspaceId: row.workspaceId,
      leadId: row.leadId,
      reason: "analysis",
    });
    if (res.status === "SUCCESS" || res.status === "SKIPPED") {
      succeeded += 1;
      await prisma.crmSyncLog.updateMany({
        where: { id: row.id, workspaceId: row.workspaceId, status: "FAILED" },
        data: {
          status: res.status,
          lastError: res.status === "SKIPPED" ? `resolved_by_retry:${res.reason ?? "skipped"}` : null,
        },
      });
    } else {
      failed += 1;
      await prisma.crmSyncLog.updateMany({
        where: { id: row.id, workspaceId: row.workspaceId },
        data: { attempts: { increment: 1 } },
      });
      failures.push({
        leadId: row.leadId,
        status: res.status,
        reason: res.reason,
      });
    }
  }
  return { retried: rows.length, succeeded, failed, failures };
}
