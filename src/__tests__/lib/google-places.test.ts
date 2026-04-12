import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  textSearch,
  discoverLeads,
  extractBoroughFromAddress,
} from "@/lib/google-places";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const MOCK_API_KEY = "test-api-key-12345";

describe("google-places lib", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubEnv("GOOGLE_PLACES_API_KEY", MOCK_API_KEY);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("textSearch", () => {
    it("sends correct request to Google Places API", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ places: [] }),
      });

      await textSearch({
        textQuery: "phone repair in Greenwich London",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://places.googleapis.com/v1/places:searchText",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "X-Goog-Api-Key": MOCK_API_KEY,
            "Content-Type": "application/json",
          }),
        })
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.textQuery).toBe("phone repair in Greenwich London");
      expect(body.languageCode).toBe("en");
      expect(body.maxResultCount).toBe(20);
    });

    it("includes locationBias when provided", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ places: [] }),
      });

      await textSearch({
        textQuery: "phone repair in Greenwich London",
        locationBias: {
          circle: {
            center: { latitude: 51.4826, longitude: 0.0077 },
            radius: 5000,
          },
        },
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.locationBias).toBeDefined();
      expect(body.locationBias.circle.center.latitude).toBe(51.4826);
    });

    it("includes pageToken for pagination", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ places: [] }),
      });

      await textSearch(
        { textQuery: "phone repair in Greenwich London" },
        "next_page_token_abc"
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.pageToken).toBe("next_page_token_abc");
    });

    it("throws on non-OK response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve("Quota exceeded"),
      });

      await expect(
        textSearch({ textQuery: "phone repair in Greenwich London" })
      ).rejects.toThrow("Places API error (403)");
    });

    it("throws when API key is missing", async () => {
      vi.stubEnv("GOOGLE_PLACES_API_KEY", "");

      await expect(
        textSearch({ textQuery: "phone repair" })
      ).rejects.toThrow("GOOGLE_PLACES_API_KEY is not set");
    });

    it("includes correct field mask header", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ places: [] }),
      });

      await textSearch({ textQuery: "phone repair" });

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers["X-Goog-FieldMask"]).toContain("places.id");
      expect(headers["X-Goog-FieldMask"]).toContain("places.displayName");
      expect(headers["X-Goog-FieldMask"]).toContain("places.websiteUri");
      expect(headers["X-Goog-FieldMask"]).toContain("places.nationalPhoneNumber");
    });
  });

  describe("discoverLeads", () => {
    const borough = { name: "Greenwich", lat: 51.4826, lng: 0.0077 };

    it("constructs correct textQuery", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ places: [] }),
      });

      await discoverLeads("phone repair", borough);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.textQuery).toBe("phone repair in Greenwich London");
    });

    it("uses locationBias with borough coordinates", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ places: [] }),
      });

      await discoverLeads("phone repair", borough, 3000);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.locationBias.circle.center.latitude).toBe(51.4826);
      expect(body.locationBias.circle.center.longitude).toBe(0.0077);
      expect(body.locationBias.circle.radius).toBe(3000);
    });

    it("returns all places from single page", async () => {
      const places = [
        { id: "p1", displayName: { text: "Shop 1" } },
        { id: "p2", displayName: { text: "Shop 2" } },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ places }),
      });

      const result = await discoverLeads("phone repair", borough);
      expect(result).toHaveLength(2);
    });

    it("paginates up to 3 pages", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              places: [{ id: "p1" }],
              nextPageToken: "token_page2",
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              places: [{ id: "p2" }],
              nextPageToken: "token_page3",
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              places: [{ id: "p3" }],
            }),
        });

      const result = await discoverLeads("phone repair", borough);
      expect(result).toHaveLength(3);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("stops after 3 pages even if more tokens exist", async () => {
      for (let i = 0; i < 5; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              places: [{ id: `p${i}` }],
              nextPageToken: `token_${i + 1}`,
            }),
        });
      }

      const result = await discoverLeads("phone repair", borough);
      expect(result).toHaveLength(3);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("handles empty response (no places key)", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await discoverLeads("nonexistent service", borough);
      expect(result).toHaveLength(0);
    });

    it("handles empty places array", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ places: [] }),
      });

      const result = await discoverLeads("nonexistent service", borough);
      expect(result).toHaveLength(0);
    });

    it("propagates API errors", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve(JSON.stringify({ error: { message: "Rate limit exceeded" } })),
      });

      await expect(
        discoverLeads("phone repair", borough)
      ).rejects.toThrow("kota limiti");
    });
  });

  describe("extractBoroughFromAddress", () => {
    it("extracts Greenwich from address", () => {
      expect(
        extractBoroughFromAddress("10 High Street, Greenwich, London SE10 8JA")
      ).toBe("Greenwich");
    });

    it("extracts Camden from address", () => {
      expect(
        extractBoroughFromAddress("456 Market Rd, Camden, London NW1 3HP")
      ).toBe("Camden");
    });

    it("is case-insensitive", () => {
      expect(
        extractBoroughFromAddress("10 High St, GREENWICH, London")
      ).toBe("Greenwich");
    });

    it("returns null for unknown area", () => {
      expect(
        extractBoroughFromAddress("123 Some Road, UnknownPlace, UK")
      ).toBeNull();
    });

    it("maps Lambeth borough from address containing Lambeth", () => {
      expect(
        extractBoroughFromAddress("Shop near Lambeth, London")
      ).toBe("Lambeth");
    });

    it("maps neighbourhood Brixton to Lambeth borough", () => {
      expect(
        extractBoroughFromAddress("45 Brixton Road, London SW9")
      ).toBe("Lambeth");
    });

    it("maps neighbourhood Shoreditch to Hackney borough", () => {
      expect(
        extractBoroughFromAddress("10 Shoreditch High St, London E1")
      ).toBe("Hackney");
    });

    it("maps neighbourhood Stratford to Newham borough", () => {
      expect(
        extractBoroughFromAddress("Stratford Centre, London E15")
      ).toBe("Newham");
    });

    it("maps neighbourhood Wimbledon to Merton borough", () => {
      expect(
        extractBoroughFromAddress("5 Wimbledon Hill Rd, London SW19")
      ).toBe("Merton");
    });

    it("handles empty string", () => {
      expect(extractBoroughFromAddress("")).toBeNull();
    });

    it("handles addresses with official borough name", () => {
      expect(
        extractBoroughFromAddress("Unit 5, Westminster Bridge Road, Westminster, London")
      ).toBe("Westminster");
    });

    it("handles Tower Hamlets multi-word borough", () => {
      expect(
        extractBoroughFromAddress("12 Mile End Rd, Tower Hamlets, London E1")
      ).toBe("Tower Hamlets");
    });
  });
});
