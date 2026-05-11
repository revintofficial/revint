/**
 * Backfill embeddings for rows in `semantic_memory` whose vector is
 * NULL. After Phase 1 of the SDR-Brain pipeline recovery (embed.ts
 * migrated from `text-embedding-004` to `gemini-embedding-001`), every
 * row that was written during the outage now has `embedding = NULL`,
 * which makes cosine queries return zero hits and starves downstream
 * workers (BUYING_COMMITTEE_MAPPER, WHY_NOW_SYNTHESIZER, OPENER_WRITER)
 * of context.
 *
 * Iterates in batches of 50 — Gemini's batchEmbedContents endpoint is
 * shaped exactly for this size and the per-key 1500 req/day quota
 * makes ~4 calls for the ~180-row backlog negligible.
 *
 * Usage:
 *   npx tsx scripts/backfill-memory-embeddings.ts                  # all workspaces
 *   npx tsx scripts/backfill-memory-embeddings.ts --workspace=cmp1 # one workspace
 *   npx tsx scripts/backfill-memory-embeddings.ts --dry-run        # count + plan only
 *   npx tsx scripts/backfill-memory-embeddings.ts --limit=20       # cap rows
 *
 * Idempotent: re-running after a successful pass is a no-op (no rows
 * left with NULL embedding). Safe to run in production.
 *
 * Multi-tenant safety: every write goes through `memory.writeEmbedding`
 * which checks `workspace_id` matches before the UPDATE, so a corrupt
 * payload cannot poison a victim workspace's row.
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { embedBatch } from "@/lib/ai-core/embed";
import { writeEmbedding } from "@/lib/ai-core/memory";

interface Args {
  dryRun: boolean;
  workspace: string | null; // null = "all"
  limit: number | null; // null = unlimited
  batchSize: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dryRun: false,
    workspace: null,
    limit: null,
    batchSize: 50,
  };
  for (const raw of argv) {
    if (raw === "--dry-run") args.dryRun = true;
    else if (raw.startsWith("--workspace=")) {
      const v = raw.slice("--workspace=".length);
      args.workspace = v === "all" ? null : v;
    } else if (raw.startsWith("--limit=")) {
      const n = Number(raw.slice("--limit=".length));
      if (!Number.isFinite(n) || n <= 0) {
        throw new Error(`Invalid --limit: ${raw}`);
      }
      args.limit = Math.floor(n);
    } else if (raw.startsWith("--batch-size=")) {
      const n = Number(raw.slice("--batch-size=".length));
      if (!Number.isFinite(n) || n <= 0 || n > 100) {
        throw new Error(`Invalid --batch-size (must be 1..100): ${raw}`);
      }
      args.batchSize = Math.floor(n);
    } else if (raw === "--help" || raw === "-h") {
      console.log(
        [
          "backfill-memory-embeddings.ts",
          "",
          "Flags:",
          "  --workspace=<id|all>  Restrict to a workspace (default: all)",
          "  --limit=<N>           Stop after N rows total",
          "  --batch-size=<N>      Rows per Gemini call (1..100, default 50)",
          "  --dry-run             Show counts, do not call Gemini or write",
        ].join("\n"),
      );
      process.exit(0);
    }
  }
  return args;
}

interface NullRow {
  id: string;
  text: string;
  workspaceId: string;
}

/**
 * Prisma can't query against `Unsupported("vector(768)")` so we use
 * raw SQL. Selecting `embedding IS NULL` is a sequential scan but
 * cheap at our scale (single-digit thousands of rows max during a
 * recovery window).
 */
async function fetchNullBatch(
  workspaceFilter: string | null,
  take: number,
): Promise<NullRow[]> {
  if (workspaceFilter) {
    return prisma.$queryRaw<NullRow[]>`
      SELECT id, text, workspace_id AS "workspaceId"
      FROM semantic_memory
      WHERE embedding IS NULL AND workspace_id = ${workspaceFilter}
      ORDER BY created_at ASC
      LIMIT ${take}
    `;
  }
  return prisma.$queryRaw<NullRow[]>`
    SELECT id, text, workspace_id AS "workspaceId"
    FROM semantic_memory
    WHERE embedding IS NULL
    ORDER BY created_at ASC
    LIMIT ${take}
  `;
}

