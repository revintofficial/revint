"use client";

/**
 * NextGestureBlock — wraps the existing `NbaContent` (extracted from
 * `NbaCard`) in the v2 `Block` primitive's expanded body. Adds the
 * v2-specific chrome on top: version chip, action chips
 * (Dial / Email / WhatsApp / Schedule / Snooze), and an "open full
 * graph →" link placeholder (Phase 7 wires the route).
 *
 * Phase 1 only consumes the existing NBA response shape. Phase 2 will
 * thread through the inline evidence chip set (BANT / SPIN /
 * stakeholders) and add objection rebuttals.
 */

import { type ReactNode, useMemo } from "react";
import {
  Calendar,
  ExternalLink,
  Mail,
  MessageCircle,
  Phone,
  Sparkles,
  ZapOff,
} from "lucide-react";

import {
  NbaContent,
  type NextActionResponse,
} from "@/components/app/nba/NbaCard";
import { Badge } from "@/components/ui/badge";

export interface NextGestureBlockCopy {
  preliminary: string;
  final: string;
  empty: string;
  openFullGraph: string;
  dial: string;
  email: string;
  whatsapp: string;
  schedule: string;
  snooze: string;
}

export interface NextGestureBlockProps {
  data: NextActionResponse | null;
  loading: boolean;
  leadId: string;
  phone: string | null;
  email: string | null;
  copy: NextGestureBlockCopy;
}

function buildTelHref(phone: string | null): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned ? `tel:${cleaned}` : null;
}

function buildWaHref(phone: string | null): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d]/g, "");
  if (!cleaned) return null;
  return `https://wa.me/${cleaned}`;
}

export function NextGestureBlock({
  data,
  loading,
  phone,
  email,
  copy,
}: NextGestureBlockProps): ReactNode {
  const tel = useMemo(() => buildTelHref(phone), [phone]);
  const wa = useMemo(() => buildWaHref(phone), [phone]);
  const mail = email ? `mailto:${email}` : null;

  if (loading && !data) {
    return (
      <div className="space-y-2 text-[13px]">
        <div className="h-3 w-32 rounded bg-white/5" />
        <div className="h-3 w-3/4 rounded bg-white/5" />
        <div className="h-3 w-2/3 rounded bg-white/5" />
      </div>
    );
  }

  if (!data || (!data.preliminary && !data.final)) {
    return (
      <p className="text-[13px]" style={{ color: "var(--leadac-text-3)" }}>
        {copy.empty}
      </p>
    );
  }

  const active = data.final ?? data.preliminary!;
  const isPreliminary = !data.final && data.preliminary != null;
  const versionLabel = isPreliminary
    ? `${copy.preliminary} · v${active.version}`
    : `${copy.final} · v${active.version}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Badge
          variant="outline"
          className={
            isPreliminary
              ? "border-(--leadac-border) text-(--leadac-text-3)"
              : "border-(--leadac-500) text-(--leadac-500)"
          }
        >
          <Sparkles className="mr-1 h-3 w-3" />
          {versionLabel}
        </Badge>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[11px] underline"
          style={{ color: "var(--leadac-text-3)" }}
          aria-label={copy.openFullGraph}
          onClick={() => {
            // Phase 7 will navigate to the dedicated reasoning route.
          }}
        >
          {copy.openFullGraph}
          <ExternalLink className="h-3 w-3" aria-hidden />
        </button>
      </div>

      <NbaContent data={data} hideReasoningTrace autoExpandTraceOnFinal={false} />

      <div className="flex flex-wrap gap-1.5 pt-1">
        {tel ? (
          <ActionChip href={tel} icon={<Phone className="h-3 w-3" />} label={copy.dial} />
        ) : (
          <ActionChip disabled icon={<Phone className="h-3 w-3" />} label={copy.dial} />
        )}
        {mail ? (
          <ActionChip href={mail} icon={<Mail className="h-3 w-3" />} label={copy.email} />
        ) : (
          <ActionChip disabled icon={<Mail className="h-3 w-3" />} label={copy.email} />
        )}
        {wa ? (
          <ActionChip
            href={wa}
            external
            icon={<MessageCircle className="h-3 w-3" />}
            label={copy.whatsapp}
          />
        ) : (
          <ActionChip
            disabled
            icon={<MessageCircle className="h-3 w-3" />}
            label={copy.whatsapp}
          />
        )}
        <ActionChip
          disabled
          icon={<Calendar className="h-3 w-3" />}
          label={copy.schedule}
        />
        <ActionChip
          disabled
          icon={<ZapOff className="h-3 w-3" />}
          label={copy.snooze}
        />
      </div>
    </div>
  );
}

interface ActionChipProps {
  icon: ReactNode;
  label: string;
  href?: string;
  disabled?: boolean;
  external?: boolean;
}

function ActionChip({ icon, label, href, disabled, external }: ActionChipProps) {
  const className =
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--leadac-500)/55";
  const style = {
    borderColor: disabled
      ? "color-mix(in srgb, var(--leadac-text-3) 25%, transparent)"
      : "color-mix(in srgb, var(--leadac-500) 45%, transparent)",
    color: disabled ? "var(--leadac-text-3)" : "var(--leadac-text-1)",
    background: disabled
      ? "transparent"
      : "color-mix(in srgb, var(--leadac-500) 8%, transparent)",
    opacity: disabled ? 0.6 : 1,
  };

  if (disabled || !href) {
    return (
      <button type="button" className={className} style={style} disabled>
        {icon}
        <span>{label}</span>
      </button>
    );
  }

  return (
    <a
      href={href}
      className={className}
      style={style}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
    >
      {icon}
      <span>{label}</span>
    </a>
  );
}
