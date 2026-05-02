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
  GitBranch,
  Users,
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
  inWatchlist: boolean;
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
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsError, setLeadsError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setLeadHits([]);
      setLeadsError(null);
      setLeadsLoading(false);
      setHighlight(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setLeadHits([]);
      setLeadsError(null);
      setLeadsLoading(false);
      return;
    }
    const ctl = new AbortController();
    setLeadsLoading(true);
    setLeadsError(null);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/leads?search=${encodeURIComponent(trimmed)}&limit=8`,
          { signal: ctl.signal }
        );
        if (!res.ok) {
          setLeadHits([]);
          setLeadsError(
            res.status === 401
              ? "Please sign in again to search leads."
              : `Search failed (${res.status})`
          );
          return;
        }
        const data = await res.json();
        setLeadHits(
          (data.leads || [])
            .slice(0, 8)
            .map(
              (l: {
                id: string;
                businessName: string;
                borough: string | null;
                formattedAddress?: string | null;
                watchlistItem?: { id: string } | null;
              }) => ({
                id: l.id,
                businessName: l.businessName,
                borough: l.borough || l.formattedAddress || null,
                inWatchlist: !!l.watchlistItem,
              })
            )
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLeadsError("Search failed. Check your connection.");
      } finally {
        setLeadsLoading(false);
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
        icon: Users,
        group: "Leads",
      })),
    [leadHits]
  );

  // For leads on the pipeline we surface a deep-link that opens the deal's
  // side panel on the Deals board via the ?lead= query param.
  const dealsResults: Result[] = useMemo(
    () =>
      leadHits
        .filter((l) => l.inWatchlist)
        .map((l) => ({
          id: `deal:${l.id}`,
          label: l.businessName,
          hint: "Open in Deals",
          href: `/app/deals?lead=${l.id}`,
          icon: GitBranch,
          group: "Deals",
        })),
    [leadHits]
  );

  const allResults = useMemo(
    () => [
      ...navResults,
      ...leadResults,
      ...dealsResults,
      ...actionResults,
    ],
    [navResults, leadResults, dealsResults, actionResults]
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
        style={{ background: "hsl(var(--leadac-h) var(--leadac-ns) 8% / 0.95)", border: "0.5px solid rgba(255, 255, 255, 0.1)" }}
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search pages, actions, and leads
        </DialogDescription>

        <div
          className="flex items-center gap-3 px-4 py-3.5"
          style={{ borderBottom: "0.5px solid rgba(255, 255, 255, 0.08)" }}
        >
          <Search className="w-4 h-4 shrink-0" style={{ color: "var(--leadac-text-3)" }} />
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
              color: "var(--leadac-text-3)",
            }}
          >
            ESC
          </kbd>
        </div>

        <div className="max-h-[420px] overflow-y-auto py-2">
          {leadsError && (
            <div
              className="mx-3 mb-2 px-3 py-2 rounded-lg text-[12px]"
              style={{
                background: "color-mix(in oklab, var(--leadac-error) 12%, transparent)",
                color: "var(--leadac-error-soft)",
              }}
            >
              {leadsError}
            </div>
          )}
          {allResults.length === 0 && !leadsLoading && (
            <div className="px-5 py-10 text-center text-[13px] text-white/40">
              {query.trim() ? "No results. Try another search." : "Start typing a business name, address, or phone…"}
            </div>
          )}
          {allResults.length === 0 && leadsLoading && (
            <div className="px-5 py-10 text-center text-[13px] text-white/40">
              Searching leads…
            </div>
          )}

          {(["Navigate", "Leads", "Shortlist", "Pipeline", "Actions"] as const).map((group) => {
            const items = allResults.filter((r) => r.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className="px-2 mb-2 last:mb-0">
                <p
                  className="px-3 py-1 text-[10px] uppercase tracking-wider font-semibold"
                  style={{ color: "hsl(var(--leadac-h) var(--leadac-nts) 92% / 0.35)" }}
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
                        background: isActive ? "hsl(var(--leadac-h) var(--leadac-s) 50% / 0.13)" : "transparent",
                        color: isActive ? "white" : "hsl(var(--leadac-h) var(--leadac-nts) 92% / 0.85)",
                      }}
                    >
                      {Icon && (
                        <Icon
                          className="w-3.5 h-3.5 shrink-0"
                          style={{ color: isActive ? "var(--leadac-500)" : "var(--leadac-text-3)" }}
                        />
                      )}
                      <span className="flex-1 truncate font-medium">{r.label}</span>
                      {r.hint && (
                        <span className="text-[11px]" style={{ color: "var(--leadac-text-3)" }}>
                          {r.hint}
                        </span>
                      )}
                      <ArrowRight
                        className="w-3 h-3 shrink-0 opacity-0 transition-opacity"
                        style={{ opacity: isActive ? 1 : 0, color: "var(--leadac-text-3)" }}
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
