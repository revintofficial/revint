import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe, isBillingEnabled } from "@/lib/stripe";
import { PLANS, getPriceId, normalizeCurrency, normalizeCycle } from "@/lib/plans";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { logger } from "@/lib/logger";
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
    const currency = normalizeCurrency(body.currency);
    const cycle = normalizeCycle(body.cycle);

    if (plan !== "PRO" && plan !== "PRO_TEAM" && plan !== "AGENCY") {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }
    const priceId = getPriceId(plan, currency, cycle);
    if (!priceId) {
      return NextResponse.json(
        { error: `STRIPE_PRICE_${plan}_${cycle === "annual" ? "ANNUAL_" : ""}${currency} is not set in .env` },
        { status: 503 }
      );
    }

    const stripe = getStripe();
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: session.workspaceId },
    });

    // Validate any cached Stripe customer ID before reuse. If the saved ID
    // was created under a different mode (live vs test) or has been deleted
    // upstream, Stripe will return resource_missing and we recreate the
    // customer so checkout can proceed instead of 500-ing.
    let customerId = workspace.stripeCustomerId;
    if (customerId) {
      try {
        const existing = await stripe.customers.retrieve(customerId);
        if ((existing as { deleted?: boolean }).deleted) {
          customerId = null;
        }
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === "resource_missing") {
          customerId = null;
        } else {
          throw err;
        }
      }
    }
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
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/app/settings/billing?success=1`,
      cancel_url: `${origin}/app/settings/billing?canceled=1`,
      allow_promotion_codes: true,
      // Rewardful attribution: when a referral cookie is present we forward
      // the ID as `client_reference_id` so the standard Stripe + Rewardful
      // integration can credit the partner.
      ...(referralId ? { client_reference_id: referralId } : {}),
      metadata: { workspaceId: workspace.id, plan, currency, cycle },
      subscription_data: { metadata: { workspaceId: workspace.id, plan, currency, cycle } },
    });

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.billing.checkout_error", { err: error });
    return NextResponse.json(
      { error: "Failed to create checkout session", detail: String(error) },
      { status: 500 }
    );
  }
}
