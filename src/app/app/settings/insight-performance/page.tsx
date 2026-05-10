/**
 * Insight Performance settings page.
 *
 * Surfaces every CommercialInsight available to the active workspace
 * (workspace-owned + system seeds) along with rolled-up reply / meeting
 * / win counters from `InsightPerformance`. Operator can spot which
 * Challenger reframes pay off and prune low-signal ones (Phase 2 will
 * add an inline `basePriority` slider).
 */
import { requireWorkspaceAdmin } from "@/lib/auth";
import { InsightPerformanceTable } from "@/components/app/insight-performance-table";

export default async function InsightPerformanceSettingsPage() {
  await requireWorkspaceAdmin();
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[var(--leadac-text-1)]">
          Commercial insight performance
        </h2>
        <p className="mt-1 text-sm text-[var(--leadac-text-3)]">
          Win-rate by Challenger reframe across every lead in this workspace.
          Insights with zero applications are displayed below the active set,
          ordered by their seeded base priority.
        </p>
      </div>
      <InsightPerformanceTable />
    </div>
  );
}
