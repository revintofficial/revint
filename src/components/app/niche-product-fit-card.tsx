/**
 * NicheProductFitCard - lead detail Website-tab surface.
 *
 * Reads the lead's `nicheSlug` / `subNicheSlug` and renders the
 * `featuredProductModules` from the matching NichePack as a status
 * grid. Each module is cross-referenced against the website audit's
 * `rawFeaturesJson` to label it:
 *
 *   - "detected"    (green) — feature found on the prospect's site
 *   - "weak"        (amber) — partial / indirect signal
 *   - "opportunity" (gray)  — not detected; this is what the rep pitches
 *
 * The `pitchAngle` from the niche pack renders below the grid so the
 * sales rep has a vertical-specific framing in front of them while
 * scanning the modules.
 *
 * Renders nothing when:
 *   - the lead has no resolvable niche slug, OR
 *   - the resolved pack has no `featuredProductModules`.
 *
 * The card is intentionally a leaf component: it does not fetch and
 * does not subscribe — page.tsx already has the lead + audit hydrated.
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CircleCheck, AlertTriangle, Target, Sparkles } from "lucide-react";
import { getNicheBySlug, getParentOf } from "@/lib/niches";

interface AuditFeatures {
  hasQrMenu?: boolean;
  detectedMenuTool?: string | null;
  menuUrl?: string | null;
  hasOnlineReservation?: boolean;
  hasDeliveryIntegration?: boolean;
  hasBookingSystem?: boolean;
  hasContactForm?: boolean;
  hasEcommerce?: boolean;
  hasWhatsappLink?: boolean;
  bookingProvider?: string | null;
  socialProfiles?: Record<string, string | null> | null;
}

type ModuleStatus = "detected" | "weak" | "opportunity";

interface ModuleVerdict {
  module: string;
  status: ModuleStatus;
  detail: string;
}

interface Props {
  nicheSlug: string | null;
  subNicheSlug: string | null;
  auditFeatures: AuditFeatures | null;
}

export function NicheProductFitCard({ nicheSlug, subNicheSlug, auditFeatures }: Props) {
  // Resolve the most specific niche pack: child first, then parent.
  // getParentOf falls back to the input slug when there's no parent
  // mapping, so a flat niche just resolves to itself.
  const resolvedSlug =
    subNicheSlug ?? nicheSlug ?? (subNicheSlug ? getParentOf(subNicheSlug) : null);
  const pack = resolvedSlug ? getNicheBySlug(resolvedSlug) : null;

  if (!pack || !pack.featuredProductModules || pack.featuredProductModules.length === 0) {
    return null;
  }

  const verdicts = pack.featuredProductModules.map((m) =>
    classifyModule(m, auditFeatures),
  );

  const detectedCount = verdicts.filter((v) => v.status === "detected").length;
  const opportunityCount = verdicts.filter((v) => v.status === "opportunity").length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-[15px] flex items-center gap-2">
              <Target className="w-4 h-4 text-(--revint-500) shrink-0" />
              {pack.label} product fit
            </CardTitle>
            <p className="text-[12px] text-white/45 mt-1">
              Modules from your offer that map to this sub-vertical.
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant="success" className="text-[10px] h-5 px-1.5">
              {detectedCount} present
            </Badge>
            <Badge variant="warning" className="text-[10px] h-5 px-1.5">
              {opportunityCount} to pitch
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {verdicts.map((v) => (
            <ModuleChip key={v.module} verdict={v} />
          ))}
        </div>

        <div className="rounded-lg border border-white/5 bg-white/2 px-3 py-2.5">
          <div className="flex items-start gap-2">
            <Sparkles className="w-3.5 h-3.5 text-(--revint-500) mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-white/40 mb-1">
                Pitch angle
              </p>
              <p className="text-[12px] text-white/75 leading-relaxed">{pack.pitchAngle}</p>
            </div>
          </div>
        </div>

        {pack.highValueSignals && pack.highValueSignals.length > 0 && (
          <details className="group">
            <summary className="text-[11px] text-white/45 cursor-pointer hover:text-white/70 transition-colors list-none flex items-center gap-1.5">
              <span className="group-open:rotate-90 transition-transform inline-block">›</span>
              High-value signals to surface ({pack.highValueSignals.length})
            </summary>
            <ul className="mt-2 space-y-1 pl-4">
              {pack.highValueSignals.map((sig) => (
                <li key={sig} className="text-[12px] text-white/55 leading-relaxed">
                  · {sig}
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

function ModuleChip({ verdict }: { verdict: ModuleVerdict }) {
  const styles: Record<
    ModuleVerdict["status"],
    { border: string; bg: string; iconColor: string; labelColor: string; detailColor: string }
  > = {
    detected: {
      border: "color-mix(in oklab, var(--revint-success) 25%, transparent)",
      bg: "color-mix(in oklab, var(--revint-success) 6%, transparent)",
      iconColor: "var(--revint-success)",
      labelColor: "color-mix(in oklab, var(--revint-success-soft) 95%, white)",
      detailColor: "color-mix(in oklab, var(--revint-success-soft) 70%, transparent)",
    },
    weak: {
      border: "color-mix(in oklab, var(--revint-warning) 20%, transparent)",
      bg: "color-mix(in oklab, var(--revint-warning) 5%, transparent)",
      iconColor: "var(--revint-warning)",
      labelColor: "color-mix(in oklab, var(--revint-warning-soft) 95%, white)",
      detailColor: "color-mix(in oklab, var(--revint-warning-soft) 70%, transparent)",
    },
    opportunity: {
      border: "rgba(255,255,255,0.08)",
      bg: "rgba(255,255,255,0.02)",
      iconColor: "rgba(255,255,255,0.35)",
      labelColor: "rgba(255,255,255,0.85)",
      detailColor: "rgba(255,255,255,0.45)",
    },
  };
  const s = styles[verdict.status];

  const Icon =
    verdict.status === "detected"
      ? CircleCheck
      : verdict.status === "weak"
        ? AlertTriangle
        : Target;

  return (
    <div
      className="rounded-lg border px-3 py-2 flex items-start gap-2 transition-colors"
      style={{ borderColor: s.border, background: s.bg }}
    >
      <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: s.iconColor }} />
      <div className="min-w-0">
        <p className="text-[12px] font-medium leading-tight" style={{ color: s.labelColor }}>
          {verdict.module}
        </p>
        <p className="text-[11px] mt-0.5 leading-snug" style={{ color: s.detailColor }}>
          {verdict.detail}
        </p>
      </div>
    </div>
  );
}

/**
 * Maps a free-form `featuredProductModules` string (e.g. "Online
 * Reservations (premium)", "QR Menu", "Tip Collection") to a status
 * verdict using the website-audit features. The mapping is intentionally
 * lenient — niche packs use varied phrasing across verticals — so we
 * pattern-match on lowercased substrings and fall through to
 * "opportunity" when no signal applies. That default is the right one
 * for a sales pitch: anything not visibly running on the site is a
 * pitch opportunity, not a failure.
 */
