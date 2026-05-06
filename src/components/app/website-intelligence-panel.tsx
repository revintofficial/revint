/**
 * WebsiteIntelligencePanel — single, unified surface for every
 * website-derived signal we have on a lead.
 *
 * Replaces the old "scattered" website tab where each auditor (audit
 * crawler, content checker, restaurant signals, niche product fit,
 * security headers, performance hints) had its own card. This component
 * keeps every section visible at once but groups them into a coherent
 * report with a hero score, KPI strip and labelled subsections.
 *
 * Data inputs (all optional — section auto-hides when empty):
 *   - audit              (Lead.websiteAudit shape from /api/leads/[id])
 *   - auditSummary       (canonical pass/fail tally from the same endpoint)
 *   - contentCheck       (POST /api/website-check result, in-memory only)
 *   - websiteSearch      (POST /api/website-search result, in-memory only)
 *   - niche / sub-niche  (for the product-fit subsection)
 *
 * The component is intentionally a leaf — it does not fetch. The lead
 * detail page wires the actions (re-scan, content check, find website)
 * via callbacks so that the page stays the single owner of the lead
 * lifecycle and refetch logic.
 */

"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CircularProgress } from "@/components/ui/progress";
import { getNicheBySlug, getParentOf } from "@/lib/niches";
import { isSocialPlatformDefaultMeta } from "@/lib/labels";
import {
  Globe,
  ExternalLink,
  Loader2,
  Search,
  ScanSearch,
  RefreshCw,
  CircleCheck,
  CircleX,
  AlertTriangle,
  Info,
  Zap,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Gauge,
  Target,
  ChevronDown,
  Mail,
  MessageCircle,
  Calendar,
  ShoppingBag,
  FileText,
  Layout,
  Lock,
  Eye,
  EyeOff,
  type LucideIcon,
} from "lucide-react";

interface ContentCheckSignal {
  label: string;
  status: "good" | "bad" | "warning";
  detail: string;
}

export interface ContentCheckResult {
  url: string;
  reachable: boolean;
  verdict: "placeholder" | "basic" | "developed" | "unreachable";
  score: number;
  signals: ContentCheckSignal[];
  summary: string;
  htmlSize: number;
  wordCount: number;
  imageCount: number;
  internalLinkCount: number;
  hasCustomContent: boolean;
  isParked: boolean;
  isComingSoon: boolean;
  builderDetected: string | null;
}

interface WebsiteSearchFoundItem {
  url: string;
  title: string | null;
  source: "domain_guess" | "google_search";
  reachable: boolean;
}

export interface WebsiteSearchResult {
  businessName: string;
  found: boolean;
  websites: WebsiteSearchFoundItem[];
  searchedCount: number;
}

interface SecurityHeaders {
  hasCSP: boolean;
  hasXFrameOptions: boolean;
  hasXContentTypeOptions: boolean;
  hasReferrerPolicy: boolean;
  hasHSTS: boolean;
  hasXXSSProtection: boolean;
  hasPermissionsPolicy: boolean;
}

export interface WebsiteAudit {
  reachable: boolean;
  crawlAttemptedAt?: string | null;
  crawlError?: string | null;
  httpStatus?: number | null;
  loadTimeMs: number | null;
  https: boolean;
  mobileFriendlyGuess: boolean;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  hasContactForm: boolean;
  hasWhatsappLink: boolean;
  hasBookingSystem: boolean;
  hasEcommerce: boolean;
  servicesDetected: string[];
  navItems: { text: string; href: string }[];
  ctaLinks: { text: string; href: string }[];
  hasOpenGraph?: boolean;
  hasTwitterCards?: boolean;
  hasFavicon?: boolean;
  hasManifest?: boolean;
  hasServiceWorker?: boolean;
  hasGoogleAnalytics?: boolean;
  hasCookieConsent?: boolean;
  hasResponsiveImages?: boolean;
  hasFontDisplay?: boolean;
  securityHeaders?: SecurityHeaders;
  schemaTypes?: string[];
  accessibilityIssues?: string[];
  fontsDetected?: string[];
  performanceHints?: string[];
  cssFramework?: string | null;
  pageCount?: number;
  contactEmails?: string[] | null;
  rawFeaturesJson?: {
    hasQrMenu?: boolean;
    hasOnlineReservation?: boolean;
    hasDeliveryIntegration?: boolean;
    detectedMenuTool?: string | null;
    menuUrl?: string | null;
  } | null;
  bookingProvider?: string | null;
  brokenLinksCount?: number;
  structuredDataPresent?: boolean;
}

export interface AuditSummary {
  totalChecks: number;
  passed: number;
  failed: number;
  unknown?: number;
  scorePercent: number;
}

interface Props {
  websiteUrl: string | null;
  hasWebsite: boolean;
  businessName: string;
  workspaceNiche: string | null;
  nicheSlug: string | null;
  subNicheSlug: string | null;
  audit: WebsiteAudit | null;
  auditSummary: AuditSummary | null;
  contentCheck: ContentCheckResult | null;
  contentCheckLoading: boolean;
  websiteSearch: WebsiteSearchResult | null;
  websiteSearchLoading: boolean;
  onCrawl: () => void;
  onContentCheck: () => void;
  onWebsiteSearch: () => void;
}

