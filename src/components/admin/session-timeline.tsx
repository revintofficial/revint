import { cn } from "@/lib/utils";

export interface TimelineEvent {
  id: string;
  ts: Date | string;
  type: string;
  path: string;
  properties: Record<string, unknown> | null;
}

const TYPE_STYLES: Record<string, { dot: string; label: string }> = {
  page_view: { dot: "bg-[var(--leadac-info)]", label: "page" },
  page_leave: { dot: "bg-[var(--leadac-text-3)]", label: "left" },
  click: { dot: "bg-[var(--leadac-500)]", label: "click" },
  cta_click: { dot: "bg-[var(--leadac-warning)]", label: "CTA" },
  scroll: { dot: "bg-[var(--leadac-300)]", label: "scroll" },
  form_focus: { dot: "bg-[var(--leadac-info)]", label: "focus" },
  form_blur: { dot: "bg-[var(--leadac-text-3)]", label: "blur" },
  form_submit: { dot: "bg-[var(--leadac-success)]", label: "submit" },
  signup: { dot: "bg-[var(--leadac-success)]", label: "signup" },
  error: { dot: "bg-[var(--leadac-error)]", label: "error" },
  video_play: { dot: "bg-[var(--leadac-300)]", label: "video" },
  video_progress: { dot: "bg-[var(--leadac-300)]", label: "video" },
};

function fmtTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString("en-GB", { hour12: false });
}

function eventDescription(ev: TimelineEvent): string {
  const props = ev.properties ?? {};
  switch (ev.type) {
    case "page_view": {
      const title = typeof props.title === "string" ? props.title : null;
      return title ? `${ev.path} — ${title}` : ev.path;
    }
    case "page_leave": {
      const dur = typeof props.durationMs === "number" ? Math.round(props.durationMs / 1000) : null;
      const ms = typeof props.maxScrollPct === "number" ? props.maxScrollPct : null;
      return `Left ${ev.path}${dur != null ? ` after ${dur}s` : ""}${ms != null ? `, ${ms}% scroll` : ""}`;
    }
    case "click":
    case "cta_click": {
      const text = typeof props.text === "string" ? props.text : "";
      const cta = typeof props.ctaId === "string" ? `[${props.ctaId}]` : "";
      const sel = typeof props.selector === "string" ? props.selector : "";
      const headline = text || cta || sel;
      return `${headline}${sel && headline !== sel ? `  (${sel})` : ""}`;
    }
    case "scroll": {
      const pct = typeof props.pct === "number" ? props.pct : null;
      return pct != null ? `Scrolled to ${pct}%` : "Scroll milestone";
    }
    case "form_focus":
    case "form_blur": {
      const f = typeof props.formName === "string" ? props.formName : "form";
      const fld = typeof props.fieldName === "string" ? props.fieldName : "(field)";
      const dur = typeof props.durationMs === "number" ? ` (${Math.round(props.durationMs / 1000)}s)` : "";
      return `${f}::${fld}${dur}`;
    }
    case "form_submit": {
      const f = typeof props.formName === "string" ? props.formName : "form";
      const fc = typeof props.fieldCount === "number" ? props.fieldCount : null;
      return `${f}${fc != null ? ` (${fc} fields)` : ""}`;
    }
    case "signup": {
      const m = typeof props.method === "string" ? props.method : "email";
      return `Signup via ${m}`;
    }
    case "error": {
      const m = typeof props.message === "string" ? props.message : "(unknown)";
      const src = typeof props.source === "string" ? props.source : "";
      return `${m}${src ? `  @ ${src}` : ""}`;
    }
    default:
      return ev.path;
  }
}

export function SessionTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--leadac-border)] bg-[var(--leadac-card)] p-6 text-sm text-[var(--leadac-text-3)] text-center">
        No events captured for this session.
      </div>
    );
  }

  return (
    <ol className="relative pl-6">
      <span className="absolute left-2 top-2 bottom-2 w-px bg-[var(--leadac-border)]" />
      {events.map((ev) => {
        const style = TYPE_STYLES[ev.type] ?? {
          dot: "bg-[var(--leadac-text-3)]",
          label: ev.type,
        };
        return (
          <li key={ev.id} className="relative pb-3">
            <span
              className={cn(
                "absolute -left-[18px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-[var(--leadac-bg)]",
                style.dot,
              )}
            />
            <div className="flex items-baseline gap-3 text-sm">
              <span className="text-xs text-[var(--leadac-text-3)] tabular-nums shrink-0 w-20">
                {fmtTime(ev.ts)}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-[var(--leadac-text-3)] shrink-0 w-16">
                {style.label}
              </span>
              <span className="text-[var(--leadac-text-1)] break-words">
                {eventDescription(ev)}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
