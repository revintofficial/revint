/**
 * Quick local check: confirms the service role key can mint a magic link
 * for meertseker@gmail.com without paying for a Steel session. If this
 * fails we know the env or Supabase config is wrong before we burn credits.
 */
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./env-check";
import { TARGET_EMAIL } from "./auth";

async function main() {
  const env = requireEnv();
  const admin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const redirectTo = new URL("/app/leads/vid_lead_01_bellavita", env.appBaseUrl).toString();
  console.log(`\nTesting magic link mint for ${TARGET_EMAIL}`);
  console.log(`Redirect target: ${redirectTo}\n`);

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: TARGET_EMAIL,
    options: { redirectTo },
  });

  if (error) {
    console.error("✗ Magic link generation FAILED:", error.message);
    console.error("\nLikely cause: redirect URL not whitelisted.");
    console.error("Fix: Supabase Dashboard → Authentication → URL Configuration");
    console.error("     → Redirect URLs → Add: " + env.appBaseUrl + "/**\n");
    process.exit(1);
  }

  if (!data?.properties?.action_link) {
    console.error("✗ No action_link returned. Service role key may be invalid.");
    process.exit(1);
  }

  console.log("✓ Magic link minted successfully");
  console.log(`  Action link: ${data.properties.action_link.slice(0, 80)}...`);
  console.log(`  Hashed token present: ${Boolean(data.properties.hashed_token)}`);
  console.log(`  Verification type: ${data.properties.verification_type}`);
  console.log("\nReady to capture. Run: npm run video:capture:audit\n");
}

main().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(1);
});
