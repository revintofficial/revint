/**
 * Seed a FineDine beta agency workspace.
 *
 * Sets up:
 *   - (Optional) Supabase auth users for owner + testers when --create-users
 *     is passed. Uses the admin API with `email_confirm: true` so each user
 *     can sign in with email + auto-generated password immediately, no
 *     magic-link round-trip required. Prints credentials to stdout.
 *   - Owner workspace (1) on AGENCY plan, 100-year trial period.
 *   - WorkspaceNiche = RESTAURANT_TECH (parent vertical = "fnb").
 *   - F&B-flavoured offer defaults (offerName / valueProposition / hook).
 *   - Country = TR by default (override with --country GB / AE / US ...).
 *   - targetSubNiches optional via --sub <slug,slug,...> (default = all 10).
 *   - 2 tester users attached as MEMBER role (workspace_members).
 *   - WorkspaceLeadPipeline preset = BALANCED, enabled.
 *   - onboardingCompletedAt = now() so testers don't get re-routed to wizard.
 *   - cycle counters reset (leadsCreatedThisCycle = 0, aiCreditsUsedThisCycle = 0).
 *
 * Prerequisites:
 *   - DIRECT_URL or DATABASE_URL set in .env
 *   - When --create-users is passed: NEXT_PUBLIC_SUPABASE_URL and
 *     SUPABASE_SERVICE_ROLE_KEY also required. Without --create-users every
 *     email must already exist in auth.users (signed up at /auth/signup).
 *
 * Usage:
 *   npx tsx scripts/seed-finedine-beta.ts \
 *     --owner owner@finedine.beta \
 *     --tester tester1@finedine.beta \
 *     --tester tester2@finedine.beta \
 *     --create-users \
 *     [--name "FineDine Beta"] \
 *     [--slug finedine-beta] \
 *     [--country TR] \
 *     [--language tr] \
 *     [--sub fnb-fine-dining,fnb-bar-club,fnb-hotel-fnb]
 */

import { Client } from "pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import "dotenv/config";

interface Args {
  owner: string;
  testers: string[];
  name: string;
  slug: string;
  country: string;
  language: string;
  sub: string[];
  createUsers: boolean;
}

const ALL_FNB_SUB_SLUGS = [
  "fnb-fine-dining",
  "fnb-bar-club",
  "fnb-cafe-bakery",
  "fnb-ghost-kitchen",
  "fnb-food-truck",
  "fnb-hotel-fnb",
  "fnb-casual-dining",
  "fnb-qsr",
  "fnb-airport-fnb",
  "fnb-multi-location",
];

const DEFAULT_OFFER = {
  offerName: "F&B Digital Stack (QR menu, ordering, reservations)",
  valueProposition:
    "FineDine modernises every digital touchpoint F&B operators rely on — QR menu, table-side ordering, online reservations, and guest CRM — so every cover spends more, comes back more often, and stays reachable for marketing.",
  socialProof:
    "1,500+ venues across 60 countries trust FineDine. Avg +18% upsell on table-side ordering, 4.8/5 operator rating.",
  offerHook:
    "Quickly scoped your site and the QR-to-order flow is missing — put a tailored mockup together for you.",
  objective: "Book a 15-min call",
  tone: "professional",
  length: "short",
  senderName: "FineDine BD",
  conversionLink: "https://finedinemenu.com/demo",
};

function parseArgs(argv: string[]): Args {
  const out: Args = {
    owner: "",
    testers: [],
    name: "FineDine Beta",
    slug: "finedine-beta",
    country: "TR",
    language: "tr",
    sub: [],
    createUsers: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    switch (a) {
      case "--owner":
        out.owner = next;
        i++;
        break;
      case "--tester":
        if (next) out.testers.push(next);
        i++;
        break;
      case "--name":
        out.name = next;
        i++;
        break;
      case "--slug":
        out.slug = next;
        i++;
        break;
      case "--country":
        out.country = next.toUpperCase();
        i++;
        break;
      case "--language":
        out.language = next.toLowerCase();
        i++;
        break;
      case "--sub":
        out.sub = next.split(",").map((s) => s.trim()).filter(Boolean);
        i++;
        break;
      case "--create-users":
        out.createUsers = true;
        break;
    }
  }
  if (!out.owner) {
    throw new Error(
      "Missing --owner <email>. Run with --help for usage examples.",
    );
  }
  if (out.testers.length === 0) {
    console.warn("! No --tester emails passed; only owner will be seeded.");
  }
  // Validate sub-niche slugs against the F&B child set.
  const bad = out.sub.filter((s) => !ALL_FNB_SUB_SLUGS.includes(s));
  if (bad.length) {
    throw new Error(
      `Unknown sub-niche slugs: ${bad.join(", ")}\n` +
        `Allowed: ${ALL_FNB_SUB_SLUGS.join(", ")}`,
    );
  }
  return out;
}

