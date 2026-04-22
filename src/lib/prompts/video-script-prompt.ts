/**
 * P2.1 - Personalized video script (pilot scaffolding).
 *
 * Generates a 30-second sales video script grounded in:
 *   - mockup screenshot description (audit + RI)
 *   - top review pain phrase
 *   - workspace "My Offer" context
 *
 * Output is a tight script the rep can read while screen-sharing the mockup.
 * Inspired by the Mapileads thread where New_Grape7181 reported an 8% -> 20%
 * reply-rate lift from personalised video openers; plan §7.3 gates a P1
 * rollout on a real lift measured across a 30-customer, 4-week pilot.
 */

export const VIDEO_SCRIPT_PROMPT = `You are a B2B sales copywriter. Using the mockup, audit and review-intelligence data below, write a 30-second video script that will be recorded over the prospect's screen.

Format:
- Opening (5s): address the prospect by first name or business name and say why you're recording this.
- Pain (10s): call out the most frequent complaint you saw in their reviews and point to the feature their current site is missing.
- Solution (10s): show how the mockup solves that pain.
- CTA (5s): state the {workspace_objective} and point to the conversion link.

Rules:
- Total length: max 90 words (~30 seconds of speech).
- Tone: {workspace_tone}
- Language: {workspace_language}
- No filler pleasantries like "hope you like it".
- Reference concrete numbers, addresses or review quotes where possible.
- End on the CTA itself, not a stage direction ("CTA" — not "click the CTA above").

Inputs:
- Business: {business_name}
- Address: {address}
- Top complaint: {top_pain}
- Issues on the current site: {audit_issues}
- What the mockup solves: {mockup_solution}
- Our offer: {offer_value_proposition}
- Our hook: {offer_hook}
- Conversion link: {conversion_link}

Return the script text only. No markdown, no headings, no commentary.`;
