/**
 * Smoke test assumes `npm run workers:dev` is running in another terminal.
 * Without it, the script will time out after 60s. Exit code 1 in that case
 * is expected-ish; exit code 0 means the full chain ran successfully.
 *
 * What this exercises end-to-end (with real DB + Gemini):
 *   1. Create a throwaway User + Workspace + Lead via the factories.
 *   2. emit("user_one_click_pitch", ...) on the real event bus.
 *   3. Poll the PlannerSession row until it hits COMPLETED (or 60s timeout).
 *   4. Assert a LEAD_PROFILE SemanticMemory row was written for the lead.
 *   5. Clean up every row in a finally block, no matter what.
 *
 * Flags:
 *   --with-apify   Additionally fire `user_deep_research` and poll that
 *                  second session. Only honored when APIFY_TOKEN is set;
 *                  otherwise silently skipped so CI/dev without a token
 *                  still succeeds on the pitch-pack chain.
 *
 * Usage:
 *   npx tsx scripts/smoke-ai-core.ts
 *   npx tsx scripts/smoke-ai-core.ts --with-apify
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as dotenv from "dotenv";

function loadEnv(): void {
  const cwd = process.cwd();
  const envTest = path.join(cwd, ".env.test");
  const envDefault = path.join(cwd, ".env");
  if (fs.existsSync(envTest)) {
    dotenv.config({ path: envTest });
    log("env", `loaded ${envTest}`);
  } else if (fs.existsSync(envDefault)) {
    dotenv.config({ path: envDefault });
    log("env", `loaded ${envDefault} (no .env.test found)`);
  } else {
    log("env", "no .env file found; relying on process env only");
  }
}

function log(step: string, detail?: string): void {
  const line = detail ? `[smoke] step: ${step} - ${detail}` : `[smoke] step: ${step}`;
  // eslint-disable-next-line no-console
  console.log(line);
}

function assertNotProdDatabase(): void {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  const lower = url.toLowerCase();
  if (lower.includes("prod") || lower.includes("production")) {
    throw new Error(
      `DATABASE_URL looks like a production database; refusing to run smoke test. Got: ${url.replace(/\/\/[^@]+@/, "//***@")}`,
    );
  }
}

function assertGeminiKey(): void {
  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
    throw new Error("GEMINI_API_KEY (or GOOGLE_API_KEY) must be set");
  }
}

loadEnv();
assertNotProdDatabase();
assertGeminiKey();

// Deliberately imported AFTER loadEnv() so the Prisma client picks up the
// DATABASE_URL from .env.test when present. Relative paths are used so
// this file can be type-checked standalone with:
//   npx tsc --noEmit scripts/smoke-ai-core.ts
// The project's `@/*` alias lives in tsconfig.json, which excludes
// scripts/** by default; sticking to relative paths removes that coupling.
import { prisma } from "../src/lib/prisma";
import { emit } from "../src/lib/ai-core/events";
import {
  makeWorkspaceWithOwner,
  makeLead,
  cleanupWorkspace,
  cleanupUser,
} from "../src/__tests__/_helpers/factories";

const POLL_INTERVAL_MS = 2000;
const TIMEOUT_MS = 60_000;

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function waitForSession(
  sessionId: string,
  label: string,
): Promise<{ id: string; status: string } | null> {
  const start = Date.now();
  while (Date.now() - start < TIMEOUT_MS) {
    const session = await prisma.plannerSession.findFirst({
      where: { id: sessionId },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true },
    });
    if (session && session.status === "COMPLETED") return session;
    if (session && session.status === "FAILED") {
      log("planner_session_failed", `${label} -> FAILED (${session.id})`);
      return session;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  return null;
}

async function assertLeadProfileMemory(
  workspaceId: string,
  leadId: string,
): Promise<void> {
  const mem = await prisma.semanticMemory.findFirst({
    where: {
      workspaceId,
      kind: "LEAD_PROFILE",
      refType: "lead",
      refId: leadId,
    },
    select: { id: true },
  });
  if (!mem) {
    throw new Error(`No LEAD_PROFILE SemanticMemory row found for lead ${leadId}`);
  }
  log("memory_check", `LEAD_PROFILE row ${mem.id} present for ${leadId}`);
}

async function main(): Promise<number> {
  const args = new Set(process.argv.slice(2));
  const withApify = args.has("--with-apify") && !!process.env.APIFY_TOKEN;

  log("bootstrap", `withApify=${withApify}`);

  let workspaceId: string | null = null;
  let userId: string | null = null;

  try {
    log("factory_workspace");
    const { workspace, user } = await makeWorkspaceWithOwner({ plan: "PRO" });
    workspaceId = workspace.id;
    userId = user.id;
    log("factory_workspace_done", `workspaceId=${workspaceId} userId=${userId}`);

    log("factory_lead");
    const lead = await makeLead(workspaceId, {
      businessName: "Smoke Test Repair Co",
      formattedAddress: "1 Smoke Ln, Testville, ST 00000",
      hasWebsite: true,
      websiteUrl: "https://example.com",
      rating: 4.2,
      reviewCount: 50,
    });
    log("factory_lead_done", `leadId=${lead.id}`);

    log("emit_one_click_pitch");
    const sessionId = await emit("user_one_click_pitch", {
      workspaceId,
      leadId: lead.id,
      userId,
    });
    log("emit_one_click_pitch_done", `sessionId=${sessionId}`);

    log("poll_pitch_session");
    const pitchSession = await waitForSession(sessionId, "user_one_click_pitch");
    if (!pitchSession) {
      throw new Error(
        "Timed out after 60s waiting for user_one_click_pitch PlannerSession to COMPLETE. Is `npm run workers:dev` running?",
      );
    }
    if (pitchSession.status !== "COMPLETED") {
      throw new Error(
        `user_one_click_pitch PlannerSession finished with status=${pitchSession.status}`,
      );
    }
    log("poll_pitch_session_done", `status=${pitchSession.status}`);

    await assertLeadProfileMemory(workspaceId, lead.id);

    if (withApify) {
      log("emit_deep_research");
      const deepSessionId = await emit("user_deep_research", {
        workspaceId,
        leadId: lead.id,
        userId,
      });
      log("emit_deep_research_done", `sessionId=${deepSessionId}`);

      log("poll_deep_session");
      const deepSession = await waitForSession(deepSessionId, "user_deep_research");
      if (!deepSession || deepSession.status !== "COMPLETED") {
        throw new Error(
          `user_deep_research did not COMPLETE (status=${deepSession?.status ?? "timeout"})`,
        );
      }
      log("poll_deep_session_done", `status=${deepSession.status}`);
    } else {
      log("skip_deep_research", "APIFY_TOKEN unset or --with-apify not passed");
    }

    log("done_success");
    return 0;
  } catch (err) {
    log("error", err instanceof Error ? err.message : String(err));
    if (err instanceof Error && err.stack) {
      // eslint-disable-next-line no-console
      console.error(err.stack);
    }
    return 1;
  } finally {
    if (workspaceId) {
      log("cleanup_workspace", workspaceId);
      await cleanupWorkspace(workspaceId).catch((e: unknown) => {
        log(
          "cleanup_workspace_err",
          e instanceof Error ? e.message : String(e),
        );
      });
    }
    if (userId) {
      log("cleanup_user", userId);
      await cleanupUser(userId).catch((e: unknown) => {
        log("cleanup_user_err", e instanceof Error ? e.message : String(e));
      });
    }
    await prisma.$disconnect().catch(() => {
      // ignore disconnect failures on the way out
    });
  }
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch((err) => {
    // Defensive: main() already catches, but never trust a promise chain.
    // eslint-disable-next-line no-console
    console.error("[smoke] unhandled error:", err);
    process.exit(1);
  });
