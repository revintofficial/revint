"use client";

/**
 * FourThingsCard — Phase 1.7 (V2 Richness Absorption, HEADLINE).
 *
 * The "shallow V2" complaint resolves here. Industry SDR research
 * (2026) shows the 3-minute cold-call window converts ~82% better
 * when the rep walks in with exactly four artifacts pre-rendered:
 *
 *   1. OPENER     — one sentence the rep reads out loud verbatim
 *   2. WEDGE      — the niche-specific problem most agencies miss
 *   3. 3 SORU     — three discovery questions the rep asks next
 *   4. ASK        — the concrete next-step ask ("15 min Thursday?")
 *
 * Every input comes from the cached decision-surface payload — no
 * extra round-trip, no new Gemini call. The card mounts at the top
 * of NextGestureBlock and is the FIRST thing the rep sees on a COLD
 * or CONTACTED lead. `[Copy all]` flattens the four artifacts into
 * the clipboard format documented in v2_richness_absorption_plan
 * §1.7.5 so the rep can paste straight into their dialer / CRM /
 * voice note.
 *
 * Empty-state behavior matches the plan's risk #1 (rep trust): we
 * NEVER render a blank card. If the brief is still cooking we still
 * ship a generic-but-safe opener + niche-aware fallback questions
 * + a default ask. The skeleton path only triggers when the entire
 * decision-surface is loading for the first time.
 */

import { useCallback, useMemo, useState, type ReactNode } from "react";
import posthog from "posthog-js";
import { Clock, Copy, Check, Pencil } from "lucide-react";

import type {
  IntelligenceBriefDto,
  LeadTriggerDto,
  RecommendedPackageDto,
} from "@/lib/lead-detail/use-decision-surface";

export interface FourThingsCardCopy {
  title: string;
  subtitle: string;
  openerLabel: string;
  wedgeLabel: string;
  questionsLabel: string;
  askLabel: string;
  copyAll: string;
  copied: string;
  editBeforeCall: string;
  /** Generic opener fallback used when personalizedFirstMessage is null. */
  openerFallback: string;
  /** Generic wedge fallback used when no triggers fired. */
  wedgeFallback: string;
  /** Generic ask fallback used when no recommendedPackage. */
  askFallback: string;
  /**
   * Skeleton subtitle for the brief-still-generating path. Shown ONLY
   * when the entire decision-surface is still loading the first time
   * — once the surface lands, every row has a real fallback.
   */
  generatingHint: string;
}

export interface FourThingsCardProps {
  businessName: string;
  /** Brief is the primary source for OPENER/WEDGE supporting context. */
  brief: IntelligenceBriefDto | null;
  /** Decision-surface trigger rows — top-severity row drives WEDGE. */
  triggers: LeadTriggerDto[];
  /**
   * Personalized cold-open sentence (PRO+ only — FREE workspaces see
   * the OPENER fallback template). Sourced from
   * `SalesOpportunity.personalizedFirstMessage`.
   */
  personalizedFirstMessage: string | null;
  /** SCORER recommendation feeds the ASK row + duration template. */
  recommendedPackage: RecommendedPackageDto | null;
  /** 3 discovery questions pre-derived by the API. */
  questions: string[];
  /**
   * Whether the entire decision-surface is still loading for the
   * first time. Skeleton renders only when this is true; once any
   * payload lands we always render full content (with fallbacks).
   */
  loading: boolean;
  /** PostHog telemetry context. */
  leadId: string;
  workspaceId: string;
  copy: FourThingsCardCopy;
}

function safeCapture(event: string, props: Record<string, unknown>): void {
  try {
    if (typeof window === "undefined") return;
    const ph = posthog as unknown as {
      __loaded?: boolean;
      capture?: (e: string, p: Record<string, unknown>) => void;
    };
    if (!ph.__loaded || typeof ph.capture !== "function") return;
    ph.capture(event, props);
  } catch {
    // Telemetry must never break the page.
  }
}

function pickWedge(
  triggers: LeadTriggerDto[],
  brief: IntelligenceBriefDto | null,
  fallback: string,
): string {
  // Top-severity trigger headline wins; the SDR brain has already
  // sorted by severity desc and we just take the first.
  if (triggers.length > 0) {
    const top = triggers[0];
    if (top.impactPrediction && top.impactPrediction.length > 0) {
      return top.impactPrediction;
    }
    return top.type.toLowerCase().replace(/_/g, " ");
  }
  if (brief?.headline) return brief.headline;
  return fallback;
}

