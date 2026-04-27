#!/usr/bin/env bash
#
# Push all Stripe LIVE-mode env vars into Vercel production.
#
# Prereqs:
#   1. `npm i -g vercel` and `vercel login` once.
#   2. From the repo root: `vercel link` (picks the project + scope).
#   3. Stripe live products + prices already created (this script's price IDs
#      are the ones the MCP created on 2026-04-27 for acct_1Q3o47Ag6vHmgkQo).
#   4. `STRIPE_LIVE_SECRET_KEY` and `STRIPE_LIVE_WEBHOOK_SECRET` exported in
#      the shell that runs this script (don't paste them into source).
#
# Usage:
#   export STRIPE_LIVE_SECRET_KEY=sk_live_xxx
#   export STRIPE_LIVE_WEBHOOK_SECRET=whsec_xxx
#   bash scripts/billing/setup-vercel-prod.sh
#
# Re-running is safe: `vercel env add` will fail with "already exists" for
# vars you have set; remove the old one first with `vercel env rm NAME production`.

set -euo pipefail

if [[ -z "${STRIPE_LIVE_SECRET_KEY:-}" ]]; then
  echo "ERROR: STRIPE_LIVE_SECRET_KEY is not set in your shell" >&2
  exit 1
fi
if [[ -z "${STRIPE_LIVE_WEBHOOK_SECRET:-}" ]]; then
  echo "ERROR: STRIPE_LIVE_WEBHOOK_SECRET is not set in your shell" >&2
  exit 1
fi
if ! command -v vercel >/dev/null 2>&1; then
  echo "ERROR: vercel CLI not on PATH (npm i -g vercel)" >&2
  exit 1
fi

set_var() {
  local name="$1"
  local value="$2"
  printf '%s' "$value" | vercel env add "$name" production --force
}

# Secrets - taken from the shell, never written to disk.
set_var STRIPE_SECRET_KEY     "$STRIPE_LIVE_SECRET_KEY"
set_var STRIPE_WEBHOOK_SECRET "$STRIPE_LIVE_WEBHOOK_SECRET"

# Pro Solo
set_var STRIPE_PRICE_PRO_USD            price_1TQcb5Ag6vHmgkQo04yH5Vtq
set_var STRIPE_PRICE_PRO_GBP            price_1TQcb6Ag6vHmgkQoVVc0vWKV
set_var STRIPE_PRICE_PRO_ANNUAL_USD     price_1TQcb7Ag6vHmgkQoyFjK6NcL
set_var STRIPE_PRICE_PRO_ANNUAL_GBP     price_1TQcb8Ag6vHmgkQo4LTRjtuV

# Pro Team
set_var STRIPE_PRICE_PRO_TEAM_USD            price_1TQcb9Ag6vHmgkQoLNuyrwgc
set_var STRIPE_PRICE_PRO_TEAM_GBP            price_1TQcbAAg6vHmgkQofAtyYFAG
set_var STRIPE_PRICE_PRO_TEAM_ANNUAL_USD     price_1TQcbBAg6vHmgkQoLTGKww2M
set_var STRIPE_PRICE_PRO_TEAM_ANNUAL_GBP     price_1TQcbCAg6vHmgkQobvuOSurR

# Agency
set_var STRIPE_PRICE_AGENCY_USD            price_1TQcbEAg6vHmgkQoADcURc75
set_var STRIPE_PRICE_AGENCY_GBP            price_1TQcbFAg6vHmgkQosh1rrfjT
set_var STRIPE_PRICE_AGENCY_ANNUAL_USD     price_1TQcbFAg6vHmgkQoe895dbWl
set_var STRIPE_PRICE_AGENCY_ANNUAL_GBP     price_1TQcbGAg6vHmgkQoSxtA6ags

echo
echo "Done. Trigger a production redeploy:"
echo "  vercel --prod"
echo
echo "Or in the Vercel dashboard: Deployments > latest production > redeploy."
