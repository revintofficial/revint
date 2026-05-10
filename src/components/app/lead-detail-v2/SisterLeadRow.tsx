"use client";

/**
 * SisterLeadRow — single navigable row inside the v2 ACCOUNT block's
 * sister-leads table (Phase 4).
 *
 * Layout: a `<tr>` on desktop (lives inside `<table role="grid">` for
 * arrow-key navigation between rows). On mobile (< 640px) the table
 * collapses to a vertical card list (PLAN §4 line 334 — horizontal
 * scroll forbidden), and this component renders its mobile twin via
 * the `mobile` variant.
 *
 * The row is focusable and ENTER navigates. Arrow-key vertical
 * navigation is owned by the parent table (it tracks ref keys), not
 * here, to keep this primitive stateless.
 */

import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

import type {
  SisterLeadSummary,
} from "@/lib/lead-detail/sister-leads";
import type { LeadDetailV2Stage } from "@/lib/lead-detail/use-pipeline-stage";

export interface SisterLeadRowCopy {
  here: string;
  unknownIcp: string;
  noTouch: string;
  stages: Record<LeadDetailV2Stage, string>;
  dispositions: Record<string, string>;
  /** Relative-time formatter labels: "now", "{minutes}m", "{hours}h", "{days}d". */
  relative: {
    now: string;
    minutes: string;
    hours: string;
    days: string;
  };
}

export interface SisterLeadRowProps {
  sister: SisterLeadSummary;
  isCurrent: boolean;
  copy: SisterLeadRowCopy;
  onNavigate: (sisterId: string) => void;
  /** "row" → desktop table row; "card" → mobile vertical card. */
  variant: "row" | "card";
}

function formatRelative(
  iso: string | null,
  copy: SisterLeadRowCopy["relative"],
  empty: string,
): string {
  if (!iso) return empty;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return empty;
  if (ms < 60_000) return copy.now;
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return copy.minutes.replace("{n}", String(minutes));
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return copy.hours.replace("{n}", String(hours));
  const days = Math.floor(hours / 24);
  return copy.days.replace("{n}", String(days));
}

function StageChip({
  stage,
  copy,
}: {
  stage: LeadDetailV2Stage;
  copy: Record<LeadDetailV2Stage, string>;
}): ReactNode {
  const tone = stageTone(stage);
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em]"
      style={{ background: tone.bg, color: tone.fg }}
      data-stage={stage}
    >
      {copy[stage]}
    </span>
  );
}

function stageTone(stage: LeadDetailV2Stage): { bg: string; fg: string } {
  switch (stage) {
    case "WON":
      return {
        bg: "color-mix(in srgb, var(--leadac-success) 18%, transparent)",
        fg: "var(--leadac-success)",
      };
    case "LOST":
      return {
        bg: "color-mix(in srgb, var(--leadac-error) 18%, transparent)",
        fg: "var(--leadac-error)",
      };
    case "MEETING_BOOKED":
    case "PROPOSAL":
    case "NEGOTIATING":
      return {
        bg: "color-mix(in srgb, var(--leadac-500) 18%, transparent)",
        fg: "var(--leadac-500)",
      };
    case "REPLIED":
      return {
        bg: "color-mix(in srgb, var(--leadac-info, var(--leadac-500)) 18%, transparent)",
        fg: "var(--leadac-info, var(--leadac-500))",
      };
    case "CONTACTED":
      return {
        bg: "hsl(0 0% 100% / 0.06)",
        fg: "var(--leadac-text-2)",
      };
    case "COLD":
    default:
      return {
        bg: "hsl(0 0% 100% / 0.04)",
        fg: "var(--leadac-text-3)",
      };
  }
}

function IcpBadge({ score, unknown }: { score: number | null; unknown: string }): ReactNode {
  if (score == null) {
    return (
      <span
        className="text-[11px]"
        style={{ color: "var(--leadac-text-3)" }}
      >
        {unknown}
      </span>
    );
  }
  return (
    <span
      className="text-[11px] tabular-nums"
      style={{ color: "var(--leadac-text-2)" }}
      aria-label={`ICP ${score}`}
    >
      {score}
    </span>
  );
}

