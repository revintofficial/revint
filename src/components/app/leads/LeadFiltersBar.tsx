"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Compass,
  Filter,
  Flame,
  GanttChart,
  Globe,
  Kanban,
  LayoutGrid,
  List,
  Loader2,
  MapPin,
  Rows,
  Search,
  Star,
  X,
  ZoomIn,
} from "lucide-react";
import { OUTREACH_LABELS } from "@/lib/labels";
import { DEFAULT_LOCATIONS } from "@/lib/constants";
import type { LeadsFilters } from "@/components/app/leads/useLeadsQuery";
import type { LeadsView } from "@/components/app/leads/useLeadsView";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  ...Object.entries(OUTREACH_LABELS).map(([value, label]) => ({ value, label })),
  { value: "unscored", label: "Unscored" },
];

interface NicheOption {
  slug: string;
  label: string;
  parentSlug?: string;
  count?: number;
}

export interface LeadFiltersBarProps {
  filters: LeadsFilters;
  setFilters: (next: LeadsFilters | ((prev: LeadsFilters) => LeadsFilters)) => void;
  density: "comfortable" | "compact";
  setDensity: (next: "comfortable" | "compact") => void;
  view: LeadsView;
  setView: (next: LeadsView) => void;
  geoActive: boolean;
  totalCount: number;
}

