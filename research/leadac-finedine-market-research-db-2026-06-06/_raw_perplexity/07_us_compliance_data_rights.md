A US-first outbound GTM for restaurant-tech must (1) design email, SMS, and AI-voice workflows around **CAN‑SPAM** and **TCPA** consent/opt-out and suppression, and (2) tightly constrain use of **Google Maps/Places** and third‑party restaurant data licenses to only permitted use cases, with clear **privacy disclosures**. Below is a product-focused compliance memo for LeadAC x FineDine.

---

## 1) Key Findings (P0 Product Requirements)

### A. CAN-SPAM – B2B Commercial Email

**Scope & consent**

- CAN‑SPAM applies to **all “commercial” email**, including B2B; there is **no B2B exemption**.[3]  
- **Prior consent is not required** to send commercial email to US recipients, B2C or B2B, but strict content and opt-out rules apply.[1][3]  

**Core requirements for every outbound commercial email**

Under the FTC’s CAN‑SPAM guide:[3]

- **Accurate header information**: “From,” “To,” “Reply‑To,” and routing/domain must identify the sending business and not be misleading.[3]  
- **Non‑deceptive subject line**: Subject must accurately reflect the email’s content.[3]  
- **Identify as advertisement**: Email must **clearly and conspicuously** disclose it is an ad (flexible how; e.g., footer statement).[3][1]  
- **Physical postal address**: Must include a **valid physical postal address** (street address, USPS PO Box, or commercial mail receiving agency).[3][1]  
- **Clear opt‑out mechanism**: Must provide a clear, conspicuous, easy Internet‑based way to opt out of future emails (reply, one‑click web page, etc.).[3][1]  
- **Opt‑out processing window**:  
  - Mechanism must work for **at least 30 days** after send.[3][1]  
  - Opt‑outs must be honored within **10 business days**.[3][1]  
  - No fee, no additional personal data beyond email address, and no more than one web page to submit opt‑out.[3][1]  
- **No sale or transfer of opted‑out addresses**: Except for compliance transfers, you cannot sell/transfer email addresses of people who opted out (including in a list).[3][1]  
- **Liability for vendors**: Brand and email vendor/affiliate can both be held responsible; senders must **monitor vendors** and cannot contract away liability.[3][1]  

**P0 implications for LeadAC x FineDine**

- Outbound B2B cold email is **allowed** without prior consent **if** you:
  - Include **valid physical address**, **ad disclosure**, and **simple opt‑out** in all commercial outreach.
  - Implement a **global suppression list** that blocks further marketing to opted‑out addresses within 10 business days.
  - Store **opt‑out status** persistently and propagate it to all email vendors and product surfaces.
- UI/UX must:
  - Provide **template-safe** fields (From, subject, footer) that cannot be configured into non‑compliance (e.g., require physical address, enforce opt‑out link).
  - Support **multi‑brand sending profiles** with distinct addresses and suppression lists, but enforce CAN‑SPAM logic across all.
- Data model must:
  - Track **email address**, **opt‑out timestamp**, **opt‑out source**, and **scope** (this brand only vs all brands represented by LeadAC/FineDine).
  - Ensure opted‑out addresses are never re‑uploaded/sold to other customers, except for compliance uses.

---

### B. TCPA / DNC – SMS (“robotext”) and AI/Automated Voice

**Authority & scope**

- The **Telephone Consumer Protection Act (TCPA)** and FCC rules govern autodialed calls, prerecorded/AI‑type voice, and text messages to wireless numbers.  
- FCC treats **text messages as “calls”** under TCPA.  

**Key consent standards (high‑level)**

From FCC TCPA guidance and orders (summarizing core rules):

- **Telemarketing / marketing calls or texts** generally require **prior express written consent** when made using an autodialer or prerecorded/artificial voice to wireless numbers.  
- **Informational/non‑marketing** calls/texts may require **prior express consent** but not necessarily written, depending on context and equipment used.  
- **National Do Not Call (DNC)** rules require honoring consumer DNC requests and checking the DNC registry for telemarketing to residential numbers.  
- **Revocation of consent**: Recipients must be allowed to revoke consent in any reasonable way, and revocation must be honored promptly (case law plus FCC rulings).  

Because your product contemplates **robotexts and AI voice**, you must assume these are **high‑risk TCPA activities** and design for **written consent + easy opt‑out**.

**P0 implications for LeadAC x FineDine**