export function SisterLeadRow({
  sister,
  isCurrent,
  copy,
  onNavigate,
  variant,
}: SisterLeadRowProps) {
  const navigate = () => {
    if (isCurrent) return;
    onNavigate(sister.id);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (isCurrent) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      navigate();
    }
  };

  const lastTouchLabel = formatRelative(
    sister.lastActivityAt,
    copy.relative,
    copy.noTouch,
  );

  const dispositionLabel = sister.lastDisposition
    ? (copy.dispositions[sister.lastDisposition] ?? sister.lastDisposition)
    : null;

  const locationLabel = sister.borough ?? sister.subNicheLabel ?? null;

  if (variant === "card") {
    return (
      <button
        type="button"
        onClick={navigate}
        disabled={isCurrent}
        aria-current={isCurrent ? "page" : undefined}
        data-testid="sister-lead-card"
        className="flex w-full flex-col gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--leadac-500)/55 disabled:cursor-default"
        style={{
          borderColor: isCurrent
            ? "var(--leadac-500)"
            : "var(--leadac-border)",
          background: isCurrent
            ? "color-mix(in srgb, var(--leadac-500) 8%, transparent)"
            : "hsl(0 0% 100% / 0.02)",
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className="truncate text-[13px] font-medium"
            style={{ color: "var(--leadac-text-1)" }}
          >
            {sister.businessName}
          </span>
          {isCurrent ? (
            <span
              className="text-[10px] font-medium uppercase tracking-[0.08em]"
              style={{ color: "var(--leadac-500)" }}
            >
              {copy.here}
            </span>
          ) : (
            <ChevronRight
              aria-hidden
              className="h-3.5 w-3.5"
              style={{ color: "var(--leadac-text-3)" }}
            />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StageChip stage={sister.stage} copy={copy.stages} />
          <IcpBadge score={sister.icpScorePct} unknown={copy.unknownIcp} />
          {locationLabel ? (
            <span
              className="text-[11px]"
              style={{ color: "var(--leadac-text-3)" }}
            >
              {locationLabel}
            </span>
          ) : null}
          <span
            className="text-[11px]"
            style={{ color: "var(--leadac-text-3)" }}
          >
            {lastTouchLabel}
          </span>
          {dispositionLabel ? (
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-[0.06em]"
              style={{
                background: "hsl(0 0% 100% / 0.05)",
                color: "var(--leadac-text-3)",
              }}
            >
              {dispositionLabel}
            </span>
          ) : null}
        </div>
      </button>
    );
  }

  return (
    <tr
      role="row"
      tabIndex={isCurrent ? -1 : 0}
      data-testid="sister-lead-row"
      data-sister-id={sister.id}
      aria-current={isCurrent ? "page" : undefined}
      onClick={navigate}
      onKeyDown={onKeyDown}
      className="cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--leadac-500)/55"
      style={{
        background: isCurrent
          ? "color-mix(in srgb, var(--leadac-500) 6%, transparent)"
          : undefined,
      }}
    >
      <td role="gridcell" className="px-2 py-1.5">
        <div className="flex flex-col">
          <span
            className="truncate text-[13px] font-medium"
            style={{ color: "var(--leadac-text-1)" }}
          >
            {sister.businessName}
          </span>
          {locationLabel ? (
            <span
              className="truncate text-[11px]"
              style={{ color: "var(--leadac-text-3)" }}
            >
              {locationLabel}
            </span>
          ) : null}
        </div>
      </td>
      <td role="gridcell" className="px-2 py-1.5">
        <StageChip stage={sister.stage} copy={copy.stages} />
      </td>
      <td role="gridcell" className="px-2 py-1.5">
        <IcpBadge score={sister.icpScorePct} unknown={copy.unknownIcp} />
      </td>
      <td role="gridcell" className="px-2 py-1.5">
        <span
          className="text-[11px]"
          style={{ color: "var(--leadac-text-3)" }}
        >
          {lastTouchLabel}
        </span>
      </td>
      <td role="gridcell" className="px-2 py-1.5">
        {dispositionLabel ? (
          <span
            className="rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-[0.06em]"
            style={{
              background: "hsl(0 0% 100% / 0.05)",
              color: "var(--leadac-text-3)",
            }}
          >
            {dispositionLabel}
          </span>
        ) : null}
      </td>
      <td role="gridcell" className="px-2 py-1.5 text-right">
        {isCurrent ? (
          <span
            className="text-[10px] font-medium uppercase tracking-[0.08em]"
            style={{ color: "var(--leadac-500)" }}
          >
            {copy.here}
          </span>
        ) : (
          <ChevronRight
            aria-hidden
            className="ml-auto h-3.5 w-3.5"
            style={{ color: "var(--leadac-text-3)" }}
          />
        )}
      </td>
    </tr>
  );
}
