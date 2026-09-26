import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/logs", id: "runtime", label: "App & workers" },
  { href: "/admin/errors", id: "client", label: "Browser & vitals" },
] as const;

export function LogsTabs({ current }: { current: "runtime" | "client" }) {
  return (
    <div className="flex gap-1 rounded-lg border border-[var(--revint-border)] bg-[var(--revint-card)] p-1 w-fit">
      {TABS.map((tab) => {
        const active = tab.id === current;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm transition-colors",
              active
                ? "bg-[var(--revint-hover)] text-[var(--revint-text-1)]"
                : "text-[var(--revint-text-2)] hover:text-[var(--revint-text-1)]",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
