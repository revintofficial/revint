import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe, isBillingEnabled } from "@/lib/stripe";
import { requireUser, UnauthorizedError } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    if (!isBillingEnabled()) {
      return NextResponse.json({ error: "Billing not configured" }, { status: 503 });
    }
    const session = await requireUser();
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: session.workspaceId },
    });
    if (!workspace.stripeCustomerId) {
      return NextResponse.json(
        { error: "No Stripe customer for this workspace" },
        { status: 400 }
      );
    }
    const stripe = getStripe();
    const origin = new URL(request.url).origin;
    const portal = await stripe.billingPortal.sessions.create({
      customer: workspace.stripeCustomerId,
      return_url: `${origin}/app/settings/billing`,
    });
    return NextResponse.json({ url: portal.url });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Portal error:", error);
    return NextResponse.json(
      { error: "Failed to open billing portal", detail: String(error) },
      { status: 500 }
    );
  }
}
