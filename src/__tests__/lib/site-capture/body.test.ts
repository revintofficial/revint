// src/__tests__/lib/site-capture/body.test.ts
import { describe, expect, it } from "vitest";
import { readCapped, readCappedText } from "@/lib/site-capture/body";

/** An endless body of "a" chunks; records whether the reader was cancelled. */
function endless(chunk = 1024) {
  const state = { cancelled: false, pulled: 0 };
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      state.pulled++;
      controller.enqueue(new TextEncoder().encode("a".repeat(chunk)));
    },
    cancel() {
      state.cancelled = true;
    },
  });
  return { response: new Response(stream), state };
}

describe("readCappedText", () => {
  it("cuts a body larger than the cap at the cap and cancels the reader", async () => {
    const { response, state } = endless();
    const text = await readCappedText(response, 10_000);
    expect(text).toHaveLength(10_000);
    expect(state.cancelled).toBe(true);
    expect(state.pulled).toBeLessThan(20);
  });

  it("returns a body under the cap whole, decoded as UTF-8", async () => {
    const text = await readCappedText(new Response("Çorba ve şarap"), 1_000);
    expect(text).toBe("Çorba ve şarap");
  });

  it("does not refuse a body whose declared length is over the cap", async () => {
    const res = new Response("x".repeat(50), { headers: { "content-length": "999999" } });
    expect(await readCappedText(res, 20)).toBe("x".repeat(20));
  });
});

describe("readCapped (PDF mode)", () => {
  it("still reports a body over the cap as too_large", async () => {
    const { response, state } = endless();
    const never = new Promise<never>(() => {});
    expect(await readCapped(response, 10_000, never)).toBe("too_large");
    expect(state.cancelled).toBe(true);
  });
});
