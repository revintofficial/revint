import { NextResponse, type NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import { getTimeSeries, pickGranularity, rangeForPreset } from "@/lib/admin/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withAdminAuth(async (_session, request: Request) => {
  const url = new URL((request as NextRequest).url);
  const presetRaw = url.searchParams.get("range") ?? "30d";
  const preset = (
    ["today", "7d", "30d", "90d"].includes(presetRaw) ? presetRaw : "30d"
  ) as "today" | "7d" | "30d" | "90d";
  const range = rangeForPreset(preset);
  const granularity = pickGranularity(preset);
  const points = await getTimeSeries(range, granularity);
  return NextResponse.json({ granularity, points });
});
