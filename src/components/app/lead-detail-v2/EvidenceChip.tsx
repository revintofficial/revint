"use client";

/**
 * EvidenceChip — 12px badge + hover/tap card with the source quote.
 *
 * RETHINK §4.4 mandates inline reasoning: every claim renders as
 * `[CLAIM] · [evidence-chip] [evidence-chip]`. There is no "Why?" link.
 * Phase 1 only consumes the trigger + arbitration shape; the type
 * union exists from day 1 so phases 2-3 can drop in stakeholder /
 * BANT / SPIN / discovery chips without touching consumers.
 *
 * Desktop: hover or focus opens the source-quote popover (Radix).
 * Mobile (Phase 5): tap opens a slide-up footnote band rendered via
 * the global `<BottomSheet>` primitive — focus trap, ESC dismiss,
 * tap-outside dismiss are all inherited. The desktop popover is
 * never mounted on phone so the `pointer: coarse` chip never
 * accidentally renders the hover card.
 */

import {
  type ReactNode,
  useCallback,
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type EvidenceChipType =
  | "linkedin"
  | "review"
  | "audit"
  | "voice-note"
  | "prior-nba"
  | "contradiction";

export interface EvidenceChipCopy {
  sourceLabel: string;
  dismiss: string;
  types: Record<EvidenceChipType, string>;
}

export interface EvidenceChipProps {
  type: EvidenceChipType;
  /** Short visible chip label, e.g. "hiring" or "delivery". */
  label: string;
  /** Optional source quote shown in the popover body. */
  sourceQuote?: string | null;
  /** Optional confidence 0..1, rendered as a small fraction in the popover. */
  confidence?: number | null;
  /** Optional URL the chip links to (LinkedIn profile, review URL, etc.). */
  href?: string | null;
  /** Slot for non-quote source content (e.g. structured chips for contradictions). */
  children?: ReactNode;
  copy: EvidenceChipCopy;
}

const TYPE_GLYPH: Record<EvidenceChipType, string> = {
  linkedin: "in",
  review: "★",
  audit: "✓",
  "voice-note": "vn",
  "prior-nba": "↻",
  contradiction: "⚠",
};

const TYPE_TONE: Record<EvidenceChipType, string> = {
  linkedin: "var(--leadac-info)",
  review: "var(--leadac-warning)",
  audit: "var(--leadac-success)",
  "voice-note": "var(--leadac-500)",
  "prior-nba": "var(--leadac-text-2)",
  contradiction: "var(--leadac-error)",
};

function subscribeCoarsePointer(cb: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia("(pointer: coarse)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function readCoarsePointer(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

function readCoarsePointerServer(): boolean {
  return false;
}

function useIsCoarsePointer(): boolean {
  return useSyncExternalStore(
    subscribeCoarsePointer,
    readCoarsePointer,
    readCoarsePointerServer,
  );
}

export function EvidenceChip({
  type,
  label,
  sourceQuote,
  confidence,
  href,
  children,
  copy,
}: EvidenceChipProps) {
  const triggerId = useId();
  const coarse = useIsCoarsePointer();
  const [open, setOpen] = useState(false);

  const tone = TYPE_TONE[type];
  const glyph = TYPE_GLYPH[type];
  const typeLabel = copy.types[type];

  const handleHoverOpen = useCallback(() => {
    if (!coarse) setOpen(true);
  }, [coarse]);
  const handleHoverClose = useCallback(() => {
    if (!coarse) setOpen(false);
  }, [coarse]);

  const ariaLabel = useMemo(() => {
    return `${typeLabel}: ${label}`;
  }, [typeLabel, label]);

  const triggerButton = (
    <button
      id={triggerId}
      type="button"
      aria-label={ariaLabel}
      data-testid="evidence-chip-trigger"
      onMouseEnter={handleHoverOpen}
      onMouseLeave={handleHoverClose}
      onFocus={handleHoverOpen}
      onBlur={handleHoverClose}
      onClick={coarse ? () => setOpen(true) : undefined}
      className="inline-flex h-5 max-w-48 items-center gap-1 truncate rounded-full border border-white/10 bg-white/3 px-1.5 text-[11px] leading-none transition-colors hover:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--leadac-500)/55"
      style={{ color: "var(--leadac-text-2)" }}
    >
      <span
        aria-hidden
        className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-semibold uppercase"
        style={{
          background: "color-mix(in srgb, " + tone + " 22%, transparent)",
          color: tone,
        }}
      >
        {glyph}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );

  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: tone }}
        >
          {typeLabel}
        </span>
        {typeof confidence === "number" ? (
          <span className="text-[10px]" style={{ color: "var(--leadac-text-3)" }}>
            {Math.round(confidence * 100)}%
          </span>
        ) : null}
      </div>
      {sourceQuote ? (
        <p
          className="whitespace-pre-line"
          style={{ color: "var(--leadac-text-1)" }}
        >
          <span
            className="mr-1 text-[10px] uppercase tracking-[0.06em]"
            style={{ color: "var(--leadac-text-3)" }}
          >
            {copy.sourceLabel}
          </span>
          {sourceQuote}
        </p>
      ) : null}
      {children}
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-block text-[11px] underline"
          style={{ color: "var(--leadac-info)" }}
        >
          {href}
        </a>
      ) : null}
    </>
  );

  // Phase 5 — phone tap opens the slide-up footnote band, not a hover
  // card. We only mount the BottomSheet branch when `pointer: coarse`
  // matches so the desktop hover popover never ships on phones (and
  // the mobile sheet never collides with a fine-pointer click).
  if (coarse) {
    return (
      <>
        {triggerButton}
        <BottomSheet
          open={open}
          onOpenChange={setOpen}
          title={typeLabel}
          description={label}
          snap="auto"
        >
          <div
            data-testid="evidence-chip-sheet"
            className="space-y-2 text-[14px]"
          >
            {body}
          </div>
        </BottomSheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 space-y-2 text-[12px]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {body}
      </PopoverContent>
    </Popover>
  );
}