export function WebsiteIntelligencePanel({
  websiteUrl,
  hasWebsite,
  businessName,
  workspaceNiche,
  nicheSlug,
  subNicheSlug,
  audit,
  auditSummary,
  contentCheck,
  contentCheckLoading,
  websiteSearch,
  websiteSearchLoading,
  onCrawl,
  onContentCheck,
  onWebsiteSearch,
}: Props) {
  // Empty state — no audit yet. We still render the search-results card
  // below if the rep just ran "Find website" so they keep the context.
  if (!audit) {
    return (
      <div className="space-y-4">
        <EmptyHeroCard
          hasWebsite={hasWebsite}
          websiteUrl={websiteUrl}
          businessName={businessName}
          onCrawl={onCrawl}
          onWebsiteSearch={onWebsiteSearch}
          websiteSearchLoading={websiteSearchLoading}
        />
        {websiteSearch && (
          <WebsiteSearchInlineCard result={websiteSearch} />
        )}
      </div>
    );
  }

  const isFnb =
    workspaceNiche === "RESTAURANT_TECH" ||
    nicheSlug === "fnb" ||
    !!subNicheSlug?.startsWith("fnb");

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        {/* HERO — overall score, URL, primary actions */}
        <HeroSection
          websiteUrl={websiteUrl}
          businessName={businessName}
          audit={audit}
          auditSummary={auditSummary}
          contentCheckLoading={contentCheckLoading}
          onCrawl={onCrawl}
          onContentCheck={onContentCheck}
        />

        {/* KPI strip — at-a-glance numbers */}
        <KpiStrip audit={audit} auditSummary={auditSummary} />

        {/* Bot-block warning banner (if our crawler got 4xx but a human
            could likely still open it) */}
        {audit.crawlError === "BOT_BLOCKED_4XX" && (
          <div className="px-4 sm:px-5 pb-4">
            <div className="rounded-xl border border-(--leadac-warning)/30 bg-(--leadac-warning)/10 px-3.5 py-2.5 text-[12.5px] text-(--leadac-text-2) flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-[var(--leadac-warning)] mt-0.5 shrink-0" />
              <span>
                Site responded with {audit.httpStatus ?? "4xx"} to our crawler.
                A real visitor can usually still open it — open the URL manually
                before trusting these audit fields.
              </span>
            </div>
          </div>
        )}

        <SectionDivider />

        {/* Identity & SEO */}
        <Section
          icon={FileText}
          label="Identity & SEO"
          tone="info"
        >
          <IdentitySection audit={audit} />
        </Section>

        <SectionDivider />

        {/* Conversion features */}
        <Section
          icon={Target}
          label="Conversion features"
          tone="info"
        >
          <ConversionSection audit={audit} />
        </Section>

        {/* Niche product fit (if niche set) */}
        {(nicheSlug || subNicheSlug) && (
          <>
            <SectionDivider />
            <Section
              icon={Sparkles}
              label="Product fit"
              tone="info"
            >
              <NicheProductFitSection
                nicheSlug={nicheSlug}
                subNicheSlug={subNicheSlug}
                features={audit.rawFeaturesJson ?? null}
                hasContactForm={audit.hasContactForm}
                hasWhatsappLink={audit.hasWhatsappLink}
                hasEcommerce={audit.hasEcommerce}
                bookingProvider={audit.bookingProvider ?? null}
              />
            </Section>
          </>
        )}

        {/* Restaurant tech signals — fnb only */}
        {isFnb && audit.rawFeaturesJson && (
          <>
            <SectionDivider />
            <Section
              icon={() => <span className="text-[15px]" aria-hidden>🍽</span>}
              label="Restaurant tech signals"
              tone="info"
            >
              <RestaurantSignalsSection features={audit.rawFeaturesJson} />
            </Section>
          </>
        )}

        {/* Tech stack */}
        <SectionDivider />
        <Section icon={Layout} label="Tech stack" tone="info">
          <TechStackSection audit={audit} />
        </Section>

        {/* Trust & security */}
        <SectionDivider />
        <Section icon={ShieldCheck} label="Trust & security" tone="info">
          <SecuritySection audit={audit} />
        </Section>

        {/* Performance & accessibility */}
        {((audit.performanceHints && audit.performanceHints.length > 0) ||
          (audit.accessibilityIssues && audit.accessibilityIssues.length > 0) ||
          audit.loadTimeMs != null ||
          typeof audit.brokenLinksCount === "number") && (
          <>
            <SectionDivider />
            <Section icon={Gauge} label="Performance & accessibility" tone="info">
              <PerformanceSection audit={audit} />
            </Section>
          </>
        )}

        {/* Content quality (only when content check has been run) */}
        {contentCheck && (
          <>
            <SectionDivider />
            <Section icon={ScanSearch} label="Content quality check" tone="info">
              <ContentCheckSection result={contentCheck} />
            </Section>
          </>
        )}
      </Card>

      {/* Website search results — kept as a sibling card so the rep can
          dismiss the audit and still see what we found. */}
      {websiteSearch && (
        <WebsiteSearchInlineCard result={websiteSearch} />
      )}
    </div>
  );
}

/* ---------- Hero ---------- */

