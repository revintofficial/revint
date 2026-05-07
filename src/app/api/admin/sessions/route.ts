import { NextResponse, type NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import { listSessions, type SessionListFilters } from "@/lib/admin/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseDate(v: string | null): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : undefined;
}

function parseBool(v: string | null): boolean | undefined {
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

export const GET = withAdminAuth(async (_session, request: Request) => {
  const url = new URL((request as NextRequest).url);
  const params = url.searchParams;
  const filters: SessionListFilters = {
    start: parseDate(params.get("start")),
    end: parseDate(params.get("end")),
    country: params.get("country") || undefined,
    device: params.get("device") || undefined,
    utmSource: params.get("utmSource") || undefined,
    visitorId: params.get("visitorId") || undefined,
    hasConverted: parseBool(params.get("hasConverted")),
    hasEngaged: parseBool(params.get("hasEngaged")),
  };
  const page = Math.max(0, Number(params.get("page") ?? 0) || 0);
  const pageSize = Math.max(1, Math.min(200, Number(params.get("pageSize") ?? 50) || 50));

  const result = await listSessions(filters, page, pageSize);
  return NextResponse.json(result);
});
