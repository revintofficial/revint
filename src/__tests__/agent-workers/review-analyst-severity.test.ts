/**
 * Truth Layer v1 — T-C Evidence Calibration: severity normalisation.
 *
 * Master plan §3 T-C bullet 1: every severity written by REVIEW_ANALYST
 * must run through `normalizeSeverity()` from
 * `@/lib/sdr-brain/contracts` so a small concentrated negative pool on
 * a high-volume operator no longer surfaces as a near-100% severity.
 *
 * Test surface (from the dispatch prompt):
 *   - Greenwich Morning fixture: 11 negs / 397 total → final severity ≤ 35.
 *   - High-traffic operator (Maido Bar baseline): visibilityFactor = 1.5
 *     bumps but stays under 100.
 *   - Legacy fallback (`TRUTH_LAYER_SEVERITY_V2 = off`) reproduces the
 *     pre-Truth-Layer numbers (severity ≈ percent) so the shadow-run
 *     gate at Wave-1 end can compare apples-to-apples.
 *
 * The helpers `severityForKpi`, `legacySeverityFromPercent`, and
 * `visibilityFactorFor` are exported from the worker module for this
 * test surface (the file-touched envelope only allows edits to the
 * worker file itself, not a sibling helpers module).
 */
import { describe, it, expect } from "vitest";
import {
  legacySeverityFromPercent,
  severityForKpi,
  visibilityFactorFor,
} from "@/lib/agent-workers/review-analyst";
import { normalizeSeverity } from "@/lib/sdr-brain/contracts";

describe("review-analyst severity normalisation", () => {
  describe("normalizeSeverity contract integration", () => {
    it("Greenwich Morning fixture: 11 negs / 397 total / 9 mentions → severity ≤ 35", () => {
      // Mirrors `tests/fixtures/leads/greenwich-morning.json`:
      //   reviewCount: 397, _negCount: 11, weakness count: 9, percent: 82.
      const severity = severityForKpi({
        count: 9,
        pool: 11,
        total: 397,
        visibilityFactor: visibilityFactorFor(397),
      });
      // The whole point of T-C: the legacy formula would have
      // surfaced this as ~82 (raw `percent`); the normalised formula
      // collapses to a low single-digit because the negRatio is only
      // 11/397 = 2.8%. Anything ≤ 35 proves base-rate normalisation
      // is in effect.
      expect(severity).toBeLessThanOrEqual(35);
      // Sanity floor — a non-zero count must still produce a non-zero
      // severity, otherwise we've over-normalised and lost the signal.
      expect(severity).toBeGreaterThan(0);
    });

    it("Casa Polanco fixture: 5 negs / 200 total / 6 mentions → moderate severity", () => {
      // Mirrors `tests/fixtures/leads/casa-polanco.json`. negRatio is
      // 5/200 = 2.5%, mentionRatio is 6/5 = 1.2 (clamped to 1).
      const severity = severityForKpi({
        count: 6,
        pool: 5,
        total: 200,
        visibilityFactor: visibilityFactorFor(200),
      });
      // 100 * 0.025 * 1 * 1 * 1 = 2.5 → 3.
      expect(severity).toBeLessThanOrEqual(10);
      expect(severity).toBeGreaterThanOrEqual(1);
    });

    it("Maido Bar fixture: 198 negs / 1240 total → visibilityFactor 1.5 applies", () => {
      // Mirrors `tests/fixtures/leads/maido-bar.json`. Total is 1240
      // → high-traffic threshold (>= 1000) → visibilityFactor 1.5.
      // The bump should be observable: severity at 1.5x > severity
      // at 1.0x for the same inputs.
      const at15 = severityForKpi({
        count: 14,
        pool: 198,
        total: 1240,
        visibilityFactor: 1.5,
      });
      const at10 = severityForKpi({
        count: 14,
        pool: 198,
        total: 1240,
        visibilityFactor: 1.0,
      });
      expect(at15).toBeGreaterThan(at10);
      expect(at15).toBeLessThanOrEqual(100);
      // Confirm the visibility helper picks 1.5 for >1000 reviews.
      expect(visibilityFactorFor(1240)).toBe(1.5);
      expect(visibilityFactorFor(999)).toBe(1.0);
    });

    it("never emits NaN for zero-total / zero-pool edge cases", () => {
      // Defensive: even an empty corpus must round-trip to a
      // numeric severity (0). The `normalizeSeverity` clamp guards
      // against div-by-zero.
      const empty = severityForKpi({ count: 0, pool: 0, total: 0 });
      expect(Number.isFinite(empty)).toBe(true);
      expect(empty).toBe(0);

      const onlyOne = severityForKpi({ count: 1, pool: 1, total: 1 });
      expect(Number.isFinite(onlyOne)).toBe(true);
      // 100 * 1 * 1 * 1 * 1 = 100 (a single-review business is the
      // pathological case — caller is expected to pool-floor it).
      expect(onlyOne).toBeLessThanOrEqual(100);
    });

    it("delegates exactly to the contract `normalizeSeverity`", () => {
      // Anti-drift: the wrapper must not silently introduce its own
      // formula. Same inputs through both call sites must agree.
      const inputs = {
        count: 9,
        pool: 11,
        total: 397,
        visibilityFactor: 1.0,
      };
      const wrapped = severityForKpi(inputs);
      const direct = normalizeSeverity({
        baseSeverity: 100,
        mentionCount: inputs.count,
        negCount: inputs.pool,
        totalCount: inputs.total,
        recentDaysOld: 0,
        visibilityFactor: inputs.visibilityFactor,
      });
      expect(wrapped).toBe(direct);
    });
  });

  describe("legacy fallback (flag off — shadow-run baseline)", () => {
    it("legacySeverityFromPercent returns the rounded percent unchanged", () => {
      expect(legacySeverityFromPercent(82)).toBe(82);
      expect(legacySeverityFromPercent(0)).toBe(0);
      expect(legacySeverityFromPercent(100)).toBe(100);
      // Out-of-range guard so a hallucinated 120% from Gemini doesn't
      // poison downstream consumers expecting a 0..100 severity.
      expect(legacySeverityFromPercent(150)).toBe(100);
      expect(legacySeverityFromPercent(-10)).toBe(0);
      // NaN-safe — Gemini occasionally emits non-finite numbers when
      // dividing by zero.
      expect(legacySeverityFromPercent(Number.NaN)).toBe(0);
    });

    it("legacy and normalised formulas diverge on high-volume operators", () => {
      // The R4 risk in master plan §8 — after normalisation severities
      // globally drop. This test makes the divergence explicit so the
      // shadow-run dashboard has a regression to watch.
      const greenwichLegacy = legacySeverityFromPercent(82); // raw percent
      const greenwichNormalised = severityForKpi({
        count: 9,
        pool: 11,
        total: 397,
        visibilityFactor: 1.0,
      });
      expect(greenwichLegacy).toBeGreaterThan(greenwichNormalised + 30);
    });
  });
});
