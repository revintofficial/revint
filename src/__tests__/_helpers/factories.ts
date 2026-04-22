/**
 * Prisma row factories for integration tests.
 *
 * Every integration test creates its OWN workspace + lead + user rows
 * to stay isolated from other tests running in the same database. Each
 * factory returns the created row and accepts partial overrides so a
 * caller can tweak fields without re-specifying required ones.
 *
 * Naming convention: every factory prefixes generated strings with
 * `t_` + crypto.randomUUID().slice(0,8). That makes it trivial to
 * clean up a leftover test run with
 *   DELETE FROM workspaces WHERE slug LIKE 't\_%';
 * if a process is killed mid-test.
 */
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Plan, Workspace, Lead, User } from "@/generated/prisma/client";

function tag(): string {
  return `t_${randomUUID().slice(0, 8)}`;
}

export async function makeUser(
  overrides: Partial<Pick<User, "email" | "fullName">> = {},
): Promise<User> {
  const suffix = tag();
  return prisma.user.create({
    data: {
      email: overrides.email ?? `${suffix}@test.local`,
      fullName: overrides.fullName ?? `Test User ${suffix}`,
    },
  });
}

export async function makeWorkspace(
  overrides: {
    ownerId?: string;
    name?: string;
    plan?: Plan;
  } = {},
): Promise<Workspace> {
  const ownerId = overrides.ownerId ?? (await makeUser()).id;
  const suffix = tag();
  return prisma.workspace.create({
    data: {
      name: overrides.name ?? `Test Workspace ${suffix}`,
      slug: suffix,
      ownerId,
      plan: overrides.plan ?? "PRO",
    },
  });
}

/**
 * Creates workspace + user + owner WorkspaceMember in one call. Use
 * this when a test needs a session-shaped triple.
 */
export async function makeWorkspaceWithOwner(overrides: {
  plan?: Plan;
} = {}): Promise<{ workspace: Workspace; user: User }> {
  const user = await makeUser();
  const workspace = await makeWorkspace({
    ownerId: user.id,
    plan: overrides.plan,
  });
  await prisma.workspaceMember.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      role: "OWNER",
    },
  });
  return { workspace, user };
}

export async function makeLead(
  workspaceId: string,
  overrides: Partial<Pick<
    Lead,
    | "businessName"
    | "formattedAddress"
    | "hasWebsite"
    | "websiteUrl"
    | "borough"
    | "rating"
    | "reviewCount"
    | "primaryType"
    | "googleMapsUri"
  >> = {},
): Promise<Lead> {
  const suffix = tag();
  return prisma.lead.create({
    data: {
      workspaceId,
      placeId: `place_${suffix}`,
      businessName: overrides.businessName ?? `Test Business ${suffix}`,
      formattedAddress:
        overrides.formattedAddress ?? "123 Test St, Test City, TS 00000",
      borough: overrides.borough ?? null,
      hasWebsite: overrides.hasWebsite ?? false,
      websiteUrl: overrides.websiteUrl ?? null,
      rating: overrides.rating ?? null,
      reviewCount: overrides.reviewCount ?? null,
      primaryType: overrides.primaryType ?? null,
      googleMapsUri: overrides.googleMapsUri ?? null,
    },
  });
}

/**
 * Deletes a workspace and everything that cascades from it (leads,
 * memory, sessions, agent runs, members). Use in `afterAll` hooks so a
 * failed test does not leak state.
 */
export async function cleanupWorkspace(workspaceId: string): Promise<void> {
  await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => {
    // Already deleted or never existed; ignore.
  });
}

/**
 * Deletes a user (cascades to memberships). Separate from workspace
 * cleanup because users can exist without workspaces in test fixtures.
 */
export async function cleanupUser(userId: string): Promise<void> {
  await prisma.user.delete({ where: { id: userId } }).catch(() => {
    /* ignore */
  });
}
