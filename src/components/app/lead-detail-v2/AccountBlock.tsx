"use client";

/**
 * AccountBlock — multi-location account view (Phase 4) for the v2
 * lead-detail page. Mounts with id `account-block`.
 *
 * Layout:
 *   - Top: account header (name · tier · locationsCount).
 *   - Middle: sister-leads table (PRO_TEAM+) or upgrade teaser.
 *   - Bottom: cross-branch insight callout when conditions match.
 *   - `accountId === null` → single-location stub.
 *
 * LAZY-LOAD:
 *   The `expanded` prop flips true the moment the parent <Block />
 *   transitions stub → expanded. The `useSisterLeads` hook is gated on
 *   `enabled = expanded && plan unlocked` so the route never fires
 *   for a) collapsed blocks and b) accounts that we already know are
 *   plan-locked. Per RETHINK §9 Q5 + PLAN §6 risk #2 (N+1).
 *
 * PLAN GATING (PLAN §5.3):
 *   - FREE / PRO: locations count visible (from `accountSummary`);
 *     sister-rows table NOT visible — render upgrade teaser.
 *   - PRO_TEAM: sister-rows table visible; cross-branch callout
 *     visible but `[ⓘ apply]` reads "Upgrade to AGENCY".
 *   - AGENCY: full apply works.
 *
 * A11Y:
 *   - Sister-rows table is `<table role="grid">` with arrow-key
 *     navigation between rows handled here at the table level.
 *   - Mobile collapses to a vertical card list — every card is a
 *     focusable button.
 *   - Single-location stub still has min-height to keep CLS at 0.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import { PlanLockedBlock, type PlanLockedBlockCopy } from "./PlanLockedBlock";
import {
  CrossBranchInsightCallout,
  type CrossBranchInsightCalloutCopy,
  type CrossBranchInsightData,
} from "./CrossBranchInsightCallout";
import { SisterLeadRow, type SisterLeadRowCopy } from "./SisterLeadRow";
import { AccountMapMini, type AccountMapMiniCopy } from "./AccountMapMini";
import {
  PipelineStateChips,
  type PipelineStateChipsCopy,
} from "./PipelineStateChips";
import type {
  AccountSummaryDto,
  DiscoveredLinksDto,
  PipelineStateDto,
} from "@/lib/lead-detail/use-decision-surface";
import type { SisterLeadSummary } from "@/lib/lead-detail/sister-leads";
import { useSisterLeads } from "@/lib/lead-detail/use-sister-leads";

export interface AccountBlockCopy {
  /** Header chrome */
  tierLabel: string;
  locationsLabel: string;
  /** Loading skeleton helper text (visually hidden — for screen readers). */
  loading: string;
  /** "Single-location" empty stub copy. */
  singleLocation: {
    title: string;
    body: string;
  };
  /** Plan teaser when sister-rows are locked behind PRO_TEAM. */
  locked: PlanLockedBlockCopy;
  /** "No sister branches yet" when account exists but has only this lead. */
  noSisters: string;
  /** Table column headers (visually shown on desktop, sr-only on mobile). */
  columns: {
    name: string;
    stage: string;
    icp: string;
    lastTouch: string;
    disposition: string;
    actions: string;
  };
  row: SisterLeadRowCopy;
  callout: CrossBranchInsightCalloutCopy;
  // Phase 2.5 — additive copy for the absorbed V1 panels.
  map?: AccountMapMiniCopy;
  pipeline?: PipelineStateChipsCopy;
  directoriesHeading?: string;
}

