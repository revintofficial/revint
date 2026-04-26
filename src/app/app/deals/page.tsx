"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { GitBranch, Star, Phone, MapPin } from "lucide-react";
import { DealSidePanel } from "./deal-side-panel";
import type { PipelineStage, DealItem } from "./types";

const STAGES: { id: PipelineStage; label: string; accent: string }[] = [
  { id: "NEW", label: "New", accent: "text-white/60" },
  { id: "REACHED_OUT", label: "Reached Out", accent: "text-(--leadac-500)" },
  { id: "IN_TALKS", label: "In Talks", accent: "text-[hsl(38_70%_52%)]" },
  { id: "WON", label: "Won", accent: "text-[hsl(152_48%_50%)]" },
  { id: "LOST", label: "Lost", accent: "text-[hsl(4_62%_54%)]" },
];

export default function DealsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-4 sm:p-6 md:p-8 lg:p-10 space-y-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-[420px] rounded-2xl" />
        </div>
      }
    >
      <DealsBoard />
    </Suspense>
  );
}

function DealsBoard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeLeadId = searchParams.get("lead");

  const [items, setItems] = useState<DealItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const reorderInFlight = useRef(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/watchlist");
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items || []);
    } catch (err) {
      console.error("Failed to fetch deals:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const grouped = useMemo(() => {
    const map: Record<PipelineStage, DealItem[]> = {
      NEW: [],
      REACHED_OUT: [],
      IN_TALKS: [],
      WON: [],
      LOST: [],
    };
    for (const it of items) {
      const stage = (it.pipelineStage as PipelineStage) || "NEW";
      if (map[stage]) map[stage].push(it);
    }
    for (const stage of Object.keys(map) as PipelineStage[]) {
      map[stage].sort((a, b) => (a.stageOrder ?? 0) - (b.stageOrder ?? 0));
    }
    return map;
  }, [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  function findStage(id: string): PipelineStage | null {
    const found = items.find((i) => i.id === id);
    return (found?.pipelineStage as PipelineStage) ?? null;
  }

  function isStageId(id: string): id is PipelineStage {
    return (STAGES as ReadonlyArray<{ id: string }>).some((s) => s.id === id);
  }

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const activeStage = findStage(activeId);
    if (!activeStage) return;

    const overStage = isStageId(overId) ? overId : findStage(overId);
    if (!overStage) return;

    if (activeStage === overStage) return;

    // Cross-column move: relocate the card into the target column so the
    // preview reflects reality. Final order is committed on drag end.
    setItems((prev) => {
      const next = prev.map((i) =>
        i.id === activeId ? { ...i, pipelineStage: overStage } : i
      );
      return next;
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setDraggingId(null);
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    const activeItem = items.find((i) => i.id === activeId);
    if (!activeItem) return;

    const targetStage = isStageId(overId)
      ? overId
      : ((items.find((i) => i.id === overId)?.pipelineStage as PipelineStage) || activeItem.pipelineStage);

    // Build the new column ordering. Remove the active card from wherever it
    // currently lives, then reinsert at the drop position.
    const withoutActive = items.filter((i) => i.id !== activeId);
    const targetColumn = withoutActive
      .filter((i) => i.pipelineStage === targetStage)
      .sort((a, b) => (a.stageOrder ?? 0) - (b.stageOrder ?? 0));

    let insertAt = targetColumn.length;
    if (!isStageId(overId)) {
      const idx = targetColumn.findIndex((i) => i.id === overId);
      if (idx >= 0) insertAt = idx;
    }

    const reordered = [...targetColumn];
    reordered.splice(insertAt, 0, { ...activeItem, pipelineStage: targetStage });

    const sequenced = reordered.map((card, idx) => ({
      ...card,
      stageOrder: idx,
    }));

    // Optimistic update.
    setItems((prev) => {
      const byId = new Map(sequenced.map((c) => [c.id, c]));
      return prev
        .filter((i) => i.pipelineStage !== targetStage || !byId.has(i.id))
        .concat(sequenced);
    });

    // Persist in a single transaction.
    if (reorderInFlight.current) return;
    reorderInFlight.current = true;
    try {
      await fetch("/api/watchlist/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: sequenced.map((c) => ({
            id: c.id,
            pipelineStage: targetStage,
            stageOrder: c.stageOrder,
          })),
        }),
      });
    } catch (err) {
      console.error("Reorder failed:", err);
      fetchItems();
    } finally {
      reorderInFlight.current = false;
    }
  };

  const handleCardClick = (leadId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("lead", leadId);
    router.replace(`/app/deals?${params.toString()}`, { scroll: false });
  };

  const handleClosePanel = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("lead");
    const qs = params.toString();
    router.replace(qs ? `/app/deals?${qs}` : "/app/deals", { scroll: false });
  };

  const selectedItem = activeLeadId
    ? items.find((i) => i.lead.id === activeLeadId) || null
    : null;

  const handleItemPatch = (itemId: string, patch: Partial<DealItem>) => {
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...patch } : i)));
  };

  const handleItemRemove = (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    handleClosePanel();
  };

  const activeCard = draggingId ? items.find((i) => i.id === draggingId) : null;

  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-10 space-y-6">
      <PageHeader
        title="Deals"
        subtitle={loading ? "Loading..." : `${items.length} deal${items.length === 1 ? "" : "s"} in pipeline`}
      />

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-[320px] rounded-2xl" />
          ))}
        </div>
      )}

      {!loading && items.length === 0 && (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                <GitBranch className="w-6 h-6 text-white/30" />
              </div>
              <p className="text-lg font-medium text-white/60">No deals yet</p>
              <p className="text-sm text-white/40 max-w-sm">
                Shortlist a lead from the Leads page and it will land here in the New column.
              </p>
              <Link
                href="/app/leads"
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-(--leadac-500) hover:bg-(--leadac-600) text-white text-sm font-medium transition-colors"
              >
                <Star className="w-4 h-4" />
                Go to Leads
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && items.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
            {STAGES.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                items={grouped[stage.id]}
                onCardClick={handleCardClick}
                activeLeadId={activeLeadId}
              />
            ))}
          </div>

          <DragOverlay>
            {activeCard ? <DealCard item={activeCard} dragging /> : null}
          </DragOverlay>
        </DndContext>
      )}

      <DealSidePanel
        item={selectedItem}
        open={!!selectedItem}
        onClose={handleClosePanel}
        onPatch={handleItemPatch}
        onRemove={handleItemRemove}
      />
    </div>
  );
}

