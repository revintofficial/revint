import { describe, it, expect, vi, beforeEach } from "vitest";

// Auth and rate limit mocks shared across both routes. requireUser
// always succeeds; rate limit always passes — these aren't what we're
// testing here.
vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn().mockResolvedValue({
    user: { id: "test-user", email: "t@t.com", fullName: null, avatarUrl: null },
    workspaceId: "test-workspace",
    workspace: { id: "test-workspace", name: "Test", slug: "test", plan: "FREE" },
    role: "OWNER",
  }),
  UnauthorizedError: class UnauthorizedError extends Error {},
}));

vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: vi
    .fn()
    .mockResolvedValue({ ok: true, remaining: 60, limit: 60, resetSec: 60 }),
  rateLimitResponse: () =>
    new Response(JSON.stringify({ error: "rate_limited" }), { status: 429 }),
  LIMITS: {
    placesAutocomplete: { bucket: "pac", windowSec: 60, limit: 60 },
    placesDetails: { bucket: "pdet", windowSec: 60, limit: 30 },
  },
}));

const mockAutocomplete = vi.fn();
const mockDetails = vi.fn();
vi.mock("@/lib/places-autocomplete", () => ({
  placeAutocomplete: (...args: unknown[]) => mockAutocomplete(...args),
  placeDetails: (...args: unknown[]) => mockDetails(...args),
}));

// Import AFTER the vi.mock calls so the routes pick up the mocks.
import { POST as autocompletePOST } from "@/app/api/places/autocomplete/route";
import { POST as detailsPOST } from "@/app/api/places/details/route";

function jsonReq(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/places/autocomplete POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires a sessionToken", async () => {
    const res = await autocompletePOST(
      jsonReq("http://localhost/api/places/autocomplete", {
        query: "büyükçekmece",
      }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("sessionToken");
  });

  it("returns empty suggestions for an empty query (graceful no-op)", async () => {
    const res = await autocompletePOST(
      jsonReq("http://localhost/api/places/autocomplete", {
        query: "",
        sessionToken: "tok-1",
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.suggestions).toEqual([]);
    // Helper not even called — empty input short-circuits in the route.
    expect(mockAutocomplete).not.toHaveBeenCalled();
  });

  it("forwards regionCode + languageCode + token to the helper", async () => {
    mockAutocomplete.mockResolvedValue([
      {
        placeId: "ChIJ_b",
        primaryText: "Büyükçekmece",
        secondaryText: "Istanbul, Türkiye",
        fullText: "Büyükçekmece, Istanbul, Türkiye",
        types: ["administrative_area_level_2"],
      },
    ]);

    const res = await autocompletePOST(
      jsonReq("http://localhost/api/places/autocomplete", {
        query: "büyükç",
        sessionToken: "tok-2",
        regionCode: "tr",
        languageCode: "TR",
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.suggestions).toHaveLength(1);
    expect(mockAutocomplete).toHaveBeenCalledWith({
      query: "büyükç",
      sessionToken: "tok-2",
      regionCode: "TR",
      languageCode: "tr",
    });
  });
});

describe("/api/places/details POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires a placeId and sessionToken", async () => {
    const res1 = await detailsPOST(
      jsonReq("http://localhost/api/places/details", { sessionToken: "tok-1" }),
    );
    expect(res1.status).toBe(400);
    const res2 = await detailsPOST(
      jsonReq("http://localhost/api/places/details", { placeId: "ChIJ_x" }),
    );
    expect(res2.status).toBe(400);
  });

  it("returns 404 when the helper resolves null", async () => {
    mockDetails.mockResolvedValue(null);

    const res = await detailsPOST(
      jsonReq("http://localhost/api/places/details", {
        placeId: "ChIJ_unknown",
        sessionToken: "tok-3",
      }),
    );
    expect(res.status).toBe(404);
  });

  it("returns the resolved location with a viewport", async () => {
    const picked = {
      placeId: "ChIJ_b",
      displayName: "Büyükçekmece, Istanbul, Türkiye",
      primaryText: "Büyükçekmece",
      secondaryText: "Istanbul, Türkiye",
      lat: 41.02,
      lng: 28.6,
      viewport: {
        ne: { lat: 41.07, lng: 28.7 },
        sw: { lat: 40.97, lng: 28.5 },
      },
      countryCode: "TR",
    };
    mockDetails.mockResolvedValue(picked);

    const res = await detailsPOST(
      jsonReq("http://localhost/api/places/details", {
        placeId: "ChIJ_b",
        sessionToken: "tok-4",
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.location).toEqual(picked);
    expect(mockDetails).toHaveBeenCalledWith("ChIJ_b", "tok-4");
  });
});
