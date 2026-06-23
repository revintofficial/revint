/**
 * Revint Sales Intelligence — HubSpot App Card.
 *
 * SDR-facing decision card. Renders the most acted-on Revint signals
 * directly inside HubSpot so the rep doesn't have to context-switch to
 * answer "who is this, why pitch them, what do we recommend".
 *
 * Section order (deliberate — see the redesign plan):
 *   1. Why They're A Fit + Pain Points (highest-information first)
 *   2. At A Glance chips (audit wedges + reasonCodes)
 *   3. Restaurant Tech Signals (F&B-specific tiles)
 *   4. Recommended Package (the one clean decision Revint provides)
 *   5. Pitch Angle (AI-with-fallback headline + sentence)
 *   6. Review Intelligence (sentiment + pain/praise phrases + deep link)
 *   7. AI Dossier (teaser + "continue in Revint")
 *
 * Header carries title (left) and a status cluster (temperature, age,
 * Google Maps link, social links) on the right. The footer keeps the
 * canonical "Open Revint Action Sheet" deep link.
 *
 * Design-language note: HubSpot UI Extensions disallow custom CSS,
 * fonts, hex colors, and raw HTML — only `@hubspot/ui-extensions`
 * components styled via a fixed prop set are allowed. So the card body
 * matches Revint's information architecture + voice + semantic palette
 * (success/warning/danger/info Tag variants), and the FULL Revint visual
 * design only shows up in the deep views opened via
 * `actions.openIframeModal` (or a new browser tab as a fallback).
 *
 * Data flow:
 *   - `hubspot.extend(...)` wires this component into `crm.record.tab`.
 *   - On mount we call `hubspot.fetch('/api/integrations/hubspot/card-data', …)`
 *     against the Revint Next.js backend. HubSpot signs the request with
 *     the v3 signature; the backend verifies it before reading any data.
 *   - The card stays render-only: no writes from this UI. SDR actions
 *     land on the Revint Action Sheet (deep link) where they fan out
 *     into HubSpot via the writeback pipeline.
 *
 * Constraints:
 *   - 15 s default hubspot.fetch timeout (one-shot, no chunking).
 *   - 1 MB request + response payload.
 *   - 20 concurrent requests per portal — we make exactly one per mount.
 */
import React, { useEffect, useState, useCallback } from "react";
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

interface CardPackage {
  name: string;
  priceLabel: string;
  reason: string | null;
  features: string[];
}

interface CardFit {
  opportunityScore: number | null;
  expectedPriceBand: string | null;
  whyGoodTarget: string | null;
  painPoints: string[];
}

interface CardKpi {
  label: string;
  percent: number | null;
}

interface CardReviews {
  leadScore: number | null;
  reviewsAnalyzed: number | null;
  totalReviews: number | null;
  rating: number | null;
  sentiment: {
    positive: number | null;
    neutral: number | null;
    negative: number | null;
  };
  topComplaints: CardKpi[];
  topPraise: CardKpi[];
  painPhrases: string[];
  praisePhrases: string[];
  summary: string | null;
  fullAnalysisUrl: string | null;
}

interface CardGlance {
  chips: string[];
}

interface CardTechSignal {
  label: string;
  present: boolean;
  detail: string;
  priority: "critical" | "important" | "nice_to_have";
}

interface CardLinks {
  googleMapsUrl: string | null;
  social: Record<string, string>;
}

interface CardPitch {
  headline: string | null;
  sentence: string | null;
}

interface CardDossier {
  summary: string | null;
  url: string;
}

