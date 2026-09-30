import { listApprovedClaimsFromJson, parseClaims } from "@/lib/control/score";
import { prisma } from "@/lib/prisma";

export async function listApprovedClaims(workspaceId: string, now = new Date()) {
  const active = await prisma.workspaceCalibrationVersion.findFirst({
    where: { workspaceId, status: "ACTIVE" },
    orderBy: { version: "desc" },
    select: { claimsJson: true },
  });
  if (!active) return [];
  return listApprovedClaimsFromJson(active.claimsJson, now);
}

export { parseClaims };
