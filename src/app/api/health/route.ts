import { NextResponse } from "next/server";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  let dbStatus = "NOT TESTED";
  let dbError = null;

  if (!dbUrl) {
    dbStatus = "NO_URL";
    dbError = "DATABASE_URL environment variable is not set";
  } else {
    try {
      const { getPrisma } = await import("@/lib/prisma");
      const prisma = getPrisma();
      await prisma.$queryRawUnsafe("SELECT 1 as ok");
      dbStatus = "CONNECTED";
    } catch (e) {
      dbStatus = "FAILED";
      dbError = e instanceof Error ? e.message : String(e);
    }
  }

  return NextResponse.json({
    status: dbStatus === "CONNECTED" ? "ok" : "degraded",
    database: {
      status: dbStatus,
      error: dbError,
      urlSet: !!dbUrl,
      urlPreview: dbUrl ? `${dbUrl.substring(0, 25)}...` : "NOT SET",
    },
    env: {
      DATABASE_URL: dbUrl ? "SET" : "NOT SET",
      GEMINI_API_KEY: process.env.GEMINI_API_KEY ? "SET" : "NOT SET",
      GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY
        ? "SET"
        : "NOT SET",
      NODE_ENV: process.env.NODE_ENV,
    },
  });
}
