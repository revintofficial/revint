/**
 * Revint · Lead Summary — HubSpot sidebar card.
 *
 * Extension point: crm.record.sidebar
 *
 * Layout (SDR-first, decision-only):
 *   1. Compact header row — leadTemperature tag + "Inbound age: 2h ago"
 *   2. Revint score — ScoreCircle + tier tag + data confidence tag
 *   3. "Why they're a fit" — SalesOpportunity.whyGoodTarget
 *   4. "Likely pain points" — SalesOpportunity.likelyPainPoints (≤ 3)
 *   5. "Open full analysis in Revint" button (iframe modal)
 *
 * Package hero, Head Agent copy, and the opening-line generator all live
 * in the Revint AI tab card to avoid duplication inside the record.
 */
import React, { useEffect, useState } from "react";
import {
  hubspot,
  Flex,
  Box,
  Text,
  Tag,
  Button,
  Alert,
  LoadingSpinner,
  EmptyState,
  ErrorState,
  ScoreCircle,
  Tile,
} from "@hubspot/ui-extensions";
import { REVINT_BASE_URL } from "./config";
import { strings as t, timeFormat } from "./locale";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CardSignals {
  temperature: "HOT" | "WARM" | "COLD" | null;
  salesConfidence: number | null;
  qualificationRisk: "low" | "medium" | "high" | null;
  qualificationRiskReason: string | null;
  subNicheSlug: string | null;
}

interface CardTiming {
  hoursSinceInbound: number | null;
}

interface CardFit {
  whyGoodTarget: string | null;
  painPoints: string[];
}