function KanbanColumn({
  stage,
  items,
  onCardClick,
  activeLeadId,
}: {
  stage: { id: PipelineStage; label: string; accent: string };
  items: DealItem[];
  onCardClick: (leadId: string) => void;
  activeLeadId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppableColumn(stage.id);

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-2xl border bg-white/[0.02] transition-colors ${
        isOver ? "border-(--leadac-500)/40 bg-(--leadac-500)/[0.04]" : "border-white/10"
      }`}
    >
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${stage.accent}`}>{stage.label}</span>
          <span className="text-xs font-medium text-white/30 bg-white/5 px-1.5 py-0.5 rounded-full">
            {items.length}
          </span>
        </div>
      </div>

      <SortableContext
        id={stage.id}
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-2 p-2 min-h-[120px]">
          {items.length === 0 ? (
            <div className="flex items-center justify-center min-h-[80px] text-xs text-white/20">
              Drop here
            </div>
          ) : (
            items.map((item) => (
              <SortableCard
                key={item.id}
                item={item}
                onClick={() => onCardClick(item.lead.id)}
                highlighted={activeLeadId === item.lead.id}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// dnd-kit droppable for the whole column so empty columns still accept drops.
function useDroppableColumn(id: PipelineStage) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return { setNodeRef, isOver };
}

function SortableCard({
  item,
  onClick,
  highlighted,
}: {
  item: DealItem;
  onClick: () => void;
  highlighted: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Let dnd-kit swallow pointer events when dragging; only treat as a
        // click when there was no meaningful drag (isDragging false at mouseup).
        if (isDragging) return;
        e.stopPropagation();
        onClick();
      }}
      className={`cursor-grab active:cursor-grabbing ${highlighted ? "ring-2 ring-(--leadac-500)/50 rounded-xl" : ""}`}
    >
      <DealCard item={item} />
    </div>
  );
}

function DealCard({ item, dragging }: { item: DealItem; dragging?: boolean }) {
  const opp = item.lead.salesOpportunity;
  const score = opp?.opportunityScore;
  const scoreColor =
    score == null
      ? "text-white/30 bg-white/5"
      : score >= 60
        ? "text-[hsl(152_48%_50%)] bg-[hsl(152_48%_50%)]/10"
        : score >= 35
          ? "text-[hsl(38_70%_52%)] bg-[hsl(38_70%_52%)]/10"
          : "text-white/50 bg-white/5";

  const relUpdated = relativeTime(item.updatedAt || item.createdAt);
  const hasBuiltSite = hasValidUrl(item.siteUrl);

  return (
    <div
      className={`rounded-xl border p-2.5 space-y-1.5 transition-shadow ${
        dragging
          ? "border-(--leadac-500)/50 bg-(--leadac-card) shadow-lg shadow-black/40"
          : hasBuiltSite
            ? "border-[hsl(152_48%_50%)]/40 bg-[hsl(152_48%_50%)]/10 hover:border-[hsl(152_48%_50%)]/60"
            : "border-white/10 bg-(--leadac-card) hover:border-white/20"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-white leading-tight line-clamp-2 flex-1 min-w-0">
          {item.lead.businessName}
        </p>
        <span
          className={`shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded-md ${scoreColor}`}
          title="Opportunity score"
        >
          {score ?? "–"}
        </span>
      </div>

      {(item.selectedOffer || item.lead.borough) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {item.selectedOffer && (
            <Badge
              className={
                item.selectedOffer === "STARTER"
                  ? "bg-[hsl(152_48%_50%)]/10 text-[hsl(152_48%_50%)] border-[hsl(152_48%_50%)]/20 text-[10px] px-1.5 py-0"
                  : item.selectedOffer === "GROWTH"
                    ? "bg-(--leadac-500)/10 text-(--leadac-500) border-(--leadac-500)/20 text-[10px] px-1.5 py-0"
                    : "bg-(--leadac-400)/10 text-(--leadac-300) text-[10px] px-1.5 py-0"
              }
            >
              {item.selectedOffer}
            </Badge>
          )}
          {item.lead.borough && (
            <span className="text-[10px] text-white/30 truncate">{item.lead.borough}</span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] text-white/40">
        <span>{relUpdated ? `Updated ${relUpdated}` : ""}</span>
        <span className="flex items-center gap-1.5">
          {item.lead.phone && <Phone className="w-3 h-3" />}
          {item.lead.googleMapsUri && <MapPin className="w-3 h-3" />}
        </span>
      </div>
    </div>
  );
}

// Matches the old Shortlist card's "built site highlight" rule: URL must
// parse and contain a dot in the hostname so half-typed entries don't
// prematurely flip the card green.
function hasValidUrl(raw: string | null | undefined): boolean {
  if (!raw || !raw.trim()) return false;
  try {
    const urlStr = raw.startsWith("http") ? raw : `https://${raw}`;
    const parsed = new URL(urlStr);
    return parsed.hostname.includes(".");
  } catch {
    return false;
  }
}

function relativeTime(iso?: string) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  const yr = Math.floor(day / 365);
  return `${yr}y ago`;
}
