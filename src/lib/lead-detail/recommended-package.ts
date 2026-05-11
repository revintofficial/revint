/**
 * Recommended-package resolution — shared between legacy
 * `GET /api/leads/[id]` and Phase 2.5 `GET /api/leads/[id]/decision-surface`.
 *
 * The analyst worker (SALES_OPPORTUNITY_SCORER) writes a free-text
 * `SalesOpportunity.recommendedPackageId` that's NOT a foreign key —
 * see the schema comment at line ~1063. This helper resolves the id
 * against the workspace's `ServicePackage` rows; a deleted/renamed
 * package quietly returns `null` so the UI falls back to the legacy
 * `suggestedOffer` enum.
 *
 * MULTI-TENANT SCOPE: every read is scoped by `workspaceId`. The id
 * resolver is the only legitimate cross-row lookup the lead-detail
 * surface performs, and the `where: { id, workspaceId }` predicate
 * makes it safe.
 *
 * Returns `null` (not throw) when:
 *   - no `recommendedPackageId` is set on the SalesOpportunity
 *   - the id resolves to a package outside the caller's workspace
 *     (this should be impossible because the writer scopes by
 *     workspaceId, but the runtime check is defense-in-depth)
 *   - the package row no longer exists
 */
import { prisma } from "@/lib/prisma";

export interface RecommendedPackage {
  id: string;
  name: string;
  priceLabel: string;
  features: string[];
  /**
   * Optional — written by SALES_OPPORTUNITY_SCORER alongside the id
   * so the UI can show "Recommended because: …" without re-prompting.
   */
  reason: string | null;
}

export async function resolveRecommendedPackage(args: {
  workspaceId: string;
  recommendedPackageId: string | null | undefined;
  recommendedPackageReason?: string | null;
}): Promise<RecommendedPackage | null> {
  if (!args.recommendedPackageId) return null;
  const pkg = await prisma.servicePackage.findFirst({
    where: { id: args.recommendedPackageId, workspaceId: args.workspaceId },
    select: { id: true, name: true, priceLabel: true, features: true },
  });
  if (!pkg) return null;
  return {
    id: pkg.id,
    name: pkg.name,
    priceLabel: pkg.priceLabel,
    features: pkg.features,
    reason: args.recommendedPackageReason ?? null,
  };
}
