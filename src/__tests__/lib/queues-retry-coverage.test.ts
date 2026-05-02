/**
 * M5 regression - every `queue.add(...)` in the codebase must specify
 * a non-trivial retry policy so a transient Redis blip or Gemini rate
 * limit doesn't silently drop a job. We grep the source for queue.add
 * call sites and assert each one's options bag mentions `attempts:`.
 *
 * Files allowed to opt out:
 *   - test/__tests__ files (mocked queues)
 *   - sequence-engine/scheduler.ts (uses upsertJobScheduler, not add)
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface CallSite {
  file: string;
  snippet: string;
}

const TARGET_FILES = [
  "src/lib/ai-core/orchestrator.ts",
  "src/lib/ai-core/memory.ts",
  "src/lib/review-analysis/try-enqueue.ts",
  "src/app/api/discovery/route.ts",
  "src/app/api/leads/[id]/workers/[kind]/route.ts",
  "src/app/api/leads/bulk-action/route.ts",
  "src/lib/sequence-engine/tick.ts",
];

/**
 * Extract every `queue.add(...)` call from a source file, paired with
 * a 30-line context window around the call. Some sites build the
 * options bag in a local `opts` variable a few lines above the
 * `queue.add` call (see `src/lib/sequence-engine/tick.ts`); using a
 * window means we can still detect `attempts:` in those cases without
 * a full AST parse.
 */
function findQueueAddSites(file: string): CallSite[] {
  let text: string;
  try {
    text = readFileSync(resolve(process.cwd(), file), "utf-8");
  } catch {
    return [];
  }
  const lines = text.split("\n");
  const sites: CallSite[] = [];
  const re = /queue\.add\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const start = m.index;
    let depth = 0;
    let i = start + m[0].length - 1;
    for (; i < text.length; i++) {
      const ch = text[i];
      if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth === 0) break;
      }
    }

    const lineNumber = text.slice(0, start).split("\n").length - 1;
    const windowStart = Math.max(0, lineNumber - 30);
    const windowEnd = Math.min(lines.length, lineNumber + 30);
    const callContext = lines.slice(windowStart, windowEnd).join("\n");
    const callSnippet = text.slice(start, i + 1);
    sites.push({
      file,
      snippet: `${callSnippet}\n--- context ---\n${callContext}`,
    });
  }
  return sites;
}

describe("M5 - queue.add retry coverage", () => {
  for (const file of TARGET_FILES) {
    it(`${file} declares attempts on every queue.add call`, () => {
      const sites = findQueueAddSites(file);
      expect(sites.length, `expected at least 1 queue.add in ${file}`).toBeGreaterThan(0);
      for (const site of sites) {
        expect(
          site.snippet,
          `queue.add in ${site.file} is missing attempts:\n${site.snippet}`,
        ).toMatch(/attempts\s*:/);
        expect(
          site.snippet,
          `queue.add in ${site.file} is missing backoff:\n${site.snippet}`,
        ).toMatch(/backoff\s*:/);
      }
    });
  }

  it("review-analysis enqueue uses attempts >= 2", () => {
    const sites = findQueueAddSites("src/lib/review-analysis/try-enqueue.ts");
    expect(sites.length).toBeGreaterThan(0);
    for (const site of sites) {
      const m = site.snippet.match(/attempts\s*:\s*(\d+)/);
      expect(m, "attempts not found").not.toBeNull();
      expect(Number(m![1])).toBeGreaterThanOrEqual(2);
    }
  });
});
