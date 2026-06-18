"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, RefreshCw } from "lucide-react";
import { IcpEditor } from "@/components/app/onboarding/icp-editor";
import { emptyIcpDraft, type IcpDraft } from "@/lib/onboarding/types";

interface ConfirmedIcp {
  description: string | null;
  industryWeights: Record<string, number>;
  subNicheWeights: Record<string, number>;
  priceLevelMin: number | null;
  priceLevelMax: number | null;
  minReviewCount: number | null;
  minRating: number | null;
  digitalMaturityFloor: number | null;
  highValueSignals: string[];
  negativeSignals: string[];
  locationFit: Record<string, unknown>;
  sourceJson: { sources?: Array<{ url: string; evidence: string }> } | null;
  version: number;
}

function toDraft(icp: ConfirmedIcp): IcpDraft {
  return {
    description: icp.description ?? "",
    industryWeights: icp.industryWeights ?? {},
    subNicheWeights: icp.subNicheWeights ?? {},
    priceLevelMin: icp.priceLevelMin,
    priceLevelMax: icp.priceLevelMax,
    minReviewCount: icp.minReviewCount,
    minRating: icp.minRating,
    digitalMaturityFloor: icp.digitalMaturityFloor,
    highValueSignals: icp.highValueSignals ?? [],
    negativeSignals: icp.negativeSignals ?? [],
    locationFit: icp.locationFit ?? {},
    sources: icp.sourceJson?.sources,
  };
}

/**
 * Persistent ICP editor for Settings → ICP. Reuses the onboarding IcpEditor.
 * On save, the profile version bumps; we then surface a "Re-score existing
 * leads" CTA that drains pending/blocked leads via /api/leads/process-pending.
 */
export function IcpForm({ canEdit }: { canEdit: boolean }) {
  const [value, setValue] = useState<IcpDraft>(emptyIcpDraft());
  const [sources, setSources] = useState<IcpDraft["sources"]>(undefined);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rescoring, setRescoring] = useState(false);
  const [showRescore, setShowRescore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/workspace/icp", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { icp: ConfirmedIcp | null };
        if (cancelled) return;
        if (data.icp) {
          const draft = toDraft(data.icp);
          setValue(draft);
          setSources(draft.sources);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    if (!value.description.trim()) {
      toast.error("Add a short description of your ideal customer.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/onboarding/confirm-icp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icp: value }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error || "Failed to save ICP");
        return;
      }
      toast.success("ICP saved");
      setShowRescore(true);
    } finally {
      setSaving(false);
    }
  };

  const rescore = async () => {
    setRescoring(true);
    try {
      const res = await fetch("/api/leads/process-pending", { method: "POST" });
      if (!res.ok) {
        toast.error("Couldn't start re-scoring");
        return;
      }
      toast.success("Re-scoring your leads against the updated ICP.");
      setShowRescore(false);
    } finally {
      setRescoring(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-10 w-2/3 rounded-lg" />
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-white">Ideal Customer Profile</h2>
          <p className="text-sm text-white/50 mt-0.5">
            This drives how every lead is scored. Editing it bumps the ICP version so you can
            re-score existing leads.
          </p>
        </div>

        <fieldset disabled={!canEdit} className="space-y-5">
          <IcpEditor value={value} onChange={setValue} sources={sources} />
        </fieldset>

        {showRescore && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-(--revint-500)/30 bg-(--revint-500)/5 p-3">
            <p className="text-[12.5px] text-(--revint-text-2)">
              Your ICP changed. Re-score existing leads so their fit reflects the update.
            </p>
            <Button variant="outline" size="sm" onClick={rescore} disabled={rescoring}>
              {rescoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Re-score
            </Button>
          </div>
        )}

        {canEdit && (
          <Button onClick={save} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Saving…
              </>
            ) : (
              "Save ICP"
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
