/**
 * Phase 7 — `/app/leads/[id]/reasoning/[actionId]` server component test.
 *
 * NON-NEGOTIABLE: workspace A may NOT view workspace B's reasoning
 * graph (PLAN §6 risk #10 — graph nodes can quote PII verbatim).
 * The page returns `notFound()` (404) on every cross-tenant attempt
 * so we never disclose the action's existence.
 *
 * Plan gating is enforced server-side via `planMeetsMinimum`:
 * FREE + PRO_TEAM_VIEW (anything below PRO) renders the locked
 * teaser. PRO+ reaches the full graph branch.
 */
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";

const mockRequireUser = vi.fn();
const mockNotFound = vi.fn(() => {
  throw new Error("__NEXT_NOT_FOUND__");
});

vi.mock("@/lib/auth", () => {
  class UnauthorizedError extends Error {}
  return {
    requireUser: (...args: unknown[]) => mockRequireUser(...args),
    UnauthorizedError,
  };
});

vi.mock("next/navigation", () => ({
  notFound: () => mockNotFound(),
}));

vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/components/app/lead-detail-v2/ReasoningGraphFullView", () => ({
  ReasoningGraphFullView: () => ({
    type: "div",
    props: { "data-testid": "reasoning-full-view-stub" },
  }),
}));

vi.mock("@/components/app/lead-detail-v2/PlanLockedBlock", () => ({
  PlanLockedBlock: () => ({
    type: "div",
    props: { "data-testid": "plan-locked-stub" },
  }),
}));

vi.mock("@/i18n", () => ({
  loadLeadDetailDictionary: async () => ({
    common: {
      leadDetailV2: {
        reasoningRoute: {
          crumb: "Reasoning",
          heading: "Reasoning trace",
          subheading: "Evidence + decisions.",
          backToLeadAriaTemplate: "Back to {business}",
          empty: "No graph",
          locked: {
            title: "Reasoning trace locked",
            description: "Upgrade.",
            cta: "Upgrade",
            requiredPlan: "Pro+",
          },
        },
      },
    },
  }),
}));

vi.mock("@/lib/i18n/config", () => ({ DEFAULT_LOCALE: "en" }));

interface LeadRow {
  id: string;
  workspaceId: string;
  businessName: string;
}
interface ActionRow {
  id: string;
  leadId: string;
  workspaceId: string;
  reasoningGraph: unknown;
  arbitrationRecords: unknown;
  createdAt: Date;
  version: number;
}

let leads: LeadRow[] = [];
let actions: ActionRow[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: {
      findFirst: vi.fn(
        async (args: { where: { id?: string; workspaceId?: string } }) => {
          const { id, workspaceId } = args.where;
          return (
            leads.find((l) => l.id === id && l.workspaceId === workspaceId) ??
            null
          );
        },
      ),
    },
    leadNextAction: {
      findFirst: vi.fn(
        async (args: {
          where: { id: string; leadId: string; workspaceId: string };
        }) => {
          const { id, leadId, workspaceId } = args.where;
          return (
            actions.find(
              (a) =>
                a.id === id &&
                a.leadId === leadId &&
                a.workspaceId === workspaceId,
            ) ?? null
          );
        },
      ),
    },
  },
}));

import LeadReasoningPage from "@/app/app/leads/[id]/reasoning/[actionId]/page";

const wsA = "ws_a";
const wsB = "ws_b";

function setSession(
  workspaceId: string,
  plan: "FREE" | "PRO" | "PRO_TEAM" | "AGENCY" = "PRO",
) {
  mockRequireUser.mockResolvedValue({
    user: { id: "u1", email: "u@u.com", fullName: null, avatarUrl: null },
    workspaceId,
    workspace: { id: workspaceId, name: "Test", slug: "test", plan },
    role: "OWNER",
  });
}

function makeAction(overrides: Partial<ActionRow> = {}): ActionRow {
  return {
    id: overrides.id ?? "act_1",
    leadId: overrides.leadId ?? "lead_a",
    workspaceId: overrides.workspaceId ?? wsA,
    reasoningGraph: overrides.reasoningGraph ?? {
      nodes: [
        {
          id: "ev.1",
          kind: "EVIDENCE",
          weight: 0.5,
          confidence: 0.9,
          content: "Sample evidence",
        },
      ],
      edges: [],
      contradictions: [],
      modelVersion: "v1",
      generatedAt: "2026-04-01T00:00:00Z",
    },
    arbitrationRecords: overrides.arbitrationRecords ?? [],
    createdAt: overrides.createdAt ?? new Date(),
    version: overrides.version ?? 1,
  };
}

