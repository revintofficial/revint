import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { PLANS } from "@/lib/plans";
import type { Plan } from "@/generated/prisma/client";

export const runtime = "nodejs";

function detectPlanFromPriceId(priceId: string | null | undefined): Plan {
  if (!priceId) return "FREE";
  if (priceId === PLANS.PRO.priceId) return "PRO";
  if (priceId === PLANS.PRO_TEAM.priceId) return "PRO_TEAM";
  if (priceId === PLANS.AGENCY.priceId) return "AGENCY";
  return "FREE";
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET not set" }, { status: 503 });
  }

  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const body = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const workspaceId = (s.metadata?.workspaceId as string) || null;
        if (!workspaceId) break;
        const subscriptionId =
          typeof s.subscription === "string" ? s.subscription : s.subscription?.id || null;
        if (!subscriptionId) break;

        const sub = (await stripe.subscriptions.retrieve(subscriptionId)) as unknown as Stripe.Subscription & {
          current_period_end: number;
        };
        const priceId = sub.items.data[0]?.price.id;
        const plan = detectPlanFromPriceId(priceId);

        await prisma.workspace.update({
          where: { id: workspaceId },
          data: {
            plan,
            stripeSubscriptionId: subscriptionId,
            stripeCustomerId:
              typeof s.customer === "string"
                ? s.customer
                : (sub.customer as string),
            currentPeriodEnd: sub.current_period_end
              ? new Date(sub.current_period_end * 1000)
              : null,
            leadsCreatedThisCycle: 0,
            aiCreditsUsedThisCycle: 0,
            cycleResetAt: new Date(),
          },
        });
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription & {
          current_period_end: number;
        };
        const priceId = sub.items.data[0]?.price.id;
        const plan = detectPlanFromPriceId(priceId);
        const workspaceId = (sub.metadata?.workspaceId as string) || null;
        const where = workspaceId
          ? { id: workspaceId }
          : sub.customer
          ? { stripeCustomerId: sub.customer as string }
          : null;
        if (!where) break;
        await prisma.workspace.updateMany({
          where,
          data: {
            plan,
            stripeSubscriptionId: sub.id,
            currentPeriodEnd: sub.current_period_end
              ? new Date(sub.current_period_end * 1000)
              : null,
          },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await prisma.workspace.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: { plan: "FREE", stripeSubscriptionId: null, currentPeriodEnd: null },
        });
        break;
      }

      case "invoice.paid": {
        const inv = event.data.object as Stripe.Invoice & {
          subscription?: string | { id: string } | null;
        };
        const rawSub = inv.subscription;
        const subscriptionId =
          typeof rawSub === "string" ? rawSub : rawSub?.id || null;
        if (!subscriptionId) break;
        await prisma.workspace.updateMany({
          where: { stripeSubscriptionId: subscriptionId },
          data: {
            leadsCreatedThisCycle: 0,
            aiCreditsUsedThisCycle: 0,
            cycleResetAt: new Date(),
          },
        });
        break;
      }
    }
  } catch (err) {
    console.error("Webhook handler failed:", err);
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
