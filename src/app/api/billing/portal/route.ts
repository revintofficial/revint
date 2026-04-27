import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe, isBillingEnabled } from "@/lib/stripe";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { internalError } from "@/lib/api-errors";

export async function POST(request: Request) {
  try {
    if (!isBillingEnabled()) {
      return NextResponse.json({ error: "Billing not configured" }, { status: 503 });
    }
    const session = await requireUser();
    // Stripe billing portal exposes invoices, payment methods, and cancellation
    // controls. Restrict to owners only - matches the gated UI on
    // BillingPanel and prevents members from canceling their org's subscription.
    if (session.role !== "OWNER") {
      return NextResponse.json(
        { error: "Only the workspace owner can manage billing" },
        { status: 403 }
      );
    }
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
    return internalError("api.billing.portal_error", error);
  }
}
