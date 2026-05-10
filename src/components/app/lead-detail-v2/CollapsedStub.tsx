"use client";

/**
 * CollapsedStub — one-line stub renderer used by all five reorder-able
 * blocks (WHO / DISCOVERY / QUALIFICATION / HISTORY / ACCOUNT).
 *
 * Already-collapsed stub chrome inside `<Block />` lives in
 * `Block.tsx`; this component is what gets rendered as the stub
 * `summary` *content* — the icon + title + preview + chevron row.
 * It is also reused inside the expanded-block header when a block
 * is rendered with a single click-to-collapse target.
 */

import { type ReactNode } from "react";

import { ChevronRight, Lock } from "lucide-react";

export interface CollapsedStubProps {
  icon?: ReactNode;
  title: string;
  preview?: string | null;
  onExpand?: () => void;
  locked?: boolean;
}

export function CollapsedStub({
  icon,
  title,
  preview,
  onExpand,
  locked,
}: CollapsedStubProps) {
  const Wrapper: "button" | "div" = onExpand ? "button" : "div";
  const interactive = Wrapper === "button";
  return (
    <Wrapper
      type={interactive ? "button" : undefined}
      onClick={onExpand}
      disabled={interactive ? locked : undefined}
      aria-disabled={locked || undefined}
      className={
        "flex w-full items-center gap-3 px-1 py-1.5 text-left text-[13px] transition-colors " +
        (interactive
          ? "rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--leadac-500)/55"
          : "")
      }
      style={{ color: "var(--leadac-text-2)", minHeight: 24 }}
    >
      {icon ? (
        <span
          aria-hidden
          className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[12px]"
          style={{
            background: "hsl(0 0% 100% / 0.04)",
            color: "var(--leadac-text-3)",
          }}
        >
          {icon}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span
          className="text-[11px] font-medium uppercase tracking-[0.08em]"
          style={{ color: "var(--leadac-text-3)" }}
        >
          {title}
        </span>
        {preview ? (
          <span className="truncate" style={{ color: "var(--leadac-text-2)" }}>
            {preview}
          </span>
        ) : null}
      </span>
      {locked ? (
        <Lock
          className="h-3.5 w-3.5 shrink-0"
          aria-hidden
          style={{ color: "var(--leadac-text-3)" }}
        />
      ) : interactive ? (
        <ChevronRight
          className="h-3.5 w-3.5 shrink-0"
          aria-hidden
          style={{ color: "var(--leadac-text-3)" }}
        />
      ) : null}
    </Wrapper>
  );
}
