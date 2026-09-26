import type { PlatformRole } from "@/generated/prisma/client";
import { ForbiddenError, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type ControlRole = PlatformRole;

const RANK: Record<ControlRole, number> = {
  VIEWER: 1,
  REVIEWER: 2,
  ADMIN: 3,
};

export function roleAtLeast(actual: ControlRole, min: ControlRole): boolean {
  return RANK[actual] >= RANK[min];
}

/** Bootstrap admins always outrank an assignment, including a lower one. */
export async function resolveControlRole(
  userId: string,
  email: string | null,
): Promise<ControlRole | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPlatformAdmin: true },
  });
  if (user?.isPlatformAdmin) return "ADMIN";

  const allowlist = (process.env.ADMIN_DASHBOARD_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (email && allowlist.includes(email.toLowerCase())) return "ADMIN";

  const assignment = await prisma.platformRoleAssignment.findUnique({
    where: { userId },
    select: { role: true },
  });
  return assignment?.role ?? null;
}

export async function requireControlRole(
  min: ControlRole,
): Promise<{ userId: string; email: string | null; role: ControlRole }> {
  const { user } = await requireUser();
  const role = await resolveControlRole(user.id, user.email);
  if (!role || !roleAtLeast(role, min)) {
    throw new ForbiddenError("Control access required");
  }
  return { userId: user.id, email: user.email, role };
}