interface CardDataResponse {
  found: boolean;
  reason?: string;
  lead?: { id: string; businessName: string | null };
  signals?: CardSignals;
  timing?: CardTiming;
  fit?: CardFit;
  actionSheetUrl?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TierResult {
  label: string;
  variant: "danger" | "warning" | "success" | "default";
}

function deriveTier(score: number | null): TierResult {
  if (score == null) return { label: t.tierUnknown, variant: "default" };
  if (score <= 25) return { label: t.tierSuspect, variant: "danger" };
  if (score <= 50) return { label: t.tierDeveloping, variant: "warning" };
  if (score <= 75) return { label: t.tierTargetCandidate, variant: "success" };
  return { label: t.tierTarget, variant: "success" };
}

interface TrustResult {
  label: string;
  variant: "success" | "warning" | "danger" | "default";
  alertVariant: "warning" | "info" | "success" | "error";
}

function deriveTrust(risk: "low" | "medium" | "high" | null): TrustResult {
  if (risk === "low")
    return { label: t.trustHigh, variant: "success", alertVariant: "success" };
  if (risk === "medium")
    return { label: t.trustMedium, variant: "warning", alertVariant: "info" };
  if (risk === "high")
    return { label: t.trustLow, variant: "danger", alertVariant: "warning" };
  return { label: t.trustUnknown, variant: "default", alertVariant: "info" };
}

// Mirrors the tab card's `temperatureVariant` — inlined (not shared) because
// the tab card is off-limits for this change and the helper is three lines.
function temperatureVariant(
  temp: "HOT" | "WARM" | "COLD" | null,
): "error" | "warning" | "info" | "default" {
  if (temp === "HOT") return "error";
  if (temp === "WARM") return "warning";
  if (temp === "COLD") return "info";
  return "default";
}

// Tag.variant in @hubspot/ui-extensions v0.14.2 expects "error" where
// deriveTier/deriveTrust still return "danger". Normalise at the render
// site so both helpers can stay compatible with the rest of the card
// surface.
function normalizeTagVariant(
  v: "success" | "warning" | "danger" | "default",
): "success" | "warning" | "error" | "default" {
  return v === "danger" ? "error" : v;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ExtensionContext {
  portal?: { id: number | string };
  crm: {
    objectId: number | string;
    objectTypeId?: string;
    objectType?: string;
  };
}

interface FetchFn {
  (
    url: string,
    init?: {
      method?: string;
      body?: Record<string, unknown>;
      timeout?: number;
    },
  ): Promise<{ status: number; body: CardDataResponse }>;
}

interface CardActions {
  openIframeModal?: (payload: {
    uri: string;
    title?: string;
    width?: number;
    height?: number;
  }) => void;
}

function RevintLeadSummaryCard({
  context,
  fetchFn,
  actions,
}: {
  context: ExtensionContext;
  fetchFn: FetchFn;
  actions: CardActions;
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
    const portalId =
      context.portal?.id != null ? String(context.portal.id) : undefined;

    fetchFn(`${REVINT_BASE_URL}/api/integrations/hubspot/card-data`, {
      method: "POST",
      body: { objectId, objectType, portalId },
      timeout: 10_000,
    })
      .then((res) => {
        if (cancelled) return;
        if (res.status === 401) {
          setState({ kind: "error", message: t.errorSignatureMismatch });
          return;
        }
        if (res.status >= 500) {
          setState({ kind: "error", message: t.errorUnavailable });
          return;
        }
        if (!res.body.found) {
          setState({ kind: "empty", reason: res.body.reason ?? "not_linked" });
          return;
        }
        setState({ kind: "ready", data: res.body });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ kind: "error", message: t.errorCantReach });
      });

    return () => {
      cancelled = true;
    };
  }, [context.crm.objectId, context.crm.objectType, context.portal?.id]);

  // --- Loading ---
  if (state.kind === "loading") {
    return (
      <Flex direction="row" justify="center" align="center">
        <LoadingSpinner label={t.loadingSidebar} />
      </Flex>
    );
  }

  // --- Error ---
  if (state.kind === "error") {
    return (
      <ErrorState title={t.errorTitle} layout="vertical">
        <Text>{state.message}</Text>
      </ErrorState>
    );
  }

  // --- Empty / not linked ---
  if (state.kind === "empty") {
    const isNotLinked =
      state.reason === "lead_not_found" || state.reason === "not_linked";
    return (
      <EmptyState
        title={isNotLinked ? t.emptyNotInRevint : t.emptyPortalNotConnected}
        layout="vertical"
      >
        <Text>
          {isNotLinked ? t.emptyNotLinkedSidebar : t.emptyPortalInstructions}
        </Text>
      </EmptyState>
    );
  }

  const { data } = state;
  const signals = data.signals ?? {
    temperature: null,
    salesConfidence: null,
    qualificationRisk: null,
    qualificationRiskReason: null,
    subNicheSlug: null,
  };
  const fit = data.fit ?? { whyGoodTarget: null, painPoints: [] };
  const hoursSinceInbound = data.timing?.hoursSinceInbound ?? null;

  const tier = deriveTier(signals.salesConfidence);
  const trust = deriveTrust(signals.qualificationRisk);
  const showAlert = trust.label === t.trustLow || trust.label === t.trustMedium;
  const painPoints = fit.painPoints.slice(0, 3);

  return (
    <Flex direction="column" gap="md">

      {/* ── 1. Compact header row ───────────────────────────────────────── */}
      <Flex direction="row" align="center" wrap="wrap" gap="xs">
        {signals.temperature && (
          <Tag variant={temperatureVariant(signals.temperature)}>
            {signals.temperature}
          </Tag>
        )}
        <Text variant="microcopy" format={{ color: "secondary" }} inline>
          {t.inboundAge}: {timeFormat.inboundAge(hoursSinceInbound)}
        </Text>
      </Flex>

      {/* ── 2. Low-confidence alert (medium/low only) ───────────────────── */}
      {showAlert && (
        <Alert title={t.sidebarAlertLowConfidence} variant={trust.alertVariant}>
          {signals.qualificationRiskReason ?? t.sidebarAlertFallback}
        </Alert>
      )}

      {/* ── 3. Revint score — Score + Tier + Data confidence ───────────── */}
      <Tile compact>
        <Flex direction="row" justify="between" align="center" wrap="wrap" gap="sm">
          <Flex direction="column" align="center" gap="xs">
            <ScoreCircle score={signals.salesConfidence ?? 0} />
            <Text variant="microcopy" format={{ color: "secondary" }}>
              {t.revintScoreLabel}
            </Text>
          </Flex>
          <Flex direction="column" gap="xs" align="end">
            <Tag variant={normalizeTagVariant(tier.variant)}>{tier.label}</Tag>
            <Flex direction="row" gap="xs" align="center" wrap="wrap">
              <Text variant="microcopy" format={{ color: "secondary" }} inline>
                {t.dataConfidenceUpper}
              </Text>
              <Tag variant={normalizeTagVariant(trust.variant)}>{trust.label}</Tag>
            </Flex>
          </Flex>
        </Flex>
      </Tile>

      {/* ── 4. Why they're a fit ────────────────────────────────────────── */}
      <Box>
        <Text format={{ fontWeight: "demibold" }}>{t.whyTheyreAFit}</Text>
        <Text variant="microcopy" format={{ color: "secondary" }}>
          {fit.whyGoodTarget ?? t.timeDash}
        </Text>
      </Box>

      {/* ── 5. Likely pain points ───────────────────────────────────────── */}
      <Box>
        <Text format={{ fontWeight: "demibold" }}>{t.likelyPainPointsLabel}</Text>
        {painPoints.length === 0 ? (
          <Text variant="microcopy" format={{ color: "secondary" }}>
            {t.timeDash}
          </Text>
        ) : (
          <Flex direction="column" gap="xs">
            {painPoints.map((p, i) => (
              <Text key={i} variant="microcopy" format={{ color: "secondary" }}>
                • {p}
              </Text>
            ))}
          </Flex>
        )}
      </Box>

      {/* ── 6. Open full analysis ───────────────────────────────────────── */}
      {data.actionSheetUrl && (
        <Button
          variant="primary"
          onClick={() =>
            actions.openIframeModal?.({
              uri: data.actionSheetUrl!,
              title: `Revint — ${data.lead?.businessName ?? "lead"}`,
              width: 1100,
              height: 720,
            })
          }
        >
          {t.openFullAnalysisSidebar}
        </Button>
      )}
    </Flex>
  );
}

// ---------------------------------------------------------------------------
// Extension registration
// ---------------------------------------------------------------------------

hubspot.extend<"crm.record.sidebar">(({ context, actions }) => {
  const fetchFn: FetchFn = async (url, init) => {
    const res = await hubspot.fetch(url, {
      method: init?.method ?? "GET",
      body: init?.body,
      timeout: init?.timeout,
    });
    const body = (await res.json()) as CardDataResponse;
    return { status: res.status, body };
  };

  return (
    <RevintLeadSummaryCard
      context={context as ExtensionContext}
      fetchFn={fetchFn}
      actions={actions as CardActions}
    />
  );
});
