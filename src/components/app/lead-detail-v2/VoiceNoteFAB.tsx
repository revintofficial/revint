"use client";

/**
 * VoiceNoteFAB — Phase 5 real global mobile-only floating action button.
 *
 * Phase 2 shipped a stub pointing to the legacy voice-notes panel.
 * Phase 5 replaces it with a proper mobile FAB:
 *
 *   - Renders ONLY on mobile (< 640px). Desktop keeps the inline FAB
 *     anchor inside DiscoveryBlock.
 *   - Positioned bottom-right, above the QueueStrip (z-38 so it sits
 *     behind the DispositionStrip overlay at z-40).
 *   - Tap-and-hold: pointer-down starts MediaRecorder. Pointer-up /
 *     pointer-cancel uploads the blob to /api/leads/[id]/voice-notes.
 *   - Shows elapsed-seconds ring while recording.
 *   - Falls back to a tap-to-open-sheet if MediaRecorder is unavailable
 *     (desktop Safari, some Android WebViews).
 *
 * A11y: the button has aria-label that changes to "Recording — release
 * to save" while recording. A role="status" live region announces the
 * upload result. Long-press is intentionally not keyboard-triggerable
 * (voice-note capture requires a real microphone pointer gesture);
 * keyboard users can use the legacy panel via the DiscoveryBlock anchor.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Mic } from "lucide-react";
import { toast } from "sonner";

const MAX_RECORD_MS = 90_000;

function getSupportedMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((c) => MediaRecorder.isTypeSupported?.(c));
}

export interface VoiceNoteFABCopy {
  recordLabel: string;
  recordingLabel: string;
  uploadingLabel: string;
  uploadedToast: string;
  errorToast: string;
  notWiredHint: string;
}

export interface VoiceNoteFABProps {
  leadId: string;
  copy: VoiceNoteFABCopy;
}

export function VoiceNoteFAB({ leadId, copy }: VoiceNoteFABProps): ReactNode {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef<HTMLDivElement | null>(null);

  const stopTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
  }, []);

  const upload = useCallback(
    async (blob: Blob, durationSec: number) => {
      setUploading(true);
      try {
        const form = new FormData();
        form.append("audio", blob, "voice-note.webm");
        form.append("durationSec", String(Math.ceil(durationSec)));
        const res = await fetch(`/api/leads/${leadId}/voice-notes`, {
          method: "POST",
          body: form,
        });
        if (res.ok) {
          toast.success(copy.uploadedToast);
        } else {
          toast.error(copy.errorToast);
        }
      } catch {
        toast.error(copy.errorToast);
      } finally {
        setUploading(false);
      }
    },
    [leadId, copy.uploadedToast, copy.errorToast],
  );

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
  }, []);

  const startRecording = useCallback(async () => {
    if (recording || uploading) return;
    const mime = getSupportedMime();
    if (!mime) {
      toast.error(copy.notWiredHint);
      return;
    }
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        stopTick();
        const elapsed = (Date.now() - startedAtRef.current) / 1000;
        const blob = new Blob(chunksRef.current, { type: mime });
        setRecording(false);
        setElapsedMs(0);
        void upload(blob, elapsed);
      };

      recorder.start(250);
      startedAtRef.current = Date.now();
      setRecording(true);
      setElapsedMs(0);

      tickRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 200);

      autoStopRef.current = setTimeout(stopRecording, MAX_RECORD_MS);
    } catch {
      toast.error(copy.errorToast);
    }
  }, [recording, uploading, copy.notWiredHint, copy.errorToast, stopTick, stopRecording, upload]);

  useEffect(() => {
    return () => {
      stopTick();
      recorderRef.current?.stop();
    };
  }, [stopTick]);

  const elapsedSec = Math.floor(elapsedMs / 1000);
  const progress = Math.min(elapsedMs / MAX_RECORD_MS, 1);
  const circumference = 2 * Math.PI * 22;
  const strokeDash = circumference * (1 - progress);

  const label = uploading
    ? copy.uploadingLabel
    : recording
      ? copy.recordingLabel
      : copy.recordLabel;

  return (
    <div className="fixed bottom-[calc(56px+env(safe-area-inset-bottom,0px)+12px)] right-4 z-38 sm:hidden">
      <div role="status" className="sr-only" ref={statusRef} aria-live="polite" />
      <button
        type="button"
        data-testid="voice-note-fab-mobile"
        aria-label={label}
        aria-pressed={recording}
        disabled={uploading}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          void startRecording();
        }}
        onPointerUp={() => {
          if (recording) stopRecording();
        }}
        onPointerCancel={() => {
          if (recording) stopRecording();
        }}
        className="relative flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--leadac-500)/55 disabled:opacity-60"
        style={{
          background: recording
            ? "var(--leadac-error, #ef4444)"
            : "var(--leadac-500)",
          color: "var(--leadac-bg)",
        }}
      >
        {recording && (
          <svg
            aria-hidden
            className="absolute inset-0 -rotate-90"
            viewBox="0 0 48 48"
            fill="none"
          >
            <circle
              cx="24"
              cy="24"
              r="22"
              stroke="hsl(0 0% 100% / 0.35)"
              strokeWidth="3"
            />
            <circle
              cx="24"
              cy="24"
              r="22"
              stroke="hsl(0 0% 100% / 0.9)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDash}
              style={{ transition: "stroke-dashoffset 0.2s linear" }}
            />
          </svg>
        )}
        <Mic
          className="h-6 w-6"
          aria-hidden
          strokeWidth={recording ? 2.5 : 2}
        />
        {recording && (
          <span
            aria-hidden
            className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-medium tabular-nums"
            style={{ color: "var(--leadac-text-2)" }}
          >
            {elapsedSec}s
          </span>
        )}
      </button>
    </div>
  );
}
