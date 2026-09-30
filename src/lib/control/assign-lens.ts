import type { PlatformRole, ReviewLens } from "@/generated/prisma/client";
import { ForbiddenError, NotFoundError } from "@/lib/auth";
import { writeAdminAudit } from "@/lib/control/audit";
import { LENSES, LENS_LABELS } from "@/lib/control/lenses";
import { roleAtLeast, type ControlRole } from "@/lib/control/roles";
import { prisma } from "@/lib/prisma";

export type LensHolder = {
  userId: string;
  label: string;
  role: PlatformRole;
  lens: ReviewLens | null;
};

function allowlistEmails(): string[] {
  return (process.env.ADMIN_DASHBOARD_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function isBootstrapAdmin(user: { isPlatformAdmin: boolean; email: string | null }): boolean {
  return user.isPlatformAdmin || allowlistEmails().includes((user.email ?? "").toLowerCase());
}

/** People who can hold a lens: bootstrap admins and anyone who already has an assignment. */
export async function listLensHolders(): Promise<LensHolder[]> {
  const emails = allowlistEmails();
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { isPlatformAdmin: true },
        { platformRole: { isNot: null } },
        ...emails.map((email) => ({ email: { equals: email, mode: "insensitive" as const } })),
      ],
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      isPlatformAdmin: true,
      platformRole: { select: { role: true, lens: true } },
    },
    orderBy: { email: "asc" },
  });

  return users.flatMap((user) => {
    const role: PlatformRole | null = isBootstrapAdmin(user) ? "ADMIN" : user.platformRole?.role ?? null;
    if (!role) return [];
    const name = user.fullName?.trim();
    return [{
      userId: user.id,
      label: name || user.email,
      role,
      lens: user.platformRole?.lens ?? null,
    }];
  });
}

/** One lens per user. A new row is only created for a bootstrap admin, stored as ADMIN. */
export async function assignControlLens(input: {
  actorUserId: string;
  actorRole: ControlRole;
  workspaceId: string;
  targetUserId: string;
  lens: ReviewLens | null;
}): Promise<{ id: string }> {
  if (!roleAtLeast(input.actorRole, "ADMIN")) {
    throw new ForbiddenError("Mercek atamak Yönetici işidir.");
  }
  if (input.lens !== null && !LENSES.includes(input.lens)) {
    throw new ForbiddenError("Mercek geçersiz.");
  }

  const user = await prisma.user.findUnique({
    where: { id: input.targetUserId },
    select: {
      id: true,
      email: true,
      isPlatformAdmin: true,
      platformRole: { select: { role: true, lens: true } },
    },
  });
  if (!user) throw new NotFoundError("Kişi bulunamadı.");
  if (!user.platformRole && !isBootstrapAdmin(user)) {
    throw new ForbiddenError("Bu kişiye mercek atanamaz.");
  }

  const before = { lens: user.platformRole?.lens ?? null, role: user.platformRole?.role ?? null };

  return prisma.$transaction(async (tx) => {
    const saved = await tx.platformRoleAssignment.upsert({
      where: { userId: user.id },
      create: { userId: user.id, role: "ADMIN", lens: input.lens },
      update: { lens: input.lens },
      select: { id: true, lens: true, role: true },
    });
    await writeAdminAudit({
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      workspaceId: input.workspaceId,
      action: "lens.assign",
      targetType: "User",
      targetId: user.id,
      reason: input.lens ? `${LENS_LABELS[input.lens]} merceği atandı.` : "Mercek kaldırıldı.",
      beforeJson: before,
      afterJson: { lens: saved.lens, role: saved.role },
      outcome: "SUCCEEDED",
    }, tx);
    return { id: saved.id };
  });
}
