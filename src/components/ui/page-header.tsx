import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, breadcrumb, className }: PageHeaderProps) {
  return (
    <div className={cn("space-y-1", className)}>
      {breadcrumb && <div className="mb-2">{breadcrumb}</div>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight text-white break-words">
            {title}
          </h1>
          {subtitle && (
            <p
              className="text-[13.5px] sm:text-[15px] mt-1"
              style={{ color: "hsl(var(--leadac-h) var(--leadac-nts) 92% / 0.6)" }}
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
