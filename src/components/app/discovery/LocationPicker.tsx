"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Loader2, MapPin, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PickedLocation } from "@/types";

/**
 * LocationPicker — multi-select combobox backed by Google Places
 * Autocomplete (New).
 *
 * UX contract:
 *   - User types into the input. After a 250ms debounce we hit
 *     /api/places/autocomplete and render up to ~5 suggestions in a
 *     dropdown.
 *   - Picking a suggestion (click or Enter) calls
 *     /api/places/details, pushes the resolved PickedLocation onto
 *     the chips array, and rotates the autocomplete session token.
 *   - Backspace on an empty input removes the last chip.
 *   - Once `maxLocations` chips are added the input disables.
 *
 * The component is intentionally controlled — Discovery owns the
 * `value` array so it can also persist `freeText` for the legacy
 * fallback path.
 *
 * Free-text fallback is exposed as a separate prop the parent
 * renders below the picker; we don't try to fold it into this
 * component because the geocode-based path has fundamentally
 * different accuracy guarantees and the user should see the warning
 * banner.
 */

const DEBOUNCE_MS = 250;
const MIN_QUERY_LEN = 2;

interface AutocompleteSuggestion {
  placeId: string;
  primaryText: string;
  secondaryText: string;
  fullText: string;
  types: string[];
}

interface LocationPickerProps {
  value: PickedLocation[];
  onChange: (next: PickedLocation[]) => void;
  /** ISO-2 country to bias autocomplete ranking. Optional. */
  regionCode?: string;
  /** BCP-47 language code for suggestion text. Defaults to en. */
  languageCode?: string;
  /** Hard cap on selected chips. Defaults to 5. */
  maxLocations?: number;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  /**
   * Optional escape hatch: when Google returns zero suggestions for
   * the current query (typo, obscure neighbourhood, novel spelling),
   * the no-results state shows a "Use as approximate text" button.
   * Clicking it forwards the typed string to this callback so the
   * parent can shove it into the legacy free-text fallback path —
   * otherwise the user is stuck typing the same string twice into
   * two different inputs.
   */
  onFallbackText?: (text: string) => void;
}

/**
 * Generates a fresh session token. The same token is reused across
 * keystrokes inside a single picker session and rotated after a
 * Details call closes the session — Google bills per session, not
 * per keystroke, so reusing the token cuts cost dramatically.
 *
 * Uses crypto.randomUUID when available (modern browsers) and falls
 * back to a Math.random hex shim for ancient runtimes / SSR (the
 * value is never used during SSR but the import path needs to be
 * safe at module evaluation).
 */
function newSessionToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("");
}

