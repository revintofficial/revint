/**
 * Revint Operational Intelligence — HubSpot App Card.
 *
 * Aksiyon-odaklı (decision + action focused) mini card embedded inside
 * HubSpot CRM record + preview placements. It answers one question
 * fast: "What do I do with this lead right now?"
 *
 * Mockup contract (do not bloat with secondary info):
 *
 *   🔵 Revint Operational Intelligence
 *   Status: HOT LEAD • 3 saat önce geldi   | Priority: Today #2
 *   🎯 Best Angle: Order & Pay
 *   📝 Pitch This: "..."
 *   ⚠️ Qualification Risk: High — Reason: DM ile temas yok, no-show riski
 *   ⚡ Next Action: Call today before 16:00
 *   [🔗 Open Revint Action Sheet]
 *
 * Data flow:
 *   - `hubspot.extend(...)` wires this React component into the
 *     `crm.record.tab` placement.
 *   - On mount we call `hubspot.fetch('/api/integrations/hubspot/card-data', …)`
 *     against the Revint Next.js backend. HubSpot signs the request with
 *     the v3 signature; the backend verifies it before reading any data.
 *   - The card stays render-only: no writes happen from this UI. SDR
 *     actions land on the Revint Action Sheet (deep link) where they
 *     fan out into HubSpot via the writeback pipeline.
 *
 * Constraints:
 *   - 15 s default hubspot.fetch timeout (one-shot, no chunking).
 *   - 1 MB request + response payload.
 *   - 20 concurrent requests per portal — we make exactly one per mount.
 */
import React, { useEffect, useState } from "react";
import {
  hubspot,
  Flex,
  Box,
  Text,
  Heading,
  Divider,
  Tag,
  Link,
  LoadingSpinner,
  EmptyState,
  ErrorState,
} from "@hubspot/ui-extensions";

// -------------------------------------------------------------------------
// Types (mirror the Revint card-data response — keep in sync with
// `src/app/api/integrations/hubspot/card-data/route.ts`).
// -------------------------------------------------------------------------

type Temperature = "HOT" | "WARM" | "COLD" | null;
type RiskLevel = "HIGH" | "MEDIUM" | "LOW" | null;

interface CardSignals {
  temperature: Temperature;
  salesConfidence: number | null;
  icpFitScore: number | null;
  stageKey: string | null;
  stageLabel: string | null;
  subNicheSlug: string | null;
  qualificationStatus: string | null;
  qualified: boolean;
  qualificationRisk: "low" | "medium" | "high" | null;
  qualificationRiskReason: string | null;
  noShowRisk: RiskLevel;
}

interface CardDecision {
  recommendedAngle: string | null;
  recommendedAngleKey: string | null;
  pitchThis: string | null;
  whatNotToPitch: string | null;
  nextBestAction: string | null;
  nextBestActionConfidence: number | null;
  timingWindowStart: string | null;
  timingWindowEnd: string | null;
  channel: string | null;
  evidenceSummary: string | null;
}

interface CardTiming {
  hoursSinceInbound: number | null;
  inboundReceivedAt: string | null;
  lastSyncedAt: string | null;
}

interface CardLead {
  id: string;
  businessName: string | null;
}

interface CardDataResponse {
  found: boolean;
  reason?: string;
  lead?: CardLead;
  actionSheetUrl?: string;
  timing?: CardTiming;
  signals?: CardSignals;
  decision?: CardDecision;
}

// Revint backend origin. `hubspot.fetch` runs inside HubSpot's sandboxed
// iframe — it has no page origin to resolve a relative path against, so the
// URL MUST be absolute and MUST match an entry in the app manifest's
// `permittedUrls.fetch`. A relative path here throws → the card renders
// "Couldn't reach Revint". Keep this in sync with
// `hubspot-app/src/app/app-hsmeta.json` → config.permittedUrls.fetch.
const REVINT_BASE_URL = "https://app.revint.dev";

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function temperatureToVariant(
  temp: Temperature,
): "danger" | "warning" | "info" | "default" {
  if (temp === "HOT") return "danger";
  if (temp === "WARM") return "warning";
  if (temp === "COLD") return "info";
  return "default";
}

function riskToVariant(
  risk: RiskLevel,
): "danger" | "warning" | "success" | "default" {
  if (risk === "HIGH") return "danger";
  if (risk === "MEDIUM") return "warning";
  if (risk === "LOW") return "success";
  return "default";
}

function formatAge(hoursSinceInbound: number | null): string | null {
  if (hoursSinceInbound == null) return null;
  if (hoursSinceInbound < 1) return "just now";
  if (hoursSinceInbound < 24) {
    return `${hoursSinceInbound}h ago`;
  }
  const days = Math.floor(hoursSinceInbound / 24);
  return `${days}d ago`;
}

// -------------------------------------------------------------------------
// Card body
// -------------------------------------------------------------------------

interface ExtensionContext {
  crm: {
    objectId: number | string;
    objectTypeId?: string;
    objectType?: string;
  };
}

interface FetchFn {
  (
    url: string,
    init?: { method?: string; body?: string; timeout?: number },
  ): Promise<{ status: number; body: CardDataResponse }>;
}

