import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import { getSessionDetail } from "@/lib/admin/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withAdminAuth(
  async (_session, _request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const detail = await getSessionDetail(id);
    if (!detail) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(detail);
  },
);