beforeEach(() => {
  leads = [];
  actions = [];
  mockRequireUser.mockReset();
  mockNotFound.mockClear();
});

describe("/app/leads/[id]/reasoning/[actionId] — multi-tenant guard", () => {
  it("renders when the workspace owns both the lead and the action", async () => {
    leads.push({ id: "lead_a", workspaceId: wsA, businessName: "Casa Polanco" });
    actions.push(makeAction({ id: "act_1", leadId: "lead_a", workspaceId: wsA }));
    setSession(wsA);
    await LeadReasoningPage({
      params: Promise.resolve({ id: "lead_a", actionId: "act_1" }),
    });
    expect(mockNotFound).not.toHaveBeenCalled();
  });

  it("notFound when the lead lives in a different workspace", async () => {
    leads.push({ id: "lead_b", workspaceId: wsB, businessName: "Foreign" });
    actions.push(makeAction({ id: "act_1", leadId: "lead_b", workspaceId: wsB }));
    setSession(wsA);
    await expect(
      LeadReasoningPage({
        params: Promise.resolve({ id: "lead_b", actionId: "act_1" }),
      }),
    ).rejects.toThrow("__NEXT_NOT_FOUND__");
    expect(mockNotFound).toHaveBeenCalledTimes(1);
  });

  it("notFound when the action does not belong to the lead", async () => {
    leads.push({ id: "lead_a", workspaceId: wsA, businessName: "Casa Polanco" });
    actions.push(makeAction({ id: "act_2", leadId: "lead_other", workspaceId: wsA }));
    setSession(wsA);
    await expect(
      LeadReasoningPage({
        params: Promise.resolve({ id: "lead_a", actionId: "act_2" }),
      }),
    ).rejects.toThrow("__NEXT_NOT_FOUND__");
  });

  it("notFound when the actionId is unknown", async () => {
    leads.push({ id: "lead_a", workspaceId: wsA, businessName: "Casa Polanco" });
    setSession(wsA);
    await expect(
      LeadReasoningPage({
        params: Promise.resolve({ id: "lead_a", actionId: "missing" }),
      }),
    ).rejects.toThrow("__NEXT_NOT_FOUND__");
  });
});

describe("/app/leads/[id]/reasoning/[actionId] — Prisma scope", () => {
  it("scopes the lead lookup by workspaceId", async () => {
    leads.push({ id: "lead_a", workspaceId: wsA, businessName: "Casa Polanco" });
    actions.push(makeAction({ id: "act_1", leadId: "lead_a", workspaceId: wsA }));
    setSession(wsA);
    await LeadReasoningPage({
      params: Promise.resolve({ id: "lead_a", actionId: "act_1" }),
    });
    const prismaModule = await import("@/lib/prisma");
    const leadFindSpy = prismaModule.prisma.lead.findFirst as Mock;
    const leadCall = leadFindSpy.mock.calls.at(-1)?.[0] as
      | { where: { id: string; workspaceId: string } }
      | undefined;
    expect(leadCall?.where.workspaceId).toBe(wsA);
    expect(leadCall?.where.id).toBe("lead_a");
  });

  it("scopes the action lookup by id + leadId + workspaceId (defense in depth)", async () => {
    leads.push({ id: "lead_a", workspaceId: wsA, businessName: "Casa Polanco" });
    actions.push(makeAction({ id: "act_1", leadId: "lead_a", workspaceId: wsA }));
    setSession(wsA);
    await LeadReasoningPage({
      params: Promise.resolve({ id: "lead_a", actionId: "act_1" }),
    });
    const prismaModule = await import("@/lib/prisma");
    const actionFindSpy = prismaModule.prisma.leadNextAction.findFirst as Mock;
    const actionCall = actionFindSpy.mock.calls.at(-1)?.[0] as
      | {
          where: { id: string; leadId: string; workspaceId: string };
        }
      | undefined;
    expect(actionCall?.where.id).toBe("act_1");
    expect(actionCall?.where.leadId).toBe("lead_a");
    expect(actionCall?.where.workspaceId).toBe(wsA);
  });
});
