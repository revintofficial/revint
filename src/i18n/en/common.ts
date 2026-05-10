/**
 * EN dictionary stub — phase 1 default locale.
 *
 * Keep this small: we only prep the shape so phase 2 can drop in a
 * sibling `src/i18n/tr/common.ts` without any key surprises.
 *
 * New entries should be added alphabetically. Every addition to this file
 * is a contract — a key missing in `tr/common.ts` after phase 2 flips on
 * is a bug that the CI seo:validate step will catch.
 */

export const common = {
  nav: {
    pricing: "Pricing",
    forAgencies: "For agencies",
    forSmma: "For SMMA",
    forSpecialists: "For specialists",
    blog: "Blog",
    glossary: "Glossary",
    tools: "Tools",
    login: "Log in",
    signup: "Sign up",
  },
  footer: {
    privacy: "Privacy",
    terms: "Terms",
    status: "Status",
    about: "About",
  },
  cta: {
    getStarted: "Get started",
    bookDemo: "Book a demo",
    seePricing: "See pricing",
  },
  leadDetailV2: {
    placeholderTitle: "Lead Detail v2 — coming soon",
    placeholderSubtitle: "The redesigned lead surface lands here in the next phases. Use ?v=1 to switch back to the current page.",
    backToLeads: "Back to leads",
    header: {
      tierLabel: "Tier",
      stageLabel: "Pipeline stage",
      changeStage: "Change stage",
      dial: "Dial",
      email: "Email",
      voiceNote: "Voice note",
      moreActions: "More actions",
      edit: "Edit",
      archive: "Archive",
      discard: "Discard",
      powerTools: "Power tools",
    },
    stages: {
      COLD: "Cold",
      CONTACTED: "Contacted",
      REPLIED: "Replied",
      MEETING_BOOKED: "Meeting booked",
      PROPOSAL: "Proposal",
      NEGOTIATING: "Negotiating",
      WON: "Won",
      LOST: "Lost",
    },
    whyNow: {
      title: "Why now",
      empty: "No active trigger. Run discovery to surface a reason to act.",
      windowDays: "Act within {days}d",
      windowToday: "Act today",
    },
    nextGesture: {
      title: "Next gesture",
      preliminary: "Preliminary",
      final: "Final",
      empty: "Brain is still cooking the recommendation. The first read drops in seconds.",
      openFullGraph: "Open full graph",
      dial: "Dial",
      email: "Email",
      whatsapp: "WhatsApp",
      schedule: "Schedule",
      snooze: "Snooze",
    },
    preliminaryBanner: {
      message: "Preliminary plan is dial-able — final reasoning still loading.",
    },
    updatedToast: {
      message: "Updated {seconds}s ago",
    },
    blocks: {
      who: "Who",
      discovery: "Discovery",
      qualification: "Qualification",
      history: "History",
      account: "Account",
      whoStub: "Stakeholders coming in the next phase.",
      discoveryStub: "Voice notes + SPIN board coming in the next phase.",
      qualificationStub: "BANT + ICP + MEDDPICC coming in the next phase.",
      historyStub: "Activity timeline coming in the next phase.",
      accountStub: "Sister-lead navigation coming in the next phase.",
      placeholderBody: "This block lights up in the next phase.",
    },
    evidence: {
      sourceLabel: "Source",
      dismiss: "Dismiss",
      types: {
        linkedin: "LinkedIn",
        review: "Review",
        audit: "Audit",
        "voice-note": "Voice note",
        "prior-nba": "Prior plan",
        contradiction: "Contradiction",
      },
    },
    qualification: {
      loading: "Reading the qualification rollup…",
      empty: "No qualification facts yet. Run a discovery call to start filling MEDDPICC.",
      meddpiccTitle: "MEDDPICC",
      icp: {
        labels: {
          revenue: "Revenue",
          staff: "Staff",
          stack: "Tech stack",
          geo: "Geo",
          vertical: "Vertical",
          total: "ICP fit",
        },
        unknown: "n/a",
      },
      bant: {
        overall: "BANT",
        labels: {
          budget: "Budget",
          authority: "Authority",
          need: "Need",
          timing: "Timing",
        },
        status: {
          present: "Present",
          partial: "Partial",
          missing: "Missing",
        },
      },
      meddpicc: {
        labels: {
          metrics: "Metrics",
          economicBuyer: "Economic buyer",
          decisionCriteria: "Decision criteria",
          decisionProcess: "Decision process",
          identifyPain: "Identify pain",
          champion: "Champion",
          competition: "Competition",
        },
        status: {
          present: "Captured",
          partial: "Partial",
          missing: "Missing",
        },
      },
      meddpiccLocked: {
        title: "MEDDPICC locked",
        description: "Upgrade to surface metrics, economic buyer, decision criteria, and the rest of the MEDDPICC rollup.",
        cta: "Upgrade",
        requiredPlan: "Available on Pro and above.",
      },
    },
    discovery: {
      loading: "Loading SPIN discovery…",
      empty: "No discovery items yet. Drop a voice note to start the SPIN board.",
      voiceNoteFab: {
        recordLabel: "Record voice note",
        notWiredHint: "Recorder lives in the legacy panel; full FAB ships in phase 5.",
      },
      spin: {
        columns: {
          SITUATION: "Situation",
          PROBLEM: "Problem",
          IMPLICATION: "Implication",
          NEED_PAYOFF: "Need-payoff",
        },
        emptyColumn: "No items captured yet.",
      },
      locked: {
        title: "SPIN board locked",
        description: "Upgrade to capture situation/problem/implication/need-payoff items per discovery call.",
        cta: "Upgrade",
        requiredPlan: "Available on Pro and above.",
      },
    },
    who: {
      loading: "Loading buying committee…",
      empty: "No stakeholders mapped yet. Run the buying-committee mapper from power tools.",
      card: {
        unknownName: "Unnamed stakeholder",
        rosette: {
          champion: "Champion",
          "economic-buyer": "Economic buyer",
          blocker: "Blocker",
          stakeholder: "Stakeholder",
        },
        championLabel: "Champion",
        influenceLabel: "Influence",
      },
    },
    history: {
      loading: "Loading activity timeline…",
      empty: "No activity yet. Logged calls, emails, and notes will appear here.",
      timelineHeading: "Activity",
      objectionsHeading: "Predicted vs. real objections",
      activityKindLabels: {
        CALL_LOGGED: "Call logged",
        EMAIL_SENT: "Email sent",
        EMAIL_OPENED: "Email opened",
        EMAIL_REPLIED: "Email replied",
        NOTE_ADDED: "Note added",
        VOICE_NOTE_ADDED: "Voice note added",
        STATUS_CHANGED: "Status changed",
        STAGE_CHANGED: "Stage changed",
        TASK_CREATED: "Task created",
        TASK_COMPLETED: "Task completed",
      },
    },
    objections: {
      emptyDiff: "No predicted or real objections yet.",
      predictedAndRealHeading: "Predicted and real",
      predictedNotRealHeading: "Predicted but skipped",
      realOnlyHeading: "Surfaced live (not predicted)",
      rebuttalLanded: "Rebuttal landed.",
      rebuttalSkipped: "Buyer never raised it.",
      rebuttalMissing: "No rebuttal recorded.",
      noRebuttal: "Capture a rebuttal in your next call.",
    },
  },
} as const;

type _Raw = typeof common;
type Widen<T> = T extends string
  ? string
  : T extends ReadonlyArray<infer U>
    ? ReadonlyArray<Widen<U>>
    : T extends object
      ? { readonly [K in keyof T]: Widen<T[K]> }
      : T;

export type CommonDictionary = Widen<_Raw>;
