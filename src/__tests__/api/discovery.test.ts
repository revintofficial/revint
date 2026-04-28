import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/discovery/route";

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn().mockResolvedValue({
    user: { id: "test-user", email: "t@t.com", fullName: null, avatarUrl: null },
    workspaceId: "test-workspace",
    workspace: { id: "test-workspace", name: "Test", slug: "test", plan: "FREE" },
    role: "OWNER",
  }),
  UnauthorizedError: class UnauthorizedError extends Error {},
}));

vi.mock("@/lib/quotas", () => ({
  assertCanCreateLeads: vi.fn().mockResolvedValue(undefined),
  recordLeadsCreated: vi.fn().mockResolvedValue(undefined),
  QuotaExceededError: class QuotaExceededError extends Error {},
}));

vi.mock("@/lib/queues", () => ({
  getDiscoveryQueue: () => ({ add: vi.fn().mockResolvedValue(undefined) }),
}));

vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 10, limit: 10, resetSec: 60 }),
  rateLimitResponse: () => new Response(JSON.stringify({ error: "rate_limited" }), { status: 429 }),
  LIMITS: {
    discovery: { bucket: "disc", windowSec: 60, limit: 10 },
    analyze: { bucket: "ana", windowSec: 60, limit: 20 },
    websitePlan: { bucket: "plan", windowSec: 60, limit: 10 },
    websiteSearch: { bucket: "wsrch", windowSec: 60, limit: 15 },
    copilot: { bucket: "copi", windowSec: 60, limit: 30 },
    placesAutocomplete: { bucket: "pac", windowSec: 60, limit: 60 },
    placesDetails: { bucket: "pdet", windowSec: 60, limit: 30 },
  },
}));

// Geocoding always returns a fake lat/lng so the legacy free-text
// fallback path can be exercised without hitting Google.
vi.mock("@/lib/geocoding", () => ({
  geocodeBorough: vi.fn().mockResolvedValue({ lat: 51.4826, lng: 0.0077 }),
}));

// AI Core emit is fire-and-forget; mock to a noop so tests don't try
// to spin up Redis / Prisma sessions.
vi.mock("@/lib/ai-core/events", () => ({
  emit: vi.fn().mockResolvedValue(undefined),
}));

// Niches lookup needs a deterministic response. Default: route falls
// through to single-query mode (no fan-out).
vi.mock("@/lib/niches", () => ({
  getNicheBySlug: vi.fn(() => null),
  getChildrenOf: vi.fn(() => []),
  isParentNiche: vi.fn(() => false),
}));

const mockPlaces = [
  {
    id: "ChIJ_test_place_1",
    displayName: { text: "Phone Fix Express", languageCode: "en" },
    formattedAddress: "10 High Street, Greenwich, London SE10 8JA, UK",
    websiteUri: "https://phonefixexpress.co.uk",
    googleMapsUri: "https://maps.google.com/?cid=123",
    nationalPhoneNumber: "020 1234 5678",
    rating: 4.6,
    userRatingCount: 95,
    businessStatus: "OPERATIONAL",
    primaryType: "electronics_store",
  },
  {
    id: "ChIJ_test_place_2",
    displayName: { text: "Mobile Doctor", languageCode: "en" },
    formattedAddress: "25 Park Road, Greenwich, London SE10 9NW, UK",
    websiteUri: null,
    googleMapsUri: "https://maps.google.com/?cid=456",
    nationalPhoneNumber: "020 8765 4321",
    rating: 3.9,
    userRatingCount: 32,
    businessStatus: "OPERATIONAL",
    primaryType: "store",
  },
];

const mockDiscoverLeads = vi.fn();
const mockFindUnique = vi.fn();
const mockCreate = vi.fn();

