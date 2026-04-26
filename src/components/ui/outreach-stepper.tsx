"use client";

import { Check, X } from "lucide-react";
import { OUTREACH_LABELS } from "@/lib/labels";

const STEPS = ["NEW", "CONTACTED", "INTERESTED", "MEETING", "WON"] as const;

interface OutreachStepperProps {
  currentStatus: string;
  onStatusChange: (status: string) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function OutreachStepper({
  currentStatus,
  onStatusChange,
  disabled = false,
  compact = false,
}: OutreachStepperProps) {
  const currentIndex = STEPS.indexOf(currentStatus as (typeof STEPS)[number]);
  const isLost = currentStatus === "LOST";

  return (
    <div className="space-y-3">
      <div className={`flex items-center ${compact ? "gap-1" : "gap-1.5"}`}>
        {STEPS.map((step, i) => {
          const isCompleted = !isLost && currentIndex > i;
          const isCurrent = !isLost && currentIndex === i;
          const isNext = !isLost && currentIndex === i - 1;
          const canClick = isNext && !disabled;

          return (
            <div key={step} className="flex items-center flex-1 last:flex-initial">
              <button
                onClick={() => canClick && onStatusChange(step)}
                disabled={!canClick}
                className={`flex items-center gap-1.5 rounded-full transition-all ${
                  compact ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs"
                } font-medium ${
                  isCompleted
                    ? "bg-[hsl(152_48%_50%/0.14)] text-[hsl(152_28%_70%)]"
                    : isCurrent
                      ? "bg-(--leadac-500)/15 text-(--leadac-300) ring-2 ring-(--leadac-500)/25"
                      : isNext
                        ? "bg-white/10 text-white/70 hover:bg-(--leadac-500)/10 hover:text-(--leadac-300) cursor-pointer"
                        : "bg-white/5 text-white/30"
                } ${isLost ? "bg-white/5 text-white/30" : ""}`}
                title={canClick ? `Advance to ${OUTREACH_LABELS[step]}` : OUTREACH_LABELS[step]}
              >
                {isCompleted ? (
                  <Check className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />
                ) : (
                  <span className={`${compact ? "w-3 h-3" : "w-3.5 h-3.5"} rounded-full border-2 inline-block ${
                    isCurrent ? "border-(--leadac-400) bg-(--leadac-400)" : "border-current"
                  }`} />
                )}
                <span className={compact ? "hidden sm:inline" : ""}>{OUTREACH_LABELS[step]}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 mx-1 rounded-full transition-all ${
                  isCompleted ? "bg-[hsl(152_48%_50%/0.3)]" : "bg-white/15"
                }`} />
              )}
            </div>
          );
        })}
      </div>

      {!isLost && currentStatus !== "WON" && (
        <button
          onClick={() => !disabled && onStatusChange("LOST")}
          disabled={disabled}
          className="flex items-center gap-1 text-xs text-white/30 hover:text-[hsl(4_42%_72%)] transition-colors disabled:opacity-50"
        >
          <X className="w-3 h-3" />
          Mark as Lost
        </button>
      )}

      {isLost && (
        <div className="flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1.5 w-fit"
          style={{
            color: "hsl(4 42% 72%)",
            backgroundColor: "hsl(4 62% 54% / 0.14)",
          }}
        >
          <X className="w-3.5 h-3.5" />
          Lost
        </div>
      )}
    </div>
  );
}
