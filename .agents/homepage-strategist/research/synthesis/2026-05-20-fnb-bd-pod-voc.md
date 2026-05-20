# Voice-of-customer synthesis — F&B BD cold-call pod

> Companion research stub for the homepage RFC at
> [`../../proposals/2026-05-20-homepage-rfc-fnb-bd-cold-call-pod-v0.1.md`](../../proposals/2026-05-20-homepage-rfc-fnb-bd-cold-call-pod-v0.1.md).
> Verbatim pulls only. No paraphrasing in §§ 2-4. Synthesis happens in § 5 and is the only place where this file editorializes.

---

## 0. Meta

- **Author:** homepage-strategist (cycle v0.1)
- **Date:** 2026-05-20
- **Persona under study:** [BUYER-PERSONA.md § 5 — F&B / restaurant-tech BD team](../../../../BUYER-PERSONA.md)
- **Adjacent context read:** [`.agents/product-marketing-context.md` § Evidence layer](../../../product-marketing-context.md), [`MARKETING.md`](../../../../MARKETING.md), [`POSITIONING.md`](../../../../POSITIONING.md)
- **Primary evidence base:** FineDine beta cohort, Camden / North London cafes, May 2026. 12 leads audited, 47 candidates pre-audited in roughly 5 minutes (per `.agents/product-marketing-context.md` § Evidence layer). Full transcript at `research/finedine/beta-test-round-2-camden-report.md` is archived out of the workspace per [AGENTS.md](../../../../AGENTS.md). This synthesis works from the BUYER-PERSONA § 5 extract and flags the archive for restoration in § 6.
- **Sample size honesty:** n = 1 named cohort. Quotes labelled "FineDine beta tester transcript, anonymized" in BUYER-PERSONA.md are treated as the canonical voice for this persona at this time. Do not stretch the n.

---

## 1. Persona snapshot (lifted from BUYER-PERSONA.md § 5)

- **Setup:** B2B SaaS BD team selling to restaurants, cafes, bars, hotels. 2 to 10 person business development team at a company like FineDine, Toast, Square for Restaurants, or a regional POS / QR-menu vendor. Reps are part outbound SDR, part account exec, part on-the-ground demo runner.
- **Day in life (verbatim from BUYER-PERSONA § 5):** "8am pull a list of new restaurants opened in the past 30 days. 9-11am manually check each one's website, social, and online ordering setup. 11am-1pm calls with shortlisted prospects. Afternoon: in-person demos at restaurants in the territory. Evening: write up activity in HubSpot."
- **Buying triggers:** manual restaurant research caps each BD rep at 30-40 prospects per day. Existing purchased B2B database has stale data ("this restaurant closed a year ago"). Reply rates on cold email to GMs are under 1% because the messaging is generic.
- **The pivot this RFC turns on:** the BD pod is not an email-first motion. Calls and in-person demos are the closer. Email is the booking layer for the call. Whatever LeadAC ships to this persona needs to feed the dial, not the inbox.

---

## 2. Verbatim quotes (FineDine beta tester transcript, anonymized — via BUYER-PERSONA.md § 5)

Pulled exactly. No paraphrasing in this table.

| # | Quote | Theme | Use on homepage |
|---|---|---|---|
| Q1 | "I'm spending 80% of my time researching, 20% pitching." | Pain — time allocation | ProblemGrid card 1 (recast) |
| Q2 | "I want a list of 50 cafes in Camden that don't have QR ordering today." | Job — fresh, sub-niche shortlist | Hero subhead + PreCallBrief setup |
| Q3 | "The opener has to mention something specific about their setup or it doesn't get read." | Job — call-talkable specificity | PreCallBrief talk-track block |

Hidden in the BUYER-PERSONA framing but inferable from "they call and demo": every quote applies to a call opener at least as much as an email opener. Quote 3 in particular maps to the first thirty seconds of a dial more cleanly than to a subject line.

---

## 3. Verbatim founder lines (lifted from `.agents/product-marketing-context.md` § Three lines the founder uses internally)

| # | Quote | Use on homepage |
|---|---|---|
| F1 | "Your SDR's brain, in software." | Hero headline alternative or final CTA microcopy. Survives across all six personas. |
| F2 | "Lead dossiers ready for your end-of-month pipeline review." | Secondary copy under PreCallBrief or PodControlRoom. Speaks to the BD manager reporting upward. |
| F3 | "For your agency to close 3 more deals a month." | FinalCTA variant. For the BD pod, swap "agency" for "BD pod" and "deals" for "demos booked" if a manager-facing variant is needed. |

