import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe, isBillingEnabled } from "@/lib/stripe";
import { PLANS } from "@/lib/plans";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import type { Plan } from "@/generated/prisma/client";

export async function POST(request: Request) {
  try {
    if (!isBillingEnabled()) {
      return NextResponse.json(
        { error: "Billing is not configured. Set STRIPE_SECRET_KEY in .env." },
        { status: 503 }
      );
    }
    const session = await requireUser();
    const body = await request.json();
    const plan = body.plan as Plan;
    const referralId = typeof body.referralId === "string" ? body.referralId : null;

    if (plan !== "PRO" && plan !== "PRO_TEAM" && plan !== "AGENCY") {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }
    const planDef = PLANS[plan];
    if (!planDef.priceId) {
      return NextResponse.json(
        { error: `STRIPE_PRICE_${plan} is not set in .env` },
        { status: 503 }
      );
    }

    const stripe = getStripe();
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: session.workspaceId },
    });

    let customerId = workspace.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email,
        name: workspace.name,
        metadata: { workspaceId: workspace.id, userId: session.user.id },
      });
      customerId = customer.id;
      await prisma.workspace.update({
        where: { id: workspace.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const origin = new URL(request.url).origin;
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: planDef.priceId, quantity: 1 }],
      success_url: `${origin}/app/settings/billing?success=1`,
      cancel_url: `${origin}/app/settings/billing?canceled=1`,
      allow_promotion_codes: true,
      // Rewardful attribution: when a referral cookie is present we forward
      // the ID as `client_reference_id` so the standard Stripe + Rewardful
      // integration can credit the partner.
      ...(referralId ? { client_reference_id: referralId } : {}),
      metadata: { workspaceId: workspace.id, plan },
      subscription_data: { metadata: { workspaceId: workspace.id, plan } },
    });

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session", detail: String(error) },
      { status: 500 }
    );
  }
}