async function countNull(workspaceFilter: string | null): Promise<number> {
  const rows = workspaceFilter
    ? await prisma.$queryRaw<Array<{ n: bigint }>>`
        SELECT COUNT(*)::bigint AS n FROM semantic_memory
        WHERE embedding IS NULL AND workspace_id = ${workspaceFilter}
      `
    : await prisma.$queryRaw<Array<{ n: bigint }>>`
        SELECT COUNT(*)::bigint AS n FROM semantic_memory
        WHERE embedding IS NULL
      `;
  return Number(rows[0]?.n ?? 0n);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log("[backfill] args:", args);

  const totalBefore = await countNull(args.workspace);
  console.log(`[backfill] rows with NULL embedding: ${totalBefore}`);

  if (totalBefore === 0) {
    console.log("[backfill] nothing to do, exiting clean.");
    return;
  }
  if (args.dryRun) {
    console.log("[backfill] --dry-run: would re-embed", Math.min(totalBefore, args.limit ?? totalBefore), "rows");
    return;
  }

  let processed = 0;
  let failed = 0;
  const startedAt = Date.now();

  while (true) {
    const remainingByLimit = args.limit !== null
      ? Math.max(0, args.limit - processed)
      : Number.POSITIVE_INFINITY;
    if (remainingByLimit <= 0) {
      console.log("[backfill] --limit reached, stopping.");
      break;
    }

    const take = Math.min(args.batchSize, remainingByLimit);
    const rows = await fetchNullBatch(args.workspace, take);
    if (rows.length === 0) {
      console.log("[backfill] no more rows with NULL embedding.");
      break;
    }

    // `embedBatch` rejects an empty string. Skip empty-text rows by
    // marking them with a single space so the downstream writer can
    // still place a vector and unblock similarity scans, OR drop them
    // and report — we choose the latter so corrupt rows surface
    // instead of getting noisy filler vectors.
    const usable = rows.filter((r) => r.text && r.text.trim().length > 0);
    const skipped = rows.length - usable.length;
    if (skipped > 0) {
      console.warn(`[backfill] skipped ${skipped} row(s) with empty text in this batch`);
    }
    if (usable.length === 0) {
      // All-skipped batch would loop forever. Bail out and let the
      // operator investigate the empty rows.
      console.error(`[backfill] batch had ${rows.length} empty-text rows — aborting to avoid infinite loop. Investigate semantic_memory.id values:`);
      for (const r of rows) console.error("  ", r.id);
      break;
    }

    let vectors: number[][];
    try {
      vectors = await embedBatch(usable.map((r) => r.text));
    } catch (err) {
      // A batch failure here is recoverable per-row in a subsequent
      // run; we surface and keep going on the next batch to maximise
      // recovery in a single invocation.
      failed += usable.length;
      console.error(
        `[backfill] batch embed failed for ${usable.length} row(s):`,
        err instanceof Error ? err.message : String(err),
      );
      continue;
    }

    for (const [i, row] of usable.entries()) {
      try {
        await writeEmbedding(row.id, vectors[i]!, row.workspaceId);
        processed++;
      } catch (err) {
        failed++;
        console.error(
          `[backfill] writeEmbedding failed for ${row.id}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    const elapsedMs = Date.now() - startedAt;
    console.log(
      `[backfill] progress: processed=${processed} failed=${failed} elapsedMs=${elapsedMs}`,
    );
  }

  const totalAfter = await countNull(args.workspace);
  console.log(
    `[backfill] done. processed=${processed} failed=${failed} remainingNull=${totalAfter}`,
  );
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error("[backfill] fatal:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
