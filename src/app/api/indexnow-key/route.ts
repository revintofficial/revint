import { NextResponse } from "next/server";

/**
 * IndexNow verification endpoint.
 *
 * IndexNow needs an HTTP GET to return the raw key string. The spec lets
 * us host the key at any URL as long as we pass that URL via `keyLocation`
 * when submitting (see `src/lib/seo/indexnow.ts`). We keep the key in an
 * env var and serve it from here so nothing needs to be committed.
 *
 * Bing, Yandex, and Seznam all honour IndexNow; Google does not today but
 * likely will. Submission is fire-and-forget.
 */

export async function GET() {
  const key = process.env.INDEXNOW_KEY;
  if (!key) return new NextResponse("Not Found", { status: 404 });

  return new NextResponse(key, {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
