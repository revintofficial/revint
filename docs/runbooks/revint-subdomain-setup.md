# Revint subdomain setup — runbook

Single Next.js app, three Vercel domains, host-based routing in `src/proxy.ts`.
This runbook covers the external (DNS + Vercel + provider) setup that the
codebase cannot perform on its own. The code side ships in Phase 2b.

## Target topology

| Domain               | Purpose                          | Route group inside the app |
| -------------------- | -------------------------------- | -------------------------- |
| `revint.dev`         | Marketing + SEO directory        | `(site)`, `(public)`       |
| `app.revint.dev`     | Customer SaaS dashboard          | `app/*`                    |
| `admin.revint.dev`   | Internal platform-admin console  | `admin/*`                  |

All three resolve to the same Vercel project — the proxy decides what each
host can see. No monorepo split.

## 1. Cloudflare DNS

In the `revint.dev` zone, add two CNAMEs (apex stays as whatever you used
when you first attached `revint.dev` to Vercel — Cloudflare `CNAME flattening`
handles the apex `ALIAS`/`ANAME` requirement transparently):

| Type  | Name    | Target                  | Proxy  | TTL   |
| ----- | ------- | ----------------------- | ------ | ----- |
| CNAME | `app`   | `cname.vercel-dns.com`  | DNS only (gray cloud) | Auto |
| CNAME | `admin` | `cname.vercel-dns.com`  | DNS only (gray cloud) | Auto |

**Why gray cloud (DNS only)?** Vercel terminates TLS itself and needs the
upstream IP to match the Vercel edge. Orange-cloud (proxy on) breaks
certificate provisioning. You can flip to orange-cloud later if you set
"Strict" SSL mode and use a Cloudflare-issued origin cert, but for the
default Vercel-managed TLS, leave it gray.

## 2. Vercel domain attachment

Project → Settings → Domains → Add:

1. `app.revint.dev` — assign to `production` environment, `main` branch.
2. `admin.revint.dev` — same.

Wait for the green checkmark on both. Vercel issues Let's Encrypt certs
within a few minutes once DNS resolves.

Set `revint.dev` as the **primary** domain (any other domains attached to
the project automatically 308 to it unless code says otherwise — the
proxy will override this for `app.` and `admin.`).

## 3. Environment variables

Vercel → Project → Settings → Environment Variables. The same
`NEXT_PUBLIC_SITE_URL` value drives canonical URLs, OG cards, email
links, and the host fallback used by API routes (`siteHost()` in
`src/lib/seo/metadata.ts`).

| Var                       | Production              | Preview                 | Development         |
| ------------------------- | ----------------------- | ----------------------- | ------------------- |
| `NEXT_PUBLIC_SITE_URL`    | `https://revint.dev`    | leave unset (uses VERCEL_URL) | `http://localhost:3000` |
| `EMAIL_FROM`              | `Revint <noreply@revint.dev>` | (same) | (override per-dev) |
| `EMAIL_REPLY_TO`          | `hello@revint.dev`      | (same)                  | (override)          |
| `HUBSPOT_REDIRECT_URL`    | `https://revint.dev/api/integrations/hubspot/callback` | (preview URL) | (localhost) |

Server-only secrets (`STRIPE_SECRET_KEY`, `RESEND_API_KEY`,
`GEMINI_API_KEY`, etc.) stay where they already live. The Stripe live key
must NOT exist in `Development` — see Phase 4 hygiene note.

## 4. External providers — manual updates

These live outside the codebase and must be reconfigured by hand:

- **HubSpot** → app settings → Auth → Redirect URLs:
  add `https://revint.dev/api/integrations/hubspot/callback`. You can
  leave the old `leadacai.com` URL until every connected portal has
  re-authed (or just disconnect them all and re-add).
- **Supabase** → Auth → URL Configuration → Site URL:
  set to `https://app.revint.dev`. Add `https://app.revint.dev/auth/callback`
  to the allow list (and the apex `https://revint.dev/auth/callback` if
  you keep marketing-side magic-link landing).
- **Stripe** → Webhooks → endpoint URL:
  change to `https://revint.dev/api/billing/webhook`. After saving,
  copy the new signing secret into Vercel `STRIPE_WEBHOOK_SECRET`.
- **Apify** → Webhooks → endpoint URL:
  `https://revint.dev/api/webhooks/apify` (shared-secret stays the same).
- **Google Search Console / Bing Webmaster** → add the new domain as a
  fresh property and submit `/sitemap.xml` from each subdomain that
  serves SEO pages (apex `revint.dev` is the only one that does).
