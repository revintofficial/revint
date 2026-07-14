"use client";

/**
 * Account Intelligence Brief card (Faz 3).
 *
 * Renders the Claude Head Agent decision attached to the latest
 * LEAD_INTELLIGENCE_BRIEF run: primary angle, talk track, confidence,
 * which modules to pitch / avoid, and any cross-source conflicts.
 *
 * Self-contained: fetches `/api/leads/[id]/intelligence-brief` and
 * renders NOTHING when there is no `headAgent` block (flag off,
 * non-pack niche, or the synthesis pass didn't run) — so non-F&B /
 * flag-off workspaces see no change at all.
 */
import { useEffect, useState } from "react";
import {
  Brain,
  Sparkles,
  AlertTriangle,
  Check,
  Ban,
  Copy,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ModuleRec {
  module: string;
  readiness: number;
  why: string;
}
interface Conflict {
  claim: string;
  sources: string[];
  note: string;
}
interface HeadAgentDecision {
  packId: string;
  primaryModule: string | null;
  primaryAngle: string;
  talkTrack: string;
  recommendedModules: ModuleRec[];
  excludedModules: { module: string; why: string }[];
  recommendedPackage?: string | null;
  confidence: number;
  sourceConflicts: Conflict[];
  reasoning: string;
  evidenceRefs: string[];
  model: string;
  usageTokens: number;
  generatedAt: string;
}

const MODULE_LABELS: Record<string, string> = {
  order_and_pay: "Order & Pay",
  qr_menu: "QR Menu",
  reservation: "Reservations",
  ai_menu_builder: "AI Menu Builder",
  crm_loyalty: "Guest CRM / Loyalty",
  multi_language: "Multi-language Menu",
  website: "Website",
  multi_location: "Multi-location Control",
};

function moduleLabel(id: string): string {
  return MODULE_LABELS[id] ?? id.replace(/_/g, " ");
}

function confidenceTone(c: number): string {
  if (c >= 70) return "var(--revint-success)";
  if (c >= 40) return "var(--revint-warning)";
  return "var(--revint-text-3)";
}

export default function AccountIntelligenceBriefCard({ id }: { id: string }) {
  const [decision, setDecision] = useState<HeadAgentDecision | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/leads/${id}/intelligence-brief`);
        if (!res.ok) return;
        const json = await res.json();
        const ha = json?.brief?.headAgent as HeadAgentDecision | undefined;
        if (alive && ha && typeof ha === "object") {
          setDecision(ha);
          setGeneratedAt(typeof json?.brief?.generatedAt === "string" ? json.brief.generatedAt : null);
        }
      } catch {
        // Silent — this card is additive; a fetch failure just hides it.
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  if (!decision) return null;

  const copyTalkTrack = async () => {
    try {
      await navigator.clipboard.writeText(
        `${decision.primaryAngle}\n\n${decision.talkTrack}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <Card className="border-(--revint-border)">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-[17px] flex items-center gap-2">
              <Brain className="w-4 h-4 text-(--revint-500) shrink-0" />
              Account Intelligence
              <Badge
                variant="outline"
                className="ml-1 text-[10px] font-medium uppercase tracking-wide text-white/50 border-white/15"
              >
                Head Agent
              </Badge>
            </CardTitle>
            <p className="text-[12px] text-white/40 mt-1">
              Claude synthesised the full substrate into one account-level call.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right">
              <div
                className="text-[20px] font-semibold leading-none"
                style={{ color: confidenceTone(decision.confidence) }}
              >
                {decision.confidence}%
              </div>
              <div className="text-[10px] text-white/35 mt-1">confidence</div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Primary angle + talk track */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-3.5 h-3.5 text-(--revint-500) shrink-0" />
              <span className="text-[13px] font-semibold text-white/90 truncate">
                {decision.primaryAngle}
              </span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs gap-1.5 shrink-0"
              onClick={copyTalkTrack}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
          {decision.talkTrack && (
            <p className="text-[13px] leading-relaxed text-white/70">{decision.talkTrack}</p>
          )}
          {decision.reasoning && (
            <p className="text-[12px] leading-relaxed text-white/40 pt-1 border-t border-white/5">
              {decision.reasoning}
            </p>
          )}
          {decision.recommendedPackage && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] uppercase tracking-wide text-white/40">Package</span>
              <Badge variant="outline" className="text-[11px] text-(--revint-500) border-(--revint-500)/40">
                {decision.recommendedPackage}
              </Badge>
            </div>
          )}
        </div>

        {/* Recommended modules */}
        {decision.recommendedModules.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-white/40">
              Pitch these
            </p>
            <div className="space-y-2">
              {decision.recommendedModules.map((m) => (
                <div
                  key={m.module}
                  className="rounded-xl border border-white/10 bg-white/3 p-3"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[13px] font-medium text-white/85">
                      {moduleLabel(m.module)}
                    </span>
                    <span className="text-[11px] text-white/45 tabular-nums">{m.readiness}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(0, Math.min(100, m.readiness))}%`,
                        backgroundColor: "var(--revint-500)",
                      }}
                    />
                  </div>
                  {m.why && <p className="text-[12px] text-white/55 mt-2">{m.why}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Excluded modules */}
        {decision.excludedModules.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-white/40">
              Don&apos;t pitch
            </p>
            <div className="space-y-1.5">
              {decision.excludedModules.map((m) => (
                <div key={m.module} className="flex items-start gap-2 text-[12px] text-white/45">
                  <Ban className="w-3.5 h-3.5 mt-0.5 shrink-0 text-white/30" />
                  <span>
                    <span className="text-white/65">{moduleLabel(m.module)}</span>
                    {m.why ? ` — ${m.why}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Source conflicts */}
        {decision.sourceConflicts.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-(--revint-warning)">
              Source conflicts
            </p>
            <div className="space-y-1.5">
              {decision.sourceConflicts.map((c, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-xl border border-(--revint-warning)/25 bg-(--revint-warning)/5 p-2.5 text-[12px]"
                >
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-(--revint-warning)" />
                  <span className="text-white/70">
                    <span className="text-white/90">{c.claim}</span>
                    {c.sources.length > 0 && (
                      <span className="text-white/45"> [{c.sources.join(" vs ")}]</span>
                    )}
                    {c.note ? <span className="text-white/55"> — {c.note}</span> : null}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[11px] text-white/30 border-t border-white/5">
          <span>{decision.model}</span>
          {generatedAt && <span>· {new Date(generatedAt).toLocaleString()}</span>}
          {decision.evidenceRefs.length > 0 && (
            <span className="truncate">· evidence: {decision.evidenceRefs.join(", ")}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
