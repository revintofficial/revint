import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Email capture endpoint for free tools at /tools/*.
 *
 * Stores the email against the tool slug plus a JSON blob of the computed
 * metrics so a downstream worker can personalize the follow-up email. The
 * model is intentionally lightweight — no tenant scoping because these
 * leads belong to Revint's own marketing list, not to an org.
 *
 * Persistence is best-effort: if the `MarketingCapture` table doesn't exist
 * yet (migration not yet applied), the request still succeeds and the
 * capture is logged for a backfill. This keeps the tool pages working
 * through any schema drift.
 */

const ALLOWED_TOOLS = new Set([
  "cold-email-reply-rate-calculator",
  "icp-match-scorer",
]);

export async function POST(req: NextRequest) {
  let body: {
    email?: string;
    tool?: string;
    metrics?: Record<string, unknown>;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const tool = (body.tool ?? "").trim();
  const metrics = body.metrics ?? {};

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json(
      { ok: false, error: "invalid_email" },
      { status: 400 },
    );
  }
  if (!ALLOWED_TOOLS.has(tool)) {
    return NextResponse.json(
      { ok: false, error: "invalid_tool" },
      { status: 400 },
    );
  }

  const source = `tool:${tool}`;
  const ua = req.headers.get("user-agent") ?? "";
  const referer = req.headers.get("referer") ?? "";
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "";

  try {
    const anyPrisma = prisma as unknown as {
      marketingCapture?: {
        create: (args: {
          data: Record<string, unknown>;
        }) => Promise<unknown>;
      };
    };

    if (anyPrisma.marketingCapture?.create) {
      await anyPrisma.marketingCapture.create({
        data: {
          email,
          source,
          metadata: { tool, metrics, ua, referer, ip },
        },
      });
    } else {
      console.log("[tool-capture] fallback log", {
        email,
        tool,
        metrics,
      });
    }
  } catch (err) {
    console.error("[tool-capture] persist error", err);
  }

  return NextResponse.json({ ok: true });
}
