/**
 * FineDine beta — which product surfaces are in scope.
 *
 * The beta hands Revint to FineDine as a *sales intelligence layer on top
 * of HubSpot*, not as a restaurant-report tool. Per the "Finedine M2"
 * decision the beta scope is deliberately narrow: the lead queue plus the
 * call-first Lead Detail action sheet, with the restaurant analysis kept
 * underneath as supporting evidence.
 *
 * Everything switched off below is built and working, but belongs either
 * to the earlier web-agency positioning (sell a website / a priced service
 * package to a local business) or to an internal debugging surface. Both
 * read as noise — or actively mis-frame the product — to a FineDine SDR
 * whose job is "which inbound lead do I call next, and with which angle?".
 *
 * Nothing is deleted: flip a flag back to `true` to restore the surface.
 * Safe to import from client components (plain constants, no `process.env`).
 */
export const BETA_SCOPE = {
  /**
   * "Does this business need a website?" verdict tool (placeholder / basic /
   * developed). Pure web-agency framing. The website audit itself stays —
   * FineDine's SDR lives in the prospect's website and menu — but the
   * "pitch them a new site" verdict does not.
   */
  websiteContentCheck: false,

  /**
   * Shortlist / watchlist: the agency pipeline for "we are building this
   * business a site". Superseded by playbook stages for FineDine.
   */
  shortlist: false,

  /**
   * Priced agency service packages ("Recommended package", "Recommended
   * tier", package chips in the list). FineDine pitches its own modules,
   * which the playbook Angle Card covers. On a fresh workspace this card
   * only ever rendered a "configure Settings → Service Packages" nag.
   */
  servicePackages: true,

  /** Map + Kanban lead views. An inbound HubSpot queue is a list, not a map. */
  extraLeadViews: false,

  /**
   * Per-worker AI panel, chain planner and the website-plan generator.
   * Internal operator tooling — useful to us, confusing to an SDR.
   */
  workerTools: true,

  /**
   * Legacy outreach stepper tab. Conflicts with the playbook stage picker
   * in the action sheet, which is the one FineDine actually mirrors into
   * HubSpot.
   */
  outreachTab: true,

  /** Sub-niche classifier override — internal model tuning. */
  subNicheOverride: false,

  /** Per-lead voice notes. Not part of the beta workflow. */
  voiceNotes: false,

  /** Generic AI "personalized first message". The Angle Card carries the call opener. */
  personalizedMessage: true,
} as const;
