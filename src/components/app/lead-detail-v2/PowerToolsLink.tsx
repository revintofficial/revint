"use client";

/**
 * PowerToolsLink — top-right anchor that takes the rep to the
 * full Workers panel. Phase 1 points at the legacy tab
 * (`?tab=workers&v=1`) so power users can still reach the workers
 * grid; Phase 6 swaps the target to the dedicated
 * `/app/leads/[id]/workers` route.
 *
 * Mounts with id `power-tools-link` so the legacy-hash redirect
 * (`#workers`, `#anchor-workers-top`) can scroll to it.
 */

import Link from "next/link";
import { Wrench } from "lucide-react";

export interface PowerToolsLinkProps {
  leadId: string;
  label: string;
}

export function PowerToolsLink({ leadId, label }: PowerToolsLinkProps) {
  return (
    <Link
      id="power-tools-link"
      href={`/app/leads/${leadId}?tab=workers&v=1`}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/3 px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--leadac-500)/55"
      style={{ color: "var(--leadac-text-2)" }}
    >
      <Wrench className="h-3 w-3" aria-hidden />
      <span>{label}</span>
      <span aria-hidden>→</span>
    </Link>
  );
}
