# Decision — sunset the FREE plan, replace with a 14-day card-on-file trial

**Date:** 2026-05-06
**Status:** Decided. Implementation lands across Phase C (pricing UI), Phase H (auth/signup), and a Stripe webhook update.
**Owner:** Mert
**Reverses:** the original FREE plan (50 leads/mo, no card) shipped in `src/lib/plans.ts` PLANS.FREE.

---

## Context

The web-presence overhaul (`.cursor/plans/web_presence_b2b_overhaul_cf071b64.plan.md`) reframes Revint as B2B-only — local lead intelligence for agency owners, not an AI tool for hype tourists. The architecture supports this audience already (multi-tenant workspaces, agency tier, ServicePackage, opener writer, sales-opportunity-scorer). The marketing site, signup flow, and FREE plan are the parts catching up.

The FREE plan is the one piece of the surface that contradicts the new positioning loudest. It signals "free toy to play with" to the wrong audience and "tourist product" to the right audience.

## The decision

**Sunset the FREE plan as a public option.** Replace the public signup CTA with a 14-day trial that requires a card on file.

Three reasons:

1. **Hype tourists were the FREE plan's loudest tenant.** They never converted. They consumed the most quota for the lowest revenue and generated zero signal we could learn from. (Compare: the FineDine beta tester wrote a 1,283-line bug report. Hype tourists wrote zero.)
2. **B2B agency buyers expect a trial with a card.** $79-$249/month is fine — they are paying $300-$5,000/month elsewhere already. The credit-card gate is itself a qualifier; it filters out the audience we are trying to repel.
3. **Per-prospect data is expensive.** Apify enrichment, Gemini calls, Google Maps API quota — all real cost. A FREE plan that pulls 50 leads + 20 audits + 3 mockups burns $3-8/month per active free user. With near-zero conversion, it's a dead spend line.

## What we considered (and rejected)

### Option A: Keep FREE as-is

Trade-off: signups stay high; revenue per signup stays low. Conversion to paid was sub-2% historically. The hype-tourist signal in support volume and feature requests was actively distorting the roadmap.

Rejected. The cost is not the FREE plan itself — it's the way it shaped what we paid attention to.

### Option B: Demo gate (no signup until a 15-min walkthrough)

Trade-off: highest qualifier, lowest conversion. Some genuinely qualified buyers want to try before they talk. A demo-only gate trades qualified-but-shy buyers for nobody.

Rejected as the primary path. Kept as a parallel CTA: every signup page also shows "Book a 15-min walkthrough" → `/demo` route.

### Option C: 7-day trial without a card

Trade-off: lower friction than a card-required trial, but signal quality matches the current FREE plan — hype tourists reach for the same "free for a week" hideout.

Rejected. The point of the change is to filter, not to lower friction.

### Option D: 14-day trial with a card on file (CHOSEN)

Trade-off: signups drop. Quality of signups goes up. Conversion-to-paid jumps because the card is already on file at trial end.

This is the decision. It matches industry norms (Asana, Canva, Notion all use card-required trials) and fits the buyer profile (B2B agency owners are not card-shy).

## Implementation

### 1. `src/lib/plans.ts`

Do NOT delete the `FREE` enum value or the `PLANS.FREE` entry. Existing rows reference it; the API layer needs the plan to exist so customers grandfather correctly.

Instead, add a `hidden?: boolean` flag:

```ts
export interface PlanDefinition {
  // ... existing fields
  hidden?: boolean;
}

export const PLANS: Record<Plan, PlanDefinition> = {
  FREE: {
    // ... existing fields
    hidden: true,
  },
  // ... PRO, PRO_TEAM, AGENCY unchanged
};
```

`PLAN_ORDER` stays the same — keep FREE in the enum so backend code paths don't break.

### 2. `src/components/marketing/pricing-cards.tsx`

Filter `PLAN_ORDER` to drop hidden plans before rendering the cards:

```ts
const visiblePlans = PLAN_ORDER.filter((id) => !PLANS[id].hidden);
```

Cards array uses `visiblePlans` instead of `PLAN_ORDER`.

### 3. Signup flow (`src/app/(marketing)/signup/page.tsx` + `src/app/auth/...`)

Three behaviors change:

- The signup page no longer creates a FREE workspace by default. New signups land in a "trial pending — add card" state.
- Stripe checkout in trial mode (`subscription_data.trial_period_days: 14`) creates the subscription with the user's chosen plan (Solo / Studio / Agency+).
- Trial end notification: 3 days before `trial_end`, send a Resend "trial ending" email pointing to billing portal.

