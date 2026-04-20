/**
 * Debug what the lead detail page actually does post-auth.
 * Captures console errors, network failures, and dumps the rendered DOM.
 */
import { createSession } from "./steel-session";
import { loginAsTarget } from "./auth";

async function main() {
  const handle = await createSession({ width: 1920, height: 1080, dpr: 2 });
  try {
    const { page } = handle;

    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        console.log(`  [console.${msg.type()}]`, msg.text().slice(0, 300));
      }
    });
    page.on("pageerror", (err) => {
      console.log(`  [pageerror]`, err.message.slice(0, 300));
    });
    page.on("requestfailed", (req) => {
      console.log(`  [requestfailed] ${req.method()} ${req.url()} :: ${req.failure()?.errorText}`);
    });
    page.on("response", (resp) => {
      const u = resp.url();
      if (resp.status() >= 400 && (u.includes("hustle-zeta") || u.includes("supabase"))) {
        console.log(`  [http ${resp.status()}] ${u.slice(0, 110)}`);
      }
    });

    console.log("\n--- 1) Try /app/dashboard ---");
    await loginAsTarget(page, "/app/dashboard");
    await page.waitForTimeout(4000);
    console.log("  final url:", page.url());
    console.log("  title:", await page.title());
    const dashText = await page.evaluate(() => document.body?.innerText?.slice(0, 200) ?? "");
    console.log("  body:", dashText.replace(/\n/g, " | "));

    console.log("\n--- 2) Try /app/leads/vid_lead_01_bellavita ---");
    await page.goto("https://hustle-zeta.vercel.app/app/leads/vid_lead_01_bellavita", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(5000);
    console.log("  final url:", page.url());
    console.log("  title:", await page.title());
    const leadText = await page.evaluate(() => document.body?.innerText?.slice(0, 300) ?? "");
    console.log("  body:", leadText.replace(/\n/g, " | "));
  } finally {
    await handle.release();
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
