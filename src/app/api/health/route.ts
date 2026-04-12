import { NextResponse } from "next/server";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  return NextResponse.json({
    status: "ok",
    env: {
      DATABASE_URL: dbUrl ? `${dbUrl.substring(0, 20)}...` : "NOT SET",
      GEMINI_API_KEY: process.env.GEMINI_API_KEY ? "SET" : "NOT SET",
      GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY ? "SET" : "NOT SET",
      NODE_ENV: process.env.NODE_ENV,
    },
  });
}
