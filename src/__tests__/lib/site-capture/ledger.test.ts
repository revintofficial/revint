// src/__tests__/lib/site-capture/ledger.test.ts
import { describe, expect, it } from "vitest";
import { CoverageLedger, missingFromLedger, summarizeLedger } from "@/lib/site-capture/ledger";
import type { LedgerEntry } from "@/lib/site-capture/types";

const entry = (url: string, extra: Partial<LedgerEntry> = {}): LedgerEntry => ({
  url,
  finalUrl: url,
  type: "menu",
  source: "home_link",
  outcome: "opened",
  reason: null,
  httpStatus: 200,
  ...extra,
});

describe("CoverageLedger", () => {
  it("keeps exactly one result per address; the first one stands", () => {
    const l = new CoverageLedger();
    l.record(entry("https://bistro.test/menu"));
    l.record(entry("http://www.bistro.test/menu/", { outcome: "failed", reason: "timeout" }));
    expect(l.entries()).toHaveLength(1);
    expect(l.entries()[0].outcome).toBe("opened");
    expect(l.has("https://bistro.test/menu#lunch")).toBe(true);
  });
});

describe("summarizeLedger", () => {
  it("counts outcomes and reasons", () => {
    const s = summarizeLedger([
      entry("https://bistro.test/menu"),
      entry("https://bistro.test/faq", { outcome: "failed", reason: "timeout", httpStatus: null }),
      entry("https://bistro.test/a", { outcome: "skipped", reason: "limit_type" }),
      entry("https://bistro.test/b", { outcome: "skipped", reason: "limit_type" }),
    ]);
    expect(s).toEqual({ opened: 1, skipped: 2, failed: 1, byReason: { timeout: 1, limit_type: 2 } });
  });
});

describe("missingFromLedger", () => {
  it("lists discovered addresses that have no result", () => {
    const entries = [entry("https://bistro.test/menu")];
    expect(missingFromLedger(["https://bistro.test/menu/", "https://bistro.test/faq"], entries)).toEqual([
      "https://bistro.test/faq",
    ]);
  });
});
