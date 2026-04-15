import { NextResponse } from "next/server";

export async function GET() {
  const checks: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    node: process.version,
    env: {
      DATABASE_URL: process.env.DATABASE_URL ? "set (" + process.env.DATABASE_URL.replace(/:[^@]+@/, ":***@") + ")" : "MISSING",
      DIRECT_URL: process.env.DIRECT_URL ? "set" : "MISSING",
      GEMINI_API_KEY: process.env.GEMINI_API_KEY ? "set" : "MISSING",
      GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY ? "set" : "MISSING",
    },
  };

  try {
    const { PrismaPg } = await import("@prisma/adapter-pg");
    checks.prismaAdapterPg = "ok";
  } catch (e) {
    checks.prismaAdapterPg = `FAILED: ${e instanceof Error ? e.message : String(e)}`;
  }

  try {
    const pg = await import("pg");
    checks.pgModule = "ok";
  } catch (e) {
    checks.pgModule = `FAILED: ${e instanceof Error ? e.message : String(e)}`;
  }

  try {
    const { prisma } = await import("@/lib/prisma");
    const count = await prisma.lead.count();
    checks.database = `ok (${count} leads)`;
  } catch (e) {
    checks.database = `FAILED: ${e instanceof Error ? e.stack : String(e)}`;
  }

  const allOk = !JSON.stringify(checks).includes("FAILED") && !JSON.stringify(checks).includes("MISSING");

  return NextResponse.json(checks, { status: allOk ? 200 : 500 });
}