function classifyModule(
  moduleLabel: string,
  features: AuditFeatures | null,
): ModuleVerdict {
  const label = moduleLabel.toLowerCase();

  // No audit yet — can't classify, treat as unknown opportunity so
  // the rep still sees the module list with a neutral framing.
  if (!features) {
    return {
      module: moduleLabel,
      status: "opportunity",
      detail: "Run a website audit to detect status",
    };
  }

  // QR / digital menu modules
  if (label.includes("qr menu") || label.includes("digital menu") || label.includes("menu app")) {
    if (features.hasQrMenu) {
      return {
        module: moduleLabel,
        status: "detected",
        detail: features.detectedMenuTool ? `Detected: ${features.detectedMenuTool}` : "QR menu found on site",
      };
    }
    return { module: moduleLabel, status: "opportunity", detail: "No QR menu on site — primary opener" };
  }

  // Reservation / booking modules
  if (label.includes("reservation") || label.includes("booking")) {
    if (features.hasOnlineReservation || features.bookingProvider) {
      return {
        module: moduleLabel,
        status: "detected",
        detail: features.bookingProvider ? `Provider: ${features.bookingProvider}` : "Reservation widget detected",
      };
    }
    return { module: moduleLabel, status: "opportunity", detail: "No online reservation flow detected" };
  }

  // Delivery / takeaway integrations
  if (label.includes("delivery") || label.includes("takeaway") || label.includes("pickup")) {
    if (features.hasDeliveryIntegration) {
      return { module: moduleLabel, status: "detected", detail: "Delivery platform link found" };
    }
    return { module: moduleLabel, status: "opportunity", detail: "No delivery integration visible" };
  }

  // Payment / tip / checkout modules — hasEcommerce is a weak proxy
  if (label.includes("payment") || label.includes("tip") || label.includes("checkout")) {
    if (features.hasEcommerce) {
      return { module: moduleLabel, status: "weak", detail: "Payments inferred from e-commerce signals" };
    }
    return { module: moduleLabel, status: "opportunity", detail: "No payment-at-table flow on site" };
  }

  // Feedback / review collection — contact form is a weak proxy
  if (label.includes("feedback") || label.includes("review")) {
    if (features.hasContactForm) {
      return { module: moduleLabel, status: "weak", detail: "Contact form present (not dedicated feedback)" };
    }
    return { module: moduleLabel, status: "opportunity", detail: "No feedback capture surface" };
  }

  // Loyalty / CRM — almost never detectable from a marketing site
  if (label.includes("loyalty") || label.includes("crm")) {
    return { module: moduleLabel, status: "opportunity", detail: "No loyalty / CRM surface visible" };
  }

  // Smart recommendations / AI / personalization — not detectable
  if (label.includes("recommendation") || label.includes("smart") || label.includes("ai ")) {
    return { module: moduleLabel, status: "opportunity", detail: "Personalization layer pitch opportunity" };
  }

  // Promotions / marketing modules — hasContactForm hints at lead capture
  if (label.includes("promotion") || label.includes("marketing") || label.includes("campaign")) {
    if (features.hasContactForm) {
      return { module: moduleLabel, status: "weak", detail: "Lead capture present, no campaign engine" };
    }
    return { module: moduleLabel, status: "opportunity", detail: "No marketing automation visible" };
  }

  // WhatsApp / chat modules
  if (label.includes("whatsapp") || label.includes("chat")) {
    if (features.hasWhatsappLink) {
      return { module: moduleLabel, status: "detected", detail: "WhatsApp contact link found" };
    }
    return { module: moduleLabel, status: "opportunity", detail: "No chat / WhatsApp flow" };
  }

  // Analytics / dashboards / reporting — internal tooling, not detectable
  if (label.includes("analytic") || label.includes("dashboard") || label.includes("report")) {
    return { module: moduleLabel, status: "opportunity", detail: "Internal dashboard pitch opportunity" };
  }

  // Multi-branch / chain management — internal, not detectable
  if (label.includes("multi-branch") || label.includes("multi-location") || label.includes("centralised") || label.includes("centralized")) {
    return { module: moduleLabel, status: "opportunity", detail: "Group-level operations pitch opportunity" };
  }

  // Kiosk / self-service
  if (label.includes("kiosk") || label.includes("self-service") || label.includes("self service")) {
    return { module: moduleLabel, status: "opportunity", detail: "In-store kiosk pitch opportunity" };
  }

  return { module: moduleLabel, status: "opportunity", detail: "Pitch opportunity for this vertical" };
}
