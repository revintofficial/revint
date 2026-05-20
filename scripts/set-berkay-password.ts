/**
 * One-shot: set Berkay's Supabase password to a specific value.
 * Variant of rotate-berkay-password.ts that accepts an explicit
 * password from the CLI instead of generating a random one.
 *
 * Run with:
 *   npx tsx scripts/set-berkay-password.ts <new-password>
 */
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

async function main() {
  const newPassword = process.argv[2];
  if (!newPassword) {
    throw new Error("Usage: tsx scripts/set-berkay-password.ts <new-password>");
  }
  if (newPassword.length < 6) {
    throw new Error("Supabase requires password length >= 6");
  }

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing",
    );
  }
  const admin = createClient(supaUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = "berkaysirakayaaa@gmail.com";
  const userId = "004f3480-1f87-4853-af5e-e07972a4d286";

  const r = await admin.auth.admin.updateUserById(userId, {
    password: newPassword,
    email_confirm: true,
  });
  if (r.error) {
    throw new Error(`updateUserById failed: ${r.error.message}`);
  }

  console.log("\n=== BERKAY LOGIN CREDENTIALS ===");
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${newPassword}`);
  console.log(
    "\nİlk login sonrası Settings → Account üzerinden parolasını değiştirmesini söyle.",
  );
}

main().catch((err) => {
  console.error("set failed:", err);
  process.exit(1);
});
