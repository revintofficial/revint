/**
 * Truth Layer v1 — T-A Decision Gates unit tests.
 *
 * Verifies the three properties pinned in master plan §3 / T-A DoD:
 *   1. `CONTACT_DISCOVERY_FIRST + no_contact` fires on the Greenwich
 *      Morning fixture (no phone, no stakeholder email).
 *   2. Casa Polanco fixture stays at its legacy decision (regression
 *      baseline — must NOT acquire a blocking gate).
 *   3. Synthetic low-authority lead (authority=20) → `WAIT +
 *      low_authority`.
 *
 * Telemetry is asserted via a `vi.spyOn(logger, "info")` because the
 * gate function emits server-side log records (no `posthog-node` wiring
 * yet — see module-level comment in `buying-readiness.ts`).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  deriveBuyingReadiness,
  deriveNbaWithGates,
  type BuyingReadiness,
  type BuyingReadinessInput,
} from "@/lib/sdr-brain/buying-readiness";
import type { NbaOutput } from "@/lib/sdr-brain/contracts";
import { logger } from "@/lib/logger";
import { loadLeadFixture } from "../../../tests/fixtures/load-lead-fixture";

const baselineDecision: NbaOutput = {
  type: "EMAIL_FIRST",
  rationale: "Legacy decision — used as `baseDecision` for tests.",
  blockingGate: null,
  confidence: 0.6,
};

function emptyBant(overrides: Partial<BuyingReadiness> = {}): BuyingReadiness {
  return {
    budget: 50,
    authority: 60,
    need: 50,
    timing: 50,
    overall: 55,
    reasoning: { budget: [], authority: [], need: [], timing: [] },
    ...overrides,
  };
}

function fixtureBantInput(fixtureId: "greenwich-morning" | "casa-polanco"): BuyingReadinessInput {
  const f = loadLeadFixture(fixtureId);
  return {
    lead: {
      priceLevel: f.lead.priceLevel,
      reviewCount: f.lead.reviewCount,
      rating: f.lead.rating,
      hasWebsite: f.lead.hasWebsite,
      icpFitScore: f.lead.icpFitScore,
    },
    audit: null,
    triggers: f.triggers.map((t) => ({
      // Fixture trigger types are stringly-typed; widen to the deriver
      // enum here. Unknown types just don't contribute to weights.
      type: t.type as BuyingReadinessInput["triggers"][number]["type"],
      severity: t.severity,
      confidence: t.confidence,
      detectedAt: new Date(t.detectedAt),
      urgencyWindowDays: t.urgencyWindowDays,
    })),
    stakeholders: f.stakeholders,
    recentIntentSignalCount: 0,
  };
}

describe("deriveNbaWithGates (Truth Layer T-A)", () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(logger, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
  });

  it("fires CONTACT_DISCOVERY_FIRST on Greenwich Morning (no phone, no email)", () => {
    const fixture = loadLeadFixture("greenwich-morning");
    expect(fixture.lead.phone).toBeNull();

    const bant = deriveBuyingReadiness(fixtureBantInput("greenwich-morning"));
    const out = deriveNbaWithGates(
      {
        leadId: fixture.lead.id,
        workspaceId: fixture.lead.workspaceId,
        phone: fixture.lead.phone,
        stakeholderEmails: [],
        buyingReadiness: bant,
        baseDecision: baselineDecision,
      },
      { flagEnabledOverride: true },
    );

    expect(out.type).toBe("CONTACT_DISCOVERY_FIRST");
    expect(out.blockingGate).toBe("no_contact");
    expect(out.rationale.toLowerCase()).toContain("no phone");
  });

  it("emits `truth.decision_gate.contact_first_fired` AND `truth.nba.decision_resolved` when the contact gate fires", () => {
    const fixture = loadLeadFixture("greenwich-morning");
    deriveNbaWithGates(
      {
        leadId: fixture.lead.id,
        workspaceId: fixture.lead.workspaceId,
        phone: null,
        stakeholderEmails: [],
        buyingReadiness: emptyBant(),
        baseDecision: baselineDecision,
      },
      { flagEnabledOverride: true },
    );

    expect(infoSpy).toHaveBeenCalledWith(
      "[truth-telemetry]",
      expect.objectContaining({
        event: "truth.decision_gate.contact_first_fired",
        leadId: fixture.lead.id,
        workspaceId: fixture.lead.workspaceId,
        hasPhone: false,
        hasEmail: false,
      }),
    );
    expect(infoSpy).toHaveBeenCalledWith(
      "[truth-telemetry]",
      expect.objectContaining({
        event: "truth.nba.decision_resolved",
        type: "CONTACT_DISCOVERY_FIRST",
        blockingGate: "no_contact",
      }),
    );
  });

  it("Casa Polanco fixture: no gate fires — legacy decision preserved", () => {
    const fixture = loadLeadFixture("casa-polanco");
    expect(fixture.lead.phone).toBeTruthy();

    const bant = deriveBuyingReadiness(fixtureBantInput("casa-polanco"));
    // Casa Polanco has an economic-buyer stakeholder; authority must
    // sit well above the gate threshold for the regression to mean
    // anything.
    expect(bant.authority).toBeGreaterThanOrEqual(35);

    const out = deriveNbaWithGates(
      {
        leadId: fixture.lead.id,
        workspaceId: fixture.lead.workspaceId,
        phone: fixture.lead.phone,
        // No stakeholder email in the fixture, but phone is present so
        // the contact gate doesn't care.
        stakeholderEmails: [],
        buyingReadiness: bant,
        baseDecision: baselineDecision,
      },
      { flagEnabledOverride: true },
    );

    expect(out.type).not.toBe("CONTACT_DISCOVERY_FIRST");
    expect(out.type).not.toBe("WAIT");
    expect(out.blockingGate ?? null).toBeNull();
    // The legacy decision passes through unchanged.
    expect(out).toEqual(baselineDecision);
  });

  it("fires WAIT + low_authority for a synthetic lead with authority=20", () => {
    const out = deriveNbaWithGates(
      {
        leadId: "synth_low_authority",
        workspaceId: "ws_test",
        phone: "+1 555 000 0000",
        stakeholderEmails: ["intern@example.com"],
        buyingReadiness: emptyBant({ authority: 20 }),
        baseDecision: baselineDecision,
      },
      { flagEnabledOverride: true },
    );

    expect(out.type).toBe("WAIT");
    expect(out.blockingGate).toBe("low_authority");
    expect(out.rationale).toContain("20");
    expect(out.rationale).toContain("35");

    expect(infoSpy).toHaveBeenCalledWith(
      "[truth-telemetry]",
      expect.objectContaining({
        event: "truth.decision_gate.authority_first_fired",
        leadId: "synth_low_authority",
        workspaceId: "ws_test",
        authorityScore: 20,
      }),
    );
  });

  it("contact gate wins over authority gate when both would fire", () => {
    const out = deriveNbaWithGates(
      {
        leadId: "synth_both",
        workspaceId: "ws_test",
        phone: null,
        stakeholderEmails: [],
        buyingReadiness: emptyBant({ authority: 5 }),
        baseDecision: baselineDecision,
      },
      { flagEnabledOverride: true },
    );

    expect(out.type).toBe("CONTACT_DISCOVERY_FIRST");
    expect(out.blockingGate).toBe("no_contact");
    expect(infoSpy).not.toHaveBeenCalledWith(
      "[truth-telemetry]",
      expect.objectContaining({
        event: "truth.decision_gate.authority_first_fired",
      }),
    );
  });

  it("treats whitespace-only phone/email as missing", () => {
    const out = deriveNbaWithGates(
      {
        leadId: "synth_whitespace",
        workspaceId: "ws_test",
        phone: "   ",
        stakeholderEmails: ["   ", ""],
        buyingReadiness: emptyBant(),
        baseDecision: baselineDecision,
      },
      { flagEnabledOverride: true },
    );
    expect(out.blockingGate).toBe("no_contact");
  });

  it("emits `truth.nba.decision_resolved` with blockingGate=\"none\" when no gate fires", () => {
    deriveNbaWithGates(
      {
        leadId: "synth_clear",
        workspaceId: "ws_test",
        phone: "+1 555 111 2222",
        stakeholderEmails: ["ceo@example.com"],
        buyingReadiness: emptyBant({ authority: 80 }),
        baseDecision: baselineDecision,
      },
      { flagEnabledOverride: true },
    );

    expect(infoSpy).toHaveBeenCalledWith(
      "[truth-telemetry]",
      expect.objectContaining({
        event: "truth.nba.decision_resolved",
        type: "EMAIL_FIRST",
        blockingGate: "none",
      }),
    );
  });

  it("flag OFF → legacy decision is returned and NO `truth.*` telemetry fires", () => {
    const out = deriveNbaWithGates(
      {
        // Same input that would otherwise fire the contact gate.
        leadId: "synth_flag_off",
        workspaceId: "ws_test",
        phone: null,
        stakeholderEmails: [],
        buyingReadiness: emptyBant({ authority: 10 }),
        baseDecision: baselineDecision,
      },
      { flagEnabledOverride: false },
    );

    expect(out).toEqual(baselineDecision);
    const truthCalls = infoSpy.mock.calls.filter(
      ([msg]) => msg === "[truth-telemetry]",
    );
    expect(truthCalls).toEqual([]);
  });
});