export function LocationPicker({
  value,
  onChange,
  regionCode,
  languageCode = "en",
  maxLocations = 5,
  className,
  placeholder = "Search a city, district, or neighbourhood…",
  disabled,
  onFallbackText,
}: LocationPickerProps) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const sessionTokenRef = useRef<string>(newSessionToken());
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const requestSeqRef = useRef(0);

  const reachedMax = value.length >= maxLocations;
  const inputDisabled = disabled || reachedMax;

  // Close suggestions when clicking outside the picker.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Debounced autocomplete fetch. We carry a sequence number so a
  // late response from an earlier keystroke can't overwrite a fresh
  // one (classic input-race bug).
  useEffect(() => {
    const trimmed = input.trim();
    if (trimmed.length < MIN_QUERY_LEN) {
      setSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }
    const seq = ++requestSeqRef.current;
    setLoadingSuggestions(true);
    setError(null);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/places/autocomplete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: trimmed,
            sessionToken: sessionTokenRef.current,
            regionCode,
            languageCode,
          }),
        });
        if (seq !== requestSeqRef.current) return;
        if (!res.ok) {
          setSuggestions([]);
          setError(
            res.status === 429
              ? "Too many lookups — slow down a touch."
              : "Couldn't load suggestions.",
          );
          return;
        }
        const data = (await res.json()) as { suggestions?: AutocompleteSuggestion[] };
        if (seq !== requestSeqRef.current) return;
        setSuggestions(data.suggestions ?? []);
        setActiveIndex(0);
      } catch {
        if (seq !== requestSeqRef.current) return;
        setSuggestions([]);
        setError("Couldn't load suggestions.");
      } finally {
        if (seq === requestSeqRef.current) {
          setLoadingSuggestions(false);
        }
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input, regionCode, languageCode]);

  const pickSuggestion = useCallback(
    async (s: AutocompleteSuggestion) => {
      if (reachedMax) return;
      // Don't double-add the same place if user clicks twice quickly.
      if (value.some((v) => v.placeId === s.placeId)) {
        setInput("");
        setSuggestions([]);
        setOpen(false);
        return;
      }

      setResolving(s.placeId);
      setError(null);
      try {
        const res = await fetch("/api/places/details", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            placeId: s.placeId,
            sessionToken: sessionTokenRef.current,
          }),
        });
        if (!res.ok) {
          setError("Couldn't load place details. Try another suggestion.");
          return;
        }
        const data = (await res.json()) as { location?: PickedLocation };
        if (!data.location) {
          setError("Place details unavailable.");
          return;
        }
        onChange([...value, data.location]);
        setInput("");
        setSuggestions([]);
        setOpen(false);
        // Rotate the session token — Google bills the next typing
        // round as a fresh autocomplete session.
        sessionTokenRef.current = newSessionToken();
        // Keep focus on input so the user can chain selections.
        inputRef.current?.focus();
      } catch {
        setError("Network error. Try again.");
      } finally {
        setResolving(null);
      }
    },
    [onChange, reachedMax, value],
  );

  const removeChip = useCallback(
    (placeId: string) => {
      onChange(value.filter((v) => v.placeId !== placeId));
    },
    [onChange, value],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && input === "" && value.length > 0) {
        // Remove the last chip on backspace-into-empty.
        e.preventDefault();
        onChange(value.slice(0, -1));
        return;
      }
      if (!open || suggestions.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const target = suggestions[activeIndex];
        if (target) void pickSuggestion(target);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    },
    [activeIndex, input, onChange, open, pickSuggestion, suggestions, value],
  );

  const helpText = useMemo(() => {
    if (reachedMax) {
      return `Limit reached — remove a chip to add another (max ${maxLocations}).`;
    }
    if (value.length === 0) {
      return "Pick from suggestions for accurate results. Free-text searches use approximate geocoding.";
    }
    return `Picked ${value.length} of ${maxLocations}. Add more or remove with the X.`;
  }, [maxLocations, reachedMax, value.length]);

  // "No matches" guard — only fires once we know Google answered (not
  // loading), the user passed the minimum query length, and there's
  // nothing to render. Without this branch the dropdown silently
  // closes and the user has no idea their typo (e.g. "Nothingham")
  // didn't match anything.
  const trimmedInput = input.trim();
  const showNoResults =
    !loadingSuggestions &&
    !error &&
    suggestions.length === 0 &&
    trimmedInput.length >= MIN_QUERY_LEN;

  const promoteToFallback = useCallback(() => {
    if (!onFallbackText) return;
    const text = trimmedInput;
    if (!text) return;
    onFallbackText(text);
    setInput("");
    setSuggestions([]);
    setOpen(false);
  }, [onFallbackText, trimmedInput]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Chips + input row. Chips render above the input field; the
          input grows to fill remaining space. */}
      <div
        className="flex flex-wrap items-center gap-1.5 rounded-xl border min-h-10 px-2 py-1.5"
        style={{
          backgroundColor: "var(--revint-card)",
          borderColor: "var(--revint-border)",
        }}
      >
        {value.map((loc) => (
          <span
            key={loc.placeId}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[12px] text-white"
            style={{
              backgroundColor: "hsl(var(--revint-h) var(--revint-s) 50% / 0.14)",
              borderColor: "hsl(var(--revint-h) var(--revint-s) 50% / 0.32)",
            }}
            title={loc.displayName}
          >
            <MapPin className="w-3 h-3 opacity-70" />
            <span className="max-w-[200px] truncate">{loc.primaryText}</span>
            {loc.countryCode && (
              <span className="text-white/40 text-[10px]">{loc.countryCode}</span>
            )}
            <button
              type="button"
              onClick={() => removeChip(loc.placeId)}
              className="ml-1 rounded p-0.5 hover:bg-white/10 disabled:opacity-50"
              disabled={disabled}
              aria-label={`Remove ${loc.displayName}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <div className="flex-1 min-w-[140px] flex items-center">
          {loadingSuggestions ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin text-white/40" />
          ) : (
            <Search className="w-3.5 h-3.5 mr-1.5 text-white/30" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={input}
            disabled={inputDisabled}
            onFocus={() => {
              if (suggestions.length > 0 || input.trim().length >= MIN_QUERY_LEN) {
                setOpen(true);
              }
            }}
            onChange={(e) => {
              setInput(e.target.value);
              setOpen(true);
            }}
            onKeyDown={onKeyDown}
            placeholder={
              reachedMax ? `Max ${maxLocations} locations.` : placeholder
            }
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
      </div>

      {/* Suggestions dropdown. Positioned absolutely below the row.
          Renders whenever there's something useful to show — including
          a "no matches" state so the user gets feedback when their
          query doesn't resolve (instead of staring at silence). */}
      {open &&
        (suggestions.length > 0 ||
          loadingSuggestions ||
          error ||
          showNoResults) && (
        <div
          className="absolute left-0 right-0 mt-1.5 rounded-xl overflow-hidden shadow-lg z-30"
          style={{
            backgroundColor: "hsl(var(--revint-h) var(--revint-ns) 11% / 0.96)",
            backdropFilter: "saturate(180%) blur(20px)",
            WebkitBackdropFilter: "saturate(180%) blur(20px)",
            border: "0.5px solid hsl(0 0% 100% / 0.12)",
            boxShadow: "0 16px 48px rgba(0, 0, 0, 0.4)",
          }}
        >
          {error && (
            <div className="px-3 py-2 text-[12px] text-[hsl(4_42%_72%)]">{error}</div>
          )}
          {!error && loadingSuggestions && suggestions.length === 0 && (
            <div className="px-3 py-2 text-[12px] text-white/40 flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              Searching places…
            </div>
          )}
          {showNoResults && (
            <div className="px-3 py-2.5 text-[12px] text-white/55 space-y-2">
              <div>
                No matches for{" "}
                <span className="text-white/80">&ldquo;{trimmedInput}&rdquo;</span>{" "}
                — check the spelling, or use the typed text below for an
                approximate geocode.
              </div>
              {/* Only offer fallback when no chips are picked — the
                  Discovery API uses chips XOR free-text, never both,
                  so showing this with chips already in place would
                  silently no-op. */}
              {onFallbackText && value.length === 0 && (
                <button
                  type="button"
                  onClick={promoteToFallback}
                  className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] text-white transition-colors"
                  style={{
                    backgroundColor:
                      "hsl(var(--revint-h) var(--revint-s) 50% / 0.16)",
                    borderColor:
                      "hsl(var(--revint-h) var(--revint-s) 50% / 0.36)",
                  }}
                >
                  <MapPin className="w-3 h-3" />
                  Use &ldquo;{trimmedInput}&rdquo; as approximate text
                </button>
              )}
            </div>
          )}
          {suggestions.map((s, idx) => {
            const isActive = idx === activeIndex;
            const isAdded = value.some((v) => v.placeId === s.placeId);
            return (
              <button
                key={s.placeId}
                type="button"
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => void pickSuggestion(s)}
                disabled={isAdded || resolving === s.placeId}
                className={cn(
                  "w-full flex items-start gap-2 px-3 py-2 text-left text-sm transition-colors",
                  isActive ? "bg-white/6" : "hover:bg-white/4",
                  (isAdded || resolving === s.placeId) && "opacity-50 cursor-not-allowed",
                )}
              >
                <MapPin className="w-3.5 h-3.5 mt-0.5 text-white/40 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-white truncate">{s.primaryText}</div>
                  {s.secondaryText && (
                    <div className="text-[11px] text-white/40 truncate">
                      {s.secondaryText}
                    </div>
                  )}
                </div>
                {resolving === s.placeId ? (
                  <Loader2 className="w-3 h-3 animate-spin text-white/40" />
                ) : isAdded ? (
                  <span className="text-[11px] text-white/40">added</span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-white/35 mt-1.5 flex items-center gap-1">
        <MapPin className="w-3 h-3 inline" />
        {helpText}
      </p>
    </div>
  );
}