interface CardDataResponse {
  found: boolean;
  reason?: string;
  lead?: CardLead;
  actionSheetUrl?: string;
  timing?: CardTiming;
  signals?: CardSignals;
  decision?: CardDecision;
  package?: CardPackage | null;
  fit?: CardFit | null;
  reviews?: CardReviews | null;
  glance?: CardGlance;
  techSignals?: CardTechSignal[] | null;
  links?: CardLinks;
  pitch?: CardPitch;
  dossier?: CardDossier | null;
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

// Tech-signal tone mapping mirrors the Revint UI's `toneOf()` helper in
// `RestaurantSignalsSection`. Same semantic palette → red for missing-
// critical, amber for missing-important, neutral for missing-nice-to-have,
// green for present. Keeps the card chromatically consistent with the
// Revint app even though the underlying tokens can't be reused.
function techSignalVariant(
  s: CardTechSignal,
): "success" | "danger" | "warning" | "default" {
  if (s.present) return "success";
  if (s.priority === "critical") return "danger";
  if (s.priority === "important") return "warning";
  return "default";
}

// At-a-Glance chips encode either a positive ("Package: …") or a wedge
// ("No WhatsApp", "Weak Security"). We split them so the card colors
// positives green and negatives neutral — same logic as the in-app strip,
// without needing the chip metadata on the wire.
function glanceChipVariant(
  chip: string,
): "success" | "warning" | "default" {
  const lower = chip.toLowerCase();
  if (lower.startsWith("package:")) return "success";
  if (lower.startsWith("qr menu detected")) return "success";
  if (lower.startsWith("good rating")) return "success";
  if (lower.startsWith("slow site")) return "warning";
  return "default";
}

// Title-cased social platform label for the small icon row in the header.
// We can't render brand icons in HubSpot UI Extensions, so we use the
// platform name as the link label.
function socialLabel(platform: string): string {
  if (platform === "linkedin") return "LinkedIn";
  if (platform === "tiktok") return "TikTok";
  if (platform === "youtube") return "YouTube";
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

// -------------------------------------------------------------------------
// Card body
// -------------------------------------------------------------------------

interface ExtensionContext {
  // `hubspot.fetch` can't set custom headers, so the backend can't read the
  // portal from a header — we must pass `context.portal.id` in the request
  // body so it can resolve which workspace this portal maps to.
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

/**
 * Action handlers wired in from `hubspot.extend(({ actions }) => ...)`.
 *
 * `openIframeModal` opens a deep-linked Revint surface (full review
 * analysis, full dossier, action sheet) in an in-CRM modal — that's how
 * we deliver true Revint design language even though the card body is
 * locked to HubSpot's component set.
 *
 * The handler is OPTIONAL: when the extension runtime doesn't surface
 * the action (older client / unauthorized) we degrade gracefully to a
 * plain external Link that opens a new tab.
 */
interface CardActions {
  openIframeModal?: (payload: {
    uri: string;
    title?: string;
    width?: number;
    height?: number;
  }) => void;
}

/**
 * Deep-link button helper. Calls `openIframeModal` when available so the
 * SDR stays inside HubSpot with a Revint-branded modal; falls back to a
 * plain external link otherwise.
 *
 * NB: HubSpot's `Link` component has no `onClick` prop, so we use an
 * inline `Text inline format={{ underline: true }}` wrapped in a Box
 * with an `onClick`... except `Box` doesn't take `onClick` either. The
 * only component that accepts a click handler is `Link` (via `href`)
 * and `Button`. We use `Button` styled as `transparent` (no border /
 * background) when the modal action is available; otherwise `Link
 * external`.
 */
interface DeepLinkProps {
  label: string;
  title: string;
  url: string;
  actions: CardActions;
}

function DeepLink({ label, title, url, actions }: DeepLinkProps) {
  if (actions.openIframeModal) {
    return (
      <Link
        onClick={() =>
          actions.openIframeModal?.({
            uri: url,
            title,
            width: 1100,
            height: 720,
          })
        }
      >
        {label}
      </Link>
    );
  }
  return (
    <Link href={url} external>
      {label}
    </Link>
  );
}

function RevintCard({
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

    // NB: hubspot.fetch expects `body` as an OBJECT and serialises it
    // itself — passing a pre-stringified JSON string double-encodes it and
    // the backend then sees a string instead of `{ objectId, ... }`.
    fetchFn(`${REVINT_BASE_URL}/api/integrations/hubspot/card-data`, {
      method: "POST",
      body: { objectId, objectType, portalId },
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
  }, [context.crm.objectId, context.crm.objectType, context.portal?.id, fetchFn]);

  // Stable-reference action sheet opener used by the footer + dossier
  // continue link.
  const openActionSheet = useCallback(
    (url: string, title: string) => {
      if (actions.openIframeModal) {
        actions.openIframeModal({
          uri: url,
          title,
          width: 1100,
          height: 720,
        });
      }
    },
    [actions],
  );

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
  const timing = data.timing!;
  const lead = data.lead!;
  const pkg = data.package ?? null;
  const fit = data.fit ?? null;
  const reviews = data.reviews ?? null;
  const glance = data.glance ?? { chips: [] };
  const techSignals = data.techSignals ?? null;
  const links = data.links ?? { googleMapsUrl: null, social: {} };
  const pitch = data.pitch ?? { headline: null, sentence: null };
  const dossier = data.dossier ?? null;
  const actionSheetUrl = data.actionSheetUrl;

  const age = formatAge(timing.hoursSinceInbound);
  const socialEntries = Object.entries(links.social);

  return (
    <Flex direction="column" gap="md">
      {/* Header — title (left) + status cluster (right). Status cluster
          stacks the temperature/age row on top with Maps + social links
          underneath, matching the "top-right of the card" placement
          from the redesign mockup. */}
      <Flex direction="row" justify="between" align="start" wrap="wrap">
        <Heading>Revint Sales Intelligence</Heading>
        <Flex direction="column" gap="xs" align="end">
          <Flex direction="row" gap="xs" align="center">
            {signals.temperature && (
              <Tag variant={temperatureToVariant(signals.temperature)}>
                {signals.temperature} LEAD
              </Tag>
            )}
            {age && <Text variant="microcopy">{age}</Text>}
          </Flex>
          {(links.googleMapsUrl || socialEntries.length > 0) && (
            <Flex direction="column" gap="xs" align="end">
              {links.googleMapsUrl && (
                <Link href={links.googleMapsUrl} external>
                  Google Maps
                </Link>
              )}
              {socialEntries.length > 0 && (
                <Flex direction="row" gap="xs" wrap="wrap" justify="end">
                  {socialEntries.map(([platform, url]) => (
                    <Link key={platform} href={url} external>
                      {socialLabel(platform)}
                    </Link>
                  ))}
                </Flex>
              )}
            </Flex>
          )}
        </Flex>
      </Flex>

      {/* Sub-header: priority + stage. Compact context the SDR uses to
          triage; sits between the title and the section grid. */}
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

      {/* Qualification risk (compact, retained from the prior layout so we
          don't drop a signal the SDR already relies on). */}
      {signals.qualificationStatus && (
        <Box>
          <Flex direction="row" gap="xs" align="center" wrap="wrap">
            <Text format={{ fontWeight: "demibold" }}>Qualification:</Text>
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

      <Divider distance="xs" />

      {/* 1. Why They're A Fit + Pain Points — top of the card per the
          redesign brief: "maksimum bilgiyi olabildiğince bir arada
          vermemiz gerekiyor." This is what the SDR will scan first. */}
      {fit && (fit.whyGoodTarget || fit.painPoints.length > 0) && (
        <Box>
          {fit.whyGoodTarget && (
            <Box>
              <Text format={{ fontWeight: "demibold" }}>
                Why they&apos;re a fit
              </Text>
              <Text variant="microcopy" format={{ color: "secondary" }}>
                {fit.whyGoodTarget}
              </Text>
            </Box>
          )}
          {fit.painPoints.length > 0 && (
            <Box>
              <Text format={{ fontWeight: "demibold" }}>
                Likely pain points
              </Text>
              {fit.painPoints.map((p, i) => (
                <Text
                  key={i}
                  variant="microcopy"
                  format={{ color: "secondary" }}
                >
                  • {p}
                </Text>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* 2. At A Glance — chip strip that anchors the SDR in concrete
          facts before the more interpretive sections below. */}
      {glance.chips.length > 0 && (
        <Box>
          <Divider distance="xs" />
          <Text format={{ fontWeight: "demibold" }}>At a glance</Text>
          <Flex direction="row" gap="xs" wrap="wrap">
            {glance.chips.map((c) => (
              <Tag key={c} variant={glanceChipVariant(c)}>
                {c}
              </Tag>
            ))}
          </Flex>
        </Box>
      )}

      {/* 3. Restaurant Tech Signals — F&B-specific tiles. Hidden for
          non-F&B leads (the backend returns `null`). */}
      {techSignals && techSignals.length > 0 && (
        <Box>
          <Divider distance="xs" />
          <Text format={{ fontWeight: "demibold" }}>
            Restaurant tech signals
          </Text>
          <Flex direction="column" gap="xs">
            {techSignals.map((s) => (
              <Box key={s.label}>
                <Flex direction="row" gap="xs" align="center" wrap="wrap">
                  <Tag variant={techSignalVariant(s)}>{s.label}</Tag>
                  <Text variant="microcopy" format={{ color: "secondary" }}>
                    {s.detail}
                  </Text>
                </Flex>
              </Box>
            ))}
          </Flex>
        </Box>
      )}

      {/* 4. Recommended Package — the cleanest single decision Revint
          produces; per the brief this MUST live on the card. */}
      {pkg && (
        <Box>
          <Divider distance="xs" />
          <Flex direction="row" gap="xs" align="center" wrap="wrap">
            <Text format={{ fontWeight: "demibold" }}>
              Recommended package: {pkg.name}
            </Text>
            <Tag variant="info">{pkg.priceLabel}</Tag>
          </Flex>
          {pkg.reason && (
            <Text variant="microcopy" format={{ color: "secondary" }}>
              {pkg.reason}
            </Text>
          )}
          {pkg.features.length > 0 && (
            <Flex direction="row" gap="xs" wrap="wrap">
              {pkg.features.map((f, i) => (
                <Tag key={i} variant="default">
                  {f}
                </Tag>
              ))}
            </Flex>
          )}
        </Box>
      )}

      {/* 5. Pitch Angle — AI-with-fallback headline + sentence. Sits AFTER
          the signal sections so the SDR reads "what they are → what we
          recommend → how to pitch" in order. */}
      {(pitch.headline || pitch.sentence) && (
        <Box>
          <Divider distance="xs" />
          <Text format={{ fontWeight: "demibold" }}>Pitch angle</Text>
          {pitch.headline && (
            <Text format={{ fontWeight: "demibold" }}>{pitch.headline}</Text>
          )}
          {pitch.sentence && (
            <Text variant="microcopy" format={{ color: "secondary" }}>
              {pitch.sentence}
            </Text>
          )}
        </Box>
      )}

      {/* 6. Review Intelligence — sentiment + top pain/praise phrases,
          then a "See the full analysis" deep link into Revint's review
          tab. The verbose KPI lists from the prior layout are dropped
          on purpose; the card stays a TEASER, the depth lives in the
          Revint UI. */}
      {reviews && (
        <Box>
          <Divider distance="xs" />
          <Flex direction="row" gap="xs" align="center" wrap="wrap">
            <Text format={{ fontWeight: "demibold" }}>Review intelligence</Text>
            {reviews.leadScore != null && (
              <Tag variant="info">Score {reviews.leadScore}/100</Tag>
            )}
            {reviews.rating != null && (
              <Text variant="microcopy">{reviews.rating}★</Text>
            )}
          </Flex>
          {(reviews.sentiment.positive != null ||
            reviews.sentiment.negative != null ||
            reviews.sentiment.neutral != null) && (
            <Flex direction="row" gap="xs" wrap="wrap">
              {reviews.sentiment.positive != null && (
                <Tag variant="success">
                  {reviews.sentiment.positive}% positive
                </Tag>
              )}
              {reviews.sentiment.neutral != null && (
                <Tag variant="default">
                  {reviews.sentiment.neutral}% neutral
                </Tag>
              )}
              {reviews.sentiment.negative != null && (
                <Tag variant="danger">
                  {reviews.sentiment.negative}% negative
                </Tag>
              )}
            </Flex>
          )}
          {reviews.painPhrases.length > 0 && (
            <Box>
              <Text variant="microcopy" format={{ fontWeight: "demibold" }}>
                Most common pain phrases
              </Text>
              <Flex direction="row" gap="xs" wrap="wrap">
                {reviews.painPhrases.map((p, i) => (
                  <Tag key={i} variant="danger">
                    {p}
                  </Tag>
                ))}
              </Flex>
            </Box>
          )}
          {reviews.praisePhrases.length > 0 && (
            <Box>
              <Text variant="microcopy" format={{ fontWeight: "demibold" }}>
                Most common praise
              </Text>
              <Flex direction="row" gap="xs" wrap="wrap">
                {reviews.praisePhrases.map((p, i) => (
                  <Tag key={i} variant="success">
                    {p}
                  </Tag>
                ))}
              </Flex>
            </Box>
          )}
          {reviews.fullAnalysisUrl && (
            <DeepLink
              label="See the full analysis"
              title={`Review analysis — ${lead.businessName ?? "lead"}`}
              url={reviews.fullAnalysisUrl}
              actions={actions}
            />
          )}
        </Box>
      )}

      {/* 7. AI Dossier — last because it's the synthesis of everything
          above. Short teaser + "continue in Revint" so the card stays
          scannable; the full markdown narrative lives in the Revint UI. */}
      {dossier && (dossier.summary || dossier.url) && (
        <Box>
          <Divider distance="xs" />
          <Text format={{ fontWeight: "demibold" }}>AI dossier</Text>
          {dossier.summary && (
            <Text variant="microcopy" format={{ color: "secondary" }}>
              {dossier.summary}
            </Text>
          )}
          <DeepLink
            label="Continue full dossier in Revint"
            title={`Dossier — ${lead.businessName ?? "lead"}`}
            url={dossier.url}
            actions={actions}
          />
        </Box>
      )}

      <Divider distance="xs" />

      {/* Footer — primary action sheet deep link. Uses the iframe-modal
          action when available (true Revint design) and falls back to a
          plain external link so the SDR is never stuck. */}
      {actionSheetUrl &&
        (actions.openIframeModal ? (
          <Link
            onClick={() =>
              openActionSheet(
                actionSheetUrl,
                `Revint — ${lead.businessName ?? "lead"}`,
              )
            }
          >
            Open Revint action sheet
            {lead.businessName ? ` for ${lead.businessName}` : ""}
          </Link>
        ) : (
          <Link href={actionSheetUrl} external>
            Open Revint action sheet
            {lead.businessName ? ` for ${lead.businessName}` : ""}
          </Link>
        ))}
    </Flex>
  );
}

// -------------------------------------------------------------------------
// Entry point — bind the component to HubSpot's extension runtime.
// -------------------------------------------------------------------------

hubspot.extend<"crm.record.tab">(({ context, actions }) => {
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

  // `actions` carries `openIframeModal` when the host runtime supports it.
  // We pass it through as a narrowed interface so the card can fall back
  // to plain external links when the action is unavailable.
  return (
    <RevintCard
      context={context as ExtensionContext}
      fetchFn={fetchFn}
      actions={actions as CardActions}
    />
  );
});
