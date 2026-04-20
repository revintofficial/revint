/**
 * Verbose end-to-end auth flow debug. Prints every navigation, every cookie,
 * and the final landing URL so we can see EXACTLY where the magic-link
 * handshake is breaking.
 */
import { createSession } from "./steel-session";
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./env-check";
import { TARGET_EMAIL } from "./auth";

async function main() {
  const env = requireEnv();
  const handle = await createSession({ width: 1920, height: 1080, dpr: 2, timeoutMs: 120_000 });

  try {
    const { page } = handle;

    // Log every navigation as it happens.
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) {
        console.log(`  [nav] → ${frame.url()}`);
      }
    });
    page.on("response", (resp) => {
      const url = resp.url();
      if (url.includes("supabase") || url.includes("hustle-zeta") || url.includes("vercel")) {
        console.log(`  [resp] ${resp.status()} ${url.slice(0, 110)}`);
      }
    });

    const admin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const redirectTo = new URL("/app/leads/vid_lead_01_bellavita", env.appBaseUrl).toString();
    console.log(`\nRedirect target: ${redirectTo}`);

    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: TARGET_EMAIL,
      options: { redirectTo },
    });

    if (error || !data?.properties?.action_link) {
      throw new Error(`generateLink failed: ${error?.message}`);
    }

    console.log(`\nAction link: ${data.properties.action_link.slice(0, 120)}...`);
    console.log(`\nNavigating...\n`);

    await page.goto(data.properties.action_link, { waitUntil: "domcontentloaded", timeout: 30_000 });
    console.log(`\n[after goto] page.url(): ${page.url()}`);

    // Give any client-side redirects a chance.
    await page.waitForTimeout(3_000);
    console.log(`[after 3s wait] page.url(): ${page.url()}`);

    const cookies = await page.context().cookies();
    console.log(`\nAll cookies (${cookies.length}):`);
    for (const c of cookies) {
      console.log(`  ${c.domain.padEnd(35)} ${c.name.padEnd(50)} (${c.value.length} chars)`);
    }

    // Snapshot HTML for clues
    const title = await page.title();
    const bodyTextStart = await page.evaluate(() =>
      document.body?.innerText?.slice(0, 200) ?? "(no body)",
    );
    console.log(`\nFinal page title: "${title}"`);
    console.log(`Body text (first 200 chars):\n  ${bodyTextStart.replace(/\n/g, "\\n")}`);
  } finally {
    await handle.release();
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
