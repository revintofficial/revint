/**
 * Phase 6 — `/app/leads/[id]/workers` server-component test.
 *
 * NON-NEGOTIABLE: workspace A may NOT view workspace B's lead at
 * `/app/leads/<lead_b>/workers`. The page server component returns
 * `notFound()` (404) when the caller doesn't own the lead — same
 * pattern as the decision-surface API route, so we never disclose
 * lead existence cross-tenant.
 *
 * Plan gating is enforced inside `<AiWorkersPanel>` (which calls
 * `/api/leads/[id]/workers` — already covered by the registry's
 * `planMeetsMinimum` check). This test asserts the route's own
 * tenant guard, not the per-worker plan badge — that lives one
 * layer down.
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

// The Next.js `<Link>` import in the page pulls in client-side code
// that breaks in node. Stub it to a passthrough.
vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

// AiWorkersPanel is a heavy client component — stub it. Its plan
// gating tests live alongside the component itself.
vi.mock("@/components/app/ai-workers-panel", () => ({
  AiWorkersPanel: ({ leadId }: { leadId: string }) => ({
    type: "div",
    props: { "data-testid": "ai-workers-panel-stub", "data-lead": leadId },
  }),
}));

// The dictionary loader is async; stub with a minimal shape that
// exercises the keys the page reads.
vi.mock("@/i18n", () => ({
  loadLeadDetailDictionary: async () => ({
    common: {
      leadDetailV2: {
        workersRoute: {
          crumb: "Power tools",
          heading: "Power tools",
          subheading: "Run AI workers and download deliverables.",
          backToLeadAriaTemplate: "Back to {business}",
        },
      },
    },
  }),
}));

vi.mock("@/lib/i18n/config", () => ({
  DEFAULT_LOCALE: "en",
}));

interface LeadRow {
  id: string;
  workspaceId: string;
  businessName: string;
}

let leads: LeadRow[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: {
      findFirst: vi.fn(
        async (args: {
          where: { id?: string; workspaceId?: string };
          select?: Record<string, boolean>;
        }) => {
          const { id, workspaceId } = args.where;
          const row = leads.find(
            (l) => l.id === id && l.workspaceId === workspaceId,
          );
          return row ?? null;
        },
      ),
    },
  },
}));

import LeadWorkersPage from "@/app/app/leads/[id]/workers/page";

const wsA = "ws_a";
const wsB = "ws_b";

function setSession(workspaceId: string) {
  mockRequireUser.mockResolvedValue({
    user: { id: "u1", email: "u@u.com", fullName: null, avatarUrl: null },
    workspaceId,
    workspace: { id: workspaceId, name: "Test", slug: "test", plan: "PRO" },
    role: "OWNER",
  });
}

beforeEach(() => {
  leads = [];
  mockRequireUser.mockReset();
  mockNotFound.mockClear();
});

describe("/app/leads/[id]/workers — multi-tenant guard", () => {
  it("renders the panel when the workspace owns the lead", async () => {
    leads.push({ id: "lead_a", workspaceId: wsA, businessName: "Casa Polanco" });
    setSession(wsA);
    await LeadWorkersPage({ params: Promise.resolve({ id: "lead_a" }) });
    expect(mockNotFound).not.toHaveBeenCalled();
  });

  it("calls notFound() when the lead lives in a different workspace", async () => {
    leads.push({ id: "lead_b", workspaceId: wsB, businessName: "Foreign Bistro" });
    setSession(wsA);
    await expect(
      LeadWorkersPage({ params: Promise.resolve({ id: "lead_b" }) }),
    ).rejects.toThrow("__NEXT_NOT_FOUND__");
    expect(mockNotFound).toHaveBeenCalledTimes(1);
  });

  it("calls notFound() when the lead does not exist", async () => {
    setSession(wsA);
    await expect(
      LeadWorkersPage({ params: Promise.resolve({ id: "missing_lead" }) }),
    ).rejects.toThrow("__NEXT_NOT_FOUND__");
    expect(mockNotFound).toHaveBeenCalledTimes(1);
  });
});

describe("/app/leads/[id]/workers — Prisma scope", () => {
  it("scopes the lead lookup by workspaceId in the where clause", async () => {
    const prismaModule = await import("@/lib/prisma");
    const findFirstSpy = prismaModule.prisma.lead.findFirst as Mock;
    leads.push({ id: "lead_a", workspaceId: wsA, businessName: "Casa Polanco" });
    setSession(wsA);
    await LeadWorkersPage({ params: Promise.resolve({ id: "lead_a" }) });
    const call = findFirstSpy.mock.calls.at(-1)?.[0] as
      | { where: { id: string; workspaceId: string } }
      | undefined;
    expect(call?.where.workspaceId).toBe(wsA);
    expect(call?.where.id).toBe("lead_a");
  });
});
