/**
 * HubSpot App Card — production smoke test.
 *
 * Signs a request EXACTLY the way HubSpot's UI-extension `hubspot.fetch`
 * does (v3 signature:
 *   base64(HMAC-SHA256(clientSecret, method + uri + body + timestamp)))
 * and POSTs it to the live `card-data` endpoint. This isolates the Revint
 * backend signature/auth path from HubSpot itself, so the first smoke test
 * is deterministic and repeatable — no clicking inside HubSpot required.
 *
 * Interpreting the result:
 *   200 + {found:false, reason:"workspace_not_found"} → signature OK, the
 *         portal id wasn't recognised (expected when you pass a dummy portal).
 *   200 + {found:false, reason:"lead_not_found"}      → signature OK + portal
 *         resolved, but no Lead is linked to that object yet.
 *   200 + {found:true, ...}                            → full happy path. 🎉
 *   401 + {error:"invalid_signature"}                  → secret/URL mismatch
 *         between this script and the deployed env (see notes printed below).
 *
 * Run:
 *   npx tsx scripts/hubspot-card-smoke.ts
 *   npx tsx scripts/hubspot-card-smoke.ts --url https://app.revint.dev/api/integrations/hubspot/card-data
 *   npx tsx scripts/hubspot-card-smoke.ts --portal 48807704 --object 12345 --type CONTACT
 *
 * Flags:
 *   --url <url>     target endpoint (default https://app.revint.dev/api/integrations/hubspot/card-data)
 *   --portal <id>   X-HubSpot-Hub-Id (default: auto-discovered from DB, else 0)
 *   --object <id>   objectId in the body (default: auto-discovered from DB, else 1)
 *   --type <T>      objectType: CONTACT | DEAL | COMPANY (default CONTACT)
 *   --secret <s>    client secret (default: HUBSPOT_CLIENT_SECRET env)
 *   --no-db         skip DB auto-discovery of a real portal + linked lead
 */
import { createHmac } from "node:crypto";
import "dotenv/config";

const DEFAULT_URL =
  "https://app.revint.dev/api/integrations/hubspot/card-data";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

interface Discovered {
  portalId?: string;
  objectId?: string;
  objectType?: string;
}

/**
 * Best-effort: find a connected portal + a CRM-linked lead so the smoke
 * test can exercise the real happy path. Falls back silently when the DB
 * is unreachable or nothing is linked yet.
 */
async function discoverFromDb(): Promise<Discovered> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const conn = await prisma.crmConnection.findFirst({
      where: { provider: "HUBSPOT", status: { not: "REVOKED" } },
      select: { portalId: true, workspaceId: true },
      orderBy: { updatedAt: "desc" },
    });
    if (!conn?.portalId) return {};

    const lead = await prisma.lead.findFirst({
      where: {
        workspaceId: conn.workspaceId,
        OR: [{ crmContactId: { not: null } }, { crmDealId: { not: null } }],
      },
      select: { crmContactId: true, crmDealId: true, businessName: true },
      orderBy: { updatedAt: "desc" },
    });

    if (lead?.crmContactId) {
      console.log(
        `  ↳ DB: portal ${conn.portalId}, CONTACT ${lead.crmContactId} (${lead.businessName ?? "?"})`,
      );
      return {
        portalId: conn.portalId,
        objectId: lead.crmContactId,
        objectType: "CONTACT",
      };
    }
    if (lead?.crmDealId) {
      console.log(
        `  ↳ DB: portal ${conn.portalId}, DEAL ${lead.crmDealId} (${lead.businessName ?? "?"})`,
      );
      return {
        portalId: conn.portalId,
        objectId: lead.crmDealId,
        objectType: "DEAL",
      };
    }
    console.log(`  ↳ DB: portal ${conn.portalId}, no CRM-linked lead found`);
    return { portalId: conn.portalId };
  } catch (err) {
    console.log(
      `  ↳ DB discovery skipped (${err instanceof Error ? err.message : String(err)})`,
    );
    return {};
  }
}

async function main(): Promise<void> {
  const url = arg("url") ?? DEFAULT_URL;
  const secret = arg("secret") ?? process.env.HUBSPOT_CLIENT_SECRET;

  if (!secret) {
    console.error(
      "✗ No client secret. Set HUBSPOT_CLIENT_SECRET or pass --secret <value>.",
    );
    process.exit(1);
  }

  const discovered = flag("no-db") ? {} : await discoverFromDb();

  const objectType = (
    arg("type") ??
    discovered.objectType ??
    "CONTACT"
  ).toUpperCase();
  const objectId = arg("object") ?? discovered.objectId ?? "1";
  const portalId = arg("portal") ?? discovered.portalId ?? "0";

  // `--body-portal` mimics the real UI-extension card: hubspot.fetch can't
  // set custom headers, so the portal id rides in the body and NO
  // x-hubspot-hub-id header is sent.
  const bodyPortal = flag("body-portal");
  const method = "POST";
  const body = bodyPortal
    ? JSON.stringify({ objectType, objectId, portalId })
    : JSON.stringify({ objectType, objectId });
  const timestamp = String(Date.now());

  // v3: base64(HMAC-SHA256(secret, method + uri + body + timestamp)).
  // `uri` is the full URL HubSpot called — must match exactly.
  const baseString = `${method}${url}${body}${timestamp}`;
  const signatureV3 = createHmac("sha256", secret)
    .update(baseString, "utf8")
    .digest("base64");

  console.log("\n=== HubSpot card-data smoke test ===");
  console.log(`URL        : ${url}`);
  console.log(`objectType : ${objectType}`);
  console.log(`objectId   : ${objectId}`);
  console.log(`portalId   : ${portalId}`);
  console.log(`secret     : ${secret.slice(0, 4)}…${secret.slice(-4)} (len ${secret.length})`);
  console.log(`timestamp  : ${timestamp}`);
  console.log(`signature  : ${signatureV3.slice(0, 12)}… (v3)\n`);

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-hubspot-signature-v3": signatureV3,
    "x-hubspot-request-timestamp": timestamp,
    "x-hubspot-signature-version": "v3",
  };
  if (!bodyPortal) headers["x-hubspot-hub-id"] = portalId;

  const res = await fetch(url, { method, headers, body });

  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* keep raw text */
  }

  console.log(`HTTP ${res.status}`);
  console.log(JSON.stringify(parsed, null, 2));

  if (res.status === 401) {
    console.log(
      "\n✗ 401 invalid_signature. The signature this script computed with the\n" +
        "  given secret + URL does NOT match what the deployed endpoint expects.\n" +
        "  Most likely the deployed HUBSPOT_CLIENT_SECRET differs from the secret\n" +
        "  used here, or the deployed URL candidates don't include this exact URL.\n" +
        "  Try: --url with/without trailing slash, or verify the Vercel env secret.",
    );
    process.exitCode = 2;
  } else if (res.status === 200) {
    console.log("\n✓ Signature accepted (HTTP 200). Auth path is healthy.");
  } else {
    console.log(`\n⚠ Unexpected status ${res.status}.`);
    process.exitCode = 3;
  }
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
