"use client";

import { MarketingTracker } from "@/components/analytics/marketing-tracker";

/**
 * SiteAnalytics — mounted once under (site)/layout.tsx.
 *
 * Currently a thin wrapper around the existing MarketingTracker so we don't
 * duplicate the first-party tracker logic. When Wave 4 deletes the legacy
 * (marketing) tree, the underlying file moves into this folder and the
 * `/api/track/marketing` endpoint is renamed to `/api/track/site`.
 *
 * Keeping the wrapper means every (site)/* page imports a stable symbol
 * regardless of where the implementation lives.
 */
export function SiteAnalytics() {
  return <MarketingTracker />;
}
