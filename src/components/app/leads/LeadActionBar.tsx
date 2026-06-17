"use client";

/**
 * LeadActionBar — sticky bulk-action bar that appears once one or
 * more leads are selected.
 *
 * Wires up to `/api/leads/bulk-action` for shortlist / set_stage /
 * dossier / mockup / opener / deep_scan / discard. CSV export uses
 * the existing `/api/leads/export` endpoint and downloads a Blob
 * client-side.
 *
 * UX detail: every action surfaces a toast on success/failure and
 * clears the selection on success. Worker fan-outs only clear if the
 * server enqueued at least one run (otherwise we keep the selection
 * so the user can retry / shrink the batch).
 */

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bookmark,
  Bot,
  ChevronDown,
  Download,
  FileSpreadsheet,
  GitBranch,
  Loader2,
  Mail,
  Package,
  ScanSearch,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { PIPELINE_STAGE_LABELS } from "@/lib/labels";

type Stage = "NEW" | "REACHED_OUT" | "IN_TALKS" | "WON" | "LOST";

const STAGES: Stage[] = ["NEW", "REACHED_OUT", "IN_TALKS", "WON", "LOST"];

export interface LeadActionBarProps {
  selectedIds: string[];
  totalLoaded: number;
  onClear: () => void;
  onSelectAll: () => void;
  onDone: () => void;
}

export function LeadActionBar({
  selectedIds,
  totalLoaded,
  onClear,
  onSelectAll,
  onDone,
}: LeadActionBarProps) {
  const [running, setRunning] = useState<string | null>(null);

  const callBulk = useCallback(
    async (
      action: string,
      payload?: Record<string, unknown>,
      successLabel?: string,
    ) => {
      if (selectedIds.length === 0) return;
      setRunning(action);
      try {
        const res = await fetch("/api/leads/bulk-action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadIds: selectedIds, action, payload }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          const message =
            (body && typeof body === "object" && "message" in body
              ? String(body.message)
              : null) ??
            (body && typeof body === "object" && "error" in body
              ? String(body.error)
              : null) ??
            `HTTP ${res.status}`;
          toast.error(`${successLabel ?? action} failed: ${message}`);
          return;
        }
        const processed =
          typeof body.processed === "number" ? body.processed : selectedIds.length;
        toast.success(
          `${successLabel ?? action}: ${processed} lead${processed === 1 ? "" : "s"}`,
        );
        onClear();
        onDone();
      } catch (err) {
        console.error(err);
        toast.error("Bulk action failed: network error");
      } finally {
        setRunning(null);
      }
    },
    [selectedIds, onClear, onDone],
  );

  const exportCsv = useCallback(
    async (format: "csv" | "smartlead" | "instantly") => {
      if (selectedIds.length === 0) return;
      setRunning(`export:${format}`);
      try {
        const res = await fetch("/api/leads/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadIds: selectedIds, format }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const message =
            (body && typeof body === "object" && "error" in body
              ? String(body.error)
              : null) ?? `HTTP ${res.status}`;
          toast.error(`Export failed: ${message}`);
          return;
        }
        const blob = await res.blob();
        const filename =
          res.headers
            .get("Content-Disposition")
            ?.match(/filename="([^"]+)"/)?.[1] ??
          `leadac-${format}-${new Date().toISOString().slice(0, 10)}.csv`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success(
          `Exported ${selectedIds.length} lead${selectedIds.length === 1 ? "" : "s"} (${format})`,
        );
      } catch (err) {
        console.error(err);
        toast.error("Export failed: network error");
      } finally {
        setRunning(null);
      }
    },
    [selectedIds],
  );

  if (selectedIds.length === 0) return null;

  const isWorkerRun = running?.startsWith("worker:") ?? false;

  return (
    <div className="sticky top-3 z-40">
      <div className="rounded-2xl border border-(--revint-500)/40 bg-(--revint-card)/95 backdrop-blur shadow-lg shadow-black/30 px-3 py-2 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 mr-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-(--revint-500) text-white text-xs font-bold">
            {selectedIds.length}
          </span>
          <span className="text-xs text-white/70">
            selected<span className="text-white/30 ml-1">/ {totalLoaded} on this page</span>
          </span>
          <button
            onClick={onSelectAll}
            className="text-[11px] text-(--revint-300) hover:text-white"
          >
            Select page
          </button>
          <button
            onClick={onClear}
            className="text-[11px] text-white/40 hover:text-white inline-flex items-center gap-0.5"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        </div>

        <div className="h-5 w-px bg-white/10 hidden sm:block" />

        <BulkButton
          icon={<Bookmark className="w-3.5 h-3.5" />}
          label="Shortlist"
          loading={running === "shortlist"}
          disabled={!!running}
          onClick={() => callBulk("shortlist", undefined, "Shortlisted")}
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={!!running}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08] disabled:opacity-50"
            >
              <GitBranch className="w-3.5 h-3.5" />
              Set stage
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Move to stage</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {STAGES.map((stage) => (
              <DropdownMenuItem
                key={stage}
                onClick={() =>
                  callBulk(
                    "set_stage",
                    { stage },
                    `Stage: ${PIPELINE_STAGE_LABELS[stage] ?? stage}`,
                  )
                }
              >
                {PIPELINE_STAGE_LABELS[stage] ?? stage}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={!!running}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border border-(--revint-500)/30 bg-(--revint-500)/[0.08] text-(--revint-200) hover:bg-(--revint-500)/[0.14] disabled:opacity-50"
            >
              {isWorkerRun ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              AI actions
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Run worker on selection</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => callBulk("dossier", undefined, "Dossiers queued")}
            >
              <Package className="w-3.5 h-3.5" />
              Generate dossier
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => callBulk("mockup", undefined, "Mockups queued")}
            >
              <Bot className="w-3.5 h-3.5" />
              Generate mockup
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => callBulk("opener", undefined, "Openers queued")}
            >
              <Mail className="w-3.5 h-3.5" />
              Write opener
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => callBulk("deep_scan", undefined, "Deep scans queued")}
            >
              <ScanSearch className="w-3.5 h-3.5" />
              Deep scan
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={!!running}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08] disabled:opacity-50"
            >
              {running?.startsWith("export:") ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              Export
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => exportCsv("csv")}>
              <FileSpreadsheet className="w-3.5 h-3.5" />
              CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportCsv("smartlead")}>
              Smartlead-ready
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportCsv("instantly")}>
              Instantly-ready
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <BulkButton
          icon={<Trash2 className="w-3.5 h-3.5" />}
          label="Discard"
          tone="destructive"
          loading={running === "discard"}
          disabled={!!running}
          onClick={() => callBulk("discard", undefined, "Discarded")}
        />
      </div>
    </div>
  );
}

function BulkButton({
  icon,
  label,
  onClick,
  loading,
  disabled,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  tone?: "default" | "destructive";
}) {
  const className =
    tone === "destructive"
      ? "border-[hsl(4_62%_54%)]/30 bg-[hsl(4_62%_54%)]/[0.08] text-[hsl(4_42%_72%)] hover:bg-[hsl(4_62%_54%)]/[0.14]"
      : "border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08]";
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-8 px-2.5 text-[11px] gap-1 ${className}`}
      variant="ghost"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {label}
    </Button>
  );
}
