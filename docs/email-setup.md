# Email setup — Resend + leadacai.com

Platform-wide transactional email goes through [Resend](https://resend.com) from the `leadacai.com` domain. This doc is the one-shot checklist for a new deploy or a domain migration.

Cold outreach (Gmail/Outlook OAuth) is a separate system and does **not** use Resend. See `src/lib/oauth/email-client.ts`.

## Architecture at a glance

| Channel | Provider | Code path |
| --- | --- | --- |
| Sign-up confirmation, magic link, password reset | Supabase Auth → Resend SMTP | `supabase.auth.*` (no code) |
| Team invite (account activation) | Supabase Auth → Resend SMTP | `src/app/api/team/invite/route.ts` |
| Team invite (branded supplement) | Resend SDK | `src/lib/email/templates/team-invite.tsx` |
| Welcome | Resend SDK | `src/lib/auth.ts` (first workspace creation) |
| Hot lead alert | Resend SDK | `src/workers/analyze-worker.ts` |
| Booking provider detected | Resend SDK | `src/workers/crawl-worker.ts` |
| Billing events (payment failed, plan change, cancel) | Resend SDK | `src/app/api/billing/webhook/route.ts` |
| Cold outreach to leads | OAuth Gmail/Outlook (user's own inbox) | `src/lib/oauth/email-client.ts` |

All Resend sends flow through `src/lib/email/send.ts` → `src/lib/email/client.ts`. In dev the client falls back to a console stub when `RESEND_API_KEY` is empty. In production missing the key throws.

## One-time setup

### 1. Create a fresh Resend API key

Resend Dashboard → **API Keys** → *Create API Key*. Name it `production-leadacai`. Never commit the value. Never paste it into a chat transcript (those are stored on disk and quickly become the weakest link in your secret chain).

### 2. Add `leadacai.com` to Resend

Resend Dashboard → **Domains** → *Add Domain* → `leadacai.com`. Resend will give you four DNS records to add to your registrar. You typically get:

- `TXT send.leadacai.com` — SPF (`v=spf1 include:amazonses.com ~all`)
- `MX send.leadacai.com` — bounce/complaint mailbox (`feedback-smtp.<region>.amazonses.com`, priority 10)
- `TXT resend._domainkey.leadacai.com` — DKIM public key
- `TXT _dmarc.leadacai.com` — recommended: `v=DMARC1; p=none; rua=mailto:dmarc@leadacai.com`

Paste each value *exactly* as Resend displays it. Propagation is usually under 30 minutes. Until verification turns green in the dashboard, sends will return `domain_not_verified`.

Use the `send.` subdomain rather than the apex — it keeps the root MX/SPF free for a mailbox (G Suite, Fastmail) if you ever want one on `@leadacai.com`.

### 3. Configure Supabase Custom SMTP

Supabase Dashboard → **Authentication** → *Email Templates* → **SMTP Settings** → *Enable Custom SMTP*:

| Field | Value |
| --- | --- |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | `<your RESEND_API_KEY>` |
| Sender email | `noreply@leadacai.com` |
| Sender name | `Leadac AI` |
| Admin email | `hello@leadacai.com` |

Once saved, sign-up confirmation, magic link, password reset, and `admin.auth.admin.inviteUserByEmail()` all route through Resend automatically. No code change needed.

While you're there, translate the built-in email templates (*Confirm signup*, *Magic Link*, *Change Email*, *Reset Password*, *Invite*) to Turkish and match the visual tone of `src/lib/email/templates/base.tsx`.

### 4. Set environment variables

Copy the new API key into your environment. Locally that's `.env`:

```
RESEND_API_KEY=re_xxx
EMAIL_FROM="Leadac AI <noreply@leadacai.com>"
EMAIL_REPLY_TO=hello@leadacai.com
```

On Vercel: **Project** → *Settings* → *Environment Variables*. Add the same three keys for Production (and Preview if you want previews to send real mail — usually you don't).

Optional for local dev:

```
EMAIL_DEV_REDIRECT=you@leadacai.com
```

With that set, every email routes to your personal address regardless of the "real" recipient — handy for exercising templates without spamming testing users.

## Exercising templates

The send helper treats `react` as the primary input and auto-renders both HTML and plaintext:

```ts
import { sendEmail } from "@/lib/email/send";
import { WelcomeEmail } from "@/lib/email/templates/welcome";

await sendEmail({
  to: "you@leadacai.com",
  subject: WelcomeEmail.buildSubject("Mert", "tr"),
  react: WelcomeEmail({
    fullName: "Mert Okumus",
    workspaceName: "Mert's Workspace",
    locale: "tr",
  }),
  tags: [{ name: "type", value: "welcome" }],
});
```

Use `sendEmailAsync` in hot paths (auth flows, workers) where a Resend outage must not block the primary action.

## Deployment checklist

Before flipping production traffic:

- [ ] `leadacai.com` shows **Verified** in Resend Dashboard → Domains
- [ ] Supabase Custom SMTP is enabled and the test button succeeds
- [ ] `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` are set in Vercel (Production)
- [ ] A manual test send (e.g. `npm run test -- email.test`) returns `delivered: true`
- [ ] A magic-link sign-up from a fresh email actually arrives in the inbox from `noreply@leadacai.com`
- [ ] A test invite triggers both the Supabase activation email **and** the branded supplement
- [ ] Resend Dashboard → Emails shows the sends grouped by `tags.type`

## When things go wrong

| Symptom | Likely cause |
| --- | --- |
| All sends skipped, dev logs `email.no_api_key_dev_stub` | `RESEND_API_KEY` empty — expected in local dev without a key |
| `delivered: false, error: "domain_not_verified"` | DNS not propagated or TXT value mistyped; re-check Resend Dashboard → Domains |
| Supabase auth emails still come from `noreply@mail.app.supabase.io` | Custom SMTP not enabled or credentials wrong; use the test button in the SMTP Settings panel |
| Booking/lead alerts never fire | Workspace owner's email is `*@user.local` or missing; only real addresses are eligible |
| Same alert sent many times during a bulk run | Cooldown Redis key isn't being set — check Redis health, then `email-cooldown:*` keys |
| Dev redirect emails go to real users | `EMAIL_DEV_REDIRECT` is set but `NODE_ENV` is `production` — redirect is ignored in prod by design |

## Secret rotation

If a Resend key leaks (committed, pasted in chat, leaked in a screenshot):

1. Resend Dashboard → **API Keys** → revoke the old key immediately.
2. Create a fresh key.
3. Update Vercel env vars and redeploy.
4. Update Supabase Custom SMTP (Authentication → SMTP Settings) with the new key.
5. Optionally update your local `.env`.

Supabase-side custom SMTP passwords aren't readable after save, so a leaked key *plus* a missed Supabase update would produce 5xx `smtp_auth_failed` on every auth email — use the Supabase SMTP test button after rotation to confirm both ends match.