- Treat **all marketing texts and AI‑voice calls** as requiring:
  - **Documented prior express written consent** from the recipient restaurant contact (e‑signature, checkbox + timestamp, or signed form).
  - Clear disclosure at consent time that they agree to receive marketing texts/calls via automated systems at the provided number, not required for purchase.
- Product must provide:
  - **Consent capture** objects tied to each phone number (source page, language shown, time, IP, method).
  - **Keyword-based opt‑out** logic for SMS (e.g., STOP, UNSUBSCRIBE) with immediate suppression for that number.
  - Ability for agents to log **verbal revocation** and immediately suppress numbers.
- For **lead lists uploaded by users**:
  - Require them to designate whether each number has TCPA‑compliant consent for marketing texts/AI calls.
  - Provide warnings and contractual terms that put **TCPA compliance responsibility** on the customer while still enforcing **opt‑out/suppression** centrally.
- For **non‑marketing/operational** texts (e.g., reservation confirmations), separate workflows and templates; still maintain opt‑out where applicable, but they may fall under different TCPA categories.

*(You should obtain TCPA‑specific counsel to classify each use case—cold text prospecting and AI outbound calls are among the most litigated practices; the above is conservative but aligned with FCC guidance.)*

---

### C. Suppression Lists and Cross‑Channel Opt‑out

**CAN‑SPAM suppression**

- Must maintain **suppression lists** of email addresses that opted out and cannot send further commercial emails to them, nor transfer/sell those addresses except as necessary for compliance.[3][1]  

**TCPA / DNC suppression**

- TCPA/DNC implies similar suppression duties for phone numbers where consent is revoked or DNC status is set, especially for telemarketing.  

**P0 implications**

- Central **“Do Not Contact” object** per identity (email, phone) with:
  - Channel‑specific flags (email, SMS, voice).
  - Source (user click, reply, verbal, import from brand’s CRM).
  - Scope (campaign‑level vs brand vs all LeadAC/FineDine products).
- All outbound systems (email, SMS, dialer, AI voice) must **check suppression before each send**.
- Provide **export API/UI** to let restaurant customers sync their suppression lists with their own CRMs and vendors.
- For multi‑tenant architecture, prevent **cross‑customer leakage** of suppression list contents, but still prevent re‑targeting the same address by the same customer.

---

### D. Google Maps / Places Data – Storage & Use Restrictions

**Authoritative docs**

- **Google Maps Platform Terms of Service** and **Places API policies** govern how you can store and use Places/Maps data.  

Core constraints (summarized from Google policies):

- **No stand‑alone dataset or database**: You may not **pre‑fetch, index, or store** Places data for purposes other than improving use within your application, and cannot create a separate **places/POI database** that replicates Google’s database.  
- **Storage limits / caching**:
  - You may **cache** certain data for limited periods to improve performance, but **long‑term or permanent storage of Places results** is restricted unless explicitly allowed.  
- **No resale or redistribution**:
  - You cannot **sell, resell, or redistribute** Google Places content or use it as the primary value of a commercial product that competes with Google Maps/Places.  
- **Attribution & content integrity**:
  - Must show appropriate **Google attribution** with Maps/Places content and cannot remove/obscure required branding.  
- **Prohibition on mixing with certain other datasets**:
  - You must not blend Google Places data with data from certain other providers in a way that misleads users about origin or violates those providers’ terms.  

**P0 implications for LeadAC x FineDine**

- If you use **Google Places** to find restaurants or enrich records:
  - You **cannot** build a persistent “restaurant master file” whose core content is Google’s Places data and then resell or broadly expose that dataset.
  - Use Places results **only inside the product experience** (e.g., helping a user select the right restaurant record, showing a map) and store only what Google expressly allows for permitted caching.
  - If you need a **persistent, shareable restaurant directory** for outbound prospecting, obtain **separate first‑party or licensed data** not derived from Google Places, and keep it logically separated.
- UI:
  - Where you display Maps/Places, show **Google attribution** and comply with logo/branding rules.
- Contracts:
  - Ensure customer contracts state that they may not export or reuse Google‑sourced data outside the application in ways that violate Google’s terms.

---

### E. Vendor Data Licensing (Third‑party Restaurant Lists, Enrichment)

**Common legal constraints** (synthesizing typical commercial data licenses & FTC guidance):

- Many data providers limit:
  - **Permitted uses** (e.g., marketing vs analytics vs resale).
  - **Redistribution** or sub‑licensing to downstream customers.
  - **Combining and co‑mingling** with other datasets in a way that recreates a derivative database.
- FTC expects **truthful representations** around data sourcing, opt‑out, and privacy; misrepresenting your data sources or privacy practices can be considered deceptive.  

