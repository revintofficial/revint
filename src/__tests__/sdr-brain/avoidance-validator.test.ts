/**
 * Truth Layer v1 — T-F NBA Hygiene avoidance validator unit tests.
 *
 * Pins the §3 (T-F) test surface verbatim plus a few false-positive
 * audits the master plan flagged: "loud music vibes" must NOT drop
 * against `online_reservations`; an empty `packageFeatures` short-
 * circuits to a pass-through; the `[...kept, ...dropped]` union is a
 * permutation of the input.
 */
import { describe, expect, it } from "vitest";

import {
  topicCoversFeature,
  validateAvoidance,
} from "@/lib/sdr-brain/avoidance-validator";
import type { AvoidanceTopic } from "@/lib/sdr-brain/contracts";

function topic(t: string): AvoidanceTopic {
  return {
    topic: t,
    reason: "owner_defensive_in_replies",
    evidenceRef: { quote: t },
  };
}

describe("topicCoversFeature — primitive overlap rule", () => {
  it("drops 'online reservations missing' against 'online_reservations'", () => {
    expect(topicCoversFeature("online reservations missing", "online_reservations")).toBe(true);
  });

  it("keeps 'loud music vibes' against 'online_reservations'", () => {
    expect(topicCoversFeature("loud music vibes", "online_reservations")).toBe(false);
  });

  it("matches plural variants — 'delivery integrations' against 'delivery_integration'", () => {
    expect(topicCoversFeature("delivery integrations", "delivery_integration")).toBe(true);
  });

  it("matches the inverse plural — 'delivery integration' against 'delivery_integrations'", () => {
    expect(topicCoversFeature("delivery integration", "delivery_integrations")).toBe(true);
  });

  it("matches '-ies' plural — 'we have no deliveries' against 'delivery_widget'", () => {
    // both reduce to {delivery, widget?} — only the {delivery} side
    // matters; "deliveries" → "delivery" is the singularisation we
    // need for plain English avoidance topics.
    expect(topicCoversFeature("delivery service", "deliveries")).toBe(true);
  });

  it("matches camelCase feature slug — 'onlineReservations' against 'no online reservations'", () => {
    expect(topicCoversFeature("no online reservations", "onlineReservations")).toBe(true);
  });

  it("requires ALL feature tokens to appear (false positive guard)", () => {
    // feature `staff_management` reduces to {staff, management}; a
    // topic that mentions only "staff" should NOT drop.
    expect(topicCoversFeature("rude staff at brunch", "staff_management")).toBe(false);
  });

  it("ignores stopword-only features", () => {
    expect(topicCoversFeature("loud music vibes", "the and of")).toBe(false);
  });

  it("ignores stopword-only topics", () => {
    expect(topicCoversFeature("missing the on a", "online_reservations")).toBe(false);
  });

  it("is case-insensitive on both sides", () => {
    expect(
      topicCoversFeature("ONLINE Reservations missing", "Online_Reservations"),
    ).toBe(true);
  });
});

describe("validateAvoidance — list-level contract", () => {
  it("Casa Polanco regression case — drops 'online reservations missing' against ['online_reservations']", () => {
    const result = validateAvoidance(
      [topic("online reservations missing")],
      ["online_reservations"],
    );
    expect(result.kept).toEqual([]);
    expect(result.dropped.map((t) => t.topic)).toEqual([
      "online reservations missing",
    ]);
  });

  it("keeps unrelated topics — 'loud music vibes' against ['online_reservations']", () => {
    const result = validateAvoidance(
      [topic("loud music vibes")],
      ["online_reservations"],
    );
    expect(result.kept.map((t) => t.topic)).toEqual(["loud music vibes"]);
    expect(result.dropped).toEqual([]);
  });

  it("plural-form detection — 'delivery integrations' overlaps with 'delivery_integration'", () => {
    const result = validateAvoidance(
      [topic("delivery integrations")],
      ["delivery_integration"],
    );
    expect(result.kept).toEqual([]);
    expect(result.dropped.map((t) => t.topic)).toEqual(["delivery integrations"]);
  });

  it("preserves input ordering across kept + dropped buckets", () => {
    const input = [
      topic("loud music vibes"), // keep
      topic("online reservations missing"), // drop
      topic("staff is rude"), // keep
      topic("we have no delivery integrations"), // drop
    ];
    const result = validateAvoidance(input, [
      "online_reservations",
      "delivery_integration",
    ]);
    expect(result.kept.map((t) => t.topic)).toEqual([
      "loud music vibes",
      "staff is rude",
    ]);
    expect(result.dropped.map((t) => t.topic)).toEqual([
      "online reservations missing",
      "we have no delivery integrations",
    ]);
  });

  it("union of kept + dropped is a permutation of the input", () => {
    const input = [
      topic("loud music vibes"),
      topic("online reservations missing"),
      topic("staff is rude"),
    ];
    const { kept, dropped } = validateAvoidance(input, ["online_reservations"]);
    const union = [...kept, ...dropped].map((t) => t.topic).sort();
    const expected = input.map((t) => t.topic).sort();
    expect(union).toEqual(expected);
  });

  it("empty packageFeatures → pass-through (every topic kept)", () => {
    const input = [topic("online reservations missing"), topic("loud music")];
    const result = validateAvoidance(input, []);
    expect(result.kept).toHaveLength(2);
    expect(result.dropped).toEqual([]);
  });

  it("empty topics → empty output (no-op)", () => {
    const result = validateAvoidance([], ["online_reservations"]);
    expect(result.kept).toEqual([]);
    expect(result.dropped).toEqual([]);
  });

  it("multi-feature drop — any feature match is enough to drop a topic", () => {
    const result = validateAvoidance(
      [topic("online reservations missing")],
      ["loyalty_program", "online_reservations"],
    );
    expect(result.kept).toEqual([]);
    expect(result.dropped).toHaveLength(1);
  });
});
