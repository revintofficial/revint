import { NextResponse } from "next/server";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { checkRateLimit, LIMITS, rateLimitResponse } from "@/lib/ratelimit";
import { placeDetails } from "@/lib/places-autocomplete";
import { internalError, badRequest } from "@/lib/api-errors";

/**
 * Proxy for Google Place Details (New). Called once per picked
 * suggestion to fetch the place's viewport + lat/lng + country code,
 * which the picker then ships into /api/discovery as a
 * `PickedLocation`.
 *
 * Closing the autocomplete session: passing the same `sessionToken`
 * the picker used while typing tells Google "this Details call
 * concludes the autocomplete session", and the whole session bills
 * as one event. After this call returns the client must rotate to a
 * new session token before typing again.
 *
 * Returns 404 when Google can't resolve the place id (rare — usually
 * means the suggestion was stale or the id was tampered with).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { workspaceId } = await requireUser();

    const rl = await checkRateLimit(workspaceId, LIMITS.placesDetails);
    if (!rl.ok) return rateLimitResponse(rl);

    let body: { placeId?: unknown; sessionToken?: unknown } = {};
    try {
      body = await request.json();
    } catch {
      return badRequest("Invalid JSON body");
    }

    const placeId = typeof body.placeId === "string" ? body.placeId.trim() : "";
    const sessionToken =
      typeof body.sessionToken === "string" && body.sessionToken.length > 0
        ? body.sessionToken
        : "";

    if (!placeId) return badRequest("placeId is required");
    if (!sessionToken) return badRequest("sessionToken is required");

    const picked = await placeDetails(placeId, sessionToken);
    if (!picked) {
      return NextResponse.json(
        { error: "Place not found or details unavailable" },
        { status: 404 },
      );
    }

    return NextResponse.json({ location: picked });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return internalError("api.places.details.error", err);
  }
}
