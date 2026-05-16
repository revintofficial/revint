/**
 * One-shot setup: configure Berkay Sırakaya's workspace so the
 * kuyumcu pitch loop works end-to-end on his first login.
 *
 * Mirrors `setup-emirhan-workspace.ts` (driving-school) — same
 * idempotent flow, only the workspace + ServicePackage constants
 * are kuyumcu-flavoured.
 *
 * What this script does (idempotent — safe to re-run):
 *  1. Resolves the auth.users row for berkaysirakayaaa@gmail.com,
 *     OR provisions a fresh Supabase auth user (email-confirmed, with
 *     a generated password) when the row doesn't exist. Password is
 *     printed to stdout once. Re-running with a fresh user rotates
 *     the password.
 *  2. Picks the user's oldest workspace, or creates a new one
 *     ("Berkay'ın Workspace'i") if no membership exists.
 *  3. Patches the workspace to TR + tr language + kuyumcu positioning
 *     (offer + value prop + tone + sender name + targetSubNiches).
 *     targetSubNiches lists BOTH child packs (traditional + luxury);
 *     parent slug rollup is implicit through `parentSlug` in the
 *     niche pack data.
 *  4. Upserts two ServicePackage rows that drive the showcase
 *     mockup's "courses" section — Başlangıç (9.000 TL) and Pro
 *     (18.000 TL, isPopular: true). Pricing is scaled up from
 *     Emirhan's 7.000 / 15.000 to reflect kuyumcu's higher buyer
 *     capital + richer Pro deliverables (catalog + alyans appointment
 *     + sertifika + atölye profiles).
 *  5. Ensures the user has OWNER role on the workspace.
 *
 * Prerequisites:
 *   - DIRECT_URL / DATABASE_URL in .env (always)
 *   - NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env
 *     when the auth user has to be created (skipped otherwise).
 *
 * Run with:
 *   npx tsx scripts/setup-berkay-workspace.ts
 *
 * Override target email via env var:
 *   TARGET_EMAIL=other@example.com npx tsx scripts/setup-berkay-workspace.ts
 */
import { prisma } from "@/lib/prisma";
import { Client } from "pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import "dotenv/config";

const TARGET_EMAIL =
  process.env.TARGET_EMAIL ?? "berkaysirakayaaa@gmail.com";

const WORKSPACE_PATCH = {
  name: "Berkay'ın Workspace'i",
  country: "TR",
  language: "tr",
  niche: "WEB_AGENCY" as const,
  offerName: "Kuyumcu Modern Web Sitesi",
  valueProposition:
    "Canlı gram altın paneli, ürün galerisi, WhatsApp ile fiyat sorgu ve atölye vitrini. Başlangıç 9.000 TL — Pro 18.000 TL.",
  tone: "professional",
  senderName: "Berkay Sırakaya",
  // Both child slugs — discovery picker defaults to "all kuyumcu"
  // (the parent rollup) and the rep narrows to traditional vs.
  // luxury per lead. `findNichePackForPrimaryType("jewelry_store")`
  // resolves to `kuyumcu-traditional` by default at mockup render
  // time so luxury becomes an explicit manual override.
  targetSubNiches: ["kuyumcu-traditional", "kuyumcu-luxury"],
  // Skip the 6-step onboarding wizard — every field that the wizard
  // would otherwise collect (name, country, language, niche, offer)
  // is set above, so dropping the user into /app/onboarding on first
  // login is just a worse UX. Same pattern as setup-emirhan-workspace.
  onboardingCompletedAt: new Date(),
};

