"use client";

/**
 * WebsiteIntelLazyPanel — Phase 1.1 (V1 Richness Absorption).
 *
 * Wraps the legacy `WebsiteIntelligencePanel` for use inside the
 * V2 lead-detail surface. Two responsibilities:
 *
 *   1. **Lazy fetch** the full audit + checklist via
 *      `GET /api/leads/[id]/website-intel`. The aggregator's
 *      `websiteIntelSummary` is chip-strip-only (booking / mobile /
 *      https booleans); the full V1 panel needs the heavier audit
 *      row (services arrays, security headers, schema types, etc.).
 *      Fetch only fires when the parent `<details>` element opens
 *      so DOM weight stays low for COLD-only sessions.
 *   2. **Wire the action callbacks** (`onCrawl`, `onContentCheck`,
 *      `onWebsiteSearch`) to the same endpoints the legacy client
 *      uses, but keep all state local to this component so the V2
 *      shell doesn't grow new state branches.
 *
 * Plan reference: v2_richness_absorption Phase 1.1. Default state
 * (open vs collapsed) is owned by the caller via `defaultOpen`.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import {
  WebsiteIntelligencePanel,
  type ContentCheckResult,
  type WebsiteSearchResult,
  type WebsiteAudit as V1WebsiteAudit,
  type AuditSummary,
} from "@/components/app/website-intelligence-panel";

interface WebsiteIntelResponse {
  hasWebsite: boolean;
  audit: V1WebsiteAuditRaw | null;
  checklist: {
    summary: {
      totalChecks: number;
      passed: number;
      failed: number;
      unknown: number;
      scorePercent: number;
    };
  } | null;
  planGate: {
    plan: "FREE" | "PRO" | "PRO_TEAM" | "AGENCY";
    rawFeaturesUnlocked: boolean;
  };
}

// The `/website-intel` route ships `unknown` for the JSON columns
// (servicesDetected / navItems / ctaLinks / contactEmails /
// socialProfiles / rawFeaturesJson) so the wire payload doesn't pin
// the shape. The V1 panel's `WebsiteAudit` expects already-narrowed
// arrays; we narrow here.
interface V1WebsiteAuditRaw {
  id: string;
  url: string;
  reachable: boolean;
  crawlAttemptedAt: string | null;
  crawlError: string | null;
  httpStatus: number | null;
  loadTimeMs: number | null;
  https: boolean;
  mobileFriendlyGuess: boolean;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  hasContactForm: boolean;
  hasWhatsappLink: boolean;
  hasBookingSystem: boolean;
  bookingProvider: string | null;
  hasEcommerce: boolean;
  servicesDetected: unknown;
  navItems: unknown;
  ctaLinks: unknown;
  contactEmails: unknown;
  socialProfiles: unknown;
  brokenLinksCount: number;
  structuredDataPresent: boolean;
  rawFeaturesJson: unknown | null;
  createdAt: string;
}

function arrayOf<T>(value: unknown, guard: (v: unknown) => v is T): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter(guard);
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isNavLike(
  v: unknown,
): v is { text: string; href: string } {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as { text?: unknown }).text === "string" &&
    typeof (v as { href?: unknown }).href === "string"
  );
}

function narrowAudit(raw: V1WebsiteAuditRaw): V1WebsiteAudit {
  return {
    reachable: raw.reachable,
    crawlAttemptedAt: raw.crawlAttemptedAt,
    crawlError: raw.crawlError,
    httpStatus: raw.httpStatus,
    loadTimeMs: raw.loadTimeMs,
    https: raw.https,
    mobileFriendlyGuess: raw.mobileFriendlyGuess,
    title: raw.title,
    metaDescription: raw.metaDescription,
    h1: raw.h1,
    hasContactForm: raw.hasContactForm,
    hasWhatsappLink: raw.hasWhatsappLink,
    hasBookingSystem: raw.hasBookingSystem,
    bookingProvider: raw.bookingProvider,
    hasEcommerce: raw.hasEcommerce,
    servicesDetected: arrayOf(raw.servicesDetected, isString),
    navItems: arrayOf(raw.navItems, isNavLike),
    ctaLinks: arrayOf(raw.ctaLinks, isNavLike),
    contactEmails: arrayOf(raw.contactEmails, isString),
    brokenLinksCount: raw.brokenLinksCount,
    structuredDataPresent: raw.structuredDataPresent,
    rawFeaturesJson:
      raw.rawFeaturesJson && typeof raw.rawFeaturesJson === "object"
        ? (raw.rawFeaturesJson as V1WebsiteAudit["rawFeaturesJson"])
        : null,
  };
}

export interface WebsiteIntelLazyPanelProps {
  leadId: string;
  websiteUrl: string | null;
  hasWebsite: boolean;
  businessName: string;
  workspaceNiche: string | null;
  nicheSlug: string | null;
  subNicheSlug: string | null;
  /**
   * When false, the panel does not fetch — used by the parent's
   * collapsed `<details>` so an unexpanded section stays zero-cost.
   * Flip to true once the rep opens the disclosure.
   */
  active: boolean;
}

