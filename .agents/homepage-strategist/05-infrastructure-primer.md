# 05 — Infrastructure primer

The strategist does not write code, but the strategist does write proposals that engineers have to ship. This file tells you what is cheap, what is expensive, and what is forbidden in this codebase. Read it before you spec a new section or block. An RFC that proposes something forbidden gets sent back; an RFC that picks the cheap path lands faster.

This is a compressed map. The full rules live in `.cursor/rules/*.mdc` and load automatically when an engineer is editing the relevant files. You do not have to memorize all of them. You do have to know enough to flag the constraint in your RFCs.

---

## 1. The two pages you own — anatomy

### Homepage

Entry: [`src/app/(marketing)/page.tsx`](../../src/app/(marketing)/page.tsx).

Composition only. Every section is its own self-contained component under [`src/components/marketing/v2/`](../../src/components/marketing/v2):

| Section | File |
|---|---|
| Hero | [`src/components/marketing/v2/hero.tsx`](../../src/components/marketing/v2/hero.tsx) |
| ProblemGrid | [`src/components/marketing/v2/problem-grid.tsx`](../../src/components/marketing/v2/problem-grid.tsx) |
| HowItThinks | [`src/components/marketing/v2/how-it-thinks.tsx`](../../src/components/marketing/v2/how-it-thinks.tsx) |
| UnderstandsGrid | [`src/components/marketing/v2/understands-grid.tsx`](../../src/components/marketing/v2/understands-grid.tsx) |
| IntelligenceLoop | [`src/components/marketing/v2/intelligence-loop.tsx`](../../src/components/marketing/v2/intelligence-loop.tsx) |
| DossierProof | [`src/components/marketing/v2/dossier-proof.tsx`](../../src/components/marketing/v2/dossier-proof.tsx) |
| BuiltFor | [`src/components/marketing/v2/built-for.tsx`](../../src/components/marketing/v2/built-for.tsx) |
| IntegrationsStrip | [`src/components/marketing/v2/integrations-strip.tsx`](../../src/components/marketing/v2/integrations-strip.tsx) |
| WaitlistBlock | [`src/components/marketing/v2/waitlist-block.tsx`](../../src/components/marketing/v2/waitlist-block.tsx) |
| FaqBlock | [`src/components/marketing/v2/faq-block.tsx`](../../src/components/marketing/v2/faq-block.tsx) |
| FinalCta | [`src/components/marketing/v2/final-cta.tsx`](../../src/components/marketing/v2/final-cta.tsx) |
| Section wrapper | [`src/components/marketing/v2/section.tsx`](../../src/components/marketing/v2/section.tsx) |
| LeadDetailBento | [`src/components/marketing/v2/lead-detail-bento.tsx`](../../src/components/marketing/v2/lead-detail-bento.tsx) |
| WaitlistForm | [`src/components/marketing/v2/waitlist-form.tsx`](../../src/components/marketing/v2/waitlist-form.tsx) |

Conventions:
- Server components by default. Add `"use client"` only when you need state, effects, motion, or browser APIs.
- The page is intentionally thin so section order and metadata stay easy to reason about.
- No interactive widgets in the hero. No scroll-stages. No hero parallax. Static stills + CSS-only motion. (This is a deliberate choice — see the file-header comment in [`src/app/(marketing)/page.tsx`](../../src/app/(marketing)/page.tsx).)
- Pricing is deliberately NOT exposed on the homepage during pre-launch. The waitlist block stands in.

What this means for your RFC: a new section means a new file in the `v2/` folder following the same pattern. Composition is cheap; new patterns are expensive.

### Lead detail

Entry: [`src/app/app/leads/[id]/page.tsx`](../../src/app/app/leads/[id]/page.tsx).

The route is a thin server-component wrapper that picks legacy vs v2 based on a feature flag ([`src/lib/feature-flags.ts`](../../src/lib/feature-flags.ts) → `isLeadDetailV2Enabled`). The legacy 5-tab surface lives at [`src/components/app/leads/LegacyLeadDetailClient.tsx`](../../src/components/app/leads/LegacyLeadDetailClient.tsx); the v2 surface at [`src/components/app/lead-detail-v2/LeadDetailV2Client.tsx`](../../src/components/app/lead-detail-v2/LeadDetailV2Client.tsx).

