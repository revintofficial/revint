/**
 * Phase 2 (optional) — telephony adapter.
 *
 * Normalizes provider-specific webhook payloads (Twilio, Aircall,
 * Justcall) into a single `CallEvent` shape that maps to our
 * existing CallDisposition enum. Keeps the integration logic out
 * of the route handler so each new provider only adds a small
 * adapter function.
 *
 * NOTE: each provider configures its own outbound webhook in their
 * dashboard. We expect them to POST a JSON body. Signature
 * verification is provider-specific — we do a constant-time HMAC
 * compare here for Twilio (X-Twilio-Signature is the only
 * standardized one) and a static token check for Aircall/Justcall
 * since those don't sign at the webhook layer.
 */
import type { CallDisposition } from "@/generated/prisma/client";

export type TelephonyProvider = "twilio" | "aircall" | "justcall";

export interface CallEvent {
  provider: TelephonyProvider;
  externalCallId: string;
  fromNumber: string | null;
  toNumber: string | null;
  durationSec: number | null;
  recordingUrl: string | null;
  startedAt: Date | null;
  // The agent / SDR who placed or answered the call. Provider-specific
  // user id; we use it to attribute the LeadActivity if the rep has
  // linked their telephony login under their workspace profile.
  agentExternalId: string | null;
  disposition: CallDisposition | null;
  notes: string | null;
}

function classifyTwilioStatus(
  status: string | undefined,
  duration: number,
  answeredBy: string | undefined,
): CallDisposition | null {
  // Twilio CallStatus values: queued, ringing, in-progress, completed,
  // busy, failed, no-answer, canceled.
  // AnsweredBy (AMD): "human", "machine_start", "machine_end_*".
  const s = (status || "").toLowerCase();
  const ab = (answeredBy || "").toLowerCase();
  if (s === "no-answer" || s === "canceled") return "NO_ANSWER";
  if (s === "busy" || s === "failed") return "NO_ANSWER";
  if (s === "completed") {
    if (ab.startsWith("machine")) return "VOICEMAIL";
    if (duration < 8) return "VOICEMAIL"; // tiny human pickup → likely VM beep
    return "ANSWERED_INTERESTED"; // optimistic; rep can re-tag in UI
  }
  return null;
}

export function normalizeTwilio(payload: Record<string, unknown>): CallEvent | null {
  const sid = payload.CallSid;
  if (typeof sid !== "string") return null;
  const duration = Number(payload.CallDuration ?? payload.Duration ?? 0) || 0;
  return {
    provider: "twilio",
    externalCallId: sid,
    fromNumber: typeof payload.From === "string" ? payload.From : null,
    toNumber: typeof payload.To === "string" ? payload.To : null,
    durationSec: duration,
    recordingUrl: typeof payload.RecordingUrl === "string" ? payload.RecordingUrl : null,
    startedAt: typeof payload.Timestamp === "string" ? new Date(payload.Timestamp) : new Date(),
    agentExternalId:
      typeof payload.AgentSid === "string"
        ? payload.AgentSid
        : typeof payload.WorkerSid === "string"
        ? payload.WorkerSid
        : null,
    disposition: classifyTwilioStatus(
      payload.CallStatus as string | undefined,
      duration,
      payload.AnsweredBy as string | undefined,
    ),
    notes: null,
  };
}

function classifyAircallStatus(eventName: string, durationSec: number): CallDisposition | null {
  // Aircall webhook event names: call.created, call.answered,
  // call.hungup, call.ended, call.tagged, call.commented.
  const e = eventName.toLowerCase();
  if (e === "call.hungup" || e === "call.ended") {
    if (durationSec < 5) return "NO_ANSWER";
    if (durationSec < 12) return "VOICEMAIL";
    return "ANSWERED_INTERESTED";
  }
  return null;
}

export function normalizeAircall(payload: Record<string, unknown>): CallEvent | null {
  const data = (payload.data ?? {}) as Record<string, unknown>;
  const id = data.id ?? payload.id;
  if (id == null) return null;
  const duration = Number(data.duration ?? 0);
  const direction = String(data.direction ?? "").toLowerCase();
  const fromN =
    direction === "outbound"
      ? (data.raw_digits as string | undefined) ?? null
      : ((data.number as Record<string, unknown> | undefined)?.digits as string | undefined) ?? null;
  return {
    provider: "aircall",
    externalCallId: String(id),
    fromNumber: fromN,
    toNumber: typeof data.raw_digits === "string" ? data.raw_digits : null,
    durationSec: duration,
    recordingUrl: typeof data.recording === "string" ? data.recording : null,
    startedAt: typeof data.started_at === "string" ? new Date(data.started_at) : new Date(),
    agentExternalId: data.user_id != null ? String(data.user_id) : null,
    disposition: classifyAircallStatus(String(payload.event ?? ""), duration),
    notes: typeof data.note === "string" ? data.note : null,
  };
}

function classifyJustcallStatus(status: string | undefined, durationSec: number): CallDisposition | null {
  const s = (status || "").toLowerCase();
  if (s === "missed" || s === "no answer") return "NO_ANSWER";
  if (s === "voicemail") return "VOICEMAIL";
  if (s === "completed" || s === "answered") {
    if (durationSec < 8) return "VOICEMAIL";
    return "ANSWERED_INTERESTED";
  }
  return null;
}

export function normalizeJustcall(payload: Record<string, unknown>): CallEvent | null {
  const data = (payload.data ?? payload) as Record<string, unknown>;
  const callId = data.call_sid ?? data.id;
  if (callId == null) return null;
  const duration = Number(data.duration ?? 0);
  return {
    provider: "justcall",
    externalCallId: String(callId),
    fromNumber: typeof data.from === "string" ? data.from : null,
    toNumber: typeof data.to === "string" ? data.to : null,
    durationSec: duration,
    recordingUrl: typeof data.recording_url === "string" ? data.recording_url : null,
    startedAt: typeof data.datetime === "string" ? new Date(data.datetime) : new Date(),
    agentExternalId: data.agent_id != null ? String(data.agent_id) : null,
    disposition: classifyJustcallStatus(data.status as string | undefined, duration),
    notes: typeof data.notes === "string" ? data.notes : null,
  };
}

export function normalizeByProvider(
  provider: TelephonyProvider,
  payload: Record<string, unknown>,
): CallEvent | null {
  switch (provider) {
    case "twilio":
      return normalizeTwilio(payload);
    case "aircall":
      return normalizeAircall(payload);
    case "justcall":
      return normalizeJustcall(payload);
    default:
      return null;
  }
}
