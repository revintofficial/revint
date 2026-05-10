"use client";

/**
 * VoiceNoteFAB — Phase 2 anchor. PLAN §4 line 188 says the
 * DISCOVERY block exposes a voice-note FAB anchor; the actual
 * recorder modal lift-and-split (RETHINK §6 catalog row
 * `VoiceNoteRecorder`) is deferred to Phase 5.
 *
 * Today this component renders a stub button. Clicking it scrolls
 * the legacy `<VoiceNotesPanel>` recorder mount into view if it is
 * already on the page; otherwise it surfaces a copy hint. The button
 * is the testable anchor for "global FAB" rewiring in Phase 5.
 */

import type { ReactNode } from "react";
import { Mic } from "lucide-react";

export interface VoiceNoteFABCopy {
  recordLabel: string;
  notWiredHint: string;
}

export interface VoiceNoteFABProps {
  copy: VoiceNoteFABCopy;
}

export function VoiceNoteFAB({ copy }: VoiceNoteFABProps): ReactNode {
  return (
    <button
      type="button"
      data-testid="voice-note-fab"
      onClick={() => {
        if (typeof document === "undefined") return;
        const target = document.getElementById("voice-notes-legacy-mount");
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }}
      title={copy.notWiredHint}
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--leadac-500)/55"
      style={{
        borderColor: "var(--leadac-border)",
        background: "var(--leadac-card)",
        color: "var(--leadac-text-1)",
      }}
      aria-label={copy.recordLabel}
    >
      <Mic className="h-3.5 w-3.5" aria-hidden />
      <span>{copy.recordLabel}</span>
    </button>
  );
}