The v2 surface is the future. Your RFCs target v2. The legacy surface stays for rollback; do not propose changes to it.

V2 block inventory (in [`src/components/app/lead-detail-v2/`](../../src/components/app/lead-detail-v2)):

- **Shell / sticky scaffold**: `LeadDetailV2Client`, `StickyShell`, `HeaderBar`, `MobileStickyCTA`, `VoiceNoteFAB`, `UpdatedToast`, `PreliminaryBanner`, `Block` (the standard wrapper).
- **Identity & header**: `HeaderBar`, `CompactIdentityCard`, `PipelineStageChip`, `DispositionStrip`, `QueueStrip`.
- **Why now / what to do**: `WhyNowBlock`, `NextGestureBlock`, `RecommendedApproach`, `FourThingsCard`, `SalesTalkingPoints`, `PredictedVsRealObjections`.
- **Audit signals**: `WebsiteSignalStrip`, `WebsiteIntelLazyPanel`, `IntelligenceBriefCard`, `EvidenceChip`, `ClaimWithEvidence`.
- **Qualification frames**: `SpinBoard` (SPIN), `MeddpiccChecklist` (MEDDPICC), `BantBars` (BANT), `IcpDimensionBars`, `QualificationBlock`.
- **People & accounts**: `WhoBlock`, `StakeholderCard`, `StakeholderOnlinePresence`, `AccountBlock`, `AccountMapMini`, `RecentDialContext`.
- **Discovery & history**: `DiscoveryBlock`, `HistoryBlock`.
- **Reviews intelligence**: `ReviewTimelineMini`, `ReviewVelocityBadge`, `ReviewIntelligenceSummary`.
- **Cross-lead context**: `SisterLeadRow`, `ClosestWinCallout`, `CrossBranchInsightCallout`.
- **Lockouts / power tools**: `PlanLockedBlock`, `PowerToolsLink`, `SubNicheOverrideMenu`.
- **Telemetry**: `LegacyWorkersBeacon`.

Standard patterns you should reuse rather than invent:
- `Block` is the standard card wrapper. Use it.
- `EvidenceChip` + `ClaimWithEvidence` is how claims surface their source. Any new claim you propose should ride this pattern, not invent a new one.
- `StickyShell` handles the sticky header behavior on the v2 surface. Do not propose a parallel sticky.
- `MobileStickyCTA` handles the primary mobile action. Same — extend, do not duplicate.
- `PreliminaryBanner` handles the "data is loading; here's what we know so far" state. Reuse for any new progressive-render block.

What this means for your RFC: information architecture changes and copy changes are cheap. New block types are medium. New data fields are expensive (Prisma schema change + multi-tenant audit + Gemini call possibly). Always identify which bucket your proposal falls into.

---

## 2. Design tokens — DO NOT hardcode

Single source: [`src/app/globals.css`](../../src/app/globals.css).

Four "knobs" re-skin the entire product:

```css
--leadac-h:   38;   /* hue 0–360 */
--leadac-s:   78%;  /* saturation */
--leadac-ns:  7%;   /* neutral surface saturation */
--leadac-nts: 10%;  /* neutral text saturation */
```

Everything derives from those. The full token taxonomy:
- Primary scale: `--leadac-100` ... `--leadac-900`.
- Surfaces: `--leadac-bg`, `--leadac-surface`, `--leadac-card`, `--leadac-hover`, `--leadac-border`.
- Text: `--leadac-text-1` (primary), `--leadac-text-2` (secondary), `--leadac-text-3`, `--leadac-muted`.
- Semantic: `--leadac-success`, `--leadac-warning`, `--leadac-error`, `--leadac-info`.
- Glow: `--leadac-glow-soft/medium/strong`.
- Legacy iOS-style names: `--system-blue/green/orange/red/purple/teal/yellow`.
- Cinematic palette (marketing cine surfaces only): `--cine-ink`, `--cine-cream`, `--cine-ochre`, `--cine-terra`, `--cine-indigo`, `--cine-border`, `--cine-gutter`, `--cine-max`.

