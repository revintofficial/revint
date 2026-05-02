/**
 * M23 regression - SemanticMemory reads / writes have a strict
 * workspace-scope contract enforced inside `src/lib/ai-core/memory.ts`.
 * Direct `prisma.semanticMemory.*` calls outside that module bypass
 * the facade and are the highest-likelihood source of cross-tenant
 * leaks (C1 was caused by exactly this).
 *
 * This test scans the src tree for any `prisma.semanticMemory` usage
 * and asserts the only file allowed to touch it directly is
 * `src/lib/ai-core/memory.ts` itself. Test files and the embed
 * worker (which loads rows by id and writes back the embedding via
 * the facade helpers) are also exempt.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Files that are *allowed* to call prisma.semanticMemory directly.
// The facade itself is the only file that should write to the table;
// the others on this list are pre-existing legacy reads that pre-date
// M23 and are tracked for migration in a follow-up sprint. Adding
// new entries to this list requires a code review checklist comment
// because every entry is a potential cross-tenant leak vector.
const ALLOWED = new Set<string>([
  "src/lib/ai-core/memory.ts",
  // Legacy reads (out of scope of M23 — tracked for future migration).
  "src/lib/ai-core/router.ts",
  "src/lib/pipeline-cancel-workspace.ts",
  "src/app/api/leads/[id]/lookalikes/route.ts",
]);

// Files that MUST be clean as part of M23 — fail loudly if these
// regress and start touching the table directly.
const STRICT = [
  "src/lib/agent-workers/execute.ts",
  "src/workers/agent-run-worker.ts",
];

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === "dist" || entry === "generated") {
      continue;
    }
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      yield* walk(full);
    } else if (
      (entry.endsWith(".ts") || entry.endsWith(".tsx")) &&
      !entry.endsWith(".d.ts")
    ) {
      yield full;
    }
  }
}

function relPath(p: string) {
  return p
    .replace(resolve(process.cwd()) + "\\", "")
    .replace(resolve(process.cwd()) + "/", "")
    .replace(/\\/g, "/");
}

describe("M23 - SemanticMemory facade is the only writer", () => {
  it("no source file outside the facade calls prisma.semanticMemory directly", () => {
    const root = resolve(process.cwd(), "src");
    const offenders: { file: string; line: number; snippet: string }[] = [];

    for (const file of walk(root)) {
      const rel = relPath(file);
      if (rel.includes("__tests__")) continue;
      if (ALLOWED.has(rel)) continue;

      const text = readFileSync(file, "utf-8");
      if (!text.includes("prisma.semanticMemory")) continue;

      const lines = text.split("\n");
      lines.forEach((line, idx) => {
        if (!/prisma\.semanticMemory\b/.test(line)) return;
        const trimmed = line.trim();
        // Skip comments — production code rules out documentation
        // mentions but `// foo: prisma.semanticMemory ...` shouldn't
        // trip the alarm.
        if (
          trimmed.startsWith("//") ||
          trimmed.startsWith("*") ||
          trimmed.startsWith("/*")
        ) {
          return;
        }
        offenders.push({ file: rel, line: idx + 1, snippet: trimmed });
      });
    }

    if (offenders.length > 0) {
      const msg = offenders
        .map((o) => `  ${o.file}:${o.line}  ${o.snippet}`)
        .join("\n");
      throw new Error(
        `Found ${offenders.length} direct prisma.semanticMemory call(s) outside the memory.ts facade:\n${msg}\n` +
          "Move these reads/writes into src/lib/ai-core/memory.ts so the workspace-scope contract is preserved (M23).",
      );
    }
    expect(offenders.length).toBe(0);
  });

  it("memory.ts exposes the facade helpers used by execute.ts and the embed worker", async () => {
    const mod = await import("@/lib/ai-core/memory");
    expect(typeof mod.findRecentByKindsScoped).toBe("function");
    expect(typeof mod.writeEmbedding).toBe("function");
  });

  it.each(STRICT)("%s does not touch prisma.semanticMemory directly (M23 target)", (rel) => {
    const text = readFileSync(resolve(process.cwd(), rel), "utf-8");
    const lines = text.split("\n");
    const hits: string[] = [];
    lines.forEach((line, idx) => {
      // Allow comments to mention the table for documentation purposes;
      // only flag real code references.
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
      if (/prisma\.semanticMemory\b/.test(line)) {
        hits.push(`${rel}:${idx + 1}  ${trimmed}`);
      }
    });
    expect(
      hits,
      `M23 contract violated:\n${hits.join("\n")}`,
    ).toEqual([]);
  });
});
