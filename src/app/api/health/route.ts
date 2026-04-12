import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  let dbStatus = "NOT TESTED";
  let dbError = null;

  try {
    const result = await prisma.$queryRawUnsafe("SELECT 1 as ok");
    dbStatus = "CONNECTED";
  } catch (e) {
    dbStatus = "FAILED";
    dbError = e instanceof Error ? e.message : String(e);
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
      GEMINI_API_KEY: process.env.GEMINI_API_KEY ? "SET" : "NOT SET",
      GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY
        ? "SET"
        : "NOT SET",
      NODE_ENV: process.env.NODE_ENV,
    },
  });
}
