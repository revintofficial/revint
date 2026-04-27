import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { internalError } from "@/lib/api-errors";
import { getNicheBySlug, NICHES } from "@/lib/niches";

/**
 * Returns the niche / sub-niche universe present in the current
 * workspace's leads, with counts. The leads filter bar uses this to
 * populate its niche + sub-niche dropdowns (instead of dumping every
 * possible vertical from the catalog).
 *
 * Multi-tenant: every query is scoped by `workspaceId` via
 * `requireUser()`.
 */
export async function GET() {
  try {
    const { workspaceId } = await requireUser();

    const [parents, children] = await Promise.all([
      prisma.lead.groupBy({
        by: ["nicheSlug"],
        where: { workspaceId, nicheSlug: { not: null } },
        _count: { _all: true },
      }),
      prisma.lead.groupBy({
        by: ["subNicheSlug"],
        where: { workspaceId, subNicheSlug: { not: null } },
        _count: { _all: true },
      }),
    ]);

    type NicheOption = {
      slug: string;
      label: string;
      parentSlug?: string;
      count: number;
    };

    const niches: NicheOption[] = [];
    for (const row of parents) {
      const slug = row.nicheSlug;
      if (!slug) continue;
      const pack = getNicheBySlug(slug);
      niches.push({
        slug,
        label: pack?.label ?? slug,
        count: row._count._all,
      });
    }

    // For sub-niches we always resolve the parent slug from the catalog
    // so the UI can scope sub-niche options to the selected parent.
    const subNiches: NicheOption[] = [];
    for (const row of children) {
      const slug = row.subNicheSlug;
      if (!slug) continue;
      const pack = getNicheBySlug(slug);
      subNiches.push({
        slug,
        label: pack?.label ?? slug,
        parentSlug: pack?.parentSlug,
        count: row._count._all,
      });
    }

    // Make sure the parent slug for any present sub-niche is also in
    // the parents list (covers the case where every lead in that
    // vertical has been classified to a child and `nicheSlug` is null).
    for (const sn of subNiches) {
      if (sn.parentSlug && !niches.some((n) => n.slug === sn.parentSlug)) {
        const parent = NICHES.find((n) => n.slug === sn.parentSlug);
        if (parent) {
          niches.push({
            slug: parent.slug,
            label: parent.label,
            count: 0,
          });
        }
      }
    }

    niches.sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || a.label.localeCompare(b.label));
    subNiches.sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || a.label.localeCompare(b.label));

    return NextResponse.json({ niches, subNiches });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.leads.sub_niches_error", error);
  }
}
