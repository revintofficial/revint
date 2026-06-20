"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Plug,
  CheckCircle2,
  Lock,
  ArrowUpRight,
  Download,
  CreditCard,
  ListChecks,
  AlertTriangle,
} from "lucide-react";
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

interface ProvisionResponse {
  ok: boolean;
  cardInstalled: boolean;
  properties: {
    created: number;
    existing: number;
    failed: number;
    failedNames?: string[];
    total: number;
  };
}

type ProvisionState = "idle" | "provisioning" | "done" | "error";

export function HubspotImportStep({
  plan,
  configured,
  connected,
  propertiesProvisionedAt,
  onSkip,
  onImported,
  onProvisioned,
}: {
  plan: Plan;
  configured: boolean;
  connected: boolean;
  propertiesProvisionedAt: string | null;
  onSkip: () => void;
  onImported: () => void;
  onProvisioned: () => Promise<unknown>;
}) {
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<SyncResponse | null>(null);
  const [provisionState, setProvisionState] = useState<ProvisionState>(
    propertiesProvisionedAt ? "done" : "idle",
  );
  const [propertyCounts, setPropertyCounts] = useState<{ created: number; existing: number; total: number } | null>(null);
  const provisionStartedRef = useRef(false);
  const provisionToastedRef = useRef(false);

  const planOk = plan !== "FREE";

  const connect = () => {
    trackOnboarding("hubspot_connect_started");
    window.location.href = `/api/integrations/hubspot/connect?returnTo=${encodeURIComponent(
      `/app/onboarding?step=${HUBSPOT_STEP_INDEX}&hubspot_connected=1`,
    )}`;
  };

  const announceProvisioned = useCallback(() => {
    if (provisionToastedRef.current) return;
    provisionToastedRef.current = true;
    toast.success("Revint card & properties added to HubSpot", {
      description: "Your contact and company records now show Revint scores and signals.",
    });
  }, []);

  // Create (or re-create) the Revint App Card backing properties in the
  // portal. The OAuth callback already does this best-effort on connect;
  // running it here makes the result visible in onboarding and provides a
  // retry path if the callback's provisioning failed.
  const runProvision = useCallback(async () => {
    setProvisionState("provisioning");
    try {
      const res = await fetch("/api/integrations/hubspot/provision", { method: "POST" });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        toast.error(err.message || err.error || "Couldn't add the Revint card & properties");
        setProvisionState("error");
        return;
      }
      const data = (await res.json()) as ProvisionResponse;
      setPropertyCounts({
        created: data.properties.created,
        existing: data.properties.existing,
        total: data.properties.total,
      });
      // A 200 with `ok:false` means the provision partially failed (some
      // `revint_*` properties couldn't be created — usually a missing
      // `crm.schemas.contacts.write` scope). Surface it instead of a
      // false success so the user reconnects with the right app.
      if (!data.ok || data.properties.failed > 0) {
        setProvisionState("error");
        toast.error(
          `${data.properties.failed} Revint propert${
            data.properties.failed === 1 ? "y" : "ies"
          } couldn't be created`,
          {
            description:
              "Your HubSpot connection may be missing schema-write permission. Reconnect with the Revint app to finish setup.",
          },
        );
        return;
      }
      setProvisionState("done");
      trackOnboarding("hubspot_provisioned", { created: data.properties.created });
      announceProvisioned();
      await onProvisioned();
    } catch {
      setProvisionState("error");
      toast.error("Couldn't add the Revint card & properties");
    }
  }, [announceProvisioned, onProvisioned]);

  // On reaching the connected state, make sure the card + properties exist
  // and tell the user. If the callback already provisioned them we just
  // announce; otherwise we provision once as a fallback.
  useEffect(() => {
    if (!connected) return;
    if (propertiesProvisionedAt) {
      setProvisionState("done");
      announceProvisioned();
      return;
    }
    if (provisionStartedRef.current) return;
    provisionStartedRef.current = true;
    void runProvision();
  }, [connected, propertiesProvisionedAt, announceProvisioned, runProvision]);

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

      <ProvisioningChecklist
        state={provisionState}
        propertyCounts={propertyCounts}
        onRetry={runProvision}
      />

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

function ProvisioningChecklist({
  state,
  propertyCounts,
  onRetry,
}: {
  state: ProvisionState;
  propertyCounts: { created: number; existing: number; total: number } | null;
  onRetry: () => void;
}) {
  const propertyDetail =
    state === "done"
      ? propertyCounts
        ? propertyCounts.created > 0
          ? `${propertyCounts.created} new · ${propertyCounts.existing} already there`
          : "All set — Revint scores, temperature, next action & more"
        : "Revint scores, temperature, next action & more"
      : state === "error"
        ? "Couldn't add the properties — retry below"
        : "Adding Revint scores, temperature, next action & more…";

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
      <p className="text-[11px] uppercase tracking-wide text-white/40">
        Added to your HubSpot portal
      </p>
      <ChecklistRow
        icon={<CreditCard className="w-4 h-4 text-(--revint-300)" />}
        title="Revint card on contact & company records"
        detail="See each lead's score and next best action without leaving HubSpot."
        status="done"
      />
      <ChecklistRow
        icon={<ListChecks className="w-4 h-4 text-(--revint-300)" />}
        title="Revint custom properties"
        detail={propertyDetail}
        status={state}
      />
      {state === "error" && (
        <Button variant="outline" size="sm" className="w-full" onClick={onRetry}>
          <AlertTriangle className="w-4 h-4" /> Retry adding card &amp; properties
        </Button>
      )}
    </div>
  );
}

function ChecklistRow({
  icon,
  title,
  detail,
  status,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  status: ProvisionState | "pending";
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-(--revint-text-1)">{title}</div>
        <div className="text-[12px] text-(--revint-text-3)">{detail}</div>
      </div>
      <div className="mt-0.5 shrink-0">
        {status === "done" ? (
          <CheckCircle2 className="w-4 h-4 text-(--revint-success)" />
        ) : status === "error" ? (
          <AlertTriangle className="w-4 h-4 text-[hsl(4_62%_54%)]" />
        ) : (
          <Loader2 className="w-4 h-4 animate-spin text-white/40" />
        )}
      </div>
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
