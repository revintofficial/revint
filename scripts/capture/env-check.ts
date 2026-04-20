/**
 * Fail fast if the env vars Steel + Supabase admin auth need are missing.
 * Imported at the top of every capture script so we never spin up a paid Steel
 * session only to crash 30 seconds later when an admin call returns 401.
 */
import "dotenv/config";

export interface CaptureEnv {
  steelApiKey: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  appBaseUrl: string;
}

export function requireEnv(): CaptureEnv {
  const missing: string[] = [];

  const steelApiKey = process.env.STEEL_API_KEY ?? "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const appBaseUrl =
    process.env.VIDEO_APP_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://hustle-zeta.vercel.app";

  if (!steelApiKey) missing.push("STEEL_API_KEY");
  if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseServiceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  if (missing.length) {
    console.error("\n!! Missing required env vars for video capture:");
    for (const k of missing) console.error(`   - ${k}`);
    console.error("\nAdd them to .env (root) and re-run.");
    console.error("STEEL_API_KEY:               https://app.steel.dev/settings/api-keys");
    console.error("SUPABASE_SERVICE_ROLE_KEY:   Supabase Dashboard → Project Settings → API → service_role\n");
    process.exit(1);
  }

  return { steelApiKey, supabaseUrl, supabaseServiceRoleKey, appBaseUrl };
}
