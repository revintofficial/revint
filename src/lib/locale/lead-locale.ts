/**
 * Truth Layer v1 — T-B Locale Gate & Outreach Safety.
 *
 * Resolves the outreach locale per master plan §2.6 and Open Decision
 * §10.1 (locked: lead country wins). Order:
 *   1. `lead.country` resolves via `COUNTRY_TO_LOCALE` →
 *      source = `lead_country_dominant`.
 *   2. else `workspace.defaultLocale` → source = `workspace_default`.
 *   3. else `en-GB` → source = `fallback`.
 *
 * This file is the single producer of `LocaleResolution` shapes for
 * the outreach worker fleet (opener-writer, lead-response,
 * ai-receptionist). Each consumer:
 *   - Computes the resolution before the Gemini call.
 *   - Logs `truth.locale.resolved` server-side (and
 *     `truth.locale.workspace_lead_mismatch` when the lead country
 *     beats the workspace default).
 *   - When the `TRUTH_LAYER_LOCALE_GATE` flag is ON, injects the
 *     resolved locale into the Gemini prompt and records the
 *     `LocaleResolution` on the `AgentRun.outputJson`.
 *   - When the flag is OFF, still computes + logs the resolution
 *     (so the shadow-run dashboard can compare planned vs legacy
 *     behavior), but the prompt itself stays on the legacy
 *     workspace-language branch.
 *
 * Why `Lead.country` doesn't come from Prisma:
 *   The schema does not (yet) carry a typed `country` column on
 *   `Lead`. Reference fixtures in `tests/fixtures/leads/*.json` do
 *   carry one, and so the abstract `resolveOutreachLocale` accepts
 *   `{ country: string | null }` directly. For live worker calls we
 *   derive an ISO-3166-1 alpha-2 code from `lead.formattedAddress`
 *   via `countryIsoFromAddress` — narrow on purpose, only the
 *   countries we actually outreach to today are covered (mirrors
 *   `COUNTRY_TO_LOCALE`).
 */

import {
  COUNTRY_TO_LOCALE,
  resolveLocaleFromCountry,
  type LocaleResolution,
  type OutreachLocale,
} from "@/lib/sdr-brain/contracts";
import { logger } from "@/lib/logger";

const FALLBACK_LOCALE: OutreachLocale = "en-GB";

const OUTREACH_LOCALES: ReadonlySet<OutreachLocale> = new Set<OutreachLocale>(
  Object.values(COUNTRY_TO_LOCALE),
);

export interface LocaleLeadInput {
  /** ISO-3166-1 alpha-2 country code (e.g. "GB", "TR"). Case-insensitive. */
  country?: string | null;
}

export interface LocaleWorkspaceInput {
  /**
   * Resolved workspace fallback locale. May be a typed `OutreachLocale`
   * (preferred — comes from `tests/fixtures/leads/*.json`) or `null`.
   * Unknown / non-OutreachLocale strings are treated as `null` so we
   * never round-trip a garbage value into a Gemini prompt.
   */
  defaultLocale?: OutreachLocale | string | null;
}

/**
 * Pure resolver. No I/O, no logging. Workers call this then dispatch
 * `logLocaleResolution` themselves so the test surface stays small.
 */
export function resolveOutreachLocale(
  lead: LocaleLeadInput,
  workspace: LocaleWorkspaceInput,
): LocaleResolution {
  const rawCountry = typeof lead.country === "string" ? lead.country.trim() : "";
  const leadLocale = rawCountry ? resolveLocaleFromCountry(rawCountry) : null;
  if (leadLocale) {
    return {
      resolved: leadLocale,
      source: "lead_country_dominant",
      reasoning: `Lead country ${rawCountry.toUpperCase()} maps to ${leadLocale}; lead country wins per Open Decision §10.1.`,
    };
  }

  const wsDefault = normalizeWorkspaceLocale(workspace.defaultLocale ?? null);
  if (wsDefault) {
    const reason = rawCountry
      ? `Lead country ${rawCountry.toUpperCase()} not in COUNTRY_TO_LOCALE table; falling back to workspace defaultLocale ${wsDefault}.`
      : `No lead country on record; using workspace defaultLocale ${wsDefault}.`;
    return {
      resolved: wsDefault,
      source: "workspace_default",
      reasoning: reason,
    };
  }

  return {
    resolved: FALLBACK_LOCALE,
    source: "fallback",
    reasoning: `No lead country and no workspace defaultLocale; using ${FALLBACK_LOCALE} as the global fallback.`,
  };
}

function normalizeWorkspaceLocale(
  value: string | null | undefined,
): OutreachLocale | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (OUTREACH_LOCALES.has(trimmed as OutreachLocale)) {
    return trimmed as OutreachLocale;
  }
  return null;
}

/**
 * Human-readable label for prompt injection. Surfaced inside the
 * Gemini instruction so the model has both the BCP-47 tag and a
 * natural-language hint ("en-GB (British English)").
 */
