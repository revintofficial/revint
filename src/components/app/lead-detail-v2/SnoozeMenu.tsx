"use client";

/**
 * SnoozeMenu — Phase 3 dropdown rendered inside `NextGestureBlock`.
 *
 * 5 actionable options + a Cancel item:
 *   - 1 day / 3 days / 1 week — duration snooze
 *   - Custom date              — opens a Dialog with a native
 *     <input type="date"> capped to today + 90 days
 *   - Until trigger            — opens a Dialog listing the
 *     `LeadTriggerType` enum values (the novel option)
 *   - Cancel                   — closes without action
 *
 * Posts to `/api/leads/[id]/snooze`. On success fires PostHog
 * `lead_detail.snooze` and calls `onSnoozed` so the parent can
 * invalidate the queue strip.
 *
 * Phase 5: phone viewport renders the option list inside the global
 * `<BottomSheet>` primitive instead of the desktop dropdown so the
 * thumb can reach every chip without contorting. The option set,
 * trigger callback, and telemetry are identical between surfaces.
 */

import { useCallback, useMemo, useState } from "react";
import posthog from "posthog-js";
import { ChevronRight, ZapOff } from "lucide-react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsPhone } from "@/lib/use-viewport";

const TRIGGER_TYPES = [
  "NEW_LOCATION_OPENING",
  "CHAIN_EXPANSION",
  "HIRING_MARKETING",
  "HIRING_OPS",
  "HIRING_TECH",
  "BAD_SERVICE_REVIEWS",
  "RATING_DROP",
  "MENU_REDESIGN_SIGNAL",
  "BOOKING_PROVIDER_CHANGE",
  "DELIVERY_EXPANSION",
  "INTERNATIONAL_AUDIENCE_GROWTH",
  "SEASONAL_TOURISM",
  "COMPETITOR_PRESSURE",
  "REBRANDING",
  "FUNDING_RAISED",
  "EXEC_CHANGE",
] as const;

export type LeadTriggerType = (typeof TRIGGER_TYPES)[number];

export interface SnoozeMenuCopy {
  trigger: string;
  heading: string;
  oneDay: string;
  threeDays: string;
  oneWeek: string;
  custom: string;
  customDialogTitle: string;
  customDialogDescription: string;
  customPickerLabel: string;
  customSubmit: string;
  customCancel: string;
  untilTrigger: string;
  untilTriggerDialogTitle: string;
  untilTriggerDialogDescription: string;
  cancel: string;
  triggerLabels: Record<LeadTriggerType, string>;
}

export interface SnoozeMenuProps {
  leadId: string;
  copy: SnoozeMenuCopy;
  /**
   * Fires after the API call completes successfully so the parent
   * surface can invalidate the queue strip and signal auto-advance.
   */
  onSnoozed?: (info: {
    kind: "duration" | "custom" | "until_trigger";
    snoozeUntil: string;
    snoozeUntilTriggerType: LeadTriggerType | null;
  }) => void;
}

type SnoozeBody =
  | { kind: "duration"; days: 1 | 3 | 7 }
  | { kind: "custom"; until: string }
  | { kind: "until_trigger"; triggerType: LeadTriggerType };

interface SnoozeApiResponse {
  snoozeUntil: string;
  snoozeUntilTriggerType: LeadTriggerType | null;
  kind: "duration" | "custom" | "until_trigger";
  unchanged?: boolean;
}

function safeCapture(event: string, props: Record<string, unknown>): void {
  try {
    if (typeof window === "undefined") return;
    const ph = posthog as unknown as {
      __loaded?: boolean;
      capture?: (e: string, p: Record<string, unknown>) => void;
    };
    if (!ph.__loaded || typeof ph.capture !== "function") return;
    ph.capture(event, props);
  } catch {
    // Telemetry must never break the page.
  }
}

