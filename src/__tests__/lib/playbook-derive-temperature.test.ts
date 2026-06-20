/**
 * Phase 2 — `deriveLeadTemperature` (analysis-time temperature).
 *
 * The intelligence brief rollup now stamps `Lead.leadTemperature` so the
 * leads list, the `revint_lead_temperature` HubSpot property and the App
 * Card agree. The helper layers the freshly computed `salesConfidence`
 * over the playbook rule engine (`computeTemperature`) and returns the
 * hotter of the two — so a newly-scored lead with no inbound SLA or
 * disposition still seeds a sensible temperature, while a fresh inbound
 * (SLA rule) is never cooled down by a low score.
 */
import { describe, expect, it } from "vitest";
import { deriveLeadTemperature } from "@/lib/playbook/resolve";
import { FINEDINE_PLAYBOOK } from "@/lib/playbook/types";

describe("deriveLeadTemperature", () => {
  it("floors to HOT on high sales confidence with no call signals", () => {
    expect(
      deriveLeadTemperature(FINEDINE_PLAYBOOK, {
        hoursSinceInbound: null,
        lastDisposition: null,
        qualified: false,
        salesConfidence: 82,
      }),
    ).toBe("HOT");
  });

  it("floors to WARM on mid sales confidence with no call signals", () => {
    expect(
      deriveLeadTemperature(FINEDINE_PLAYBOOK, {
        hoursSinceInbound: null,
        lastDisposition: null,
        qualified: false,
        salesConfidence: 55,
      }),
    ).toBe("WARM");
  });

  it("stays COLD on low sales confidence with no signals", () => {
    expect(
      deriveLeadTemperature(FINEDINE_PLAYBOOK, {
        hoursSinceInbound: null,
        lastDisposition: null,
        qualified: false,
        salesConfidence: 20,
      }),
    ).toBe("COLD");
  });

  it("never cools a fresh inbound (SLA rule) below the playbook band", () => {
    // Within the HOT SLA window — base rule wins over a low score.
    expect(
      deriveLeadTemperature(FINEDINE_PLAYBOOK, {
        hoursSinceInbound: 1,
        lastDisposition: null,
        qualified: false,
        salesConfidence: 10,
      }),
    ).toBe("HOT");
  });

  it("returns the hotter of score-floor and playbook rule", () => {
    // Stale inbound (base COLD/WARM) but a strong score → HOT.
    expect(
      deriveLeadTemperature(FINEDINE_PLAYBOOK, {
        hoursSinceInbound: 200,
        lastDisposition: null,
        qualified: false,
        salesConfidence: 90,
      }),
    ).toBe("HOT");
  });

  it("treats a null/unknown score as no floor", () => {
    expect(
      deriveLeadTemperature(FINEDINE_PLAYBOOK, {
        hoursSinceInbound: null,
        lastDisposition: null,
        qualified: false,
        salesConfidence: null,
      }),
    ).toBe("COLD");
  });
});
