/**
 * Truth Layer T-B — `resolveOutreachLocale` unit tests.
 *
 * Covers the resolution rule per master plan §2.6 + Open Decision §10.1
 * (locked: lead country wins):
 *   1. lead.country in COUNTRY_TO_LOCALE → lead_country_dominant
 *   2. else workspace.defaultLocale       → workspace_default
 *   3. else en-GB                          → fallback
 *
 * Also pins:
 *   - `countryIsoFromAddress` parses the trailing segment of a
 *     Google-Places-style formattedAddress into an ISO-3166-1 alpha-2.
 *   - `workspaceDefaultLocaleFromLanguage` projects the legacy
 *     2-letter workspace.language onto an OutreachLocale (so workers
 *     can still pass *something* into the resolver when the schema
 *     doesn't carry a typed defaultLocale yet).
 *   - `logLocaleResolution` emits `truth.locale.resolved` always and
 *     `truth.locale.workspace_lead_mismatch` only when lead country
 *     overrode a different workspace default.
 *
 * The fixture-level Greenwich Morning case is asserted from the
 * opener-writer integration test (`opener-writer-locale.test.ts`).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { loggerSpy } = vi.hoisted(() => ({
  loggerSpy: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/logger", () => ({ logger: loggerSpy }));

import {
  buildLocaleInstruction,
  countryIsoFromAddress,
  humanReadableLocale,
  legacyLanguageForLocale,
  logLocaleResolution,
  resolveOutreachLocale,
  workspaceDefaultLocaleFromLanguage,
} from "@/lib/locale/lead-locale";

beforeEach(() => {
  loggerSpy.info.mockReset();
  loggerSpy.warn.mockReset();
  loggerSpy.error.mockReset();
  loggerSpy.debug.mockReset();
});

describe("resolveOutreachLocale — resolution order", () => {
  it("GB lead + TR workspace → en-GB / lead_country_dominant (founder-locked rule)", () => {
    const result = resolveOutreachLocale(
      { country: "GB" },
      { defaultLocale: "tr-TR" },
    );
    expect(result.resolved).toBe("en-GB");
    expect(result.source).toBe("lead_country_dominant");
    expect(result.reasoning).toMatch(/GB/);
    expect(result.reasoning).toMatch(/en-GB/);
  });

  it("TR lead + TR workspace → tr-TR / lead_country_dominant (rule still fires, not workspace_default)", () => {
    const result = resolveOutreachLocale(
      { country: "TR" },
      { defaultLocale: "tr-TR" },
    );
    expect(result.resolved).toBe("tr-TR");
    expect(result.source).toBe("lead_country_dominant");
  });

  it("MX lead + en-US workspace → es-ES / lead_country_dominant", () => {
    const result = resolveOutreachLocale(
      { country: "MX" },
      { defaultLocale: "en-US" },
    );
    expect(result.resolved).toBe("es-ES");
    expect(result.source).toBe("lead_country_dominant");
  });

  it("null country + en-US workspace → en-US / workspace_default", () => {
    const result = resolveOutreachLocale(
      { country: null },
      { defaultLocale: "en-US" },
    );
    expect(result.resolved).toBe("en-US");
    expect(result.source).toBe("workspace_default");
  });

  it("unknown country (ZZ) + no workspace default → en-GB / fallback", () => {
    const result = resolveOutreachLocale(
      { country: "ZZ" },
      { defaultLocale: null },
    );
    expect(result.resolved).toBe("en-GB");
    expect(result.source).toBe("fallback");
  });

  it("unknown country (ZZ) + en-US workspace → workspace wins (still en-US / workspace_default)", () => {
    // Unknown country fails the COUNTRY_TO_LOCALE lookup; we must
    // fall through to the workspace default rather than triggering
    // the en-GB fallback. The reasoning string should also call out
    // the unmapped country to keep the audit trail honest.
    const result = resolveOutreachLocale(
      { country: "ZZ" },
      { defaultLocale: "en-US" },
    );
    expect(result.resolved).toBe("en-US");
    expect(result.source).toBe("workspace_default");
    expect(result.reasoning).toMatch(/ZZ/);
  });

  it("country lookup is case-insensitive (lowercase 'gb' resolves)", () => {
    const result = resolveOutreachLocale(
      { country: "gb" },
      { defaultLocale: null },
    );
    expect(result.resolved).toBe("en-GB");
    expect(result.source).toBe("lead_country_dominant");
  });

  it("garbage workspace defaultLocale is treated as missing → falls through to en-GB fallback", () => {
    const result = resolveOutreachLocale(
      { country: null },
      { defaultLocale: "klingon-XX" },
    );
    expect(result.resolved).toBe("en-GB");
    expect(result.source).toBe("fallback");
  });
});

describe("countryIsoFromAddress", () => {
  it.each([
    ["12 Greenwich High Rd, London SE10 8JL, United Kingdom", "GB"],
    ["Av. Presidente Masaryk 421, Polanco, 11550 Ciudad de México, México", "MX"],
    ["1 Main St, Brooklyn, NY 11201, United States", "US"],
    ["Friedrichstr. 123, 10117 Berlin, Germany", "DE"],
    ["Calle Mayor 1, 28013 Madrid, Spain", "ES"],
    ["1 Rue de Rivoli, 75001 Paris, France", "FR"],
    ["Atatürk Bulvarı 1, 06420 Ankara, Türkiye", "TR"],
  ])("parses %j → %s", (address, iso) => {
    expect(countryIsoFromAddress(address)).toBe(iso);
  });

  it("returns null for missing / unparseable / unknown-suffix addresses", () => {
    expect(countryIsoFromAddress(null)).toBeNull();
    expect(countryIsoFromAddress(undefined)).toBeNull();
    expect(countryIsoFromAddress("")).toBeNull();
    expect(countryIsoFromAddress("just one line no comma")).toBeNull();
    expect(countryIsoFromAddress("1 Foo St, Atlantis")).toBeNull();
  });
});

describe("workspaceDefaultLocaleFromLanguage", () => {
  it.each([
    ["tr", "tr-TR"],
    ["TR", "tr-TR"],
    ["tr-TR", "tr-TR"],
    ["en", "en-GB"],
    ["en-US", "en-US"],
    ["de", "de-DE"],
    ["es", "es-ES"],
    ["fr", "fr-FR"],
  ])("projects %j → %s", (lang, locale) => {
    expect(workspaceDefaultLocaleFromLanguage(lang)).toBe(locale);
  });

  it("returns null for unknown / empty inputs", () => {
    expect(workspaceDefaultLocaleFromLanguage(null)).toBeNull();
    expect(workspaceDefaultLocaleFromLanguage("")).toBeNull();
    expect(workspaceDefaultLocaleFromLanguage("kl")).toBeNull();
  });
});

describe("logLocaleResolution — telemetry contract", () => {
  it("emits truth.locale.resolved with the BCP-47 tag + source", () => {
    logLocaleResolution({
      leadId: "lead_1",
      workspaceId: "ws_1",
      resolution: {
        resolved: "en-GB",
        source: "lead_country_dominant",
        reasoning: "test",
      },
      workspaceDefaultLocale: "tr-TR",
      leadCountry: "GB",
    });
    const resolvedCalls = loggerSpy.info.mock.calls.filter(
      (c: unknown[]) => c[0] === "truth.locale.resolved",
    );
    expect(resolvedCalls).toHaveLength(1);
    expect(resolvedCalls[0][1]).toMatchObject({
      leadId: "lead_1",
      workspaceId: "ws_1",
      locale: "en-GB",
      source: "lead_country_dominant",
    });
  });

  it("emits truth.locale.workspace_lead_mismatch when lead country beat a different workspace default", () => {
    logLocaleResolution({
      leadId: "lead_1",
      workspaceId: "ws_1",
      resolution: {
        resolved: "en-GB",
        source: "lead_country_dominant",
        reasoning: "test",
      },
      workspaceDefaultLocale: "tr-TR",
      leadCountry: "GB",
    });
    const mismatchCalls = loggerSpy.info.mock.calls.filter(
      (c: unknown[]) => c[0] === "truth.locale.workspace_lead_mismatch",
    );
    expect(mismatchCalls).toHaveLength(1);
    expect(mismatchCalls[0][1]).toMatchObject({
      leadId: "lead_1",
      workspaceId: "ws_1",
      workspaceLocale: "tr-TR",
      leadCountry: "GB",
    });
  });

  it("does NOT emit workspace_lead_mismatch when source is workspace_default (no mismatch by definition)", () => {
    logLocaleResolution({
      leadId: "lead_1",
      workspaceId: "ws_1",
      resolution: {
        resolved: "en-US",
        source: "workspace_default",
        reasoning: "test",
      },
      workspaceDefaultLocale: "en-US",
      leadCountry: null,
    });
    const mismatchCalls = loggerSpy.info.mock.calls.filter(
      (c: unknown[]) => c[0] === "truth.locale.workspace_lead_mismatch",
    );
    expect(mismatchCalls).toHaveLength(0);
  });

  it("does NOT emit workspace_lead_mismatch when lead country and workspace default agree", () => {
    logLocaleResolution({
      leadId: "lead_1",
      workspaceId: "ws_1",
      resolution: {
        resolved: "tr-TR",
        source: "lead_country_dominant",
        reasoning: "test",
      },
      workspaceDefaultLocale: "tr-TR",
      leadCountry: "TR",
    });
    const mismatchCalls = loggerSpy.info.mock.calls.filter(
      (c: unknown[]) => c[0] === "truth.locale.workspace_lead_mismatch",
    );
    expect(mismatchCalls).toHaveLength(0);
  });
});

describe("prompt-injection helpers", () => {
  it("buildLocaleInstruction wraps the BCP-47 tag + human label", () => {
    expect(buildLocaleInstruction("en-GB")).toContain("en-GB");
    expect(buildLocaleInstruction("en-GB")).toContain("British English");
    expect(buildLocaleInstruction("tr-TR")).toContain("Turkish");
    expect(buildLocaleInstruction("es-ES")).toContain("es-ES");
  });

  it("humanReadableLocale covers every OutreachLocale", () => {
    expect(humanReadableLocale("tr-TR")).toMatch(/Turkish/);
    expect(humanReadableLocale("en-GB")).toMatch(/British/);
    expect(humanReadableLocale("en-US")).toMatch(/American/);
    expect(humanReadableLocale("de-DE")).toMatch(/German/);
    expect(humanReadableLocale("es-ES")).toMatch(/Spanish/);
    expect(humanReadableLocale("fr-FR")).toMatch(/French/);
  });

  it("legacyLanguageForLocale projects every locale onto the TR/EN branch the existing prompt builders accept", () => {
    expect(legacyLanguageForLocale("tr-TR")).toBe("tr");
    expect(legacyLanguageForLocale("en-GB")).toBe("en");
    expect(legacyLanguageForLocale("en-US")).toBe("en");
    expect(legacyLanguageForLocale("de-DE")).toBe("en");
    expect(legacyLanguageForLocale("es-ES")).toBe("en");
    expect(legacyLanguageForLocale("fr-FR")).toBe("en");
  });
});
