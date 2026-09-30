/**
 * Startup env validation. Small on purpose: it checks presence, not shape.
 *
 * - Web (Next.js on Vercel): called from `instrumentation.node.ts`; only
 *   warns, so a missing optional integration never takes the site down.
 * - Workers (Railway): called when the agent-run worker boots; throws in
 *   production so a misconfigured container crash-loops visibly instead of
 *   silently failing every job.
 *
 * `.env.example` is the human-readable list; keep the two in sync.
 */

export type EnvScope = "web" | "worker";

/** Each entry is a list of alternatives; at least one must be set. */
type Requirement = readonly string[];

const REQUIRED: Record<EnvScope, readonly Requirement[]> = {
  web: [
    ["DATABASE_URL"],
    ["NEXT_PUBLIC_SUPABASE_URL"],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY"],
    ["REDIS_URL"],
  ],
  worker: [
    ["DATABASE_URL"],
    ["REDIS_URL"],
    ["GEMINI_API_KEY", "GEMINI_API_KEY_1"],
  ],
};

const RECOMMENDED: Record<EnvScope, readonly Requirement[]> = {
  web: [
    ["NEXT_PUBLIC_APP_URL"],
    ["SUPABASE_SERVICE_ROLE_KEY"],
    ["GEMINI_API_KEY", "GEMINI_API_KEY_1"],
    ["STRIPE_SECRET_KEY"],
    ["STRIPE_WEBHOOK_SECRET"],
    ["CRON_SECRET"],
    ["RESEND_API_KEY"],
  ],
  worker: [
    ["GOOGLE_PLACES_API_KEY"],
    ["APIFY_TOKEN"],
    ["ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY_1"],
    ["NEXT_PUBLIC_APP_URL"],
  ],
};

function isSet(name: string, env: NodeJS.ProcessEnv): boolean {
  const v = env[name];
  return typeof v === "string" && v.trim().length > 0;
}

function unmet(reqs: readonly Requirement[], env: NodeJS.ProcessEnv): string[] {
  return reqs
    .filter((alts) => !alts.some((name) => isSet(name, env)))
    .map((alts) => alts.join(" | "));
}

export interface EnvReport {
  missing: string[];
  missingRecommended: string[];
}

export function checkEnv(scope: EnvScope, env: NodeJS.ProcessEnv = process.env): EnvReport {
  return {
    missing: unmet(REQUIRED[scope], env),
    missingRecommended: unmet(RECOMMENDED[scope], env),
  };
}

/**
 * Log the env report. For `worker` in production, throw when a required
 * var is missing (fail fast). Everything else only warns.
 */
export function validateEnvOnBoot(
  scope: EnvScope,
  env: NodeJS.ProcessEnv = process.env,
): EnvReport {
  const report = checkEnv(scope, env);
  const tag = `[env:${scope}]`;
  if (report.missingRecommended.length > 0) {
    console.warn(`${tag} optional env not set: ${report.missingRecommended.join(", ")}`);
  }
  if (report.missing.length > 0) {
    const msg = `${tag} required env not set: ${report.missing.join(", ")}`;
    if (scope === "worker" && env.NODE_ENV === "production") {
      throw new Error(msg);
    }
    console.error(msg);
  }
  return report;
}
