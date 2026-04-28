/**
 * Workspace pre-flight helpers.
 *
 * Shared invariants the pipeline relies on before kicking off Gemini
 * work — kept in one module so events.ts, the API "process pending"
 * route, and the onboarding flow all read the same source of truth.
 */
import { prisma } from "@/lib/prisma";

/**
 * Returns true when the workspace has at least one ServicePackage
 * configured. This is a hard precondition for the new `lead_created`
 * chain: the dossier picks the recommended package from the
 * workspace's price card, and we no longer fall back to the legacy
 * STARTER/GROWTH/SALES enum (P0.4). Callers gate on this so a fresh
 * workspace doesn't burn Gemini credits producing dossiers that
 * cannot recommend a tier.
 *
 * Multi-tenant scope: every read MUST be filtered by `workspaceId`.
 * Cross-tenant leak via this helper would have us pretend a tenant
 * has packages because a sibling tenant does — highest-severity bug
 * class.
 */
export async function workspaceHasServicePackages(
  workspaceId: string,
): Promise<boolean> {
  const count = await prisma.servicePackage.count({
    where: { workspaceId },
  });
  return count > 0;
}
