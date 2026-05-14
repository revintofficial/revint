/**
 * Truth Layer v1 — T-C Evidence Calibration: switch-signal direction.
 *
 * Master plan §3 T-C bullet 2: REVIEW_ANALYST must split the legacy
 * flat-string `switchSignals` blob into a typed `SwitchSignal[]` shape
 * (per `switch-signal@v1` contract) and label every entry with
 * `inbound | outbound | comparison_neutral`. This test surface
 * exercises the classifier helper directly — the worker integration
 * is covered indirectly through the severity test, which seeds
 * Gemini output via the same code path.
 *
 * Test surface (from the dispatch prompt):
 *   - Maido Bar fixture: "way better cocktails than the place I used
 *     to go (Sankaku)" → `direction = inbound` (reviewer leaving
 *     competitor toward Maido).
 *   - Casa Polanco fixture: "tuvimos que llamar 4 veces, ahora con
 *     Resy es instantáneo (en otros lugares)" → `direction =
 *     comparison_neutral` (no clear out/in vector — the comparison
 *     is about a different brand, not a switch toward/away from Casa).
 *   - Synthetic outbound: "we used to go to <us> but moved" →
 *     `direction = outbound`.
 *   - Edge cases: empty / null / unicode-normalised business names.
 */
import { describe, it, expect } from "vitest";
import {
  classifySwitchDirection,
  competitorFromSignal,
} from "@/lib/agent-workers/review-analyst";

describe("classifySwitchDirection (switch-signal@v1)", () => {
  describe("Maido Bar fixture — inbound", () => {
    it("classifies 'way better than Sankaku' as inbound", () => {
      // From `tests/fixtures/leads/maido-bar.json`. The reviewer
      // moved FROM Sankaku TO Maido Bar — the lead is the destination,
      // so direction is inbound.
      const direction = classifySwitchDirection({
        from: "Sankaku",
        to: "Maido Bar",
        businessName: "Maido Bar",
      });
      expect(direction).toBe("inbound");
    });

    it("inbound competitor extraction surfaces the prior brand", () => {
      // Per the contract: `competitor` is the OTHER brand, not the
      // lead. For inbound, that's the `from` (where the reviewer
      // came from).
      const competitor = competitorFromSignal({
        from: "Sankaku",
        to: "Maido Bar",
        direction: "inbound" as const,
      });
      expect(competitor).toBe("Sankaku");
    });

    it("tolerates partial / cased brand variants", () => {
      // Gemini frequently paraphrases ("Maido" instead of "Maido Bar").
      // The matcher must still recognise the lead.
      expect(
        classifySwitchDirection({
          from: "Sankaku",
          to: "Maido",
          businessName: "Maido Bar",
        }),
      ).toBe("inbound");
      expect(
        classifySwitchDirection({
          from: "sankaku",
          to: "MAIDO BAR",
          businessName: "Maido Bar",
        }),
      ).toBe("inbound");
    });
  });

  describe("Casa Polanco fixture — comparison_neutral", () => {
    it("classifies 'Resy elsewhere is instant' as comparison_neutral", () => {
      // From `tests/fixtures/leads/casa-polanco.json`. The reviewer
      // is at Casa Polanco and references Resy in OTHER places — no
      // out/in vector relative to Casa. Default to neutral rather
      // than guessing direction, because the trigger-detector's
      // COMPETITOR_PRESSURE rule branches on outbound and a guess
      // here would mis-fire openers.
      const direction = classifySwitchDirection({
        // The Spanish reviewer text doesn't pin a `from` — Gemini
        // commonly leaves it empty in this case.
        from: null,
        to: "Resy",
        businessName: "Casa Polanco",
      });
      expect(direction).toBe("comparison_neutral");
    });

    it("comparison with both sides being third parties → neutral", () => {
      // "Resy is way better than OpenTable" — neither side is the
      // lead, so we have no directional intent.
      const direction = classifySwitchDirection({
        from: "OpenTable",
        to: "Resy",
        businessName: "Casa Polanco",
      });
      expect(direction).toBe("comparison_neutral");
    });

    it("competitor for neutral signals prefers the named brand", () => {
      const competitor = competitorFromSignal({
        from: null,
        to: "Resy",
        direction: "comparison_neutral",
      });
      expect(competitor).toBe("Resy");
    });
  });

  describe("synthetic outbound — 'we used to go to X but moved'", () => {
    it("classifies 'we used to go to <lead> but moved' as outbound", () => {
      // Synthetic per the dispatch prompt: the reviewer used to be a
      // customer of the lead and moved away. The lead is the source,
      // so direction is outbound.
      const direction = classifySwitchDirection({
        from: "Acme Bistro",
        to: "Other Place",
        businessName: "Acme Bistro",
      });
      expect(direction).toBe("outbound");
    });

    it("outbound competitor extraction surfaces the new destination", () => {
      const competitor = competitorFromSignal({
        from: "Acme Bistro",
        to: "Other Place",
        direction: "outbound",
      });
      expect(competitor).toBe("Other Place");
    });
  });

  describe("ambiguous / degenerate inputs", () => {
    it("returns comparison_neutral for empty businessName", () => {
      // Defensive: a lead row with a missing businessName must not
      // crash the classifier — fail safe to neutral.
      expect(
        classifySwitchDirection({
          from: "X",
          to: "Y",
          businessName: "",
        }),
      ).toBe("comparison_neutral");
    });

    it("returns comparison_neutral when both sides are null", () => {
      expect(
        classifySwitchDirection({
          from: null,
          to: null,
          businessName: "Acme",
        }),
      ).toBe("comparison_neutral");
    });

    it("returns comparison_neutral when both sides are the lead (degenerate Gemini output)", () => {
      // Gemini occasionally emits {from: "Acme", to: "Acme"} when it
      // can't extract a real switch. Fail safe to neutral.
      expect(
        classifySwitchDirection({
          from: "Acme",
          to: "Acme",
          businessName: "Acme",
        }),
      ).toBe("comparison_neutral");
    });

    it("does not match across short tokens (3-char guard)", () => {
      // Short business names ("Bar") would otherwise match every
      // 3-letter token in the from/to side. We require 4+ chars on
      // both sides for the soft-contains path.
      const direction = classifySwitchDirection({
        from: "Tiki Bar",
        to: "Speakeasy Bar",
        businessName: "Bar",
      });
      // Exact-match doesn't fire because neither side IS just "Bar",
      // and the 4-char soft-contains gate stops "Bar" from contaminating
      // every place-with-bar-in-the-name.
      expect(direction).toBe("comparison_neutral");
    });
  });
});
