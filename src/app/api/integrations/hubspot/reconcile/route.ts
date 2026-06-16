/**
 * FineDine v1 update — reconcile failed HubSpot writebacks.
 *
 * Sweeps FAILED OUTBOUND `CrmSyncLog` rows and retries them. Intended to
 * be hit by a scheduled cron (e.g. Vercel Cron) authenticated with
 * `CRON_SECRET`, OR manually by a workspace admin (scoped to their
 * workspace). No new BullMQ queue — this is the outbox reconcile tick.
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getOptionalUser } from "@/lib/auth";
import { internalError } from "@/lib/api-errors";
import { reconcileCrmWriteback } from "@/lib/integrations/hubspot/writeback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization");
    const isCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (isCron) {
      const result = await reconcileCrmWriteback(prisma, { limit: 100 });
      return NextResponse.json({ ok: true, ...result });
    }

    // Otherwise require an admin and scope to their workspace.
    const session = await getOptionalUser();
    if (!session || (session.role !== "OWNER" && session.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const result = await reconcileCrmWriteback(prisma, {
      workspaceId: session.workspaceId,
      limit: 50,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return internalError("api.hubspot.reconcile.POST", err);
  }
}