export interface BuiltEvidenceChip {
  key: string;
  type: EvidenceChipType;
  label: string;
  sourceQuote: string | null;
  confidence: number | null;
  href: string | null;
}

export function buildTriggerEvidenceChip(args: {
  triggerId: string;
  type: EvidenceChipType;
  label: string;
  evidence: unknown;
  confidence?: number | null;
}): BuiltEvidenceChip {
  const { triggerId, type, label, evidence, confidence } = args;
  let sourceQuote: string | null = null;
  let href: string | null = null;
  if (evidence && typeof evidence === "object") {
    const e = evidence as Record<string, unknown>;
    if (typeof e.quote === "string") sourceQuote = e.quote;
    else if (typeof e.text === "string") sourceQuote = e.text;
    else if (typeof e.summary === "string") sourceQuote = e.summary;
    if (typeof e.url === "string") href = e.url;
    else if (typeof e.sourceUrl === "string") href = e.sourceUrl;
  }
  return {
    key: triggerId,
    type,
    label,
    sourceQuote,
    confidence: confidence ?? null,
    href,
  };
}

/**
 * Phase 2 — `Stakeholder.source` is a free-form string column on the
 * Stakeholder row that records where the buying-committee mapper
 * found the person ("LinkedIn People Search", "team-page-crawl",
 * "manual entry"...). The chip surfaces it inline on stakeholder
 * cards so the rep doesn't have to expand a card to know whether the
 * row is reliable.
 */
export function buildStakeholderEvidenceChip(args: {
  stakeholderId: string;
  source: string;
  linkedinUrl?: string | null;
  label?: string;
}): BuiltEvidenceChip {
  const lower = args.source.toLowerCase();
  const type: EvidenceChipType = lower.includes("linkedin")
    ? "linkedin"
    : "audit";
  return {
    key: `sh:${args.stakeholderId}`,
    type,
    label: args.label ?? args.source,
    sourceQuote: args.source,
    confidence: null,
    href: args.linkedinUrl ?? null,
  };
}

/**
 * Phase 2 — `DealQualificationFact.sourceQuote` is the raw extract
 * the MEDDPICC extractor pulled from the source artifact. The chip
 * carries the quote verbatim so the rep can read the actual sentence
 * without leaving the page (RETHINK §4.4 "no Why? link").
 */
export function buildDealQualFactChip(args: {
  factId: string;
  fieldPath: string;
  sourceQuote: string | null;
  sourceRefType: string | null;
  confidence: number;
}): BuiltEvidenceChip {
  const refType = args.sourceRefType?.toLowerCase() ?? "";
  const type: EvidenceChipType = refType.includes("voice")
    ? "voice-note"
    : refType.includes("review")
      ? "review"
      : refType.includes("linkedin")
        ? "linkedin"
        : "audit";
  return {
    key: `dq:${args.factId}`,
    type,
    label: args.fieldPath,
    sourceQuote: args.sourceQuote,
    confidence: args.confidence,
    href: null,
  };
}

/**
 * Phase 2 — `DiscoveryItem.evidence` is a free-text quote excerpted
 * from the underlying voice note / call note for the SPIN
 * classification. We always render this as a `voice-note` chip
 * because every discovery item today flows through transcription.
 */
export function buildDiscoveryItemChip(args: {
  itemId: string;
  spinKind: string;
  evidence: string | null;
  confidence: number;
}): BuiltEvidenceChip {
  return {
    key: `sp:${args.itemId}`,
    type: "voice-note",
    label: args.spinKind.toLowerCase().replace(/_/g, " "),
    sourceQuote: args.evidence,
    confidence: args.confidence,
    href: null,
  };
}
