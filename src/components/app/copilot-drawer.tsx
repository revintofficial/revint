/**
 * P1.2 - AI sales co-pilot chat drawer.
 * Floating button in bottom-right that opens a chat panel. Linear/Notion AI style.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Bot, Send, X, Loader2 } from "lucide-react";

interface Message {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: string;
}

export function CopilotDrawer() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/copilot")
      .then((r) => r.json())
      .then((data) => setMessages(data.messages || []))
      .finally(() => setLoading(false));
  }, [open]);

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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-40 w-11 h-11 sm:w-12 sm:h-12 rounded-full text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105"
        style={{
          background: "linear-gradient(135deg, #5E6AD2, #3730A3)",
          boxShadow: "0 12px 32px rgba(49,46,129,0.5)",
          marginBottom: "env(safe-area-inset-bottom)",
        }}
        aria-label="Open AI co-pilot"
      >
        <Bot className="w-5 h-5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center sm:justify-end"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-[#0E0E10] border border-white/10 w-full sm:w-[420px] sm:h-[640px] rounded-t-2xl sm:rounded-2xl sm:mr-5 flex flex-col shadow-2xl safe-pb"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: "92dvh" }}
          >
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-[#A5B4FC]" />
                <h3 className="text-sm font-semibold">Sales co-pilot</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-white/40 hover:text-white p-1"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div ref={scrollerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading ? (
                <p className="text-sm text-white/40">Loading...</p>
              ) : messages.length === 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-white/55 leading-relaxed">
                    I know your full lead list. Try asking things like:
                  </p>
                  <ul className="text-xs text-white/45 space-y-1.5 list-disc list-inside">
                    <li>&quot;Which 5 leads have the highest lead score?&quot;</li>
                    <li>&quot;Which business in Camden has the worst reputation?&quot;</li>
                    <li>&quot;Write a 30-second walk-in pitch for lead 12&quot;</li>
                    <li>&quot;Which 3 leads converted the most mockups?&quot;</li>
                  </ul>
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.role === "USER" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                        m.role === "USER"
                          ? "bg-[#5E6AD2]/30 border border-[#5E6AD2]/40 text-white"
                          : "bg-white/5 border border-white/10 text-white/85 whitespace-pre-wrap"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))
              )}
              {sending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl px-3 py-2 bg-white/5 border border-white/10 text-white/40 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                    Thinking...
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={send} className="p-3 border-t border-white/10 flex gap-2">
              <textarea
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
                className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#5E6AD2]/50 resize-none"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="rounded-xl px-3 text-white disabled:opacity-40"
                style={{
                  background: "linear-gradient(180deg, #4F5BD6, #3730A3)",
                }}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
