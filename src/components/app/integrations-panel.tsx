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
import { Plug, CheckCircle2, AlertTriangle, Trash2 } from "lucide-react";

interface HubspotState {
  status: "ACTIVE" | "EXPIRED" | "REVOKED" | "ERROR";
  portalId: string | null;
  scopeCount: number;
  defaultPipelineId: string | null;
  propertiesProvisioned: boolean;
  lastError: string | null;
  updatedAt: string;
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
            <Plug className="w-5 h-5 text-(--leadac-300)" /> HubSpot
          </CardTitle>
          <CardDescription>
            Two-way sync with HubSpot. HubSpot stays your system of record;
            LeadAC layers intelligence and workflow on top and writes back
            temperature, recommended angle, and next actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!configured ? (
            <div className="flex items-start gap-2 text-[13px] text-(--leadac-text-2)">
              <AlertTriangle className="w-4 h-4 mt-0.5 text-(--leadac-warning)" />
              <p>
                HubSpot isn&apos;t configured on this deployment yet. Set{" "}
                <code className="text-(--leadac-text-1)">HUBSPOT_CLIENT_ID</code> and{" "}
                <code className="text-(--leadac-text-1)">HUBSPOT_CLIENT_SECRET</code>{" "}
                in the environment to enable it.
              </p>
            </div>
          ) : connected ? (
            <>
              <div className="flex items-center gap-2 text-[13px]">
                <CheckCircle2 className="w-4 h-4 text-(--leadac-success)" />
                <span className="text-(--leadac-text-1) font-medium">Connected</span>
                {hubspot?.portalId && (
                  <span className="text-(--leadac-text-3)">· Portal {hubspot.portalId}</span>
                )}
              </div>
              <dl className="grid grid-cols-2 gap-2 text-[12.5px] text-(--leadac-text-2)">
                <div>
                  <dt className="text-(--leadac-text-3)">Status</dt>
                  <dd className="text-(--leadac-text-1)">{hubspot?.status}</dd>
                </div>
                <div>
                  <dt className="text-(--leadac-text-3)">Scopes</dt>
                  <dd className="text-(--leadac-text-1)">{hubspot?.scopeCount}</dd>
                </div>
                <div>
                  <dt className="text-(--leadac-text-3)">Custom properties</dt>
                  <dd className="text-(--leadac-text-1)">
                    {hubspot?.propertiesProvisioned ? "Provisioned" : "Pending"}
                  </dd>
                </div>
                <div>
                  <dt className="text-(--leadac-text-3)">Default pipeline</dt>
                  <dd className="text-(--leadac-text-1)">
                    {hubspot?.defaultPipelineId ?? "—"}
                  </dd>
                </div>
              </dl>
              {hubspot?.status === "ERROR" && hubspot.lastError && (
                <p className="text-[12px] text-(--leadac-error)">{hubspot.lastError}</p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={connect} disabled={busy}>
                  Reconnect
                </Button>
                <Button variant="ghost" onClick={disconnect} disabled={busy}>
                  <Trash2 className="w-4 h-4 mr-1" /> Disconnect
                </Button>
              </div>
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
