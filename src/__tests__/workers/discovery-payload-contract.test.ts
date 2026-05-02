/**
 * H7 regression - bulk discovery enqueues `{ city, country }` while the
 * legacy per-borough path enqueues `{ borough: { name, lat, lng } }`.
 * The worker used to crash on the bulk shape because it assumed
 * `borough` was always present. After H7, the worker accepts EITHER
 * shape and resolves city -> coords via geocodeBorough at job entry.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const geocodeMock = vi.fn();
vi.mock("@/lib/geocoding", () => ({
  geocodeBorough: (...args: unknown[]) => geocodeMock(...args),
}));

import { resolveBorough } from "@/workers/discovery-worker";

describe("discovery worker - H7 payload union", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the borough as-is when the legacy borough shape is supplied", async () => {
    const result = await resolveBorough({
      workspaceId: "ws_h7",
      searchQuery: "phone repair",
      borough: { name: "Greenwich", lat: 51.4826, lng: 0.0077 },
    });
    expect(result).toEqual({ name: "Greenwich", lat: 51.4826, lng: 0.0077 });
    expect(geocodeMock).not.toHaveBeenCalled();
  });

  it("geocodes the city when the bulk shape is supplied", async () => {
    geocodeMock.mockResolvedValueOnce({ lat: 51.5074, lng: -0.1278 });
    const result = await resolveBorough({
      workspaceId: "ws_h7",
      searchQuery: "phone repair",
      city: "London",
      country: "GB",
    });
    expect(result).toEqual({ name: "London", lat: 51.5074, lng: -0.1278 });
    expect(geocodeMock).toHaveBeenCalledWith("London", "GB");
  });

  it("falls back to zero coords when the geocoder returns null for a city", async () => {
    // Worker degrades to textQuery-only Places search instead of
    // failing the whole job on a geocoding miss.
    geocodeMock.mockResolvedValueOnce(null);
    const result = await resolveBorough({
      workspaceId: "ws_h7",
      searchQuery: "phone repair",
      city: "Atlantis",
      country: "GB",
    });
    expect(result).toEqual({ name: "Atlantis", lat: 0, lng: 0 });
  });

  it("swallows geocoder errors and falls back to zero coords (job must not crash)", async () => {
    geocodeMock.mockRejectedValueOnce(new Error("geocoder 500"));
    const result = await resolveBorough({
      workspaceId: "ws_h7",
      searchQuery: "phone repair",
      city: "Manchester",
    });
    expect(result.name).toBe("Manchester");
    expect(result.lat).toBe(0);
    expect(result.lng).toBe(0);
  });
});
