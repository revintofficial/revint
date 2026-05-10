"use client";

/**
 * ReasoningGraphFullView — Phase 7 primary surface for the
 * `/app/leads/[id]/reasoning/[actionId]` route.
 *
 * Re-uses the existing `<ReasoningTraceExpandable>` graph render
 * but as the page hero (no expand/collapse toggle, no card chrome).
 * The route's server component already enforces multi-tenant scope
 * and plan gating; this component is purely presentational.
 *
 * On mount it fires `lead_detail.reasoning.viewed` via the typed
 * telemetry catalog so the dashboard can prune the reasoning route
 * if no rep ever opens it.
 */

import { useEffect, useRef } from "react";

import { ReasoningTraceExpandable } from "@/components/app/nba/ReasoningTraceExpandable";
import type {
  ContradictionRecord,
  ReasoningGraph,
} from "@/lib/sdr-brain/reasoning-graph";
import { track } from "@/lib/lead-detail/telemetry";

export interface ReasoningGraphFullViewProps {
  leadId: string;
  actionId: string;
  graph: ReasoningGraph | null;
  contradictions: ContradictionRecord[];
  empty: string;
}

export function ReasoningGraphFullView({
  leadId,
  actionId,
  graph,
  contradictions,
  empty,
}: ReasoningGraphFullViewProps) {
  const firedRef = useRef(false);
  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    track("lead_detail.reasoning.viewed", { leadId, actionId });
  }, [leadId, actionId]);

  if (!graph) {
    return (
      <p
        className="rounded-lg border border-dashed px-4 py-8 text-center text-[13px]"
        style={{
          borderColor: "var(--leadac-border)",
          color: "var(--leadac-text-3)",
        }}
        data-testid="reasoning-graph-empty"
      >
        {empty}
      </p>
    );
  }

  return (
    <div data-testid="reasoning-graph-full-view">
      <ReasoningTraceExpandable graph={graph} contradictions={contradictions} />
    </div>
  );
}
