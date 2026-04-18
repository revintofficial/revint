"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Search,
  ArrowRight,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: LucideIcon };

interface Result {
  id: string;
  label: string;
  hint?: string;
  href?: string;
  action?: () => void;
  icon?: LucideIcon;
  group: string;
}

interface LeadHit {
  id: string;
  businessName: string;
  borough: string | null;
}

export function CommandPalette({
  open,
  onClose,
  navItems,
}: {
  open: boolean;
  onClose: () => void;
  navItems: NavItem[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [leadHits, setLeadHits] = useState<LeadHit[]>([]);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setLeadHits([]);
      setHighlight(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setLeadHits([]);
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/leads?search=${encodeURIComponent(query)}&limit=6`,
          { signal: ctl.signal }
        );
        if (!res.ok) return;
        const data = await res.json();
        setLeadHits(
          (data.leads || []).slice(0, 6).map((l: { id: string; businessName: string; borough: string | null }) => ({
            id: l.id,
            businessName: l.businessName,
            borough: l.borough,
          }))
        );
      } catch {
        // aborted
      }
    }, 180);
    return () => {
      ctl.abort();
      clearTimeout(t);
    };
  }, [query]);

  const navResults: Result[] = useMemo(
    () =>
      navItems
        .filter((n) =>
          query
            ? n.label.toLowerCase().includes(query.toLowerCase())
            : true
        )
        .map((n) => ({
          id: `nav:${n.href}`,
          label: n.label,
          hint: "Go to page",
          href: n.href,
          icon: n.icon,
          group: "Navigate",
        })),
    [navItems, query]
  );

  const actionResults: Result[] = useMemo(() => {
    const all: Result[] = [
      {
        id: "action:discover",
        label: "Discover new leads",
        hint: "Search local businesses",
        href: "/app/discovery",
        icon: Sparkles,
        group: "Actions",
      },
      {
        id: "action:analyze",
        label: "Run AI analysis on pending leads",
        hint: "Score with Gemini",
        href: "/app/discovery",
        icon: Sparkles,
        group: "Actions",
      },
      {
        id: "action:billing",
        label: "Manage billing",
        hint: "Plan & invoices",
        href: "/app/settings/billing",
        icon: Sparkles,
        group: "Actions",
      },
    ];
    if (!query) return all;
    return all.filter((r) =>
      r.label.toLowerCase().includes(query.toLowerCase())
    );
  }, [query]);

  const leadResults: Result[] = useMemo(
    () =>
      leadHits.map((l) => ({
        id: `lead:${l.id}`,
        label: l.businessName,
        hint: l.borough || "Lead",
        href: `/app/leads/${l.id}`,
        group: "Leads",
      })),
    [leadHits]
  );

  const allResults = useMemo(
    () => [...navResults, ...leadResults, ...actionResults],
    [navResults, leadResults, actionResults]
  );

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  function selectResult(r: Result) {
    onClose();
    if (r.href) router.push(r.href);
    if (r.action) r.action();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, allResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = allResults[highlight];
      if (r) selectResult(r);
    }
  }

  let runningIdx = 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="sm:max-w-[600px] p-0 gap-0 top-[20%] translate-y-0"
        style={{ background: "rgba(20, 20, 22, 0.95)", border: "0.5px solid rgba(255, 255, 255, 0.1)" }}
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search pages, actions, and leads
        </DialogDescription>

        <div
          className="flex items-center gap-3 px-4 py-3.5"
          style={{ borderBottom: "0.5px solid rgba(255, 255, 255, 0.08)" }}
        >
          <Search className="w-4 h-4 shrink-0" style={{ color: "rgba(235, 235, 245, 0.5)" }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages, actions, and leads…"
            className="flex-1 bg-transparent outline-none text-[14px] text-white placeholder:text-white/40"
            aria-label="Command palette search"
          />
          <kbd
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              color: "rgba(235, 235, 245, 0.5)",
            }}
          >
            ESC
          </kbd>
        </div>

        <div className="max-h-[420px] overflow-y-auto py-2">
          {allResults.length === 0 && (
            <div className="px-5 py-10 text-center text-[13px] text-white/40">
              No results. Try another search.
            </div>
          )}

          {(["Navigate", "Leads", "Actions"] as const).map((group) => {
            const items = allResults.filter((r) => r.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className="px-2 mb-2 last:mb-0">
                <p
                  className="px-3 py-1 text-[10px] uppercase tracking-wider font-semibold"
                  style={{ color: "rgba(235, 235, 245, 0.35)" }}
                >
                  {group}
                </p>
                {items.map((r) => {
                  const idx = runningIdx++;
                  const isActive = idx === highlight;
                  const Icon = r.icon;
                  return (
                    <button
                      key={r.id}
                      onMouseEnter={() => setHighlight(idx)}
                      onClick={() => selectResult(r)}
                      className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left text-[13px]"
                      style={{
                        background: isActive ? "rgba(10, 132, 255, 0.13)" : "transparent",
                        color: isActive ? "white" : "rgba(235, 235, 245, 0.85)",
                      }}
                    >
                      {Icon && (
                        <Icon
                          className="w-3.5 h-3.5 shrink-0"
                          style={{ color: isActive ? "#0A84FF" : "rgba(235, 235, 245, 0.5)" }}
                        />
                      )}
                      <span className="flex-1 truncate font-medium">{r.label}</span>
                      {r.hint && (
                        <span className="text-[11px]" style={{ color: "rgba(235, 235, 245, 0.4)" }}>
                          {r.hint}
                        </span>
                      )}
                      <ArrowRight
                        className="w-3 h-3 shrink-0 opacity-0 transition-opacity"
                        style={{ opacity: isActive ? 1 : 0, color: "rgba(235, 235, 245, 0.5)" }}
                      />
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
