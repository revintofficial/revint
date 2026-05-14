/**
 * Truth Layer v1 — telemetry catalog drift test.
 *
 * Owner: T-H Observability (Wave 1).
 *
 * What this enforces:
 *
 *   1. Compile- AND runtime-level parity between the typed
 *      `LeadDetailEventCatalog` (compile-time keys) and the runtime
 *      `LEAD_DETAIL_EVENT_NAMES` (frozen list).
 *      - Forward: every catalog key is in the runtime list.
 *      - Reverse: every runtime entry is in the catalog.
 *      The `Record<LeadDetailEventName, true>` exhaustive map gives
 *      us the compile-time half: TypeScript fails the build if a
 *      catalog key is missing here. The runtime asserts close the
 *      loop in the other direction.
 *
 *   2. Every `truth.*` event the master plan §3 contract requires
 *      is *individually* enumerated below. A future contributor who
 *      tries to silently delete one of these gets a red test, not a
 *      mysteriously empty dashboard tile six weeks later.
 *
 *   3. The PostHog dashboard JSON (`dashboards/truth-layer-v1.json`)
 *      parses and references only events that exist in the catalog,
 *      and covers every `truth.*` event at least once.
 *
 *   4. The Sentry alerts YAML (`sentry/truth-layer-alerts.yaml`) is
 *      well-formed and references only events that exist in the
 *      catalog, and contains the three Wave 1 alert ids.
 *
 * This is the only file in `src/__tests__/lead-detail/` that the
 * T-H track owns. Tracks T-A through T-G must not edit it without
 * coordinating with T-H (see `.cursor/agents/CONTRIBUTING.md`).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  LEAD_DETAIL_EVENT_NAMES,
  type LeadDetailEventName,
} from "@/lib/lead-detail/telemetry";
import {
  TRUTH_ERROR_CODES,
  TRUTH_ERROR_CODE_LIST,
  truthFingerprint,
} from "@/lib/sdr-brain/error-catalog";

/**
 * Exhaustive map of every catalog key. TypeScript enforces that this
 * object has EXACTLY the keys of `LeadDetailEventCatalog` — add a key
 * to the catalog without adding it here and `tsc` fails. This is the
 * compile-time half of the parity guarantee; the runtime asserts in
 * the `describe` block below close the loop.
 */
const EXHAUSTIVE_CATALOG_MAP: Record<LeadDetailEventName, true> = {
  // ---------- Lead Detail v2 (phases 1–7) ----------
  "lead_detail.v2.viewed": true,
  "lead_detail.v2.preliminary_received": true,
  "lead_detail.v2.final_received": true,
  "lead_detail.block.expanded": true,
  "lead_detail.evidence_chip.opened": true,
  "lead_detail.snooze": true,
  "lead_detail.disposition": true,
  "lead_detail.queue.advance": true,
  "lead_detail.closest_win.shown": true,
  "lead_detail.closest_win.applied": true,
  "lead_detail.power_tools.viewed": true,
  "lead_detail.reasoning.viewed": true,
  "lead_detail.legacy_hash_consumed": true,
  "lead_detail.legacy_workers_link_followed": true,
  "lead_detail.perf.preliminary_to_paint": true,
  "lead_detail.perf.final_to_paint": true,
  "lead_detail.perf.first_decision_surface": true,
  // ---------- Truth Layer v1 (master plan §2) ----------
  // T-A Decision Gates
  "truth.decision_gate.contact_first_fired": true,
  "truth.decision_gate.authority_first_fired": true,
  "truth.icp_rozet.capped": true,
  "truth.nba.decision_resolved": true,
  // T-B Locale Gate
  "truth.locale.resolved": true,
  "truth.locale.workspace_lead_mismatch": true,
  // T-C Evidence Calibration
  "truth.severity.normalized": true,
  "truth.switch_signal.direction_assigned": true,
  "truth.window_timer.derived": true,
  // T-D Brief Truth-Grounding
  "truth.brief.pain_quoted": true,
  "truth.brief.hypothesis_count": true,
  "truth.brief.website_claim_blocked": true,
  // T-E Website Verification
  "truth.website.verify_started": true,
  "truth.website.verify_completed": true,
  // T-F NBA Hygiene
  "truth.nba.avoidance_overlap_dropped": true,
  "truth.nba.objection_source": true,
  // T-G Surface Fidelity
  "truth.surface.review_kpi_rendered": true,
  // T-H Observability meta
  "truth.observability.kill_switch_armed": true,
};

