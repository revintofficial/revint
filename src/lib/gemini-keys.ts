/**
 * Gemini API key pool with round-robin selection + 403/429 cooldown.
 *
 * The April-26 beta diagnostic on workspace
 * 5496e39e-cc76-41bd-b18b-f1128fb9e41b showed every WEBSITE_AUDITOR /
 * REVIEW_ANALYST run failing the same way: Gemini rejected the single
 * `GEMINI_API_KEY` with 403 (revoked / quota-blocked / region-blocked),
 * which cascaded to the whole worker pool. With one key there is no
 * recovery short of an env var change + redeploy.
 *
 * This module spreads load across `GEMINI_API_KEY_1..N` (legacy
 * `GEMINI_API_KEY` is also accepted as a fallback). On 403 we mark
 * the offending key cool for 5 minutes and skip it on subsequent
 * picks; if every key is cool we still surface ONE of them so the
 * caller can fail loud with a useful error rather than the cryptic
 * "no keys available" message.
 *
 * Every Gemini-calling site should import `getGeminiKey()` instead of
 * reading `process.env.GEMINI_API_KEY` directly. The retry-on-403
 * helpers (`callWithKeyRotation`) wrap the typical pattern:
 *
 *   await callWithKeyRotation((apiKey) => embed(text, apiKey));
 *
 * No state is persisted — cooldowns reset on process restart, which is
 * fine because BullMQ workers are short-lived processes.
 */

const COOLDOWN_MS = 5 * 60 * 1000;

interface KeyState {
  apiKey: string;
  cooldownUntil: number;
  lastUsedAt: number;
  /** Identifier used in logs — last 4 chars of the key, never the full key. */
  fingerprint: string;
}

let pool: KeyState[] | null = null;

function fingerprint(key: string): string {
  if (key.length < 6) return "****";
  return `..${key.slice(-4)}`;
}

function loadPool(): KeyState[] {
  if (pool !== null) return pool;
  const numbered: string[] = [];
  for (let i = 1; i <= 8; i++) {
    const v = process.env[`GEMINI_API_KEY_${i}`];
    if (v && v.trim()) numbered.push(v.trim());
  }
  const single = process.env.GEMINI_API_KEY?.trim();
  if (single && !numbered.includes(single)) numbered.push(single);
  pool = numbered.map((k) => ({
    apiKey: k,
    cooldownUntil: 0,
    lastUsedAt: 0,
    fingerprint: fingerprint(k),
  }));
  return pool;
}

/** Test-only — flushes the pool so subsequent calls re-read env vars. */
export function _resetGeminiKeysForTests(): void {
  pool = null;
}

/**
 * Returns one usable Gemini API key, preferring the least-recently-used
 * key that is NOT in cooldown. Throws when no keys are configured at
 * all (different from "all keys cool"; that case still returns one so
 * the caller produces a useful 403 error rather than a config error).
 */
export function getGeminiKey(): string {
  const keys = loadPool();
  if (keys.length === 0) {
    throw new Error(
      "No GEMINI_API_KEY set — configure at least GEMINI_API_KEY or GEMINI_API_KEY_1",
    );
  }

  const now = Date.now();
  const usable = keys.filter((k) => k.cooldownUntil <= now);
  const candidates = usable.length > 0 ? usable : keys;
  // Round-robin via "least-recently-used"; ties break on insertion order.
  candidates.sort((a, b) => a.lastUsedAt - b.lastUsedAt);
  const chosen = candidates[0];
  chosen.lastUsedAt = now;
  return chosen.apiKey;
}

/**
 * Marks a key cool for COOLDOWN_MS. Called by `callWithKeyRotation`
 * when the upstream returns 403 / revoked / forbidden, but exposed as
 * a public function so call-sites that don't go through the wrapper
 * (subvertical-classifier, ai-receptionist, ...) can still report
 * outages.
 */
export function markGeminiKeyCool(apiKey: string, reason: string): void {
  const keys = loadPool();
  const entry = keys.find((k) => k.apiKey === apiKey);
  if (!entry) return;
  entry.cooldownUntil = Date.now() + COOLDOWN_MS;
  // Lazy import to avoid pulling a big logger surface into Gemini-light
  // call sites (e.g. /api/health pings the pool).
  void import("./logger").then(({ logger }) => {
    logger.warn("gemini.key.cooldown", {
      keyFingerprint: entry.fingerprint,
      cooldownMs: COOLDOWN_MS,
      reason: reason.slice(0, 120),
    });
  });
}

/**
 * Returns true when EVERY configured key is currently in cooldown.
 * Used by the Gemini-dependent worker boot health check + the dossier
 * cooldown gate so the UI can render "Gemini API unavailable — try
 * again in a few minutes" instead of letting the run fail loud.
 */
export function allGeminiKeysCool(): boolean {
  const keys = loadPool();
  if (keys.length === 0) return true;
  const now = Date.now();
  return keys.every((k) => k.cooldownUntil > now);
}

/** Read-only snapshot of the pool for diagnostic surfaces (status pages). */
export function getGeminiKeyDiagnostics(): Array<{
  fingerprint: string;
  cooldownUntil: number;
  lastUsedAt: number;
  cool: boolean;
}> {
  const now = Date.now();
  return loadPool().map((k) => ({
    fingerprint: k.fingerprint,
    cooldownUntil: k.cooldownUntil,
    lastUsedAt: k.lastUsedAt,
    cool: k.cooldownUntil > now,
  }));
}

/**
 * Heuristic: does this thrown error look like a Gemini 403 (auth /
 * revoked / quota-blocked) rather than a transient 429 / 5xx?
 *
 * The Google SDK throws plain `Error` objects whose `.message`
 * contains text like "[403 Forbidden]" or "PERMISSION_DENIED".
 * Looking at the message is brittle but it is the only signal the SDK
 * surfaces consistently across versions.
 */
export function isGeminiAuthFailure(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (!msg) return false;
  return /\b403\b|\bforbidden\b|permission_denied|api[_ ]?key|unauthorized|invalid[_ ]argument/i.test(
    msg,
  );
}

/**
 * Wraps a Gemini-calling closure with key rotation + 403 cooldown.
 * The closure receives one apiKey; on 403 we mark that key cool and
 * retry with the next key, up to `maxAttempts` total. Non-403 errors
 * propagate immediately because they are not key-specific.
 *
 * Use ONLY for 403 recovery. Retries on 429 / 5xx are owned by the
 * call-site (the SDK has its own backoff, the embed wrapper has its
 * own retry loop). Stacking another retry layer here would multiply
 * the latency budget.
 */
export async function callWithKeyRotation<T>(
  fn: (apiKey: string) => Promise<T>,
  opts: { maxAttempts?: number; label?: string } = {},
): Promise<T> {
  const max = Math.max(1, opts.maxAttempts ?? 3);
  const triedFingerprints = new Set<string>();
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < max; attempt++) {
    const key = getGeminiKey();
    const fp = fingerprint(key);
    if (triedFingerprints.has(fp)) {
      // Same key handed back means the pool ran dry of fresh keys.
      break;
    }
    triedFingerprints.add(fp);
    try {
      return await fn(key);
    } catch (err) {
      lastErr = err;
      if (!isGeminiAuthFailure(err)) throw err;
      markGeminiKeyCool(
        key,
        opts.label ? `${opts.label}: 403` : "403_during_call",
      );
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(`Gemini call failed after ${max} attempts (key rotation exhausted)`);
}