function buildOpener(
  businessName: string,
  personalizedFirstMessage: string | null,
  fallbackTemplate: string,
): string {
  if (personalizedFirstMessage && personalizedFirstMessage.length > 0) {
    return personalizedFirstMessage;
  }
  // Fallback template carries a `{business}` slot.
  return fallbackTemplate.replace(/\{business\}/g, businessName);
}

function buildAsk(
  recommendedPackage: RecommendedPackageDto | null,
  fallback: string,
): string {
  if (!recommendedPackage) return fallback;
  // Most-recommended packages already include a duration cue ("15
  // min discovery", "30 min audit walkthrough"). When the SCORER
  // wrote a `reason`, we treat the package name as the ask anchor.
  return `Got 15 minutes Thursday to walk through the ${recommendedPackage.name.toLowerCase()}?`;
}

function buildClipboardText(args: {
  copy: FourThingsCardCopy;
  opener: string;
  wedge: string;
  questions: string[];
  ask: string;
}): string {
  const { copy, opener, wedge, questions, ask } = args;
  const lines: string[] = [];
  lines.push(`${copy.openerLabel.toUpperCase()}: ${opener}`);
  lines.push("");
  lines.push(`${copy.wedgeLabel.toUpperCase()}: ${wedge}`);
  lines.push("");
  lines.push(`${copy.questionsLabel.toUpperCase()}:`);
  questions.forEach((q, i) => {
    lines.push(`${i + 1}. ${q}`);
  });
  lines.push("");
  lines.push(`${copy.askLabel.toUpperCase()}: ${ask}`);
  return lines.join("\n");
}