What this means for your RFC: copy that references colors must reference token names, not hex values. "Use `--leadac-success` for the green confirm chip" is correct; "use `#22c55e` for the green confirm chip" is wrong.

---

## 3. Plan tiers and gating

Source of truth: [`src/lib/plans.ts`](../../src/lib/plans.ts).

Current tiers:

| Tier | Display | Monthly USD | Seats | Leads/mo | Mockups/mo |
|---|---|---|---|---|---|
| FREE | (sunset) | $0 | 1 | 50 | 3 |
| PRO | Solo | $79 | 1 | 1,000 | 50 |
| PRO_TEAM | Studio | $149 | 3 | 2,500 | 150 |
| AGENCY | Agency+ | $249 | 5 | 5,000 | 300 |

GBP pricing exists: £59 / £99 / £199.

Annual: 20% off effective monthly rate.

**FREE is sunsetting.** See [`docs/decisions/free-plan-sunset.md`](../../docs/decisions/free-plan-sunset.md). Until the trial-flow ships, the `MARKETING_COMING_SOON` flag keeps "Launching soon" CTAs visible.

What this means for your RFC:
- Do not promise a free plan in homepage copy.
- Do not write "no credit card" or "50 free leads" or "start free" anywhere.
- Use "14-day trial · cancel any time" instead.
- Tier-gated features on the lead-detail (see `PlanLockedBlock`) should reference tier *display names* (Solo, Studio, Agency+), not tier enum values (PRO, PRO_TEAM, AGENCY).

---

## 4. Feature flags

File: [`src/lib/feature-flags.ts`](../../src/lib/feature-flags.ts).

This is how new lead-detail blocks ship safely. The v2 surface itself is flag-gated (`isLeadDetailV2Enabled`). Any new block your RFC proposes should follow the same pattern:

1. Ship behind a flag (defaults to off).
2. Roll out: Shadow (instrumented, not visible) → Canary 10% → 50% → Full → flag removal.
3. Each rollout step gets a checkpoint with the success metric.

What this means for your RFC:
- Lead-detail RFC § feature flag rollout plan is required. Use the template.
- Homepage RFC usually does not need a flag — section changes ship via deploy. But if you propose a behavior change (e.g., a new modal or a new CTA gate), flag it.

---

## 5. Multi-tenant scope — non-negotiable

Full rules: [`.cursor/rules/multi-tenant-scope.mdc`](../../.cursor/rules/multi-tenant-scope.mdc). The two facts you need:

1. Every Prisma query that touches workspace-owned data MUST be scoped by `workspaceId`. Cross-tenant data leak is the highest-severity bug class in this product.
2. The trusted source of `workspaceId` is `requireUser()` from [`src/lib/auth.ts`](../../src/lib/auth.ts). The cookie is `leadac_active_workspace_id` (`ACTIVE_WORKSPACE_COOKIE`).

What this means for your RFC:
- A lead-detail proposal that suggests showing "neighbors", "sister leads", "industry comps", "similar accounts", or any cross-row read must explicitly state in the RFC how the cross-row read stays inside `workspaceId`.
- The existing `SisterLeadRow` and `CrossBranchInsightCallout` are designed around this. Reuse them or extend their pattern; do not invent a parallel mechanism.
- The standard answer for "I want this related data" is "scope the query by `workspaceId` on the parent and let the relation traverse naturally". If your proposal cannot, write the question into the RFC as an open question for engineering.

---

## 6. AI / Gemini / workers — what is cheap vs expensive

Worker registry: [`src/lib/agent-workers/`](../../src/lib/agent-workers). AI Core: [`src/lib/ai-core/`](../../src/lib/ai-core). BullMQ workers: [`src/workers/`](../../src/workers).

Rules:
- **No new BullMQ queues.** Extend the existing `agent-runs` queue (discriminated `type` field) or AI Core chains.
- **No new Gemini-calling endpoint** outside of `src/lib/agent-workers/` or `src/lib/ai-core/router.ts`. Every Gemini call must be wrapped as a worker module.
- **No direct `prisma.semanticMemory.*`.** Read/write only via [`src/lib/ai-core/memory.ts`](../../src/lib/ai-core/memory.ts).
- **Prisma client import path** is `@/generated/prisma/client`, never `@prisma/client`.

