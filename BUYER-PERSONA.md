# LeadAC — buyer personas

Six personas. Each one maps to an existing or planned vertical landing page. The shared profile across all six is at the bottom (skip there if you're scanning for the common thread).

This file feeds copy for vertical landings, ad targeting, cold email subject lines, and onboarding survey logic. Read the persona before you write copy that addresses them.

---

## 1. B2B outbound agency owner

**Where they live:** `src/app/(marketing)/for/agencies/page.tsx`

**Setup:** Owner-operator, one to three SDRs (often a mix of in-house and overseas contractors). $20k to $80k/month in retainers from B2B clients. Sells lead gen / appointment setting / pipeline-as-a-service.

**Day in life:**
6:30am check Smartlead deliverability. 8am stand-up with the SDR pod. 9-11am writing variant openers because last week's reply rate dipped. 12pm-2pm client check-in calls. Afternoon: refining sequences, pitching new prospects, and rebuilding lists because Apollo just spat out the same companies they pulled three weeks ago. Closes laptop at 9pm wondering if the SDR they hired in February is going to work out.

**The thing that triggered them to look for a tool like LeadAC:**
- Reply rate dropped from 4% to 1.6% over Q1 2026
- Two clients churned citing "your pipeline isn't moving"
- The SDR pod is asking for a personalization assistant; the obvious move is hiring a research VA, but $4-6k/month hurts when retainer revenue is already soft

**Decision criteria (in order):**
1. Does it actually pull data Apollo doesn't have?
2. How fast can I get a campaign out the door — same-day or wait-for-onboarding?
3. Does it work with Smartlead and Instantly, or do I have to migrate?
4. What does month 4 look like (does it stay good after the novelty wears off)?
5. Pricing per seat or per workspace?

**Objections we'll hear:**
- "We tried [tool]; the data was stale within a week."
- "I don't need another login."
- "AI personalization tanked our deliverability last time."
- "Can my SDR use it without training?"

**Language samples (lifted from r/coldemail, r/agency):**
- "Same 50M contacts. Same crawls. Same emails to the same prospects."
- "AI is dying as a tactic, but Maps is the most underrated database in cold email."
- "I'm not paying $300/mo per seat for a contact dump."
- "If your reply rate isn't 3-4%+ and deliverability isn't 96%+, nothing else matters."

**Headline that works for them:**
"Apollo is exhausted. Pull fresh, ship today."

**Headline that does NOT work:**
"Build AI agents to automate your outreach." (Triggers the AI-tourist filter; signals we don't know who they are.)

---

## 2. SMMA owner

**Where they live:** `src/app/(marketing)/for/smma/page.tsx`

**Setup:** 1-5 person social media / paid ads agency. $5k to $25k/month MRR. Sells $1,000-$3,000/month retainers to local restaurants, dentists, gyms, contractors. Half the team is the founder; the other half is a VA, an editor, and a part-time SDR.

**Day in life:**
9am client meetings. 11am editing reels. 1pm running ads QA. 3pm onboarding call with a new lead. 5pm debating with themselves whether to drop their pricing because three competitors just undercut them by 30% on Upwork. 8pm watching another "I made $50k MRR with my agency" YouTube video and wondering what they're missing.

**The thing that triggered them:**
- Pricing pressure from cheaper competitors (LATAM agencies, AI-content shops)
- Pipeline is dry; they only get clients via referrals or Upwork
- Burnt out on Upwork's race to the bottom; want outbound but never had a system that worked

**Decision criteria:**
1. Will I get retainer clients (not one-off projects)?
2. Can I run this without hiring an SDR?
3. How long until the first booked call?
4. Does it cost less than my current Apollo + ChatGPT + research time?

**Objections:**
- "I tried cold email three times. Doesn't work for SMMAs."
- "$249/mo is half my smallest retainer."
- "I don't have time to learn another tool."

**Language samples (r/SMMA):**
- "I need a predictable way to get clients. Not another course, not another tool. A system."
- "Everyone's selling courses. Where's the actual playbook?"
- "Cold email worked for 6 months then died."

**Headline that works:**
"Stop racing to the bottom on Upwork. One system, retainer-grade clients in week 4."

**Headline that does NOT work:**
"Scale your agency to $100k MRR with AI." (Hype tone; we trained them to recognize and reject this.)

---

## 3. Specialist going solo

**Where they live:** `src/app/(marketing)/for/specialists/page.tsx`

**Setup:** Klaviyo / paid social / SEO / CRO / web designer who spent 3-7 years inside an agency or in-house team and is now starting their own book. Knows their craft cold. Has one client (often the previous employer's referral) and is panicking about how to get the next two.

**Day in life:**
Morning: doing the work for that one client (and over-delivering because they're terrified of churn). Afternoon: scrolling LinkedIn, drafting a cold email that they never send, watching SaaSquatch pricing pages, and adding fifteen tools to a "free trial" tab they never close.

**The thing that triggered them:**
- That first retainer is paying rent but not much else
- They know if they don't land 2-3 more clients in the next 60 days, they're back on the job market
- They literally do not know how agencies acquire clients — they were an executor for years, not a seller

**Decision criteria:**
1. How fast can I get my first booked call (week 1, 2, 4)?
2. Will the AI write something that doesn't sound like every other AI cold email?
3. Can I afford this on one retainer's worth of profit?

**Objections:**
- "I'm not a salesperson. This isn't going to work for me."
- "I tried writing cold emails. They got ignored."
- "Should I just hire a fractional SDR instead?"

**Language samples (r/agency):**
- "I worked as an executor for four years. I know Klaviyo cold. I don't know how agencies actually acquire clients."
- "I have one client. I need three. Where do I even start?"
- "Every guru sells a $2k course. I don't have $2k."

**Headline that works:**
"You know the craft. We handle the pipeline. First three retainers in 60 days."

**Headline that does NOT work:**
"Become a 7-figure agency owner." (Wrong frame; this person doesn't believe in 7-figure outcomes yet, and the claim signals scam.)

---

## 4. Walk-in web agency

**Where they live:** `src/app/(marketing)/for/walk-in-web-agencies/page.tsx`

**Setup:** Local web design / web services agency. Often the founder + one or two designers + a salesperson. Pitches local SMBs (cafes, dentists, plumbers) on website redesigns at $1,500-$5,000 per project plus a $200-$800/month maintenance retainer. Door-knocking, networking events, BNI groups, local Facebook groups.

**Day in life:**
8am breakfast meeting at a local cafe (which doubles as a sales meeting). 10am driving to a job site for a kickoff. Lunch with a referral partner. Afternoon: design work and proposal-writing. Evening: networking event or Chamber of Commerce.

**The thing that triggered them:**
- Door-knocking does not scale past 30 clients
- Their salesperson costs $5k/month and brings in maybe 4 leads
- Referrals dried up because all their happy clients already referred everyone they know

**Decision criteria:**
1. Does it tell me which local businesses have actually-bad websites I can pitch?
2. Can I show up to the meeting with a mockup already half-built? (This is the one persona where mockup IS the pitch.)
3. Does the audit signal something concrete to talk about ("your booking widget is broken on mobile")?

**Objections:**
- "I close better in person. Why do I need cold email?"
- "Mockups feel cheesy."
- "My region is too small for this to work."

**Language samples:**
- "I close 1 in 4 in-person. The bottleneck is getting in the room."
- "I need a way to know which dentist has a broken booking widget before I walk in."

**Headline that works:**
"Walk into the meeting with the audit and the mockup already done."

**This is the persona where mockup belongs front and center.** For all other personas, mockup is a sub-feature.

---

## 5. F&B / restaurant-tech BD team (planned vertical)

**Where they will live:** `src/app/(marketing)/for/fnb-tech/page.tsx` (NEW in Phase D)

**Setup:** B2B SaaS BD team selling to restaurants, cafes, bars, hotels. 2-10 person business development team at a company like FineDine, Toast, Square for Restaurants, or a regional POS / QR-menu vendor. The BD reps are part outbound SDR, part account exec, part on-the-ground demo runner.

**Day in life:**
8am pull a list of new restaurants opened in the past 30 days. 9-11am manually check each one's website, social, and online ordering setup. 11am-1pm calls with shortlisted prospects. Afternoon: in-person demos at restaurants in the territory. Evening: write up activity in HubSpot.

**The thing that triggered them:**
- Manual restaurant research caps each BD rep at 30-40 prospects per day
- Their existing list (purchased B2B database) has stale or wrong data ("this restaurant closed a year ago")
- Reply rates on cold email to GMs are <1% because the messaging is generic

**Decision criteria:**
1. Does it identify restaurants by sub-niche (fine dining, cafe, ghost kitchen)?
2. Does it audit their actual digital setup (QR menu, online ordering, reservations)?
3. Can it tell me which prospects are missing the things our product solves?

**Objections:**
- "We have HubSpot already."
- "Most local restaurants don't reply to cold email anyway."
- "Our BD team needs in-person, not more email."

**Language samples (FineDine beta tester transcript, anonymized):**
- "I'm spending 80% of my time researching, 20% pitching."
- "I want a list of 50 cafes in Camden that don't have QR ordering today."
- "The opener has to mention something specific about their setup or it doesn't get read."

**Headline that works:**
"Manual restaurant research is killing your BD throughput. Audit 30 cafes per minute."

**Existing evidence:** FineDine beta cohort (Camden cafes, May 2026). 12 leads audited and shortlisted. See `research/finedine/beta-test-round-2-camden-report.md`.

---

## 6. Local SEO agency (planned vertical)

**Where they will live:** `src/app/(marketing)/for/local-seo/page.tsx` (NEW in Phase D)

**Setup:** 2-10 person local SEO / GMB-optimization agency. Pitches small businesses (lawyers, plumbers, dentists, contractors) on Google Business Profile management, local citation cleanup, and ongoing rank monitoring. Retainers $300-$1,500/month per client.

**Day in life:**
Morning: rank tracking reports for 30-50 client accounts. Mid-morning: GMB post scheduling. Afternoon: client calls and prospect calls. Evening: cold email outbound that mostly goes nowhere because their pitch ("we'll improve your local SEO") sounds the same as every other local SEO agency.

**The thing that triggered them:**
- Their pitch is commodity ("we do local SEO") and prospects ignore the email
- They can't differentiate without doing custom audits, but custom audits take 30 minutes per prospect
- Conversion from audit-call to retainer is stuck at 15%; they want 30-40%

**Decision criteria:**
1. Does the audit specifically score GMB / citation / on-page SEO health?
2. Can I send a prospect a one-page "here's what's broken on your local SEO" report on first contact?
3. Will it scale to 50-100 prospects a week?

**Objections:**
- "I already have ahrefs / SEMrush."
- "Local SEO data needs human interpretation."

**Language samples:**
- "Our cold email pitch sounds the same as every other agency in town."
- "If I could send them their own audit, the call book rate would double."

**Headline that works:**
"Stop pitching 'local SEO services.' Send the prospect their own audit instead."

---

## Shared profile (the common thread)

What every one of these six has in common:

1. **They are operators, not marketers.** They do not respond to "transformative" or "groundbreaking" copy. They respond to specific numbers and concrete mechanism.
2. **They have already tried 2-5 tools that disappointed them.** Skepticism is the default. Earn the click.
3. **They live on Reddit, agency Slacks, and LinkedIn.** Not Twitter, not Product Hunt, not Hacker News.
4. **They want a system, not another tool.** "Tool" is a loaded word for them — it implies more learning curve, another tab, another credit-card form. Lead with the outcome (signed clients, replies, booked calls), not the tool.
5. **They are price-sensitive but not cheap.** $79-249/month is fine if it pays for itself in week 4. $0 free plans signal "tourist product" to them.
6. **They want proof, not promises.** Specific cohort numbers, named (or specifically anonymized) case studies, screenshots of the actual product work better than testimonial quotes from "Sarah, growth marketer."

**One pattern that works across all six:** the page that sounds like it was written by another agency owner. Not by a marketing department. The voice is the entire pitch.

---

Last updated: 2026-05-06 (Phase A of web-presence overhaul).
