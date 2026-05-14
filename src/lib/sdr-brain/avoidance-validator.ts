/**
 * Truth Layer v1 — T-F NBA Hygiene avoidance validator.
 *
 * Pure function. Drops `AvoidanceTopic[]` entries that semantically
 * collide with `RecommendedPackage.features[]`. The whole point of the
 * validator is to short-circuit logically self-defeating outputs like
 * `avoidanceTopics: ["online reservations missing"]` paired with
 * `recommendedPackage.features: ["online_reservations"]` — telling the
 * SDR not to pitch the very package the lead's pain demands is the
 * canonical "false avoidance" failure mode the master plan §3 (T-F)
 * requires us to suppress.
 *
 * Algorithm (token-set inclusion with normalisation):
 *   1. Tokenise both sides — split on whitespace + snake_case +
 *      kebab-case + camelCase boundaries; lowercase; drop non-
 *      alphanumerics.
 *   2. Filter out a small list of generic stopwords ("missing", "no",
 *      "the", etc.) so "online reservations missing" reduces to
 *      `{online, reservation}`.
 *   3. Singularise trailing plurals (-s, -ies, -es, -ches, -shes) so
 *      `"delivery integrations"` matches `"delivery_integration"`.
 *   4. Drop the topic when EVERY (non-stopword, singularised) feature
 *      token appears in the topic's token set.
 *
 * Why "all feature tokens must appear" instead of token-set Jaccard
 * with a 0.5 threshold? Features in the codebase are short canonical
 * slugs (1-3 words). A Jaccard threshold of 0.5 would drop any topic
 * that mentions "online" against `online_X` (because "online" alone
 * gives 1/2 overlap), which over-shoots and silently strips too much
 * avoidance signal. The all-tokens rule maps cleanly onto the §3
 * fixture cases (`online reservations missing` ↔ `online_reservations`
 * drops; `loud music vibes` ↔ `online_reservations` keeps; plural
 * variants drop) and keeps the false-positive surface minimal — a
 * topic that names only ONE word from a feature stays.
 *
 * False-positive concerns audited:
 *   - Single-word features (e.g. `"reservations"`) DO drop any topic
 *     that mentions a singularised "reservation". This is intentional —
 *     a feature literally named `"reservations"` IS the avoidance
 *     overlap. Niche packs are expected to use richer slugs.
 *   - Stopword-only topics (e.g. `"missing the on a"`) tokenise to
 *     `{}` and never overlap. Treated as "keep".
 *   - Stopword-only features tokenise to `{}` and never trigger a
 *     drop (guarded explicitly below).
 *
 * Producer: this module — pure, side-effect-free.
 * Consumers: `NextGestureBlock.tsx` (UI surface), test fixtures.
 * Telemetry: callers emit `truth.nba.avoidance_overlap_dropped` when
 *            `dropped.length > 0`. The validator itself is silent so
 *            it stays usable from React Server Components without an
 *            ambient `track()` import.
 */

import type { AvoidanceTopic } from "@/lib/sdr-brain/contracts";

const STOPWORDS: ReadonlySet<string> = new Set([
  "a",
  "an",
  "the",
  "of",
  "for",
  "with",
  "without",
  "and",
  "or",
  "missing",
  "no",
  "not",
  "none",
  "lack",
  "lacks",
  "lacking",
  "issue",
  "issues",
  "problem",
  "problems",
  "needs",
  "need",
  "is",
  "are",
  "to",
  "be",
  "in",
  "on",
  "at",
  "we",
  "they",
  "this",
  "that",
  "any",
  "some",
]);

/**
 * Trivial English plural → singular reducer. Intentionally NOT a full
 * lemmatiser (no `pluralize` dep) — we only need to collapse the
 * lexical variants the master plan §3 test surface enumerates:
 *   - `"reservations"` → `"reservation"`
 *   - `"integrations"` → `"integration"`
 *   - `"deliveries"` → `"delivery"`
 *   - `"boxes"` / `"churches"` → `"box"` / `"church"`
 *
 * We keep the rule narrow so we don't accidentally singularise a slug
 * that happens to end in `s` (e.g. an SKU like `"axes_pro"` would
 * stay `"axe"` under the simple `-s` rule, which is fine for our
 * comparison).
 */
function singularize(token: string): string {
  if (token.length <= 3) return token;
  if (token.endsWith("ies")) return token.slice(0, -3) + "y";
  if (
    token.endsWith("ses") ||
    token.endsWith("xes") ||
    token.endsWith("zes") ||
    token.endsWith("ches") ||
    token.endsWith("shes")
  ) {
    return token.slice(0, -2);
  }
  if (
    token.endsWith("s") &&
    !token.endsWith("ss") &&
    !token.endsWith("us") &&
    !token.endsWith("is")
  ) {
    return token.slice(0, -1);
  }
  return token;
}

function tokenize(input: string): Set<string> {
  return new Set(
    input
      // camelCase boundary → space, so `onlineReservations` becomes
      // `["online", "Reservations"]` before the lowercase + split.
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .toLowerCase()
      .split(/[\s_\-/.,;:!?()[\]{}]+/)
      .map((t) => t.replace(/[^a-z0-9]/g, ""))
      .filter((t) => t.length > 0 && !STOPWORDS.has(t))
      .map(singularize),
  );
}

/**
 * Returns true when `topic` semantically refers to `feature`. The check
 * is asymmetric: every distinctive (non-stopword, singularised) token
 * in the feature must appear in the topic's token set. Exported for
 * direct unit testing alongside `validateAvoidance`.
 */
export function topicCoversFeature(topic: string, feature: string): boolean {
  const featureTokens = tokenize(feature);
  if (featureTokens.size === 0) return false;
  const topicTokens = tokenize(topic);
  if (topicTokens.size === 0) return false;
  for (const t of featureTokens) {
    if (!topicTokens.has(t)) return false;
  }
  return true;
}

export interface ValidateAvoidanceResult {
  kept: AvoidanceTopic[];
  dropped: AvoidanceTopic[];
}

/**
 * Drop `AvoidanceTopic` entries whose `topic` semantically overlaps
 * with any string in `packageFeatures`. The contract is value-pure:
 * the returned arrays preserve original input order, and the union
 * `[...kept, ...dropped]` is a permutation of `topics`.
 *
 * When `packageFeatures` is empty (no recommendation yet) the function
 * passes every topic through unchanged — a missing package is not
 * grounds for stripping avoidance signal.
 */
export function validateAvoidance(
  topics: ReadonlyArray<AvoidanceTopic>,
  packageFeatures: ReadonlyArray<string>,
): ValidateAvoidanceResult {
  if (topics.length === 0) return { kept: [], dropped: [] };
  if (packageFeatures.length === 0) return { kept: [...topics], dropped: [] };

  const kept: AvoidanceTopic[] = [];
  const dropped: AvoidanceTopic[] = [];
  for (const topic of topics) {
    const overlaps = packageFeatures.some((f) =>
      topicCoversFeature(topic.topic, f),
    );
    if (overlaps) dropped.push(topic);
    else kept.push(topic);
  }
  return { kept, dropped };
}
