import { NextResponse } from "next/server";
import {
  requireWorkspaceAdminApi,
  UnauthorizedError,
  ForbiddenError,
} from "@/lib/auth";
import { syncWorkspaceInbox } from "@/lib/sequence-engine/inbox-sync";
import { internalError } from "@/lib/api-errors";

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
    const session = await requireWorkspaceAdminApi();
    const result = await syncWorkspaceInbox(session.workspaceId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return internalError("api.sequences.inbox_sync.error", err);
  }
}
