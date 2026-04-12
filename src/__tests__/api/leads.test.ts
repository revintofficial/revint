import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/leads/route";

const mockLeads = [
  {
    id: "1",
    placeId: "place_1",
    businessName: "Fix My Phone London",
    formattedAddress: "123 High Street, Greenwich, London",
    borough: "Greenwich",
    phone: "+44 20 1234 5678",
    websiteUrl: "https://fixmyphone.co.uk",
    hasWebsite: true,
    rating: 4.5,
    reviewCount: 120,
    crawlStatus: "CRAWLED",
    analyzeStatus: "ANALYZED",
    websiteAudit: null,
    salesOpportunity: null,
  },
  {
    id: "2",
    placeId: "place_2",
    businessName: "Quick Repair Shop",
    formattedAddress: "456 Market Rd, Camden, London",
    borough: "Camden",
    phone: "+44 20 9876 5432",
    websiteUrl: null,
    hasWebsite: false,
    rating: 3.8,
    reviewCount: 45,
    crawlStatus: "NO_WEBSITE",
    analyzeStatus: "PENDING",
    websiteAudit: null,
    salesOpportunity: null,
  },
  {
    id: "3",
    placeId: "place_3",
    businessName: "Samsung Galaxy Repair Centre",
    formattedAddress: "789 Broadway, Westminster, London",
    borough: "Westminster",
    phone: null,
    websiteUrl: "https://galaxyrepair.uk",
    hasWebsite: true,
    rating: 4.2,
    reviewCount: 89,
    crawlStatus: "PENDING",
    analyzeStatus: "PENDING",
    websiteAudit: null,
    salesOpportunity: {
      opportunityScore: 72,
      status: "NEW",
      suggestedOffer: "GROWTH",
    },
  },
];

const mockFindMany = vi.fn();
const mockCount = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
  },
}));

function makeRequest(params: Record<string, string> = {}): Request {
  const url = new URL("http://localhost:3000/api/leads");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new Request(url.toString());
}

