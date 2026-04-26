/**
 * P0.7 - Voice notes light UI.
 *
 * "30-second voice note" button on the lead detail page. Field rep opens their
 * tablet after a visit, records something like "Calvin Klein cleaners, owner
 * didn't say no, thought price was high, follow up in 2 months" → recording →
 * auto-transcribed → note attached to the lead.
 *
 * Browser MediaRecorder API + WebM/MP4 → POST /api/leads/[id]/voice-notes →
 * Gemini transcription → write to VoiceNote table + append to
 * WatchlistItem.pipelineNotes.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, Square, Loader2, Trash2 } from "lucide-react";

interface VoiceNote {
  id: string;
  durationSec: number;
  transcript: string | null;
  language: string | null;
  createdAt: string;
}

const MAX_RECORD_SEC = 90;

export function VoiceNotesPanel({ leadId }: { leadId: string }) {
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [supportsRecording, setSupportsRecording] = useState(true);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<NodeJS.Timeout | null>(null);
  const stopTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setSupportsRecording(false);
    }
  }, []);

  const fetchNotes = async () => {
    try {
      const res = await fetch(`/api/leads/${leadId}/voice-notes`);
      if (!res.ok) return;
      const data = await res.json();
      setNotes(data.notes || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickSupportedMime();
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      startedAtRef.current = Date.now();

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime || "audio/webm" });
        const durationSec = Math.round((Date.now() - startedAtRef.current) / 1000);
        await upload(blob, durationSec);
      };

      recorder.start();
      setRecording(true);
      setElapsed(0);

      tickRef.current = setInterval(() => {
        const sec = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setElapsed(sec);
      }, 250);

      stopTimerRef.current = setTimeout(() => {
        stop();
      }, MAX_RECORD_SEC * 1000);
    } catch (err) {
      console.error("Mic permission error:", err);
      toast.error("Microphone access denied.");
    }
  };

  const stop = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    if (tickRef.current) clearInterval(tickRef.current);
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    tickRef.current = null;
    stopTimerRef.current = null;
    setRecording(false);
  };

  const upload = async (blob: Blob, durationSec: number) => {
    setUploading(true);
    try {
      const fd = new FormData();
      const ext =
        blob.type.includes("ogg") ? "ogg" :
        blob.type.includes("mp4") ? "m4a" :
        "webm";
      fd.append("audio", blob, `voice-note.${ext}`);
      fd.append("durationSec", String(durationSec));
      fd.append("language", navigator.language?.split("-")[0] || "en");

      const res = await fetch(`/api/leads/${leadId}/voice-notes`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 402) {
          toast.error(err.message || "AI quota reached.");
        } else {
          toast.error(err.error || "Couldn't save voice note.");
        }
        return;
      }
      toast.success("Voice note transcribed and added to the lead.");
      await fetchNotes();
    } catch (err) {
      console.error("Upload failed:", err);
      toast.error("Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  if (!supportsRecording) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-(--leadac-300)" />
            Voice notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-white/50">
            This browser doesn't support audio recording. Try mobile Safari or Chrome.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-(--leadac-300)" />
            Voice notes
          </CardTitle>
          <p className="text-xs text-white/30 mt-1">
            Talk for 30 seconds after a field visit — the transcript is auto-attached to the lead's notes.
          </p>
        </div>
        {!recording ? (
          <Button size="sm" onClick={start} disabled={uploading}>
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" /> Start recording
              </>
            )}
          </Button>
        ) : (
          <Button size="sm" variant="destructive" onClick={stop}>
            <Square className="w-4 h-4" /> Stop ({elapsed}s)
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {recording && (
          <div className="rounded-xl bg-[hsl(4_62%_54%)]/10 border border-[hsl(4_62%_54%)]/30 p-3 mb-3 flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-[hsl(4_62%_54%)] animate-pulse" />
            <span className="text-sm text-[hsl(4_62%_54%)] font-medium">
              Recording: {elapsed}s / {MAX_RECORD_SEC}s
            </span>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-white/40">Loading...</p>
        ) : notes.length === 0 ? (
          <p className="text-sm text-white/40">No voice notes yet.</p>
        ) : (
          <div className="space-y-2">
            {notes.map((n) => (
              <div
                key={n.id}
                className="rounded-xl bg-white/5 border border-white/10 p-3"
              >
                <div className="flex items-center justify-between text-xs text-white/40 mb-1.5">
                  <span>
                    {new Date(n.createdAt).toLocaleString()} · {n.durationSec}s
                    {n.language && ` · ${n.language}`}
                  </span>
                  <button
                    type="button"
                    aria-label="Delete"
                    className="opacity-50 hover:opacity-100 hover:text-[hsl(4_62%_54%)]"
                    onClick={async () => {
                      if (!confirm("Delete this voice note?")) return;
                      const res = await fetch(`/api/voice-notes/${n.id}`, {
                        method: "DELETE",
                      });
                      if (res.ok) {
                        setNotes((ns) => ns.filter((x) => x.id !== n.id));
                      } else {
                        toast.error("Couldn't delete.");
                      }
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                  {n.transcript || "[empty transcript]"}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function pickSupportedMime(): string | null {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(c)) {
      return c;
    }
  }
  return null;
}