The Stripe API supports trial-period-days on checkout sessions:

```ts
const session = await stripe.checkout.sessions.create({
  mode: "subscription",
  customer: workspace.stripeCustomerId,
  line_items: [{ price: getPriceId(plan, currency, cycle), quantity: 1 }],
  subscription_data: {
    trial_period_days: 14,
    trial_settings: {
      end_behavior: { missing_payment_method: "cancel" },
    },
  },
  payment_method_collection: "always",
  success_url: `${origin}/app/onboarding?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${origin}/pricing`,
});
```

`payment_method_collection: "always"` forces card collection at checkout even with a trial — this is the qualifier.
`end_behavior.missing_payment_method: "cancel"` cancels the subscription if the card fails at trial end (defense against expired-card edge cases).

### 4. Webhook handling

`/api/billing/webhook` already handles `customer.subscription.updated`. Add handling for:

- `customer.subscription.trial_will_end` (3 days before end) → fire Resend email
- `customer.subscription.updated` with `status: "trialing"` → set workspace plan immediately so quota gates work during the trial
- `customer.subscription.updated` with `status: "active"` after `trialing` → trial converted, log to `StripeEventLog` for analytics

Idempotency via `StripeEventLog.id` continues to work. No schema changes needed.

### 5. Existing FREE-tier customers (grandfather rule)

Any workspace currently on `Plan.FREE` keeps that plan until they explicitly upgrade. We do NOT auto-migrate them or auto-charge them. This is a positioning decision, not a billing strike.

The pricing page UI no longer shows FREE as an option, but the plan still exists for legacy rows. If a grandfathered customer hits a quota wall and asks for an upgrade, the standard upgrade flow handles them.

### 6. Refund window copy

Marketing copy promises a refund window if the customer doesn't pull a list and an audit they'd actually send within 14 days. This is honor-system, not policy-enforced — the operator emails support, we issue the refund, no questions.

The copy version: "14-day trial · cancel any time · refund window if it doesn't earn you a reply." Carry this language across:

- Hero microcopy
- Pricing page
- Signup confirmation
- Trial-ending email

## Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Signup volume drops 60-80% in week 1 | Very high | Expected. Phase J (LinkedIn outbound + niche forums) ramps before the FREE-plan flag flips, so the right-audience top-of-funnel is already running. |
| Genuinely qualified buyer wants to "try before paying" | Medium | `/demo` route is the parallel path. Walkthrough gives them a real list against their real postcode without a card. |
| Existing FREE customers feel betrayed when they see the page change | Low-medium | They are grandfathered. They lose nothing. A one-time email goes out: "Pricing page changed; your plan didn't." |
| Stripe trial flow breaks at checkout | Low | Webhook idempotency + the existing `StripeEventLog` table catch retries. Test with `stripe listen --forward-to localhost:3000/api/billing/webhook` before flipping the flag. |
| Refund-window copy gets abused (someone trials, cancels, refunds, repeats) | Low | Honor-system, but Stripe customer ID is the unique key. If someone tries to repeat-trial under the same email, the existing customer record blocks them. |

## What changes in the next 90 days

- Week 1-2: Phase A docs (this file is one of them) + Phase B homepage rewrite + Phase C pricing card filter ship behind `MARKETING_COMING_SOON` flag.
- Week 3-4: Phase H signup flow + Stripe trial integration ships behind the flag.
- Week 5: Internal QA, founder runs a fresh signup end-to-end, fixes anything that breaks.
- Week 6: `MARKETING_COMING_SOON` flag flips to `false`. Outbound + content distribution channels go live.
- Week 7-12: Watch trial-to-paid conversion. Industry benchmark for B2B SaaS card-required trials is 40-60%. Below 30% means something is wrong with the trial UX or the activation moment, not the gate itself.

## What we are NOT changing

- The `FREE` enum value in `src/lib/plans.ts`. Stays.
- The `Plan.FREE` value in the Prisma schema. Stays.
- Existing FREE-tier workspaces. Grandfathered.
- Quota enforcement logic in `src/lib/agent-workers/quota.ts`. Reads from `Workspace.plan` live, so no change needed.
- The product itself. The product was always B2B-shaped. The pricing UI and signup gate are catching up.

---

Last updated: 2026-05-06. This decision becomes irreversible the day the `MARKETING_COMING_SOON` flag flips.
