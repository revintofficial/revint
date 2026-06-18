# hubspot-app/ — Revint HubSpot Public App

This directory is the **HubSpot Projects** artifact for Revint's public app. It is separate from the Next.js `src/` (which is the **backend** that the App Card calls via `hubspot.fetch()`). Both are versioned together so a deploy that ships a new card-data contract can ship the matching card in lock-step.

> **Why it lives here** — HubSpot's new Developer Platform (versions `2025.2` / `2026.03`) requires the App Card to be a React UI Extension defined as code under a Projects directory and pushed with `hs project upload`. The Card cannot be configured through the legacy CRM Extensions UI any more. Legacy CRM Cards are deprecated **31 Oct 2026** — after that date they stop rendering.

## Layout

```
hubspot-app/
├── hsproject.json                          # Platform version + src dir
├── src/
│   └── app/
│       ├── app-hsmeta.json                 # Public app config (auth, scopes, permittedUrls)
│       ├── webhooks/
│       │   └── webhooks-hsmeta.json        # Webhook subscriptions → /api/webhooks/hubspot
│       └── extensions/
│           └── revint-card/
│               ├── revint-card-hsmeta.json # Card placement (CRM record tab + preview)
│               ├── RevintCard.tsx          # React component (hubspot.extend + hubspot.fetch)
│               └── package.json            # @hubspot/ui-extensions dependency
```

## Hard constraints on the App Card backend

The Card calls `hubspot.fetch('/api/integrations/hubspot/card-data', …)` against the Revint Next.js app. HubSpot enforces:

- **15 s default timeout** (configurable up to 120 s with `timeout` in the fetch call).
- **1 MB** request and response payload limit each.
- **20 concurrent** `hubspot.fetch` requests per installed portal.
- Only `Authorization` is an allowed request header. No custom headers.
- HubSpot signs every request with a v3 signature — the backend MUST verify it before returning data. See `src/lib/integrations/hubspot/card-signature.ts`.

The `card-data` endpoint MUST stay light: no heavy AI calls, no cross-tenant queries, no large evidence dumps. It reads the canonical `revint_*` denormalised fields off the Lead and the Qualification row.

## Local development

1. Install the HubSpot CLI globally:
   ```bash
   npm install -g @hubspot/cli@latest
   ```
2. Authenticate against the Revint developer account (not a customer portal):
   ```bash
   hs account auth
   ```
3. Install the extension dependencies (HubSpot CLI does this implicitly on first build, but doing it once now is faster):
   ```bash
   cd hubspot-app/src/app/extensions/revint-card
   npm install
   cd ../../../..
   ```
4. Start the local dev server with hot reload (changes to `RevintCard.tsx` reflect inside HubSpot without a re-upload):
   ```bash
   hs project dev
   ```
5. Pick a developer **test account** when prompted (NOT a customer portal). HubSpot will sandbox the card so it's visible only to that test account.

## Deploy

```bash
hs project upload
```

This bundles the project, validates `*-hsmeta.json` schemas against the platform version, and creates a new build in the developer account. The build then has to be **promoted** to the public app in the HubSpot Developer UI. Marketplace certification is a separate gate.

## Cutover from the legacy CRM Card

The legacy CRM Card lives at `src/app/api/integrations/hubspot/card/route.ts` and uses the deprecated `{ results: [...] }` contract + v1 signature. The kept-during-cutover migration steps are:

1. Upload the new App Card with `hs project upload`. End users keep seeing the legacy card.
2. Verify the new card renders in a developer test account.
3. Swap legacy → app card across all installed portals **without user disruption** via the migration endpoint:
   ```http
   POST /crm/v3/extensions/cards-dev/{appId}/views/migrate
   {
     "legacyCrmCardId": "...",
     "appCardIds": ["..."]
   }
   ```
   The legacy card stays in the backend until 31 Oct 2026 but is hidden from end users (the new App Card takes the same placement).
4. After all customers report green, delete the legacy card and remove `src/app/api/integrations/hubspot/card/route.ts` from the Next.js repo.

If the app is **listed on the marketplace**, delete the `hs-release-app-cards` feature flag in the Developer UI **before** calling the migration endpoint; the endpoint refuses to swap while the flag is set.

## What this artifact does NOT contain

- OAuth implementation — that lives in the Next.js backend (`src/lib/integrations/hubspot/oauth.ts`). The redirect URL is registered in `app-hsmeta.json` and configured in HubSpot's Developer UI.
- Property provisioning — done from the backend on connect (`src/lib/integrations/hubspot/properties.ts`). HubSpot Projects can declare custom properties as code, but we keep that logic centralised in the backend so existing portals stay in sync without a re-upload.
- Card data — `RevintCard.tsx` is a thin presentational shell. All decision logic lives in the Next.js card-data endpoint.