export interface AccountBlockProps {
  leadId: string;
  /** True once the parent <Block /> stub transitions to expanded. */
  expanded: boolean;
  /** Already on the aggregator response — drives header + locations count. */
  accountSummary: AccountSummaryDto | null;
  /** Account id from `leadCore`. Null = single-location lead. */
  accountId: string | null;
  /** Plan tier from the aggregator's `planGate`. */
  plan: "FREE" | "PRO" | "PRO_TEAM" | "AGENCY";
  /** Optional pre-computed cross-branch insight; if absent the block
   *  derives one heuristically from the loaded sister-leads list. */
  crossBranchInsight?: CrossBranchInsightData | null;
  /** Workspace id — passed through to telemetry events only. */
  workspaceId: string;
  /** Telemetry hook (defensive PostHog wrapper supplied by parent). */
  onTelemetry?: (event: string, props: Record<string, unknown>) => void;
  /** Phase 2.5 — coords for `AccountMapMini` (from `leadCore.sourceLat/Lng`). */
  sourceLat?: number | null;
  sourceLng?: number | null;
  /** Phase 2.5 — pipeline lifecycle chips (from `decision-surface.pipelineState`). */
  pipelineState?: PipelineStateDto | null;
  /** Phase 2.5 — discovered account-level directories
   *  (from `decision-surface.discoveredLinks.directories`). */
  discoveredLinks?: DiscoveredLinksDto | null;
  copy: AccountBlockCopy;
}

const SISTER_LEADS_PAGE_SIZE = 20;

function pickCrossBranchInsight(
  items: SisterLeadSummary[],
  override: CrossBranchInsightData | null | undefined,
): CrossBranchInsightData | null {
  if (override) return override;
  // Heuristic: the most recent WON sister-lead becomes the source
  // quote target. The richer "trigger × MEDDPICC × insight performance"
  // join lives in a follow-up worker; the UI surface is shipped now so
  // we can measure intent.
  const won = items.find((s) => s.isWon);
  if (!won) return null;
  return {
    insightId: `derived:${won.id}`,
    insightQuote: won.businessName,
    sisterLeadId: won.id,
    sisterLeadName: won.businessName,
    triggerType: "DERIVED",
  };
}

function SkeletonRows({ rows = 4 }: { rows?: number }): ReactNode {
  const arr = Array.from({ length: rows }, (_, i) => i);
  return (
    <div
      data-testid="account-block-loading"
      className="flex flex-col gap-2"
      style={{ minHeight: rows * 36 }}
    >
      {arr.map((i) => (
        <div
          key={i}
          aria-hidden
          className="skeleton-apple h-9 w-full rounded-md"
        />
      ))}
    </div>
  );
}

function AccountHeader({
  accountSummary,
  copy,
}: {
  accountSummary: AccountSummaryDto;
  copy: Pick<AccountBlockCopy, "tierLabel" | "locationsLabel">;
}): ReactNode {
  return (
    <div
      data-testid="account-block-header"
      className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
    >
      <span
        className="text-[14px] font-medium"
        style={{ color: "var(--leadac-text-1)" }}
      >
        {accountSummary.name}
      </span>
      {accountSummary.tier ? (
        <span
          className="text-[11px] uppercase tracking-[0.08em]"
          style={{ color: "var(--leadac-text-3)" }}
        >
          {copy.tierLabel} · {accountSummary.tier.replace("_", " ")}
        </span>
      ) : null}
      {accountSummary.locationsCount != null ? (
        <span
          data-testid="account-block-locations-count"
          className="text-[11px]"
          style={{ color: "var(--leadac-text-3)" }}
        >
          {copy.locationsLabel.replace(
            "{n}",
            String(accountSummary.locationsCount),
          )}
        </span>
      ) : null}
    </div>
  );
}