function RevintCard({
  context,
  fetchFn,
}: {
  context: ExtensionContext;
  fetchFn: FetchFn;
}) {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "empty"; reason: string }
    | { kind: "ready"; data: CardDataResponse }
  >({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    const objectId = String(context.crm.objectId);
    const objectType =
      context.crm.objectType?.toUpperCase() ??
      context.crm.objectTypeId?.toUpperCase() ??
      "CONTACT";

    fetchFn(`${REVINT_BASE_URL}/api/integrations/hubspot/card-data`, {
      method: "POST",
      body: JSON.stringify({ objectId, objectType }),
      timeout: 10_000,
    })
      .then((res) => {
        if (cancelled) return;
        if (res.status === 401) {
          setState({
            kind: "error",
            message:
              "Signature mismatch between HubSpot and Revint. Reconnect from Revint Settings → Integrations.",
          });
          return;
        }
        if (res.status >= 500) {
          setState({
            kind: "error",
            message: "Revint is temporarily unreachable. Try refreshing.",
          });
          return;
        }
        if (!res.body.found) {
          setState({
            kind: "empty",
            reason: res.body.reason ?? "not_linked",
          });
          return;
        }
        setState({ kind: "ready", data: res.body });
      })
      .catch(() => {
        if (cancelled) return;
        setState({
          kind: "error",
          message:
            "Couldn't reach Revint. Check the integration in Revint Settings.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [context.crm.objectId, context.crm.objectType, fetchFn]);

  if (state.kind === "loading") {
    return (
      <Flex direction="row" justify="center" align="center">
        <LoadingSpinner label="Loading Revint intelligence…" />
      </Flex>
    );
  }

  if (state.kind === "error") {
    return (
      <ErrorState title="Revint is unavailable" layout="vertical">
        <Text>{state.message}</Text>
      </ErrorState>
    );
  }

  if (state.kind === "empty") {
    const isNotLinked =
      state.reason === "lead_not_found" || state.reason === "not_linked";
    return (
      <EmptyState
        title={
          isNotLinked
            ? "Not yet on Revint"
            : "Revint workspace not connected"
        }
        layout="vertical"
      >
        <Text>
          {isNotLinked
            ? "Revint will pick this contact up on the next inbound webhook tick. New leads usually land within 60 seconds."
            : "Connect Revint to this HubSpot portal from Revint Settings → Integrations."}
        </Text>
      </EmptyState>
    );
  }

  const { data } = state;
  const signals = data.signals!;
  const decision = data.decision!;
  const timing = data.timing!;
  const lead = data.lead!;

  const age = formatAge(timing.hoursSinceInbound);

  return (
    <Flex direction="column" gap="md">
      {/* Header — title + temperature + age */}
      <Flex direction="row" justify="between" align="center" wrap="wrap">
        <Heading>Revint Operational Intelligence</Heading>
        <Flex direction="row" gap="xs" align="center">
          {signals.temperature && (
            <Tag variant={temperatureToVariant(signals.temperature)}>
              {signals.temperature} LEAD
            </Tag>
          )}
          {age && <Text variant="microcopy">{age}</Text>}
        </Flex>
      </Flex>

      {/* Sub-header: priority + stage */}
      <Flex direction="row" gap="lg" wrap="wrap">
        {signals.salesConfidence != null && (
          <Text format={{ fontWeight: "regular" }}>
            <Text inline format={{ color: "secondary" }}>
              Sales confidence:
            </Text>{" "}
            {signals.salesConfidence}/100
          </Text>
        )}
        {signals.stageLabel && (
          <Text format={{ fontWeight: "regular" }}>
            <Text inline format={{ color: "secondary" }}>
              Stage:
            </Text>{" "}
            {signals.stageLabel}
          </Text>
        )}
      </Flex>

      <Divider distance="xs" />

      {/* Best angle + pitch this */}
      {decision.recommendedAngle && (
        <Box>
          <Text format={{ fontWeight: "demibold" }}>
            🎯 Best Angle: {decision.recommendedAngle}
          </Text>
          {decision.pitchThis && (
            <Text variant="microcopy" format={{ color: "secondary" }}>
              {decision.pitchThis}
            </Text>
          )}
        </Box>
      )}

      {/* Qualification risk */}
      {signals.qualificationStatus && (
        <Box>
          <Flex direction="row" gap="xs" align="center" wrap="wrap">
            <Text format={{ fontWeight: "demibold" }}>
              ⚠️ Qualification:
            </Text>
            <Tag variant={riskToVariant(signals.noShowRisk)}>
              {signals.qualificationStatus}
            </Tag>
            {signals.noShowRisk && (
              <Tag variant={riskToVariant(signals.noShowRisk)}>
                No-show {signals.noShowRisk}
              </Tag>
            )}
          </Flex>
          {signals.qualificationRiskReason && (
            <Text variant="microcopy" format={{ color: "secondary" }}>
              {signals.qualificationRiskReason}
            </Text>
          )}
        </Box>
      )}

      {/* Next best action */}
      {decision.nextBestAction && (
        <Box>
          <Text format={{ fontWeight: "demibold" }}>⚡ Next Action</Text>
          <Text>{decision.nextBestAction}</Text>
        </Box>
      )}

      <Divider distance="xs" />

      {/* Open action sheet — deep link into Revint */}
      {data.actionSheetUrl && (
        <Link href={data.actionSheetUrl} external>
          🔗 Open Revint Action Sheet
          {lead.businessName ? ` for ${lead.businessName}` : ""}
        </Link>
      )}
    </Flex>
  );
}

// -------------------------------------------------------------------------
// Entry point — bind the component to HubSpot's extension runtime.
// -------------------------------------------------------------------------

hubspot.extend<"crm.record.tab">(({ context }) => {
  // Public app: backend lives on app.revint.dev, called via hubspot.fetch.
  // `hubspot.fetch` is provided as a global in the UI extensions runtime
  // and handles request signing automatically (HubSpot signs the request
  // with the public app's client secret server-side).
  const fetchFn: FetchFn = async (url, init) => {
    const res = await hubspot.fetch(url, {
      method: init?.method ?? "GET",
      body: init?.body,
      timeout: init?.timeout,
    });
    const body = (await res.json()) as CardDataResponse;
    return { status: res.status, body };
  };

  return <RevintCard context={context as ExtensionContext} fetchFn={fetchFn} />;
});
