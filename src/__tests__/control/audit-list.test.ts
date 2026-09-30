// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { auditFind, userFind, leadFind, versionFind } = vi.hoisted(() => ({
  auditFind: vi.fn(),
  userFind: vi.fn(),
  leadFind: vi.fn(),
  versionFind: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminAuditEvent: { findMany: auditFind },
    user: { findMany: userFind },
    lead: { findMany: leadFind },
    workspaceCalibrationVersion: { findMany: versionFind },
  },
}));

import { listAdminAudit } from "@/lib/control/audit";

describe("listAdminAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userFind.mockResolvedValue([{ id: "user_1", fullName: "Ayşe", email: "ayse@revint.test" }]);
    leadFind.mockResolvedValue([{ id: "lead_1", businessName: "The Ivy" }]);
    versionFind.mockResolvedValue([]);
  });

  it("scopes by workspace, clamps take, and reports older rows", async () => {
    auditFind.mockImplementation(async (args: { take: number; where: { workspaceId: string } }) => {
      expect(args.where.workspaceId).toBe("ws_1");
      expect(args.take).toBe(101);
      return Array.from({ length: 101 }, (_, index) => ({
        id: `e${index}`,
        actorUserId: "user_1",
        actorRole: "ADMIN",
        workspaceId: "ws_1",
        action: "trace.rerun",
        targetType: "Lead",
        targetId: "lead_1",
        reason: "yeniden",
        beforeJson: null,
        afterJson: { workerKind: "ICP_SCORER" },
        outcome: "SUCCEEDED",
        createdAt: new Date("2026-09-26T12:00:00Z"),
      }));
    });

    const result = await listAdminAudit({ workspaceId: "ws_1", take: 500 });
    expect(result.hasOlder).toBe(true);
    expect(result.rows).toHaveLength(100);
    expect(result.rows[0]).toMatchObject({ actorLabel: "Ayşe", targetLabel: "The Ivy" });
    expect(result.rows[0]?.actorLabel).not.toBe("user_1");
  });
});
