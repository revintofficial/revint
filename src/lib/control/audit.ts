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
export async function writeAdminAudit(input: WriteAdminAuditInput, db: Pick<Prisma.TransactionClient, "adminAuditEvent"> = prisma): Promise<{ id: string }> {
  const event = await db.adminAuditEvent.create({
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

export type AuditListRow = {
  id: string;
  action: string;
  outcome: string;
  reason: string;
  createdAt: string;
  actorLabel: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  beforeJson: unknown;
  afterJson: unknown;
};

const AUDIT_CAP = 100;

export async function listAdminAudit(input: {
  workspaceId: string;
  take?: number;
  before?: Date;
  since?: Date;
  action?: string;
  actorUserId?: string;
  outcome?: string;
}): Promise<{ rows: AuditListRow[]; hasOlder: boolean }> {
  const limit = Math.min(Math.max(input.take ?? AUDIT_CAP, 1), AUDIT_CAP);
  const rows = await prisma.adminAuditEvent.findMany({
    where: {
      workspaceId: input.workspaceId,
      ...(input.action ? { action: input.action } : {}),
      ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
      ...(input.outcome ? { outcome: input.outcome } : {}),
      ...(input.before || input.since
        ? { createdAt: { ...(input.before ? { lt: input.before } : {}), ...(input.since ? { gte: input.since } : {}) } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
  });
  const hasOlder = rows.length > limit;
  const page = rows.slice(0, limit);
  const actorIds = [...new Set([...page.map((row) => row.actorUserId), ...page.filter((row) => row.targetType === "User").map((row) => row.targetId)])];
  const leadIds = page.filter((row) => row.targetType === "Lead").map((row) => row.targetId);
  const calibrationIds = page.filter((row) => row.targetType === "WorkspaceCalibrationVersion").map((row) => row.targetId);
  const [users, leads, versions] = await Promise.all([
    actorIds.length
      ? prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, fullName: true, email: true } })
      : [],
    leadIds.length
      ? prisma.lead.findMany({ where: { workspaceId: input.workspaceId, id: { in: leadIds } }, select: { id: true, businessName: true } })
      : [],
    calibrationIds.length
      ? prisma.workspaceCalibrationVersion.findMany({
          where: { workspaceId: input.workspaceId, id: { in: calibrationIds } },
          select: { id: true, version: true },
        })
      : [],
  ]);
  const actors = new Map(users.map((user) => [user.id, user.fullName || user.email || "Bilinmeyen kişi"]));
  const leadNames = new Map(leads.map((lead) => [lead.id, lead.businessName]));
  const versionLabels = new Map(versions.map((version) => [version.id, `v${version.version}`]));

  return {
    hasOlder,
    rows: page.map((row) => ({
      id: row.id,
      action: row.action,
      outcome: row.outcome,
      reason: row.reason,
      createdAt: row.createdAt.toISOString(),
      actorLabel: actors.get(row.actorUserId) ?? "Bilinmeyen kişi",
      targetType: row.targetType,
      targetId: row.targetId,
      targetLabel: row.targetType === "Lead"
        ? leadNames.get(row.targetId) ?? "lead"
        : row.targetType === "WorkspaceCalibrationVersion"
          ? versionLabels.get(row.targetId) ?? "sürüm"
          : row.targetType === "User"
            ? actors.get(row.targetId) ?? "kişi"
            : "kayıt",
      beforeJson: row.beforeJson,
      afterJson: row.afterJson,
    })),
  };
}