const ALL_CATALOG_KEYS: ReadonlyArray<LeadDetailEventName> = Object.freeze(
  Object.keys(EXHAUSTIVE_CATALOG_MAP).sort() as LeadDetailEventName[],
);

/**
 * The full list of `truth.*` events Wave 1 promised to emit. Each
 * entry is `satisfies LeadDetailEventName` so a typo or rename in
 * `LeadDetailEventCatalog` fails compile here too — not just at
 * the consumer call site.
 */
const TRUTH_EVENT_NAMES = [
  // T-A
  "truth.decision_gate.contact_first_fired",
  "truth.decision_gate.authority_first_fired",
  "truth.icp_rozet.capped",
  "truth.nba.decision_resolved",
  // T-B
  "truth.locale.resolved",
  "truth.locale.workspace_lead_mismatch",
  // T-C
  "truth.severity.normalized",
  "truth.switch_signal.direction_assigned",
  "truth.window_timer.derived",
  // T-D
  "truth.brief.pain_quoted",
  "truth.brief.hypothesis_count",
  "truth.brief.website_claim_blocked",
  // T-E
  "truth.website.verify_started",
  "truth.website.verify_completed",
  // T-F
  "truth.nba.avoidance_overlap_dropped",
  "truth.nba.objection_source",
  // T-G
  "truth.surface.review_kpi_rendered",
  // T-H
  "truth.observability.kill_switch_armed",
] as const satisfies readonly LeadDetailEventName[];

// -------------------------------------------------------------------
// Catalog parity
// -------------------------------------------------------------------

describe("Truth Layer telemetry catalog — type ↔ runtime parity", () => {
  it("every key in LeadDetailEventCatalog is present in LEAD_DETAIL_EVENT_NAMES", () => {
    const orphans: string[] = [];
    for (const key of ALL_CATALOG_KEYS) {
      if (!LEAD_DETAIL_EVENT_NAMES.includes(key)) {
        orphans.push(key);
      }
    }
    expect(orphans, `Catalog keys missing from LEAD_DETAIL_EVENT_NAMES: ${orphans.join(", ")}`).toEqual([]);
  });

  it("every entry in LEAD_DETAIL_EVENT_NAMES is a key of LeadDetailEventCatalog", () => {
    const orphans: string[] = [];
    for (const name of LEAD_DETAIL_EVENT_NAMES) {
      if (!Object.prototype.hasOwnProperty.call(EXHAUSTIVE_CATALOG_MAP, name)) {
        orphans.push(name);
      }
    }
    expect(orphans, `Runtime entries missing from LeadDetailEventCatalog: ${orphans.join(", ")}`).toEqual([]);
  });

  it("LEAD_DETAIL_EVENT_NAMES has exactly the same length as the catalog", () => {
    expect(LEAD_DETAIL_EVENT_NAMES.length).toBe(ALL_CATALOG_KEYS.length);
  });
});

// -------------------------------------------------------------------
// truth.* explicit enumeration
// -------------------------------------------------------------------

describe("Truth Layer telemetry catalog — explicit truth.* enumeration", () => {
  it("the enumerated truth.* list is exactly the truth.* subset of LEAD_DETAIL_EVENT_NAMES", () => {
    const truthFromRuntime = LEAD_DETAIL_EVENT_NAMES.filter((n) =>
      n.startsWith("truth."),
    ).sort();
    const enumeratedSorted = [...TRUTH_EVENT_NAMES].sort();
    expect(enumeratedSorted).toEqual(truthFromRuntime);
  });

  it.each(TRUTH_EVENT_NAMES)(
    "%s is present in both the type catalog and the runtime list",
    (eventName) => {
      expect(EXHAUSTIVE_CATALOG_MAP).toHaveProperty(eventName);
      expect(LEAD_DETAIL_EVENT_NAMES).toContain(eventName);
    },
  );

  it("every Wave 1 track has at least one truth.* event", () => {
    const prefixes = [
      "truth.decision_gate.", // T-A (partial)
      "truth.icp_rozet.", // T-A
      "truth.nba.decision_resolved", // T-A
      "truth.locale.", // T-B
      "truth.severity.", // T-C
      "truth.switch_signal.", // T-C
      "truth.window_timer.", // T-C
      "truth.brief.", // T-D
      "truth.website.", // T-E
      "truth.nba.avoidance_overlap_dropped", // T-F
      "truth.nba.objection_source", // T-F
      "truth.surface.", // T-G
      "truth.observability.", // T-H
    ];
    for (const prefix of prefixes) {
      const covered = TRUTH_EVENT_NAMES.some(
        (n) => n === prefix || n.startsWith(prefix),
      );
      expect(covered, `No truth.* event covers ${prefix}`).toBe(true);
    }
  });
});

