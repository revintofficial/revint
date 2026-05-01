/**
 * DossierSourceDrawer — right-side slide-in panel that shows the FULL
 * data behind a citation chip. Triggered by clicking any chip in the
 * AI Dossier markdown.
 *
 * Built directly on top of Radix `@radix-ui/react-dialog` primitives
 * (rather than the project's `Dialog` wrapper, which is centered) so
 * we get the slide-from-right animation + h-screen sizing without
 * forking the shared Dialog.
 *
 * Three render layers:
 *   1. Header — icon + title + description from the source registry.
 *   2. Body — kind-specific content (audit grid, review list, niche
 *      pitch angle, agent-run KeyMetrics + raw JSON, memory snippets).
 *   3. Footer — "Open in tab" CTA that closes the drawer and asks the
 *      page to switch tabs + scroll to the matching anchor.
 */
"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  chipClassesForTone,
  getSourceVisual,
  type CanonicalTag,
  type DossierSourcesPayload,
  type LeadDetailTab,
} from "./source-registry";

interface DossierSourceDrawerProps {
  tag: CanonicalTag | null;
  sources: DossierSourcesPayload | null;
  onClose: () => void;
  onJumpToTab: (tab: LeadDetailTab, anchor: string) => void;
}

export function DossierSourceDrawer({
  tag,
  sources,
  onClose,
  onJumpToTab,
}: DossierSourceDrawerProps) {
  const open = tag != null;
  if (!tag) {
    return null;
  }
  const visual = getSourceVisual(tag);
  const tone = chipClassesForTone(visual.tone);
  const Icon = visual.Icon;

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <DialogPrimitive.Content
          className={cn(
            // Phone: bottom-sheet (92vh, slides up). Tablet+: right side drawer.
            "fixed left-0 right-0 bottom-0 max-h-[92vh] rounded-t-2xl flex flex-col z-50 safe-pb",
            "md:left-auto md:right-0 md:top-0 md:bottom-0 md:max-h-none md:h-screen md:w-full md:max-w-[480px] md:rounded-none md:safe-pb-0",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
            "md:data-[state=open]:slide-in-from-right md:data-[state=closed]:slide-out-to-right",
            "duration-200",
          )}
          style={{
            background: "hsl(var(--leadac-h) var(--leadac-ns) 10% / 0.98)",
            backdropFilter: "saturate(180%) blur(30px)",
            WebkitBackdropFilter: "saturate(180%) blur(30px)",
            border: "0.5px solid hsl(0 0% 100% / 0.12)",
            boxShadow: "0 -8px 60px rgba(0, 0, 0, 0.5)",
          }}
        >
          {/* Phone-only drag handle for visual affordance */}
          <div className="md:hidden flex justify-center pt-2 pb-1" aria-hidden="true">
            <div
              className="rounded-full"
              style={{
                width: "36px",
                height: "5px",
                background: "hsl(0 0% 100% / 0.25)",
              }}
            />
          </div>
          {/* Header */}
          <div className="px-5 pt-5 pb-4 border-b border-white/8 flex items-start gap-3">
            <span
              className={cn(
                "inline-flex items-center justify-center rounded-lg w-10 h-10 shrink-0 border",
                tone.bg,
                tone.border,
              )}
            >
              <Icon className={cn("w-5 h-5", tone.iconColor)} />
            </span>
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="text-[15px] font-semibold text-white leading-tight">
                {visual.title}
              </DialogPrimitive.Title>
              {visual.description && (
                <DialogPrimitive.Description className="text-[12px] text-white/50 mt-1 leading-snug">
                  {visual.description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close
              className="rounded-md p-1 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close drawer"
            >
              <X className="w-4 h-4" />
            </DialogPrimitive.Close>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
            <DrawerBody tag={tag} sources={sources} />
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-white/8 flex items-center justify-between gap-3">
            <span className="text-[11px] text-white/40">
              {visual.jumpTab.charAt(0).toUpperCase() + visual.jumpTab.slice(1)} tab
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onJumpToTab(visual.jumpTab, visual.jumpAnchor)}
              className="gap-1.5 text-xs h-8"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open in tab
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/* ------------------------------------------------------------------ */
/*  Body renderer                                                      */
/* ------------------------------------------------------------------ */

function DrawerBody({
  tag,
  sources,
}: {
  tag: CanonicalTag;
  sources: DossierSourcesPayload | null;
}) {
  if (!sources) return <DrawerSkeleton />;

  if (tag.kind === "native") {
    switch (tag.key) {
      case "lead":
        return <LeadBody sources={sources} />;
      case "website_audit":
        return <WebsiteAuditBody sources={sources} />;
      case "sales_opportunity":
        return <SalesOpportunityBody sources={sources} />;
      case "review_analysis":
        return <ReviewAnalysisBody sources={sources} />;
      case "reviews":
        return <ReviewsBody sources={sources} />;
      case "voice_notes":
        return <VoiceNotesBody sources={sources} />;
      case "niche_pack":
        return <NichePackBody sources={sources} />;
      case "service_packages":
        return <ServicePackagesBody sources={sources} />;
    }
  }

  if (tag.kind === "run") {
    return <RunBody tag={tag} sources={sources} />;
  }

  if (tag.kind === "memory") {
    return <MemoryBody tag={tag} sources={sources} />;
  }

  return (
    <Empty>
      Unrecognised citation token: <code className="text-white/70">[{tag.raw}]</code>
    </Empty>
  );
}

function DrawerSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-12 rounded-lg bg-white/5 animate-pulse" />
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="text-[11px] uppercase tracking-[0.06em] text-white/40 mb-2">{title}</h4>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[12.5px] py-1.5 border-b border-white/5 last:border-0">
      <span className="text-white/50 shrink-0">{label}</span>
      <span className="text-white/85 text-right wrap-break-word min-w-0">{value}</span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/2 p-4 text-[12.5px] text-white/55 leading-snug">
      {children}
    </div>
  );
}

function fmtBool(b: boolean): React.ReactNode {
  return (
    <span className={b ? "text-(--system-green)" : "text-(--system-red)"}>
      {b ? "yes" : "no"}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Native bodies                                                      */
/* ------------------------------------------------------------------ */

function LeadBody({ sources }: { sources: DossierSourcesPayload }) {
  const l = sources.lead;
  return (
    <Section title="Business profile">
      <Field label="Name" value={l.businessName} />
      <Field label="Type" value={l.primaryType ?? "—"} />
      <Field label="Address" value={l.formattedAddress} />
      <Field label="Phone" value={l.phone ?? "—"} />
      <Field label="Website" value={l.websiteUrl ?? "—"} />
      <Field
        label="Rating"
        value={
          l.rating != null
            ? `${l.rating}★ from ${l.reviewCount ?? 0} reviews`
            : "—"
        }
      />
      <Field label="Niche" value={l.subNicheSlug ?? l.nicheSlug ?? "—"} />
      {l.subNicheSource && (
        <Field
          label="Niche source"
          value={`${l.subNicheSource}${
            l.subNicheConfidence != null ? ` (${Math.round(l.subNicheConfidence * 100)}%)` : ""
          }`}
        />
      )}
    </Section>
  );
}

function WebsiteAuditBody({ sources }: { sources: DossierSourcesPayload }) {
  const a = sources.websiteAudit;
  if (!a) return <Empty>No website audit yet. Run the website auditor to populate this section.</Empty>;
  const sec = (a.securityHeaders as Record<string, boolean> | null) ?? null;
  return (
    <>
      <Section title="Reachability">
        <Field label="Reachable" value={fmtBool(Boolean(a.reachable))} />
        <Field label="HTTP status" value={(a.httpStatus as number | null) ?? "—"} />
        <Field label="Load time" value={a.loadTimeMs != null ? `${a.loadTimeMs} ms` : "—"} />
        <Field label="HTTPS" value={fmtBool(Boolean(a.https))} />
        <Field label="Mobile-friendly" value={fmtBool(Boolean(a.mobileFriendlyGuess))} />
      </Section>
      <Section title="Integrations">
        <Field label="Contact form" value={fmtBool(Boolean(a.hasContactForm))} />
        <Field label="WhatsApp link" value={fmtBool(Boolean(a.hasWhatsappLink))} />
        <Field label="Booking system" value={fmtBool(Boolean(a.hasBookingSystem))} />
        <Field label="Booking provider" value={(a.bookingProvider as string | null) ?? "—"} />
        <Field label="E-commerce" value={fmtBool(Boolean(a.hasEcommerce))} />
        <Field
          label="Services detected"
          value={
            Array.isArray(a.servicesDetected) && a.servicesDetected.length > 0
              ? (a.servicesDetected as string[]).join(", ")
              : "—"
          }
        />
      </Section>
      {sec && (
        <Section title="Security headers">
          {Object.entries(sec).map(([k, v]) => (
            <Field key={k} label={k} value={fmtBool(Boolean(v))} />
          ))}
        </Section>
      )}
    </>
  );
}

function SalesOpportunityBody({ sources }: { sources: DossierSourcesPayload }) {
  const o = sources.salesOpportunity;
  if (!o) return <Empty>Not scored yet. The sales opportunity scorer has not run.</Empty>;
  return (
    <>
      <Section title="Score">
        <Field
          label="Opportunity score"
          value={typeof o.opportunityScore === "number" ? `${o.opportunityScore}/100` : "—"}
        />
        <Field label="Suggested offer" value={(o.suggestedOffer as string | undefined) ?? "—"} />
        <Field label="Expected price band" value={(o.expectedPriceBand as string | undefined) ?? "—"} />
        <Field label="Status" value={(o.status as string | undefined) ?? "—"} />
      </Section>
      {typeof o.bestSalesAngle === "string" && o.bestSalesAngle && (
        <Section title="Best sales angle">
          <p className="text-[12.5px] text-white/80 leading-snug">{o.bestSalesAngle as string}</p>
        </Section>
      )}
      {Array.isArray(o.likelyPainPoints) && o.likelyPainPoints.length > 0 && (
        <Section title="Likely pain points">
          <ul className="text-[12.5px] text-white/80 list-disc pl-5 space-y-1">
            {(o.likelyPainPoints as string[]).map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </Section>
      )}
      {Array.isArray(o.reasonCodes) && o.reasonCodes.length > 0 && (
        <Section title="Reason codes">
          <div className="flex flex-wrap gap-1.5">
            {(o.reasonCodes as string[]).map((r) => (
              <span
                key={r}
                className="text-[10.5px] px-1.5 py-0.5 rounded border border-white/10 text-white/65 bg-white/5"
              >
                {r}
              </span>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

function ReviewAnalysisBody({ sources }: { sources: DossierSourcesPayload }) {
  const r = sources.reviewAnalysis;
  if (!r) return <Empty>Reviews not analysed yet.</Empty>;
  const pains = Array.isArray(r.painPhrases) ? (r.painPhrases as string[]) : [];
  const strengths = Array.isArray(r.strengthPhrases) ? (r.strengthPhrases as string[]) : [];
  const weaknessKpis = Array.isArray(r.weaknessKpis)
    ? (r.weaknessKpis as Array<{ label: string; percent: number }>)
    : [];
  return (
    <>
      <Section title="Headline">
        <Field label="Lead score" value={`${r.leadScore}/100`} />
        <Field label="Reviews analysed" value={String(r.reviewsAnalyzedCount)} />
        {r.summary && (
          <p className="text-[12.5px] text-white/75 leading-snug pt-2 italic">{r.summary}</p>
        )}
      </Section>
      {weaknessKpis.length > 0 && (
        <Section title="Weakness KPIs">
          {weaknessKpis.map((k, i) => (
            <Field key={i} label={k.label} value={`${k.percent}%`} />
          ))}
        </Section>
      )}
      {pains.length > 0 && (
        <Section title="Pain phrases">
          <ul className="text-[12.5px] text-white/80 list-disc pl-5 space-y-1">
            {pains.slice(0, 8).map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </Section>
      )}
      {strengths.length > 0 && (
        <Section title="Strength phrases">
          <ul className="text-[12.5px] text-white/80 list-disc pl-5 space-y-1">
            {strengths.slice(0, 8).map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}

function ReviewsBody({ sources }: { sources: DossierSourcesPayload }) {
  if (sources.reviews.length === 0) return <Empty>No Google reviews loaded yet.</Empty>;
  return (
    <Section title={`Latest ${sources.reviews.length} review${sources.reviews.length === 1 ? "" : "s"}`}>
      {sources.reviews.map((r) => (
        <div
          key={r.id}
          className="rounded-lg border border-white/8 bg-white/2 p-3 space-y-1.5"
        >
          <div className="flex items-center justify-between gap-2 text-[11.5px] text-white/55">
            <span>{r.authorName}</span>
            <span>{r.rating}★</span>
          </div>
          {r.text && <p className="text-[12.5px] text-white/80 leading-snug">{r.text}</p>}
          {r.relativeTime && <div className="text-[10.5px] text-white/35">{r.relativeTime}</div>}
        </div>
      ))}
    </Section>
  );
}

function VoiceNotesBody({ sources }: { sources: DossierSourcesPayload }) {
  if (sources.voiceNotes.count === 0) return <Empty>No voice notes recorded for this lead.</Empty>;
  return (
    <Section title={`${sources.voiceNotes.count} voice note${sources.voiceNotes.count === 1 ? "" : "s"}`}>
      {sources.voiceNotes.latest && (
        <div className="rounded-lg border border-white/8 bg-white/2 p-3 space-y-1.5">
          <div className="text-[10.5px] text-white/40">
            Latest · {new Date(sources.voiceNotes.latest.createdAt).toLocaleString()}
          </div>
          <p className="text-[12.5px] text-white/80 leading-snug">
            {sources.voiceNotes.latest.transcriptPreview}
          </p>
        </div>
      )}
    </Section>
  );
}

function NichePackBody({ sources }: { sources: DossierSourcesPayload }) {
  const n = sources.nichePack;
  if (!n) return <Empty>This lead has not been classified into a sub-vertical yet.</Empty>;
  return (
    <>
      <Section title="Pack">
        <Field label="Label" value={n.label} />
        <Field label="Slug" value={n.slug ?? "—"} />
        <p className="text-[12.5px] text-white/80 italic pt-1">{n.tagline}</p>
      </Section>
      <Section title="Pitch angle">
        <p className="text-[12.5px] text-white/85 leading-snug">{n.pitchAngle}</p>
      </Section>
      {n.highValueSignals.length > 0 && (
        <Section title="High-value signals">
          <ul className="text-[12.5px] text-white/80 list-disc pl-5 space-y-1">
            {n.highValueSignals.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </Section>
      )}
      {n.featuredProductModules.length > 0 && (
        <Section title="Featured modules">
          <div className="flex flex-wrap gap-1.5">
            {n.featuredProductModules.map((m) => (
              <span
                key={m}
                className="text-[10.5px] px-1.5 py-0.5 rounded border border-white/10 text-white/65 bg-white/5"
              >
                {m}
              </span>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

function ServicePackagesBody({ sources }: { sources: DossierSourcesPayload }) {
  if (sources.servicePackages.length === 0) {
    return <Empty>No service packages configured. Add packages in workspace settings.</Empty>;
  }
  return (
    <Section title={`${sources.servicePackages.length} package${sources.servicePackages.length === 1 ? "" : "s"}`}>
      {sources.servicePackages.map((p) => (
        <div
          key={p.id}
          className="rounded-lg border border-white/8 bg-white/2 p-3 space-y-2"
        >
          <div className="flex items-baseline justify-between gap-2">
            <div className="font-medium text-[13px] text-white">{p.name}</div>
            <div className="text-[12px] text-white/65">{p.priceLabel}</div>
          </div>
          {p.features.length > 0 && (
            <ul className="text-[11.5px] text-white/65 list-disc pl-4 space-y-0.5">
              {p.features.slice(0, 6).map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          )}
          {p.isPopular && (
            <span className="inline-block text-[10.5px] px-1.5 py-0.5 rounded border border-(--leadac-500)/40 text-(--leadac-500) bg-(--leadac-500)/10">
              Popular
            </span>
          )}
        </div>
      ))}
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  Run + memory bodies                                                */
/* ------------------------------------------------------------------ */

function RunBody({
  tag,
  sources,
}: {
  tag: Extract<CanonicalTag, { kind: "run" }>;
  sources: DossierSourcesPayload;
}) {
  const run = sources.runs[tag.workerKind];
  if (!run) {
    return (
      <Empty>
        No successful <code className="text-white/70">{tag.workerKind}</code> run for this lead. Run
        the worker from the Workers tab to populate it.
      </Empty>
    );
  }
  return (
    <>
      <Section title="Run metadata">
        <Field label="Worker kind" value={tag.workerKind} />
        <Field
          label="Finished at"
          value={run.finishedAt ? new Date(run.finishedAt).toLocaleString() : "—"}
        />
        <Field label="Run id" value={<code className="text-white/65 text-[11px]">{run.runId}</code>} />
        {run.artifactUrl && (
          <Field
            label="Artifact"
            value={
              <a
                href={run.artifactUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-(--leadac-500) hover:underline"
              >
                {run.artifactUrl}
              </a>
            }
          />
        )}
      </Section>

      {run.summary.headline && (
        <Section title="Headline">
          <p className="text-[12.5px] text-white/85 leading-snug italic">{run.summary.headline}</p>
        </Section>
      )}

      <Section title="Key metrics">
        {run.summary.metrics.length === 0 ? (
          <p className="text-[12px] text-white/45 italic">No metrics extracted.</p>
        ) : (
          run.summary.metrics.map((m, i) => <Field key={i} label={m.label} value={m.value} />)
        )}
      </Section>

      {run.summary.skipped && run.summary.skipReason && (
        <Section title="Skip reason">
          <p className="text-[12px] text-(--system-orange) leading-snug">
            {run.summary.skipReason}
          </p>
        </Section>
      )}
    </>
  );
}

function MemoryBody({
  tag,
  sources,
}: {
  tag: Extract<CanonicalTag, { kind: "memory" }>;
  sources: DossierSourcesPayload;
}) {
  const group = sources.memory[tag.memoryKind];
  if (!group || group.count === 0) {
    return (
      <Empty>
        No <code className="text-white/70">{tag.memoryKind}</code> memory rows for this lead.
      </Empty>
    );
  }
  return (
    <>
      <Section title="Memory">
        <Field label="Kind" value={tag.memoryKind} />
        <Field label="Total rows" value={String(group.count)} />
      </Section>
      <Section title={`Latest ${group.latest.length} snippet${group.latest.length === 1 ? "" : "s"}`}>
        {group.latest.map((m) => (
          <div
            key={m.id}
            className="rounded-lg border border-white/8 bg-white/2 p-3 space-y-1.5"
          >
            <div className="flex items-center justify-between gap-2 text-[10.5px] text-white/40">
              <span>{m.refType ?? "—"}</span>
              <span>{new Date(m.createdAt).toLocaleDateString()}</span>
            </div>
            <p className="text-[12.5px] text-white/80 leading-snug whitespace-pre-line">{m.text}</p>
          </div>
        ))}
      </Section>
    </>
  );
}
