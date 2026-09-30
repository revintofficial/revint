import Link from "next/link";
import { notFound } from "next/navigation";
import { Play } from "lucide-react";
import { getSessionDetail } from "@/lib/admin/queries";
import {
  SessionTimeline,
  type TimelineEvent,
} from "@/components/admin/session-timeline";
import { ScrollHeatmap } from "@/components/admin/scroll-heatmap";
import {
  flagEmoji,
  formatCountry,
  formatDuration,
  shortVisitorId,
} from "@/lib/admin/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function buildPosthogReplayUrl(posthogSessionId: string | null): string | null {
  if (!posthogSessionId) return null;
  const projectId = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_ID;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.posthog.com";
  // PostHog cloud accepts /project/<id>/replay/<sessionId> when
  // projectId is set; without it we fall back to the global replay
  // search route which still resolves the session.
  const root = host.replace(/\/+$/, "");
  if (projectId) {
    return `${root}/project/${projectId}/replay/${posthogSessionId}`;
  }
  return `${root}/replay/${posthogSessionId}`;
}

export default async function AdminSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getSessionDetail(id);
  if (!detail) notFound();
  const { session, pageViews, events } = detail;

  const replayUrl = buildPosthogReplayUrl(session.posthogSessionId);

  // Coerce events into TimelineEvent (cast properties to typed
  // record). We keep the raw json bag for the JSON dump expander.
  const timelineEvents: TimelineEvent[] = events.map((e) => ({
    id: e.id,
    ts: e.ts,
    type: e.type,
    path: e.path,
    properties: (e.properties as Record<string, unknown> | null) ?? null,
  }));

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Link
            href="/admin/sessions"
            className="text-xs text-[var(--revint-text-3)] hover:text-[var(--revint-text-1)]"
          >
            ← All sessions
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--revint-text-1)]">
            Session{" "}
            <code className="text-[var(--revint-300)] text-base">
              {session.id.slice(0, 8)}
            </code>
          </h1>
          <p className="mt-1 text-sm text-[var(--revint-text-2)]">
            Started {session.startedAt.toLocaleString()} · last activity{" "}
            {session.lastActivityAt.toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {replayUrl ? (
            <a
              href={replayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm bg-[var(--revint-500)] text-black font-medium hover:bg-[var(--revint-400)]"
            >
              <Play className="h-3.5 w-3.5" />
              Watch on PostHog
            </a>
          ) : (
            <span className="text-xs text-[var(--revint-text-3)]">
              No replay (PostHog not loaded for this visit)
            </span>
          )}
        </div>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Visitor" value={shortVisitorId(session.visitorId)} mono />
        <Stat
          label="Geo"
          value={`${flagEmoji(session.country)} ${formatCountry(session.country)}${session.city ? ` · ${session.city}` : ""}`}
        />
        <Stat
          label="Device"
          value={`${session.device ?? "—"} · ${session.browser ?? "?"} · ${session.os ?? "?"}`}
        />
        <Stat label="Duration" value={formatDuration(session.durationMs)} />
        <Stat label="Pages" value={String(session.pageCount)} />
        <Stat label="Max scroll" value={`${session.maxScrollPct}%`} />
        <Stat label="Engaged" value={session.hasEngaged ? "Yes" : "No"} />
        <Stat label="Converted" value={session.hasConverted ? "Yes" : "No"} />
      </section>

      <section className="rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] p-4 space-y-3">
        <h2 className="text-sm font-medium text-[var(--revint-text-1)]">
          Attribution
        </h2>
        <dl className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2 text-sm">
          <Row k="Landing path" v={<code>{session.landingPath}</code>} />
          <Row k="Exit path" v={session.exitPath ? <code>{session.exitPath}</code> : "—"} />
          <Row k="Referrer" v={session.referrer ?? "(direct)"} />
          <Row k="UTM source" v={session.utmSource ?? "—"} />
          <Row k="UTM medium" v={session.utmMedium ?? "—"} />
          <Row k="UTM campaign" v={session.utmCampaign ?? "—"} />
          <Row k="UTM content" v={session.utmContent ?? "—"} />
          <Row k="UTM term" v={session.utmTerm ?? "—"} />
          <Row k="Viewport" v={`${session.viewportWidth ?? "?"}×${session.viewportHeight ?? "?"}`} />
        </dl>
      </section>

      <section>
        <h2 className="text-sm font-medium text-[var(--revint-text-1)] mb-2">
          Pages visited ({pageViews.length})
        </h2>
        <div className="rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] divide-y divide-[var(--revint-border)]">
          {pageViews.length === 0 && (
            <div className="px-4 py-3 text-sm text-[var(--revint-text-3)]">
              No page views recorded.
            </div>
          )}
          {pageViews.map((pv) => (
            <div key={pv.id} className="px-4 py-3 flex items-center gap-4">
              <code className="flex-1 min-w-0 truncate text-sm text-[var(--revint-text-1)]">
                {pv.path}
              </code>
              <div className="text-xs text-[var(--revint-text-3)] tabular-nums w-20 text-right">
                {formatDuration(pv.durationMs)}
              </div>
              <div className="w-44 shrink-0">
                <ScrollHeatmap
                  maxPct={pv.maxScrollPct}
                  milestones={pv.scrollMilestones}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-[var(--revint-text-1)] mb-2">
          Timeline ({timelineEvents.length} events)
        </h2>
        <div className="rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] p-4">
          <SessionTimeline events={timelineEvents} />
        </div>
      </section>

      <details className="rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] p-4">
        <summary className="text-sm text-[var(--revint-text-2)] cursor-pointer">
          Raw JSON dump (debug)
        </summary>
        <pre className="mt-3 text-xs text-[var(--revint-text-3)] overflow-auto max-h-96">
          {JSON.stringify({ session, pageViews, events }, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-[var(--revint-border)] bg-[var(--revint-bg)] p-3">
      <div className="text-[10px] uppercase tracking-wider text-[var(--revint-text-3)]">
        {label}
      </div>
      <div
        className={`mt-1 text-sm text-[var(--revint-text-1)] ${mono ? "font-mono" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <>
      <dt className="text-[var(--revint-text-3)]">{k}</dt>
      <dd className="lg:col-span-2 text-[var(--revint-text-1)] break-all">{v}</dd>
    </>
  );
}
