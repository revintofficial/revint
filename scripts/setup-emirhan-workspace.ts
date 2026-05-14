/**
 * One-shot setup: configure Emirhan Yeşildağ's workspace so the
 * sürücü-kursu pitch loop works end-to-end on his first login.
 *
 * What this script does (idempotent — safe to re-run):
 *  1. Resolves the auth.users row for emirhanyesildag@hotmail.com
 *     (the user MUST have signed up via Supabase first; this script
 *     does NOT create auth records).
 *  2. Picks the user's oldest workspace, or creates a new one
 *     ("Emirhan'ın Workspace'i") if no membership exists.
 *  3. Patches the workspace to TR + tr language + driving-school
 *     positioning (offer + value prop + tone + sender name).
 *  4. Upserts two ServicePackage rows that drive the showcase
 *     mockup's "courses" section — Başlangıç (7.000 TL) and Pro
 *     (15.000 TL, isPopular: true).
 *  5. Ensures the user has at least OWNER role on the workspace.
 *
 * Run with:
 *   npx tsx scripts/setup-emirhan-workspace.ts
 *
 * Override target email via env var when running for someone else:
 *   TARGET_EMAIL=other@example.com npx tsx scripts/setup-emirhan-workspace.ts
 */
import { prisma } from "@/lib/prisma";
import { Client } from "pg";
import "dotenv/config";

const TARGET_EMAIL =
  process.env.TARGET_EMAIL ?? "emirhanyesildag@hotmail.com";

const WORKSPACE_PATCH = {
  country: "TR",
  language: "tr",
  niche: "WEB_AGENCY" as const,
  offerName: "Sürücü Kursu Modern Web Sitesi",
  valueProposition:
    "Online randevu, eğitmen profilleri, sınav başarı oranı vitrini, WhatsApp entegrasyonu. Başlangıç 7.000 TL — Pro 15.000 TL.",
  tone: "professional",
  senderName: "Emirhan Yeşildağ",
  targetSubNiches: ["driving-school"],
};

const PACKAGES = [
  {
    name: "Başlangıç",
    priceLabel: "7.000 TL",
    features: [
      "Tek sayfa modern site",
      "Mobil uyumlu tasarım",
      "WhatsApp entegrasyonu",
      "Google Maps konum",
      "İletişim formu",
      "Domain + 1 yıl hosting",
    ],
    isPopular: false,
    sortOrder: 0,
  },
  {
    name: "Pro",
    priceLabel: "15.000 TL",
    features: [
      "Başlangıç paketinin tüm özellikleri",
      "Online randevu sistemi (mockup)",
      "Eğitmen profilleri",
      "Kurs paketleri ve fiyat sayfası",
      "SSS bölümü",
      "SEO optimizasyonu",
      "Google Analytics + Search Console kurulumu",
      "Sosyal medya entegrasyonu",
      "3 ay teknik destek",
    ],
    isPopular: true,
    sortOrder: 1,
  },
];

async function resolveAuthUserId(): Promise<string> {
  // auth.users lives in Supabase's `auth` schema — Prisma's generated
  // client only sees the public schema's `users` mirror, so we go
  // direct to Postgres for this single lookup. Same pattern as
  // seed-meertseker.ts.
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("DIRECT_URL / DATABASE_URL not set");
  const c = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  try {
    const res = await c.query<{ id: string }>(
      `select id from auth.users where email = $1`,
      [TARGET_EMAIL],
    );
    if (!res.rows[0]) {
      throw new Error(
        `No auth.users row for ${TARGET_EMAIL}. Sign up via Supabase first, then re-run this script.`,
      );
    }
    return res.rows[0].id;
  } finally {
    await c.end();
  }
}

async function main() {
  console.log(`[setup-emirhan-workspace] Target email: ${TARGET_EMAIL}`);

  const userId = await resolveAuthUserId();
  console.log(`  auth.users.id: ${userId}`);

  // Ensure the public.users mirror exists. requireUser() does this on
  // every login but the script may run before the user has ever
  // logged in.
  await prisma.user.upsert({
    where: { id: userId },
    create: { id: userId, email: TARGET_EMAIL },
    update: {},
  });

  // Resolve workspace: oldest existing membership, else create one.
  const existingMember = await prisma.workspaceMember.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { workspaceId: true, role: true },
  });

  let workspaceId: string;
  if (existingMember) {
    workspaceId = existingMember.workspaceId;
    console.log(`  Using existing workspace: ${workspaceId} (role=${existingMember.role})`);
  } else {
    const slug = `emirhan-${Date.now().toString(36)}`;
    const created = await prisma.workspace.create({
      data: {
        name: "Emirhan'ın Workspace'i",
        slug,
        ownerId: userId,
        plan: "FREE",
        ...WORKSPACE_PATCH,
        members: {
          create: {
            userId,
            role: "OWNER",
          },
        },
      },
      select: { id: true },
    });
    workspaceId = created.id;
    console.log(`  Created workspace: ${workspaceId} (slug=${slug})`);
  }

  // Patch workspace fields — runs whether we created it or not so a
  // re-run flips an older workspace into the Emirhan configuration.
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: WORKSPACE_PATCH,
  });
  console.log(`  Patched workspace fields (country=TR, language=tr, …)`);

  // Promote to OWNER if not already (idempotent role bump).
  if (existingMember && existingMember.role !== "OWNER") {
    await prisma.workspaceMember.update({
      where: {
        workspaceId_userId: { workspaceId, userId },
      },
      data: { role: "OWNER" },
    });
    console.log(`  Promoted member to OWNER`);
  }

  // Upsert the two ServicePackage rows. The unique constraint
  // (workspaceId, name) makes upsert cheap + safe across re-runs.
  for (const pkg of PACKAGES) {
    await prisma.servicePackage.upsert({
      where: {
        workspaceId_name: { workspaceId, name: pkg.name },
      },
      create: { workspaceId, ...pkg },
      update: {
        priceLabel: pkg.priceLabel,
        features: pkg.features,
        isPopular: pkg.isPopular,
        sortOrder: pkg.sortOrder,
      },
    });
    console.log(`  Upserted package: ${pkg.name} (${pkg.priceLabel})`);
  }

  console.log(
    `\nDone. Emirhan can now run Discovery with niche=driving-school + country=TR,\n` +
      `trigger pitch-pack on a lead, and the showcase mockup will pull both packages.`,
  );
}

main()
  .catch((err) => {
    console.error("Setup failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
