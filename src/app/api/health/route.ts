import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOptionalUser } from "@/lib/auth";

/**
 * Minimal health probe.
 *
 * Unauthenticated callers get a bare 200 ("ok") or 503 ("down"). Operators
 * listed in HEALTH_ADMIN_EMAILS (comma-separated) get a verbose payload.
 * Nothing about the environment is revealed to anonymous clients - no
 * version numbers, no env var presence, no table counts. The previous
 * implementation was an enumeration surface.
 */
export async function GET() {
  const adminEmails = (process.env.HEALTH_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const session = await getOptionalUser();
  const isAdmin =
    session !== null &&
    adminEmails.length > 0 &&
    adminEmails.includes(session.user.email.toLowerCase());

  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const status = dbOk ? 200 : 503;

  if (!isAdmin) {
    // Opaque response. Clients relying on this for uptime checks should
    // look at the HTTP status, not the body.
    return NextResponse.json({ ok: dbOk }, { status });
  }

  return NextResponse.json(
    {
      ok: dbOk,
      db: dbOk ? "ok" : "unreachable",
      ts: new Date().toISOString(),
    },
    { status },
  );
}
