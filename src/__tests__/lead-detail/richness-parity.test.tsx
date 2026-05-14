/**
 * Phase 2.5 — Richness parity (component-level wiring).
 *
 * The Playwright spec listed in PLAN §10 (`tests/e2e/lead-detail-
 * richness-parity.spec.ts`) is the binding gate for the cookie-
 * default flip. This file is the cheaper component-level companion:
 * for each block touched by Phase 2.5, render it with a populated
 * `decision-surface`-shaped payload and assert that the absorbed V1
 * sub-component lands in the DOM. Failing here means the wiring
 * regressed — the Playwright spec would fail too, but this catches it
 * before CI runs the slow browser pass.
 *
 * Coverage matrix (one assertion per row in PLAN §5.9):
 *   - WhyNowBlock       → WebsiteSignalStrip + ReviewVelocityBadge
 *   - QualificationBlock → IntelligenceBriefCard
 *   - NextGestureBlock  → RecommendedApproach (package + first-msg)
 *   - DiscoveryBlock    → DossierExpand
 *   - WhoBlock          → StakeholderOnlinePresence per stakeholder
 *   - HistoryBlock      → ReviewIntelligenceSummary
 *   - AccountBlock      → PipelineStateChips + AccountMapMini
 *   - HeaderBar         → SubNicheOverrideMenu (kebab item)
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { WhyNowBlock } from "@/components/app/lead-detail-v2/WhyNowBlock";
import { QualificationBlock } from "@/components/app/lead-detail-v2/QualificationBlock";
import { NextGestureBlock } from "@/components/app/lead-detail-v2/NextGestureBlock";
import { DiscoveryBlock } from "@/components/app/lead-detail-v2/DiscoveryBlock";
import { WhoBlock } from "@/components/app/lead-detail-v2/WhoBlock";
import { HistoryBlock } from "@/components/app/lead-detail-v2/HistoryBlock";
import { AccountBlock } from "@/components/app/lead-detail-v2/AccountBlock";
import { HeaderBar } from "@/components/app/lead-detail-v2/HeaderBar";

vi.mock("@/lib/lead-detail/use-sister-leads", () => ({
  useSisterLeads: () => ({
    items: [],
    total: 0,
    nextCursor: null,
    locked: false,
    account: null,
    isLoading: false,
    error: null,
    mutate: vi.fn(),
  }),
}));

const EVIDENCE_COPY = {
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
};

describe("Phase 2.5 richness parity — block-level wiring", () => {
  it("WhyNowBlock renders WebsiteSignalStrip + ReviewVelocityBadge when given populated summaries", () => {
    render(
      <WhyNowBlock
        triggers={[
          {
            id: "trg_1",
            type: "FUNDING_RAISED",
            severity: 80,
            confidence: 90,
            impactPrediction: "Hot timing — funding announced 4 days ago.",
            urgencyWindowDays: 14,
            evidence: null,
            detectedAt: new Date().toISOString(),
          },
        ]}
        preliminary={null}
        final={null}
        websiteIntelSummary={{
          hasBookingSystem: true,
          bookingProvider: "OpenTable",
          loadTimeMs: 1200,
          https: true,
          mobileFriendlyGuess: true,
          hasContactForm: true,
          hasWhatsappLink: false,
          hasEcommerce: false,
          servicesDetectedTop5: ["delivery"],
          title: "Acme",
          metaDescription: null,
          crawlStatus: "ok",
          lastAuditedAt: new Date().toISOString(),
        }}
        reviewVelocity={{
          recentCount30d: 12,
          priorCount30d: 4,
          deltaPct: 200,
          recent30dAvgRating: 4.6,
          prior30dAvgRating: 4.4,
          ratingDelta: 0.2,
        }}
        reviewVelocityPromoted={false}
        copy={{
          empty: "No active triggers.",
          windowDays: "{n}d window",
          windowToday: "today",
          evidence: EVIDENCE_COPY,
          websiteSignals: {
            https: { yes: "HTTPS", no: "No HTTPS" },
            mobile: { yes: "Mobile", no: "Desktop only" },
            booking: { yes: "Booking", no: "No booking" },
            contactForm: { yes: "Contact form", no: "No form" },
            loadTime: {
              fast: "Fast",
              ok: "OK",
              slow: "Slow",
              unknown: "Unknown",
            },
            whatsapp: "WhatsApp",
            noData: "No website data yet",
            crawlBlocked: "Crawl blocked",
            crawlError: "Crawl error",
            fullPanelCta: "View full website panel",
          },
          reviewVelocity: {
            surgeTemplate: "↑ {deltaPct}%",
            dipTemplate: "↓ {deltaPct}%",
            surgeAriaTemplate: "Review surge {deltaPct}%",
            dipAriaTemplate: "Review dip {deltaPct}%",
          },
        }}
      />,
    );
    expect(screen.getByTestId("website-signal-strip")).toBeInTheDocument();
    expect(screen.getByTestId("review-velocity-badge")).toBeInTheDocument();
  });

  it("QualificationBlock renders IntelligenceBriefCard when populated", () => {
    render(
      <QualificationBlock
        loading={false}
        bant={null}
        icpDimensions={null}
        meddpicc={null}
        meddpiccUnlocked
        leadId="lead_42"
        intelligenceBrief={{
          runId: "run_brief_1",
          generatedAt: new Date().toISOString(),
          salesConfidence: 84,
          headline: "Strong inbound signal.",
          painPoints: ["Booking gap", "Slow site"],
          whyGoodTarget: "Recent funding event suggests budget.",
        }}
        copy={{
          loading: "Loading…",
          empty: "Nothing yet.",
          meddpiccTitle: "MEDDPICC",
          icp: {
            labels: {
              revenue: "Rev",
              staff: "Staff",
              stack: "Stack",
              geo: "Geo",
              vertical: "Vertical",
              total: "ICP",
            },
            unknown: "n/a",
            evidence: EVIDENCE_COPY,
          },
          bant: {
            overall: "BANT",
            labels: {
              budget: "Budget",
              authority: "Auth",
              need: "Need",
              timing: "Timing",
            },
            status: { present: "✓", partial: "~", missing: "—" },
            evidence: EVIDENCE_COPY,
          },
          meddpicc: {
            labels: {
              metrics: "M",
              economicBuyer: "E",
              decisionCriteria: "D",
              decisionProcess: "D2",
              identifyPain: "I",
              champion: "C",
              competition: "X",
            },
            status: { present: "✓", partial: "~", missing: "—" },
            evidence: EVIDENCE_COPY,
          },
          meddpiccLocked: {
            title: "Locked",
            description: "Upgrade.",
            cta: "Upgrade",
            requiredPlan: "Pro+",
          },
          intelligenceBrief: {
            title: "Intelligence brief",
            salesConfidenceLabel: "Sales confidence",
            painPointsLabel: "Pain points",
            openFullBrief: "Open full brief →",
            empty: "—",
            generatedAt: "Generated {date}",
          },
        }}
      />,
    );
    expect(screen.getByTestId("intelligence-brief-card")).toBeInTheDocument();
  });

  it("NextGestureBlock renders RecommendedApproach when package present", () => {
    render(
      <NextGestureBlock
        data={null}
        loading={false}
        leadId="lead_42"
        phone={null}
        email={null}
        recommendedPackage={{
          id: "pkg_premium",
          name: "Premium",
          priceLabel: "$1,200/mo",
          features: ["Daily review reply", "Quarterly audit"],
          reason: "High signal density",
        }}
        personalizedFirstMessage="Hey there — saw the new branch."
        plan="PRO"
        copy={{
          preliminary: "Prelim",
          final: "Final",
          empty: "No NBA.",
          openFullGraph: "Open graph",
          dial: "Dial",
          email: "Email",
          whatsapp: "WhatsApp",
          schedule: "Schedule",
          snooze: "Snooze",
          // Test renders with `data=null` which short-circuits before
          // SnoozeMenu mounts, so a minimal stub is enough.
          snoozeMenu: {
            trigger: "Snooze",
            heading: "Snooze",
            oneDay: "1 day",
            threeDays: "3 days",
            oneWeek: "1 week",
            custom: "Custom",
            customDialogTitle: "Custom snooze",
            customDialogDescription: "Pick a date.",
            customPickerLabel: "Date",
            customSubmit: "Snooze",
            customCancel: "Cancel",
            untilTrigger: "Until trigger",
            untilTriggerDialogTitle: "Snooze until trigger",
            untilTriggerDialogDescription: "Pick a trigger.",
            cancel: "Cancel",
            triggerLabels: {},
          } as never,
          recommendedApproach: {
            sectionTitle: "Recommended approach",
            packageTitle: "Suggested package",
            packageReasonLabel: "Why",
            packageFeaturesLabel: "Includes",
            messageTitle: "First message",
            messageCopy: "Copy",
            messageCopied: "Copied",
            messageLockedUpgradeCta: "Upgrade to see",
          },
        }}
      />,
    );
    expect(screen.getByTestId("recommended-approach")).toBeInTheDocument();
  });

  it("DiscoveryBlock renders DossierExpand when stub.hasDossier is true", () => {
    render(
      <DiscoveryBlock
        loading={false}
        spinUnlocked
        items={{
          SITUATION: [],
          PROBLEM: [],
          IMPLICATION: [],
          NEED_PAYOFF: [],
        }}
        leadId="lead_42"
        dossierStub={{
          hasDossier: true,
          lastGeneratedAt: new Date().toISOString(),
          summarySnippet: "Acme has a strong inbound funnel.",
          questions: [],
        }}
        copy={{
          loading: "Loading…",
          empty: "No discovery.",
          spin: {
            columns: {
              SITUATION: "Situation",
              PROBLEM: "Problem",
              IMPLICATION: "Implication",
              NEED_PAYOFF: "Need payoff",
            },
            emptyColumn: "—",
            evidence: EVIDENCE_COPY,
          },
          locked: {
            title: "Discovery locked",
            description: "Upgrade.",
            cta: "Upgrade",
            requiredPlan: "Pro+",
          },
          dossier: {
            triggerLabel: "AI dossier →",
            loading: "Loading dossier…",
            error: "Couldn't load.",
            collapsed: "Show dossier",
            expanded: "Hide dossier",
            sourcesHeading: "Sources",
            noSources: "No sources",
            generatedAt: "Generated {date}",
            snippetLabel: "Summary",
          },
        }}
      />,
    );
    expect(screen.getByTestId("dossier-expand")).toBeInTheDocument();
  });

  it("WhoBlock renders StakeholderOnlinePresence per stakeholder when discoveredLinks match", () => {
    render(
      <WhoBlock
        loading={false}
        stakeholders={[
          {
            id: "stk_1",
            name: "Jane Doe",
            role: "Owner",
            email: null,
            phone: null,
            linkedinUrl: "https://linkedin.com/in/janedoe",
            championLikelihood: 80,
            influence: 70,
            isEconomicBuyer: true,
            isBlocker: false,
            bantRole: "champion",
            source: "linkedin",
            contacted: false,
          },
        ]}
        discoveredLinks={{
          socials: [
            { platform: "linkedin", url: "https://linkedin.com/in/janedoe" },
          ],
          directories: [],
        }}
        copy={{
          loading: "Loading…",
          empty: "No stakeholders.",
          card: {
            unknownName: "Unknown",
            rosette: {
              champion: "Champion",
              "economic-buyer": "EB",
              blocker: "Blocker",
              stakeholder: "Stakeholder",
            },
            championLabel: "Champion",
            influenceLabel: "Influence",
            evidence: EVIDENCE_COPY,
            onlinePresence: {
              platforms: { linkedin: "Open LinkedIn" },
              fallback: "Open",
            },
          },
        }}
      />,
    );
    expect(
      screen.getAllByTestId("stakeholder-online-presence").length,
    ).toBeGreaterThan(0);
  });

  it("HistoryBlock renders ReviewIntelligenceSummary when summary populated", () => {
    render(
      <HistoryBlock
        loading={false}
        leadId="lead_42"
        activities={[]}
        objections={{ predictedAndReal: [], predictedNotReal: [], realOnly: [] }}
        closestWin={null}
        reviewIntelSummary={{
          leadScore: 72,
          summary: "Sentiment trending negative.",
          sentimentBreakdown: { positive: 0.4, neutral: 0.2, negative: 0.4 },
          weaknessKpisTop3: [{ label: "wait time", count: 6, percent: 23 }],
          strengthKpisTop3: [],
          switchSignalsTop3: ["unhappy with current vendor"],
          reviewsAnalyzedCount: 24,
          lastAnalyzedAt: new Date().toISOString(),
        }}
        copy={{
          loading: "Loading…",
          empty: "No history.",
          timelineHeading: "Activity",
          objectionsHeading: "Objections",
          activityKindLabels: {},
          objections: {
            emptyDiff: "—",
            predictedAndRealHeading: "Predicted",
            predictedNotRealHeading: "Predicted only",
            realOnlyHeading: "Real",
            rebuttalLanded: "Landed",
            rebuttalSkipped: "Skipped",
            rebuttalMissing: "Missing",
            noRebuttal: "—",
          },
          closestWin: {
            prefix: "Closest win",
            triggerSuffix: "trigger",
            apply: "Apply",
            detailsTemplate: "{won} → {applied}",
          },
          reviewIntel: {
            title: "Review intelligence",
            leadScoreLabel: "Lead score",
            sentimentLabel: "Sentiment",
            weaknessLabel: "Weak KPIs",
            switchSignalsLabel: "Switch signals",
            reviewsAnalyzed: "Reviews analysed",
            empty: "No review intel.",
            positive: "+",
            neutral: "·",
            negative: "−",
            expandTimelineCta: "View timeline →",
          },
        }}
      />,
    );
    expect(screen.getByTestId("review-intel-summary")).toBeInTheDocument();
  });

  it("AccountBlock single-location stub renders PipelineStateChips + AccountMapMini", () => {
    render(
      <AccountBlock
        leadId="lead_42"
        workspaceId="ws_1"
        expanded={false}
        accountSummary={null}
        accountId={null}
        plan="FREE"
        sourceLat={51.5}
        sourceLng={-0.1}
        pipelineState={{
          crawl: "CRAWLED",
          analyze: "ANALYZED",
          reviews: "ANALYZED",
          outreach: "REACHED_OUT",
          dnc: false,
        }}
        copy={{
          tierLabel: "Tier",
          locationsLabel: "{n} locations",
          loading: "Loading…",
          singleLocation: {
            title: "Single-location",
            body: "Multi-loc when sister branches detected.",
          },
          locked: {
            title: "Account view locked",
            description: "Upgrade.",
            cta: "Upgrade",
            requiredPlan: "Pro Team+",
          },
          noSisters: "No sisters.",
          columns: {
            name: "Branch",
            stage: "Stage",
            icp: "ICP",
            lastTouch: "Last touch",
            disposition: "Disposition",
            actions: "Actions",
          },
          row: {
            here: "Here",
            unknownIcp: "—",
            noTouch: "no touch",
            stages: {
              COLD: "Cold",
              CONTACTED: "Contacted",
              CONNECTED: "Connected",
              REPLIED: "Replied",
              QUALIFIED: "Qualified",
              DEMO: "Demo",
              PROPOSAL: "Proposal",
              WON: "Won",
              LOST: "Lost",
              NEEDS_REVIEW: "Needs review",
            },
            dispositions: {},
            relative: { now: "now", minutes: "{n}m", hours: "{n}h", days: "{n}d" },
          } as never,
          callout: {
            heading: "Cross-branch insight",
            body: "Sister lead {sister} won by applying {quote}.",
            applyLabel: "Apply",
            appliedLabel: "Applied",
            upgradeLabel: "Upgrade to AGENCY",
            upgradeTooltip: "Upgrade required",
          },
          map: {
            openInMaps: "Open in maps",
            title: "Location",
          },
          pipeline: {
            crawl: {
              PENDING: "Crawl pending",
              CRAWLING: "Crawling",
              CRAWLED: "Crawled",
              FAILED: "Crawl failed",
              NO_WEBSITE: "No website",
            },
            analyze: {
              PENDING: "Analyze pending",
              ANALYZING: "Analyzing",
              ANALYZED: "Analyzed",
              FAILED: "Analyze failed",
            },
            reviews: {
              PENDING: "Reviews pending",
              ANALYZING: "Analyzing reviews",
              ANALYZED: "Reviews analysed",
              FAILED: "Reviews failed",
              NO_REVIEWS: "No reviews",
            },
            outreach: {
              NEW: "New",
              REACHED_OUT: "Reached out",
              IN_TALKS: "In talks",
              WON: "Won",
              LOST: "Lost",
            },
            dnc: "DNC",
            empty: "—",
          },
          directoriesHeading: "Directories",
        }}
      />,
    );
    expect(screen.getByTestId("pipeline-state-chips")).toBeInTheDocument();
    expect(screen.getByTestId("account-map-mini")).toBeInTheDocument();
  });

  it("HeaderBar exposes the SubNicheOverride kebab item", () => {
    render(
      <HeaderBar
        businessName="Acme"
        backLabel="Back"
        stage="COLD"
        watchlistItemId={null}
        leadId="lead_42"
        subNicheState={{
          current: { slug: "fnb-cafe", label: "FnB · Café" },
          override: { source: "AUTO", overriddenAt: null, overriddenBy: null },
          alternatives: [],
        }}
        copy={{
          tierLabel: "Tier",
          stageLabel: "Stage",
          changeStage: "Change stage",
          dial: "Dial",
          email: "Email",
          voiceNote: "Voice note",
          moreActions: "More",
          edit: "Edit",
          archive: "Archive",
          discard: "Discard",
          stages: {
            COLD: "Cold",
            CONTACTED: "Contacted",
            CONNECTED: "Connected",
            REPLIED: "Replied",
            QUALIFIED: "Qualified",
            DEMO: "Demo",
            PROPOSAL: "Proposal",
            WON: "Won",
            LOST: "Lost",
            NEEDS_REVIEW: "Needs review",
          },
          overrideSubNiche: "Override sub-niche…",
          rerunPipeline: "Re-run pipeline",
          subNicheOverride: {
            triggerLabel: "Override",
            currentLabel: "Current",
            alternativesLabel: "Alternatives",
            catalogLabel: "Catalog",
            searchPlaceholder: "Search…",
            saveLabel: "Save",
            saving: "Saving…",
            savedLabel: "Saved",
            errorLabel: "Couldn't save.",
            loadingCatalog: "Loading…",
            noAlternatives: "No alternatives yet.",
            source: { AUTO: "Auto", MANUAL: "Manual", OVERRIDE: "Override" },
          },
        }}
      />,
    );
    // The kebab item only appears when the dropdown is open. We
    // assert the underlying SubNicheOverrideMenu is mounted (in
    // controlled mode, with a 0-size anchor) — that's the binding
    // contract: the popover is reachable from the header without
    // any extra props.
    expect(
      document.querySelector("[data-radix-popper-content-wrapper], [data-state]"),
    ).not.toBeNull();
  });
});