vi.mock("@/lib/google-places", () => ({
  discoverLeads: (...args: unknown[]) => mockDiscoverLeads(...args),
  extractBoroughFromAddress: (addr: string) => {
    if (addr.toLowerCase().includes("greenwich")) return "Greenwich";
    if (addr.toLowerCase().includes("camden")) return "Camden";
    return null;
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
    workspace: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ country: "GB", targetSubNiches: [] }),
    },
  },
}));

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/discovery", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/discovery POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockDiscoverLeads.mockResolvedValue(mockPlaces);
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "new-lead-id" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("requires either locations[] or boroughName", async () => {
    const res = await POST(makeRequest({}));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("locations[] or boroughName is required");
  });

  it("accepts unknown borough and proceeds with the search (lat/lng falls back to 0,0)", async () => {
    // Route no longer rejects unknown boroughs — it falls back to lat:0,lng:0
    // so existing custom-city workflows keep working.
    const res = await POST(
      makeRequest({ searchQuery: "phone repair", boroughName: "FakeBorough" })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDiscoverLeads).toHaveBeenCalledWith(
      "phone repair",
      expect.objectContaining({ name: "FakeBorough" }),
      expect.any(Number),
    );
  });

  it("calls discoverLeads with correct query and borough", async () => {
    await POST(
      makeRequest({ searchQuery: "phone repair", boroughName: "Greenwich" })
    );

    expect(mockDiscoverLeads).toHaveBeenCalledWith(
      "phone repair",
      expect.objectContaining({ name: "Greenwich", lat: 51.4826, lng: 0.0077 }),
      5000
    );
  });

  it("creates new leads and skips existing ones", async () => {
    mockFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "existing" });

    const res = await POST(
      makeRequest({ searchQuery: "phone repair", boroughName: "Greenwich" })
    );
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.created).toBe(1);
    expect(data.skipped).toBe(1);
    expect(data.total).toBe(2);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("creates lead with correct data structure", async () => {
    mockFindUnique.mockResolvedValue(null);

    await POST(
      makeRequest({ searchQuery: "phone repair", boroughName: "Greenwich" })
    );

    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.data).toMatchObject({
      placeId: "ChIJ_test_place_1",
      businessName: "Phone Fix Express",
      formattedAddress: expect.stringContaining("Greenwich"),
      borough: "Greenwich",
      hasWebsite: true,
      websiteUrl: "https://phonefixexpress.co.uk",
      crawlStatus: "PENDING",
    });
  });

  it("sets crawlStatus to NO_WEBSITE when no websiteUri", async () => {
    mockDiscoverLeads.mockResolvedValue([mockPlaces[1]]);
    mockFindUnique.mockResolvedValue(null);

    await POST(
      makeRequest({ searchQuery: "phone repair", boroughName: "Greenwich" })
    );

    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.data.crawlStatus).toBe("NO_WEBSITE");
    expect(createCall.data.hasWebsite).toBe(false);
  });

  it("returns success response for single discovery", async () => {
    mockFindUnique.mockResolvedValue(null);

    const res = await POST(
      makeRequest({ searchQuery: "phone repair", boroughName: "Greenwich" })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toMatchObject({
      success: true,
      created: expect.any(Number),
      skipped: expect.any(Number),
      total: expect.any(Number),
    });
  });

  it("handles Google Places API returning empty results", async () => {
    mockDiscoverLeads.mockResolvedValue([]);

    const res = await POST(
      makeRequest({ searchQuery: "nonexistent business", boroughName: "Greenwich" })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.created).toBe(0);
    expect(data.skipped).toBe(0);
    expect(data.total).toBe(0);
  });

  it("handles Google Places API error gracefully", async () => {
    mockDiscoverLeads.mockRejectedValue(
      new Error("Google Places API aktif degil. Google Cloud Console'dan 'Places API (New)' servisini etkinlestirin.")
    );

    const res = await POST(
      makeRequest({ searchQuery: "phone repair", boroughName: "Greenwich" })
    );
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toContain("Places API");
  });

  it("skips places without id", async () => {
    mockDiscoverLeads.mockResolvedValue([
      { ...mockPlaces[0], id: undefined },
      mockPlaces[1],
    ]);
    mockFindUnique.mockResolvedValue(null);

    const res = await POST(
      makeRequest({ searchQuery: "phone repair", boroughName: "Greenwich" })
    );
    const data = await res.json();

    expect(data.created).toBe(1);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("uses custom radiusMeters when provided", async () => {
    await POST(
      makeRequest({
        searchQuery: "phone repair",
        boroughName: "Greenwich",
        radiusMeters: 10000,
      })
    );

    expect(mockDiscoverLeads).toHaveBeenCalledWith(
      "phone repair",
      expect.any(Object),
      10000
    );
  });

  describe("runAll (bulk discovery)", () => {
    // Bulk discovery was converted to the worker queue - the HTTP handler
    // now enqueues 15 jobs (5 boroughs x 3 queries) and returns 202 instead
    // of running the search inline.
    it("enqueues 15 jobs and returns 202 without calling discoverLeads inline", async () => {
      mockDiscoverLeads.mockResolvedValue([]);

      const res = await POST(makeRequest({ runAll: true }));
      const data = await res.json();

      expect(res.status).toBe(202);
      expect(data.success).toBe(true);
      expect(data.enqueued).toBe(15);
      expect(data.jobs).toHaveLength(15);
      for (const job of data.jobs) {
        // The bulk route enqueues `{ city, query }` jobs.
        expect(job).toHaveProperty("city");
        expect(job).toHaveProperty("query");
      }
      expect(mockDiscoverLeads).not.toHaveBeenCalled();
    });

    it("continues enqueuing even if one borough-query combo would have failed", async () => {
      let callCount = 0;
      mockDiscoverLeads.mockImplementation(() => {
        callCount++;
        if (callCount === 3) throw new Error("API rate limit");
        return Promise.resolve([]);
      });

      const res = await POST(makeRequest({ runAll: true }));
      const data = await res.json();

      expect(res.status).toBe(202);
      expect(data.success).toBe(true);
      expect(data.enqueued).toBe(15);
    });
  });

  describe("locations[] (LocationPicker path)", () => {
    const buyukcekmece = {
      placeId: "ChIJ_buyukcekmece",
      displayName: "Büyükçekmece, Istanbul, Türkiye",
      primaryText: "Büyükçekmece",
      secondaryText: "Istanbul, Türkiye",
      lat: 41.020,
      lng: 28.595,
      viewport: {
        ne: { lat: 41.07, lng: 28.7 },
        sw: { lat: 40.97, lng: 28.5 },
      },
      countryCode: "TR",
    };
    const beylikduzu = {
      placeId: "ChIJ_beylikduzu",
      displayName: "Beylikdüzü, Istanbul, Türkiye",
      primaryText: "Beylikdüzü",
      secondaryText: "Istanbul, Türkiye",
      lat: 41.0,
      lng: 28.65,
      viewport: {
        ne: { lat: 41.04, lng: 28.7 },
        sw: { lat: 40.98, lng: 28.6 },
      },
      countryCode: "TR",
    };

    it("forwards picked viewport into discoverLeads as a hard restriction signal", async () => {
      await POST(
        makeRequest({
          searchQuery: "specialty coffee shop",
          locations: [buyukcekmece],
        }),
      );

      expect(mockDiscoverLeads).toHaveBeenCalledTimes(1);
      const [, locArg] = mockDiscoverLeads.mock.calls[0];
      expect(locArg).toMatchObject({
        name: "Büyükçekmece, Istanbul, Türkiye",
        country: "TR",
        lat: 41.02,
        lng: 28.595,
      });
      expect(locArg.viewport).toMatchObject({
        ne: { lat: 41.07, lng: 28.7 },
        sw: { lat: 40.97, lng: 28.5 },
      });
    });

    it("loops over multiple picked locations and dedups by Place ID across all", async () => {
      // Same place returned by both locations — dedup must keep one.
      mockDiscoverLeads.mockResolvedValue([mockPlaces[0]]);
      mockFindUnique.mockResolvedValue(null);

      const res = await POST(
        makeRequest({
          searchQuery: "specialty coffee shop",
          locations: [buyukcekmece, beylikduzu],
        }),
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(mockDiscoverLeads).toHaveBeenCalledTimes(2);
      // Total raw = 2 × 1 = 2, deduped = 1, created = 1.
      expect(data.created).toBe(1);
      expect(data.total).toBe(1);
      expect(data.locationCount).toBe(2);
    });

    it("stamps the picked place's id onto Lead.sourceQuery for analytics", async () => {
      mockFindUnique.mockResolvedValue(null);

      await POST(
        makeRequest({
          searchQuery: "specialty coffee shop",
          locations: [buyukcekmece],
        }),
      );

      const createCall = mockCreate.mock.calls[0][0];
      expect(createCall.data.sourceQuery).toContain("ChIJ_buyukcekmece");
      expect(createCall.data.sourceQuery).toContain("Büyükçekmece");
    });

    it("rejects more than 5 picked locations", async () => {
      const six = Array.from({ length: 6 }, (_, i) => ({
        ...buyukcekmece,
        placeId: `ChIJ_loc_${i}`,
      }));

      const res = await POST(
        makeRequest({ searchQuery: "specialty coffee shop", locations: six }),
      );
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toMatch(/Too many locations/);
    });

    it("falls back to boroughName + geocode when locations[] is empty", async () => {
      const res = await POST(
        makeRequest({
          searchQuery: "phone repair",
          boroughName: "Greenwich",
          locations: [],
        }),
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockDiscoverLeads).toHaveBeenCalledWith(
        "phone repair",
        expect.objectContaining({ name: "Greenwich" }),
        5000,
      );
    });

    it("ignores malformed location entries silently and falls back to boroughName when none remain", async () => {
      const res = await POST(
        makeRequest({
          searchQuery: "phone repair",
          boroughName: "Greenwich",
          // Mix of invalid shapes — none satisfy isPickedLocation.
          locations: [{ foo: "bar" }, null, { placeId: "" }],
        }),
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      // Falls through to the legacy borough path.
      expect(mockDiscoverLeads).toHaveBeenCalledWith(
        "phone repair",
        expect.objectContaining({ name: "Greenwich" }),
        5000,
      );
    });
  });
});
