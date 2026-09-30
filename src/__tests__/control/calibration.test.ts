// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { versionFind, upsert } = vi.hoisted(() => ({
  versionFind: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workspaceCalibrationVersion: { findFirst: versionFind },
    idealCustomerProfile: { upsert },
  },
}));
vi.mock("@/lib/control/audit", () => ({ writeAdminAudit: vi.fn() }));

import { activateCalibration } from "@/lib/control/calibration";
import { diffValues } from "@/lib/control/diff";

describe("activateCalibration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    versionFind.mockResolvedValue({
      id: "cal_1",
      workspaceId: "ws_1",
      status: "DRAFT",
      createdByUserId: "same-user",
      icpJson: {},
      packagesJson: [],
      claimsJson: { claims: [] },
      playbookJson: {},
      pipelineJson: { preset: "BALANCED", steps: [], enabled: true },
      version: 2,
    });
  });

  it("refuses self-activation", async () => {
    await expect(activateCalibration({
      workspaceId: "ws_1",
      versionId: "cal_1",
      actorUserId: "same-user",
      actorRole: "ADMIN",
      reason: "ship",
    })).rejects.toThrow("activator must differ from author");
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe("diffValues", () => {
  it("writes a field change as old to new", () => {
    expect(diffValues({ minRating: 70 }, { minRating: 75 })).toEqual(["puan alt sınırı 70 → 75"]);
  });
});
