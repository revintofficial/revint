/**
 * L1-L6 regression - several API routes used the
 * `findUnique({where:{id}})` + post-check pattern instead of
 * `findFirst({where:{id, workspaceId}})`. The post-check pattern
 * is an IDOR shape: the read leaves the DB before the workspace
 * check rejects, so timing leaks the existence of cross-tenant
 * rows AND any future PR that drops the post-check would silently
 * expose every workspace's rows.
 *
 * This grep-style assertion locks the cleanup in place: each of
 * the L1-L6 target routes must use the workspace-scoped findFirst
 * shape and must NOT reintroduce the bare findUnique({id}) shape.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const TARGETS: { file: string; bug: string }[] = [
  { file: "src/app/api/todos/[id]/route.ts", bug: "L1" },
  { file: "src/app/api/team/[id]/route.ts", bug: "L2" },
  { file: "src/app/api/workspace/packages/[id]/route.ts", bug: "L3" },
  { file: "src/app/api/planner/[id]/route.ts", bug: "L4" },
  { file: "src/app/api/leads/[id]/mark-outcome/route.ts", bug: "L5" },
  { file: "src/app/api/leads/[id]/lookalikes/route.ts", bug: "L6" },
];

const FIND_FIRST_SCOPED_RE =
  /findFirst\(\s*\{\s*where:\s*\{\s*id\s*,\s*workspaceId/;
const FIND_UNIQUE_BARE_RE = /findUnique\(\s*\{\s*where:\s*\{\s*id\s*\}/;

describe("L1-L6 - workspace-scoped findFirst pattern is in place", () => {
  for (const { file, bug } of TARGETS) {
    const src = readFileSync(resolve(process.cwd(), file), "utf-8");

    it(`${bug} - ${file} uses findFirst({id, workspaceId}) for the row lookup`, () => {
      expect(
        src,
        `${file}: missing workspace-scoped findFirst`,
      ).toMatch(FIND_FIRST_SCOPED_RE);
    });

    it(`${bug} - ${file} does NOT contain a bare findUnique({where:{id}}) call`, () => {
      // The bare-id findUnique is the IDOR shape we're cleaning
      // up. If a future PR re-introduces it, this guard rail
      // catches it before merge.
      expect(
        src,
        `${file}: re-introduced findUnique({id}) without workspace scope`,
      ).not.toMatch(FIND_UNIQUE_BARE_RE);
    });
  }
});
