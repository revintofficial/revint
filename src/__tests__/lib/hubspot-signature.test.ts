import { afterEach, describe, expect, it, vi } from "vitest";

import {
  decodeHubspotRequestUri,
  verifyHubspotSignatureV2,
  verifyHubspotSignatureV3,
  verifyHubspotRequest,
} from "@/lib/integrations/hubspot/webhook";

describe("decodeHubspotRequestUri", () => {
  it("decodes HubSpot-listed percent-escapes", () => {
    expect(decodeHubspotRequestUri("https://app.revint.dev/api%2Fintegrations%2Fhubspot%2Fcard-data")).toBe(
      "https://app.revint.dev/api/integrations/hubspot/card-data",
    );
  });
});

describe("verifyHubspotSignatureV2", () => {
  it("matches HubSpot docs POST example", () => {
    const res = verifyHubspotSignatureV2({
      method: "POST",
      requestUrl: "https://www.example.com/webhook_uri",
      rawBody: '{"example_field":"example_value"}',
      signature: "9569219f8ba981ffa6f6f16aa0f48637d35d728c7e4d93d0d52efaa512af7900",
      clientSecret: "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy",
    });
    expect(res.valid).toBe(true);
  });
});

describe("verifyHubspotSignatureV3", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("matches HubSpot docs POST example", () => {
    const timestamp = "1752613922216";
    vi.spyOn(Date, "now").mockReturnValue(Number(timestamp) + 1000);
    const body =
      '[{"eventId":531833541,"subscriptionId":3923621,"portalId":48807704,"appId":16111050,"occurredAt":1752613920733,"subscriptionType":"contact.creation","attemptNumber":0,"objectId":138017612137,"changeFlag":"CREATED","changeSource":"CRM_UI","sourceId":"userId:76023669"}]';
    const res = verifyHubspotSignatureV3({
      method: "POST",
      requestUrl: "https://webhook.site/335453f5-94b3-49d9-b684-a55354d4b8df",
      rawBody: body,
      signature: "gbj1XPRvUt0noT7i7fXfTzOD4sLzQmf0VT28ZYq0EYg=",
      timestamp,
      clientSecret: "cfc68c0b-4b4e-4ef8-b764-95350e4ea479",
    });
    expect(res.valid).toBe(true);
  });

  it("accepts urlOverride when request.url differs (proxy drift)", () => {
    const timestamp = "1752613922216";
    vi.spyOn(Date, "now").mockReturnValue(Number(timestamp) + 1000);
    const body =
      '[{"eventId":531833541,"subscriptionId":3923621,"portalId":48807704,"appId":16111050,"occurredAt":1752613920733,"subscriptionType":"contact.creation","attemptNumber":0,"objectId":138017612137,"changeFlag":"CREATED","changeSource":"CRM_UI","sourceId":"userId:76023669"}]';
    const res = verifyHubspotSignatureV3({
      method: "POST",
      requestUrl: "http://internal.vercel.app/webhook",
      rawBody: body,
      signature: "gbj1XPRvUt0noT7i7fXfTzOD4sLzQmf0VT28ZYq0EYg=",
      timestamp,
      clientSecret: "cfc68c0b-4b4e-4ef8-b764-95350e4ea479",
      urlOverride: "https://webhook.site/335453f5-94b3-49d9-b684-a55354d4b8df",
    });
    expect(res.valid).toBe(true);
  });
});

describe("verifyHubspotRequest", () => {
  it("prefers v2 when signature-version is v2", () => {
    const res = verifyHubspotRequest({
      method: "POST",
      requestUrl: "https://www.example.com/webhook_uri",
      rawBody: '{"example_field":"example_value"}',
      clientSecret: "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy",
      signatureV3: "invalid-v3-signature",
      timestamp: String(Date.now()),
      signatureV2:
        "9569219f8ba981ffa6f6f16aa0f48637d35d728c7e4d93d0d52efaa512af7900",
      signatureVersion: "v2",
    });
    expect(res.valid).toBe(true);
  });
});
