/**
 * Page-scoped FAQ bank — brand-assets §7.1 Task 3 (FAQPage schema bait).
 * AI Overviews extract these verbatim, so answers are 40–80 words and
 * use the same brand language as the boilerplate.
 *
 * Keyed by page route. Each page imports the matching set + passes it
 * straight to <FaqBlock /> which emits both the markup and the FAQPage
 * JSON-LD.
 */

export type FaqEntry = { question: string; answer: string };

type FaqRoute =
  | "home"
  | "manifesto"
  | "pricing"
  | "demo"
  | "vs-apollo-clay-gong"
  | "vs-apollo"
  | "vs-clay"
  | "vs-gong"
  | "for-field-service"
  | "for-restaurant-tech"
  | "for-dental"
  | "integrations-hubspot"
  | "security"
  | "about";

export const FAQS: Record<FaqRoute, FaqEntry[]> = {
  home: [
    {
      question: "What is LeadAC?",
      answer:
        "LeadAC is operational revenue intelligence for SMB markets — the memory layer that learns what closes in local-business markets and writes the next best action into the HubSpot card your SDR already opens. Built for vertical SaaS GTM teams at $2M to $50M ARR selling into restaurants, field service, dental, beauty, and hospitality.",
    },
    {
      question: "We already use Orbital, Openmart, or Resquared. Do you replace them?",
      answer:
        "No. Orbital, Openmart, and Resquared are upstream data rails — they find the SMB accounts. LeadAC sits one layer above and decides which of those accounts deserve a rep's time this week, why, and what to do next. Bring their exports as CSV or keep them in HubSpot. LeadAC turns their rows into a learning loop on what actually converts in your vertical.",
    },
    {
      question: "We can build this in Clay. Why pay for LeadAC?",
      answer:
        "You can build pieces of it in Clay. Clay is a workbench — flexible, but unopinionated, and it needs a GTM engineer to operate. LeadAC is the finished SMB-vertical brain: vertical signal libraries, source-confidence scoring, rep-ready brief, the next best action, and an outcome loop that learns from every won and lost deal. No GTM engineer required.",
    },
    {
      question: "Is this like Common Room, HockeyStack, or Pocus?",
      answer:
        "Similar direction, different market. Common Room is broad buyer intelligence for PLG and community-led GTM. HockeyStack is enterprise revenue agents and attribution. Pocus prioritises product-usage signals for PLG sales. LeadAC focuses on teams selling into local-business and SMB markets, where the buyer's context lives in websites, reviews, locations, owner activity — not in your product analytics.",
    },
    {
      question: "Is this just lead gen?",
      answer:
        "No. Lead gen gives you rows. LeadAC tells you which rows deserve action, why, what to say, and what the team should learn after the outcome lands. The deliverable is a per-account brief with a recommended next action inside HubSpot, not a CSV. We don't try to be your data source — we make the data sources you already pay for compound into team memory.",
    },
    {
      question: "How is LeadAC different from Gong?",
      answer:
        "Gong is conversation intelligence — it remembers what your team said on calls and emails. LeadAC is operational intelligence — we remember what the account is doing in the world. Gong starts at $100,000 per year for 25 reps and requires 8 weeks of RevOps engineering. LeadAC starts at $1,500 per month for 5 reps and onboards in under an hour.",
    },
    {
      question: "Which CRMs does LeadAC integrate with?",
      answer:
        "HubSpot only, today. The HubSpot OAuth integration writes 12 enriched fields per account into the company record and ingests closed-won and closed-lost outcomes back into the learning loop. Other sources — Apollo, Clay, Orbital, Openmart, Resquared, Salesforce — land via CSV import while native connectors ship. We'd rather promise one connector that works than five that drift.",
    },
    {
      question: "Do you replace our SDRs with an AI SDR?",
      answer:
        "No. LeadAC is not an AI SDR. We do the homework your SDR was doing manually — the account research, the vertical signal lookup, the pre-call brief, the recommended next action — so the human SDR still owns the conversation. The 11x / Artisan / AiSDR pattern of fully autonomous outreach is the opposite of what we build.",
    },
  ],

  manifesto: [
    {
      question: "Why operational intelligence and not conversation intelligence?",
      answer:
        "Operational intelligence indexes what the account is doing in the world — reviews, location count, vertical software stack, owner activity. Conversation intelligence indexes what your team said on calls. Both are valuable. They live on different substrates and serve different buyers. Gong owns conversation intelligence at enterprise. LeadAC owns operational intelligence for vertical SaaS at mid-market.",
    },
    {
      question: "Why a memory layer instead of better lists?",
      answer:
        "Lists are a snapshot. Memory is a system. When your best SDR quits, the lists they built are still there but the pattern that made them work — why a multi-location HVAC group on Housecall Pro converts faster than a single-shop competitor — leaves with them. The memory layer is the system that captures that pattern automatically from every won and lost deal in your CRM.",
    },
    {
      question: "Why vertical SaaS as the only ICP?",
      answer:
        "Horizontal sales tools work for horizontal sales. Vertical SaaS GTM teams selling to local business sit in a gap: Apollo's contact data is shallow on local businesses, Clay requires a GTM engineer, Gong is unaffordable. Roughly 50,000 vertical SaaS companies in the $2M-$50M ARR band live in that gap. LeadAC exists to serve them.",
    },
    {
      question: "How is this not just another AI tool?",
      answer:
        "We never describe LeadAC as 'AI-powered' or 'agentic.' The product uses Gemini for signal extraction and pattern matching — that's a feature, not the product. The product is a closed-loop system that remembers what closes in your vertical. The AI inside is the same AI everyone has access to; the data substrate and the closed-loop CRM ingestion are what's hard to replicate.",
    },
    {
      question: "What do you not do?",
      answer:
        "We don't write your emails. We don't replace your SDRs. We don't sell call recording or forecasting. We don't sell to enterprise teams with dedicated RevOps engineers and Salesforce + Gong already in place. We don't do programmatic SEO city-spam pages. We don't promise 10x. We don't bid on the keyword 'AI SDR.'",
    },
  ],

  pricing: [
    {
      question: "Is there a free trial?",
      answer:
        "No free trial. The pilot tier is $500 per month for 30 days — small enough to be a no-friction yes for a VP Sales, large enough to filter out browsers. We're sales-led; we attract operators who already know they have the pain.",
    },
    {
      question: "Can I cancel anytime?",
      answer:
        "Yes. No annual contract on any tier. Cancel via the billing portal or by emailing your success contact; data export is available for 30 days after cancellation, then deleted per our retention policy.",
    },
    {
      question: "What's included in the pilot?",
      answer:
        "500 enriched local accounts, one vertical pack (Field service, Restaurant tech, or Dental), HubSpot OAuth integration with 12 fields per account, one SDR seat, closed-loop ICP refinement, and a live onboarding call. The pilot runs 30 days. About 70% of pilot teams move to the Team plan at the end.",
    },
    {
      question: "How does the Team plan compare to a Gong contract?",
      answer:
        "The Team plan is $1,500 per month — $18,000 per year — with no annual contract and no onboarding services SOW. The mid-market Gong Foundation tier with the smallest customer profile runs roughly $22,000 in year one (platform + licenses + onboarding) and that's conversation intelligence only, with no Revenue Graph. Same money, different primitive.",
    },
    {
      question: "Do you charge per seat or per account?",
      answer:
        "Seats are bundled in each tier (1 for Pilot, 5 for Team, 15 for Growth). Account enrichment is metered: Pilot 500/month, Team 5,000/month, Growth 20,000/month. We never charge per email sent. Smartlead, Instantly, and Apollo sequencing all stay on their own billing.",
    },
    {
      question: "Why no per-seat pricing for the SDR add-on?",
      answer:
        "Vertical SaaS teams scale SDRs in batches of 3 to 5, not one at a time. Per-seat billing creates the wrong incentive — managers under-provision seats to control budget, and the team that needs the memory layer most ends up sharing logins. The tier shape matches how vertical SaaS teams actually hire.",
    },
  ],

  demo: [
    {
      question: "How long is the demo?",
      answer:
        "Twenty minutes. We walk through one of your own actual prospect accounts — you paste a website URL on the call, we run LeadAC live, and you see the brief that would land in your HubSpot card before your SDR dials. No slideware.",
    },
    {
      question: "Do I need to install anything before the call?",
      answer:
        "No. The walkthrough runs in our environment. If you want the brief written into your CRM live, connect HubSpot via OAuth on the call (read-only) and we'll show you the field mapping.",
    },
    {
      question: "What happens after the demo?",
      answer:
        "If LeadAC fits, you start the pilot the same week — $500 for 30 days, 500 accounts, one vertical pack, your real CRM. If it doesn't fit, we say so on the call and point you to whichever tool does. We pass on more deals than we close because we'd rather lose a deal than ship a bad fit.",
    },
  ],

  "vs-apollo-clay-gong": [
    {
      question: "Why not just keep using Apollo + Clay + Gong + Smartlead?",
      answer:
        "You can. About 70% of vertical SaaS GTM teams do, and the stack works for individual jobs. What it doesn't do is learn — none of those tools ingest your won and lost deal outcomes back into the next list. Adding LeadAC at $1,500 per month replaces zero of those tools and adds the memory layer that ties them together.",
    },
    {
      question: "What does the stack cost together?",
      answer:
        "A typical 5-seat vertical SaaS GTM team running Apollo Professional ($1,392/yr), Clay Growth ($5,352/yr), Smartlead Pro ($468/yr), and a Gong Foundation pilot ($22,000+ in year one) lands around $29,212 in stack cost — and gets no closed-loop learning. LeadAC Team at $18,000/yr replaces the missing memory layer and doesn't ask you to switch the rest of the stack.",
    },
    {
      question: "Can I replace Apollo with LeadAC?",
      answer:
        "No. Apollo is a contact database with 230M records — we don't replace that primitive. LeadAC indexes operational signals on local business accounts; Apollo indexes desk-worker contact data. Most LeadAC customers keep Apollo for the contact list and use LeadAC for the per-account brief that turns the Apollo list into a working SDR motion.",
    },
    {
      question: "Can I replace Clay with LeadAC?",
      answer:
        "Often, yes — if you don't have a GTM engineer. Clay is powerful and flexible; if you can hire the engineer to operate it, keep it. Without that engineer, Clay sits unused or burns credits. LeadAC's vertical packs are the finished version of the workflows most teams want to build in Clay.",
    },
  ],

  "vs-apollo": [
    {
      question: "Is Apollo's data wrong for vertical SaaS?",
      answer:
        "Apollo's data is right for B2B SaaS selling to other B2B SaaS, where the buyer has a LinkedIn profile and a Crunchbase entry. For vertical SaaS selling to local business — restaurants, HVAC operators, dental practices — Apollo's coverage is thin and the bounce rate runs 12 to 14 percent without third-party verification add-ons.",
    },
    {
      question: "Will LeadAC break my Apollo workflow?",
      answer:
        "No. LeadAC reads from HubSpot, not Apollo. You keep your Apollo workflow; LeadAC enriches the Apollo-sourced contacts with operational signals — location count, vertical software stack, owner activity — and writes those fields into the HubSpot company record so your SDR sees them before the dial.",
    },
    {
      question: "How is LeadAC's discovery different from Apollo's?",
      answer:
        "Apollo's discovery is firmographic — industry code, employee count, tech stack from LinkedIn. LeadAC's discovery is operational — location count from Google Business Profile, vertical software signature from the website footer, review tone from public reviews, owner activity from recent posts. Apollo answers 'is this a restaurant?'. LeadAC answers 'is this a Toast-on-Resy multi-location restaurant in expansion mode?'.",
    },
  ],

  "vs-clay": [
    {
      question: "When is Clay overkill?",
      answer:
        "When you don't have a GTM engineer, when you send fewer than 10,000 emails per month, when your verticals are stable, or when you keep losing your Clay workflows to credit overruns. SalesEcho's 2026 review names this directly: 'Clay is amazing at scale, but if you send fewer than 10k emails per month, it may not be worth the credits.'",
    },
    {
      question: "Can LeadAC do everything Clay does?",
      answer:
        "No. Clay is a programmable workflow runtime with 150+ enrichment providers and freeform workflow logic. LeadAC is a finished product with three vertical packs (Field service, Restaurant tech, Dental). If your vertical falls inside one of those packs, LeadAC is the faster path. If you need a completely custom workflow with 12 enrichment hops and conditional logic, Clay is the right tool.",
    },
    {
      question: "Is LeadAC built on top of Clay?",
      answer:
        "No. LeadAC is its own data substrate — Playwright-based signal extraction, Gemini-based pattern matching, pgvector-backed semantic memory, HubSpot OAuth integration. Clay would not have been the right primitive for the closed-loop CRM ingestion that defines our category.",
    },
  ],

  "vs-gong": [
    {
      question: "How is LeadAC different from Gong Revenue Graph?",
      answer:
        "Gong's Revenue Graph indexes what your team said — calls, emails, meeting transcripts. LeadAC's memory layer indexes what the account is doing — reviews, location count, vertical software stack, owner activity. Same word ('memory'), different substrate. Same buyer ('VP Sales'), different price band ($100K vs $18K per year) and different surface (Gong app vs HubSpot card).",
    },
    {
      question: "Why can't we just use Gong?",
      answer:
        "Gong's own product page disqualifies teams under 25 reps, teams without a RevOps engineer, and teams that want monthly billing. Mid-market vertical SaaS GTM ($2M to $50M ARR, 5 to 30 sellers) hits all three disqualifiers. Even the Gong Foundation tier requires a 2-year prepay and 8 weeks of onboarding services that most vertical SaaS teams can't afford to wait for.",
    },
    {
      question: "Do you compete with Gong for customers?",
      answer:
        "No. Gong serves roughly 5,000 enterprise customers globally. We serve the 50,000+ vertical SaaS companies that Gong's economics excludes by design. We are not competing for the same customer — we're serving the 10x larger TAM that Gong's price floor leaves open.",
    },
    {
      question: "What if Gong launches a sub-$30K/yr tier?",
      answer:
        "We watch for that announcement quarterly. If it happens, our four asymmetries still hold: different data substrate (operational vs conversation), CRM-native surface (HubSpot card vs Gong app), vertical-pack depth, and 1-hour onboarding vs 8 weeks. Gong launching downmarket would validate the memory thesis and push us to publish our depth differentiation more loudly — it would not change the product.",
    },
  ],

  "for-field-service": [
    {
      question: "Which field service software vendors do you support?",
      answer:
        "On day one we index ServiceTitan, Jobber, Housecall Pro, and FieldEdge as installed-software signals. We can add additional vendors (Workiz, Service Fusion, ServiceTrade, mHelpDesk, Salesforce Field Service) on request — typically within 2 weeks of customer ask.",
    },
    {
      question: "How do you handle multi-location HVAC chains?",
      answer:
        "Each Google Business Profile gets indexed separately, then linked via shared owner email, NPI registry, or recent acquisition press release. The HubSpot company record carries a location_count field plus a list of per-location signals — so the SDR sees 'three locations, all on ServiceTitan, two added in the last 12 months' before dialing the parent operator.",
    },
    {
      question: "What signals matter most for HVAC software outbound?",
      answer:
        "In order of impact: (1) installed dispatch software signature, (2) multi-location operator with expansion in last 90 days, (3) hiring signal (HVAC technician job posting), (4) seasonal capacity signal (review velocity in last 30 days vs prior 90 days), (5) owner-operator activity on Google Business. The vertical pack weights these automatically; you can override per-account.",
    },
  ],

  "for-restaurant-tech": [
    {
      question: "Which restaurant tech vendors do you support?",
      answer:
        "On day one: Toast, OpenTable (full and Lite), Resy, Square for Restaurants, Yelp Guest Manager. We're adding SevenRooms, Tock, and Lightspeed on customer request. Each one is indexed as a footer signal, a script signal, and a hosted-subdomain signal so we catch both branded and white-label installs.",
    },
    {
      question: "Can you spot a restaurant in migration mode?",
      answer:
        "Yes — that's the signal most vertical SaaS teams optimize for. A restaurant running OpenTable Lite (the entry-level tier without enterprise features) on a multi-location group is a typical migration target for full OpenTable, Toast, or Resy. The brief calls this out as a 'migration candidate' tag with the current install + the upgrade path.",
    },
    {
      question: "How do you handle non-English markets?",
      answer:
        "Today the signal libraries are tuned to North American restaurant tech (Toast, OpenTable, Resy, Square). UK, Australia, Türkiye coverage ships in Q3 2026. For Türkiye specifically, FineDine is a design partner so we'll have native local-stack signals (FineDine, Petpooja, Restoran365) before launch.",
    },
  ],

  "for-dental": [
    {
      question: "Which dental practice management systems do you index?",
      answer:
        "Dentrix, Eaglesoft, Open Dental, Curve Dental on day one. Additional systems (CareStack, Denticon, Practice-Web, easyDental) ship with the Q3 2026 dental signal-pack v2 release. Each install is detected via patient portal subdomain, embedded form script, and the practice's NPI registry footprint.",
    },
    {
      question: "How does multi-location DSO targeting work?",
      answer:
        "We link practices to a DSO (Dental Service Organization) parent via shared owner email, NPI registry, recent acquisition press, or shared website domain. The brief surfaces 'parent DSO + total location count + recent acquisitions' so the SDR knows whether they're talking to a single practice or to the corporate office that signs the contract.",
    },
  ],

  "integrations-hubspot": [
    {
      question: "How long does the HubSpot integration take to set up?",
      answer:
        "Under 30 minutes. OAuth flow with your HubSpot admin account, pick the company and contact properties you want LeadAC to write to (we propose a 12-field default map), pick which deal stages trigger the closed-loop ingestion (we default to closed-won and closed-lost). First 200 accounts land in HubSpot in under an hour.",
    },
    {
      question: "What HubSpot fields does LeadAC write?",
      answer:
        "Twelve company-record fields: location_count, vertical_stack_signature, review_tone, owner_activity_score, expansion_signal_date, multi_location_flag, dso_parent (where applicable), and five vertical-specific signal fields that depend on your vertical pack. All custom property values prefixed with leadac_ so there's no collision with your own properties.",
    },
    {
      question: "Does LeadAC modify our contact lists or sequences?",
      answer:
        "No. LeadAC only writes to company-record and contact-record property fields. We never modify your lists, sequences, workflows, or pipelines. The SDR sees the LeadAC brief inside the HubSpot card view; they choose what to do with it.",
    },
    {
      question: "What permissions does the HubSpot OAuth scope request?",
      answer:
        "Read access to contacts, companies, and deals (for the closed-loop ingestion). Write access to contact and company custom properties only — no write access to lists, sequences, workflows, or pipelines. Full scope is listed on the install screen before you click Authorize.",
    },
  ],

  security: [
    {
      question: "Is LeadAC SOC 2 Type II certified?",
      answer:
        "SOC 2 Type II is in progress. Target completion is Q3 2026. Until then we run on a SOC 2 Type II compliant infrastructure provider (AWS) and follow the same internal controls — we just don't yet have the third-party audit report. The Trust page tracks the audit progress in real time.",
    },
    {
      question: "Where is customer data stored?",
      answer:
        "US (us-east-1) by default. EU residency (eu-west-1) and UK residency available on the Enterprise tier. Customer-content data is encrypted at rest with AWS KMS and in transit with TLS 1.3. We never store HubSpot OAuth refresh tokens in plaintext — they're encrypted with a per-customer KMS key.",
    },
    {
      question: "Do you train your AI models on customer data?",
      answer:
        "No. Customer CRM data is never used to train our Gemini-based pattern-matching models. The closed-loop ICP refinement runs per-workspace — your won and lost deal outcomes sharpen your next list, not anyone else's. Cross-workspace inference is impossible by construction; the workspace_id is enforced at the database row level.",
    },
    {
      question: "What's your data retention policy?",
      answer:
        "Active account data is retained for the life of the subscription plus 30 days after cancellation (for export). After 30 days post-cancellation, data is deleted. Logs and audit trails are retained for 12 months. We comply with GDPR right-to-deletion requests within 30 days of request.",
    },
  ],

  about: [
    {
      question: "Who built LeadAC?",
      answer:
        "LeadAC was founded in 2026 by a small team that previously worked on outbound at vertical SaaS companies. We're based in London, with team members in Istanbul and the US. The founding team is intentionally small — we'd rather ship one vertical pack well than three vertical packs poorly.",
    },
    {
      question: "Is LeadAC venture-backed?",
      answer:
        "We've taken a small pre-seed round to ship the first three vertical packs (Field service, Restaurant tech, Dental) and the HubSpot integration. We're not optimizing for the next round — we're optimizing for the first 50 paying customers in vertical SaaS GTM.",
    },
    {
      question: "What's on the roadmap?",
      answer:
        "Through Q3 2026: Beauty and wellness vertical pack, Salesforce integration, SOC 2 Type II report, EU and UK data residency. Through Q4 2026: legal practice software vertical pack, embedded HubSpot widget (the 'Powered by LeadAC' pre-call brief that lives inside the HubSpot contact card UI), and an annual vertical SaaS GTM benchmark report.",
    },
  ],
};
