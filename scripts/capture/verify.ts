import { requireEnv } from "./env-check";

const env = requireEnv();
console.log("\n✓ Env vars present:");
console.log(`  STEEL_API_KEY:               ${env.steelApiKey.slice(0, 14)}...`);
console.log(`  NEXT_PUBLIC_SUPABASE_URL:    ${env.supabaseUrl}`);
console.log(`  SUPABASE_SERVICE_ROLE_KEY:   (${env.supabaseServiceRoleKey.length} chars)`);
console.log(`  VIDEO_APP_BASE_URL:          ${env.appBaseUrl}`);
console.log("");
