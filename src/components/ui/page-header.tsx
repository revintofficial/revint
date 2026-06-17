import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /**
   * Optional breadcrumb / eyebrow row rendered above the title — useful
   * for nested routes that want the parent context (e.g. "Settings ›
   * Billing"). When omitted, the title sits flush at the top.
   */
  breadcrumb?: ReactNode;
  className?: string;
}

// Single source of truth for product page chrome. Every authed page
// should use this rather than hand-rolling its own <h1>; that's how the
// title size, subtitle color, and breadcrumb spacing stay aligned across
// dashboard / leads / settings / more.
export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumb,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("space-y-1", className)}>
      {breadcrumb && <div className="mb-2">{breadcrumb}</div>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1
            className="font-bold tracking-tight wrap-break-word"
            style={{
              color: "var(--revint-text-1)",
              fontSize: "var(--text-title-1)",
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className="mt-1"
              style={{
                color: "var(--revint-text-2)",
                fontSize: "var(--text-callout)",
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-wrap -mx-1 sm:mx-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