What this means for your RFC:
- "Add a Gemini-generated summary at the top of the page" is medium-cost (new worker module + chain + prompt + cost-of-tokens consideration).
- "Reuse the existing audit summary in a new layout" is cheap.
- "Add a real-time Gemini chat that streams to the user" is expensive (chains, streaming infra, token cost, latency budget).
- Flag the cost in the RFC. Reviewers will help you size it.

---

## 7. i18n state

Config: [`src/lib/i18n/config.ts`](../../src/lib/i18n/config.ts). Currently `["en"]` only.

Turkish marketing copy exists in scratch form (see [`tr-en-marketing-sync` skill](../../C:/Users/meert/.cursor/skills/tr-en-marketing-sync/SKILL.md)) but routes are not enabled. Do not propose `/tr` routes or TR copy until the i18n flip is approved.

What this means for your RFC: English only in homepage / lead-detail RFCs. Localize later when the system is ready.

---

## 8. Telemetry and events

The lead-detail v2 surface has a typed event catalog. Events use [`src/lib/lead-detail/telemetry.ts`](../../src/lib/lead-detail/telemetry.ts) (per the Truth Layer agent-dispatch protocol in [`.cursor/agents/CONTRIBUTING.md`](../../.cursor/agents/CONTRIBUTING.md)). The naming convention is `lead_detail.*` for lead-detail events; existing `truth.*` events for the Truth Layer rollout.

What this means for your RFC:
- Lead-detail RFC § telemetry events to emit is required. Use existing event names where possible.
- New events go into the typed catalog. If you propose a new event, name it in the RFC and tag the engineering owner so they can add it to the catalog.
- Do not invent a new namespace. `lead_detail.<surface>.<action>` is the convention.

---

## 9. Next.js 16 specifics (so your RFCs don't accidentally violate)

Full rules: [`.cursor/rules/nextjs-16.mdc`](../../.cursor/rules/nextjs-16.mdc). The two facts you need:

1. `cookies()`, `headers()`, `params`, `searchParams` are all Promises. They get awaited. Engineers will handle it; you do not need to. Just do not propose copy that depends on a synchronous-looking flow.
2. Server components are the default. Add `"use client"` only when needed. This means any new section/block default ships server-rendered, which is fast and SEO-friendly.

---

## 10. SEO and metadata

Helper: [`src/lib/seo/metadata.ts`](../../src/lib/seo/metadata.ts) (`buildMetadata`). The homepage uses it ([`src/app/(marketing)/page.tsx`](../../src/app/(marketing)/page.tsx) lines 29-46).

What this means for your RFC:
- Homepage RFC § SEO/metadata changes is required. Spec the title (under 50 chars), the description (155-160 chars), and the keyword list.
- Do not put "AI agent", "AI cold email", or any banned phrase in the keyword set.
- Reference the `seo-public-pages` skill if your RFC touches structured data or sitemap.

---

## 11. The cost ladder — sort your proposals into one of these buckets

When you flag a proposal in an RFC, classify it on this ladder. Engineers expect this.

| Cost | What qualifies | Example |
|---|---|---|
| **Trivial** | Copy change, image swap, token swap, link change | Hero subhead rewrite |
| **Small** | New section using existing component patterns, or new block reusing existing blocks | Adding a logo wall section to the homepage |
| **Medium** | New component pattern, new section type, lead-detail block with new data shape | A "playbook of the week" block on the homepage |
| **Large** | New data field (Prisma schema delta), new Gemini call, new worker module | Adding a "stakeholder sentiment" score that requires a new audit step |
| **Forbidden** | New BullMQ queue, new Gemini-calling endpoint outside agent-workers, direct `prisma.semanticMemory.*` write, schema change without multi-tenant scope | Anything that ignores section 5 and 6 of this file |

What this means for your RFC: every proposal carries its cost label inline. Reviewers can then triage by cost × value without re-reading the whole RFC.

Next file: [`06-weekly-operating-rhythm.md`](./06-weekly-operating-rhythm.md).
