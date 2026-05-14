/**
 * Truth Layer T-F — predicted-objection source-attribution unit tests.
 *
 * Pins the §3 (T-F) test surface for the source resolver:
 *   1. Casa Polanco fixture (`_ownerReplyExample` set) → source =
 *      "owner_reply".
 *   2. Greenwich Morning fixture (no owner reply, no brief in test
 *      input) → source = "segment_fallback".
 *   3. With a brief carrying `replyObjections[]` AND no owner reply
 *      → source = "model_inferred" (regression — the existing brief
 *      path keeps its attribution when the owner-reply signal is
 *      absent).
 *   4. Future-compat: when T-D adds a structured `ownerReplies[]`
 *      array, the extractor projects the first non-empty entry.
 *
 * The resolver + extractor are pure; we test them directly so the
 * test stays independent of Prisma / Gemini / BullMQ scaffolding.
 * This mirrors the pattern used by `decision-gates.test.ts` for the
 * T-A pure functions.
 */
import { describe, expect, it } from "vitest";

import {
  detectObjectionSource,
  extractOwnerReplyText,
} from "@/lib/agent-workers/objection-predictor";
import { loadLeadFixture } from "../../../tests/fixtures/load-lead-fixture";

describe("extractOwnerReplyText — fixture-driven projection", () => {
  it("Casa Polanco fixture exposes the operator's public reply via _ownerReplyExample", () => {
    const fx = loadLeadFixture("casa-polanco");
    const text = extractOwnerReplyText(fx.reviewAnalysis);
    expect(text).not.toBeNull();
    expect(text!).toContain("OpenTable");
  });

  it("Maido Bar fixture exposes the operator's public reply via _ownerReplyExample", () => {
    const fx = loadLeadFixture("maido-bar");
    const text = extractOwnerReplyText(fx.reviewAnalysis);
    expect(text).not.toBeNull();
    expect(text!).toContain("TableCheck");
  });

  it("Greenwich Morning fixture has no _ownerReplyExample → returns null", () => {
    const fx = loadLeadFixture("greenwich-morning");
    expect(extractOwnerReplyText(fx.reviewAnalysis)).toBeNull();
  });

  it("returns null for null / undefined inputs", () => {
    expect(extractOwnerReplyText(null)).toBeNull();
    expect(extractOwnerReplyText(undefined)).toBeNull();
  });

  it("returns null when the reply is whitespace-only (defensive trim)", () => {
    expect(
      extractOwnerReplyText({ _ownerReplyExample: "   \n  " } as never),
    ).toBeNull();
  });

  it("future-compat: projects the first string entry of an ownerReplies[] array", () => {
    const text = extractOwnerReplyText({
      ownerReplies: ["", "We have rolled out a new POS this week."],
    } as never);
    expect(text).toBe("We have rolled out a new POS this week.");
  });

  it("future-compat: projects the first {text} entry of an ownerReplies[] array", () => {
    const text = extractOwnerReplyText({
      ownerReplies: [{ text: "Reservation system upgrade in progress." }],
    } as never);
    expect(text).toBe("Reservation system upgrade in progress.");
  });

  it("prefers ownerReplies[] over the legacy _ownerReplyExample fallback", () => {
    const text = extractOwnerReplyText({
      ownerReplies: ["Newer signal."],
      _ownerReplyExample: "Legacy fallback.",
    } as never);
    expect(text).toBe("Newer signal.");
  });
});

describe("detectObjectionSource — Truth Layer T-F priority rule", () => {
  it("Casa Polanco fixture: owner reply present → source = 'owner_reply'", () => {
    const fx = loadLeadFixture("casa-polanco");
    const ownerReplyText = extractOwnerReplyText(fx.reviewAnalysis);
    const source = detectObjectionSource({
      ownerReplyText,
      // Even with a brief in play, owner_reply MUST win — the
      // operator's own voice beats the model-inferred brief signal.
      briefHasReplyObjections: true,
    });
    expect(source).toBe("owner_reply");
  });

  it("Greenwich Morning fixture: no owner reply, no brief → source = 'segment_fallback'", () => {
    const fx = loadLeadFixture("greenwich-morning");
    const ownerReplyText = extractOwnerReplyText(fx.reviewAnalysis);
    const source = detectObjectionSource({
      ownerReplyText,
      briefHasReplyObjections: false,
    });
    expect(source).toBe("segment_fallback");
  });

  it("Greenwich Morning fixture WITH a brief that carries reply objections → source = 'model_inferred'", () => {
    // Regression pin: when T-D's brief eventually inferred reply
    // objections for a lead with no public owner reply, we must
    // keep attributing those to the brief and not silently degrade
    // to 'segment_fallback'.
    const fx = loadLeadFixture("greenwich-morning");
    const ownerReplyText = extractOwnerReplyText(fx.reviewAnalysis);
    const source = detectObjectionSource({
      ownerReplyText,
      briefHasReplyObjections: true,
    });
    expect(source).toBe("model_inferred");
  });

  it("priority: owner_reply > model_inferred > segment_fallback", () => {
    expect(
      detectObjectionSource({
        ownerReplyText: "owner spoke",
        briefHasReplyObjections: true,
      }),
    ).toBe("owner_reply");
    expect(
      detectObjectionSource({
        ownerReplyText: null,
        briefHasReplyObjections: true,
      }),
    ).toBe("model_inferred");
    expect(
      detectObjectionSource({
        ownerReplyText: null,
        briefHasReplyObjections: false,
      }),
    ).toBe("segment_fallback");
  });

  it("treats whitespace-only owner reply as missing (mirrors the contact-gate convention)", () => {
    const source = detectObjectionSource({
      ownerReplyText: "   ",
      briefHasReplyObjections: false,
    });
    expect(source).toBe("segment_fallback");
  });
});
