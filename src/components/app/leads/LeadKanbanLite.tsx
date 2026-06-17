"use client";

/**
 * LeadKanbanLite — pipeline-stage kanban that operates on ALL leads
 * (not just shortlisted ones, like /app/deals does).
 *
 * Columns map to `WatchlistItem.pipelineStage`:
 *   - NEW (default for unshortlisted leads — they're treated as
 *     pipelineStage=NEW even without a watchlist row)
 *   - REACHED_OUT
 *   - IN_TALKS
 *   - WON
 *   - LOST
 *
 * Drag a card to a different column → we POST to
 * `/api/leads/bulk-action` with action="set_stage", which:
 *   1. auto-creates a `WatchlistItem` if the lead doesn't have one
 *   2. updates `pipelineStage` to the target column
 *
 * Optimistic UI: the card moves immediately; on failure we revert and
 * surface a toast. The drag is intentionally column-scoped (no
 * within-column reordering) to stay loosely coupled with the deals
 * page's `stageOrder` ledger.
 */

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LeadBadgeRow,
  PipelineStageDot,
  ScoreBadge,
} from "@/components/app/leads/LeadRow";
import { formatRelativeTime } from "@/components/app/leads/format";
import { PIPELINE_STAGE_LABELS } from "@/lib/labels";
import { Bookmark, GripVertical, MapPin, Phone, Users } from "lucide-react";
import type { LeadListItem } from "@/components/app/leads/useLeadsQuery";

type Stage = "NEW" | "REACHED_OUT" | "IN_TALKS" | "WON" | "LOST";

const STAGES: { id: Stage; accent: string }[] = [
  { id: "NEW", accent: "text-[var(--revint-text-2)]" },
  { id: "REACHED_OUT", accent: "text-[var(--revint-warning)]" },
  { id: "IN_TALKS", accent: "text-(--revint-400)" },
  { id: "WON", accent: "text-[var(--revint-success)]" },
  { id: "LOST", accent: "text-[var(--revint-error)]" },
];

export interface LeadKanbanLiteProps {
  leads: LeadListItem[];
  loading: boolean;
  onMutate: () => void;
}

