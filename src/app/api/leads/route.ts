import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { sortByDistance, filterWithinMiles } from "@/lib/geo";
import { internalError } from "@/lib/api-errors";
import { getChildrenOf } from "@/lib/niches";

export async function GET(request: Request) {
  try {
    const { workspaceId, user } = await requireUser();
    const userId = user.id;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const borough = searchParams.get("borough");
    const hasWebsite = searchParams.get("hasWebsite");
    const minScore = searchParams.get("minScore");
    const maxScore = searchParams.get("maxScore");
    // Rating filter — used by the "Reviews ≤ 3.5" preset which
    // promised filtering but only sorted before. `minRating`/`maxRating`
    // are floats (Google rating is 0..5 with one decimal).
    const minRating = searchParams.get("minRating");
    const maxRating = searchParams.get("maxRating");
    // ISO timestamp lower bound on `createdAt`. Used by the
    // "Today's new" preset to actually scope to today's discoveries
    // rather than just sorting by createdAt (which is the default).
    const createdSince = searchParams.get("createdSince");
    const status = searchParams.get("status");
    const niche = searchParams.get("niche");
    const subNiche = searchParams.get("subNiche");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const search = searchParams.get("search");
    // Phase 1 — top-level "view" tab: today | mine | all | archive.
    const queue = searchParams.get("queue") || "all";
    // P1.5 - GPS-based sorting + radius filter (ICP4 walk-in workflow).
    const userLat = parseFloat(searchParams.get("userLat") || "");
    const userLng = parseFloat(searchParams.get("userLng") || "");
    const withinMiles = parseFloat(searchParams.get("withinMiles") || "");
    const hasUserLoc = Number.isFinite(userLat) && Number.isFinite(userLng);
    const isNearestSort = sortBy === "nearest" && hasUserLoc;

    const where: Record<string, unknown> = { workspaceId };

    // Phase 1 — Today's Queue / My Leads / Archive scoping.
    // - "today": assigned to me OR unassigned AND (nextActionDueAt
    //   <= now OR null) AND not archived/discarded/snoozed/dnc
    // - "mine": assigned to me, not archived
    // - "all": legacy — everything not archived
    // - "archive": archivedAt IS NOT NULL
    const now = new Date();
    if (queue === "archive") {
      where.archivedAt = { not: null };
    } else if (queue === "today") {
      where.archivedAt = null;
      where.discardedAt = null;
      where.dnc = false;
      where.AND = [
        ...((where.AND as Array<Record<string, unknown>> | undefined) ?? []),
        {
          OR: [
            { snoozeUntil: null },
            { snoozeUntil: { lte: now } },
          ],
        },
        {
          OR: [
            { assignedToUserId: userId },
            { assignedToUserId: null },
          ],
        },
        {
          OR: [
            { nextActionDueAt: null },
            { nextActionDueAt: { lte: now } },
          ],
        },
      ];
    } else if (queue === "mine") {
      where.archivedAt = null;
      where.assignedToUserId = userId;
    } else {
      // "all" — keep existing default but hide archived.
      where.archivedAt = null;
    }

    if (borough && borough !== "all") where.borough = borough;
    if (hasWebsite === "true") where.hasWebsite = true;
    if (hasWebsite === "false") where.hasWebsite = false;

    if (minRating || maxRating) {
      const min = minRating ? parseFloat(minRating) : NaN;
      const max = maxRating ? parseFloat(maxRating) : NaN;
      const ratingFilter: Record<string, number> = {};
      if (Number.isFinite(min)) ratingFilter.gte = min;
      if (Number.isFinite(max)) ratingFilter.lte = max;
      if (Object.keys(ratingFilter).length > 0) {
        where.rating = ratingFilter;
      }
    }

    if (createdSince) {
      const since = new Date(createdSince);
      if (!Number.isNaN(since.getTime())) {
        where.createdAt = { gte: since };
      }
    }

    if (search) {
      const terms = search.trim().split(/\s+/).filter(Boolean);
      if (terms.length > 0) {
        // Append search clauses to any existing AND (e.g. Today's
        // Queue snooze/assignment/due-date constraints). Previously
        // we overwrote `where.AND` and silently broadened the query.
        const existingAnd =
          (where.AND as Array<Record<string, unknown>> | undefined) ?? [];
        where.AND = [
          ...existingAnd,
          ...terms.map((term) => {
            const or: Array<Record<string, unknown>> = [
              { businessName: { contains: term, mode: "insensitive" } },
              { formattedAddress: { contains: term, mode: "insensitive" } },
            ];
            const digits = term.replace(/\D/g, "");
            if (digits.length >= 3) {
              or.push({ phone: { contains: digits } });
            }
            return { OR: or };
          }),
        ];
      }
    }

    // Niche / sub-niche filters. When a parent slug is selected without
    // a sub-niche we also include the parent's children so legacy leads
    // tagged only with `nicheSlug = "fnb"` still surface alongside their
    // classified siblings.
    //
    // The parent+children case must be wrapped in AND because
    // top-level `where.OR` is also used by the "concrete + unscored"
    // status branch below. Sharing a single `where.OR` collapses the
    // semantics from "(matches niche) AND (matches status)" to
    // "(matches niche) OR (matches status)".
    if (niche && niche !== "all") {
      const childSlugs = getChildrenOf(niche).map((c) => c.slug);
      if (subNiche && subNiche !== "all") {
        where.subNicheSlug = subNiche;
      } else if (childSlugs.length > 0) {
        const existingAnd =
          (where.AND as Array<Record<string, unknown>> | undefined) ?? [];
        where.AND = [
          ...existingAnd,
          {
            OR: [
              { nicheSlug: niche },
              { subNicheSlug: { in: childSlugs } },
            ],
          },
        ];
      } else {
        where.nicheSlug = niche;
      }
    } else if (subNiche && subNiche !== "all") {
      where.subNicheSlug = subNiche;
    }

    // Status filter — supports comma-joined multi-select. The special
    // value "unscored" matches leads without a SalesOpportunity row.
    let unscoredOnly = false;
    let salesOppFilter: Record<string, unknown> | undefined;
    if (status && status !== "all") {
      const list = status
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const includesUnscored = list.includes("unscored");
      const concrete = list
        .filter((s) => s !== "unscored")
        .map((s) => s.toUpperCase());

      if (concrete.length > 0 && includesUnscored) {
        // "Has any of these statuses, OR has no opportunity row at all".
        // Wrapped in AND so this OR composes correctly with any other
        // top-level OR (e.g. niche-children) — sharing a single
        // `where.OR` would collapse them into a single disjunction.
        const existingAnd =
          (where.AND as Array<Record<string, unknown>> | undefined) ?? [];
        where.AND = [
          ...existingAnd,
          {
            OR: [
              { salesOpportunity: { status: { in: concrete } } },
              { salesOpportunity: null },
            ],
          },
        ];
      } else if (concrete.length > 0) {
        salesOppFilter = { status: { in: concrete } };
      } else if (includesUnscored) {
        unscoredOnly = true;
        where.salesOpportunity = null;
      }
    }

    if (minScore || maxScore) {
      salesOppFilter = {
        ...(salesOppFilter ?? {}),
        opportunityScore: {
          ...(minScore ? { gte: parseInt(minScore) } : {}),
          ...(maxScore ? { lte: parseInt(maxScore) } : {}),
        },
      };
    }

    if (salesOppFilter && !unscoredOnly) {
      where.salesOpportunity = {
        ...(where.salesOpportunity as Record<string, unknown> | undefined),
        ...salesOppFilter,
      };
    }

    // When sorting by score, exclude leads with no salesOpportunity
    // row. Postgres orders NULLs FIRST in DESC, so without this guard
    // unscored leads bubble to the top of "Score (high → low)" — the
    // exact opposite of what the label promises. If the user already
    // has a salesOpportunity filter (status/score-range), relation
    // existence is implicit and we leave the filter alone. Skipped
    // when the user explicitly asked for unscored.
    if (sortBy === "score" && !unscoredOnly && !where.salesOpportunity) {
      where.salesOpportunity = { isNot: null };
    }

    type LeadOrderBy = Record<string, unknown>;
    // Prisma 6 only accepts plain `asc|desc` (SortOrder) when ordering by
    // a non-null relation field. `opportunityScore` is `Int @default(0)`
    // so the `{ sort, nulls }` (SortOrderInput) form throws
    // "Expected SortOrder, provided Object" at runtime. Nullable direct
    // fields below (`salesConfidence`, `nextActionDueAt`) keep the
    // expanded form because they are on `Lead` itself and nullable.
    const dir: "asc" | "desc" = sortOrder === "asc" ? "asc" : "desc";
    let orderBy: LeadOrderBy | LeadOrderBy[];
    if (sortBy === "score") {
      orderBy = [
        { salesOpportunity: { opportunityScore: dir } },
        { createdAt: "desc" },
      ];
    } else if (sortBy === "queue") {
      // Phase 1 — Today's Queue ordering: leads with the soonest
      // nextActionDueAt first; ties broken by salesConfidence DESC
      // (act on high-confidence leads before low-confidence ones).
      // Leads with no salesConfidence sort last via Prisma's `nulls`.
      orderBy = [
        { nextActionDueAt: { sort: "asc", nulls: "last" } },
        { salesConfidence: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ];
    } else if (sortBy === "confidence") {
      orderBy = [
        { salesConfidence: { sort: dir, nulls: "last" } },
        { createdAt: "desc" },
      ];
    } else if (sortBy === "nearest") {
      orderBy = { createdAt: dir };
    } else {
      orderBy = { [sortBy]: dir };
    }

    const isGeoMode = isNearestSort || Number.isFinite(withinMiles);
    const fetchLimit = isGeoMode ? Math.min(2000, limit * 10) : limit;
    const fetchSkip = isGeoMode ? 0 : (page - 1) * limit;

    const [allLeads, dbTotal] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          websiteAudit: true,
          salesOpportunity: true,
          watchlistItem: { select: { id: true, pipelineStage: true } },
        },
        orderBy,
        skip: fetchSkip,
        take: fetchLimit,
      }),
      prisma.lead.count({ where }),
    ]);

    // Resolve recommendedPackageId → name + priceLabel in a single query
    // per page so the row badge can render inline. Free-text id =>
    // missing rows render with packageName = null and the UI hides the
    // chip.
    const packageIds = Array.from(
      new Set(
        allLeads
          .map((l) => l.salesOpportunity?.recommendedPackageId)
          .filter((id): id is string => !!id),
      ),
    );
    const packages = packageIds.length
      ? await prisma.servicePackage.findMany({
          where: { workspaceId, id: { in: packageIds } },
          select: { id: true, name: true, priceLabel: true },
        })
      : [];
    const packageById = new Map(packages.map((p) => [p.id, p]));

    type DecoratedLead = (typeof allLeads)[number] & {
      salesOpportunity:
        | (NonNullable<(typeof allLeads)[number]["salesOpportunity"]> & {
            recommendedPackageName: string | null;
            recommendedPackagePriceLabel: string | null;
          })
        | null;
    };

    const decorated: DecoratedLead[] = allLeads.map((lead) => {
      if (!lead.salesOpportunity) return { ...lead, salesOpportunity: null };
      const pkg = lead.salesOpportunity.recommendedPackageId
        ? packageById.get(lead.salesOpportunity.recommendedPackageId) ?? null
        : null;
      return {
        ...lead,
        salesOpportunity: {
          ...lead.salesOpportunity,
          recommendedPackageName: pkg?.name ?? null,
          recommendedPackagePriceLabel: pkg?.priceLabel ?? null,
        },
      };
    });

    let leads:
      | DecoratedLead[]
      | Array<DecoratedLead & { distanceMiles: number | null }> = decorated;
    let filteredTotal = dbTotal;

    if (hasUserLoc && Number.isFinite(withinMiles)) {
      leads = filterWithinMiles(decorated, userLat, userLng, withinMiles);
      filteredTotal = leads.length;
    }

    if (isNearestSort) {
      leads = sortByDistance(leads as DecoratedLead[], userLat, userLng);
    }

    if (isGeoMode) {
      const start = (page - 1) * limit;
      leads = leads.slice(start, start + limit);
    }

    const total = isGeoMode ? filteredTotal : dbTotal;
    return NextResponse.json({
      leads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.leads.fetch_error", error);
  }
}
