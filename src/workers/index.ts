// Flag must be set BEFORE the workers import ../lib/prisma so the pool
// sizing helper in src/lib/prisma.ts sees it.
process.env.IS_WORKER = "1";

// Boot banner. console.* lines bypass any JSON-log filters and prove the
// container actually started this commit. If you do NOT see this banner in
// Railway/Fly logs, the host is running a stale image - redeploy.
{
  const url = process.env.REDIS_URL;
  let host = "<UNSET>";
  if (url) {
    try {
      const u = new URL(url);
      host = `${u.hostname}:${u.port || "<no-port>"}`;
    } catch {
      host = "<UNPARSEABLE>";
    }
  }
  // eslint-disable-next-line no-console
  console.log(
    `[boot] worker supervisor v2 | REDIS_URL=${
      url ? "set" : "MISSING"
    } | redisHost=${host} | DATABASE_URL=${
      process.env.DATABASE_URL ? "set" : "MISSING"
    } | NODE_ENV=${process.env.NODE_ENV ?? "<unset>"}`,
  );

  if (!url && process.env.NODE_ENV === "production") {
    // eslint-disable-next-line no-console
    console.error(
      "[boot] FATAL: REDIS_URL is not set in production. Refusing to start. " +
        "Set REDIS_URL in your Railway/Fly service environment variables.",
    );
    process.exit(1);
  }

  if (url && (host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("::1"))) {
    if (process.env.NODE_ENV === "production") {
      // eslint-disable-next-line no-console
      console.error(
        `[boot] FATAL: REDIS_URL points at ${host} in production. ` +
          "This is your local-dev value. Update the Railway/Fly env var to your hosted Redis.",
      );
      process.exit(1);
    }
  }
}

import { startDiscoveryWorker } from "./discovery-worker";
import { embed, EmbeddingError } from "../lib/ai-core/embed";
import { allGeminiKeysCool, getGeminiKeyDiagnostics } from "../lib/gemini-keys";
// Phase 0/B4 — `crawl-worker` and `analyze-worker` are intentionally
// no longer booted here. Both raced with AI Core (`WEBSITE_AUDITOR`
// + `SALES_OPPORTUNITY_SCORER`) on the same `WebsiteAudit` /
// `SalesOpportunity` rows, which produced "two scores in
// disagreement" and "audit overwritten by older crawl" complaints
// from the FineDine SDR pilot. The legacy `/api/crawl` and
// `/api/analyze` HTTP routes now forward to `emit("lead_created")`
// so callers automatically pick up the AI Core path.
//
// The worker source files remain on disk (see `crawl-worker.ts`,
// `analyze-worker.ts`) until the Sunset window closes; until then
// they can be re-enabled by uncommenting the imports below in case
// of an emergency rollback.
// import { startCrawlWorker } from "./crawl-worker";
// import { startAnalyzeWorker } from "./analyze-worker";
import { startReviewAnalysisWorker } from "./review-analysis-worker";
import { startEmailVerificationWorker } from "./email-verification-worker";
import { startAgentRunWorker } from "./agent-run-worker";
import { startSeoOpsWorker } from "./seo-ops-worker";
import { logger } from "../lib/logger";

function maskRedisUrl(raw: string | undefined): string {
  if (!raw) return "<UNSET>";
  try {
    const u = new URL(raw);
    const host = u.hostname || "<no-host>";
    const port = u.port || "<no-port>";
    const proto = u.protocol.replace(":", "");
    const hasPassword = u.password ? "yes" : "no";
    return `${proto}://***:${hasPassword}@${host}:${port}`;
  } catch {
    return "<UNPARSEABLE>";
  }
}

logger.info("worker.supervisor.starting", {
  redisUrlPresent: Boolean(process.env.REDIS_URL),
  redisUrlMasked: maskRedisUrl(process.env.REDIS_URL),
  databaseUrlPresent: Boolean(process.env.DATABASE_URL),
  nodeEnv: process.env.NODE_ENV ?? "<unset>",
});

// Gemini health check. We deliberately fire-and-forget — workers should
// still boot when the embedding endpoint is wobbly (BullMQ jobs that
// don't touch Gemini still need to run, and the per-worker degraded
// path now keeps embed-dependent jobs SUCCEEDED_NO_MEMORY instead of
// hard-failing). We just want a loud signal in the boot logs so on-call
// can correlate "Gemini outage" with downstream worker degradation.
//
// Skipped under tests / when explicitly disabled to keep CI fast.
if (
  process.env.NODE_ENV !== "test" &&
  process.env.SKIP_GEMINI_HEALTHCHECK !== "1"
) {
  void (async () => {
    try {
      await embed("ping");
      logger.info("worker.supervisor.gemini_health_ok", {
        keys: getGeminiKeyDiagnostics(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const cool = allGeminiKeysCool();
      const isAuth = err instanceof EmbeddingError && /403|forbidden|permission|api[_ ]?key|unauthorized/i.test(msg);
      logger.error("worker.supervisor.gemini_health_failed", {
        err: msg,
        cool,
        isAuth,
        keys: getGeminiKeyDiagnostics(),
      });
      if (isAuth && process.env.NODE_ENV === "production") {
        // eslint-disable-next-line no-console
        console.error(
          `[boot] FATAL: Gemini auth failed at boot (${msg}). ` +
            "Refusing to start workers — every embed-dependent job would FAIL. " +
            "Configure GEMINI_API_KEY_1..N with a working key and redeploy.",
        );
        process.exit(1);
      }
    }
  })();
}

const discoveryWorker = startDiscoveryWorker();
const reviewAnalysisWorker = startReviewAnalysisWorker();
const emailVerificationWorker = startEmailVerificationWorker();
const agentRunWorker = startAgentRunWorker();
const seoOpsWorker = startSeoOpsWorker();

// Phase 2 — install a 60-second repeatable `sequence_tick` job onto
// the shared agent-runs queue. This is our cron equivalent: the
// agent-run worker picks it up and runs `processSequenceTick()`
// which scans LeadSequenceState rows for due steps. Failure here
// (e.g. Redis unavailable at boot) is logged but non-fatal — sequences
// just stop progressing until the next worker restart.
import("./../lib/sequence-engine/scheduler")
  .then(({ installSequenceTickCron }) => installSequenceTickCron())
  .catch((err) => {
    logger.error("worker.supervisor.sequence_cron_install_failed", {
      err: err instanceof Error ? err.message : String(err),
    });
  });

logger.info("worker.supervisor.started");

async function shutdown() {
  logger.info("worker.supervisor.shutdown");
  await Promise.all([
    discoveryWorker.close(),
    reviewAnalysisWorker.close(),
    emailVerificationWorker.close(),
    agentRunWorker.close(),
    seoOpsWorker.close(),
  ]);
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
