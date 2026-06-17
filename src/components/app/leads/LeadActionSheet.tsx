"use client";

/**
 * FineDine v1 update — call-first Action Sheet.
 *
 * Sits at the top of the v1 Lead Detail surface (above the restaurant
 * analysis, which becomes supporting evidence). Renders:
 *   - Hero: business name, temperature badge, playbook stage chip, SLA
 *     line ("X hours ago · untouched · call today"), source + owner.
 *   - One-tap action row mapped to call dispositions.
 *   - FineDine Angle Card (pitch this / don't pitch).
 *   - Qualification checklist (saves + recomputes status/risk).
 *   - HubSpot Context panel (lazy).
 *   - Call Attempt History timeline.
 *
 * Self-contained: fetches its own data from the lead action-sheet /
 * hubspot-context / activities endpoints so it can refresh after an
 * action without reloading the whole (heavy) lead payload.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Phone,
  PhoneOff,
  Voicemail,
  CheckCircle2,
  CalendarCheck,
  ChevronDown,
  Flame,
  Snowflake,
  ThermometerSun,
  Plug,
  Clock,
  AlertTriangle,
  Star,
} from "lucide-react";
import { CircularProgress } from "@/components/ui/progress";
import { humanizePrimaryType } from "@/lib/labels";

interface PlaybookStage {
  key: string;
  label: string;
  meaning?: string;
  nextAction?: string;
  order: number;
}
interface ChecklistItem {
  key: string;
  label: string;
  requiredForQualified: boolean;
}
interface ActionSheet {
  businessName: string;
  phone: string | null;
  websiteUrl: string | null;
  timezone: string | null;
  formattedAddress: string | null;
  rating: number | null;
  reviewCount: number | null;
  borough: string | null;
  primaryType: string | null;
  businessStatus: string | null;
  salesConfidence: number | null;
  opportunityScore: number | null;
  playbook: { stages: PlaybookStage[]; qualificationChecklist: ChecklistItem[] };
  currentStageKey: string | null;
  temperature: "HOT" | "WARM" | "COLD";
  computedTemperature: "HOT" | "WARM" | "COLD";
  sla: {
    inboundReceivedAt: string | null;
    hoursSinceInbound: number | null;
    untouched: boolean;
    leadSource: string | null;
  };
  qualification: {
    answers: Record<string, boolean>;
    qualified: boolean;
    status: string;
    qualificationRisk: string | null;
    noShowRisk: string | null;
    missing: string[];
  };
  recommendedAngle: {
    key: string;
    label: string;
    whenToPitch?: string;
    whenNotToPitch?: string;
    matchedTriggers: string[];
    confident: boolean;
    openingHook: string | null;
    whatNotToPitch: string[];
  } | null;
  crm: {
    contactId: string | null;
    dealId: string | null;
    connected: boolean;
    lastSyncedAt: string | null;
  };
}

interface HubspotContext {
  portalId: string | null;
  contact?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    lifecycleStage?: string | null;
    lastActivityDate?: string | null;
    nextActivityDate?: string | null;
  };
  company?: { name?: string | null; domain?: string | null };
  deal?: { name?: string | null; stageId?: string | null; amount?: string | null };
  owner?: { email?: string; name?: string };
}

interface Activity {
  id: string;
  kind: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

const TEMP_META: Record<
  ActionSheet["temperature"],
  { label: string; icon: typeof Flame; color: string }
> = {
  HOT: { label: "Hot", icon: Flame, color: "var(--revint-error)" },
  WARM: { label: "Warm", icon: ThermometerSun, color: "var(--revint-warning)" },
  COLD: { label: "Cold", icon: Snowflake, color: "var(--revint-info)" },
};

/**
 * Prospect local time + call-window hint ("after hours" / "lunch
 * service" / "best window"). Re-renders once a minute so the clock
 * stays fresh while the rep sits on the page. Returns null when the
 * lead has no known timezone.
 */
