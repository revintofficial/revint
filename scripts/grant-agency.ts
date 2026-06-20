/**
 * Grant AGENCY plan to a user's workspace(s).
 * Creates a workspace if the user has none yet.
 *
 * Run with:  npx tsx scripts/grant-agency.ts <email>
 */
import { prisma } from "@/lib/prisma";
import { Client } from "pg";
import "dotenv/config";

const AGENCY_PERIOD_END = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000);

async function resolveAuthUserId(email: string): Promise<string> {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("DIRECT_URL / DATABASE_URL not set");
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    const u = await c.query(`select id from auth.users where email = $1`, [email]);
    if (!u.rows[0]) throw new Error(`No auth user for ${email}. Sign up first.`);
    return u.rows[0].id as string;
  } finally {
    await c.end();
  }
}

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error("Usage: tsx scripts/grant-agency.ts <email>");

  const userId = await resolveAuthUserId(email);

  await prisma.user.upsert({
    where: { id: userId },
    create: { id: userId, email },
    update: {},
  });

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { workspace: true },
  });

  if (!memberships.length) {
    const baseSlug =
      (email.split("@")[0] || "workspace")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 32) || "workspace";

    const workspace = await prisma.workspace.create({
      data: {
        name: `${email.split("@")[0]}'s Workspace`,
        slug: `${baseSlug}-${Date.now().toString(36)}`,
        ownerId: userId,
        plan: "AGENCY",
        currentPeriodEnd: AGENCY_PERIOD_END,
        members: { create: { userId, role: "OWNER" } },
      },
    });
    console.log(`Created workspace "${workspace.name}" (${workspace.slug}) with AGENCY plan`);
    return;
  }

  for (const { workspace } of memberships) {
    await prisma.workspace.update({
      where: { id: workspace.id },
      data: { plan: "AGENCY", currentPeriodEnd: AGENCY_PERIOD_END },
    });
    console.log(`Upgraded "${workspace.name}" (${workspace.slug}) from ${workspace.plan} -> AGENCY`);
  }
}

main()
  .catch((e) => {
    console.error("Failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
