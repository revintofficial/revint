/**
 * Phase 4 — `AccountBlock` render-state matrix.
 *
 * Covers:
 *   1. Single-location stub when `accountId === null`.
 *   2. FREE / PRO plan-locked teaser (no sister rows).
 *   3. PRO_TEAM unlocked — populated table renders rows.
 *   4. AGENCY unlocked + cross-branch insight callout.
 *   5. Loading state (skeleton min-height).
 *   6. Empty state when account has zero sister leads.
 *
 * The `useSisterLeads` hook is mocked so we can exercise each branch
 * without a real fetch. Next.js's `useRouter` is also mocked.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const pushSpy = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushSpy }),
}));

interface SisterLeadShape {
  id: string;
  businessName: string;
  borough: string | null;
  subNicheSlug: string | null;
  subNicheLabel: string | null;
  stage: string;
  pipelineStatus: string;
  icpScorePct: number | null;
  salesConfidence: number | null;
  lastActivityAt: string | null;
  lastDisposition: string | null;
  isWon: boolean;
}

let hookState: {
  items: SisterLeadShape[];
  total: number;
  nextCursor: string | null;
  locked: boolean;
  account: unknown;
  isLoading: boolean;
  error: string | null;
};

vi.mock("@/lib/lead-detail/use-sister-leads", () => ({
  useSisterLeads: () => ({ ...hookState, mutate: vi.fn() }),
}));

import { AccountBlock, type AccountBlockCopy } from "@/components/app/lead-detail-v2/AccountBlock";

const COPY: AccountBlockCopy = {
  tierLabel: "Tier",
  locationsLabel: "{n} locations",
  loading: "Loading sister branches…",
  singleLocation: {
    title: "Single-location business",
    body: "Multi-location intelligence appears when sister branches are detected.",
  },
  locked: {
    title: "Account view locked",
    description: "Upgrade to navigate sister branches.",
    cta: "Upgrade",
    requiredPlan: "Available on Pro Team and above.",
  },
  noSisters: "No sister branches yet.",
  columns: {
    name: "Branch",
    stage: "Stage",
    icp: "ICP",
    lastTouch: "Last touch",
    disposition: "Disposition",
    actions: "Actions",
  },
  row: {
    here: "Here",
    unknownIcp: "—",
    noTouch: "no touch",
    stages: {
      COLD: "Cold",
      CONTACTED: "Contacted",
      REPLIED: "Replied",
      MEETING_BOOKED: "Meeting",
      PROPOSAL: "Proposal",
      NEGOTIATING: "Negotiating",
      WON: "Won",
      LOST: "Lost",
    },
    dispositions: {
      VOICEMAIL: "Voicemail",
    },
    relative: {
      now: "now",
      minutes: "{n}m ago",
      hours: "{n}h ago",
      days: "{n}d ago",
    },
  },
  callout: {
    heading: "Cross-branch insight",
    body: "Insight that won on {sister}: \u201C{quote}\u201D — same trigger fires here.",
    applyLabel: "Apply",
    appliedLabel: "Applied",
    upgradeLabel: "Upgrade to Agency",
    upgradeTooltip: "Cross-branch insight propagation requires the Agency plan.",
  },
};

const sampleSummary = {
  id: "acct_1",
  name: "Casa Polanco",
  tier: "TIER_2" as const,
  locationsCount: 4,
};

function makeSister(id: string, overrides: Partial<SisterLeadShape> = {}): SisterLeadShape {
  return {
    id,
    businessName: id.toUpperCase(),
    borough: null,
    subNicheSlug: null,
    subNicheLabel: null,
    stage: "COLD",
    pipelineStatus: "OK",
    icpScorePct: 70,
    salesConfidence: 60,
    lastActivityAt: null,
    lastDisposition: null,
    isWon: false,
    ...overrides,
  };
}

function resetHook(partial: Partial<typeof hookState> = {}): void {
  hookState = {
    items: [],
    total: 0,
    nextCursor: null,
    locked: false,
    account: null,
    isLoading: false,
    error: null,
    ...partial,
  };
}

afterEach(() => {
  cleanup();
  pushSpy.mockReset();
});

describe("AccountBlock — render states", () => {
  it("renders the single-location stub when accountId is null", () => {
    resetHook();
    render(
      <AccountBlock
        leadId="lead_1"
        workspaceId="ws_a"
        expanded
        accountSummary={null}
        accountId={null}
        plan="PRO_TEAM"
        copy={COPY}
      />,
    );
    expect(screen.getByTestId("account-block-single")).toBeInTheDocument();
    expect(
      screen.getByText(COPY.singleLocation.title),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("sister-leads-table")).toBeNull();
  });

  it("renders the locked teaser for FREE plan", () => {
    resetHook();
    render(
      <AccountBlock
        leadId="lead_1"
        workspaceId="ws_a"
        expanded
        accountSummary={sampleSummary}
        accountId="acct_1"
        plan="FREE"
        copy={COPY}
      />,
    );
    expect(screen.getByTestId("plan-locked-block")).toBeInTheDocument();
    expect(screen.queryByTestId("sister-leads-table")).toBeNull();
    expect(
      screen.getByTestId("account-block-locations-count"),
    ).toBeInTheDocument();
  });

  it("renders the locked teaser for PRO plan", () => {
    resetHook();
    render(
      <AccountBlock
        leadId="lead_1"
        workspaceId="ws_a"
        expanded
        accountSummary={sampleSummary}
        accountId="acct_1"
        plan="PRO"
        copy={COPY}
      />,
    );
    expect(screen.getByTestId("plan-locked-block")).toBeInTheDocument();
  });

  it("renders the populated table for PRO_TEAM plan", () => {
    resetHook({
      items: [
        makeSister("sister_1"),
        makeSister("sister_2", { stage: "REPLIED" }),
        makeSister("sister_3", { stage: "WON", isWon: true }),
      ],
      total: 3,
    });
    render(
      <AccountBlock
        leadId="lead_1"
        workspaceId="ws_a"
        expanded
        accountSummary={sampleSummary}
        accountId="acct_1"
        plan="PRO_TEAM"
        copy={COPY}
      />,
    );
    const tables = screen.getAllByTestId("sister-leads-table");
    expect(tables.length).toBeGreaterThanOrEqual(1);
    const rows = screen.getAllByTestId("sister-lead-row");
    expect(rows.length).toBe(3);
    const cards = screen.getAllByTestId("sister-lead-card");
    expect(cards.length).toBe(3);
  });

  it("renders the loading skeleton when loading and no rows yet", () => {
    resetHook({ isLoading: true });
    render(
      <AccountBlock
        leadId="lead_1"
        workspaceId="ws_a"
        expanded
        accountSummary={sampleSummary}
        accountId="acct_1"
        plan="PRO_TEAM"
        copy={COPY}
      />,
    );
    expect(screen.getByTestId("account-block-loading")).toBeInTheDocument();
  });

  it("renders the no-sisters empty state for PRO_TEAM with zero results", () => {
    resetHook({ items: [], total: 0, isLoading: false });
    render(
      <AccountBlock
        leadId="lead_1"
        workspaceId="ws_a"
        expanded
        accountSummary={sampleSummary}
        accountId="acct_1"
        plan="PRO_TEAM"
        copy={COPY}
      />,
    );
    expect(screen.getByTestId("account-block-no-sisters")).toBeInTheDocument();
  });

  it("shows the cross-branch insight callout when a WON sister exists", () => {
    resetHook({
      items: [
        makeSister("sister_1"),
        makeSister("sister_won", {
          businessName: "COYOACAN",
          stage: "WON",
          isWon: true,
        }),
      ],
      total: 2,
    });
    render(
      <AccountBlock
        leadId="lead_1"
        workspaceId="ws_a"
        expanded
        accountSummary={sampleSummary}
        accountId="acct_1"
        plan="AGENCY"
        copy={COPY}
      />,
    );
    expect(
      screen.getByTestId("cross-branch-insight-callout"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("cross-branch-insight-apply"),
    ).toBeInTheDocument();
  });

  it("PRO_TEAM sees the callout but with the upgrade variant", () => {
    resetHook({
      items: [
        makeSister("sister_won", {
          businessName: "COYOACAN",
          stage: "WON",
          isWon: true,
        }),
      ],
      total: 1,
    });
    render(
      <AccountBlock
        leadId="lead_1"
        workspaceId="ws_a"
        expanded
        accountSummary={sampleSummary}
        accountId="acct_1"
        plan="PRO_TEAM"
        copy={COPY}
      />,
    );
    expect(
      screen.getByTestId("cross-branch-insight-callout"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("cross-branch-insight-upgrade"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("cross-branch-insight-apply"),
    ).toBeNull();
  });
});

describe("AccountBlock — sister-lead navigation", () => {
  it("clicking a sister-lead row navigates with ?from=<currentLeadId>", () => {
    resetHook({
      items: [
        makeSister("sister_target", { businessName: "POLANCO" }),
      ],
      total: 1,
    });
    const onTelemetry = vi.fn();
    render(
      <AccountBlock
        leadId="lead_current"
        workspaceId="ws_a"
        expanded
        accountSummary={sampleSummary}
        accountId="acct_1"
        plan="PRO_TEAM"
        onTelemetry={onTelemetry}
        copy={COPY}
      />,
    );
    const rows = screen.getAllByTestId("sister-lead-row");
    fireEvent.click(rows[0]);
    expect(pushSpy).toHaveBeenCalledWith(
      "/app/leads/sister_target?v=2&from=lead_current",
    );
    expect(onTelemetry).toHaveBeenCalledWith(
      "lead_detail.sister_lead.navigated",
      { fromLeadId: "lead_current", toLeadId: "sister_target" },
    );
  });

  it("clicking the current lead's row does not navigate", () => {
    resetHook({
      items: [makeSister("lead_self", { businessName: "ROMA" })],
      total: 1,
    });
    render(
      <AccountBlock
        leadId="lead_self"
        workspaceId="ws_a"
        expanded
        accountSummary={sampleSummary}
        accountId="acct_1"
        plan="PRO_TEAM"
        copy={COPY}
      />,
    );
    const rows = screen.getAllByTestId("sister-lead-row");
    fireEvent.click(rows[0]);
    expect(pushSpy).not.toHaveBeenCalled();
  });
});

describe("AccountBlock — telemetry", () => {
  it("fires lead_detail.account.expanded once when the block expands", () => {
    resetHook({ items: [makeSister("a")], total: 1 });
    const onTelemetry = vi.fn();
    const { rerender } = render(
      <AccountBlock
        leadId="lead_1"
        workspaceId="ws_a"
        expanded={false}
        accountSummary={sampleSummary}
        accountId="acct_1"
        plan="PRO_TEAM"
        onTelemetry={onTelemetry}
        copy={COPY}
      />,
    );
    expect(onTelemetry).not.toHaveBeenCalledWith(
      "lead_detail.account.expanded",
      expect.anything(),
    );

    rerender(
      <AccountBlock
        leadId="lead_1"
        workspaceId="ws_a"
        expanded
        accountSummary={sampleSummary}
        accountId="acct_1"
        plan="PRO_TEAM"
        onTelemetry={onTelemetry}
        copy={COPY}
      />,
    );

    const expandedCalls = onTelemetry.mock.calls.filter(
      (c) => c[0] === "lead_detail.account.expanded",
    );
    expect(expandedCalls).toHaveLength(1);
    expect(expandedCalls[0][1]).toMatchObject({
      leadId: "lead_1",
      accountId: "acct_1",
      locationsCount: 4,
    });
  });
});
