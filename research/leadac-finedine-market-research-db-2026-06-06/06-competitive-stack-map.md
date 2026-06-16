# Competitive stack map

## Core finding

The market is crowded at the data, enrichment, CRM, and sender layers. LeadAC should avoid claiming "we find local businesses" as the main wedge. The stronger wedge is:

> post-enrichment account judgment + FineDine-specific pitch selection + outcome learning

## Layer map

| Layer | Tools | What they own | Gap for LeadAC |
|---|---|---|---|
| Local SMB data rail | Openmart, Resquared, Google Places, Apify actors | Business records, categories, contact data, websites, reviews, place IDs, local search. | They do not know FineDine's offer logic or what converted for FineDine. |
| SMB account intelligence | Orbital, Openmart, Resquared, custom Clay/Apify workflows | SMB attributes, location count, tech stack, owner/contact, vertical signals. | Often generic or raw; not tied to FineDine outcomes. |
| Enrichment/workflow workbench | Clay | Waterfall enrichment, AI research, tables, custom workflows, webhooks. | Blank canvas. Customer must design the playbook and learning loop. |
| CRM / system of record | HubSpot, Salesforce, Pipedrive | Company/contact/deal/activity truth, owner assignment, pipeline. | Records what happened; does not automatically explain which signals caused success. |
| Sender / sequence rail | Smartlead, Instantly, Apollo sequencing, Gmail/Outlook | Campaigns, deliverability, reply/bounce/unsub, inbox rotation. | Sends messages; does not decide which restaurant deserves which FineDine angle. |
| Broad B2B data + outbound | Apollo, ZoomInfo-like tools | B2B contact database, sequences, enrichment. | Strong for professional B2B contacts, weaker for local restaurant context. |
| Deep research infrastructure | Apify, custom crawlers, browser automation | Review/social/site crawling and custom extraction. | Infrastructure, not productized GTM judgment. |
| Outcome learning | Mostly fragmented across CRM, senders, BI, manual analysis. | Reply/open/bounce/deal data, sometimes dashboards. | FineDine-specific "which signal + pitch + channel worked" memory is under-owned. |

## Competitor implications

### Openmart

Strong at local business data and owner/contact enrichment. Best treated as an upstream rail, not a direct enemy. If Openmart adds closed-loop action learning, it becomes more threatening.

LeadAC stance:

> "Openmart can help fill the market. LeadAC decides which accounts matter for FineDine and learns from outcomes."

### Orbital

Strongest conceptual overlap if it is positioned as SMB account intelligence. Needs continued monitoring.

LeadAC stance:

> "Orbital-like tools provide SMB signals. LeadAC should own FineDine-specific decision standards and activation memory."

### Resquared

Strong local-business selling workflow angle. More directly relevant for local SMB outreach than generic B2B tools.

LeadAC stance:

> "Resquared helps reach local businesses. LeadAC should learn which restaurant signals and motions create FineDine outcomes."

### Clay

The main objection: "We can build this in Clay."

Answer:

> "Yes, parts of it. Clay is a blank canvas for enrichment and workflow. LeadAC's value is the restaurant-tech playbook, decision logic, and outcome loop so FineDine does not have to rebuild the same operating system from scratch."

### Apollo

Useful for corporate/HQ/multi-location contacts, less defensible as a restaurant-local context layer.

Answer:

> "Apollo can stay for B2B contacts. LeadAC should point the team toward which restaurant accounts and angles are worth activating."

### HubSpot

HubSpot should be the system of record, not a competitor.

Answer:

> "HubSpot tells us what happened. LeadAC should help explain why it happened and what to do next."

### Smartlead / Instantly

Sender rails. Keep them.

Answer:

> "They send. LeadAC decides what deserves to be sent, to whom, and what should be learned afterward."

## Sources

- Openmart local business API: https://www.openmart.com/products/local-business-data-api
- Openmart local marketing: https://www.openmart.com/product/local-marketing
- Orbital SMB account intelligence: https://www.withorbital.com/
- Orbital blog: https://www.withorbital.com/blog/orbital-the-smb-tool-you-actually-need
- Resquared: https://www.re2.ai/
- Resquared FAQ: https://www.re2.ai/faq
- Clay waterfall enrichment: https://www.clay.com/waterfall-enrichment
- Google Places: https://mapsplatform.google.com/maps-products/places/
- Google Places API docs: https://developers.google.com/maps/documentation/places/web-service
