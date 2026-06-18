"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2, Plug, CheckCircle2, Lock, ArrowUpRight, Download } from "lucide-react";
import type { Plan } from "@/generated/prisma/client";
import { trackOnboarding } from "@/lib/analytics/onboarding";

const HUBSPOT_STEP_INDEX = 4;

interface SyncTally {
  scanned: number;
  created: number;
  updated: number;
  matched: number;
  skipped: number;
  failed: number;
  hasMore: boolean;
}

interface SyncResponse {
  ok: boolean;
  contacts: SyncTally;
  companies: SyncTally;
  totalCreated: number;
  hasMore: boolean;
}

export function HubspotImportStep({
  plan,
  configured,
  connected,
  onSkip,
  onImported,
}: {
  plan: Plan;
  configured: boolean;
  connected: boolean;
  onSkip: () => void;
  onImported: () => void;
}) {
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<SyncResponse | null>(null);

  const planOk = plan !== "FREE";

  const connect = () => {
    trackOnboarding("hubspot_connect_started");
    window.location.href = `/api/integrations/hubspot/connect?returnTo=${encodeURIComponent(
      `/app/onboarding?step=${HUBSPOT_STEP_INDEX}&hubspot_connected=1`,
    )}`;
  };

  const runImport = async () => {
    setImporting(true);
    trackOnboarding("hubspot_import_started");
    try {
      const res = await fetch("/api/integrations/hubspot/sync", { method: "POST" });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        toast.error(err.message || err.error || "Import failed");
        return;
      }
      const data = (await res.json()) as SyncResponse;
      setSummary(data);
      const created = data.totalCreated ?? 0;
      const matched = (data.contacts?.matched ?? 0) + (data.companies?.matched ?? 0);
      trackOnboarding("hubspot_import_completed", { created, matched, hasMore: data.hasMore });
      if (created > 0) {
        toast.success(`Imported ${created} leads from HubSpot`);
        onImported();
      } else {
        toast.message("No new leads found in HubSpot.");
      }
    } finally {
      setImporting(false);
    }
  };

  // Locked: plan below PRO or HubSpot not configured on this deployment.
  if (!planOk || !configured) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="flex items-center gap-2 text-(--revint-text-1) font-medium">
            <Lock className="w-4 h-4 text-white/50" />
            {planOk ? "HubSpot isn't configured on this deployment" : "HubSpot import is a Solo plan feature"}
          </div>
          <p className="text-[12.5px] text-(--revint-text-2)">
            HubSpot stays your system of record. Revint imports leads and starts analysis on matched
            accounts.
          </p>
          {!planOk && (
            <Button asChild className="w-full">
              <a href="/app/settings/billing">
                Upgrade to connect HubSpot <ArrowUpRight className="w-4 h-4" />
              </a>
            </Button>
          )}
        </div>
        <Button variant="outline" className="w-full" onClick={() => { trackOnboarding("hubspot_skipped"); onSkip(); }}>
          Continue without HubSpot
        </Button>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2 text-(--revint-300) text-sm">
          <Plug className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            HubSpot stays your system of record. Revint imports your leads and starts analysis on
            matched accounts.
          </span>
        </div>
        <Button className="w-full" onClick={connect}>
          <Plug className="w-4 h-4" /> Connect HubSpot
        </Button>
        <Button variant="ghost" className="w-full text-white/40" onClick={() => { trackOnboarding("hubspot_skipped"); onSkip(); }}>
          Continue without HubSpot
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-xl border border-(--revint-success)/30 bg-(--revint-success)/5 p-3">
        <CheckCircle2 className="w-4 h-4 text-(--revint-success)" />
        <span className="text-[13px] font-medium text-(--revint-text-1)">HubSpot connected</span>
      </div>

      {summary ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3 text-[12.5px]">
          <div className="grid grid-cols-3 gap-3 text-center">
            <Tally label="Imported" value={summary.totalCreated} />
            <Tally
              label="Matched"
              value={(summary.contacts?.matched ?? 0) + (summary.companies?.matched ?? 0)}
            />
            <Tally
              label="Scanned"
              value={(summary.contacts?.scanned ?? 0) + (summary.companies?.scanned ?? 0)}
            />
          </div>
          <ul className="text-(--revint-text-3) space-y-1">
            <li><strong className="text-(--revint-text-2)">Imported</strong> — records now in Revint Leads.</li>
            <li><strong className="text-(--revint-text-2)">Matched</strong> — paired with a Google Place; analysis started.</li>
            <li><strong className="text-(--revint-text-2)">CRM-only</strong> — analysis waits for a place match.</li>
          </ul>
          {summary.hasMore ? (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={runImport} disabled={importing}>
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Import next batch
              </Button>
              <Button className="flex-1" onClick={onImported}>
                Continue
              </Button>
            </div>
          ) : (
            <Button className="w-full" onClick={onImported}>
              Continue to your leads
            </Button>
          )}
        </div>
      ) : (
        <>
          <p className="text-[12.5px] text-(--revint-text-2)">
            Import your existing HubSpot contacts &amp; companies as Revint leads. We dedupe and start
            analysis on matched accounts.
          </p>
          <Button className="w-full" onClick={runImport} disabled={importing}>
            {importing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Importing…
              </>
            ) : (
              <>
                <Download className="w-4 h-4" /> Import leads from HubSpot
              </>
            )}
          </Button>
          <Button variant="ghost" className="w-full text-white/40" onClick={() => { trackOnboarding("hubspot_skipped"); onSkip(); }}>
            Skip — import later
          </Button>
        </>
      )}
    </div>
  );
}

function Tally({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white/5 py-2">
      <div className="text-lg font-semibold text-(--revint-text-1)">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-white/40">{label}</div>
    </div>
  );
}
