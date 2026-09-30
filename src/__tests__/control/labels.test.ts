// @vitest-environment node
import { describe, expect, it } from "vitest";
import { AgentWorkerKind } from "@/generated/prisma/client";
import { workerLabel } from "@/lib/control/labels";

describe("worker labels", () => {
  it("has a Turkish label for every worker kind", () => {
    for (const kind of Object.values(AgentWorkerKind)) {
      const label = workerLabel(kind);
      expect(label, kind).not.toBe(kind);
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toBe("İş");
    }
  });
});