- **Posthog** → Project settings → Authorized domains: add `revint.dev`,
  `app.revint.dev`, `admin.revint.dev`.

## 5. Smoke test after Phase 2b ships

1. `curl -I https://revint.dev/` → 200 (marketing).
2. `curl -I https://revint.dev/app/dashboard` → 308 to `https://app.revint.dev/app/dashboard`.
3. `curl -I https://revint.dev/admin` → 308 to `https://admin.revint.dev/admin`.
4. `curl -I https://app.revint.dev/` → 200 (or login redirect, depending on session).
5. `curl -I https://app.revint.dev/pricing` → 404 (marketing path on app host should not resolve).
6. `curl -I https://admin.revint.dev/` → 401 or login (no email allowlist match) — never a 200 with a marketing page.

## 6. Grant platform admin (Phase 3)

`ADMIN_DASHBOARD_EMAILS` is now a bootstrap fallback. The authoritative
check is `User.isPlatformAdmin`. Promote your founder accounts in
Supabase SQL once each has signed in at least once (the row gets created
on first auth):

```sql
update public.users
set is_platform_admin = true
where email in (
  'mert@revint.dev',
  'cinar@revint.dev',
  'kaan@revint.dev'
);
```

After every founder is flagged, remove `ADMIN_DASHBOARD_EMAILS` from
Vercel env vars and redeploy. The cache invalidates within 30 seconds,
so a freshly-revoked admin loses access shortly after the column flips.

## 7. Email deliverability — SPF / DKIM / DMARC (Phase 4)

Resend is the only sender. Add three DNS records on the `revint.dev`
Cloudflare zone (gray cloud — these are TXT/CNAME, not HTTP):

| Type  | Name                     | Value                                                  |
| ----- | ------------------------ | ------------------------------------------------------ |
| TXT   | `revint.dev`             | `v=spf1 include:_spf.resend.com -all`                  |
| CNAME | `resend._domainkey`      | `resend._domainkey.resend.com`                         |
| TXT   | `_dmarc`                 | `v=DMARC1; p=quarantine; rua=mailto:postmaster@revint.dev; pct=100; aspf=s; adkim=s` |

Then in Resend dashboard → Domains → Add `revint.dev` → verify. Once
green, mark `revint.dev` as the **default sender domain** so any
template that does not override `from` uses it.

Start DMARC at `p=quarantine` for two weeks while you watch the
aggregate reports land at `postmaster@revint.dev` (or whatever
forwarding inbox you set up). When the reports show zero unauthorised
sources, tighten to `p=reject`.

**Why `aspf=s; adkim=s`?** Strict alignment means a passing SPF/DKIM
must come from the EXACT domain on the From: header, not a parent. This
closes the cousin-domain spoofing path that lax alignment leaves open.

## 8. Social identity (Phase 4)

Register and lock these handles before launch. The codebase already
points to them via `src/lib/seo/metadata.ts` `SITE.sameAs`:

- Twitter / X: `@revint`
- LinkedIn: `linkedin.com/company/revint`
- Crunchbase: `crunchbase.com/organization/revint`
- G2: `g2.com/products/revint` (claim on signup)
- Capterra: `capterra.com/p/revint`
- AlternativeTo: `alternativeto.net/software/revint/`

If any handle is taken, update both the registration and `SITE.sameAs`
together — these URLs feed Organization schema and any mismatch costs
brand SERP real estate.

## 9. Stripe key hygiene (Phase 4)

The `.env` in this repo currently holds a **live** `sk_live_...` key
so local dev hits real Stripe. Switch to a **test mode** key for
day-to-day development:

1. Stripe dashboard → Developers → API keys → "View test data" toggle.
2. Copy the test secret key (`sk_test_...`) and the test publishable
   key.
3. In `.env`, replace `STRIPE_SECRET_KEY` with the test value and
   recreate the test-mode price IDs (`STRIPE_PRICE_*`). The webhook
   secret in `.env` will then be the **test** signing secret from
   `stripe listen --forward-to localhost:3000/api/billing/webhook`.
4. Vercel preview deploys also point at test mode. Only the production
   environment carries live keys.

The repo's `.gitignore` already excludes `.env`, so the live key is
never committed — but a single leaked terminal screenshot is enough to
warrant a key rotation, so prefer test keys whenever you are not
specifically debugging a production incident.

## 10. Rollback

The proxy ships behind a single boolean. If anything is wrong after deploy:

```bash
# in Vercel env vars
SUBDOMAIN_ROUTING_DISABLED=true
```

Re-deploy. The proxy will revert to the legacy single-host behaviour
(`revint.dev/app/*` and `revint.dev/admin/*` directly accessible) while
you investigate.
