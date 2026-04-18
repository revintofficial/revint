import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";

const VALID_STATUSES = ["NEW", "CONTACTED", "INTERESTED", "MEETING", "WON", "LOST"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { workspaceId } = await requireUser();
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || !VALID_STATUSES.includes(status.toUpperCase())) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const lead = await prisma.lead.findFirst({
      where: { id, workspaceId },
      select: { salesOpportunity: { select: { id: true } } },
    });
    if (!lead?.salesOpportunity) {
      return NextResponse.json(
        { error: "No sales opportunity found for this lead" },
        { status: 404 }
      );
    }

    const updated = await prisma.salesOpportunity.update({
      where: { leadId: id },
      data: { status: status.toUpperCase() },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Status update error:", error);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}
