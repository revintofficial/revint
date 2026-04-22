import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { PLANS } from "@/lib/plans";
import { logger } from "@/lib/logger";
import { notifyBillingEvent } from "@/lib/email/notifications";
import type { Plan } from "@/generated/prisma/client";

function formatAmount(amount: number | null | undefined, currency: string | null | undefined): string | null {
  if (amount == null || !currency) return null;
  const minor = amount / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(minor);
  } catch {
    return `${minor.toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export const runtime = "nodejs";

function detectPlanFromPriceId(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null;
  for (const planId of ["PRO", "PRO_TEAM", "AGENCY"] as const) {
    const ids = PLANS[planId].priceIds;
    if (priceId === ids.USD || priceId === ids.GBP) return planId;
  }
  return null;
}

async function alreadyProcessed(eventId: string, type: string): Promise<boolean> {
  try {
    await prisma.stripeEventLog.create({ data: { id: eventId, type } });
    return false;
  } catch (err) {
    // Unique violation = duplicate event. Stripe retried a delivered event.
    const code = (err as { code?: string }).code;
    if (code === "P2002") return true;
    throw err;
  }
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    logger.error("stripe.webhook.missing_secret", {});
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
    logger.warn("stripe.webhook.bad_signature", { err: String(err) });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency guard: reject replays before any state mutation.
  try {
    if (await alreadyProcessed(event.id, event.type)) {
      return NextResponse.json({ received: true, duplicate: true });
    }
  } catch (err) {
    logger.error("stripe.webhook.idempotency_check_failed", { eventId: event.id, err: String(err) });
    // If the idempotency table itself is unreachable, fail closed so Stripe
    // retries rather than letting an event through un-deduped.
    return NextResponse.json({ error: "Idempotency store unavailable" }, { status: 500 });
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
        if (!plan) {
          // Unknown SKU: do not guess. Record the customer link so billing
          // portal still works, but leave the plan untouched.
          logger.warn("stripe.webhook.unknown_price_on_checkout", {
            workspaceId,
            priceId,
            subscriptionId,
          });
          await prisma.workspace.update({
            where: { id: workspaceId },
            data: {
              stripeSubscriptionId: subscriptionId,
              stripeCustomerId:
                typeof s.customer === "string"
                  ? s.customer
                  : (sub.customer as string),
            },
          });
          break;
        }

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

        if (!plan) {
          // Unknown price - could be a new SKU, a currency change, or an
          // add-on we do not model yet. Leave the plan unchanged so we do
          // NOT silently downgrade a paying customer. Keep period end in
          // sync so quota math stays correct.
          logger.warn("stripe.webhook.unknown_price_on_update", {
            workspaceId,
            priceId,
            subscriptionId: sub.id,
          });
          await prisma.workspace.updateMany({
            where,
            data: {
              stripeSubscriptionId: sub.id,
              currentPeriodEnd: sub.current_period_end
                ? new Date(sub.current_period_end * 1000)
                : null,
            },
          });
          break;
        }

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

        // Notify owner when the plan actually changed. Skip no-op updates
        // (e.g. Stripe syncs that leave the price alone) so we don't ping
        // the user for every invoice renewal.
        const changed = await prisma.workspace.findFirst({
          where: workspaceId
            ? { id: workspaceId }
            : { stripeCustomerId: sub.customer as string },
          select: { id: true, plan: true },
        });
        if (changed) {
          await notifyBillingEvent({
            workspaceId: changed.id,
            kind: "plan_updated",
            planName: PLANS[plan].name,
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const ws = await prisma.workspace.findFirst({
          where: { stripeSubscriptionId: sub.id },
          select: { id: true },
        });
        await prisma.workspace.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: { plan: "FREE", stripeSubscriptionId: null, currentPeriodEnd: null },
        });
        if (ws) {
          await notifyBillingEvent({
            workspaceId: ws.id,
            kind: "subscription_cancelled",
          });
        }
        break;
      }

      case "invoice.paid": {
        // Idempotency already guaranteed by stripe_event_log above, so this
        // will no longer reset counters on Stripe retry storms.
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

      case "invoice.payment_failed":
      case "invoice.payment_action_required": {
        const inv = event.data.object as Stripe.Invoice & {
          subscription?: string | { id: string } | null;
        };
        const rawSub = inv.subscription;
        const subscriptionId =
          typeof rawSub === "string" ? rawSub : rawSub?.id || null;
        if (!subscriptionId) break;
        // We do not downgrade immediately - Stripe dunning will retry for
        // the smart-retry window, and on final failure will fire
        // customer.subscription.deleted which we already handle. Logging
        // here gives ops a signal to reach out.
        logger.warn("stripe.webhook.payment_failed", {
          subscriptionId,
          type: event.type,
        });
        const ws = await prisma.workspace.findFirst({
          where: { stripeSubscriptionId: subscriptionId },
          select: { id: true },
        });
        if (ws) {
          await notifyBillingEvent({
            workspaceId: ws.id,
            kind: "payment_failed",
            amountFormatted: formatAmount(inv.amount_due, inv.currency ?? null),
          });
        }
        break;
      }
    }
  } catch (err) {
    logger.error("stripe.webhook.handler_error", {
      eventId: event.id,
      type: event.type,
      err: String(err),
    });
    // Roll back the idempotency record so Stripe can retry this event. Any
    // failure to delete is logged and swallowed - Stripe retrying twice is
    // better than a dropped event.
    try {
      await prisma.stripeEventLog.delete({ where: { id: event.id } });
    } catch {
      // ignore
    }
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