function LocalTimeBadge({ timezone }: { timezone: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  let label = "";
  let isCallable = true;
  try {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const time = fmt.format(new Date());
    const hour = parseInt(time.split(":")[0] ?? "0", 10);
    let hint: string | null = null;
    if (hour < 9 || hour >= 19) {
      hint = "after hours";
      isCallable = false;
    } else if (hour >= 12 && hour < 14) {
      hint = "lunch service";
      isCallable = false;
    } else if (hour >= 14 && hour < 17) {
      hint = "best window";
    }
    label = hint ? `${time} · ${hint}` : time;
  } catch {
    return null;
  }
  return (
    <span
      className="inline-flex items-center gap-1 text-[12.5px]"
      style={{ color: isCallable ? "var(--revint-text-2)" : "hsl(35 80% 70%)" }}
      title={`Prospect timezone: ${timezone}`}
    >
      <Clock className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}

export function LeadActionSheet({ leadId }: { leadId: string }) {
  const [sheet, setSheet] = useState<ActionSheet | null>(null);
  const [hubspot, setHubspot] = useState<HubspotContext | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadSheet = useCallback(async () => {
    const res = await fetch(`/api/leads/${leadId}/action-sheet`);
    if (res.ok) {
      const data = await res.json();
      setSheet(data.actionSheet);
    }
  }, [leadId]);

  const loadActivities = useCallback(async () => {
    const res = await fetch(`/api/leads/${leadId}/activities`);
    if (res.ok) setActivities((await res.json()).activities ?? []);
  }, [leadId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await Promise.all([loadSheet(), loadActivities()]);
      if (!cancelled) setLoading(false);
      // HubSpot context is lazy + best-effort; don't block the sheet.
      fetch(`/api/leads/${leadId}/hubspot-context`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!cancelled && d?.context) setHubspot(d.context);
        })
        .catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, [leadId, loadSheet, loadActivities]);

  const logCall = async (disposition: string, label: string) => {
    setBusy(true);
    const res = await fetch(`/api/leads/${leadId}/log-call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disposition }),
    });
    setBusy(false);
    if (res.ok) {
      toast.success(`${label} logged`);
      await Promise.all([loadSheet(), loadActivities()]);
    } else {
      toast.error("Couldn't log call");
    }
  };

  const setStage = async (stageKey: string) => {
    setBusy(true);
    const res = await fetch(`/api/leads/${leadId}/playbook-stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageKey }),
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Stage updated");
      await Promise.all([loadSheet(), loadActivities()]);
    } else {
      toast.error("Couldn't update stage");
    }
  };

  if (loading) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }
  if (!sheet) return null;

  const temp = TEMP_META[sheet.temperature];
  const TempIcon = temp.icon;
  const currentStage = sheet.playbook.stages.find((s) => s.key === sheet.currentStageKey);
  const slaParts: string[] = [];
  if (sheet.sla.hoursSinceInbound !== null) {
    slaParts.push(
      sheet.sla.hoursSinceInbound <= 0
        ? "just now"
        : `${sheet.sla.hoursSinceInbound}h ago`,
    );
  }
  if (sheet.sla.untouched) slaParts.push("untouched");
  if (sheet.temperature === "HOT") slaParts.push("call today");

  const score = sheet.salesConfidence ?? sheet.opportunityScore ?? null;
  const scoreLabel = sheet.salesConfidence != null ? "Sales Fit" : "Opportunity";
  const potentialLabel =
    score == null ? null : score >= 60 ? "High Potential" : score >= 35 ? "Medium Potential" : "Low Potential";
  const potentialColor =
    score == null
      ? "var(--revint-text-3)"
      : score >= 60
        ? "var(--revint-success)"
        : score >= 35
          ? "var(--revint-warning)"
          : "var(--revint-error)";
  const chips: string[] = [];
  if (sheet.borough) chips.push(sheet.borough);
  if (sheet.primaryType) chips.push(humanizePrimaryType(sheet.primaryType));
  if (sheet.businessStatus && sheet.businessStatus !== "OPERATIONAL") chips.push(sheet.businessStatus);

  return (
    <div className="space-y-4">
      {/* Hero */}
      <Card className="overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-semibold text-(--revint-text-1) mr-1">
                  {sheet.businessName}
                </h1>
                <Badge
                  className="gap-1"
                  style={{ background: `color-mix(in srgb, ${temp.color} 18%, transparent)`, color: temp.color }}
                >
                  <TempIcon className="w-3.5 h-3.5" /> {temp.label}
                </Badge>

                {/* Playbook stage chip → picker */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-medium border border-(--revint-border) text-(--revint-text-2) hover:bg-(--revint-hover) transition-colors"
                      disabled={busy}
                    >
                      {currentStage?.label ?? "Set stage"}
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {sheet.playbook.stages.map((s) => (
                      <DropdownMenuItem key={s.key} onClick={() => void setStage(s.key)}>
                        <div>
                          <div className="text-[13px]">{s.label}</div>
                          {s.meaning && (
                            <div className="text-[11px] text-(--revint-text-3)">{s.meaning}</div>
                          )}
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Prospect local time / call-window hint */}
                {sheet.timezone && (
                  <span className="ml-auto">
                    <LocalTimeBadge timezone={sheet.timezone} />
                  </span>
                )}
              </div>

              {/* Address */}
              {sheet.formattedAddress && (
                <p className="text-[13px] text-(--revint-text-2)">{sheet.formattedAddress}</p>
              )}

              {/* Rating + identity chips */}
              {(sheet.rating != null || chips.length > 0) && (
                <div className="flex flex-wrap items-center gap-2">
                  {sheet.rating != null && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-(--revint-hover) px-2.5 py-0.5 text-[12.5px] text-(--revint-text-2)">
                      <Star className="w-3.5 h-3.5 text-(--revint-warning) fill-(--revint-warning)" />
                      {sheet.rating.toFixed(1)}
                      {sheet.reviewCount != null && (
                        <span className="text-(--revint-text-3)">({sheet.reviewCount})</span>
                      )}
                    </span>
                  )}
                  {chips.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center rounded-full bg-(--revint-hover) px-2.5 py-0.5 text-[12.5px] text-(--revint-text-2)"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Sales Fit score ring */}
            {score != null && (
              <div
                className="shrink-0 flex flex-col items-center gap-1"
                title={`${scoreLabel} score`}
              >
                <div className="relative">
                  <CircularProgress value={score} size={64} strokeWidth={5} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[18px] font-semibold text-(--revint-text-1) leading-none">
                      {score}
                    </span>
                  </div>
                </div>
                <div className="text-center leading-tight">
                  <p className="text-[10px] uppercase tracking-[0.06em] text-(--revint-text-3)">
                    {scoreLabel}
                  </p>
                  <p className="text-[11.5px] font-medium" style={{ color: potentialColor }}>
                    {potentialLabel}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* SLA line */}
          {slaParts.length > 0 && (
            <div className="flex items-center gap-1.5 text-[12.5px] text-(--revint-text-2)">
              <Clock className="w-3.5 h-3.5" />
              <span>{slaParts.join(" · ")}</span>
              {sheet.sla.leadSource && (
                <span className="text-(--revint-text-3)">· {sheet.sla.leadSource}</span>
              )}
            </div>
          )}

          {/* Action row */}
          <div className="flex flex-wrap gap-2">
            {sheet.phone && (
              <Button asChild>
                <a href={`tel:${sheet.phone}`}>
                  <Phone className="w-4 h-4 mr-1" /> Call now
                </a>
              </Button>
            )}
            <Button variant="outline" disabled={busy} onClick={() => void logCall("NO_ANSWER", "No answer")}>
              <PhoneOff className="w-4 h-4 mr-1" /> No answer
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void logCall("VOICEMAIL", "Voicemail")}>
              <Voicemail className="w-4 h-4 mr-1" /> Voicemail
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void logCall("ANSWERED_INTERESTED", "Connected")}>
              <CheckCircle2 className="w-4 h-4 mr-1" /> Connected
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void logCall("BOOKED_MEETING", "Meeting booked")}>
              <CalendarCheck className="w-4 h-4 mr-1" /> Booked
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Qualification now lives inside the analysis hero below
          (LeadQualificationCard), so the rep sees it next to the
          fit summary / pain points instead of in this action sheet. */}

      {/* HubSpot context */}
      {sheet.crm.connected && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-[14px]">
              <Plug className="w-4 h-4 text-(--revint-300)" /> HubSpot context
            </CardTitle>
          </CardHeader>
          <CardContent className="text-[13px]">
            {hubspot ? (
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-4">
                {hubspot.deal?.stageId && (
                  <Field label="Deal stage" value={hubspot.deal.stageId} />
                )}
                {hubspot.contact?.lifecycleStage && (
                  <Field label="Lifecycle" value={hubspot.contact.lifecycleStage} />
                )}
                {hubspot.owner?.name || hubspot.owner?.email ? (
                  <Field label="Owner" value={hubspot.owner.name ?? hubspot.owner.email ?? ""} />
                ) : null}
                {hubspot.contact?.email && (
                  <Field label="Email" value={hubspot.contact.email} />
                )}
                {hubspot.deal?.amount && <Field label="Amount" value={hubspot.deal.amount} />}
                {hubspot.contact?.lastActivityDate && (
                  <Field
                    label="Last activity"
                    value={new Date(hubspot.contact.lastActivityDate).toLocaleDateString()}
                  />
                )}
              </dl>
            ) : (
              <p className="text-(--revint-text-3)">Loading HubSpot context…</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Call attempt history */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-[14px]">
            <Clock className="w-4 h-4 text-(--revint-300)" /> Call attempt history
          </CardTitle>
        </CardHeader>
        <CardContent className="text-[13px]">
          {activities.length === 0 ? (
            <p className="text-(--revint-text-3) flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> No activity yet — make the first touch.
            </p>
          ) : (
            <ul className="space-y-2">
              {activities.slice(0, 12).map((a) => {
                const disposition =
                  (a.payload?.disposition as string | undefined) ??
                  (a.payload?.to as string | undefined) ??
                  (a.payload?.body as string | undefined);
                return (
                  <li key={a.id} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-(--revint-500) shrink-0" />
                    <div className="min-w-0">
                      <span className="text-(--revint-text-1)">{a.kind.replace(/_/g, " ").toLowerCase()}</span>
                      {disposition && (
                        <span className="text-(--revint-text-2)"> · {String(disposition)}</span>
                      )}
                      <span className="text-(--revint-text-3)">
                        {" "}· {new Date(a.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-(--revint-text-3) text-[11px]">{label}</dt>
      <dd className="text-(--revint-text-1) truncate">{value}</dd>
    </div>
  );
}
