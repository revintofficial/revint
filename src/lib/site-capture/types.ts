// src/lib/site-capture/types.ts
/**
 * Shared shapes of the site capture: what a page is, what was kept of it,
 * and what happened to every address that was discovered.
 * Spec: docs/superpowers/specs/2026-10-03-site-yakalama-design.md
 */

export type PageType =
  | "home"
  | "menu"
  | "reservation"
  | "order"
  | "faq"
  | "events"
  | "locations"
  | "contact"
  | "about"
  | "other"
  | "external";

export type CandidateSource = "home_link" | "page_link" | "sitemap" | "known_path";

export interface Candidate {
  url: string;
  type: PageType;
  source: CandidateSource;
  /** 1 = linked from the homepage (or sitemap / known path); 2 = linked from a depth-1 page. */
  depth: number;
  linkText: string | null;
  /** One of today's three subpages (pickSubpages): opened first, exempt from type caps and robots. */
  pinned?: boolean;
}

/** What is kept of a page. Raw HTML is never stored. */
export interface ReducedPage {
  title: string | null;
  /** Visible text, at most 60,000 characters, no NUL bytes. */
  text: string;
  links: Array<{ text: string; href: string }>;
  /** Absolute iframe / script / embed addresses. */
  embeds: string[];
  jsonLd: unknown[];
}

export type PageSource = "browser" | "http" | "pdf";

export interface CapturedPage extends ReducedPage {
  /** The address that was asked for. */
  url: string;
  /** Where the navigation ended. */
  finalUrl: string;
  type: PageType;
  httpStatus: number | null;
  /** origin + path of third-party script / xhr / fetch / sub-frame requests. */
  thirdPartyRequests: string[];
  source: PageSource;
  /** A PDF without a text layer. */
  needsOcr: boolean;
  /** In memory only (pinned, locations, contact, about pages); never persisted. */
  html: string | null;
}

export type LedgerOutcome = "opened" | "skipped" | "failed";

export type LedgerReason =
  | "limit_type"
  | "limit_total"
  | "budget"
  | "aborted"
  | "duplicate"
  | "robots_disallow"
  | "timeout"
  | "http_error"
  | "blocked"
  | "offsite"
  | "too_large"
  | "not_pdf"
  | "nav_error"
  | "unsafe_url";

export interface LedgerEntry {
  url: string;
  finalUrl: string | null;
  type: PageType;
  source: CandidateSource | "pdf_link";
  outcome: LedgerOutcome;
  /** `null` only when `outcome` is "opened". */
  reason: LedgerReason | null;
  httpStatus: number | null;
}

export type CaptureStatus = "complete" | "partial" | "blocked" | "failed";

export interface SiteCaptureResult {
  rootUrl: string;
  status: CaptureStatus;
  /** ISO timestamp. */
  startedAt: string;
  durationMs: number;
  pages: CapturedPage[];
  ledger: LedgerEntry[];
  /** How many addresses the sitemap listed (only the first 150 by priority become candidates). */
  sitemapUrlCount: number;
  /** Addresses found after the candidate cap was reached: counted, not opened, not in the ledger. */
  candidateOverflow: number;
}

export interface OpenedPage {
  finalUrl: string;
  status: number | null;
  /** `null` when the page could not be read. */
  html: string | null;
  thirdPartyRequests: string[];
  source: PageSource;
  error: LedgerReason | null;
}

export interface PageOpener {
  open(url: string, opts: { timeoutMs: number; signal?: AbortSignal }): Promise<OpenedPage>;
  close(): Promise<void>;
}

/** Compact ledger summary carried on SiteFacts (the full ledger lives on SiteCapture). */
export interface SiteCoverage {
  status: CaptureStatus;
  opened: number;
  skipped: number;
  failed: number;
  durationMs: number;
  /** `SiteCaptureResult.candidateOverflow`; absent on rows written before it existed (read as 0). */
  overflow?: number;
  /** Up to 15 addresses that were not read, failures first. */
  notOpened: Array<{ url: string; type: PageType; reason: LedgerReason }>;
}
