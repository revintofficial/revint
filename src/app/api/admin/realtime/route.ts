import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import { getRealtimeSessions } from "@/lib/admin/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Active visitors in the last 5 minutes plus their currently-open
 * page-view (where leftAt is still null). Polled by /admin/realtime
 * every 5 seconds. We do not Redis-cache this one because the value
 * is the entire payload, not a single counter, and the founder is
 * the only client.
 */
export const GET = withAdminAuth(async () => {
  const rows = await getRealtimeSessions(100);
  return NextResponse.json({ rows });
});
