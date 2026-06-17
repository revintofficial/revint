/**
 * AI sales co-pilot — surface available from anywhere in the app.
 *
 * Modality differs by viewport (Apple HIG §"Modality"):
 *   • Phone:   full-screen modal (drawer-on-phone is awkward, eats too much
 *              of the chat surface, and gets clipped by the bottom tab bar).
 *   • Tablet+: right-side drawer (400px), keeps the rest of the workspace
 *              visible while the rep iterates on a pitch.
 *
 * The FAB is positioned above the bottom tab bar on phone so it never sits
 * on top of primary navigation. It tracks the current path so it can hide
 * itself on lead-detail pages where the sticky action bar already owns the
 * bottom of the screen.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { Bot, Send, X, Loader2 } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";

interface Message {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: string;
}

const SUGGESTIONS = [
  "Which 5 leads have the highest lead score?",
  "Which business in Camden has the worst reputation?",
  "Write a 30-second walk-in pitch for lead 12",
  "Which 3 leads converted the most mockups?",
];

export function CopilotDrawer() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pathname = usePathname();

  // Hide the FAB on lead-detail screens — they own the bottom of the
  // viewport via the sticky action bar, and a second floating button on top
  // of it would compete for attention and clip the safe-area.
  const isLeadDetail = /^\/app\/leads\/[^/]+$/.test(pathname);

  useEffect(() => {
    if (!open) return;
    // M19 fix - cancel-on-unmount/close. The previous version
    // called setMessages / setLoading unconditionally inside the
    // .then chain, so closing the drawer or unmounting before
    // /api/copilot resolved fired a "setState on unmounted
    // component" warning AND left the request hanging. We now
    // abort on cleanup and short-circuit the setState calls.
    const ctrl = new AbortController();
    let cancelled = false;
    fetch("/api/copilot", { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setMessages(data.messages || []);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Surface load failures softly; the drawer keeps the empty
        // state instead of throwing.
        console.error("copilot.load_failed", err);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [open]);

  // Lock body scroll while the full-screen modal is up on phone — without
  // this the page underneath can rubber-band on iOS and the chat scroll
  // surface fights the page scroll for input.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Auto-scroll the message stream to the bottom whenever it grows. We
  // intentionally don't smooth-scroll here — the modal opens at the bottom
  // already, and a smooth animation on every message would feel laggy.
  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    setSending(true);
    triggerHaptic("light");
    const provisional: Message = {
      id: `tmp-${Date.now()}`,
      role: "USER",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, provisional]);
    setInput("");

    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 402) {
          toast.error(err.message || "Co-pilot quota reached.");
        } else {
          toast.error(err.error || "Co-pilot couldn't respond.");
        }
        setMessages((m) => m.filter((x) => x.id !== provisional.id));
        return;
      }
      const data = await res.json();
      triggerHaptic("success");
      setMessages((m) => [
        ...m,
        {
          id: `as-${Date.now()}`,
          role: "ASSISTANT",
          content: data.reply,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleSuggestion = (text: string) => {
    setInput(text);
    inputRef.current?.focus();
  };

  return (
    <>
      {/* FAB — positioned above the bottom tab bar on phone (safe-area aware)
           and at the bottom-right corner on tablet+. Hidden on lead-detail. */}
      {!isLeadDetail && (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            triggerHaptic("light");
          }}
          aria-label="Open AI co-pilot"
          aria-haspopup="dialog"
          aria-expanded={open}
          // `fab-above-tabbar` (in globals.css) moves the button above the
          // phone tab bar, then drops it to a 1.25rem corner on tablet+.
          className="fab-above-tabbar fixed right-4 sm:right-5 z-40 rounded-full text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-(--revint-500) focus-visible:outline-offset-2"
          style={{
            width: "var(--fab-size)",
            height: "var(--fab-size)",
            background:
              "linear-gradient(135deg, var(--revint-500), var(--revint-700))",
            boxShadow:
              "0 12px 32px hsl(var(--revint-h) var(--revint-s) 34% / 0.5)",
          }}
        >
          <Bot className="w-5 h-5" strokeWidth={2.25} />
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 sm:bg-black/40 flex items-stretch sm:items-center sm:justify-end animate-fade-in"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="AI sales co-pilot"
        >
          <div
            className="bg-(--revint-surface) flex flex-col shadow-2xl w-full
                       sm:w-[400px] sm:h-[640px] sm:rounded-2xl sm:mr-5 sm:border sm:border-white/10
                       sm:max-h-[calc(100vh-2.5rem)]"
            onClick={(e) => e.stopPropagation()}
            style={{
              borderTop: "0.5px solid hsl(0 0% 100% / 0.1)",
            }}
          >
            {/* Header — safe-area aware on phone (env() resolves to 0 on
                tablet/desktop, so the same `safe-pt` class is harmless there) */}
            <div
              className="flex items-center justify-between px-4 py-3 safe-pt"
              style={{ borderBottom: "0.5px solid hsl(0 0% 100% / 0.08)" }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--revint-500), var(--revint-700))",
                  }}
                >
                  <Bot className="w-4 h-4 text-white" strokeWidth={2.25} />
                </div>
                <div>
                  <h3
                    className="font-semibold tracking-tight"
                    style={{
                      fontSize: "var(--text-callout)",
                      color: "var(--revint-text-1)",
                    }}
                  >
                    Sales co-pilot
                  </h3>
                  <p
                    style={{
                      fontSize: "var(--text-caption)",
                      color: "var(--revint-text-3)",
                    }}
                  >
                    Asks your full lead list anything
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close co-pilot"
                className="touch-target rounded-lg hover:bg-white/5 active:bg-white/10 focus-visible:outline-2 focus-visible:outline-(--revint-500) -mr-1"
                style={{ color: "var(--revint-text-2)" }}
              >
                <X className="w-5 h-5" strokeWidth={2.25} />
              </button>
            </div>

            {/* Message stream — iOS-style bubbles with shoulder spacing */}
            <div
              ref={scrollerRef}
              className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-3"
              style={{ scrollPaddingBlock: "var(--space-4)" }}
            >
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2
                    className="w-5 h-5 animate-spin"
                    style={{ color: "var(--revint-text-3)" }}
                  />
                </div>
              ) : messages.length === 0 ? (
                <div className="space-y-4 py-4">
                  <div
                    className="rounded-2xl px-4 py-3 max-w-[88%]"
                    style={{
                      background: "hsl(0 0% 100% / 0.05)",
                      border: "0.5px solid hsl(0 0% 100% / 0.08)",
                    }}
                  >
                    <p
                      style={{
                        fontSize: "var(--text-subhead)",
                        color: "var(--revint-text-2)",
                        lineHeight: 1.5,
                      }}
                    >
                      I know your full lead list. Tap a suggestion below or
                      type your own question.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleSuggestion(s)}
                        className="text-left rounded-xl px-3 py-2.5 hover:bg-white/5 active:bg-white/10 transition-colors focus-visible:outline-2 focus-visible:outline-(--revint-500)"
                        style={{
                          background: "hsl(0 0% 100% / 0.03)",
                          border: "0.5px solid hsl(0 0% 100% / 0.06)",
                          color: "var(--revint-text-2)",
                          fontSize: "var(--text-subhead)",
                          minHeight: "var(--touch-target-min)",
                        }}
                      >
                        “{s}”
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${
                      m.role === "USER" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className="rounded-2xl px-3.5 py-2.5 leading-relaxed whitespace-pre-wrap"
                      style={{
                        maxWidth: "85%",
                        fontSize: "var(--text-subhead)",
                        background:
                          m.role === "USER"
                            ? "var(--revint-500)"
                            : "hsl(0 0% 100% / 0.06)",
                        color:
                          m.role === "USER"
                            ? "white"
                            : "var(--revint-text-1)",
                        border:
                          m.role === "USER"
                            ? "none"
                            : "0.5px solid hsl(0 0% 100% / 0.08)",
                        borderBottomLeftRadius:
                          m.role === "USER" ? undefined : "6px",
                        borderBottomRightRadius:
                          m.role === "USER" ? "6px" : undefined,
                      }}
                    >
                      {m.content}
                    </div>
                  </div>
                ))
              )}
              {sending && (
                <div className="flex justify-start">
                  <div
                    className="rounded-2xl px-3.5 py-2.5 inline-flex items-center gap-2"
                    style={{
                      background: "hsl(0 0% 100% / 0.06)",
                      border: "0.5px solid hsl(0 0% 100% / 0.08)",
                      borderBottomLeftRadius: "6px",
                      color: "var(--revint-text-3)",
                      fontSize: "var(--text-subhead)",
                    }}
                  >
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Thinking...
                  </div>
                </div>
              )}
            </div>

            {/* Composer — sticky to bottom, safe-area aware on phone. The
                textarea is 16px+ to block iOS auto-zoom on focus (already
                enforced globally for inputs <640px in globals.css). */}
            <form
              onSubmit={send}
              className="px-3 pt-2 pb-3 sm:pb-3 flex items-end gap-2"
              style={{
                borderTop: "0.5px solid hsl(0 0% 100% / 0.08)",
                paddingBottom:
                  "calc(env(safe-area-inset-bottom) + 12px)",
              }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(e as unknown as React.FormEvent);
                  }
                }}
                placeholder="Ask something about your leads..."
                rows={1}
                aria-label="Message co-pilot"
                enterKeyHint="send"
                className="flex-1 rounded-2xl px-3.5 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus-visible:outline-2 focus-visible:outline-(--revint-500) resize-none"
                style={{
                  background: "hsl(0 0% 100% / 0.05)",
                  border: "0.5px solid hsl(0 0% 100% / 0.08)",
                  fontSize: "16px", // explicit 16px to be extra safe on iOS
                  minHeight: "var(--touch-target-min)",
                  maxHeight: "120px",
                }}
                disabled={sending}
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                aria-label="Send message"
                className="touch-target rounded-full text-white disabled:opacity-30 transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-(--revint-500) focus-visible:outline-offset-2"
                style={{
                  width: "var(--touch-target-min)",
                  height: "var(--touch-target-min)",
                  background:
                    "linear-gradient(135deg, var(--revint-500), var(--revint-700))",
                }}
              >
                <Send className="w-4 h-4 mx-auto" strokeWidth={2.25} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
