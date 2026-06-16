"use client";

/**
 * FineDine v1 update — Qualification panel embedded inside the lead
 * analysis hero (HeroBand). Self-contained island: fetches the lead
 * action-sheet payload for the playbook checklist + current answers,
 * and POSTs answers back to `/api/leads/[id]/qualification`, which
 * recomputes qualification status / risk and lead temperature.
 *
 * Styled for the dark glass hero (white/x tokens) rather than the
 * light Card surface used elsewhere.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ClipboardCheck, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChecklistItem {
  key: string;
  label: string;
  requiredForQualified: boolean;
}

interface QualificationData {
  playbook: { qualificationChecklist: ChecklistItem[] };
  qualification: {
    answers: Record<string, boolean>;
    qualified: boolean;
    status: string;
    qualificationRisk: string | null;
    noShowRisk: string | null;
  };
}

function riskColor(risk: string | null): string {
  if (risk === "high") return "var(--leadac-error)";
  if (risk === "medium") return "var(--leadac-warning)";
  if (risk === "low") return "var(--leadac-success)";
  return "rgba(255,255,255,0.45)";
}

function humanizeStatus(status: string): string {
  return status.replace(/_/g, " ");
}

export function LeadQualificationCard({ leadId }: { leadId: string }) {
  const [data, setData] = useState<QualificationData | null>(null);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/leads/${leadId}/action-sheet`);
    if (res.ok) {
      const json = await res.json();
      const sheet = json.actionSheet;
      if (sheet) {
        setData(sheet);
        setAnswers(sheet.qualification?.answers ?? {});
      }
    }
  }, [leadId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const save = async () => {
    setBusy(true);
    const res = await fetch(`/api/leads/${leadId}/qualification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Qualification saved");
      await load();
    } else {
      toast.error("Couldn't save qualification");
    }
  };

  if (loading || !data) return null;

  const qualified = data.qualification.qualified;

  return (
    <div className="mt-6 pt-5 border-t border-white/8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="inline-flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.06em] text-white/45">
          <ClipboardCheck className="w-4 h-4" />
          Qualification
        </h3>
        <span
          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-medium capitalize"
          style={{
            background: qualified
              ? "color-mix(in srgb, var(--leadac-success) 20%, transparent)"
              : "rgba(255,255,255,0.06)",
            color: qualified ? "var(--leadac-success)" : "rgba(255,255,255,0.55)",
          }}
        >
          {humanizeStatus(data.qualification.status)}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {data.playbook.qualificationChecklist.map((item) => {
          const checked = !!answers[item.key];
          return (
            <button
              key={item.key}
              type="button"
              onClick={() =>
                setAnswers((a) => ({ ...a, [item.key]: !a[item.key] }))
              }
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                checked
                  ? "border-(--leadac-500)/50 bg-(--leadac-500)/12"
                  : "border-white/8 bg-white/4 hover:bg-white/8"
              }`}
            >
              <span
                className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-colors ${
                  checked
                    ? "border-(--leadac-400) bg-(--leadac-500)"
                    : "border-white/25"
                }`}
              >
                {checked && <Check className="h-3 w-3 text-white" />}
              </span>
              <span
                className={`text-[13px] leading-snug ${
                  checked ? "text-white" : "text-white/70"
                }`}
              >
                {item.label}
                {item.requiredForQualified && (
                  <span className="text-white/35"> *</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-3.5">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px]">
          <span style={{ color: riskColor(data.qualification.qualificationRisk) }}>
            Qual risk: {data.qualification.qualificationRisk ?? "—"}
          </span>
          <span style={{ color: riskColor(data.qualification.noShowRisk) }}>
            No-show: {data.qualification.noShowRisk ?? "—"}
          </span>
        </div>
        <Button
          size="sm"
          className="rounded-full"
          disabled={busy}
          onClick={() => void save()}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