export function humanReadableLocale(locale: OutreachLocale): string {
  switch (locale) {
    case "tr-TR":
      return "Turkish (Türkçe)";
    case "en-GB":
      return "British English";
    case "en-US":
      return "American English";
    case "de-DE":
      return "German (Deutsch)";
    case "es-ES":
      return "Spanish (Español)";
    case "fr-FR":
      return "French (Français)";
  }
}

/**
 * Pre-built instruction line every outreach worker prepends to its
 * Gemini prompt when `TRUTH_LAYER_LOCALE_GATE` is ON. Single source
 * of truth so the wording stays in sync across workers and the
 * test surface can grep one literal.
 */
export function buildLocaleInstruction(locale: OutreachLocale): string {
  return `Write the entire message in ${locale} (${humanReadableLocale(locale)}). Do not mix languages.`;
}

/**
 * Project an `OutreachLocale` onto the legacy "tr" / "en" branch the
 * pre-Truth-Layer prompts switch on. Workers that still keep their
 * TR/EN branching pass the projection in instead of the raw
 * `workspace.language`, so a TR workspace + GB lead opener actually
 * renders in English even when the existing branch logic stays.
 */
export function legacyLanguageForLocale(locale: OutreachLocale): "tr" | "en" {
  return locale === "tr-TR" ? "tr" : "en";
}

/**
 * Country-name (English suffix of `formattedAddress`) → ISO-3166-1
 * alpha-2 lookup. Intentionally narrow: only the countries we
 * outreach to today (mirrors `COUNTRY_TO_LOCALE`). Add via PR with a
 * real lead behind it — speculative additions silently widen the
 * locale gate.
 */
const COUNTRY_NAME_TO_ISO: Readonly<Record<string, string>> = {
  Türkiye: "TR",
  Turkey: "TR",
  "United Kingdom": "GB",
  UK: "GB",
  "Great Britain": "GB",
  England: "GB",
  Scotland: "GB",
  Wales: "GB",
  "Northern Ireland": "GB",
  Ireland: "IE",
  "United States": "US",
  USA: "US",
  "United States of America": "US",
  Canada: "CA",
  Australia: "AU",
  Germany: "DE",
  Deutschland: "DE",
  Austria: "AT",
  Österreich: "AT",
  Switzerland: "CH",
  Schweiz: "CH",
  Suisse: "CH",
  Spain: "ES",
  España: "ES",
  Mexico: "MX",
  México: "MX",
  Argentina: "AR",
  France: "FR",
  Belgium: "BE",
  België: "BE",
  Belgique: "BE",
};

/**
 * Derive a country ISO from a Google-Places-style `formattedAddress`.
 * Reads the last comma-separated segment ("12 Foo St, London SE10,
 * United Kingdom" → "United Kingdom" → "GB"). Returns `null` when
 * the suffix isn't a known outreach country — workers then fall
 * through to the workspace default.
 */
export function countryIsoFromAddress(
  formattedAddress: string | null | undefined,
): string | null {
  if (!formattedAddress) return null;
  const segments = formattedAddress
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0) return null;
  const last = segments[segments.length - 1];
  return COUNTRY_NAME_TO_ISO[last] ?? null;
}

/**
 * Best-effort projection of `workspace.language` (legacy 2-letter
 * code on `Workspace` — see `prisma/schema.prisma`) onto an
 * `OutreachLocale`. Used when `ctx.workspace` doesn't surface a
 * typed `defaultLocale` (the current production shape) and we still
 * need *some* fallback to compare against the lead country.
 */
export function workspaceDefaultLocaleFromLanguage(
  language: string | null | undefined,
): OutreachLocale | null {
  if (!language) return null;
  const l = language.toLowerCase().trim();
  if (l === "tr" || l === "tr-tr") return "tr-TR";
  if (l === "en" || l === "en-gb") return "en-GB";
  if (l === "en-us") return "en-US";
  if (l === "de" || l === "de-de") return "de-DE";
  if (l === "es" || l === "es-es") return "es-ES";
  if (l === "fr" || l === "fr-fr") return "fr-FR";
  return null;
}

/**
 * Server-side telemetry emitter for the T-B track. PostHog's
 * `track()` helper only fires from the browser (it wraps
 * `posthog-js`), so workers use the structured logger instead —
 * log aggregators ingest the `event` field as the PostHog event
 * name downstream. The Wave 0 catalog pre-declared both names so
 * T-H Observability picks them up without touching this file.
 */
export function logLocaleResolution(args: {
  leadId: string;
  workspaceId: string;
  resolution: LocaleResolution;
  workspaceDefaultLocale: OutreachLocale | null;
  leadCountry: string | null;
}): void {
  logger.info("truth.locale.resolved", {
    leadId: args.leadId,
    workspaceId: args.workspaceId,
    locale: args.resolution.resolved,
    source: args.resolution.source,
  });
  if (
    args.resolution.source === "lead_country_dominant" &&
    args.workspaceDefaultLocale &&
    args.workspaceDefaultLocale !== args.resolution.resolved
  ) {
    logger.info("truth.locale.workspace_lead_mismatch", {
      leadId: args.leadId,
      workspaceId: args.workspaceId,
      workspaceLocale: args.workspaceDefaultLocale,
      leadCountry: args.leadCountry,
    });
  }
}
