/**
 * Assign a control-room platform role (and optional review lens) to a user.
 *
 * Idempotent: upserts `PlatformRoleAssignment` (unique on userId). Running it
 * again with the same arguments changes nothing; with different arguments it
 * updates role/lens in place. Optionally also adds the user to a workspace
 * (by slug) as MEMBER so they can open that workspace's leads.
 *
 * The user must have signed up (exist in auth.users). The matching
 * public.users row is created if missing.
 *
 * Usage:
 *   npx tsx scripts/control-assign-reviewer.ts \
 *     --email reviewer@finedine.com \
 *     --role REVIEWER \
 *     --lens DOMAIN \
 *     [--workspace finedine-beta]
 *
 *   --role   VIEWER | REVIEWER | ADMIN          (default REVIEWER)
 *   --lens   TECHNICAL | DOMAIN | SALES | none  (default: keep existing)
 *
 * Requires DIRECT_URL or DATABASE_URL.
 */
import "dotenv/config";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";
import type { PlatformRole, ReviewLens } from "@/generated/prisma/client";

const ROLES: readonly PlatformRole[] = ["VIEWER", "REVIEWER", "ADMIN"];
const LENSES: readonly ReviewLens[] = ["TECHNICAL", "DOMAIN", "SALES"];

interface Args {
  email: string;
  role: PlatformRole;
  /** undefined = leave as is, null = clear */
  lens: ReviewLens | null | undefined;
  workspace?: string;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const email = get("--email")?.trim().toLowerCase();
  if (!email) {
    throw new Error(
      "Usage: tsx scripts/control-assign-reviewer.ts --email <email> [--role REVIEWER] [--lens DOMAIN|none] [--workspace <slug>]",
    );
  }
  const role = (get("--role") ?? "REVIEWER").toUpperCase() as PlatformRole;
  if (!ROLES.includes(role)) throw new Error(`--role must be one of ${ROLES.join(", ")}`);

  const rawLens = get("--lens");
  let lens: ReviewLens | null | undefined;
  if (rawLens === undefined) lens = undefined;
  else if (rawLens.toLowerCase() === "none") lens = null;
  else {
    lens = rawLens.toUpperCase() as ReviewLens;
    if (!LENSES.includes(lens)) throw new Error(`--lens must be one of ${LENSES.join(", ")}, none`);
  }

  return { email, role, lens, workspace: get("--workspace") };
}

async function resolveAuthUserId(email: string): Promise<string> {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("DIRECT_URL / DATABASE_URL not set");
  const c = new Client({
    connectionString: url,
    ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false },
  });
  await c.connect();
  try {
    const r = await c.query(`select id from auth.users where lower(email) = $1`, [email]);
    if (!r.rows[0]) throw new Error(`No auth user for ${email}. They must sign up first.`);
    return r.rows[0].id as string;
  } finally {
    await c.end();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const existingUser = await prisma.user.findUnique({ where: { email: args.email } });
  const userId = existingUser?.id ?? (await resolveAuthUserId(args.email));
  if (!existingUser) {
    await prisma.user.upsert({
      where: { id: userId },
      create: { id: userId, email: args.email },
      update: {},
    });
  }

  const before = await prisma.platformRoleAssignment.findUnique({
    where: { userId },
    select: { role: true, lens: true },
  });

  const saved = await prisma.platformRoleAssignment.upsert({
    where: { userId },
    create: { userId, role: args.role, lens: args.lens ?? null },
    update: { role: args.role, ...(args.lens !== undefined ? { lens: args.lens } : {}) },
    select: { id: true, role: true, lens: true },
  });

  let membership: string | null = null;
  if (args.workspace) {
    const ws = await prisma.workspace.findUnique({
      where: { slug: args.workspace },
      select: { id: true, name: true },
    });
    if (!ws) throw new Error(`Workspace with slug "${args.workspace}" not found`);
    const m = await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: ws.id, userId } },
      create: { workspaceId: ws.id, userId, role: "MEMBER" },
      update: {},
      select: { role: true },
    });
    membership = `${ws.name} (${ws.id}) as ${m.role}`;
  }

  const changed = !before || before.role !== saved.role || before.lens !== saved.lens;
  console.log(
    JSON.stringify(
      {
        email: args.email,
        userId,
        assignmentId: saved.id,
        before: before ?? null,
        after: { role: saved.role, lens: saved.lens },
        changed,
        membership,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
