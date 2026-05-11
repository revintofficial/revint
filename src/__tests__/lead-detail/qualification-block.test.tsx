/**
 * Phase 2 — `QualificationBlock` render-state matrix.
 *
 * Covers four states the spec calls out:
 *   1. loading
 *   2. empty (no BANT, no ICP, no MEDDPICC)
 *   3. populated (PRO+ — BANT + ICP + MEDDPICC visible)
 *   4. FREE-locked (BANT + ICP visible, MEDDPICC swapped for the
 *      `<PlanLockedBlock>` upgrade stub).
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { QualificationBlock } from "@/components/app/lead-detail-v2/QualificationBlock";
import type { BantBars } from "@/lib/lead-detail/derive-bant";
import type { IcpDimensionsResult } from "@/lib/icp-fit/dimensions";
import type { MeddpiccChecklistData } from "@/components/app/lead-detail-v2/MeddpiccChecklist";

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

const COPY = {
  loading: "Loading qualification…",
  empty: "No qualification facts yet.",
  meddpiccTitle: "MEDDPICC",
  icp: {
    labels: {
      revenue: "Revenue",
      staff: "Staff",
      stack: "Stack",
      geo: "Geo",
      vertical: "Vertical",
      total: "ICP fit",
    },
    unknown: "n/a",
    evidence: EVIDENCE_COPY,
  },
  bant: {
    overall: "BANT",
    labels: { budget: "Budget", authority: "Authority", need: "Need", timing: "Timing" },
    status: { present: "Present", partial: "Partial", missing: "Missing" },
    evidence: EVIDENCE_COPY,
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
    status: { present: "Captured", partial: "Partial", missing: "Missing" },
    evidence: EVIDENCE_COPY,
  },
  meddpiccLocked: {
    title: "MEDDPICC locked",
    description: "Upgrade to surface MEDDPICC.",
    cta: "Upgrade",
    requiredPlan: "Available on Pro and above.",
  },
};

const SAMPLE_BANT: BantBars = {
  budget: { score: 60, status: "present", evidence: [] },
  authority: { score: 30, status: "partial", evidence: [] },
  need: { score: 80, status: "present", evidence: [] },
  timing: { score: 0, status: "missing", evidence: [] },
  overall: 50,
};

const SAMPLE_ICP: IcpDimensionsResult = {
  revenue: 80,
  staff: 60,
  stack: 70,
  geo: 90,
  vertical: 50,
  total: 70,
};

const SAMPLE_MEDDPICC: MeddpiccChecklistData = {
  metrics: { status: "present", evidence: [] },
  economicBuyer: { status: "missing", evidence: [], stakeholderId: null },
  decisionCriteria: { status: "partial", evidence: [] },
  decisionProcess: { status: "missing", evidence: [] },
  identifyPain: { status: "present", evidence: [] },
  champion: { status: "partial", evidence: [], stakeholderId: null },
  competition: { status: "missing", evidence: [] },
};

describe("QualificationBlock — render states", () => {
  it("renders the loading state", () => {
    render(
      <QualificationBlock
        loading
        bant={null}
        icpDimensions={null}
        meddpicc={null}
        meddpiccUnlocked
        leadId="lead_test"
        copy={COPY}
      />,
    );
    expect(screen.getByTestId("qualification-loading")).toBeInTheDocument();
  });

  it("renders the empty state when nothing is populated", () => {
    render(
      <QualificationBlock
        loading={false}
        bant={null}
        icpDimensions={null}
        meddpicc={null}
        meddpiccUnlocked
        leadId="lead_test"
        copy={COPY}
      />,
    );
    expect(screen.getByTestId("qualification-empty")).toBeInTheDocument();
  });

  it("renders BANT + ICP + MEDDPICC for PRO+ users with data", () => {
    render(
      <QualificationBlock
        loading={false}
        bant={SAMPLE_BANT}
        icpDimensions={SAMPLE_ICP}
        meddpicc={SAMPLE_MEDDPICC}
        meddpiccUnlocked
        leadId="lead_test"
        copy={COPY}
      />,
    );
    expect(screen.getByTestId("qualification-block-body")).toBeInTheDocument();
    expect(screen.getByTestId("icp-dimension-bars")).toBeInTheDocument();
    expect(screen.getByTestId("bant-bars")).toBeInTheDocument();
    expect(screen.getByTestId("meddpicc-checklist")).toBeInTheDocument();
  });

  it("swaps MEDDPICC for the locked stub on FREE", () => {
    render(
      <QualificationBlock
        loading={false}
        bant={SAMPLE_BANT}
        icpDimensions={SAMPLE_ICP}
        meddpicc={null}
        meddpiccUnlocked={false}
        leadId="lead_test"
        copy={COPY}
      />,
    );
    expect(screen.getByTestId("plan-locked-block")).toBeInTheDocument();
    expect(screen.queryByTestId("meddpicc-checklist")).toBeNull();
    expect(screen.getByTestId("bant-bars")).toBeInTheDocument();
    expect(screen.getByTestId("icp-dimension-bars")).toBeInTheDocument();
  });
});