function HeroSection({
  websiteUrl,
  businessName,
  audit,
  auditSummary,
  contentCheckLoading,
  onCrawl,
  onContentCheck,
}: {
  websiteUrl: string | null;
  businessName: string;
  audit: WebsiteAudit;
  auditSummary: AuditSummary | null;
  contentCheckLoading: boolean;
  onCrawl: () => void;
  onContentCheck: () => void;
}) {
  const scorePct = auditSummary?.scorePercent ?? 0;
  const denom = auditSummary
    ? Math.max(1, auditSummary.totalChecks - (auditSummary.unknown ?? 0))
    : 0;
  const passed = auditSummary?.passed ?? 0;

  const scoreColor =
    scorePct >= 70
      ? "text-[var(--leadac-success)]"
      : scorePct >= 40
      ? "text-[var(--leadac-warning)]"
      : "text-[var(--leadac-error)]";

  const scoreLabel =
    scorePct >= 70
      ? "Healthy"
      : scorePct >= 40
      ? "Needs work"
      : "Weak";

  const reachableBadge: ReactNode = audit.reachable ? (
    <Badge variant="success" className="text-[10.5px] h-5 gap-1">
      <CircleCheck className="w-3 h-3" />
      Reachable
    </Badge>
  ) : audit.crawlError === "BOT_BLOCKED_4XX" ||
    (audit.httpStatus && audit.httpStatus >= 400 && audit.httpStatus < 500) ? (
    <Badge variant="warning" className="text-[10.5px] h-5">
      Bot blocked ({audit.httpStatus ?? "4xx"})
    </Badge>
  ) : audit.crawlError ? (
    <Badge variant="destructive" className="text-[10.5px] h-5">
      Crawl failed
    </Badge>
  ) : (
    <Badge variant="destructive" className="text-[10.5px] h-5">
      Unreachable
    </Badge>
  );

  const lastScanned = audit.crawlAttemptedAt
    ? formatRelativeTime(audit.crawlAttemptedAt)
    : null;

  const cleanUrl = websiteUrl
    ? websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")
    : null;

  return (
    <div className="relative overflow-hidden">
      {/* Subtle gradient backdrop */}
      <div
        className="absolute inset-0 opacity-60 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 20% 0%, hsl(var(--leadac-h) var(--leadac-s) 50% / 0.08), transparent 55%)",
        }}
        aria-hidden
      />
      <div className="relative px-4 sm:px-5 py-5 sm:py-6">
        <div className="flex items-start gap-4 sm:gap-5">
          {/* Score ring */}
          <div className="relative shrink-0">
            <CircularProgress value={scorePct} size={84} strokeWidth={6} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-[22px] font-semibold leading-none ${scoreColor}`}>
                {scorePct}
              </span>
              <span className="text-[9px] uppercase tracking-widest text-white/40 mt-1">
                /100
              </span>
            </div>
          </div>

          {/* Title + URL + status */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10.5px] uppercase tracking-widest text-white/40 font-medium">
                Website report
              </span>
              <span className="text-white/20" aria-hidden>•</span>
              <span className={`text-[10.5px] font-medium ${scoreColor}`}>
                {scoreLabel}
              </span>
            </div>
            <h2 className="text-[17px] sm:text-[19px] font-semibold text-white tracking-[-0.01em] truncate">
              {businessName}
            </h2>
            {cleanUrl && websiteUrl ? (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-1 text-[13px] text-(--leadac-500) hover:text-(--leadac-400) hover:underline transition-colors max-w-full"
              >
                <span className="truncate">{cleanUrl}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            ) : (
              <p className="mt-1 text-[13px] text-white/40">No URL on file</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {reachableBadge}
              {auditSummary && (
                <Badge variant="outline" className="text-[10.5px] h-5">
                  {passed}/{denom} checks passed
                </Badge>
              )}
              {lastScanned && (
                <span className="text-[11px] text-white/40 ml-1">
                  Scanned {lastScanned}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-4 flex flex-wrap items-center gap-2 pt-4 border-t border-white/5">
          <Button
            size="sm"
            variant="outline"
            onClick={onCrawl}
            className="h-8 gap-1.5 text-[12px] rounded-full"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Re-scan
          </Button>
          {websiteUrl && (
            <Button
              size="sm"
              variant="outline"
              onClick={onContentCheck}
              disabled={contentCheckLoading}
              className="h-8 gap-1.5 text-[12px] rounded-full"
            >
              {contentCheckLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ScanSearch className="w-3.5 h-3.5" />
              )}
              Content check
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- KPI strip ---------- */

function KpiStrip({
  audit,
  auditSummary,
}: {
  audit: WebsiteAudit;
  auditSummary: AuditSummary | null;
}) {
  const denom = auditSummary
    ? Math.max(1, auditSummary.totalChecks - (auditSummary.unknown ?? 0))
    : 0;
  const scorePct = auditSummary?.scorePercent ?? 0;

  const tiles: {
    label: string;
    value: string;
    suffix?: string;
    accent: "ok" | "warn" | "bad" | "neutral";
  }[] = [
    {
      label: "Score",
      value: auditSummary ? `${auditSummary.passed}/${denom}` : "—",
      accent: scorePct >= 70 ? "ok" : scorePct >= 40 ? "warn" : "bad",
    },
    {
      label: "Load time",
      value: audit.loadTimeMs != null ? `${audit.loadTimeMs}` : "—",
      suffix: audit.loadTimeMs != null ? "ms" : undefined,
      accent:
        audit.loadTimeMs == null
          ? "neutral"
          : audit.loadTimeMs < 1500
          ? "ok"
          : audit.loadTimeMs < 3500
          ? "warn"
          : "bad",
    },
    {
      label: "HTTPS",
      value: audit.https ? "Yes" : "No",
      accent: audit.https ? "ok" : "bad",
    },
    {
      label: "Mobile",
      value: audit.mobileFriendlyGuess ? "Yes" : "No",
      accent: audit.mobileFriendlyGuess ? "ok" : "bad",
    },
    {
      label: "Pages",
      value:
        typeof audit.pageCount === "number" && audit.pageCount > 0
          ? String(audit.pageCount)
          : "—",
      accent:
        typeof audit.pageCount === "number" && audit.pageCount >= 5
          ? "ok"
          : typeof audit.pageCount === "number" && audit.pageCount >= 2
          ? "warn"
          : "neutral",
    },
  ];

  return (
    <div className="px-4 sm:px-5 pb-4">
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {tiles.map((t) => (
          <KpiTile key={t.label} {...t} />
        ))}
      </div>
    </div>
  );
}

function KpiTile({
  value,
  suffix,
  label,
  accent,
}: {
  value: string;
  suffix?: string;
  label: string;
  accent: "ok" | "warn" | "bad" | "neutral";
}) {
  const color =
    accent === "ok"
      ? "text-[var(--leadac-success)]"
      : accent === "warn"
      ? "text-[var(--leadac-warning)]"
      : accent === "bad"
      ? "text-[var(--leadac-error)]"
      : "text-white";
  return (
    <div className="rounded-xl bg-white/4 border border-white/8 p-3 text-center">
      <p className={`text-[18px] sm:text-[20px] font-semibold tracking-[-0.02em] leading-none ${color}`}>
        {value}
        {suffix && (
          <span className="text-[11px] font-medium text-white/40 ml-0.5">{suffix}</span>
        )}
      </p>
      <p className="text-[10px] uppercase tracking-[0.08em] text-white/40 mt-1.5">
        {label}
      </p>
    </div>
  );
}

/* ---------- Reusable section primitives ---------- */

function SectionDivider() {
  return <div className="h-px bg-white/6" />;
}

function Section({
  icon: Icon,
  label,
  tone = "info",
  children,
}: {
  icon: LucideIcon | (() => ReactNode);
  label: string;
  tone?: "info";
  children: ReactNode;
}) {
  void tone;
  return (
    <div className="px-4 sm:px-5 py-4">
      <p className="text-[10.5px] uppercase tracking-widest text-white/45 font-medium mb-3 flex items-center gap-1.5">
        {typeof Icon === "function" && Icon.length === 0 ? (
          <Icon />
        ) : (
          <Icon className="w-3.5 h-3.5 text-(--leadac-500)" />
        )}
        {label}
      </p>
      {children}
    </div>
  );
}

function StatusChip({
  active,
  icon: Icon,
  label,
  hint,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  hint?: string;
}) {
  return (
    <div
      className="flex items-start gap-2 rounded-lg border px-2.5 py-2 transition-colors"
      style={{
        borderColor: active
          ? "color-mix(in oklab, var(--leadac-success) 25%, transparent)"
          : "rgba(255,255,255,0.07)",
        background: active
          ? "color-mix(in oklab, var(--leadac-success) 6%, transparent)"
          : "rgba(255,255,255,0.02)",
      }}
      title={hint}
    >
      <Icon
        className="w-3.5 h-3.5 mt-0.5 shrink-0"
        style={{
          color: active ? "var(--leadac-success)" : "rgba(255,255,255,0.3)",
        }}
      />
      <div className="min-w-0">
        <p
          className="text-[12px] font-medium leading-tight"
          style={{
            color: active
              ? "color-mix(in oklab, var(--leadac-success-soft) 95%, white)"
              : "rgba(255,255,255,0.55)",
          }}
        >
          {label}
        </p>
        {hint && (
          <p
            className="text-[10.5px] mt-0.5 leading-snug"
            style={{
              color: active
                ? "color-mix(in oklab, var(--leadac-success-soft) 70%, transparent)"
                : "rgba(255,255,255,0.35)",
            }}
          >
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------- Identity & SEO ---------- */

function IdentitySection({ audit }: { audit: WebsiteAudit }) {
  // Round 2 §3.9 — pre-Round-1 audits captured social platform default
  // copy (e.g. Instagram's "Create an account or log in to Instagram —
  // share what you're into …") into `metaDescription` because the
  // crawler treated the Instagram URL as a website. Strip those defaults
  // here so reps don't read them as the business's own SEO copy. The
  // backfill (P0.8) will rewrite the DB rows; this UI mask is the
  // defense-in-depth.
  const cleanedTitle =
    audit.title === "Instagram" || audit.title === "Facebook"
      ? null
      : audit.title;
  const cleanedMeta = isSocialPlatformDefaultMeta(audit.metaDescription)
    ? null
    : audit.metaDescription;

  const rows: { label: string; value: ReactNode }[] = [
    { label: "Title", value: cleanedTitle || <Muted>Missing</Muted> },
    {
      label: "Meta description",
      value: cleanedMeta || <Muted>Missing</Muted>,
    },
    { label: "H1", value: audit.h1 || <Muted>Missing</Muted> },
  ];

  return (
    <div className="space-y-3.5">
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[110px_1fr] gap-3">
            <span className="text-[12px] text-white/45">{r.label}</span>
            <span className="text-[13px] text-white/85 leading-snug min-w-0 wrap-break-word">
              {r.value}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatusChip
          active={!!audit.hasOpenGraph}
          icon={Layout}
          label="Open Graph"
          hint={audit.hasOpenGraph ? "Social previews ready" : "No og: tags"}
        />
        <StatusChip
          active={!!audit.hasTwitterCards}
          icon={Layout}
          label="Twitter Cards"
        />
        <StatusChip
          active={!!audit.hasFavicon}
          icon={Eye}
          label="Favicon"
        />
        <StatusChip
          active={!!audit.structuredDataPresent || (audit.schemaTypes?.length ?? 0) > 0}
          icon={Sparkles}
          label="Schema.org"
          hint={
            audit.schemaTypes && audit.schemaTypes.length > 0
              ? `${audit.schemaTypes.length} type(s)`
              : undefined
          }
        />
      </div>

      {audit.schemaTypes && audit.schemaTypes.length > 0 && (
        <div>
          <p className="text-[10.5px] uppercase tracking-[0.08em] text-white/40 mb-1.5">
            Schema types detected
          </p>
          <div className="flex flex-wrap gap-1.5">
            {audit.schemaTypes.map((t) => (
              <Badge key={t} variant="outline" className="text-[10.5px] h-5">
                {t}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Conversion features ---------- */

function ConversionSection({ audit }: { audit: WebsiteAudit }) {
  const features = [
    {
      label: "Contact form",
      active: audit.hasContactForm,
      icon: Mail,
      hint: audit.hasContactForm ? "Lead capture present" : "No form found",
    },
    {
      label: "WhatsApp",
      active: audit.hasWhatsappLink,
      icon: MessageCircle,
      hint: audit.hasWhatsappLink ? "Direct chat link" : "No WhatsApp link",
    },
    {
      label: "Booking",
      active: audit.hasBookingSystem,
      icon: Calendar,
      hint: audit.bookingProvider ?? (audit.hasBookingSystem ? "Booking flow" : "No booking flow"),
    },
    {
      label: "E-commerce",
      active: audit.hasEcommerce,
      icon: ShoppingBag,
      hint: audit.hasEcommerce ? "Shop / checkout signals" : "No shop on site",
    },
  ];

  const emails = (audit.contactEmails ?? []).filter(
    (e): e is string => typeof e === "string" && e.includes("@"),
  );
  const services = audit.servicesDetected ?? [];

  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {features.map((f) => (
          <StatusChip
            key={f.label}
            active={f.active}
            icon={f.icon}
            label={f.label}
            hint={f.hint}
          />
        ))}
      </div>

      {emails.length > 0 && (
        <div>
          <p className="text-[10.5px] uppercase tracking-[0.08em] text-white/40 mb-1.5">
            Contact emails ({emails.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {emails.slice(0, 6).map((e) => (
              <a
                key={e}
                href={`mailto:${e}`}
                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11.5px] text-white/85 hover:bg-white/10 hover:border-white/20 transition-colors"
              >
                <Mail className="w-3 h-3 text-(--leadac-500)" />
                <span className="truncate max-w-[180px]">{e}</span>
              </a>
            ))}
            {emails.length > 6 && (
              <span className="text-[11px] text-white/40 self-center">
                +{emails.length - 6} more
              </span>
            )}
          </div>
        </div>
      )}

      {services.length > 0 && (
        <div>
          <p className="text-[10.5px] uppercase tracking-[0.08em] text-white/40 mb-1.5">
            Detected services
          </p>
          <div className="flex flex-wrap gap-1.5">
            {services.map((s) => (
              <Badge key={s} variant="outline" className="text-[10.5px] h-5">
                {s}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Niche product fit ---------- */

interface AuditFeaturesForFit {
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
}

type ModuleStatus = "detected" | "weak" | "opportunity";

interface ModuleVerdict {
  module: string;
  status: ModuleStatus;
  detail: string;
}

function NicheProductFitSection({
  nicheSlug,
  subNicheSlug,
  features,
  hasContactForm,
  hasWhatsappLink,
  hasEcommerce,
  bookingProvider,
}: {
  nicheSlug: string | null;
  subNicheSlug: string | null;
  features: WebsiteAudit["rawFeaturesJson"];
  hasContactForm: boolean;
  hasWhatsappLink: boolean;
  hasEcommerce: boolean;
  bookingProvider: string | null;
}) {
  const resolvedSlug =
    subNicheSlug ?? nicheSlug ?? (subNicheSlug ? getParentOf(subNicheSlug) : null);
  const pack = resolvedSlug ? getNicheBySlug(resolvedSlug) : null;

  if (!pack || !pack.featuredProductModules || pack.featuredProductModules.length === 0) {
    return (
      <p className="text-[12.5px] text-white/45">
        No product modules mapped for this vertical.
      </p>
    );
  }

  const fitFeatures: AuditFeaturesForFit = {
    ...(features ?? {}),
    hasContactForm,
    hasWhatsappLink,
    hasEcommerce,
    bookingProvider,
  };

  const verdicts = pack.featuredProductModules.map((m) =>
    classifyModule(m, fitFeatures),
  );
  const detectedCount = verdicts.filter((v) => v.status === "detected").length;
  const opportunityCount = verdicts.filter((v) => v.status === "opportunity").length;

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px] text-white/65">
          Modules from your <span className="text-white/85 font-medium">{pack.label}</span> offer mapped to this site.
        </p>
        <div className="flex items-center gap-1.5">
          <Badge variant="success" className="text-[10px] h-5 px-1.5">
            {detectedCount} present
          </Badge>
          <Badge variant="warning" className="text-[10px] h-5 px-1.5">
            {opportunityCount} to pitch
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {verdicts.map((v) => (
          <ModuleChip key={v.module} verdict={v} />
        ))}
      </div>

      <div className="rounded-lg border border-white/5 bg-white/2 px-3 py-2.5">
        <div className="flex items-start gap-2">
          <Sparkles className="w-3.5 h-3.5 text-(--leadac-500) mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10.5px] uppercase tracking-[0.08em] text-white/40 mb-1">
              Pitch angle
            </p>
            <p className="text-[12.5px] text-white/75 leading-relaxed">
              {pack.pitchAngle}
            </p>
          </div>
        </div>
      </div>

      {pack.highValueSignals && pack.highValueSignals.length > 0 && (
        <CollapsibleHint
          label={`High-value signals to surface (${pack.highValueSignals.length})`}
        >
          <ul className="mt-2 space-y-1 pl-3.5">
            {pack.highValueSignals.map((sig) => (
              <li key={sig} className="text-[12px] text-white/55 leading-relaxed">
                · {sig}
              </li>
            ))}
          </ul>
        </CollapsibleHint>
      )}
    </div>
  );
}

function ModuleChip({ verdict }: { verdict: ModuleVerdict }) {
  const styles: Record<
    ModuleVerdict["status"],
    { border: string; bg: string; iconColor: string; labelColor: string; detailColor: string }
  > = {
    detected: {
      border: "color-mix(in oklab, var(--leadac-success) 25%, transparent)",
      bg: "color-mix(in oklab, var(--leadac-success) 6%, transparent)",
      iconColor: "var(--leadac-success)",
      labelColor: "color-mix(in oklab, var(--leadac-success-soft) 95%, white)",
      detailColor: "color-mix(in oklab, var(--leadac-success-soft) 70%, transparent)",
    },
    weak: {
      border: "color-mix(in oklab, var(--leadac-warning) 20%, transparent)",
      bg: "color-mix(in oklab, var(--leadac-warning) 5%, transparent)",
      iconColor: "var(--leadac-warning)",
      labelColor: "color-mix(in oklab, var(--leadac-warning-soft) 95%, white)",
      detailColor: "color-mix(in oklab, var(--leadac-warning-soft) 70%, transparent)",
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
      className="rounded-lg border px-3 py-2 flex items-start gap-2"
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

function classifyModule(
  moduleLabel: string,
  features: AuditFeaturesForFit | null,
): ModuleVerdict {
  const label = moduleLabel.toLowerCase();
  if (!features) {
    return {
      module: moduleLabel,
      status: "opportunity",
      detail: "Run a website audit to detect status",
    };
  }
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
  if (label.includes("delivery") || label.includes("takeaway") || label.includes("pickup")) {
    if (features.hasDeliveryIntegration) {
      return { module: moduleLabel, status: "detected", detail: "Delivery platform link found" };
    }
    return { module: moduleLabel, status: "opportunity", detail: "No delivery integration visible" };
  }
  if (label.includes("payment") || label.includes("tip") || label.includes("checkout")) {
    if (features.hasEcommerce) {
      return { module: moduleLabel, status: "weak", detail: "Payments inferred from e-commerce signals" };
    }
    return { module: moduleLabel, status: "opportunity", detail: "No payment-at-table flow on site" };
  }
  if (label.includes("feedback") || label.includes("review")) {
    if (features.hasContactForm) {
      return { module: moduleLabel, status: "weak", detail: "Contact form present (not dedicated feedback)" };
    }
    return { module: moduleLabel, status: "opportunity", detail: "No feedback capture surface" };
  }
  if (label.includes("loyalty") || label.includes("crm")) {
    return { module: moduleLabel, status: "opportunity", detail: "No loyalty / CRM surface visible" };
  }
  if (label.includes("recommendation") || label.includes("smart") || label.includes("ai ")) {
    return { module: moduleLabel, status: "opportunity", detail: "Personalization layer pitch opportunity" };
  }
  if (label.includes("promotion") || label.includes("marketing") || label.includes("campaign")) {
    if (features.hasContactForm) {
      return { module: moduleLabel, status: "weak", detail: "Lead capture present, no campaign engine" };
    }
    return { module: moduleLabel, status: "opportunity", detail: "No marketing automation visible" };
  }
  if (label.includes("whatsapp") || label.includes("chat")) {
    if (features.hasWhatsappLink) {
      return { module: moduleLabel, status: "detected", detail: "WhatsApp contact link found" };
    }
    return { module: moduleLabel, status: "opportunity", detail: "No chat / WhatsApp flow" };
  }
  if (label.includes("analytic") || label.includes("dashboard") || label.includes("report")) {
    return { module: moduleLabel, status: "opportunity", detail: "Internal dashboard pitch opportunity" };
  }
  if (label.includes("multi-branch") || label.includes("multi-location") || label.includes("centralised") || label.includes("centralized")) {
    return { module: moduleLabel, status: "opportunity", detail: "Group-level operations pitch opportunity" };
  }
  if (label.includes("kiosk") || label.includes("self-service") || label.includes("self service")) {
    return { module: moduleLabel, status: "opportunity", detail: "In-store kiosk pitch opportunity" };
  }
  return { module: moduleLabel, status: "opportunity", detail: "Pitch opportunity for this vertical" };
}

/* ---------- Restaurant signals ---------- */

function RestaurantSignalsSection({
  features,
}: {
  features: NonNullable<WebsiteAudit["rawFeaturesJson"]>;
}) {
  const signals = [
    {
      label: "QR menu",
      present: !!features.hasQrMenu,
      detail: features.detectedMenuTool
        ? `Detected: ${features.detectedMenuTool}`
        : "Not detected — primary sales opportunity",
      priority: "critical" as const,
    },
    {
      label: "Online reservation",
      present: !!features.hasOnlineReservation,
      detail: features.hasOnlineReservation
        ? "Reservation system found"
        : "No reservation integration",
      priority: "important" as const,
    },
    {
      label: "Delivery integration",
      present: !!features.hasDeliveryIntegration,
      detail: features.hasDeliveryIntegration
        ? "Delivery platform link found"
        : "No delivery platform embed",
      priority: "nice_to_have" as const,
    },
  ];

  // Semantic tone helper — collapses a trio of (present | critical | important | else)
  // onto the leadac success/error/warning tokens so all four UI roles (border,
  // bg, label, detail, icon) stay in lockstep even if the palette shifts.
  const toneOf = (s: {
    present: boolean;
    priority: "critical" | "important" | "nice_to_have";
  }) => {
    if (s.present) return "success" as const;
    if (s.priority === "critical") return "error" as const;
    if (s.priority === "important") return "warning" as const;
    return "neutral" as const;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {signals.map((s) => {
        const t = toneOf(s);
        const borderBg =
          t === "success"
            ? { borderColor: "color-mix(in oklab, var(--leadac-success) 25%, transparent)", background: "color-mix(in oklab, var(--leadac-success) 6%, transparent)" }
            : t === "error"
            ? { borderColor: "color-mix(in oklab, var(--leadac-error) 25%, transparent)", background: "color-mix(in oklab, var(--leadac-error) 5%, transparent)" }
            : t === "warning"
            ? { borderColor: "color-mix(in oklab, var(--leadac-warning) 20%, transparent)", background: "color-mix(in oklab, var(--leadac-warning) 4%, transparent)" }
            : { borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" };
        const labelColor =
          t === "success"
            ? "color-mix(in oklab, var(--leadac-success-soft) 95%, white)"
            : t === "error"
            ? "color-mix(in oklab, var(--leadac-error-soft) 95%, white)"
            : t === "warning"
            ? "color-mix(in oklab, var(--leadac-warning-soft) 95%, white)"
            : "rgba(255,255,255,0.8)";
        const detailColor =
          t === "success"
            ? "color-mix(in oklab, var(--leadac-success-soft) 70%, transparent)"
            : t === "error"
            ? "color-mix(in oklab, var(--leadac-error-soft) 75%, transparent)"
            : t === "warning"
            ? "color-mix(in oklab, var(--leadac-warning-soft) 70%, transparent)"
            : "rgba(255,255,255,0.45)";
        const Icon = s.present
          ? CircleCheck
          : s.priority === "critical"
          ? CircleX
          : s.priority === "important"
          ? AlertTriangle
          : Info;
        const iconColor =
          t === "success"
            ? "var(--leadac-success)"
            : t === "error"
            ? "var(--leadac-error)"
            : t === "warning"
            ? "var(--leadac-warning)"
            : "rgba(255,255,255,0.3)";
        return (
          <div
            key={s.label}
            className="rounded-lg border px-3 py-2.5 flex items-start gap-2"
            style={borderBg}
          >
            <Icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: iconColor }} />
            <div className="min-w-0">
              <p className="text-[12.5px] font-medium leading-tight" style={{ color: labelColor }}>
                {s.label}
              </p>
              <p className="text-[11px] mt-0.5 leading-snug" style={{ color: detailColor }}>
                {s.detail}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Tech stack ---------- */

function TechStackSection({ audit }: { audit: WebsiteAudit }) {
  const chips = [
    { active: !!audit.hasGoogleAnalytics, label: "Google Analytics", icon: Gauge },
    { active: !!audit.hasCookieConsent, label: "Cookie consent", icon: ShieldCheck },
    { active: !!audit.hasManifest, label: "PWA manifest", icon: Layout },
    { active: !!audit.hasServiceWorker, label: "Service worker", icon: Zap },
    { active: !!audit.hasResponsiveImages, label: "Responsive images", icon: Eye },
    { active: !!audit.hasFontDisplay, label: "Font display swap", icon: Eye },
  ];

  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {chips.map((c) => (
          <StatusChip key={c.label} active={c.active} icon={c.icon} label={c.label} />
        ))}
      </div>

      {(audit.cssFramework || (audit.fontsDetected && audit.fontsDetected.length > 0)) && (
        <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
          {audit.cssFramework && (
            <div className="min-w-0">
              <p className="text-[10.5px] uppercase tracking-[0.08em] text-white/40 mb-1">
                CSS framework
              </p>
              <p className="text-[12.5px] text-white/85">{audit.cssFramework}</p>
            </div>
          )}
          {audit.fontsDetected && audit.fontsDetected.length > 0 && (
            <div className="min-w-0">
              <p className="text-[10.5px] uppercase tracking-[0.08em] text-white/40 mb-1">
                Fonts ({audit.fontsDetected.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {audit.fontsDetected.slice(0, 6).map((f) => (
                  <Badge key={f} variant="outline" className="text-[10.5px] h-5">
                    {f}
                  </Badge>
                ))}
                {audit.fontsDetected.length > 6 && (
                  <span className="text-[11px] text-white/40 self-center">
                    +{audit.fontsDetected.length - 6}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Security ---------- */

function SecuritySection({ audit }: { audit: WebsiteAudit }) {
  const headers = audit.securityHeaders;
  const httpsChip: ReactNode = (
    <StatusChip
      active={audit.https}
      icon={Lock}
      label="HTTPS"
      hint={audit.https ? "TLS encrypted" : "Plain HTTP — at risk"}
    />
  );

  if (!headers) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{httpsChip}</div>
    );
  }

  const securityChips = [
    { active: headers.hasCSP, label: "CSP", hint: "Content Security Policy" },
    { active: headers.hasHSTS, label: "HSTS", hint: "Strict transport security" },
    { active: headers.hasXFrameOptions, label: "X-Frame-Options", hint: "Clickjacking guard" },
    { active: headers.hasXContentTypeOptions, label: "X-Content-Type", hint: "MIME sniffing guard" },
    { active: headers.hasReferrerPolicy, label: "Referrer-Policy" },
    { active: headers.hasPermissionsPolicy, label: "Permissions-Policy" },
  ];

  const enabledCount = securityChips.filter((c) => c.active).length;
  const totalCount = securityChips.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <ShieldAlert className="w-3.5 h-3.5 text-white/40" />
        <p className="text-[12px] text-white/60">
          {enabledCount}/{totalCount} security headers configured
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {httpsChip}
        {securityChips.map((c) => (
          <StatusChip
            key={c.label}
            active={c.active}
            icon={c.active ? ShieldCheck : ShieldAlert}
            label={c.label}
            hint={c.hint}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------- Performance & A11y ---------- */

function PerformanceSection({ audit }: { audit: WebsiteAudit }) {
  const loadMs = audit.loadTimeMs;
  const loadColor =
    loadMs == null
      ? "text-white/60"
      : loadMs < 1500
      ? "text-[var(--leadac-success)]"
      : loadMs < 3500
      ? "text-[var(--leadac-warning)]"
      : "text-[var(--leadac-error)]";

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap gap-2">
        <div className="rounded-lg bg-white/4 border border-white/8 px-3 py-2">
          <p className="text-[10.5px] uppercase tracking-[0.08em] text-white/40">
            Load time
          </p>
          <p className={`text-[15px] font-semibold ${loadColor}`}>
            {loadMs != null ? `${loadMs} ms` : "—"}
          </p>
        </div>
        {typeof audit.brokenLinksCount === "number" && audit.brokenLinksCount > 0 && (
          <div
            className="rounded-lg border px-3 py-2"
            style={{
              background: "color-mix(in oklab, var(--leadac-error) 6%, transparent)",
              borderColor: "color-mix(in oklab, var(--leadac-error) 25%, transparent)",
            }}
          >
            <p
              className="text-[10.5px] uppercase tracking-[0.08em]"
              style={{ color: "color-mix(in oklab, var(--leadac-error-soft) 80%, transparent)" }}
            >
              Broken links
            </p>
            <p
              className="text-[15px] font-semibold"
              style={{ color: "var(--leadac-error-soft)" }}
            >
              {audit.brokenLinksCount}
            </p>
          </div>
        )}
      </div>

      {audit.performanceHints && audit.performanceHints.length > 0 && (
        <div>
          <p className="text-[10.5px] uppercase tracking-[0.08em] text-white/40 mb-1.5">
            Performance hints
          </p>
          <ul className="space-y-1">
            {audit.performanceHints.map((hint, i) => (
              <li
                key={i}
                className="text-[12.5px] text-[var(--leadac-warning-soft)] flex items-start gap-1.5 leading-snug"
              >
                <Zap className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[var(--leadac-warning)]" />
                {hint}
              </li>
            ))}
          </ul>
        </div>
      )}

      {audit.accessibilityIssues && audit.accessibilityIssues.length > 0 && (
        <div>
          <p className="text-[10.5px] uppercase tracking-[0.08em] text-white/40 mb-1.5">
            Accessibility issues
          </p>
          <ul className="space-y-1">
            {audit.accessibilityIssues.map((issue, i) => (
              <li
                key={i}
                className="text-[12.5px] text-[var(--leadac-error-soft)] flex items-start gap-1.5 leading-snug"
              >
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[var(--leadac-error)]" />
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ---------- Content quality ---------- */

function ContentCheckSection({ result }: { result: ContentCheckResult }) {
  const verdictConfig: Record<
    ContentCheckResult["verdict"],
    { label: string; color: string; bg: string; Icon: typeof CircleX }
  > = {
    placeholder: {
      label: "Placeholder / empty site",
      color: "text-[var(--leadac-error)]",
      bg: "bg-[color-mix(in_oklab,var(--leadac-error)_6%,transparent)] border-[color-mix(in_oklab,var(--leadac-error)_20%,transparent)]",
      Icon: CircleX,
    },
    basic: {
      label: "Basic site",
      color: "text-[var(--leadac-warning)]",
      bg: "bg-[color-mix(in_oklab,var(--leadac-warning)_6%,transparent)] border-[color-mix(in_oklab,var(--leadac-warning)_20%,transparent)]",
      Icon: AlertTriangle,
    },
    developed: {
      label: "Developed site",
      color: "text-[var(--leadac-success)]",
      bg: "bg-[color-mix(in_oklab,var(--leadac-success)_6%,transparent)] border-[color-mix(in_oklab,var(--leadac-success)_20%,transparent)]",
      Icon: CircleCheck,
    },
    unreachable: {
      label: "Unreachable",
      color: "text-white/60",
      bg: "bg-white/5 border-white/10",
      Icon: CircleX,
    },
  };
  const config = verdictConfig[result.verdict] ?? verdictConfig.unreachable;
  const [showAll, setShowAll] = useState(false);
  const visibleSignals = showAll ? result.signals : result.signals.slice(0, 6);

  return (
    <div className="space-y-3.5">
      <div className={`rounded-lg border p-3.5 ${config.bg}`}>
        <div className="flex items-center gap-3 mb-2">
          <config.Icon className={`w-5 h-5 ${config.color}`} />
          <div className="flex-1 min-w-0">
            <p className={`font-semibold text-[13.5px] ${config.color}`}>
              {config.label}
            </p>
            <p className="text-[11px] text-white/45">Score: {result.score}/100</p>
          </div>
          <CircularProgress value={result.score} size={42} strokeWidth={4} />
        </div>
        <p className="text-[12.5px] text-white/72 leading-relaxed">{result.summary}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { value: result.wordCount.toLocaleString(), label: "Words" },
          { value: result.imageCount.toLocaleString(), label: "Images" },
          { value: result.internalLinkCount.toLocaleString(), label: "Links" },
          { value: `${(result.htmlSize / 1024).toFixed(0)}`, label: "KB" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg bg-white/4 border border-white/8 p-2.5 text-center">
            <p className="text-[15px] font-semibold text-white">{stat.value}</p>
            <p className="text-[10px] uppercase tracking-[0.08em] text-white/40 mt-0.5">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {result.builderDetected && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-(--leadac-500)/6 border border-(--leadac-500)/20">
          <Info className="w-3.5 h-3.5 text-(--leadac-500) shrink-0" />
          <span className="text-[12.5px] text-(--leadac-200)">
            Built with <strong className="text-white/90">{result.builderDetected}</strong>
          </span>
        </div>
      )}

      <div>
        <p className="text-[10.5px] uppercase tracking-[0.08em] text-white/40 mb-1.5">
          Detailed analysis
        </p>
        <div className="space-y-0.5">
          {visibleSignals.map((signal, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 py-1.5 border-b border-white/5 last:border-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    signal.status === "good"
                      ? "bg-[var(--leadac-success)]"
                      : signal.status === "warning"
                      ? "bg-[var(--leadac-warning)]"
                      : "bg-[var(--leadac-error)]"
                  }`}
                />
                <span className="text-[12.5px] font-medium text-white/80 truncate">
                  {signal.label}
                </span>
              </div>
              <span className="text-[12px] text-white/50 text-right max-w-[55%] truncate">
                {signal.detail}
              </span>
            </div>
          ))}
        </div>
        {result.signals.length > 6 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 text-[11.5px] text-white/55 hover:text-white/80 transition-colors"
          >
            {showAll ? (
              <>
                <EyeOff className="w-3 h-3" />
                Show less
              </>
            ) : (
              <>
                <Eye className="w-3 h-3" />
                Show all {result.signals.length} signals
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- Empty hero ---------- */

function EmptyHeroCard({
  hasWebsite,
  websiteUrl,
  businessName,
  onCrawl,
  onWebsiteSearch,
  websiteSearchLoading,
}: {
  hasWebsite: boolean;
  websiteUrl: string | null;
  businessName: string;
  onCrawl: () => void;
  onWebsiteSearch: () => void;
  websiteSearchLoading: boolean;
}) {
  void websiteUrl;
  void businessName;
  return (
    <Card>
      <CardContent className="py-12 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-4">
          <Globe className="w-7 h-7 text-white/40" />
        </div>
        <p className="text-[16px] font-semibold text-white">
          {hasWebsite ? "Website not scanned yet" : "No website on file"}
        </p>
        <p className="text-[13px] text-white/55 mt-1 max-w-sm leading-relaxed">
          {hasWebsite
            ? "Run a scan to extract technical signals, conversion features, security headers and product-fit signals all in one report."
            : "Search the web for an active domain matching this business — we'll auto-save the first match."}
        </p>
        {hasWebsite ? (
          <Button onClick={onCrawl} className="mt-5 h-10 rounded-full px-5 gap-2">
            <Globe className="w-4 h-4" />
            Scan website
          </Button>
        ) : (
          <Button
            onClick={onWebsiteSearch}
            disabled={websiteSearchLoading}
            className="mt-5 h-10 rounded-full px-5 gap-2"
          >
            {websiteSearchLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Find website
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Website search inline card ---------- */

function WebsiteSearchInlineCard({ result }: { result: WebsiteSearchResult }) {
  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-(--leadac-500)" />
          <p className="text-[13px] font-medium text-white/85">
            Web search results
          </p>
          <span className="text-[11px] text-white/40 ml-auto">
            {result.searchedCount} addresses scanned
          </span>
        </div>
        {result.found ? (
          <>
            <div
              className="rounded-lg border px-3 py-2 flex items-center gap-2"
              style={{
                borderColor: "color-mix(in oklab, var(--leadac-success) 20%, transparent)",
                background: "color-mix(in oklab, var(--leadac-success) 6%, transparent)",
              }}
            >
              <CircleCheck
                className="w-4 h-4 shrink-0"
                style={{ color: "var(--leadac-success)" }}
              />
              <p
                className="text-[12.5px]"
                style={{ color: "color-mix(in oklab, var(--leadac-success-soft) 95%, white)" }}
              >
                {result.websites.length} website(s) found — first match saved.
              </p>
            </div>
            <div className="space-y-1.5">
              {result.websites.map((w, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-white/8 bg-white/2 px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <a
                        href={w.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[12.5px] font-medium text-(--leadac-500) hover:underline break-all"
                      >
                        {w.url}
                      </a>
                      {w.title && (
                        <p className="text-[11px] text-white/45 mt-0.5 truncate">
                          {w.title}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge
                        variant={w.source === "google_search" ? "secondary" : "outline"}
                        className="text-[10px] h-5"
                      >
                        {w.source === "google_search" ? "Google" : "Domain"}
                      </Badge>
                      {i === 0 && (
                        <Badge variant="success" className="text-[10px] h-5">
                          Saved
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-white/8 bg-white/2 px-3 py-3 flex items-start gap-2">
            <CircleX className="w-4 h-4 text-white/30 mt-0.5" />
            <div>
              <p className="text-[12.5px] font-medium text-white/70">
                No website found
              </p>
              <p className="text-[11.5px] text-white/45 mt-0.5">
                We checked {result.searchedCount} domain candidates and Google
                results. Likely no live site exists.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Small helpers ---------- */

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-white/40">{children}</span>;
}

function CollapsibleHint({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-[11.5px] text-white/45 hover:text-white/70 transition-colors"
      >
        <ChevronDown
          className={`w-3 h-3 transition-transform ${open ? "rotate-0" : "-rotate-90"}`}
        />
        {label}
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  );
}

/** Compact relative-time ("3h ago", "5d ago", "just now"). */
function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  if (diff < 60_000) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}