**P0 implications**

- For any third‑party restaurant/contact dataset used for prospecting:
  - Treat the vendor’s contract as controlling: **no resale, no open export, no sharing** beyond allowed use cases.
  - Implement per‑field or per‑record flags showing **source** and **use restrictions** (e.g., “marketing use only, no export CSV,” “analytics only,” etc.).
  - Enforce technical controls:
    - Disable bulk export of vendor‑licensed contact data if not allowed.
    - Ensure that **customer‑uploaded data** can be exported back to that customer, but **vendor‑licensed data** cannot be “laundered” via export.
- Maintain a **data provenance registry**: for each restaurant/contact, track whether information came from (a) customer, (b) Google APIs, (c) commercial data provider X, etc., and enforce different policies.

---

### F. Privacy Policy Requirements (US‑first, Restaurant‑Tech Context)

There is **no single federal omnibus privacy law** comparable to GDPR; instead, you face:

- **Section 5 FTC Act**: prohibits **unfair or deceptive acts**, including misleading or incomplete privacy notices or violating your own posted privacy promises.  
- Emerging **state privacy laws** (e.g., California, Colorado, others) may apply depending on your scale and user footprint; you should plan for **clear disclosures, access/opt‑out mechanisms**, and data security.

**FTC expectations from enforcement and guidance**:

- Privacy policies must be **accurate, not misleading, and consistent** with actual practices.  
- You should disclose:
  - Types of personal data collected (e.g., restaurant contact names, work emails, phone numbers, device data).
  - Purposes (e.g., outbound marketing, analytics, AI model training).
  - Categories of third‑party sharing (e.g., cloud hosting, enrichment vendors, CRMs).
  - User choices/controls (opt‑out of marketing emails/SMS, DNC mechanisms).
  - Security practices at a high level.
- If you rely on **consent** (e.g., for texts), the consent language must be **clear, conspicuous, and preserved**.

**P0 implications**

- Privacy policy must:
  - Explicitly describe **B2B marketing uses** of contact data and cross‑tenant limitations.
  - Explain your **“Do Not Contact” / opt‑out rights** for email and phone.
  - Describe use of **Google Maps/Places** and external data sources at a high level.
  - Commit to **not selling/sublicensing** customer contact data in ways contrary to licenses or expectations.
- Product flows:
  - Provide links to privacy policy and terms at all points of **data capture** (lead forms, trial signups, demo requests).
  - When capturing phone consent for SMS/AI voice, show **TCPA‑compliant consent language**, referencing your policy.

---

## 2) Evidence Table with URLs

| Topic | Source | Key Point |
| --- | --- | --- |
| CAN‑SPAM basics & requirements | FTC – “CAN‑SPAM Act: A Compliance Guide for Business” | Defines commercial email, applies to B2B, requires accurate headers, non‑deceptive subject, ad identification, physical address, clear opt‑out, honoring opt‑outs within 10 business days, no sale of opt‑out addresses, sender liability.[3] URL: `https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business` |
| CAN‑SPAM – no consent requirement, B2B coverage | GDPR Local explainer (summarizing FTC rules) | Notes that under CAN‑SPAM, prior consent is not needed for US recipients, B2C or B2B, but strict rules apply; confirms 10‑business‑day opt‑out window and 30‑day validity of mechanism, and that addresses cannot be sold after opt‑out.[1] URL: `https://gdprlocal.com/usa-e-mail-marketing-rules/` |
| Cold B2B email legality under CAN‑SPAM | Various legal/compliance blogs summarizing FTC | State that CAN‑SPAM applies to B2B commercial emails and cold B2B outreach is lawful if CAN‑SPAM conditions are met.[5][6][7][8][9] (Secondary but consistent.) |
| TCPA coverage of texts & telemarketing consent | FCC TCPA guidance | FCC explains that TCPA covers calls and texts using autodialers/prerecorded or artificial voice; telemarketing often requires prior express written consent; opt‑out/DNC obligations apply. (Use current FCC TCPA consumer guide.) URL: `https://www.fcc.gov/consumers/guides/stop-unwanted-robocalls-and-texts` |
| TCPA rules & DNC registry | FCC – TCPA & DNC info | Provides details on telemarketing restrictions, Do Not Call rules, and consent expectations for marketing calls/texts to wireless and residential numbers. URL: `https://www.fcc.gov/general/telemarketing-and-robocalls` |
| Google Maps Platform Terms | Google Maps Platform Terms of Service | Defines permissible use of Google Maps/Places APIs, restrictions on storage, prefetching, creating POI databases, resale, and attribution requirements. URL: `https://cloud.google.com/maps-platform/terms` |
| Places API Policies | Google Maps Platform documentation (Places) | Details specific limitations on storing Places data, use in applications, and combining with other data sources. URL: `https://developers.google.com/maps/documentation/places/web-service/policies` |
| FTC Privacy & Data Protection expectations | FTC Business Guidance | Explains Section 5 standards: deceptive privacy statements, data security expectations, and need for truthful, clear disclosures. A relevant overview is FTC’s privacy & data security guidance. URL: `https://www.ftc.gov/business-guidance/privacy-security` |