export default function LeadKanbanLite({
  leads,
  loading,
  onMutate,
}: LeadKanbanLiteProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<Record<string, Stage>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const grouped = useMemo(() => {
    const map: Record<Stage, LeadListItem[]> = {
      NEW: [],
      REACHED_OUT: [],
      IN_TALKS: [],
      WON: [],
      LOST: [],
    };
    for (const lead of leads) {
      const explicit = optimistic[lead.id];
      const stage =
        explicit ??
        ((lead.watchlistItem?.pipelineStage as Stage | undefined) ?? "NEW");
      map[stage].push(lead);
    }
    return map;
  }, [leads, optimistic]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setDraggingId(null);
      const { active, over } = event;
      if (!over) return;
      const leadId = String(active.id);
      const target = String(over.id) as Stage;
      if (!STAGES.some((s) => s.id === target)) return;

      const lead = leads.find((l) => l.id === leadId);
      if (!lead) return;
      const current =
        optimistic[leadId] ??
        ((lead.watchlistItem?.pipelineStage as Stage | undefined) ?? "NEW");
      if (current === target) return;

      // Optimistic move first; revert on API failure.
      setOptimistic((prev) => ({ ...prev, [leadId]: target }));
      try {
        const res = await fetch("/api/leads/bulk-action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leadIds: [leadId],
            action: "set_stage",
            payload: { stage: target },
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast.success(
          `Moved to ${PIPELINE_STAGE_LABELS[target] ?? target}`,
          { duration: 1800 },
        );
        onMutate();
      } catch (err) {
        console.error("Kanban stage update failed:", err);
        toast.error("Could not update stage. Please try again.");
        setOptimistic((prev) => {
          const next = { ...prev };
          delete next[leadId];
          return next;
        });
      }
    },
    [leads, optimistic, onMutate],
  );

  if (loading && leads.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {STAGES.map((s) => (
          <Skeleton key={s.id} className="h-[420px] rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!loading && leads.length === 0) {
    return (
      <Card>
        <div className="p-12 flex flex-col items-center justify-center gap-3 text-center">
          <Users className="w-10 h-10 text-white/20" />
          <p className="text-sm font-medium text-white/50">
            No leads to organise yet
          </p>
          <p className="text-xs text-white/30">
            Run discovery to populate the pipeline.
          </p>
          <Link
            href="/app/discovery"
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-(--revint-500) hover:bg-(--revint-600) text-white text-sm font-medium transition-colors"
          >
            Go to Discovery
          </Link>
        </div>
      </Card>
    );
  }

  const draggingLead = draggingId
    ? leads.find((l) => l.id === draggingId) ?? null
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(e: DragStartEvent) => setDraggingId(String(e.active.id))}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {STAGES.map((stage) => (
          <Column
            key={stage.id}
            stageId={stage.id}
            accent={stage.accent}
            leads={grouped[stage.id]}
          />
        ))}
      </div>

      <DragOverlay>
        {draggingLead ? <LeadKanbanCard lead={draggingLead} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  stageId,
  accent,
  leads,
}: {
  stageId: Stage;
  accent: string;
  leads: LeadListItem[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stageId });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border bg-white/[0.02] flex flex-col min-h-[420px] transition-colors ${
        isOver
          ? "border-(--revint-500)/60 bg-(--revint-500)/[0.06]"
          : "border-white/5"
      }`}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <span className={`text-xs font-semibold uppercase tracking-wider ${accent}`}>
          {PIPELINE_STAGE_LABELS[stageId] ?? stageId}
        </span>
        <span className="text-[10px] font-medium text-white/40 px-1.5 py-0.5 rounded-md bg-white/5">
          {leads.length}
        </span>
      </div>
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[600px]">
        {leads.length === 0 ? (
          <div className="text-[11px] text-white/20 text-center py-6">
            Drop leads here
          </div>
        ) : (
          leads.map((lead) => <LeadKanbanCard key={lead.id} lead={lead} />)
        )}
      </div>
    </div>
  );
}

function LeadKanbanCard({
  lead,
  dragging = false,
}: {
  lead: LeadListItem;
  dragging?: boolean;
}) {
  const { setNodeRef, attributes, listeners, transform, isDragging } =
    useDraggable({ id: lead.id });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`rounded-xl border border-white/10 bg-(--revint-card) p-2.5 cursor-grab active:cursor-grabbing transition-shadow ${
        isDragging || dragging ? "shadow-lg ring-1 ring-(--revint-500)/40" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-3 h-3 text-white/30 shrink-0 mt-1" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-start justify-between gap-1">
            <Link
              href={`/app/leads/${lead.id}`}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="text-[12.5px] font-semibold text-white hover:text-(--revint-500) transition-colors leading-tight line-clamp-2"
            >
              {lead.businessName}
            </Link>
            {lead.salesOpportunity ? (
              <ScoreBadge score={lead.salesOpportunity.opportunityScore} />
            ) : null}
          </div>
          <p className="text-[10px] text-white/30 line-clamp-1">
            {lead.borough || lead.formattedAddress}
          </p>
          <LeadBadgeRow lead={lead} />
          <div className="flex items-center justify-between pt-1">
            <span className="text-[9px] uppercase tracking-wider text-white/30">
              {formatRelativeTime(lead.updatedAt)}
            </span>
            <div className="flex items-center gap-1.5">
              {lead.watchlistItem ? (
                <PipelineStageDot
                  stage={lead.watchlistItem.pipelineStage ?? "NEW"}
                />
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] text-white/40">
                  <Bookmark className="w-2.5 h-2.5" />
                  Not in deals
                </span>
              )}
              {lead.phone ? (
                <Phone className="w-2.5 h-2.5 text-white/30" />
              ) : null}
              {lead.googleMapsUri ? (
                <MapPin className="w-2.5 h-2.5 text-white/30" />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
