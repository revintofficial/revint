import { NextResponse, type NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import {
  getCityBreakdown,
  getCountryBreakdown,
  rangeForPreset,
} from "@/lib/admin/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withAdminAuth(async (_session, request: Request) => {
  const url = new URL((request as NextRequest).url);
  const preset = (url.searchParams.get("range") ?? "30d") as "today" | "7d" | "30d" | "90d";
  const range = rangeForPreset(["today", "7d", "30d", "90d"].includes(preset) ? preset : "30d");
  const [countries, cities] = await Promise.all([
    getCountryBreakdown(range),
    getCityBreakdown(range, 100),
  ]);
  return NextResponse.json({ countries, cities });
});
