"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { IcpEditor } from "./icp-editor";
import { emptyIcpDraft, type IcpDraft, type DraftSource } from "@/lib/onboarding/types";
import type { OnboardingDraftStatus } from "@/lib/onboarding/types";
import { trackOnboarding } from "@/lib/analytics/onboarding";

export function IcpReviewStep({
  status,
  draft,
  sources,
  onConfirmed,
}: {
  /** Draft status from the calibration worker. */
  status: OnboardingDraftStatus | "NONE";
  /** AI-extracted (or previously confirmed) ICP draft, if any. */
  draft: IcpDraft | null;
  sources?: DraftSource[];
  onConfirmed: () => void;
}) {
  const [value, setValue] = useState<IcpDraft>(draft ?? emptyIcpDraft());
  const [saving, setSaving] = useState(false);
  const [edited, setEdited] = useState(false);
  const seededRef = useRef(false);
  const viewedRef = useRef(false);

  // Seed the editor once the worker delivers a draft (don't clobber edits).
  useEffect(() => {
    if (draft && !seededRef.current) {
      setValue(draft);
      seededRef.current = true;
    }
  }, [draft]);

  const isLoading = (status === "RUNNING" || status === "PENDING") && !draft;
  const failed = status === "FAILED";

  useEffect(() => {
    if (!isLoading && !viewedRef.current) {
      viewedRef.current = true;
      trackOnboarding("icp_draft_viewed", { failed });
    }
  }, [isLoading, failed]);

  const handleChange = (next: IcpDraft) => {
    setValue(next);
    if (!edited) {
      setEdited(true);
      trackOnboarding("icp_draft_edited");
    }
  };

  const confirm = async () => {
    if (!value.description.trim()) {
      toast.error("Add a short description of your ideal customer before continuing.");
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
        toast.error(err.error || "Failed to save your ICP");
        return;
      }
      trackOnboarding("icp_draft_confirmed");
      onConfirmed();
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-(--revint-300) text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Reading your website to draft your ICP…</span>
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-10 w-2/3 rounded-lg" />
        <Skeleton className="h-10 w-1/2 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {failed ? (
        <div className="flex items-start gap-2 rounded-xl border border-(--revint-warning)/30 bg-(--revint-warning)/5 p-3 text-[12.5px] text-(--revint-text-2)">
          <AlertTriangle className="w-4 h-4 mt-0.5 text-(--revint-warning) shrink-0" />
          <span>
            We couldn&apos;t auto-draft your ICP from your website. Describe your ideal customer
            below — it powers lead scoring.
          </span>
        </div>
      ) : (
        <div className="flex items-start gap-2 text-(--revint-300) text-sm">
          <Sparkles className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            We used your domain to draft this. You can edit it before it affects scoring.
          </span>
        </div>
      )}

      <IcpEditor value={value} onChange={handleChange} sources={sources} />

      <Button className="w-full" onClick={confirm} disabled={saving}>
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Saving…
          </>
        ) : (
          "Confirm ICP"
        )}
      </Button>
    </div>
  );
}
