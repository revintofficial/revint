import { NextResponse } from "next/server";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { checkRateLimit, LIMITS, rateLimitResponse } from "@/lib/ratelimit";
import { placeAutocomplete } from "@/lib/places-autocomplete";
import { internalError, badRequest } from "@/lib/api-errors";

/**
 * Proxy for Google Places Autocomplete (New).
 *
 * Why this exists instead of calling Google directly from the browser:
 *   1. The `GOOGLE_PLACES_API_KEY` is server-only (no referrer
 *      restriction set up yet); shipping it to clients would let any
 *      visitor drain the project's quota.
 *   2. Per-workspace rate limiting + Redis caching cuts cost on
 *      popular queries ("istanbul", "london", "new york") — the same
 *      session token from one visitor seeds the cache for the next.
 *   3. Lets us enforce admin/locality-only `includedPrimaryTypes` in
 *      one place; the picker never has to know the type list.
 *
 * Body shape:
 *   { query: string,
 *     sessionToken: string,
 *     regionCode?: string,    // ISO-2 to bias ranking
 *     languageCode?: string } // BCP-47 like "tr", "en"
 *
 * Response:
 *   { suggestions: AutocompleteSuggestion[] }
 *
 * Note on session tokens: the client generates a single token per
 * picker session and reuses it across keystrokes. Once the user picks
 * a suggestion, /api/places/details closes that session, and the
 * client rotates to a fresh token for the next chip add.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { workspaceId } = await requireUser();

    const rl = await checkRateLimit(workspaceId, LIMITS.placesAutocomplete);
    if (!rl.ok) return rateLimitResponse(rl);

    let body: {
      query?: unknown;
      sessionToken?: unknown;
      regionCode?: unknown;
      languageCode?: unknown;
    } = {};
    try {
      body = await request.json();
    } catch {
      return badRequest("Invalid JSON body");
    }

    const query = typeof body.query === "string" ? body.query.trim() : "";
    const sessionToken =
      typeof body.sessionToken === "string" && body.sessionToken.length > 0
        ? body.sessionToken
        : "";
    const regionCode =
      typeof body.regionCode === "string" && body.regionCode.length > 0
        ? body.regionCode.toUpperCase()
        : undefined;
    const languageCode =
      typeof body.languageCode === "string" && body.languageCode.length > 0
        ? body.languageCode.toLowerCase()
        : undefined;

    if (!query) {
      // Empty input is the natural "I haven't started typing" state —
      // return an empty list rather than a 400 so the picker can
      // render gracefully without special-casing the first render.
      return NextResponse.json({ suggestions: [] });
    }
    if (!sessionToken) {
      return badRequest("sessionToken is required");
    }

    const suggestions = await placeAutocomplete({
      query,
      sessionToken,
      regionCode,
      languageCode,
    });

    return NextResponse.json({ suggestions });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.places.autocomplete.error", err);
  }
}
