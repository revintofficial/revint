# US compliance and data rights

## Core finding

If FineDine activation becomes US-first, compliance is not a legal appendix. It is a product layer.

The minimum safe architecture:

- email compliance and suppression
- phone/SMS/AI voice consent controls
- data provenance and use-rights
- Google Places storage/display restrictions
- audit logs for outbound actions and opt-outs

This is not legal advice. It is a product research summary for counsel review.

## CAN-SPAM for B2B email

FTC guidance says CAN-SPAM covers commercial email and does not exempt B2B email. US cold commercial email can be lawful without prior opt-in if the message follows the rules.

Product implications:

- accurate From/To/Reply-To/routing information
- non-deceptive subject line
- clear commercial/ad identification
- valid physical postal address
- clear opt-out mechanism
- opt-outs honored within 10 business days
- opt-out mechanism works for at least 30 days after send
- no selling/transferring opted-out addresses except for compliance purposes
- customer and vendor monitoring

LeadAC implication:

> Email send/export should be blocked if the workspace lacks sender identity, postal address, and unsubscribe/suppression setup.

## TCPA / SMS / AI voice

TCPA and FCC rules create high risk for marketing texts, autodialed calls, prerecorded/artificial voice, and AI voice. FCC treats texts as calls for TCPA purposes. Consent and revocation must be handled carefully.

Product implications:

- marketing SMS/AI voice should require documented prior express written consent
- store consent source, timestamp, language shown, number, IP/method where relevant
- support STOP/UNSUBSCRIBE and manual revocation logging
- honor revocation quickly and suppress channel before any further send/call
- separate manual live calls from automated/AI/prerecorded workflows
- do not let users import phone lists as "safe" without consent status

LeadAC implication:

> For US beta, email and manual tasks are safer starting rails than automated SMS or AI voice.

## Google Places and data storage

Google Places is useful for canonical identity, freshness, and verification. It should not be treated as a freely storeable outbound database.

Product implications:

- store only what Google's terms permit
- preserve attribution where required
- separate Google-derived data from licensed/storeable provider data
- do not build a resold permanent places database from Google content
- use Place ID and refresh/verification patterns cautiously

LeadAC implication:

> Google Places can verify a restaurant. A storeable prospecting database should come from customer-owned data, licensed providers, or other use-right-cleared sources.

## Vendor data licensing

Openmart, Apollo, Clay provider data, Resquared, Apify-derived datasets, and other sources each carry different use rights.

Product implications:

- source provenance per field/record
- use-right flags: display, export, send, store, refresh, share
- customer-owned vs vendor-licensed separation
- no laundering restricted data into exportable fields
- suppressions and opt-outs must override all source rights

## Product checklist

- `ContactPoint` level suppression for email/phone/social.
- `SourceProvenance` for each account/contact/signal.
- `UseRightPolicy` for provider fields.
- Send-time compliance gate.
- Workspace postal address and sender identity.
- Unsubscribe and DNC audit log.
- Human review for phone/SMS/AI voice activation.
- Counsel review before US automated telemarketing.

## Sources

- FTC CAN-SPAM guide: https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business
- FTC CAN-SPAM rule: https://www.ftc.gov/legal-library/browse/rules/can-spam-rule
- FCC TCPA consumer guide: https://www.fcc.gov/consumers/guides/stop-unwanted-robocalls-and-texts
- FCC robocalls/telemarketing: https://www.fcc.gov/general/telemarketing-and-robocalls
- FCC TCPA revocation order, FCC 24-24: https://docs.fcc.gov/public/attachments/FCC-24-24A1.pdf
- FCC one-to-one consent deletion order, DA 25-621: https://docs.fcc.gov/public/attachments/DA-25-621A1_Rcd.pdf
- Google Places policies: https://developers.google.com/maps/documentation/places/web-service/policies
- Google Maps Platform terms: https://cloud.google.com/maps-platform/terms
- Google Maps Platform acceptable use policy: https://cloud.google.com/maps-platform/terms/aup
