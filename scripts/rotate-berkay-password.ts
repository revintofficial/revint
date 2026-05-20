/**
 * One-shot helper: rotate Berkay's Supabase password and print the
 * new credential block. Used because `setup-berkay-workspace.ts`
 * intentionally does NOT rotate when the auth.users row already
 * exists (idempotent re-runs shouldn't silently invalidate a
 * working password). When we need a fresh password — e.g. the
 * original credentials weren't captured or got lost — this script
 * generates and sets a new one.
 *
 * Run with:
 *   npx tsx scripts/rotate-berkay-password.ts
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import "dotenv/config";

const ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789-_";

function generatePassword(): string {
  const buf = randomBytes(16);
  let out = "";
  for (let i = 0; i < buf.length; i++) {
    out += ALPHABET[buf[i] % ALPHABET.length];
  }
  return out;
}

async function main() {
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
  const password = generatePassword();

  const r = await admin.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
  });
  if (r.error) {
    throw new Error(`updateUserById failed: ${r.error.message}`);
  }

  console.log("\n=== BERKAY LOGIN CREDENTIALS ===");
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log(
    "\nİlk login sonrası Settings → Account üzerinden parolasını değiştirmesini söyle.",
  );
}

main().catch((err) => {
  console.error("rotate failed:", err);
  process.exit(1);
});
