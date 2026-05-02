import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe, isBillingEnabled } from "@/lib/stripe";
import { PLANS, getPriceId, normalizeCurrency, normalizeCycle } from "@/lib/plans";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { internalError } from "@/lib/api-errors";
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
    // Billing changes (creating a subscription, plan upgrades) must be limited
    // to workspace owners; non-owners should not be able to commit the
    // workspace to a paid plan even if they figure out the API contract.
    if (session.role !== "OWNER") {
      return NextResponse.json(
        { error: "Only the workspace owner can manage billing" },
        { status: 403 }
      );
    }
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
      // M2 fix - two parallel checkout requests from the same workspace
      // (rapid double-click on Upgrade, race between two browser tabs)
      // were creating duplicate Stripe customers because each request
      // hit the same `if (!customerId)` branch before the other could
      // persist the ID. Stripe's idempotency key collapses retries
      // server-side: the second request gets back the SAME customer
      // object instead of a new one. We then re-read the workspace row
      // to absorb any other request that already persisted the ID.
      const customer = await stripe.customers.create(
        {
          email: session.user.email,
          name: workspace.name,
          metadata: { workspaceId: workspace.id, userId: session.user.id },
        },
        {
          idempotencyKey: `ws-customer-${workspace.id}`,
        },
      );
      customerId = customer.id;

      // Race-safe upsert: another request may have just persisted a
      // different (or same, via idempotency) customer ID. Use
      // updateMany so we only set when still empty, then re-read.
      await prisma.workspace.updateMany({
        where: { id: workspace.id, stripeCustomerId: null },
        data: { stripeCustomerId: customerId },
      });
      const persisted = await prisma.workspace.findUniqueOrThrow({
        where: { id: workspace.id },
        select: { stripeCustomerId: true },
      });
      if (persisted.stripeCustomerId) {
        customerId = persisted.stripeCustomerId;
      }
    }

    const origin = new URL(request.url).origin;
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/app/settings/billing?success=1`,
      cancel_url: `${origin}/app/settings/billing?canceled=1`,
      allow_promotion_codes: true,
      // B2B VAT collection. Customers in EU/UK will see a "Add tax ID" field
      // that flows back into the Stripe customer record so invoices show
      // their VAT number. Required to be invoice-compliant in most of EU.
      tax_id_collection: { enabled: true },
      // Sync any name/address the customer enters at checkout back onto the
      // Stripe Customer so the billing portal and future invoices use the
      // same details. Without this, our `customers.create` defaults stick.
      customer_update: { name: "auto", address: "auto" },
      // Collect billing address - prerequisite for tax_id_collection on most
      // payment methods and a soft signal Stripe uses for fraud scoring.
      billing_address_collection: "auto",
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
    return internalError("api.billing.checkout_error", error);
  }
}
