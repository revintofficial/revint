import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { ControlRole } from "@/lib/control/roles";

type WriteAdminAuditInput = {
  actorUserId: string;
  actorRole: ControlRole;
  workspaceId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
  beforeJson: unknown;
  afterJson: unknown;
  approvalUserId?: string | null;
  outcome: "SUCCEEDED" | "FAILED";
};

function toJsonInput(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

/** Append one immutable control-plane audit event. */
export async function writeAdminAudit(input: WriteAdminAuditInput): Promise<{ id: string }> {
  const event = await prisma.adminAuditEvent.create({
    data: {
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      workspaceId: input.workspaceId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      beforeJson: toJsonInput(input.beforeJson),
      afterJson: toJsonInput(input.afterJson),
      approvalUserId: input.approvalUserId,
      outcome: input.outcome,
    },
  });

  return { id: event.id };
}
