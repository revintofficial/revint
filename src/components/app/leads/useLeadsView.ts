"use client";

/**
 * View state for the leads list. The view is intentionally separate
 * from `LeadsFilters` because it does NOT affect the API query — it
 * only changes how the same leads are rendered. Keeping it out of
 * `LeadsFilters` means the data hook can de-dupe identical fetches
 * across view switches (table → cards → kanban) so we don't re-hit
 * `/api/leads` for free.
 *
 * URL contract:
 *   /app/leads?view=table     (default; omitted from URL)
 *   /app/leads?view=cards
 *   /app/leads?view=map
 *   /app/leads?view=kanban
 *
 * The page component owns the state; this module just centralises the
 * vocabulary so every consumer (filters bar, switcher, dynamic
 * imports) speaks the same dialect.
 */
export type LeadsView = "table" | "cards" | "map" | "kanban";

export const LEADS_VIEWS: LeadsView[] = ["table", "cards", "map", "kanban"];
export const DEFAULT_LEADS_VIEW: LeadsView = "table";

export function parseLeadsView(value: string | null | undefined): LeadsView {
  if (!value) return DEFAULT_LEADS_VIEW;
  return (LEADS_VIEWS as string[]).includes(value)
    ? (value as LeadsView)
    : DEFAULT_LEADS_VIEW;
}
