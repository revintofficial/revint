# Security runbook

## Secret rotation

Any key that has been committed, read into a chat transcript, shared in CI
logs, or pasted into a ticket must be treated as public. At the time this
doc was written, the repo's `.env` held live values for all of the below.
They must be rotated before the first production deploy.

| Key | Where to rotate | Notes |
| --- | --- | --- |
| `DATABASE_URL` / `DIRECT_URL` password | Supabase dashboard -> Project settings -> Database -> Reset password | Update both pooler (port 6543) and direct (port 5432) URLs. Redeploy app and restart workers. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard -> Project settings -> API -> JWT settings -> Rotate `anon` key | Cheap to rotate; public by design. |
| `SUPABASE_SERVICE_ROLE_KEY` | Same screen as above, rotate `service_role` key | Server-only. Never ship to the browser. |
| `GOOGLE_PLACES_API_KEY` | Google Cloud Console -> APIs & Services -> Credentials -> Delete old key, create new | Restrict the new key to Places API (New), Geocoding API, and your server IP range. |
| `GEMINI_API_KEY` | Google AI Studio -> API keys -> Delete, regenerate | Quota and billing stay with the project. |
| `STRIPE_SECRET_KEY` | Stripe dashboard -> Developers -> API keys -> Roll key | Use test mode for staging, live mode for prod. Never reuse. |
| `STRIPE_WEBHOOK_SECRET` | Stripe dashboard -> Developers -> Webhooks -> click endpoint -> Roll signing secret | Must be set before prod traffic; webhook handler 503s without it. |
| OAuth client secrets (Google / Microsoft) | Respective console -> OAuth 2.0 client -> Regenerate secret | Required only if direct email send is enabled. |
| `ZEROBOUNCE_API_KEY` | ZeroBounce dashboard -> API keys | Optional; without it email verification is a no-op. |

## Verifying env hygiene pre-deploy

Before each production deploy:

1. `git ls-files | grep -i '\.env'` should print nothing.
2. Diff the deployed env against `.env.example` - the required rows must all
   be set, none of them equal to the example values.
3. Confirm `next.config.mjs` does not inline server secrets via the top-level
   `env` field. Server keys must be read via `process.env` at request time,
   not compiled into the client bundle.

## Reporting a vulnerability

Email security@leadacai.com. Do not file a public GitHub issue.
