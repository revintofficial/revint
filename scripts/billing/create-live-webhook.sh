#!/usr/bin/env bash
#
# Create the Stripe LIVE webhook endpoint pointing at production. The Stripe
# MCP server doesn't expose webhook-endpoint operations, so we hit the REST
# API directly. Prints the signing secret on success - copy it into your
# host's STRIPE_WEBHOOK_SECRET env var.
#
# Usage:
#   export STRIPE_LIVE_SECRET_KEY=sk_live_xxx
#   bash scripts/billing/create-live-webhook.sh
#
# Idempotent? No - running twice creates two endpoints. List existing ones
# first if unsure: `curl -u sk_live_xxx: https://api.stripe.com/v1/webhook_endpoints`.

set -euo pipefail

if [[ -z "${STRIPE_LIVE_SECRET_KEY:-}" ]]; then
  echo "ERROR: STRIPE_LIVE_SECRET_KEY is not set in your shell" >&2
  exit 1
fi

WEBHOOK_URL="${WEBHOOK_URL:-https://leadacai.com/api/billing/webhook}"

# Match the events the handler in src/app/api/billing/webhook/route.ts
# actually responds to. Subscribing to extra events inflates retry noise.
curl --fail-with-body -X POST https://api.stripe.com/v1/webhook_endpoints \
  -u "${STRIPE_LIVE_SECRET_KEY}:" \
  -d "url=${WEBHOOK_URL}" \
  -d "description=Leadac billing webhook (live)" \
  -d "enabled_events[]=checkout.session.completed" \
  -d "enabled_events[]=customer.subscription.updated" \
  -d "enabled_events[]=customer.subscription.deleted" \
  -d "enabled_events[]=invoice.paid" \
  -d "enabled_events[]=invoice.payment_failed" \
  -d "enabled_events[]=invoice.payment_action_required"

echo
echo "Look for the \"secret\" field above (whsec_...). That's STRIPE_WEBHOOK_SECRET."