export function WebsiteIntelLazyPanel({
  leadId,
  websiteUrl,
  hasWebsite,
  businessName,
  workspaceNiche,
  nicheSlug,
  subNicheSlug,
  active,
}: WebsiteIntelLazyPanelProps): ReactNode {
  const [audit, setAudit] = useState<V1WebsiteAudit | null>(null);
  const [auditSummary, setAuditSummary] = useState<AuditSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const [contentCheck, setContentCheck] = useState<ContentCheckResult | null>(
    null,
  );
  const [contentCheckLoading, setContentCheckLoading] = useState(false);
  const [websiteSearch, setWebsiteSearch] = useState<WebsiteSearchResult | null>(
    null,
  );
  const [websiteSearchLoading, setWebsiteSearchLoading] = useState(false);

  // Lazy fetch on first activation.
  useEffect(() => {
    if (!active || fetchedRef.current) return;
    fetchedRef.current = true;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/leads/${leadId}/website-intel`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`website_intel_${res.status}`);
        }
        return (await res.json()) as WebsiteIntelResponse;
      })
      .then((json) => {
        if (cancelled) return;
        setAudit(json.audit ? narrowAudit(json.audit) : null);
        setAuditSummary(
          json.checklist
            ? {
                totalChecks: json.checklist.summary.totalChecks,
                passed: json.checklist.summary.passed,
                failed: json.checklist.summary.failed,
                unknown: json.checklist.summary.unknown,
                scorePercent: json.checklist.summary.scorePercent,
              }
            : null,
        );
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active, leadId]);

  const runCrawl = useCallback(async () => {
    try {
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      if (!res.ok) {
        toast.error("Failed to crawl website");
        return;
      }
      toast.success("Crawl queued. Refresh in a few seconds.");
    } catch {
      toast.error("Network error during crawl");
    }
  }, [leadId]);

  const runContentCheck = useCallback(async () => {
    if (!websiteUrl) return;
    setContentCheckLoading(true);
    try {
      const res = await fetch("/api/website-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: websiteUrl }),
      });
      if (res.ok) {
        setContentCheck((await res.json()) as ContentCheckResult);
      } else {
        toast.error("Content check failed");
      }
    } catch {
      toast.error("Network error during content check");
    } finally {
      setContentCheckLoading(false);
    }
  }, [websiteUrl]);

  const runWebsiteSearch = useCallback(async () => {
    setWebsiteSearchLoading(true);
    setWebsiteSearch(null);
    try {
      const res = await fetch("/api/website-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, leadId }),
      });
      if (res.ok) {
        setWebsiteSearch((await res.json()) as WebsiteSearchResult);
      } else {
        toast.error("Website search failed");
      }
    } catch {
      toast.error("Network error during website search");
    } finally {
      setWebsiteSearchLoading(false);
    }
  }, [businessName, leadId]);

  if (!active) {
    // Caller-owned collapsed state — nothing rendered until the
    // parent `<details>` opens.
    return null;
  }

  if (loading && !audit) {
    return (
      <div
        className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/3 px-3 py-2 text-[12px]"
        style={{ color: "var(--leadac-text-3)" }}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        <span>Loading full website panel…</span>
      </div>
    );
  }

  if (error) {
    return (
      <p
        className="rounded-lg border border-white/8 bg-white/3 px-3 py-2 text-[12px]"
        style={{ color: "var(--leadac-error)" }}
      >
        Couldn&apos;t load the website panel ({error}). The chip strip
        above still reflects the cached summary.
      </p>
    );
  }

  return (
    <WebsiteIntelligencePanel
      websiteUrl={websiteUrl}
      hasWebsite={hasWebsite}
      businessName={businessName}
      workspaceNiche={workspaceNiche}
      nicheSlug={nicheSlug}
      subNicheSlug={subNicheSlug}
      audit={audit}
      auditSummary={auditSummary}
      contentCheck={contentCheck}
      contentCheckLoading={contentCheckLoading}
      websiteSearch={websiteSearch}
      websiteSearchLoading={websiteSearchLoading}
      onCrawl={runCrawl}
      onContentCheck={runContentCheck}
      onWebsiteSearch={runWebsiteSearch}
    />
  );
}