export function LeadFiltersBar({
  filters,
  setFilters,
  density,
  setDensity,
  view,
  setView,
  geoActive,
  totalCount,
}: LeadFiltersBarProps) {
  const [searchInput, setSearchInput] = useState(filters.search);
  const [niches, setNiches] = useState<NicheOption[]>([]);
  const [subNiches, setSubNiches] = useState<NicheOption[]>([]);
  const [niceLoading, setNicheLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);

  // Debounce search.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        setFilters((prev) => ({ ...prev, search: searchInput, page: 1 }));
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput, filters.search, setFilters]);

  // Sync external filter resets back into the input.
  useEffect(() => {
    if (filters.search !== searchInput) {
      setSearchInput(filters.search);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search]);

  // Pull niches / sub-niches from the workspace endpoint.
  useEffect(() => {
    let alive = true;
    setNicheLoading(true);
    fetch("/api/leads/sub-niches")
      .then((res) => (res.ok ? res.json() : { niches: [], subNiches: [] }))
      .then((data) => {
        if (!alive) return;
        setNiches(data.niches || []);
        setSubNiches(data.subNiches || []);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setNicheLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const activeQuickFilter = useQuickFilterMatch(filters);

  const visibleSubNiches = useMemo(() => {
    if (filters.niche === "all") return subNiches;
    return subNiches.filter((s) => s.parentSlug === filters.niche);
  }, [subNiches, filters.niche]);

  const handleStatusToggle = (value: string) => {
    setFilters((prev) => {
      const next = prev.statuses.includes(value)
        ? prev.statuses.filter((s) => s !== value)
        : [...prev.statuses, value];
      return { ...prev, statuses: next, page: 1 };
    });
  };

  const handleClearStatuses = () => {
    setFilters((prev) => ({ ...prev, statuses: [], page: 1 }));
  };

  const enableNearMe = () => {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFilters((prev) => ({
          ...prev,
          userLat: pos.coords.latitude,
          userLng: pos.coords.longitude,
          withinMiles: prev.withinMiles ?? 5,
          sortBy: "nearest",
          page: 1,
        }));
        setGeoLoading(false);
      },
      () => {
        setGeoLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const disableNearMe = () => {
    setFilters((prev) => ({
      ...prev,
      userLat: null,
      userLng: null,
      withinMiles: null,
      sortBy: prev.sortBy === "nearest" ? "createdAt" : prev.sortBy,
      page: 1,
    }));
  };

  const applyQuickFilter = (key: QuickFilterKey) => {
    setFilters((prev) => {
      const cleared: LeadsFilters = {
        ...prev,
        statuses: [],
        minScore: 0,
        maxScore: 100,
        hasWebsite: "all",
        page: 1,
      };
      switch (key) {
        case "hot":
          return { ...cleared, minScore: 70, sortBy: "score" };
        case "no_site":
          return { ...cleared, hasWebsite: "false" };
        case "low_rating":
          return { ...cleared, sortBy: "rating" };
        case "scan_failed":
          return { ...cleared, statuses: ["unscored"] };
        case "never_contacted":
          return { ...cleared, statuses: ["NEW", "unscored"] };
        case "today":
          return { ...cleared, sortBy: "createdAt" };
      }
      return cleared;
    });
  };

  const resetAll = () => {
    setFilters((prev) => ({
      ...prev,
      search: "",
      borough: "all",
      hasWebsite: "all",
      statuses: [],
      niche: "all",
      subNiche: "all",
      minScore: 0,
      maxScore: 100,
      sortBy: "createdAt",
      page: 1,
      userLat: null,
      userLng: null,
      withinMiles: null,
    }));
    setSearchInput("");
  };

  const hasActiveFilters =
    filters.search ||
    filters.borough !== "all" ||
    filters.hasWebsite !== "all" ||
    filters.statuses.length > 0 ||
    filters.niche !== "all" ||
    filters.subNiche !== "all" ||
    filters.minScore > 0 ||
    filters.maxScore < 100 ||
    geoActive;

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Row 1: search, borough, website, sort */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input
              type="text"
              placeholder="Search businesses..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={filters.borough}
            onValueChange={(v) => setFilters((prev) => ({ ...prev, borough: v, page: 1 }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {DEFAULT_LOCATIONS.map((loc) => (
                <SelectItem key={loc.name} value={loc.name}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.hasWebsite}
            onValueChange={(v) =>
              setFilters((prev) => ({
                ...prev,
                hasWebsite: v as "all" | "true" | "false",
                page: 1,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Website" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any website state</SelectItem>
              <SelectItem value="true">Has Website</SelectItem>
              <SelectItem value="false">No Website</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.sortBy}
            onValueChange={(v) => setFilters((prev) => ({ ...prev, sortBy: v, page: 1 }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">Newest first</SelectItem>
              <SelectItem value="score">Score (high → low)</SelectItem>
              <SelectItem value="rating">Rating</SelectItem>
              <SelectItem value="reviewCount">Reviews</SelectItem>
              <SelectItem value="businessName">Name (A-Z)</SelectItem>
              {geoActive && <SelectItem value="nearest">Nearest</SelectItem>}
            </SelectContent>
          </Select>
        </div>

        {/* Row 2: status multi-select, niche, sub-niche, score slider */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex h-10 w-full items-center justify-between rounded-xl border px-3 py-2 text-sm text-white transition-colors duration-200"
                style={{
                  backgroundColor: "var(--leadac-card)",
                  borderColor: "var(--leadac-border)",
                }}
              >
                <span className="flex items-center gap-2 truncate">
                  <Filter className="w-4 h-4 text-white/40" />
                  {filters.statuses.length === 0
                    ? "Any status"
                    : `${filters.statuses.length} status${filters.statuses.length === 1 ? "" : "es"}`}
                </span>
                {filters.statuses.length > 0 && (
                  <span
                    className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
                    style={{
                      backgroundColor: "var(--leadac-500)",
                      color: "#fff",
                    }}
                  >
                    {filters.statuses.length}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2">
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-xs font-medium text-white/50">Filter by status</span>
                {filters.statuses.length > 0 && (
                  <button
                    onClick={handleClearStatuses}
                    className="text-[11px] text-(--leadac-300) hover:text-white"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="space-y-1">
                {STATUS_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={filters.statuses.includes(opt.value)}
                      onCheckedChange={() => handleStatusToggle(opt.value)}
                    />
                    <span className="text-sm text-white">{opt.label}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Select
            value={filters.niche}
            onValueChange={(v) =>
              setFilters((prev) => ({ ...prev, niche: v, subNiche: "all", page: 1 }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Niche" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All niches</SelectItem>
              {niches.map((n) => (
                <SelectItem key={n.slug} value={n.slug}>
                  {n.label}
                  {typeof n.count === "number" ? ` (${n.count})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.subNiche}
            onValueChange={(v) => setFilters((prev) => ({ ...prev, subNiche: v, page: 1 }))}
            disabled={visibleSubNiches.length === 0 || niceLoading}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={visibleSubNiches.length ? "Sub-niche" : "No sub-niches"}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sub-niches</SelectItem>
              {visibleSubNiches.map((sn) => (
                <SelectItem key={sn.slug} value={sn.slug}>
                  {sn.label}
                  {typeof sn.count === "number" ? ` (${sn.count})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <ScoreSliderField
            min={filters.minScore}
            max={filters.maxScore}
            onCommit={(min, max) =>
              setFilters((prev) => ({ ...prev, minScore: min, maxScore: max, page: 1 }))
            }
          />
        </div>

        {/* Row 3: quick filter ribbon */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-white/30 mr-1">
            Presets
          </span>
          <QuickChip
            active={activeQuickFilter === "hot"}
            onClick={() => applyQuickFilter("hot")}
            icon={<Flame className="w-3 h-3" />}
            label="Hot 70+"
          />
          <QuickChip
            active={activeQuickFilter === "no_site"}
            onClick={() => applyQuickFilter("no_site")}
            icon={<Globe className="w-3 h-3" />}
            label="No website"
          />
          <QuickChip
            active={activeQuickFilter === "low_rating"}
            onClick={() => applyQuickFilter("low_rating")}
            icon={<Star className="w-3 h-3" />}
            label="Reviews ≤ 3.5"
          />
          <QuickChip
            active={activeQuickFilter === "scan_failed"}
            onClick={() => applyQuickFilter("scan_failed")}
            icon={<X className="w-3 h-3" />}
            label="Unscored"
          />
          <QuickChip
            active={activeQuickFilter === "never_contacted"}
            onClick={() => applyQuickFilter("never_contacted")}
            icon={<GanttChart className="w-3 h-3" />}
            label="Never contacted"
          />
          <QuickChip
            active={activeQuickFilter === "today"}
            onClick={() => applyQuickFilter("today")}
            icon={<ZoomIn className="w-3 h-3" />}
            label="Today's new"
          />

          <div className="flex-1" />

          {/* Near me toggle */}
          {geoActive ? (
            <button
              onClick={disableNearMe}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border border-(--leadac-500)/40 bg-(--leadac-500)/15 text-(--leadac-200) hover:bg-(--leadac-500)/25 transition-colors"
            >
              <Compass className="w-3 h-3" />
              Near me · {filters.withinMiles ?? 5}mi
              <X className="w-3 h-3 opacity-60" />
            </button>
          ) : (
            <button
              onClick={enableNearMe}
              disabled={geoLoading}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] transition-colors disabled:opacity-50"
            >
              {geoLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <MapPin className="w-3 h-3" />
              )}
              Near me
            </button>
          )}

          {/* View switcher */}
          <div className="flex items-center rounded-lg border border-white/10 overflow-hidden">
            <ViewToggleButton
              active={view === "table"}
              onClick={() => setView("table")}
              icon={<List className="w-3 h-3" />}
              label="Table"
            />
            <ViewToggleButton
              active={view === "cards"}
              onClick={() => setView("cards")}
              icon={<LayoutGrid className="w-3 h-3" />}
              label="Cards"
              border
            />
            <ViewToggleButton
              active={view === "map"}
              onClick={() => setView("map")}
              icon={<MapPin className="w-3 h-3" />}
              label="Map"
              border
            />
            <ViewToggleButton
              active={view === "kanban"}
              onClick={() => setView("kanban")}
              icon={<Kanban className="w-3 h-3" />}
              label="Kanban"
              border
            />
          </div>

          {/* Density toggle (only meaningful in table view) */}
          {view === "table" && (
            <div className="flex items-center rounded-lg border border-white/10 overflow-hidden">
              <button
                onClick={() => setDensity("comfortable")}
                className={`px-2 py-1.5 text-[11px] font-medium ${
                  density === "comfortable"
                    ? "bg-white/10 text-white"
                    : "text-white/50 hover:text-white"
                }`}
                title="Comfortable rows"
              >
                <Rows className="w-3 h-3" />
              </button>
              <button
                onClick={() => setDensity("compact")}
                className={`px-2 py-1.5 text-[11px] font-medium border-l border-white/10 ${
                  density === "compact"
                    ? "bg-white/10 text-white"
                    : "text-white/50 hover:text-white"
                }`}
                title="Compact rows"
              >
                <Filter className="w-3 h-3" />
              </button>
            </div>
          )}

          {hasActiveFilters && (
            <Button size="sm" variant="ghost" onClick={resetAll}>
              <X className="w-3 h-3" />
              Reset
            </Button>
          )}
        </div>

        {totalCount > 0 && (
          <p className="text-[11px] text-white/40">
            {totalCount.toLocaleString()} lead{totalCount === 1 ? "" : "s"} match the
            current filters
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ViewToggleButton({
  active,
  onClick,
  icon,
  label,
  border = false,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  border?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium ${
        border ? "border-l border-white/10" : ""
      } ${
        active ? "bg-white/10 text-white" : "text-white/50 hover:text-white"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function QuickChip({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
        active
          ? "border border-(--leadac-500)/40 bg-(--leadac-500)/15 text-(--leadac-200)"
          : "border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

interface ScoreSliderFieldProps {
  min: number;
  max: number;
  onCommit: (min: number, max: number) => void;
}

function ScoreSliderField({ min, max, onCommit }: ScoreSliderFieldProps) {
  const [localMin, setLocalMin] = useState(min);
  const [localMax, setLocalMax] = useState(max);

  useEffect(() => setLocalMin(min), [min]);
  useEffect(() => setLocalMax(max), [max]);

  return (
    <div
      className="flex flex-col gap-1.5 rounded-xl border px-3 py-2"
      style={{
        backgroundColor: "var(--leadac-card)",
        borderColor: "var(--leadac-border)",
      }}
    >
      <div className="flex items-center justify-between text-[11px] text-white/50">
        <span>Score range</span>
        <span className="font-semibold text-white">
          {localMin}–{localMax}
        </span>
      </div>
      <Slider
        min={0}
        max={100}
        step={5}
        value={[localMin, localMax]}
        onValueChange={(vals) => {
          setLocalMin(vals[0]);
          setLocalMax(vals[1]);
        }}
        onValueCommit={(vals) => onCommit(vals[0], vals[1])}
      />
    </div>
  );
}

type QuickFilterKey =
  | "hot"
  | "no_site"
  | "low_rating"
  | "scan_failed"
  | "never_contacted"
  | "today";

function useQuickFilterMatch(filters: LeadsFilters): QuickFilterKey | null {
  // Best-effort recognition for the chip ribbon's "active" highlighting.
  // We deliberately keep this loose: a preset is "active" when its
  // signature filters match, regardless of user-set extras.
  if (filters.minScore === 70 && filters.sortBy === "score") return "hot";
  if (filters.hasWebsite === "false") return "no_site";
  if (filters.sortBy === "rating" && filters.statuses.length === 0) return "low_rating";
  if (
    filters.statuses.length === 1 &&
    filters.statuses[0] === "unscored" &&
    filters.minScore === 0
  ) {
    return "scan_failed";
  }
  if (
    filters.statuses.length === 2 &&
    filters.statuses.includes("NEW") &&
    filters.statuses.includes("unscored")
  ) {
    return "never_contacted";
  }
  return null;
}
