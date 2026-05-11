/**
 * Phase 3 unit — queue-headline helper.
 *
 * Pins the headline mapping for every `LeadTriggerType` enum value
 * (PLAN §4 Phase 3 kill criterion: queue-strip headline cites a real
 * trigger, not a fake mock string).
 */
import { describe, expect, it } from "vitest";
import type { LeadTriggerType } from "@/generated/prisma/client";
import {
  QUEUE_HEADLINE_QUEUED,
  buildQueueHeadline,
} from "@/lib/lead-detail/queue-headline";

// Phase 8 enum values are referenced by name here so the helper's
// switch arms are exercised. They land in `prisma/schema.prisma` and
// the generated client when Phase 8 ships; until then we cast through
// `string` so the test file type-checks against the current client.
type FutureTriggerType =
  | LeadTriggerType
  | "REVIEW_VOLUME_SURGE"
  | "REVIEW_VOLUME_DIP";

describe("buildQueueHeadline", () => {
  it("returns 'queued' when no trigger fired", () => {
    expect(buildQueueHeadline(null)).toBe(QUEUE_HEADLINE_QUEUED);
  });

  it("interpolates RATING_DROP windowed math when present", () => {
    expect(
      buildQueueHeadline({
        type: "RATING_DROP",
        impactPrediction: null,
        evidence: { windowDropStars: 0.6 },
      }),
    ).toBe("rating drop -0.6★ / 30d");
  });

  it("interpolates BAD_SERVICE_REVIEWS top KPI when present", () => {
    expect(
      buildQueueHeadline({
        type: "BAD_SERVICE_REVIEWS",
        impactPrediction: null,
        evidence: { kpis: [{ label: "Slow service", count: 12 }] },
      }),
    ).toBe('service complaints (12× "Slow service")');
  });

  it("interpolates REVIEW_VOLUME_SURGE delta", () => {
    expect(
      buildQueueHeadline({
        type: "REVIEW_VOLUME_SURGE" as FutureTriggerType as LeadTriggerType,
        impactPrediction: null,
        evidence: { deltaPct: 120 },
      }),
    ).toBe("review surge +120%");
  });

  it("interpolates REVIEW_VOLUME_DIP delta with sign", () => {
    expect(
      buildQueueHeadline({
        type: "REVIEW_VOLUME_DIP" as FutureTriggerType as LeadTriggerType,
        impactPrediction: null,
        evidence: { deltaPct: -40 },
      }),
    ).toBe("review dip -40%");
  });

  it("falls back to impactPrediction (trimmed) when evidence is sparse", () => {
    expect(
      buildQueueHeadline({
        type: "FUNDING_RAISED",
        impactPrediction:
          "Series A closed last week — marketing budget likely freshly approved.",
        evidence: {},
      }),
    ).toBe(
      "Series A closed last week — marketing budget likely freshly approved.",
    );
  });

  it("truncates very long impactPrediction to 72 chars with ellipsis", () => {
    const long =
      "An extremely long impact prediction that goes on and on and on past the 72-character truncation boundary so the queue strip never overflows.";
    const out = buildQueueHeadline({
      type: "EXEC_CHANGE",
      impactPrediction: long,
      evidence: {},
    });
    expect(out.length).toBeLessThanOrEqual(72);
    expect(out.endsWith("…")).toBe(true);
  });

  it("returns the default headline when no evidence and no impactPrediction", () => {
    expect(
      buildQueueHeadline({
        type: "BOOKING_PROVIDER_CHANGE",
        impactPrediction: null,
        evidence: {},
      }),
    ).toBe("booking provider change");
  });

  it("never returns empty for any LeadTriggerType (defensive coverage)", () => {
    const allTypes: FutureTriggerType[] = [
      "NEW_LOCATION_OPENING",
      "CHAIN_EXPANSION",
      "HIRING_MARKETING",
      "HIRING_OPS",
      "HIRING_TECH",
      "BAD_SERVICE_REVIEWS",
      "RATING_DROP",
      "MENU_REDESIGN_SIGNAL",
      "BOOKING_PROVIDER_CHANGE",
      "DELIVERY_EXPANSION",
      "INTERNATIONAL_AUDIENCE_GROWTH",
      "SEASONAL_TOURISM",
      "COMPETITOR_PRESSURE",
      "REBRANDING",
      "FUNDING_RAISED",
      "EXEC_CHANGE",
      "REVIEW_VOLUME_SURGE",
      "REVIEW_VOLUME_DIP",
    ];
    for (const type of allTypes) {
      const out = buildQueueHeadline({
        type: type as LeadTriggerType,
        impactPrediction: null,
        evidence: {},
      });
      expect(out, `type=${type}`).not.toBe("");
      expect(out.length, `type=${type}`).toBeGreaterThan(0);
    }
  });
});