// -------------------------------------------------------------------
// PostHog dashboard JSON smoke test
// -------------------------------------------------------------------

const DASHBOARD_PATH = resolve(
  process.cwd(),
  "dashboards/truth-layer-v1.json",
);

interface DashboardTile {
  id: string;
  display_title: string;
  event_name: string;
  chart_type: string;
  time_range: string;
}

interface DashboardSection {
  id: string;
  track: string;
  title: string;
  tiles: DashboardTile[];
}

interface Dashboard {
  schemaVersion: number;
  name: string;
  slug: string;
  sections: DashboardSection[];
}

describe("Truth Layer dashboard JSON — `dashboards/truth-layer-v1.json`", () => {
  let dashboard: Dashboard;

  it("parses as valid JSON", () => {
    const raw = readFileSync(DASHBOARD_PATH, "utf-8");
    expect(() => {
      dashboard = JSON.parse(raw) as Dashboard;
    }).not.toThrow();
    expect(dashboard).toBeDefined();
    expect(dashboard.schemaVersion).toBeGreaterThanOrEqual(1);
    expect(dashboard.slug).toBe("truth-layer-v1");
  });

  it("every tile.event_name is a known catalog event", () => {
    const raw = readFileSync(DASHBOARD_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Dashboard;
    const unknown: string[] = [];
    for (const section of parsed.sections) {
      for (const tile of section.tiles) {
        if (!Object.prototype.hasOwnProperty.call(EXHAUSTIVE_CATALOG_MAP, tile.event_name)) {
          unknown.push(`${section.id}::${tile.id} → ${tile.event_name}`);
        }
      }
    }
    expect(unknown, `Dashboard references unknown events: ${unknown.join(", ")}`).toEqual([]);
  });

  it("every truth.* event has at least one tile in the dashboard", () => {
    const raw = readFileSync(DASHBOARD_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Dashboard;
    const charted = new Set<string>();
    for (const section of parsed.sections) {
      for (const tile of section.tiles) {
        charted.add(tile.event_name);
      }
    }
    const uncharted: string[] = [];
    for (const name of TRUTH_EVENT_NAMES) {
      if (!charted.has(name)) uncharted.push(name);
    }
    expect(uncharted, `truth.* events missing a dashboard tile: ${uncharted.join(", ")}`).toEqual([]);
  });

  it("every Wave 1 track has its own section", () => {
    const raw = readFileSync(DASHBOARD_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Dashboard;
    const tracks = new Set(parsed.sections.map((s) => s.track));
    for (const t of ["T-A", "T-B", "T-C", "T-D", "T-E", "T-F", "T-G"]) {
      expect(tracks.has(t), `Dashboard missing section for ${t}`).toBe(true);
    }
  });

  it("each tile.id is unique across the dashboard", () => {
    const raw = readFileSync(DASHBOARD_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Dashboard;
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const section of parsed.sections) {
      for (const tile of section.tiles) {
        if (seen.has(tile.id)) dupes.push(tile.id);
        seen.add(tile.id);
      }
    }
    expect(dupes).toEqual([]);
  });
});

// -------------------------------------------------------------------
// Sentry alerts YAML smoke test
// -------------------------------------------------------------------

const SENTRY_PATH = resolve(
  process.cwd(),
  "sentry/truth-layer-alerts.yaml",
);

/**
 * Tiny, scope-bounded YAML structural check. We deliberately do NOT
 * pull in `js-yaml` as a dependency for this test — the YAML config
 * is generic and tool-agnostic (see `sentry/README.md`); the only
 * thing we need to verify here is structural well-formedness.
 *
 * The check enforces:
 *   - Top-level keys are present (`schemaVersion`, `project`,
 *     `sources`, `alerts`).
 *   - Indentation depths are multiples of two (catches the most
 *     common YAML hand-edit error).
 *   - Each `alerts[].id` matches the kebab-case truth-* convention.
 *   - Each `event:` reference is a known catalog event name.
 *
 * If a future contributor wants a stricter parse, they can drop in
 * `js-yaml` and replace this block with `yaml.load(raw)` plus a
 * Zod schema — but for the smoke test the line-based check is
 * enough and zero-dep.
 */
function smokeParseYaml(raw: string): {
  topLevelKeys: string[];
  alertIds: string[];
  eventReferences: string[];
} {
  const lines = raw.split(/\r?\n/);
  const topLevelKeys: string[] = [];
  const alertIds: string[] = [];
  const eventReferences: string[] = [];

  for (const line of lines) {
    if (line.startsWith("#") || line.trim() === "") continue;
    const topLevelMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*):/);
    if (topLevelMatch) topLevelKeys.push(topLevelMatch[1]);
    const idMatch = line.match(/^\s+-?\s+id:\s+([a-z][a-z0-9-]+)\s*$/);
    if (idMatch) alertIds.push(idMatch[1]);
    const eventMatch = line.match(/^\s+event:\s+(truth\.[a-z_.]+)\s*$/);
    if (eventMatch) eventReferences.push(eventMatch[1]);
    const indent = line.match(/^( *)/)?.[1] ?? "";
    expect(
      indent.length % 2,
      `YAML indent is not a multiple of 2 on line: "${line}"`,
    ).toBe(0);
  }
  return { topLevelKeys, alertIds, eventReferences };
}

describe("Truth Layer Sentry alerts YAML — `sentry/truth-layer-alerts.yaml`", () => {
  it("is structurally well-formed (line-based smoke parse)", () => {
    const raw = readFileSync(SENTRY_PATH, "utf-8");
    const parsed = smokeParseYaml(raw);
    expect(parsed.topLevelKeys).toContain("schemaVersion");
    expect(parsed.topLevelKeys).toContain("project");
    expect(parsed.topLevelKeys).toContain("sources");
    expect(parsed.topLevelKeys).toContain("alerts");
  });

  it("contains the three Wave 1 alert ids", () => {
    const raw = readFileSync(SENTRY_PATH, "utf-8");
    const { alertIds } = smokeParseYaml(raw);
    const expected = [
      "truth-severity-normalization-drop",
      "truth-error-code-spike",
      "truth-locale-mismatch-rate",
    ];
    for (const id of expected) {
      expect(alertIds, `Sentry YAML missing alert id ${id}`).toContain(id);
    }
  });

  it("every event: reference is a known catalog event", () => {
    const raw = readFileSync(SENTRY_PATH, "utf-8");
    const { eventReferences } = smokeParseYaml(raw);
    expect(eventReferences.length).toBeGreaterThan(0);
    for (const ref of eventReferences) {
      expect(
        Object.prototype.hasOwnProperty.call(EXHAUSTIVE_CATALOG_MAP, ref),
        `Sentry YAML references unknown event ${ref}`,
      ).toBe(true);
    }
  });
});

// -------------------------------------------------------------------
// Error catalog helpers (exercised by the Sentry alert config)
// -------------------------------------------------------------------

describe("TruthLayerError fingerprint + code list", () => {
  it("TRUTH_ERROR_CODE_LIST is the exhaustive list of TRUTH_ERROR_CODES keys", () => {
    expect([...TRUTH_ERROR_CODE_LIST].sort()).toEqual(
      Object.keys(TRUTH_ERROR_CODES).sort(),
    );
  });

  it("truthFingerprint always starts with 'truth-layer' then the code", () => {
    const fp = truthFingerprint("E_LOCALE_MISMATCH");
    expect(fp[0]).toBe("truth-layer");
    expect(fp[1]).toBe(TRUTH_ERROR_CODES.E_LOCALE_MISMATCH);
    expect(fp.length).toBe(2);
  });

  it("truthFingerprint appends a scope segment when present", () => {
    const fp = truthFingerprint("E_LOCALE_MISMATCH", "ws_abc");
    expect(fp).toEqual([
      "truth-layer",
      TRUTH_ERROR_CODES.E_LOCALE_MISMATCH,
      "ws_abc",
    ]);
  });
});
