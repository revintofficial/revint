/**
 * Inspect what Steel actually returns from sessions.create so we can fix
 * the connectOverCDP URL format if it differs from the SDK README.
 */
import Steel from "steel-sdk";
import { requireEnv } from "./env-check";

async function main() {
  const env = requireEnv();
  const steel = new Steel({ steelAPIKey: env.steelApiKey });

  console.log("Creating session...");
  const session = await steel.sessions.create({
    sessionTimeout: 60_000,
    dimensions: { width: 1920, height: 1080 },
    blockAds: false,
    solveCaptcha: false,
  });

  console.log("\nFull session object:");
  console.log(JSON.stringify(session, null, 2));

  console.log(`\nKey URLs:`);
  console.log(`  websocketUrl:     ${session.websocketUrl}`);
  console.log(`  debugUrl:         ${session.debugUrl}`);
  console.log(`  sessionViewerUrl: ${session.sessionViewerUrl}`);

  // Release immediately so we don't waste credits.
  await steel.sessions.release(session.id);
  console.log(`\nReleased ${session.id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
