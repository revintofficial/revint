/**
 * Vertical pack engine — niche-agnostic, deterministic signal -> module
 * readiness scorer.
 *
 * This is the generalised core extracted from the FineDine (F&B) scorer.
 * A "vertical pack" describes ONE niche (F&B, beauty, dental, ...) as
 * data:
 *   - how to normalize raw substrate into explicit tri-state signals,
 *   - declarative scoring rules (source-tagged, additive within a cap),
 *   - hard do-not-pitch exclusions,
 *   - a weighted play library,
 *   - an optional context multiplier (e.g. multi-location),
 *   - tuning constants.
 *
 * The engine itself contains NO niche knowledge. It is pure and
 * deterministic so the Head Agent (Claude) always chooses its final
 * angle from a grounded shortlist rather than inventing module fit.
 *
 * Design invariants (carried over from the F&B v2 teardown):
 *   1. `unknown` signals are NEUTRAL — never add/subtract points.
 *   2. Per-source caps prevent any one loud signal from dominating.
 *   3. Context multiplier is applied once, post-accumulation.
 *   4. Plays are a weighted, ranked, conflict-resolved layer.
 *   5. Output is ranked: primary / secondary / excluded.
 *   6. Every fit carries `matchedSignals` for evidence grounding.
 */

export type Tri = "present" | "absent" | "unknown";

/** Normalize an optional boolean to an explicit tri-state. */
export function tri(v: boolean | null | undefined): Tri {
  if (v == null) return "unknown";
  return v ? "present" : "absent";
}

/** Normalize a threshold check that requires all inputs to be known. */
export function triThreshold(known: boolean, pass: boolean): Tri {
  if (!known) return "unknown";
  return pass ? "present" : "absent";
}

/**
 * A scoring rule contributes `points` to `module` from a named
 * `source` when `when(n)` holds. Points are capped per (module, source).
 * `M` = module id union, `N` = the pack's normalized-signal shape.
 */
export interface ScoringRule<M extends string, N> {
  module: M;
  source: string;
  points: number;
  /** Rep-facing reason, grounded in the matched signal. */
  reason: string;
  /** Evidence key surfaced in `matchedSignals`. */
  signal: string;
  when: (n: N) => boolean;
}

export interface PackPlay<M extends string, N> {
  id: string;
  label: string;
  module: M;
  pitch: string;
  dontPitch: string;
  /** Raw signal strength 0..1 for this play's defining triggers. */
  strength: (n: N) => number;
}

export interface ContextMultiplier<M extends string, N> {
  when: (n: N) => boolean;
  factor: number;
  amplifies: ReadonlySet<M>;
}

export interface PackConfig {
  /** Max points any single source can add to one module. */
  sourceCap: number;
  primaryThreshold: number;
  secondaryThreshold: number;
  playModuleWeight: number;
  playStrengthWeight: number;
}

export const DEFAULT_PACK_CONFIG: PackConfig = {
  sourceCap: 50,
  primaryThreshold: 35,
  secondaryThreshold: 25,
  playModuleWeight: 0.7,
  playStrengthWeight: 0.3,
};

/**
 * A vertical pack fully describes one niche.
 * `M` = module id union, `Raw` = raw substrate input, `N` = normalized.
 */
export interface VerticalPack<M extends string, Raw, N> {
  id: string;
  label: string;
  normalize: (raw: Raw) => N;
  rules: ReadonlyArray<ScoringRule<M, N>>;
  exclusions: (n: N) => Map<M, string>;
  plays: ReadonlyArray<PackPlay<M, N>>;
  multiplier?: ContextMultiplier<M, N>;
  config?: Partial<PackConfig>;
}

export interface ModuleFit<M extends string> {
  module: M;
  /** 0-100 readiness. */
  readiness: number;
  reason: string;
  matchedSignals: string[];
  doNotPitch?: boolean;
  doNotPitchReason?: string;
}

export interface ScoredPlay<M extends string> {
  id: string;
  label: string;
  module: M;
  pitch: string;
  dontPitch: string;
  /** 0-100 blended score: module readiness + signal strength. */
  score: number;
}