export function AccountBlock({
  leadId,
  expanded,
  accountSummary,
  accountId,
  plan,
  crossBranchInsight,
  workspaceId,
  onTelemetry,
  sourceLat,
  sourceLng,
  pipelineState,
  discoveredLinks,
  copy,
}: AccountBlockProps) {
  const router = useRouter();
  const tableRef = useRef<HTMLTableElement | null>(null);
  const expandedTelemetryRef = useRef(false);

  const isPlanUnlocked = plan === "PRO_TEAM" || plan === "AGENCY";
  const sisterLeadsEnabled =
    expanded && Boolean(accountId) && isPlanUnlocked;

  const sister = useSisterLeads({
    leadId,
    enabled: sisterLeadsEnabled,
    take: SISTER_LEADS_PAGE_SIZE,
  });

  useEffect(() => {
    if (!expanded) return;
    if (expandedTelemetryRef.current) return;
    expandedTelemetryRef.current = true;
    onTelemetry?.("lead_detail.account.expanded", {
      leadId,
      workspaceId,
      accountId,
      locationsCount: accountSummary?.locationsCount ?? null,
    });
  }, [
    expanded,
    leadId,
    workspaceId,
    accountId,
    accountSummary?.locationsCount,
    onTelemetry,
  ]);

  const navigate = useCallback(
    (sisterId: string) => {
      onTelemetry?.("lead_detail.sister_lead.navigated", {
        fromLeadId: leadId,
        toLeadId: sisterId,
      });
      router.push(`/app/leads/${sisterId}?v=2&from=${leadId}`);
    },
    [leadId, onTelemetry, router],
  );

  const onTableKeyDown = (e: KeyboardEvent<HTMLTableElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const root = tableRef.current;
    if (!root) return;
    const focusables = Array.from(
      root.querySelectorAll<HTMLElement>("tr[tabindex='0']"),
    );
    if (focusables.length === 0) return;
    const active = document.activeElement as HTMLElement | null;
    const idx = active ? focusables.indexOf(active) : -1;
    let nextIdx: number;
    if (e.key === "ArrowDown") {
      nextIdx = idx < 0 ? 0 : Math.min(focusables.length - 1, idx + 1);
    } else {
      nextIdx = idx < 0 ? focusables.length - 1 : Math.max(0, idx - 1);
    }
    focusables[nextIdx]?.focus();
    e.preventDefault();
  };

  const insightForCallout = useMemo(
    () => pickCrossBranchInsight(sister.items, crossBranchInsight),
    [sister.items, crossBranchInsight],
  );

  useEffect(() => {
    if (!insightForCallout) return;
    if (!sisterLeadsEnabled) return;
    onTelemetry?.("lead_detail.cross_branch_insight.shown", {
      leadId,
      insightId: insightForCallout.insightId,
      sisterLeadId: insightForCallout.sisterLeadId,
    });
  }, [insightForCallout, sisterLeadsEnabled, leadId, onTelemetry]);

  if (accountId == null || accountSummary == null) {
    return (
      <div
        data-testid="account-block-single"
        className="flex flex-col gap-3"
      >
        <div
          className="flex flex-col gap-1.5 rounded-lg border border-dashed px-3 py-3"
          style={{
            borderColor: "var(--leadac-border)",
            minHeight: 64,
          }}
        >
          <p
            className="text-[13px] font-medium"
            style={{ color: "var(--leadac-text-1)" }}
          >
            {copy.singleLocation.title}
          </p>
          <p
            className="text-[12px]"
            style={{ color: "var(--leadac-text-3)" }}
          >
            {copy.singleLocation.body}
          </p>
        </div>
        {/*
         * Phase 2.5 — pipeline chips + map remain useful even on the
         * single-location stub since they describe THIS lead's
         * lifecycle and geography (no sister-rows required).
         */}
        {copy.pipeline ? (
          <PipelineStateChips state={pipelineState ?? null} copy={copy.pipeline} />
        ) : null}
        {copy.map && sourceLat != null && sourceLng != null ? (
          <AccountMapMini
            lat={sourceLat}
            lng={sourceLng}
            businessName={accountSummary?.name ?? ""}
            copy={copy.map}
          />
        ) : null}
      </div>
    );
  }

  const directories = discoveredLinks?.directories ?? [];

  return (
    <div data-testid="account-block-body" className="flex flex-col gap-3">
      <AccountHeader accountSummary={accountSummary} copy={copy} />

      {/* Phase 2.5 — pipeline chips (PLAN §5.9 row 7). */}
      {copy.pipeline ? (
        <PipelineStateChips state={pipelineState ?? null} copy={copy.pipeline} />
      ) : null}

      {!isPlanUnlocked ? (
        <PlanLockedBlock copy={copy.locked} />
      ) : sister.isLoading && sister.items.length === 0 ? (
        <>
          <span className="sr-only">{copy.loading}</span>
          <SkeletonRows />
        </>
      ) : sister.items.length === 0 ? (
        <p
          data-testid="account-block-no-sisters"
          className="text-[13px]"
          style={{ color: "var(--leadac-text-3)", minHeight: 56 }}
        >
          {copy.noSisters}
        </p>
      ) : (
        <>
          {/* Desktop / tablet: table grid */}
          <div className="hidden sm:block">
            <table
              ref={tableRef}
              role="grid"
              aria-label={accountSummary.name}
              data-testid="sister-leads-table"
              onKeyDown={onTableKeyDown}
              className="w-full border-collapse text-left"
            >
              <thead>
                <tr role="row">
                  <th
                    scope="col"
                    role="columnheader"
                    className="px-2 py-1 text-[10px] font-medium uppercase tracking-[0.06em]"
                    style={{ color: "var(--leadac-text-3)" }}
                  >
                    {copy.columns.name}
                  </th>
                  <th
                    scope="col"
                    role="columnheader"
                    className="px-2 py-1 text-[10px] font-medium uppercase tracking-[0.06em]"
                    style={{ color: "var(--leadac-text-3)" }}
                  >
                    {copy.columns.stage}
                  </th>
                  <th
                    scope="col"
                    role="columnheader"
                    className="px-2 py-1 text-[10px] font-medium uppercase tracking-[0.06em]"
                    style={{ color: "var(--leadac-text-3)" }}
                  >
                    {copy.columns.icp}
                  </th>
                  <th
                    scope="col"
                    role="columnheader"
                    className="px-2 py-1 text-[10px] font-medium uppercase tracking-[0.06em]"
                    style={{ color: "var(--leadac-text-3)" }}
                  >
                    {copy.columns.lastTouch}
                  </th>
                  <th
                    scope="col"
                    role="columnheader"
                    className="px-2 py-1 text-[10px] font-medium uppercase tracking-[0.06em]"
                    style={{ color: "var(--leadac-text-3)" }}
                  >
                    {copy.columns.disposition}
                  </th>
                  <th
                    scope="col"
                    role="columnheader"
                    className="px-2 py-1 text-right text-[10px] font-medium uppercase tracking-[0.06em]"
                    style={{ color: "var(--leadac-text-3)" }}
                  >
                    <span className="sr-only">{copy.columns.actions}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sister.items.map((s) => (
                  <SisterLeadRow
                    key={s.id}
                    sister={s}
                    isCurrent={s.id === leadId}
                    onNavigate={navigate}
                    copy={copy.row}
                    variant="row"
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: vertical card list (no horizontal scroll). */}
          <div className="flex flex-col gap-2 sm:hidden">
            {sister.items.map((s) => (
              <SisterLeadRow
                key={s.id}
                sister={s}
                isCurrent={s.id === leadId}
                onNavigate={navigate}
                copy={copy.row}
                variant="card"
              />
            ))}
          </div>

          {insightForCallout ? (
            <CrossBranchInsightCallout
              data={insightForCallout}
              plan={plan}
              copy={copy.callout}
            />
          ) : null}
        </>
      )}

      {/* Phase 2.5 — account-level directories strip (PLAN §5.9 row 5). */}
      {copy.directoriesHeading && directories.length > 0 ? (
        <section className="space-y-1.5">
          <span
            className="text-[10px] uppercase tracking-[0.06em]"
            style={{ color: "var(--leadac-text-3)" }}
          >
            {copy.directoriesHeading}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {directories.slice(0, 8).map((d) => (
              <a
                key={`${d.name}:${d.url}`}
                href={d.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/3 px-2 py-0.5 text-[11px]"
                style={{ color: "var(--leadac-text-2)" }}
              >
                {d.name}
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {/* Phase 2.5 — AccountMapMini (PLAN §5.9 row 5/8). */}
      {copy.map && sourceLat != null && sourceLng != null ? (
        <AccountMapMini
          lat={sourceLat}
          lng={sourceLng}
          businessName={accountSummary.name}
          copy={copy.map}
        />
      ) : null}
    </div>
  );
}
