// @vitest-environment node
import { describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";

describe("control plane schema", () => {
  it("exposes the control delegates", () => {
    expect(Prisma.ModelName.AdminAuditEvent).toBe("AdminAuditEvent");
    expect(Prisma.ModelName.WorkspaceCalibrationVersion).toBe("WorkspaceCalibrationVersion");
    expect(Prisma.ModelName.EvalCase).toBe("EvalCase");
    expect(Prisma.ModelName.HumanReview).toBe("HumanReview");
  });
});
