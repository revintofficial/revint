import { writeAdminAudit } from "@/lib/control/audit";
import { ForbiddenError, NotFoundError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Why an SDR did not use a brief. The first four share codes with the
 * lens ErrorClass set; ALREADY_CUSTOMER and OUT_OF_PROFILE exist only on
 * `source = "SDR"` rows (HumanReview.errorClass is a plain string) and
 * the lens form never offers them.
 */
export const SDR_REASONS = [
  "IDENTITY_MISMATCH", // yanlış işletme
  "STALE_SOURCE", // kaynak eski
  "UNSUPPORTED_CLAIM", // iddia dayanaksız
  "PACKAGE_MISMATCH", // paket uymuyor
  "ALREADY_CUSTOMER", // zaten müşteri
  "OUT_OF_PROFILE", // hedef profil değil
] as const;

export type SdrReason = (typeof SDR_REASONS)[number];

export const SDR_RUBRIC_VERSION = "sdr";
export const SDR_NOTE_MAX = 1000;

export function isSdrReason(value: unknown): value is SdrReason {
  return typeof value === "string" && (SDR_REASONS as readonly string[]).includes(value);
}

/**
 * Append one SDR verdict for a brief. Never updates an earlier row: a
 * second click writes a new row and the newest row wins in triage.
 * The row has lens = null, so the triple lens gate and the agreement
 * report never count it.
 *
 * Throws "reason required" (unused without a reason), "invalid reason",
 * "note too long", ForbiddenError (not a member of the workspace),
 * NotFoundError (brief not in this workspace / not for this lead).
 */
export async function recordSdrFeedback(input: {
  workspaceId: string;
  leadId: string;
  agentRunId: string;
  used: boolean;
  reason: SdrReason | null;
  note: string | null;
  userId: string;
}): Promise<{ id: string }> {
  if (!input.used && input.reason == null) throw new Error("reason required");
  if (!input.used && !isSdrReason(input.reason)) throw new Error("invalid reason");
  const reason = input.used ? null : input.reason;
  const trimmed = input.used ? "" : (input.note ?? "").trim();
  if (trimmed.length > SDR_NOTE_MAX) throw new Error("note too long");
  const note = trimmed || null;

  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId: input.workspaceId, userId: input.userId },
    select: { id: true },
  });
  if (!member) throw new ForbiddenError("Bu çalışma alanının üyesi değilsin.");

  const run = await prisma.agentRun.findFirst({
    where: { id: input.agentRunId, workspaceId: input.workspaceId, leadId: input.leadId, workerKind: "LEAD_INTELLIGENCE_BRIEF", status: { in: ["SUCCEEDED", "SUCCEEDED_NO_MEMORY"] } },
    select: { id: true },
  });
  if (!run) throw new NotFoundError("Brief bu lead için bulunamadı.");

  const verdict = input.used ? "PASS" : "FAIL";
  return prisma.$transaction(async tx => {
    const created = await tx.humanReview.create({
      data: {
        workspaceId: input.workspaceId,
        leadId: input.leadId,
        agentRunId: input.agentRunId,
        lens: null,
        source: "SDR",
        verdict,
        errorClass: reason,
        severity: null,
        note,
        rubricVersion: SDR_RUBRIC_VERSION,
        reviewSeconds: null,
        reviewerUserId: input.userId,
      },
      select: { id: true },
    });

    // AdminAuditEvent.actorRole is a required PlatformRole; a workspace SDR
    // has none, so the lowest control role is recorded.
    await writeAdminAudit({
      actorUserId: input.userId,
      actorRole: "VIEWER",
      workspaceId: input.workspaceId,
      action: "sdr.feedback",
      targetType: "Lead",
      targetId: input.leadId,
      reason: note ?? reason ?? verdict,
      beforeJson: null,
      afterJson: { reviewId: created.id, agentRunId: input.agentRunId, used: input.used, reason, verdict },
      outcome: "SUCCEEDED",
    }, tx);

    return { id: created.id };
  });
}