async function findAuthUserId(c: Client, email: string): Promise<string> {
  const r = await c.query(`select id from auth.users where email = $1`, [email]);
  if (!r.rows[0]) {
    throw new Error(
      `No auth.users row for ${email}. Sign up at /auth/signup first ` +
        `or rerun with --create-users to provision the user automatically.`,
    );
  }
  return r.rows[0].id as string;
}

async function ensurePublicUser(c: Client, userId: string, email: string) {
  // Prisma manages updated_at automatically through @updatedAt at the ORM
  // layer — but raw SQL inserts have to set it themselves. The schema
  // declares the column NOT NULL with no DB-level default, so we set both
  // timestamps explicitly here.
  await c.query(
    `insert into users (id, email, created_at, updated_at)
     values ($1, $2, now(), now())
     on conflict (id) do update
       set email = excluded.email,
           updated_at = now()`,
    [userId, email],
  );
}

/**
 * Generate a 16-char password mixing alphanumerics and a couple of safe
 * symbols. Avoids ambiguous chars (0/O/1/l) and quote / backslash for clean
 * copy-paste from a terminal. ~95 bits of entropy — fine for a beta trial.
 */
function generatePassword(): string {
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
 * Create-or-rotate a Supabase auth user. When the email already exists we
 * rotate the password to a freshly generated one so the operator always
 * walks away from a `--create-users` run with usable credentials. Re-runs
 * are therefore destructive to old passwords — that's intentional for a
 * beta seed script.
 */
async function ensureAuthUser(
  admin: SupabaseClient,
  email: string,
): Promise<{ id: string; password: string; created: boolean }> {
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (list.error) throw new Error(`listUsers failed: ${list.error.message}`);
  const found = list.data.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  if (found) {
    const password = generatePassword();
    const updated = await admin.auth.admin.updateUserById(found.id, {
      password,
      email_confirm: true,
    });
    if (updated.error) {
      throw new Error(
        `updateUserById(${email}) failed: ${updated.error.message}`,
      );
    }
    return { id: found.id, password, created: false };
  }
  const password = generatePassword();
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { source: "finedine-beta-seed" },
  });
  if (created.error || !created.data.user) {
    throw new Error(
      `createUser(${email}) failed: ${created.error?.message ?? "no user returned"}`,
    );
  }
  return { id: created.data.user.id, password, created: true };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("DIRECT_URL / DATABASE_URL not set in .env");
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  try {
    console.log(`\n=== FineDine Beta Seed ===`);
    console.log(`owner       : ${args.owner}`);
    console.log(`testers     : ${args.testers.join(", ") || "(none)"}`);
    console.log(`name        : ${args.name}`);
    console.log(`slug        : ${args.slug}`);
    console.log(`country     : ${args.country}`);
    console.log(`language    : ${args.language}`);
    console.log(`sub         : ${args.sub.length ? args.sub.join(", ") : "(all 10 children)"}`);
    console.log(`create users: ${args.createUsers}`);
    console.log("");

    // Resolve auth user ids — either by creating fresh accounts via the
    // Supabase admin API, or by looking up pre-existing emails. Track any
    // freshly minted passwords so we can print them at the end.
    const credentials: { email: string; password: string }[] = [];
    let admin: SupabaseClient | null = null;
    if (args.createUsers) {
      const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supaUrl || !serviceKey) {
        throw new Error(
          "--create-users needs NEXT_PUBLIC_SUPABASE_URL and " +
            "SUPABASE_SERVICE_ROLE_KEY in your environment.",
        );
      }
      admin = createClient(supaUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }

    const provision = async (email: string) => {
      if (admin) {
        const r = await ensureAuthUser(admin, email);
        credentials.push({ email, password: r.password });
        console.log(
          `  ${email} ${r.created ? "created" : "already existed — password rotated"}`,
        );
        await ensurePublicUser(c, r.id, email);
        return r.id;
      }
      const id = await findAuthUserId(c, email);
      await ensurePublicUser(c, id, email);
      return id;
    };

    const ownerId = await provision(args.owner);
    const testers: { email: string; id: string }[] = [];
    for (const email of args.testers) {
      const id = await provision(email);
      testers.push({ email, id });
    }

    // 1. Resolve / create owner workspace.
    let wsId: string;
    const existingWs = await c.query(
      `select w.id from workspaces w
         join workspace_members wm on wm.workspace_id = w.id and wm.role = 'OWNER'
        where wm.user_id = $1
        order by wm.created_at asc
        limit 1`,
      [ownerId],
    );
    if (existingWs.rows[0]) {
      wsId = existingWs.rows[0].id as string;
      console.log(`Owner already has workspace ${wsId} — patching it.`);
    } else {
      const created = await c.query(
        `insert into workspaces (id, name, slug, owner_id, created_at, updated_at)
         values (gen_random_uuid()::text, $1, $2, $3, now(), now())
         returning id`,
        [args.name, args.slug, ownerId],
      );
      wsId = created.rows[0].id as string;
      await c.query(
        `insert into workspace_members (id, workspace_id, user_id, role, created_at)
         values (gen_random_uuid()::text, $1, $2, 'OWNER'::"Role", now())
         on conflict (workspace_id, user_id) do nothing`,
        [wsId, ownerId],
      );
      console.log(`Created workspace ${wsId} owned by ${args.owner}`);
    }

    // 2. Patch workspace to AGENCY + RESTAURANT_TECH + offer defaults.
    await c.query(
      `update workspaces
         set name = $2,
             slug = $3,
             plan = 'AGENCY',
             current_period_end = now() + interval '100 years',
             cycle_reset_at = now(),
             leads_this_cycle = 0,
             ai_credits_this_cycle = 0,
             niche = 'RESTAURANT_TECH',
             target_sub_niches = $4::text[],
             country = $5,
             language = $6,
             offer_name = $7,
             value_proposition = $8,
             social_proof = $9,
             offer_hook = $10,
             objective = $11,
             tone = $12,
             length = $13,
             sender_name = $14,
             conversion_link = $15,
             onboarding_completed_at = now(),
             updated_at = now()
       where id = $1`,
      [
        wsId,
        args.name,
        args.slug,
        args.sub, // empty array = "all children" per offer-form semantics
        args.country,
        args.language,
        DEFAULT_OFFER.offerName,
        DEFAULT_OFFER.valueProposition,
        DEFAULT_OFFER.socialProof,
        DEFAULT_OFFER.offerHook,
        DEFAULT_OFFER.objective,
        DEFAULT_OFFER.tone,
        DEFAULT_OFFER.length,
        DEFAULT_OFFER.senderName,
        DEFAULT_OFFER.conversionLink,
      ],
    );
    console.log(`Workspace patched: AGENCY plan, RESTAURANT_TECH niche, F&B offer defaults`);

    // 3. Default lead pipeline = BALANCED + enabled. The chains.ts resolver
    // re-derives the steps array from the preset on every read, so we keep
    // `steps = []` and let runtime fill it in.
    await c.query(
      `insert into workspace_lead_pipelines (id, workspace_id, preset, steps, enabled, created_at, updated_at)
       values (gen_random_uuid()::text, $1, 'BALANCED', '[]'::jsonb, true, now(), now())
       on conflict (workspace_id) do update set
         preset = 'BALANCED',
         enabled = true,
         updated_at = now()`,
      [wsId],
    );
    console.log(`Lead pipeline preset = BALANCED, enabled`);

    // 4. Attach testers as MEMBER role. The Role column is a Postgres enum
    // (defined as `enum Role` in prisma/schema.prisma), so plain text would
    // fail with "type Role but expression is of type text" — every literal
    // has to be cast explicitly.
    for (const t of testers) {
      await c.query(
        `insert into workspace_members (id, workspace_id, user_id, role, created_at)
         values (gen_random_uuid()::text, $1, $2, 'MEMBER'::"Role", now())
         on conflict (workspace_id, user_id) do update
           set role = case when workspace_members.role = 'OWNER'::"Role"
                          then 'OWNER'::"Role"
                          else 'MEMBER'::"Role" end`,
        [wsId, t.id],
      );
      console.log(`Attached tester ${t.email} as MEMBER`);
    }

    // 5. Seed FineDine's actual price card as ServicePackage rows so the
    // analyst worker can recommend a specific tier (vs the legacy
    // STARTER/GROWTH/SALES enum) and the opener writer can quote a real
    // price in the email's soft CTA. The features list is verbatim from
    // research/finedine/README.md (sourced from finedinemenu.com pricing
    // page) so the rep can stand behind every claim. Idempotent on
    // (workspace_id, name) — re-running the script edits in place
    // instead of creating duplicates.
    const packages = [
      {
        name: "Base",
        priceLabel: "$39 / month (billed yearly)",
        features: [
          "QR code menu",
          "Tablet menu",
          "Branded ordering page",
          "Multi-language menu",
          "Basic analytics",
        ],
        isPopular: false,
        sortOrder: 1,
      },
      {
        name: "Premium",
        priceLabel: "$119 / month (billed yearly)",
        features: [
          "Everything in Base",
          "AI upsell engine",
          "Guest CRM (email + WhatsApp)",
          "Online reservations",
          "Online ordering / delivery & pick-up",
          "Conversion analytics dashboard",
        ],
        isPopular: true,
        sortOrder: 2,
      },
      {
        name: "Enterprise",
        priceLabel: "Custom (multi-brand, hotel, chain)",
        features: [
          "Everything in Premium",
          "Multi-brand / chain console",
          "Centralised multi-property analytics",
          "POS integrations (Toast, Square, Micros, Adyen)",
          "Hotel directory + room-charge billing",
          "Dedicated account manager + SLA",
          "Custom onboarding + migration",
        ],
        isPopular: false,
        sortOrder: 3,
      },
    ];

    for (const p of packages) {
      await c.query(
        `insert into service_packages (id, workspace_id, name, price_label, features, is_popular, sort_order, created_at, updated_at)
         values (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, now(), now())
         on conflict (workspace_id, name) do update set
           price_label = excluded.price_label,
           features    = excluded.features,
           is_popular  = excluded.is_popular,
           sort_order  = excluded.sort_order,
           updated_at  = now()`,
        [wsId, p.name, p.priceLabel, p.features, p.isPopular, p.sortOrder],
      );
    }
    console.log(`Service packages seeded: ${packages.map((p) => p.name).join(", ")}`);

    // 6. Final read-out for verification.
    const final = await c.query(
      `select w.id, w.name, w.slug, w.plan, w.niche, w.country, w.language,
              w.target_sub_niches, w.current_period_end, w.onboarding_completed_at,
              (select count(*)::int from workspace_members where workspace_id = w.id) as seats
         from workspaces w
        where w.id = $1`,
      [wsId],
    );
    const members = await c.query(
      `select u.email, wm.role
         from workspace_members wm
         join users u on u.id = wm.user_id
        where wm.workspace_id = $1
        order by case wm.role
          when 'OWNER' then 0
          when 'ADMIN' then 1
          else 2 end, u.email`,
      [wsId],
    );

    console.log(`\n=== Final State ===`);
    console.log(final.rows[0]);
    console.log(`Members:`);
    members.rows.forEach((m: { role: string; email: string }) =>
      console.log(`  - ${m.role.padEnd(7)} ${m.email}`),
    );
    if (credentials.length > 0) {
      console.log(`\n=== Login Credentials (PRINTED ONCE — save now) ===`);
      console.log(`Sign-in URL: ${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/login`);
      console.log("");
      credentials.forEach(({ email, password }) => {
        console.log(`  email   : ${email}`);
        console.log(`  password: ${password}`);
        console.log("");
      });
      console.log(
        `These passwords are NOT stored anywhere else. Re-running this\n` +
          `script with --create-users will rotate them; without --create-users\n` +
          `the existing passwords stay intact. Reset via Supabase dashboard\n` +
          `if needed.`,
      );
    }

    console.log(`\nNext steps:`);
    console.log(`  1. Owner signs in → /app/dashboard should show the F&B picker.`);
    console.log(`  2. Testers sign in with email + password printed above.`);
    console.log(`  3. Run the test plan in research/finedine/beta-test-plan.md.`);
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error("\nSeed failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