describe("/api/leads GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue(mockLeads);
    mockCount.mockResolvedValue(mockLeads.length);
  });

  it("returns all leads without filters", async () => {
    const res = await GET(makeRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.leads).toHaveLength(3);
    expect(data.pagination.total).toBe(3);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        skip: 0,
        take: 20,
      })
    );
  });

  it("passes search filter with OR conditions for businessName, address, phone", async () => {
    mockFindMany.mockResolvedValue([mockLeads[0]]);
    mockCount.mockResolvedValue(1);

    const res = await GET(makeRequest({ search: "Fix My Phone" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.leads).toHaveLength(1);

    const calledWhere = mockFindMany.mock.calls[0][0].where;
    expect(calledWhere.OR).toBeDefined();
    expect(calledWhere.OR).toHaveLength(3);
    expect(calledWhere.OR[0]).toEqual({
      businessName: { contains: "Fix My Phone", mode: "insensitive" },
    });
    expect(calledWhere.OR[1]).toEqual({
      formattedAddress: { contains: "Fix My Phone", mode: "insensitive" },
    });
    expect(calledWhere.OR[2]).toEqual({
      phone: { contains: "Fix My Phone" },
    });
  });

  it("search is case-insensitive for businessName and address", async () => {
    mockFindMany.mockResolvedValue([mockLeads[0]]);
    mockCount.mockResolvedValue(1);

    await GET(makeRequest({ search: "fix my phone" }));

    const calledWhere = mockFindMany.mock.calls[0][0].where;
    expect(calledWhere.OR[0].businessName.mode).toBe("insensitive");
    expect(calledWhere.OR[1].formattedAddress.mode).toBe("insensitive");
  });

  it("applies borough filter correctly", async () => {
    mockFindMany.mockResolvedValue([mockLeads[0]]);
    mockCount.mockResolvedValue(1);

    await GET(makeRequest({ borough: "Greenwich" }));

    const calledWhere = mockFindMany.mock.calls[0][0].where;
    expect(calledWhere.borough).toBe("Greenwich");
  });

  it("ignores borough=all", async () => {
    await GET(makeRequest({ borough: "all" }));

    const calledWhere = mockFindMany.mock.calls[0][0].where;
    expect(calledWhere.borough).toBeUndefined();
  });

  it("combines search with borough filter", async () => {
    mockFindMany.mockResolvedValue([mockLeads[0]]);
    mockCount.mockResolvedValue(1);

    await GET(makeRequest({ search: "phone", borough: "Greenwich" }));

    const calledWhere = mockFindMany.mock.calls[0][0].where;
    expect(calledWhere.borough).toBe("Greenwich");
    expect(calledWhere.OR).toBeDefined();
    expect(calledWhere.OR[0].businessName.contains).toBe("phone");
  });

  it("applies hasWebsite=true filter", async () => {
    mockFindMany.mockResolvedValue([mockLeads[0], mockLeads[2]]);
    mockCount.mockResolvedValue(2);

    await GET(makeRequest({ hasWebsite: "true" }));

    const calledWhere = mockFindMany.mock.calls[0][0].where;
    expect(calledWhere.hasWebsite).toBe(true);
  });

  it("applies hasWebsite=false filter", async () => {
    mockFindMany.mockResolvedValue([mockLeads[1]]);
    mockCount.mockResolvedValue(1);

    await GET(makeRequest({ hasWebsite: "false" }));

    const calledWhere = mockFindMany.mock.calls[0][0].where;
    expect(calledWhere.hasWebsite).toBe(false);
  });

  it("paginates correctly (page 2)", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(25);

    const res = await GET(makeRequest({ page: "2", limit: "10" }));
    const data = await res.json();

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
      })
    );
    expect(data.pagination.page).toBe(2);
    expect(data.pagination.totalPages).toBe(3);
  });

  it("search on page 1 should not miss results", async () => {
    mockFindMany.mockResolvedValue([mockLeads[0]]);
    mockCount.mockResolvedValue(1);

    const res = await GET(makeRequest({ search: "Fix", page: "1" }));
    const data = await res.json();

    expect(data.leads).toHaveLength(1);
    expect(data.pagination.total).toBe(1);
    expect(data.pagination.page).toBe(1);
  });

  it("search on non-existent page returns empty leads", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(1);

    const res = await GET(makeRequest({ search: "Fix", page: "5" }));
    const data = await res.json();

    expect(data.leads).toHaveLength(0);
    expect(data.pagination.total).toBe(1);
    expect(data.pagination.page).toBe(5);
  });

  it("applies status filter via salesOpportunity relation", async () => {
    mockFindMany.mockResolvedValue([mockLeads[2]]);
    mockCount.mockResolvedValue(1);

    await GET(makeRequest({ status: "new" }));

    const calledWhere = mockFindMany.mock.calls[0][0].where;
    expect(calledWhere.salesOpportunity).toEqual({ status: "NEW" });
  });

  it("applies minScore / maxScore filter", async () => {
    mockFindMany.mockResolvedValue([mockLeads[2]]);
    mockCount.mockResolvedValue(1);

    await GET(makeRequest({ minScore: "50", maxScore: "80" }));

    const calledWhere = mockFindMany.mock.calls[0][0].where;
    expect(calledWhere.salesOpportunity.opportunityScore).toEqual({
      gte: 50,
      lte: 80,
    });
  });

  it("returns 500 on database error", async () => {
    mockFindMany.mockRejectedValue(new Error("DB connection lost"));
    mockCount.mockRejectedValue(new Error("DB connection lost"));

    const res = await GET(makeRequest({ search: "test" }));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Failed to fetch leads");
  });

  it("applies sorting correctly", async () => {
    await GET(makeRequest({ sortBy: "rating", sortOrder: "asc" }));

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { rating: "asc" },
      })
    );
  });

  it("empty search string should not add OR filter", async () => {
    await GET(makeRequest({ search: "" }));

    const calledWhere = mockFindMany.mock.calls[0][0].where;
    expect(calledWhere.OR).toBeUndefined();
  });
});