These three lines are pre-cleared by the strategist mandate ([01-role-and-mandate.md § How you talk](../../01-role-and-mandate.md)) as preferred lifts. Treat them as quote stock, not as drafted copy.

---

## 4. Verbatim objection language (BUYER-PERSONA.md § 5)

Pull exact. These become FaqBlock entries in the RFC.

| # | Objection verbatim | What's underneath it | FaqBlock target |
|---|---|---|---|
| O1 | "We have HubSpot already." | "I do not need another CRM. Why is this not a duplicate?" | FAQ Q1 — frames LeadAC as the pre-call brief layer, not a CRM. |
| O2 | "Most local restaurants don't reply to cold email anyway." | "Your wedge is the inbox. Mine is the dial." | FAQ Q2 — answers with the dialer-fed positioning. |
| O3 | "Our BD team needs in-person, not more email." | "I am a feet-on-the-street motion. Is this for me?" | FAQ Q3 — answers with the morning queue / dossier framing. |

The wedge for the homepage rewrite is that O2 and O3 are not objections to LeadAC if the positioning is "the brief in front of every dial". They are objections to the current page's email-coded framing.

---

## 5. Synthesis (the only paragraph in this file that editorializes)

The current homepage is coded as an email-first outbound system ([src/app/(marketing)/page.tsx § metadata](../../../../src/app/(marketing)/page.tsx)). For this persona, that is the wrong motion. The job to be done is not "send a better email", it is "walk into the morning queue with a fresh dossier for every restaurant my pod will dial today, with one line in front of the rep that they can open the call with". Quote Q1 caps the time pain at 80%. Quote Q2 specifies the shortlist shape (fresh, sub-niche, geo). Quote Q3 specifies the deliverable shape (one specific thing about their setup). The product already builds this brief. The homepage does not say so.

The wedge for the RFC: every section that today reads as "audit attached to every email" gets reframed as "talk track ready before every dial". The product surfaces are already in place ([CallDisposition enum, prisma/schema.prisma lines 121, 630](../../../../prisma/schema.prisma), [telephony webhook for twilio / aircall / justcall, src/app/api/webhooks/telephony/[provider]/route.ts](../../../../src/app/api/webhooks/telephony/%5Bprovider%5D/route.ts), [DispositionStrip, src/components/app/lead-detail-v2/DispositionStrip.tsx](../../../../src/components/app/lead-detail-v2/DispositionStrip.tsx), [RecentDialContext, src/components/app/lead-detail-v2/RecentDialContext.tsx](../../../../src/components/app/lead-detail-v2/RecentDialContext.tsx), [use-lead-queue, src/lib/lead-detail/use-lead-queue.ts](../../../../src/lib/lead-detail/use-lead-queue.ts)). Engineering does not need to ship anything new for the call story to be credible. The marketing surface needs to catch up to the product surface.

---

## 6. Open evidence questions (carry into RFC § 12)

- [ ] Restore `research/finedine/beta-test-round-2-camden-report.md` from the archive so the synthesis can quote more than three verbatim lines. Owner: founder. Until restored, this file stops at the BUYER-PERSONA § 5 extract.
- [ ] Run one live BD-manager interview at a Camden-class restaurant-tech vendor (FineDine, Toast UK, a regional POS) using [templates/sdr-interview-notes.md](../../templates/sdr-interview-notes.md). Target n = 1 by the next RFC cycle. Quote stock from the current file is enough to ship v0.1.
- [ ] Confirm with engineering which telephony providers in [src/app/api/webhooks/telephony/[provider]/route.ts](../../../../src/app/api/webhooks/telephony/%5Bprovider%5D/route.ts) are wired for production traffic vs scaffolded only. Today's code constant is `["twilio", "aircall", "justcall"]`. The IntegrationsStrip dialer row depends on this answer.

---

## 7. One-line takeaway

> The BD pod's manager does not buy email automation. They buy back the 80% of the rep's morning that today goes to manual restaurant research, and they buy a one-line opener that the rep can read off the screen the moment a GM picks up the phone.
