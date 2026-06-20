/**
 * FineDine v1 update — Integrations / CRM settings panel.
 *
 * Renders the HubSpot connection card: connect (redirect to OAuth),
 * disconnect, and a state summary. Reads the `?hubspot_connected` /
 * `?hubspot_error` callback flags to surface a toast.
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Plug, CheckCircle2, AlertTriangle, Trash2, RefreshCw } from "lucide-react";

interface HubspotState {
  status: "ACTIVE" | "EXPIRED" | "REVOKED" | "ERROR";
  portalId: string | null;
  scopeCount: number;
  defaultPipelineId: string | null;
  propertiesProvisioned: boolean;
  lastError: string | null;
  updatedAt: string;
}

/**
 * Turn the machine-readable `CrmConnection.lastError` codes written by the
 * OAuth callback / provision route into an actionable message. Falls back
 * to the raw string for unknown codes.
 */
function formatHubspotError(raw: string): string {
  if (raw.startsWith("missing_scope:")) {
    return "This HubSpot connection is missing the permission Revint needs to create its custom properties (crm.schemas.contacts.write). Reconnect with the Revint app to finish setup.";
  }
  if (raw.startsWith("property_provision_failed:")) {
    const names = raw.slice("property_provision_failed:".length);
    return `Some Revint custom properties couldn't be created${
      names ? ` (${names})` : ""
    }. This usually means the connection is missing schema-write permission — reconnect to retry.`;
  }
  return raw;
}

export function IntegrationsPanel({
  configured,
  hubspot,
}: {
  configured: boolean;
  hubspot: HubspotState | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (searchParams.get("hubspot_connected")) {
      toast.success("HubSpot connected");
      router.replace("/app/settings/integrations");
    }
    const err = searchParams.get("hubspot_error");
    if (err) {
      toast.error(`HubSpot connection failed: ${err}`);
      router.replace("/app/settings/integrations");
    }
  }, [searchParams, router]);

  const connected = !!hubspot && hubspot.status !== "REVOKED";

  const connect = () => {
    window.location.href = "/api/integrations/hubspot/connect";
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/integrations/hubspot/sync", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(
          data?.error === "hubspot_not_connected"
            ? "HubSpot is not connected"
            : "Import failed",
        );
        return;
      }
      const created = data.totalCreated ?? 0;
      const matched =
        (data.contacts?.matched ?? 0) + (data.companies?.matched ?? 0);
      toast.success(
        `Imported ${created} new lead${created === 1 ? "" : "s"} from HubSpot` +
          (matched ? ` · ${matched} matched to Google Places` : "") +
          (data.hasMore ? " · more remaining, run again" : ""),
      );
      router.refresh();
    } catch {
      toast.error("Import failed");
    } finally {
      setSyncing(false);
    }
  };

  const disconnect = async () => {
    if (!confirm("Disconnect HubSpot? Two-way sync will stop.")) return;
    setBusy(true);
    const res = await fetch("/api/integrations/hubspot/status", { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      toast.success("HubSpot disconnected");
      router.refresh();
    } else {
      toast.error("Couldn't disconnect");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="w-5 h-5 text-(--revint-300)" /> HubSpot
          </CardTitle>
          <CardDescription>
            Two-way sync with HubSpot. HubSpot stays your system of record;
            Revint layers intelligence and workflow on top and writes back
            temperature, recommended angle, and next actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!configured ? (
            <div className="flex items-start gap-2 text-[13px] text-(--revint-text-2)">
              <AlertTriangle className="w-4 h-4 mt-0.5 text-(--revint-warning)" />
              <p>
                HubSpot isn&apos;t configured on this deployment yet. Set{" "}
                <code className="text-(--revint-text-1)">HUBSPOT_CLIENT_ID</code> and{" "}
                <code className="text-(--revint-text-1)">HUBSPOT_CLIENT_SECRET</code>{" "}
                in the environment to enable it.
              </p>
            </div>
          ) : connected ? (
            <>
              <div className="flex items-center gap-2 text-[13px]">
                <CheckCircle2 className="w-4 h-4 text-(--revint-success)" />
                <span className="text-(--revint-text-1) font-medium">Connected</span>
                {hubspot?.portalId && (
                  <span className="text-(--revint-text-3)">· Portal {hubspot.portalId}</span>
                )}
              </div>
              <dl className="grid grid-cols-2 gap-2 text-[12.5px] text-(--revint-text-2)">
                <div>
                  <dt className="text-(--revint-text-3)">Status</dt>
                  <dd className="text-(--revint-text-1)">{hubspot?.status}</dd>
                </div>
                <div>
                  <dt className="text-(--revint-text-3)">Scopes</dt>
                  <dd className="text-(--revint-text-1)">{hubspot?.scopeCount}</dd>
                </div>
                <div>
                  <dt className="text-(--revint-text-3)">Custom properties</dt>
                  <dd className="text-(--revint-text-1)">
                    {hubspot?.propertiesProvisioned ? "Provisioned" : "Pending"}
                  </dd>
                </div>
                <div>
                  <dt className="text-(--revint-text-3)">Default pipeline</dt>
                  <dd className="text-(--revint-text-1)">
                    {hubspot?.defaultPipelineId ?? "—"}
                  </dd>
                </div>
              </dl>
              {hubspot?.lastError && (
                <div className="flex items-start gap-2 rounded-lg border border-(--revint-warning)/30 bg-(--revint-warning)/5 p-2.5">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-(--revint-warning)" />
                  <p className="text-[12px] text-(--revint-text-2)">
                    {formatHubspotError(hubspot.lastError)}
                  </p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button onClick={syncNow} disabled={syncing || busy}>
                  <RefreshCw
                    className={`w-4 h-4 mr-1 ${syncing ? "animate-spin" : ""}`}
                  />
                  {syncing ? "Importing…" : "Import leads from HubSpot"}
                </Button>
                <Button variant="outline" onClick={connect} disabled={busy || syncing}>
                  Reconnect
                </Button>
                <Button variant="ghost" onClick={disconnect} disabled={busy || syncing}>
                  <Trash2 className="w-4 h-4 mr-1" /> Disconnect
                </Button>
              </div>
              <p className="text-[12px] text-(--revint-text-3)">
                Pulls existing HubSpot contacts &amp; companies into Leads
                (place-matched where possible). New HubSpot activity syncs
                automatically via webhooks.
              </p>
            </>
          ) : (
            <Button onClick={connect} disabled={busy}>
              <Plug className="w-4 h-4 mr-1" /> Connect HubSpot
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
