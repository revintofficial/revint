/**
 * Multi-tenant test fixtures.
 *
 * `withTwoWorkspaces` is the canonical pattern for proving that a
 * change does NOT leak across tenants: spin up workspace A and
 * workspace B with their own owners + leads, hand them to a callback,
 * then tear down everything that was created.
 *
 * Use the integration runner (vitest.config.integration.ts) for these
 * tests; they hit a real Postgres (factories.ts).
 *
 * Example:
 *   it("rejects cross-tenant memory writes", async () => {
 *     await withTwoWorkspaces(async ({ a, b }) => {
 *       const memId = await upsert({ workspaceId: a.workspace.id, ... });
 *       // Worker tries to write embedding under workspace B's scope
 *       await expect(
 *         writeEmbedding(memId, vector, b.workspace.id),
 *       ).rejects.toThrow();
 *     });
 *   });
 */
import {
  cleanupWorkspace,
  cleanupUser,
  makeLead,
  makeWorkspaceWithOwner,
} from "./factories";
import type { Lead, Plan, User, Workspace } from "@/generated/prisma/client";

export interface TenantFixture {
  workspace: Workspace;
  user: User;
  /** A pre-seeded lead inside this workspace. Use `extra` for more. */
  lead: Lead;
}

export interface TwoWorkspacesArgs {
  a: TenantFixture;
  b: TenantFixture;
}

export interface WithTwoWorkspacesOpts {
  planA?: Plan;
  planB?: Plan;
}

/**
 * Creates two isolated workspaces (each with its own owner + one
 * seeded lead), invokes the callback, and cleans up regardless of
 * test outcome. Cleanup cascades through Prisma so memory rows,
 * agent runs, and any other workspace-scoped rows the test creates
 * are also gone.
 */
export async function withTwoWorkspaces<T>(
  fn: (args: TwoWorkspacesArgs) => Promise<T>,
  opts: WithTwoWorkspacesOpts = {},
): Promise<T> {
  const a = await makeWorkspaceWithOwner({ plan: opts.planA });
  const b = await makeWorkspaceWithOwner({ plan: opts.planB });
  const leadA = await makeLead(a.workspace.id, { businessName: "Tenant A Cafe" });
  const leadB = await makeLead(b.workspace.id, { businessName: "Tenant B Bar" });

  try {
    return await fn({
      a: { workspace: a.workspace, user: a.user, lead: leadA },
      b: { workspace: b.workspace, user: b.user, lead: leadB },
    });
  } finally {
    // Best-effort teardown. Workspace cascade nukes every workspace-
    // scoped row. Users live separately from workspaces and need
    // their own cleanup so subsequent tests don't accumulate.
    await cleanupWorkspace(a.workspace.id);
    await cleanupWorkspace(b.workspace.id);
    await cleanupUser(a.user.id);
    await cleanupUser(b.user.id);
  }
}

/**
 * Lighter-weight cousin: same idea but accepts pre-built workspaces
 * for tests that need >2 tenants or specific roles.
 */
export interface WithTenantsArgs {
  tenants: TenantFixture[];
}

export async function withTenants<T>(
  count: number,
  fn: (args: WithTenantsArgs) => Promise<T>,
): Promise<T> {
  const fixtures: TenantFixture[] = [];
  for (let i = 0; i < count; i++) {
    const ws = await makeWorkspaceWithOwner();
    const lead = await makeLead(ws.workspace.id, {
      businessName: `Tenant ${String.fromCharCode(65 + i)} Lead`,
    });
    fixtures.push({ workspace: ws.workspace, user: ws.user, lead });
  }

  try {
    return await fn({ tenants: fixtures });
  } finally {
    for (const f of fixtures) {
      await cleanupWorkspace(f.workspace.id);
      await cleanupUser(f.user.id);
    }
  }
}
