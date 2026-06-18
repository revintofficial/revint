"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Plus, X, FileText } from "lucide-react";
import type { IcpDraft, DraftSource } from "@/lib/onboarding/types";

/**
 * Reusable ICP editor. Plain-text `description` is the primary surface; the
 * structured scoring fields live behind an "Advanced" disclosure. Shared by
 * the onboarding ICP review step and the Settings → ICP page.
 */
export function IcpEditor({
  value,
  onChange,
  sources,
}: {
  value: IcpDraft;
  onChange: (next: IcpDraft) => void;
  sources?: DraftSource[];
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const set = <K extends keyof IcpDraft>(key: K, v: IcpDraft[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="icp-description"
          className="text-[12px] font-medium text-white/70 mb-1.5 block"
        >
          Ideal customer profile
        </label>
        <Textarea
          id="icp-description"
          value={value.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Best-fit customers are… (who they are, their use cases, what disqualifies them)"
          rows={7}
          className="text-sm leading-relaxed"
        />
        <p className="text-[11px] text-white/35 mt-1">
          This is a draft, not a decision. Edit anything that looks off before it affects scoring.
        </p>
      </div>

      <TagField
        label="High-value signals"
        placeholder="e.g. multi-location, legacy booking tool"
        values={value.highValueSignals}
        onChange={(v) => set("highValueSignals", v)}
      />
      <TagField
        label="Negative signals (disqualifiers)"
        placeholder="e.g. solo freelancer, no budget"
        values={value.negativeSignals}
        onChange={(v) => set("negativeSignals", v)}
      />

      <div className="rounded-xl border border-white/10 bg-white/5">
        <button
          type="button"
          onClick={() => setAdvancedOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-[12.5px] font-medium text-white/70"
        >
          <span>Advanced scoring thresholds (optional)</span>
          {advancedOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        {advancedOpen && (
          <div className="px-4 pb-4 grid grid-cols-2 gap-3">
            <NumberField
              label="Min review count"
              value={value.minReviewCount}
              onChange={(v) => set("minReviewCount", v)}
            />
            <NumberField
              label="Min rating (0-5)"
              value={value.minRating}
              step={0.1}
              onChange={(v) => set("minRating", v)}
            />
            <NumberField
              label="Min price level (0-4)"
              value={value.priceLevelMin}
              onChange={(v) => set("priceLevelMin", v)}
            />
            <NumberField
              label="Max price level (0-4)"
              value={value.priceLevelMax}
              onChange={(v) => set("priceLevelMax", v)}
            />
            <NumberField
              label="Digital maturity floor (0-100)"
              value={value.digitalMaturityFloor}
              onChange={(v) => set("digitalMaturityFloor", v)}
            />
          </div>
        )}
      </div>

      {sources && sources.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5">
          <button
            type="button"
            onClick={() => setSourcesOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-3 text-[12.5px] font-medium text-white/70"
          >
            <span className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5" /> Where this draft came from
            </span>
            {sourcesOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {sourcesOpen && (
            <div className="px-4 pb-4 space-y-3">
              {sources.map((s, i) => (
                <div key={i} className="text-[12px]">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-(--revint-300) underline break-all"
                  >
                    {s.url}
                  </a>
                  {s.evidence && (
                    <p className="text-white/40 mt-1 line-clamp-3">&ldquo;{s.evidence}&rdquo;</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TagField({
  label,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (!values.includes(v)) onChange([...values, v]);
    setDraft("");
  };
  return (
    <div>
      <label className="text-[12px] font-medium text-white/70 mb-1.5 block">{label}</label>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {values.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1">
              {v}
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
                aria-label={`Remove ${v}`}
                className="text-white/40 hover:text-white/80"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="text-sm"
        />
        <Button type="button" variant="outline" size="icon" onClick={add} aria-label={`Add ${label}`}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  step?: number;
}) {
  return (
    <div>
      <label className="text-[11px] text-white/50 mb-1 block">{label}</label>
      <Input
        type="number"
        step={step}
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : Number(v));
        }}
        className="text-sm"
      />
    </div>
  );
}
