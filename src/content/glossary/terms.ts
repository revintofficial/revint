/**
 * Glossary terms — one-screen definition pages for sales, outbound, and SEO
 * vocabulary relevant to Revint users. Each term renders at /glossary/{slug}
 * with DefinedTerm JSON-LD.
 *
 * Keep definitions short (60-180 words), write them as answer-engine-ready
 * one-sentence direct answers followed by expansion.
 */

export type GlossaryTerm = {
  slug: string;
  name: string;
  /** 60-130 char meta description; may differ from the definition's lead. */
  meta: string;
  /** One-sentence direct answer used at the top of the page + in AEO blocks. */
  oneSentence: string;
  /** Full definition paragraph(s) — supports simple line breaks. */
  body: string;
  /** Related term slugs for cross-linking. */
  related?: string[];
  /** Category label for the index page. */
  category:
    | "outbound"
    | "sales"
    | "marketing"
    | "seo"
    | "leadac"
    | "data"
    | "email";
};

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    slug: "cold-email",
    name: "Cold email",
    category: "outbound",
    meta: "Cold email is unsolicited outbound email sent to a prospect who has not explicitly opted in. Definition, legal nuance, and how it differs from spam.",
    oneSentence:
      "Cold email is a one-to-one business email sent to a prospect who has not opted in, as distinct from unsolicited bulk mail (spam).",
    body: "Cold email is the practice of sending an individual, relevant business email to a prospect you have a legitimate reason to contact. It is legally distinct from spam under CAN-SPAM (US) and lawfully compatible with GDPR legitimate-interest in the EU, provided the email is factually accurate, identifies the sender, provides a way to opt out, and targets a business contact with a clear relevance angle. Cold email ceases to be lawful when sent at bulk scale to scraped consumer addresses, uses deceptive subject lines, or lacks opt-out. Most modern outbound agencies operate cold email at 50-200 sends per sender per day with careful warm-up and list hygiene.",
    related: ["deliverability", "warm-up", "opener", "can-spam", "gdpr"],
  },
  {
    slug: "opener",
    name: "Opener (cold email)",
    category: "outbound",
    meta: "The opener is the first 1-2 sentences of a cold email. It is the single highest-leverage element of the message.",
    oneSentence:
      "The opener is the first 1-2 sentences of a cold email — the part that determines whether the recipient reads the rest.",
    body: "In cold email, the opener bears more weight than the subject line and the call-to-action combined. A strong opener anchors the message on something specific and verifiable about the recipient (a website audit finding, a review theme, a Google Maps listing detail) so the recipient recognizes it was not mass-produced. A weak opener uses generic flattery, an AI-identifiable template ('Hope you're well, quick question about {Company}'), or a reversed value-ask ('Can I pick your brain?'). Opener quality is the single variable most correlated with reply rate in our pipeline data.",
    related: ["cold-email", "personalization", "reply-rate"],
  },
  {
    slug: "reply-rate",
    name: "Reply rate",
    category: "outbound",
    meta: "Reply rate is the percentage of cold emails sent that receive a human reply. Benchmarks and common mistakes.",
    oneSentence:
      "Reply rate is the share of cold emails sent that receive a human reply of any kind, including objections and out-of-office responses.",
    body: "Reply rate is tracked at the send level and is the primary leading indicator of outbound campaign health. In 2026, B2B SaaS Apollo-sourced sequences average 0.2-0.5% reply rate; local-service postcode-plus-niche sequences with grounded openers achieve 3-7%. Reply rate is distinct from positive-reply rate (the subset of replies that are not objections or opt-outs). Most agencies track both: reply rate tells you whether you're being read; positive-reply rate tells you whether the offer lands.",
    related: ["opener", "cold-email", "meeting-booked-rate"],
  },
  {
    slug: "deliverability",
    name: "Deliverability",
    category: "email",
    meta: "Deliverability is the share of sent cold emails that actually reach the recipient's inbox (not spam or deferred).",
    oneSentence:
      "Deliverability is the share of your sent cold emails that land in the recipient's primary inbox rather than spam, promotions, or deferred.",
    body: "Deliverability is driven by domain and IP reputation, authentication records (SPF, DKIM, DMARC), sending-pattern signals (ramp-up, engagement), and content signals (link count, spam-trigger phrases). Healthy deliverability sits at 85%+ on a warm domain; anything below 60% breaks unit economics. Specialist outbound tools (Smartlead, Instantly, Mailforge) rotate through multiple warm-up inboxes per sender to keep reputation intact.",
    related: ["warm-up", "spf-dkim-dmarc", "cold-email"],
  },
  {
    slug: "warm-up",
    name: "Warm-up (email)",
    category: "email",
    meta: "Warm-up is the gradual ramp-up of sends from a new email domain to establish sender reputation with inbox providers.",
    oneSentence:
      "Warm-up is the gradual ramp-up of sends from a new email domain, typically paired with auto-engagement, to establish sender reputation with inbox providers.",
    body: "Every new domain starts with zero reputation. Sending 200 cold emails on day one guarantees spam-folder placement. Warm-up solves this by gradually increasing volume (typically +5 sends/day) while auto-engaging each send — some combination of opens, replies, and moves out of spam across a network of other warmed-up inboxes. Sophisticated warm-up networks (Smartlead, Instantly, Mailforge) run for 14-30 days before a new sender goes into production outbound.",
    related: ["deliverability", "cold-email"],
  },
  {
    slug: "spf-dkim-dmarc",
    name: "SPF, DKIM, DMARC",
    category: "email",
    meta: "SPF, DKIM, and DMARC are the three DNS-level authentication records required for modern email deliverability.",
    oneSentence:
      "SPF, DKIM, and DMARC are three DNS-level authentication records that collectively prove your email is legitimate; missing any one will cripple deliverability.",
    body: "SPF (Sender Policy Framework) is a DNS record that declares which mail servers are permitted to send on behalf of your domain. DKIM (DomainKeys Identified Mail) signs each message with a cryptographic key whose public half lives in DNS. DMARC (Domain-based Message Authentication, Reporting and Conformance) tells receiving servers what to do when SPF or DKIM fails and provides reporting. In 2024, Google and Yahoo made DMARC mandatory for any domain sending more than 5,000 messages per day — treat all three as non-negotiable.",
    related: ["deliverability", "warm-up"],
  },
  {
    slug: "icp",
    name: "ICP (Ideal Customer Profile)",
    category: "sales",
    meta: "An Ideal Customer Profile is a structured description of the exact type of company or person most likely to buy your product.",
    oneSentence:
      "An Ideal Customer Profile (ICP) is a structured description of the exact type of company or person most likely to buy your product, used to filter lists and write targeted messaging.",
    body: "An ICP is not a buyer persona — it is a harder-edged targeting filter. A B2B SaaS ICP typically includes industry, company size, technology stack, geography, and a buying trigger. A local-service ICP includes vertical, geography (postcode or region), website quality tier, and a business-age floor. The more specific the ICP, the higher the reply rate; the looser the ICP, the lower the cost-per-lead but the lower the conversion.",
    related: ["persona", "niche", "postcode"],
  },
  {
    slug: "persona",
    name: "Buyer persona",
    category: "sales",
    meta: "A buyer persona is a semi-fictional representation of a specific buyer's role, goals, and objections.",
    oneSentence:
      "A buyer persona is a semi-fictional representation of a specific buyer — their role, priorities, and objections — used to calibrate messaging.",
    body: "Personas are narrative-rich and behavioral, where ICPs are filter-based and structural. A persona describes how the buyer thinks; an ICP describes which accounts to target. A good outbound motion uses both: ICP to narrow the list, persona to calibrate each email. Personas matter less in local-service outbound, where the target is almost always the owner-operator and geography + vertical do most of the targeting work.",
    related: ["icp", "niche"],
  },
  {
    slug: "mql",
    name: "MQL (Marketing Qualified Lead)",
    category: "marketing",
    meta: "An MQL is a prospect whose behavior signals enough interest to warrant hand-off from marketing to sales.",
    oneSentence:
      "An MQL (Marketing Qualified Lead) is a prospect whose observed behavior — form fills, demo requests, pricing-page visits — signals enough interest to justify a marketing-to-sales hand-off.",
    body: "MQL is a process definition, not a product one. Each team chooses the behaviors that qualify (e.g., booked a demo + company size > 50 + job title senior). The ratio of MQL → SQL (Sales Qualified Lead) → closed-won tells you how well marketing and sales are aligned; a large drop from MQL to SQL means marketing is passing unqualified leads. Replace 'MQL' with 'PQL' (Product Qualified Lead) in product-led motions where the qualifying signal is product usage.",
    related: ["sql", "icp", "lead"],
  },
  {
    slug: "sql",
    name: "SQL (Sales Qualified Lead)",
    category: "sales",
    meta: "A Sales Qualified Lead is an MQL that a sales rep has confirmed fits the ICP and has intent.",
    oneSentence:
      "An SQL (Sales Qualified Lead) is a prospect a sales rep has confirmed fits the ICP and has enough buying intent to justify a formal sales process.",
    body: "SQL is the stage between MQL (marketing-identified) and Opportunity (committed to evaluate). A lead becomes an SQL after a qualifying conversation, usually covering BANT (Budget, Authority, Need, Timing) or MEDDIC criteria. The MQL → SQL ratio is one of the most-watched metrics in B2B ops because it measures how aligned marketing's qualification model is with sales' reality.",
    related: ["mql", "icp"],
  },
  {
    slug: "lead",
    name: "Lead",
    category: "sales",
    meta: "A lead is any identified contact or company with some chance of becoming a customer.",
    oneSentence:
      "A lead is any identified contact or company with some chance of becoming a customer, regardless of the strength of signal.",
    body: "'Lead' is deliberately loose. A lead can be as cold as a scraped company name or as hot as an inbound demo request. Outbound leads are leads you generated (list-sourced, event-sourced, referral); inbound leads raised their hand. In Revint the term refers to a business discovered via Google Maps plus audit data — cold by definition, but pre-researched.",
    related: ["mql", "sql", "prospect"],
  },
  {
    slug: "prospect",
    name: "Prospect",
    category: "sales",
    meta: "A prospect is a lead that a rep has judged worth pursuing, but that hasn't yet expressed interest.",
    oneSentence:
      "A prospect is a lead that a rep has decided is worth pursuing — an active target — but that hasn't yet engaged back.",
    body: "Some teams use 'lead' and 'prospect' interchangeably; the precise distinction is that 'prospect' implies active pursuit. A lead becomes a prospect when you add it to a sequence, call it, or open a deal record. If you never contact a lead, it stays a lead.",
    related: ["lead", "sql"],
  },
  {
    slug: "postcode",
    name: "Postcode targeting",
    category: "outbound",
    meta: "Postcode targeting is filtering leads to a single postcode district, enabling density and local relevance for outbound.",
    oneSentence:
      "Postcode targeting is filtering outbound leads to a single postcode district or ZIP so every message can reference the neighborhood the prospect operates in.",
    body: "Local-service outbound is most effective when the list is small and geographically tight. Prospecting 'London' returns 10,000+ targets and forces generic messaging; prospecting 'NW1' returns ~30-60 per niche and makes hyper-local openers possible ('Three other Camden shops switched to us last month'). The unit economics also tilt favorably: your agency can physically visit, drop in, or pick up the phone without friction.",
    related: ["niche", "postcode-niche", "icp"],
  },
  {
    slug: "niche",
    name: "Niche (outbound)",
    category: "outbound",
    meta: "A niche in local outbound is a single vertical — phone repair, dental, HVAC — paired with a postcode to form a targetable list.",
    oneSentence:
      "A niche is a single vertical (phone repair, dental, HVAC) paired with a postcode or region to form a tightly-targeted outbound list.",
    body: "Niche selection is one of the highest-leverage decisions an outbound agency makes. The best niches have visible quality gaps (typical website is outdated), enough willingness-to-pay to absorb agency fees, and sufficient density in your target postcode. Niches that satisfy all three today include phone repair, dental clinics, independent opticians, HVAC/boiler repair, driving instructors, and mobile mechanics. Saturated or chain-dominated niches (restaurants, hair salons, gyms) should be avoided.",
    related: ["postcode", "postcode-niche", "icp"],
  },
  {
    slug: "postcode-niche",
    name: "Postcode-niche (playbook)",
    category: "leadac",
    meta: "Postcode-niche is the Revint playbook: one postcode plus one vertical equals one hyper-targeted outbound list.",
    oneSentence:
      "Postcode-niche is the Revint playbook — discover the list by intersecting a single postcode district with a single vertical.",
    body: "The postcode-niche intersection returns ~30-60 businesses in most UK cities; each has a Google Maps listing, a website, and a phone number. This list is dense enough to iterate on (send 20, measure, adjust) and narrow enough to write openers that reference the neighborhood the prospect operates in. It is the opposite of the persona-driven motion that Apollo enables.",
    related: ["postcode", "niche", "audit"],
  },
  {
    slug: "audit",
    name: "Website audit (Revint)",
    category: "leadac",
    meta: "A Revint website audit checks 20 signals on every prospect's site and feeds an opportunity score plus opener angles.",
    oneSentence:
      "A Revint website audit is a 20-signal Playwright-driven inspection of every prospect's site, covering speed, security, mobile experience, booking, discoverability, and freshness.",
    body: "The audit is the differentiator. It runs automatically on every lead Revint surfaces, produces a 0-100 opportunity score (higher = weaker site = bigger upside to rebuild), and hands back three pitchable red-flag findings per site. Those findings become the opener. The audit is what lets a cold email read as 'you probably want to know your mobile LCP is 7.2 seconds' rather than 'hope you're well'.",
    related: ["opportunity-score", "lcp", "cls", "inp", "core-web-vitals"],
  },
  {
    slug: "opportunity-score",
    name: "Opportunity score",
    category: "leadac",
    meta: "The opportunity score is Revint's 0-100 weighted sum of audit signals ranking which prospects have the biggest pitchable upside.",
    oneSentence:
      "The opportunity score is a 0-100 weighted sum of audit signals — higher means a weaker site, bigger upside to rebuild, and a more pitchable target.",
    body: "The score weights speed (30%), mobile experience (25%), booking and conversion infrastructure (20%), security/hygiene (15%), and discoverability plus freshness (10%). Typical phone-repair and HVAC shops score in the 60-80 range. We deliberately exclude sites scoring below 40 (already good, no pitch) and above 90 (probably going out of business or unstaffed).",
    related: ["audit", "niche", "postcode-niche"],
  },
  {
    slug: "leave-behind",
    name: "Leave-behind (audit PDF)",
    category: "leadac",
    meta: "A leave-behind is the PDF audit report Revint generates for every prospect so you can attach it to the first cold email.",
    oneSentence:
      "A leave-behind is the PDF audit report Revint generates for every prospect, designed to be attached to the first cold email and look like the deliverable of a paid engagement.",
    body: "The leave-behind is what elevates a Revint cold email from 'sales pitch' to 'free work'. It summarises the 20-signal audit, calls out the three biggest issues in plain English, and closes with 'these are fixable' without a hard sell. Recipients who don't reply to the email often forward the PDF to a colleague — and that's where a share of reply traffic comes from.",
    related: ["audit", "opener", "cold-email"],
  },
  {
    slug: "vertical-pack",
    name: "Vertical pack",
    category: "leadac",
    meta: "A vertical pack is a Revint-curated bundle of audit templates, opener libraries, and FAQ frames for one specific niche.",
    oneSentence:
      "A vertical pack is a curated bundle of audit templates, opener libraries, and niche-specific FAQs for one specific vertical (e.g., phone repair, dental).",
    body: "Vertical packs reduce the ramp time for a new niche. Instead of writing openers from scratch, agencies start with 10-20 pre-written opener variants that reference the audit findings most common to that vertical, plus a set of objection-handling frames and a mini-FAQ about the industry. Packs ship for every niche Revint indexes past an evidence floor.",
    related: ["niche", "opener", "audit"],
  },
  {
    slug: "discovery",
    name: "Discovery (leads)",
    category: "leadac",
    meta: "Discovery is the first phase of Revint's pipeline: intersecting a postcode and niche to surface candidate businesses.",
    oneSentence:
      "Discovery is the first step of the Revint pipeline — intersecting a postcode and a niche to surface 30-60 candidate businesses from Google Maps live data.",
    body: "Discovery is where the list is born. We query Google Places for businesses matching the vertical in the target postcode, deduplicate, filter out chains and closed businesses, and pass the result to the audit stage. Discovery is deliberately small-batch — the goal is 30-60 leads per run, not thousands, so the downstream audit remains fresh and the output stays manageable.",
    related: ["audit", "postcode-niche", "niche"],
  },
  {
    slug: "core-web-vitals",
    name: "Core Web Vitals",
    category: "seo",
    meta: "Core Web Vitals are Google's three specific performance metrics — LCP, CLS, INP — that feed ranking and are surfaced in audits.",
    oneSentence:
      "Core Web Vitals are Google's three user-experience metrics — Largest Contentful Paint, Cumulative Layout Shift, and Interaction to Next Paint — that feed ranking and are measurable on any site.",
    body: "CWV replaced the older 'page speed' metric as the single user-experience signal Google ranks on. LCP targets under 2.5s on mobile; CLS under 0.1; INP under 200ms. A site failing two of three is almost always losing rankings to competitors that pass. Every Revint audit includes the three CWV measurements on a throttled mobile connection, which become some of the strongest opener angles in the playbook.",
    related: ["lcp", "cls", "inp", "audit"],
  },
  {
    slug: "lcp",
    name: "LCP (Largest Contentful Paint)",
    category: "seo",
    meta: "LCP is the Core Web Vital measuring when the largest visible element finishes rendering — target under 2.5s.",
    oneSentence:
      "LCP (Largest Contentful Paint) is the Core Web Vital measuring when the largest above-the-fold element finishes rendering — target under 2.5 seconds.",
    body: "LCP is the closest-to-perception speed metric; it approximates what users mean when they say a page 'loaded'. Common causes of slow LCP: unoptimised hero images, blocking third-party scripts, server-side rendering latency, and cross-origin fonts. An LCP of 4s+ on mobile is a guaranteed ranking drag and — in local-service outbound — one of the most-referenced audit findings in email one.",
    related: ["core-web-vitals", "cls", "inp"],
  },
  {
    slug: "cls",
    name: "CLS (Cumulative Layout Shift)",
    category: "seo",
    meta: "CLS is the Core Web Vital measuring unexpected shifts of visible content during page load — target under 0.1.",
    oneSentence:
      "CLS (Cumulative Layout Shift) is the Core Web Vital measuring how much visible content moves around during initial load — target under 0.1.",
    body: "High CLS usually comes from images without dimension attributes, fonts that swap mid-load, or ads injected above the fold. CLS matters not just for ranking but conversion: a layout shift that happens the moment a user is about to click something measurably increases bounce. Revint's audit flags any CLS above 0.25 as red.",
    related: ["core-web-vitals", "lcp", "inp"],
  },
  {
    slug: "inp",
    name: "INP (Interaction to Next Paint)",
    category: "seo",
    meta: "INP is the Core Web Vital replacing FID — measures responsiveness of the slowest interaction on a page.",
    oneSentence:
      "INP (Interaction to Next Paint) is the Core Web Vital that replaced FID in March 2024 — it measures the responsiveness of the slowest user interaction on a page, target under 200ms.",
    body: "INP is the hardest of the three CWVs to pass because it measures the worst case, not the average. A page that feels fast but hitches when the user submits a form can fail INP. The usual fixes involve breaking up long JavaScript tasks, deferring non-critical work, and eliminating main-thread blocking from third-party scripts.",
    related: ["core-web-vitals", "lcp", "cls"],
  },
  {
    slug: "schema-markup",
    name: "Schema markup",
    category: "seo",
    meta: "Schema markup is structured JSON-LD data embedded in pages so search engines and AI can extract entities reliably.",
    oneSentence:
      "Schema markup (typically JSON-LD) is structured data embedded in a page so search engines and AI can reliably extract entities like business, address, price, and review.",
    body: "For local-service businesses, the most important schemas are LocalBusiness, Service, OpeningHours, and AggregateRating. For content, Article/BlogPosting, FAQPage, HowTo, and BreadcrumbList. AI search engines (ChatGPT Search, Perplexity, Google AI Overviews) rely heavily on schema to decide which sites to cite. Revint emits schema on every indexable page as a matter of principle.",
    related: ["seo", "localbusiness-schema", "faqpage-schema"],
  },
  {
    slug: "localbusiness-schema",
    name: "LocalBusiness schema",
    category: "seo",
    meta: "LocalBusiness is the schema.org type that marks up a physical-location business with address, hours, and contact info.",
    oneSentence:
      "LocalBusiness is the schema.org type that marks up a physical-location business — address, opening hours, phone, aggregate rating — for search-engine understanding.",
    body: "Every /b/{city}/{business} page on Revint emits a LocalBusiness schema block with nested PostalAddress, GeoCoordinates, OpeningHoursSpecification, and AggregateRating when we have review data. This is what powers rich results in Google (star ratings in search, knowledge-panel cards) and what makes the page citable by AI search engines.",
    related: ["schema-markup", "seo"],
  },
  {
    slug: "faqpage-schema",
    name: "FAQPage schema",
    category: "seo",
    meta: "FAQPage schema marks up question-answer pairs so Google and AI can extract them directly into answers.",
    oneSentence:
      "FAQPage schema is the schema.org type that marks up question-answer pairs on a page, making them extractable for search rich results and AI citations.",
    body: "FAQPage is one of the highest-leverage schemas in 2026 because AI search engines cite FAQ blocks directly. Every Revint programmatic page (city, niche, niche-city, comparison) ends with a 3-6 question FAQ block wrapped in FAQPage schema. The questions are written in the form users actually ask; the answers are 40-80 words — long enough to be useful, short enough to be extracted whole.",
    related: ["schema-markup", "seo", "aeo"],
  },
  {
    slug: "aeo",
    name: "AEO (Answer Engine Optimization)",
    category: "seo",
    meta: "AEO is SEO optimized for AI answer engines — extractable structure, direct answers, citations, schema.",
    oneSentence:
      "AEO (Answer Engine Optimization) is SEO calibrated for AI answer engines — optimizing for extraction and citation rather than blue-link ranking.",
    body: "Traditional SEO optimizes for position on a SERP. AEO optimizes for the likelihood that a model (ChatGPT, Perplexity, Claude, Gemini, Google AI Overviews) will extract a specific sentence or paragraph and cite your page as the source. AEO structure: one-sentence direct answer at the top of every article, numbered lists, real `<table>` markup for comparisons, FAQPage schema, and visible citations with dates.",
    related: ["geo", "schema-markup", "faqpage-schema", "seo"],
  },
  {
    slug: "geo",
    name: "GEO (Generative Engine Optimization)",
    category: "seo",
    meta: "GEO is AEO's close cousin — specifically optimizing content so generative models reproduce it accurately when answering queries.",
    oneSentence:
      "GEO (Generative Engine Optimization) is the practice of structuring content so generative AI models extract it accurately and cite it when answering queries.",
    body: "GEO and AEO overlap by 80%; the distinction is emphasis. AEO is 'how do I get picked'; GEO is 'how do I get quoted accurately'. GEO tactics include: fact density (more numbers, more citations), entity consistency (same brand name every time), canonical phrasing (write the exact sentence you'd want pulled into an answer), and sameAs links across the brand's authoritative profiles.",
    related: ["aeo", "schema-markup", "llms-txt"],
  },
  {
    slug: "llms-txt",
    name: "llms.txt",
    category: "seo",
    meta: "llms.txt is an emerging standard — a single file at your site root that describes your site to AI crawlers in a structured way.",
    oneSentence:
      "llms.txt is an emerging standard — a single plain-text file at /llms.txt that describes your site to AI crawlers with a citation-friendly summary, top pages, and license.",
    body: "Where robots.txt tells crawlers what they may fetch, llms.txt tells them what is worth citing. The file typically contains: a one-paragraph summary of the product, a list of top-linked pages with brief descriptions, the license for training versus inference use, and optional contact for licensing. Revint emits /llms.txt as part of Layer 4 of the SEO plan.",
    related: ["aeo", "geo", "seo"],
  },
  {
    slug: "canonical-url",
    name: "Canonical URL",
    category: "seo",
    meta: "A canonical URL is the preferred version of a page when duplicates or near-duplicates exist — signalled via <link rel='canonical'>.",
    oneSentence:
      "A canonical URL is the preferred version of a page, signalled to search engines via <link rel='canonical'> when duplicates or near-duplicates exist.",
    body: "Every page on Revint declares its own canonical URL via the buildMetadata() helper. Canonical signalling matters most for programmatic sites with query parameters (UTM tags, tracking) or paginated content. A missing canonical on 10,000+ programmatic pages causes index bloat and ranking dilution; getting it right from day one is one of the cheapest wins in technical SEO.",
    related: ["seo", "robots-txt", "sitemap"],
  },
  {
    slug: "sitemap",
    name: "Sitemap",
    category: "seo",
    meta: "A sitemap is an XML file listing the URLs on your site for search engines to discover and crawl efficiently.",
    oneSentence:
      "A sitemap is an XML file listing the URLs on your site that you want search engines to discover, with optional lastmod, priority, and changefreq hints.",
    body: "Google has a hard cap of 50,000 URLs or 50MB per sitemap file. Any site larger than that must use a sitemap index that points to multiple chunked sitemaps. Revint uses Next.js `generateSitemaps()` to emit seven chunks: core, niches, cities, niche-city, businesses-{n} (in 45k slices), blog, and competitors. The robots.txt points to the sitemap index, not individual chunks.",
    related: ["canonical-url", "robots-txt", "seo"],
  },
  {
    slug: "robots-txt",
    name: "robots.txt",
    category: "seo",
    meta: "robots.txt is the root-level file that tells crawlers what they may and may not fetch from your site.",
    oneSentence:
      "robots.txt is a plain-text file at /robots.txt that tells user-agent crawlers what they may and may not fetch from your site, and points to your sitemap.",
    body: "robots.txt is advisory — well-behaved crawlers respect it, but it is not a security boundary. Use it to disallow query-string crawl traps, internal routes, and authentication gates. Revint disallows /app/, /api/, /auth/, /m/, and common UTM/gclid patterns, and points to the sitemap index. It also sets crawl-delay for noisier bots like AhrefsBot, SemrushBot, and MJ12bot.",
    related: ["sitemap", "seo"],
  },
  {
    slug: "indexnow",
    name: "IndexNow",
    category: "seo",
    meta: "IndexNow is a protocol for notifying Bing, Yandex, and others the moment a page is created or updated.",
    oneSentence:
      "IndexNow is an open protocol for notifying search engines — Bing, Yandex, Seznam, Naver — the moment a new page is created or an existing one is materially updated.",
    body: "IndexNow is Bing's counterweight to Google's Search Console URL-submission API. You post JSON to a single endpoint and the participating engines crawl your URLs within minutes. For high-volume sites like Revint's directory, IndexNow dramatically shortens the 'we published it → it shows up in search' gap. Google ignores IndexNow but accepts similar signals via GSC's Indexing API.",
    related: ["sitemap", "seo"],
  },
  {
    slug: "drip",
    name: "Drip sequence",
    category: "outbound",
    meta: "A drip sequence is a pre-written multi-email cadence sent to prospects over days or weeks, with each message spaced by an interval.",
    oneSentence:
      "A drip sequence is a multi-email outbound cadence, typically 3-7 messages over 14-28 days, sent to prospects with each message spaced by an interval.",
    body: "A cold drip typically has email one (grounded opener + offer), email two (bump / 'any thoughts?'), email three (new angle or social proof), and email four (break-up). Modern senders (Smartlead, Instantly, Lemlist) automate the cadence with branching logic — remove the prospect on a reply, jump to a positive-reply sub-sequence on a specific keyword, etc.",
    related: ["cold-email", "cadence", "opener"],
  },
  {
    slug: "cadence",
    name: "Cadence",
    category: "outbound",
    meta: "Cadence is the sequence and timing of touches a rep makes to reach a prospect — calls, emails, LinkedIn, in that order.",
    oneSentence:
      "Cadence is the planned sequence and timing of every touch a rep makes to reach a prospect — emails, calls, LinkedIn messages, texts — typically over a fixed window.",
    body: "A common cadence for local-service outbound is: day 1 email one, day 1 Google Maps message, day 3 follow-up email, day 5 cold call, day 7 LinkedIn connect, day 10 break-up email. The exact shape matters less than having one and sticking to it. Reps without a defined cadence forget to follow up and leave 30-50% of pipeline on the table.",
    related: ["drip", "cold-email", "outbound"],
  },
  {
    slug: "can-spam",
    name: "CAN-SPAM",
    category: "email",
    meta: "CAN-SPAM is the US law (2003) governing commercial email: truthful headers, honest subject lines, visible opt-out.",
    oneSentence:
      "CAN-SPAM is the 2003 US law governing commercial email — requires truthful headers, honest subject lines, a physical postal address, and a working opt-out mechanism.",
    body: "CAN-SPAM is permissive by EU standards: it does not require opt-in consent and does not distinguish between B2B and B2C. But it does mandate four concrete things on every commercial email: accurate 'From' headers, non-deceptive subject lines, a physical mailing address, and a clearly visible opt-out that is honoured within 10 business days. Ignoring any of the four is an FTC enforcement action.",
    related: ["cold-email", "gdpr"],
  },
  {
    slug: "gdpr",
    name: "GDPR (cold email)",
    category: "email",
    meta: "GDPR is the EU data protection regulation; for cold email it permits B2B outreach under legitimate interest with caveats.",
    oneSentence:
      "GDPR is the EU data protection regulation; for B2B cold email it permits outreach under legitimate-interest provided the contact's role matches the offer and an opt-out is provided.",
    body: "Despite widespread misconceptions, GDPR does not ban B2B cold email. Article 6(1)(f) 'legitimate interest' covers it, subject to: (a) the contact's role genuinely matches the offer, (b) the email is not sent at bulk spam scale, (c) a clear opt-out is provided, and (d) the data is not sensitive. Individual EU member states layer on additional rules — Germany's UWG is strictest (effectively opt-in), France and Spain are stricter than the UK. Consumer (B2C) cold email is opt-in everywhere in the EU.",
    related: ["cold-email", "can-spam"],
  },
  {
    slug: "personalization",
    name: "Personalization",
    category: "outbound",
    meta: "Personalization in cold email means tailoring each message so the recipient can tell it was written for them.",
    oneSentence:
      "Personalization in cold email is tailoring each message so the recipient can tell — within one sentence — that it was written for them, not auto-generated.",
    body: "Token-swapping ('Hi {FirstName}, saw {Company} is growing fast') is no longer personalization — it is recognisably AI-template output. Real personalization requires grounding: referencing a specific audit finding, review theme, product change, or observable artefact. The bar is 'could another prospect copy this email and have it still make sense?' If yes, it is not personalized. The bar rose significantly between 2022 and 2025.",
    related: ["opener", "cold-email", "reply-rate"],
  },
  {
    slug: "meeting-booked-rate",
    name: "Meeting-booked rate",
    category: "outbound",
    meta: "Meeting-booked rate is the percentage of cold emails sent that result in a booked discovery call — the truest outbound metric.",
    oneSentence:
      "Meeting-booked rate is the percentage of cold emails sent that result in a booked discovery or demo call — the ultimate measure of cold-email campaign health.",
    body: "Meeting-booked rate sits downstream of reply rate and positive-reply rate. A typical B2B SaaS Apollo campaign books 0.05-0.1% of sends as meetings. A postcode-niche local-service campaign books 0.8-1.5%. Most teams under-invest in measuring meeting-booked rate because it requires CRM hygiene, but it is the only metric that ties directly to pipeline.",
    related: ["reply-rate", "cold-email"],
  },
  {
    slug: "aggregate-rating",
    name: "AggregateRating",
    category: "seo",
    meta: "AggregateRating is the schema.org type that represents the overall rating (star score + count) for a business, product, or service.",
    oneSentence:
      "AggregateRating is the schema.org type that represents the overall rating — a star score plus review count — for a business, product, or service.",
    body: "Every /b/{city}/{business} page on Revint emits AggregateRating where we have review data. The fields are ratingValue (e.g., 4.7), reviewCount (e.g., 183), bestRating (5) and worstRating (1). This is what drives star-rating rich results in Google and gives AI search engines a citable quantitative signal.",
    related: ["schema-markup", "localbusiness-schema", "review"],
  },
  {
    slug: "review",
    name: "Review (schema)",
    category: "seo",
    meta: "Review is the schema.org type representing a single rating+comment, usually nested under LocalBusiness alongside AggregateRating.",
    oneSentence:
      "Review is the schema.org type representing a single rating and comment about a business, product, or service — typically nested under LocalBusiness alongside AggregateRating.",
    body: "Review schema is the complement to AggregateRating: where AggregateRating is the summary number, Review marks up individual testimonials with author, datePublished, reviewRating, and reviewBody. Google may display individual review snippets in rich results, and AI search engines cite review content when asked 'is X any good?'. Revint surfaces 3-5 review excerpts per business page.",
    related: ["schema-markup", "localbusiness-schema", "aggregate-rating"],
  },
  {
    slug: "breadcrumb",
    name: "Breadcrumb (navigation + schema)",
    category: "seo",
    meta: "A breadcrumb is the hierarchy of links showing where the current page sits in a site — also a schema.org type for the same.",
    oneSentence:
      "A breadcrumb is the hierarchy of links (Home → Cities → London → NW1) showing a page's position in site structure, and the schema.org BreadcrumbList type marks it up for search engines.",
    body: "Breadcrumbs serve two purposes: user orientation and search-engine understanding of site hierarchy. Google uses BreadcrumbList schema to replace the URL in search results with a breadcrumb chain, which reads better and clicks higher. Every indexable Revint page emits both a visible breadcrumb and matching BreadcrumbList JSON-LD.",
    related: ["schema-markup", "seo", "canonical-url"],
  },
  {
    slug: "crawl-budget",
    name: "Crawl budget",
    category: "seo",
    meta: "Crawl budget is the number of URLs Googlebot will fetch from your site per day, limited by server capacity and site quality signals.",
    oneSentence:
      "Crawl budget is the number of URLs Googlebot will fetch from your site per day — limited by server response time, error rate, and site-quality signals.",
    body: "For small sites (under 10k URLs) crawl budget is effectively infinite. For directory-scale sites it becomes the rate-limiting factor on how fast new content gets indexed. Three levers: (1) server speed (faster TTFB → more fetches per session), (2) reduced low-value URLs (no crawl traps from query strings, no thin pages), and (3) sitemap hygiene (accurate lastmod timestamps help Google prioritise fresh URLs).",
    related: ["sitemap", "robots-txt", "index-bloat"],
  },
  {
    slug: "index-bloat",
    name: "Index bloat",
    category: "seo",
    meta: "Index bloat is when search engines index large numbers of low-quality URLs from your site, diluting rankings for the ones that matter.",
    oneSentence:
      "Index bloat is when search engines index large numbers of low-quality URLs — query-string variants, thin pages, duplicate content — from your site, diluting rankings for the pages that actually matter.",
    body: "The fix for index bloat is surgical: noindex the low-value pages (GSC coverage report will tell you which), canonical the duplicates, and disallow the crawl traps in robots.txt. Revint's 'evidence floor' rule is index-bloat prevention upstream — any programmatic page that fails the floor is noindexed and excluded from the sitemap before it can dilute the good ones.",
    related: ["crawl-budget", "canonical-url", "sitemap"],
  },
  {
    slug: "evidence-floor",
    name: "Evidence floor (Revint)",
    category: "leadac",
    meta: "The evidence floor is Revint's minimum content-quality rule: every indexable programmatic page must have at least one unique data block.",
    oneSentence:
      "The evidence floor is Revint's minimum content-quality rule — every indexable programmatic page must surface at least one unique data block (audit, review excerpt, price band, named operator) before it qualifies for the sitemap.",
    body: "Programmatic SEO can fail in one specific way: producing tens of thousands of near-identical thin pages that trip Google's 'unhelpful content' signal and drag down the whole domain. The evidence floor prevents that. It's enforced in code (`passesEvidenceFloor()` in `src/lib/seo/programmatic.ts`); pages that fail are auto-noindexed and never listed in the sitemap.",
    related: ["audit", "index-bloat", "seo"],
  },
  {
    slug: "discovery-call",
    name: "Discovery call",
    category: "sales",
    meta: "A discovery call is the first qualifying conversation between a prospect and a rep to assess fit and understand needs.",
    oneSentence:
      "A discovery call is the first qualifying conversation — typically 15-30 minutes — between a prospect and a rep, used to assess fit and surface buying intent.",
    body: "In local-service outbound the discovery call is usually 15 minutes and runs on a simple script: confirm the problem the audit surfaced, understand what the prospect has tried, scope a possible solution, propose a next step (site-build proposal, follow-up audit). Overcomplicating a discovery call with full BANT/MEDDIC in the first 15 minutes kills booking rate.",
    related: ["sql", "meeting-booked-rate"],
  },
  {
    slug: "waterfall-enrichment",
    name: "Waterfall enrichment",
    category: "data",
    meta: "Waterfall enrichment runs a lead through multiple data providers in sequence, using the first hit and falling back when data is missing.",
    oneSentence:
      "Waterfall enrichment is the practice of running a lead through multiple data providers in sequence — using the first high-confidence hit and falling back to the next provider when data is missing.",
    body: "Clay popularised waterfall enrichment for B2B SaaS: hit ZoomInfo first, fall back to Apollo, fall back to People Data Labs, fall back to Lusha, and so on. It yields higher contact-match rates than any single provider. Waterfall enrichment is unnecessary for local-service outbound (Google Places plus a website audit covers the entire need) but essential at B2B SaaS scale.",
    related: ["data-freshness", "icp"],
  },
  {
    slug: "data-freshness",
    name: "Data freshness",
    category: "data",
    meta: "Data freshness is how recently lead or contact data was verified — older data has higher bounce rates and lower reply rates.",
    oneSentence:
      "Data freshness is how recently lead or contact data was verified — fresher data has lower bounce rates, lower deliverability risk, and higher reply rates.",
    body: "Contact data decays at roughly 2.5% per month: people change jobs, titles, email addresses, phone numbers. A database last updated six months ago has ~15% rot. For cold email, sending to a 15% rotted list is a deliverability disaster — every bounce scores negatively against sender reputation. Revint's advantage over list vendors is that it pulls businesses live from Google Maps at query time, so the bounce rate on the core business data is effectively zero.",
    related: ["waterfall-enrichment", "deliverability"],
  },
  {
    slug: "same-as",
    name: "sameAs (schema)",
    category: "seo",
    meta: "sameAs is a schema.org property linking an entity to its other authoritative profiles, consolidating identity in the Knowledge Graph.",
    oneSentence:
      "sameAs is a schema.org property that links an entity to its other authoritative profiles (Twitter, LinkedIn, Crunchbase, G2), helping search engines consolidate the entity in the Knowledge Graph.",
    body: "sameAs matters specifically for entity SEO — the thing that determines whether Google sees 'Revint' and 'Revint' as the same company, and whether AI search engines cite the brand accurately. Every Organization schema should include sameAs pointing to Twitter, LinkedIn, GitHub, Crunchbase, Product Hunt, G2, Capterra, and any other profile that mentions the brand.",
    related: ["schema-markup", "seo", "aeo"],
  },
  {
    slug: "serp",
    name: "SERP",
    category: "seo",
    meta: "A SERP is the Search Engine Results Page — the layout of organic and paid results Google shows for a query.",
    oneSentence:
      "A SERP (Search Engine Results Page) is the page Google — or any search engine — displays in response to a query, containing organic results, ads, and rich features like featured snippets and AI Overviews.",
    body: "SERPs have become increasingly diverse since 2020. A single query might return organic results, a Local Pack, a Featured Snippet, a People Also Ask box, a Video carousel, a Google AI Overview, and paid ads — each fighting for click share. Modern SEO optimizes for more than one SERP feature: blue-link ranking, Featured Snippet capture, Local Pack inclusion, and AI Overview citation.",
    related: ["seo", "aeo", "featured-snippet"],
  },
  {
    slug: "featured-snippet",
    name: "Featured snippet",
    category: "seo",
    meta: "A featured snippet is the boxed answer Google shows above the organic results for many queries, drawn from a single page.",
    oneSentence:
      "A featured snippet is the boxed answer Google shows above the organic results for many queries, drawn from a single page — sometimes called 'position zero'.",
    body: "Winning a featured snippet doubles or triples CTR for most queries. The tactics: answer the implied question in the first 40-60 words, use the question phrasing as an H2 or H3, and format the answer as a short paragraph, numbered list, or table — whichever matches the query intent. Google picks the format. Every Revint blog post opens with a one-sentence direct answer specifically for snippet capture.",
    related: ["aeo", "serp", "seo"],
  },
];

export function getTermBySlug(slug: string): GlossaryTerm | undefined {
  return GLOSSARY_TERMS.find((t) => t.slug === slug);
}

export function getAllTermSlugs(): string[] {
  return GLOSSARY_TERMS.map((t) => t.slug);
}

export function getTermsByCategory(): Record<string, GlossaryTerm[]> {
  const out: Record<string, GlossaryTerm[]> = {};
  for (const t of GLOSSARY_TERMS) {
    if (!out[t.category]) out[t.category] = [];
    out[t.category].push(t);
  }
  for (const k of Object.keys(out)) {
    out[k].sort((a, b) => a.name.localeCompare(b.name));
  }
  return out;
}