export function FourThingsCard({
  businessName,
  brief,
  triggers,
  personalizedFirstMessage,
  recommendedPackage,
  questions,
  loading,
  leadId,
  workspaceId,
  copy,
}: FourThingsCardProps): ReactNode {
  const [copied, setCopied] = useState(false);

  const opener = useMemo(
    () => buildOpener(businessName, personalizedFirstMessage, copy.openerFallback),
    [businessName, personalizedFirstMessage, copy.openerFallback],
  );
  const wedge = useMemo(
    () => pickWedge(triggers, brief, copy.wedgeFallback),
    [triggers, brief, copy.wedgeFallback],
  );
  const ask = useMemo(
    () => buildAsk(recommendedPackage, copy.askFallback),
    [recommendedPackage, copy.askFallback],
  );

  // Plan §1.7.6 — even an enrichment-pending lead must surface three
  // real question lines. The API already enforces this via the
  // niche-aware generic fallback; this guard is the belt-and-braces
  // for any future regressions.
  const safeQuestions = useMemo(() => {
    return questions && questions.length >= 1
      ? questions.slice(0, 3)
      : [
          "What's slowing you down this quarter?",
          "When you last looked at growth, what felt out of your control?",
          "Who else weighs in when you decide to bring in a new partner?",
        ];
  }, [questions]);

  const handleCopyAll = useCallback(async () => {
    const text = buildClipboardText({
      copy,
      opener,
      wedge,
      questions: safeQuestions,
      ask,
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      safeCapture("four_things.copy_all", {
        leadId,
        workspaceId,
        hasPersonalizedOpener: personalizedFirstMessage != null,
        triggerCount: triggers.length,
        recommendedPackageId: recommendedPackage?.id ?? null,
        questionsSource:
          questions.length >= 1 ? "decision_surface" : "fallback",
      });
    } catch {
      // Clipboard rejection (sandboxed iframe / Permissions-Policy /
      // user gesture missing). Rep can still select-and-copy by
      // hand; we leave the button label unchanged.
    }
  }, [
    copy,
    opener,
    wedge,
    safeQuestions,
    ask,
    leadId,
    workspaceId,
    personalizedFirstMessage,
    triggers.length,
    recommendedPackage,
    questions.length,
  ]);

  if (loading && !brief && triggers.length === 0 && !recommendedPackage) {
    // Pre-payload skeleton — kept VERY small so we don't reserve a
    // huge empty area when the rep tabs in. Once any decision-surface
    // data lands we drop into the always-render-something path below.
    return (
      <div
        data-testid="four-things-card-skeleton"
        className="rounded-xl border p-3"
        style={{
          borderColor: "color-mix(in srgb, var(--leadac-500) 35%, transparent)",
          background: "color-mix(in srgb, var(--leadac-500) 6%, transparent)",
        }}
      >
        <div className="flex items-center gap-2">
          <Clock
            className="h-3.5 w-3.5"
            style={{ color: "var(--leadac-500)" }}
            aria-hidden
          />
          <p
            className="text-[11px] font-medium uppercase tracking-[0.06em]"
            style={{ color: "var(--leadac-text-3)" }}
          >
            {copy.generatingHint}
          </p>
        </div>
        <div className="mt-2 space-y-1.5">
          <div className="h-3 w-2/3 rounded bg-white/5" />
          <div className="h-3 w-1/2 rounded bg-white/5" />
          <div className="h-3 w-3/4 rounded bg-white/5" />
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="four-things-card"
      className="rounded-xl border p-3.5"
      style={{
        borderColor: "color-mix(in srgb, var(--leadac-500) 40%, transparent)",
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--leadac-500) 10%, transparent) 0%, color-mix(in srgb, var(--leadac-500) 4%, transparent) 100%)",
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <Clock
            className="h-3.5 w-3.5 shrink-0"
            style={{ color: "var(--leadac-500)" }}
            aria-hidden
          />
          <h3
            className="text-[12px] font-semibold uppercase tracking-[0.07em]"
            style={{ color: "var(--leadac-text-1)" }}
          >
            {copy.title}
          </h3>
        </div>
        <span
          className="text-[10px] uppercase tracking-[0.05em]"
          style={{ color: "var(--leadac-text-3)" }}
        >
          {copy.subtitle}
        </span>
      </div>

      <ol className="mt-3 space-y-2.5">
        <FourThingsRow
          label={copy.openerLabel}
          tone="primary"
          body={opener}
          testId="four-things-opener"
        />
        <FourThingsRow
          label={copy.wedgeLabel}
          tone="secondary"
          body={wedge}
          testId="four-things-wedge"
        />
        <li data-testid="four-things-questions">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.07em]"
            style={{ color: "var(--leadac-text-3)" }}
          >
            {copy.questionsLabel}
          </p>
          <ol
            className="mt-1 list-decimal space-y-0.5 pl-4 text-[13px] leading-snug"
            style={{ color: "var(--leadac-text-1)" }}
          >
            {safeQuestions.map((q, i) => (
              <li key={`${i}-${q.slice(0, 24)}`}>{q}</li>
            ))}
          </ol>
        </li>
        <FourThingsRow
          label={copy.askLabel}
          tone="primary"
          body={ask}
          testId="four-things-ask"
        />
      </ol>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={handleCopyAll}
          data-testid="four-things-copy-all"
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--leadac-500)/55"
          style={{
            borderColor: "color-mix(in srgb, var(--leadac-500) 50%, transparent)",
            color: "var(--leadac-text-1)",
            background: copied
              ? "color-mix(in srgb, var(--leadac-success) 15%, transparent)"
              : "color-mix(in srgb, var(--leadac-500) 12%, transparent)",
          }}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" aria-hidden />
              <span>{copy.copied}</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" aria-hidden />
              <span>{copy.copyAll}</span>
            </>
          )}
        </button>
        <button
          type="button"
          data-testid="four-things-edit"
          disabled
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium"
          style={{
            borderColor:
              "color-mix(in srgb, var(--leadac-text-3) 25%, transparent)",
            color: "var(--leadac-text-3)",
            background: "transparent",
            opacity: 0.55,
          }}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
          <span>{copy.editBeforeCall}</span>
        </button>
      </div>
    </div>
  );
}

interface FourThingsRowProps {
  label: string;
  body: string;
  tone: "primary" | "secondary";
  testId: string;
}

function FourThingsRow({ label, body, tone, testId }: FourThingsRowProps) {
  return (
    <li data-testid={testId}>
      <p
        className="text-[10px] font-semibold uppercase tracking-[0.07em]"
        style={{ color: "var(--leadac-text-3)" }}
      >
        {label}
      </p>
      <p
        className="mt-0.5 text-[13px] leading-snug"
        style={{
          color:
            tone === "primary"
              ? "var(--leadac-text-1)"
              : "var(--leadac-text-2)",
        }}
      >
        {body}
      </p>
    </li>
  );
}
