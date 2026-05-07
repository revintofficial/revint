import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import { getLiveCounter } from "@/lib/admin/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Live visitor counter. Polled by the overview page client widget
 * every 10 seconds. Result is Redis-cached for 10s so a panel that
 * stays open for an hour doesn't bring 360 admin counts/hr against
 * the DB.
 */
export const GET = withAdminAuth(async () => {
  const { active, cached } = await getLiveCounter();
  return NextResponse.json({ active, cached });
});