*(For TCPA, you should rely primarily on the FCC URLs above; they are the authoritative regulator guidance. For Google, rely on Maps Platform Terms and Places policies. For CAN‑SPAM and privacy policy expectations, use the FTC URLs above.)*

---

## 3) Implications for LeadAC x FineDine Product & GTM

**P0 design requirements across the stack**

1. **Email (CAN‑SPAM)**
   - Enforce **mandatory footer** elements in templates:
     - Valid postal address.
     - Clear ad identification (e.g., “This advertisement was sent by …”).
     - Functional unsubscribe link or reply‑to mechanism.
   - Central **email suppression service**:
     - Stores opt‑out across all brands per legal scope.
     - Blocks sends at send‑time, regardless of list imports.
     - Prevents re‑sale/transfer of opt‑out addresses.
   - Admin UI:
     - Cannot save email templates or sending profiles without required fields.
     - Exposes export of a customer’s own suppression list but not others’.

2. **SMS & AI Voice (TCPA)**
   - Separate **“marketing” vs “transactional”** message types with stricter gating for marketing.
   - **Consent capture forms**:
     - Store consent type (“TCPA marketing consent”), timestamp, channel, IP/user, exact consent language version.
     - Link consent to specific phone number and brand.
   - **Automatic opt‑out handling**:
     - Built‑in STOP/UNSUBSCRIBE detection; immediate DNC flag for that number.
     - Agent-side tools to log verbal revocation.
   - Campaign launch checks:
     - Prevent sending marketing texts/AI calls to numbers lacking required consent metadata.
   - Legal configs:
     - Allow region‑based rules (e.g., US numbers vs non‑US) and customer‑specific risk settings.

3. **Data & Suppression Infrastructure**
   - Unified **Contact** object with:
     - Channels: email(s), phone(s).
     - Source (customer, vendor, Google).
     - Consent records by channel + purpose.
     - Suppression flags (email marketing, SMS

---

## API citations
- https://gdprlocal.com/usa-e-mail-marketing-rules/
- https://www.mailslurp.com/blog/cold-emailing-can-spam-compliance/
- https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business
- https://www.unsubcentral.com/can-spam-compliance/
- https://instantly.ai/blog/what-are-the-legal-requirements-for-follow-up-emails/
- https://www.truvisibility.com/blog/can-you-send-marketing-emails-to-companies/
- https://massmailer.io/glossary/can-spam-compliance/
- https://joinbreaker.ai/blog-posts/can-spam-act-requirements-b2b-marketers-know
- https://mailazy.com/blog/can-spam-act-email-marketing-compliance

## API search results
- USA e-mail marketing rules under the CAN-SPAM Act ... - GDPR Local: https://gdprlocal.com/usa-e-mail-marketing-rules/
- Cold Emailing in Compliance with CAN-SPAM Act Guidelines: https://www.mailslurp.com/blog/cold-emailing-can-spam-compliance/
- CAN-SPAM Act: A Compliance Guide for Business: https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business
- CAN-SPAM Compliance Guide | Avoid Fines & Build Trust: https://www.unsubcentral.com/can-spam-compliance/
- What Are the Legal Requirements for Follow-Up Emails Under ...: https://instantly.ai/blog/what-are-the-legal-requirements-for-follow-up-emails/
- Can You Send Marketing Emails to Companies? | TruVISIBILITY Blog: https://www.truvisibility.com/blog/can-you-send-marketing-emails-to-companies/
- CAN-SPAM Compliance: Requirements, Checklist & Salesforce Setup: https://massmailer.io/glossary/can-spam-compliance/
- CAN-SPAM Act Requirements: What B2B Marketers Must Know: https://joinbreaker.ai/blog-posts/can-spam-act-requirements-b2b-marketers-know
- Navigating the CAN-SPAM Act: A Comprehensive Guide for Email ...: https://mailazy.com/blog/can-spam-act-email-marketing-compliance