const PACKAGES = [
  {
    name: "Başlangıç",
    priceLabel: "9.000 TL",
    features: [
      "Tek sayfa modern kuyumcu sitesi",
      "Mobil-first tasarım",
      "Canlı gram altın widget (manuel güncelleme)",
      "WhatsApp Business entegrasyonu",
      "Ürün galerisi (10 ürüne kadar)",
      "Google Maps konum + iletişim formu",
      "Domain + 1 yıl hosting",
    ],
    isPopular: false,
    sortOrder: 0,
  },
  {
    name: "Pro",
    priceLabel: "18.000 TL",
    features: [
      "Başlangıç paketinin tüm özellikleri",
      "Kategorili ürün kataloğu (50+ ürün)",
      "Alyans ve nişan yüzüğü randevu sistemi (mockup)",
      "Atölye ve usta profilleri",
      "Sertifika ve has ayar gösterimi",
      "Gram altın live widget (feed entegrasyonu önerisi)",
      "Hurda altın bozdurma CTA flow'u",
      "SSS ve SEO optimizasyonu",
      "Google Analytics + Search Console kurulumu",
      "Sosyal medya / Instagram entegrasyonu",
      "3 ay teknik destek",
    ],
    isPopular: true,
    sortOrder: 1,
  },
];

function generatePassword(): string {
  // Same alphabet as setup-emirhan-workspace — no look-alikes
  // (0/O, 1/l/I) and includes URL-safe punctuation so the password
  // is paste-friendly.
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789-_";
  const buf = randomBytes(16);
  let out = "";
  for (let i = 0; i < buf.length; i++) {
    out += alphabet[buf[i] % alphabet.length];
  }
  return out;
}

/**
 * Look up Berkay in auth.users; if missing, provision a fresh
 * Supabase auth user via the admin API (requires
 * SUPABASE_SERVICE_ROLE_KEY). Returns the user id and the
 * generated password (or null when we found a pre-existing row).
 */
async function resolveOrCreateAuthUser(): Promise<{
  id: string;
  password: string | null;
  created: boolean;
}> {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("DIRECT_URL / DATABASE_URL not set");
  const c = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  let existingId: string | null = null;
  try {
    const res = await c.query<{ id: string }>(
      `select id from auth.users where email = $1`,
      [TARGET_EMAIL],
    );
    existingId = res.rows[0]?.id ?? null;
  } finally {
    await c.end();
  }
  if (existingId) {
    return { id: existingId, password: null, created: false };
  }

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !serviceKey) {
    throw new Error(
      `No auth.users row for ${TARGET_EMAIL}, and ` +
        `NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set ` +
        `so I can't create one. Either sign up at /auth/signup first, ` +
        `or add those env vars and re-run.`,
    );
  }
  const admin: SupabaseClient = createClient(supaUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const password = generatePassword();
  const created = await admin.auth.admin.createUser({
    email: TARGET_EMAIL,
    password,
    email_confirm: true,
    user_metadata: { source: "setup-berkay-workspace" },
  });
  if (created.error || !created.data.user) {
    throw new Error(
      `createUser(${TARGET_EMAIL}) failed: ${created.error?.message ?? "no user returned"}`,
    );
  }
  return { id: created.data.user.id, password, created: true };
}

async function main() {
  console.log(`[setup-berkay-workspace] Target email: ${TARGET_EMAIL}`);

  const auth = await resolveOrCreateAuthUser();
  const userId = auth.id;
  if (auth.created) {
    console.log(`  Created auth.users row: ${userId}`);
  } else {
    console.log(`  Found auth.users row:   ${userId}`);
  }

  // Ensure the public.users mirror exists. requireUser() does this
  // on every login but the script may run before the user has ever
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
    console.log(
      `  Using existing workspace: ${workspaceId} (role=${existingMember.role})`,
    );
  } else {
    const slug = `berkay-${Date.now().toString(36)}`;
    const created = await prisma.workspace.create({
      data: {
        name: "Berkay'ın Workspace'i",
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
  // re-run flips an older workspace into the Berkay configuration.
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
    `\nDone. Berkay can now run Discovery with niche=kuyumcu-traditional\n` +
      `(or kuyumcu-luxury) + country=TR, trigger pitch-pack on a lead, and\n` +
      `the showcase mockup will pull both packages.`,
  );

  if (auth.created && auth.password) {
    console.log(
      `\n=== LOGIN CREDENTIALS ===\n` +
        `  Email:    ${TARGET_EMAIL}\n` +
        `  Password: ${auth.password}\n` +
        `\nSave this password — Supabase only stores the hash. Berkay can\n` +
        `change it from Settings → Account after first login.`,
    );
  }
}

main()
  .catch((err) => {
    console.error("Setup failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
