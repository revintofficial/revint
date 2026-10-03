import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai-core/agent/claude", () => ({
  callClaudeJson: vi.fn(),
  runClaudeToolLoop: vi.fn(),
  parseClaudeJson: vi.fn(),
  getHeadAgentModel: () => "mock",
  isAnthropicConfigured: () => false,
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { unsupportedTokens } from "@/lib/ai-core/agent/head-agent";

describe("unsupportedTokens", () => {
  const evidence = 'yorum (3/80): "we waited 25 minutes for the bill" https://x — rezervasyon TheFork üzerinden, depozito görünmüyor';

  it("accepts numbers and names that are in the cited evidence", () => {
    expect(unsupportedTokens("3 of your 80 recent reviews mention a 25 minute wait for the bill (E1).", evidence)).toEqual([]);
    expect(unsupportedTokens("Bookings go through TheFork with no deposit.", evidence)).toEqual([]);
  });

  it("flags a number the evidence does not carry", () => {
    expect(unsupportedTokens("Guests wait 40 minutes for the bill.", evidence)).toEqual(["40"]);
  });

  it("flags a provider or platform the evidence does not name", () => {
    expect(unsupportedTokens("You pay OpenTable per cover and Deliveroo a commission.", evidence)).toEqual(["OpenTable", "Deliveroo"]);
  });

  it("allows the package limits Room 2 was told about", () => {
    expect(unsupportedTokens("Growth covers 250 reservations with prepayment across 50 tables.", evidence)).toEqual([]);
  });

  it("does not read evidence ids as numbers", () => {
    expect(unsupportedTokens("The menu is a PDF (E2, E3).", "site — menü PDF")).toEqual([]);
  });
});