function todayPlusDays(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function SnoozeMenu({ leadId, copy, onSnoozed }: SnoozeMenuProps) {
  const isPhone = useIsPhone();
  const [menuOpen, setMenuOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [triggerOpen, setTriggerOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [customDate, setCustomDate] = useState<string>(() => todayPlusDays(7));

  const minDate = useMemo(() => todayPlusDays(1), []);
  const maxDate = useMemo(() => todayPlusDays(90), []);

  const submit = useCallback(
    async (body: SnoozeBody) => {
      if (pending) return;
      setPending(true);
      try {
        const res = await fetch(`/api/leads/${leadId}/snooze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) return;
        const json = (await res.json()) as SnoozeApiResponse;
        const phPayload: Record<string, unknown> = {
          leadId,
          kind:
            body.kind === "duration"
              ? body.days === 1
                ? "1d"
                : body.days === 3
                  ? "3d"
                  : "1w"
              : body.kind === "custom"
                ? "custom"
                : "trigger",
        };
        if (body.kind === "until_trigger") {
          phPayload.triggerType = body.triggerType;
        }
        safeCapture("lead_detail.snooze", phPayload);
        onSnoozed?.({
          kind: json.kind,
          snoozeUntil: json.snoozeUntil,
          snoozeUntilTriggerType: json.snoozeUntilTriggerType,
        });
      } catch {
        // Surface failures via toast in a future iteration.
      } finally {
        setPending(false);
        setMenuOpen(false);
        setCustomOpen(false);
        setTriggerOpen(false);
      }
    },
    [leadId, onSnoozed, pending],
  );

  const triggerButton = (
    <button
      type="button"
      data-testid="snooze-menu-trigger"
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--leadac-500)/55"
      style={{
        borderColor: "color-mix(in srgb, var(--leadac-500) 45%, transparent)",
        color: "var(--leadac-text-1)",
        background: "color-mix(in srgb, var(--leadac-500) 8%, transparent)",
      }}
      onClick={isPhone ? () => setMenuOpen(true) : undefined}
    >
      <ZapOff className="h-3 w-3" aria-hidden />
      <span>{copy.trigger}</span>
    </button>
  );

  return (
    <>
      {isPhone ? (
        <>
          {triggerButton}
          <BottomSheet
            open={menuOpen}
            onOpenChange={setMenuOpen}
            title={copy.heading}
            snap="auto"
          >
            <ul
              className="flex flex-col gap-0.5"
              role="menu"
              aria-label={copy.heading}
            >
              <SheetItem
                testid="snooze-1d"
                label={copy.oneDay}
                onSelect={() => void submit({ kind: "duration", days: 1 })}
              />
              <SheetItem
                testid="snooze-3d"
                label={copy.threeDays}
                onSelect={() => void submit({ kind: "duration", days: 3 })}
              />
              <SheetItem
                testid="snooze-1w"
                label={copy.oneWeek}
                onSelect={() => void submit({ kind: "duration", days: 7 })}
              />
              <SheetSeparator />
              <SheetItem
                testid="snooze-custom"
                label={copy.custom}
                trailing={<ChevronRight className="h-3 w-3" aria-hidden />}
                onSelect={() => {
                  setMenuOpen(false);
                  setCustomOpen(true);
                }}
              />
              <SheetItem
                testid="snooze-until-trigger"
                label={copy.untilTrigger}
                trailing={<ChevronRight className="h-3 w-3" aria-hidden />}
                onSelect={() => {
                  setMenuOpen(false);
                  setTriggerOpen(true);
                }}
              />
              <SheetSeparator />
              <SheetItem
                testid="snooze-cancel"
                label={copy.cancel}
                muted
                onSelect={() => setMenuOpen(false)}
              />
            </ul>
          </BottomSheet>
        </>
      ) : (
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>{triggerButton}</DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-56">
            <DropdownMenuLabel>{copy.heading}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              data-testid="snooze-1d"
              onSelect={(e) => {
                e.preventDefault();
                void submit({ kind: "duration", days: 1 });
              }}
            >
              {copy.oneDay}
            </DropdownMenuItem>
            <DropdownMenuItem
              data-testid="snooze-3d"
              onSelect={(e) => {
                e.preventDefault();
                void submit({ kind: "duration", days: 3 });
              }}
            >
              {copy.threeDays}
            </DropdownMenuItem>
            <DropdownMenuItem
              data-testid="snooze-1w"
              onSelect={(e) => {
                e.preventDefault();
                void submit({ kind: "duration", days: 7 });
              }}
            >
              {copy.oneWeek}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              data-testid="snooze-custom"
              onSelect={(e) => {
                e.preventDefault();
                setMenuOpen(false);
                setCustomOpen(true);
              }}
            >
              <span className="flex w-full items-center justify-between">
                <span>{copy.custom}</span>
                <ChevronRight className="h-3 w-3" aria-hidden />
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem
              data-testid="snooze-until-trigger"
              onSelect={(e) => {
                e.preventDefault();
                setMenuOpen(false);
                setTriggerOpen(true);
              }}
            >
              <span className="flex w-full items-center justify-between">
                <span>{copy.untilTrigger}</span>
                <ChevronRight className="h-3 w-3" aria-hidden />
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              data-testid="snooze-cancel"
              onSelect={() => setMenuOpen(false)}
            >
              {copy.cancel}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{copy.customDialogTitle}</DialogTitle>
            <DialogDescription>
              {copy.customDialogDescription}
            </DialogDescription>
          </DialogHeader>
          <label className="flex flex-col gap-1 text-[12px]">
            <span style={{ color: "var(--leadac-text-2)" }}>
              {copy.customPickerLabel}
            </span>
            <input
              type="date"
              value={customDate}
              min={minDate}
              max={maxDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="rounded-md border px-2 py-1.5 text-[13px]"
              style={{
                background: "var(--leadac-card)",
                borderColor: "var(--leadac-border)",
                color: "var(--leadac-text-1)",
              }}
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-[12px]"
              style={{ color: "var(--leadac-text-2)" }}
              onClick={() => setCustomOpen(false)}
            >
              {copy.customCancel}
            </button>
            <button
              type="button"
              data-testid="snooze-custom-submit"
              className="rounded-md px-3 py-1.5 text-[12px] font-medium"
              style={{
                background: "var(--leadac-500)",
                color: "var(--leadac-bg)",
              }}
              onClick={() => {
                const iso = new Date(`${customDate}T12:00:00Z`).toISOString();
                void submit({ kind: "custom", until: iso });
              }}
            >
              {copy.customSubmit}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={triggerOpen} onOpenChange={setTriggerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{copy.untilTriggerDialogTitle}</DialogTitle>
            <DialogDescription>
              {copy.untilTriggerDialogDescription}
            </DialogDescription>
          </DialogHeader>
          <ul
            role="listbox"
            aria-label={copy.untilTriggerDialogTitle}
            className="max-h-72 space-y-0.5 overflow-y-auto"
          >
            {TRIGGER_TYPES.map((t) => (
              <li key={t}>
                <button
                  type="button"
                  data-testid={`snooze-trigger-${t}`}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[12px] transition-colors hover:bg-white/5"
                  style={{ color: "var(--leadac-text-1)" }}
                  onClick={() => {
                    void submit({ kind: "until_trigger", triggerType: t });
                  }}
                >
                  <span>{copy.triggerLabels[t]}</span>
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface SheetItemProps {
  testid: string;
  label: string;
  trailing?: React.ReactNode;
  muted?: boolean;
  onSelect: () => void;
}

function SheetItem({ testid, label, trailing, muted, onSelect }: SheetItemProps) {
  return (
    <li>
      <button
        type="button"
        role="menuitem"
        data-testid={testid}
        onClick={onSelect}
        className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-[14px] transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--leadac-500)/55"
        style={{ color: muted ? "var(--leadac-text-2)" : "var(--leadac-text-1)" }}
      >
        <span>{label}</span>
        {trailing ?? null}
      </button>
    </li>
  );
}

function SheetSeparator() {
  return (
    <li
      aria-hidden
      className="my-1 h-px"
      style={{ background: "hsl(0 0% 100% / 0.06)" }}
    />
  );
}
