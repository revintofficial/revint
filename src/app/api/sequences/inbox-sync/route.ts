import { NextResponse } from "next/server";
import { requireWorkspaceAdmin, UnauthorizedError } from "@/lib/auth";
import { syncWorkspaceInbox } from "@/lib/sequence-engine/inbox-sync";
import { logger } from "@/lib/logger";

/**
 * Phase 2 — manual inbox-sync trigger. Admin pulls the last 24h of
 * inbox messages from every connected EmailAccount in the
 * workspace, classifies each, and writes EMAIL_REPLIED activities
 * to the matching leads.
 *
 * Long-term this will run on a schedule (every 5 minutes via the
 * agent-runs queue). For the FineDine pilot we expose a manual
 * trigger so the admin can prove the loop end-to-end before we
 * automate it.
 */
export async function POST() {
  try {
    const session = await requireWorkspaceAdmin();
    const result = await syncWorkspaceInbox(session.workspaceId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.sequences.inbox_sync.error", { err });
    return NextResponse.json({ error: "Failed to sync inbox" }, { status: 500 });
  }
}