export interface ModuleFitResult<M extends string> {
  packId: string;
  fits: ModuleFit<M>[];
  primaryModule: M | null;
  secondaryModules: M[];
  excludedModules: M[];
  plays: ScoredPlay<M>[];
}

interface Acc {
  bySource: Map<string, number>;
  reasons: string[];
  matched: string[];
}

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

/**
 * Run a vertical pack over raw substrate and produce a ranked,
 * evidence-grounded module-fit result. Pure + deterministic.
 */
export function computeModuleFit<M extends string, Raw, N>(
  pack: VerticalPack<M, Raw, N>,
  raw: Raw,
): ModuleFitResult<M> {
  const cfg: PackConfig = { ...DEFAULT_PACK_CONFIG, ...(pack.config ?? {}) };
  const n = pack.normalize(raw);

  const acc = new Map<M, Acc>();
  for (const rule of pack.rules) {
    if (!rule.when(n)) continue;
    const cur: Acc = acc.get(rule.module) ?? {
      bySource: new Map<string, number>(),
      reasons: [],
      matched: [],
    };
    const sourceTotal = cur.bySource.get(rule.source) ?? 0;
    const allowed = Math.max(0, cfg.sourceCap - sourceTotal);
    const applied = Math.min(rule.points, allowed);
    if (applied > 0) cur.bySource.set(rule.source, sourceTotal + applied);
    // Record evidence + reason even when capped, so grounding is complete.
    if (!cur.reasons.includes(rule.reason)) cur.reasons.push(rule.reason);
    if (!cur.matched.includes(rule.signal)) cur.matched.push(rule.signal);
    acc.set(rule.module, cur);
  }

  const exclusions = pack.exclusions(n);
  const mult = pack.multiplier;
  const multActive = mult ? mult.when(n) : false;

  const fits: ModuleFit<M>[] = [];
  for (const [module, a] of acc.entries()) {
    let readiness = 0;
    for (const v of a.bySource.values()) readiness += v;
    if (multActive && mult && mult.amplifies.has(module)) {
      readiness = Math.round(readiness * mult.factor);
    }
    readiness = Math.max(0, Math.min(100, readiness));
    const ex = exclusions.get(module);
    fits.push({
      module,
      readiness,
      reason: a.reasons.join(" "),
      matchedSignals: a.matched,
      ...(ex ? { doNotPitch: true, doNotPitchReason: ex } : {}),
    });
  }

  // Exclusion-only modules (no positive fit) surface as explicit guidance.
  for (const [module, reason] of exclusions.entries()) {
    if (!acc.has(module)) {
      fits.push({
        module,
        readiness: 0,
        reason: "",
        matchedSignals: [],
        doNotPitch: true,
        doNotPitchReason: reason,
      });
    }
  }

  fits.sort((a, b) => b.readiness - a.readiness);

  const excludedModules = fits.filter((f) => f.doNotPitch).map((f) => f.module);
  const eligible = fits.filter((f) => !f.doNotPitch && f.readiness > 0);
  const primaryModule =
    eligible.length > 0 && eligible[0].readiness >= cfg.primaryThreshold
      ? eligible[0].module
      : null;
  const secondaryModules = eligible
    .filter((f) => f.module !== primaryModule && f.readiness >= cfg.secondaryThreshold)
    .map((f) => f.module);

  const readinessByModule = new Map(fits.map((f) => [f.module, f.readiness]));
  const scored: ScoredPlay<M>[] = [];
  const seen = new Set<M>();
  for (const play of pack.plays) {
    if (exclusions.has(play.module)) continue;
    if (seen.has(play.module)) continue;
    const moduleReadiness = readinessByModule.get(play.module) ?? 0;
    const strength = clamp01(play.strength(n));
    if (moduleReadiness <= 0 && strength <= 0) continue;
    seen.add(play.module);
    const score = Math.round(
      moduleReadiness * cfg.playModuleWeight + strength * 100 * cfg.playStrengthWeight,
    );
    scored.push({
      id: play.id,
      label: play.label,
      module: play.module,
      pitch: play.pitch,
      dontPitch: play.dontPitch,
      score,
    });
  }
  scored.sort((a, b) => b.score - a.score);

  return { packId: pack.id, fits, primaryModule, secondaryModules, excludedModules, plays: scored };
}
