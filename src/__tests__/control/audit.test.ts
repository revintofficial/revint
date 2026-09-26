import { beforeEach, describe, expect, it, vi } from "vitest";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { adminAuditEvent: { create } } }));

import { Prisma } from "@/generated/prisma/client";
import { writeAdminAudit } from "@/lib/control/audit";

describe("writeAdminAudit", () => {
  beforeEach(() => create.mockReset());

  it("inserts an append-only row and returns the id", async () => {
    create.mockResolvedValue({ id: "aud_1" });
    const row = await writeAdminAudit({
      actorUserId: "00000000-0000-0000-0000-000000000001",
      actorRole: "ADMIN",
      workspaceId: "ws_1",
      action: "calibration.activate",
      targetType: "WorkspaceCalibrationVersion",
      targetId: "cal_1",
      reason: "golden subset passed",
      beforeJson: { status: "APPROVED" },
      afterJson: { status: "ACTIVE" },
      outcome: "SUCCEEDED",
    });

    expect(row.id).toBe("aud_1");
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: "00000000-0000-0000-0000-000000000001",
        actorRole: "ADMIN",
        workspaceId: "ws_1",
        action: "calibration.activate",
        targetType: "WorkspaceCalibrationVersion",
        targetId: "cal_1",
        reason: "golden subset passed",
        beforeJson: { status: "APPROVED" },
        afterJson: { status: "ACTIVE" },
        outcome: "SUCCEEDED",
      }),
    });
  });

  it("stores null snapshots as Prisma JSON null values", async () => {
    create.mockResolvedValue({ id: "aud_2" });

    await writeAdminAudit({
      actorUserId: "00000000-0000-0000-0000-000000000001",
      actorRole: "REVIEWER",
      workspaceId: null,
      action: "eval.run",
      targetType: "EvalRun",
      targetId: "eval_1",
      reason: "scheduled evaluation",
      beforeJson: null,
      afterJson: null,
      outcome: "SUCCEEDED",
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: null,
        beforeJson: Prisma.JsonNull,
        afterJson: Prisma.JsonNull,
      }),
    });
  });
});
