/**
 * P1.1 + P1.4 - Email accounts settings panel.
 * Connect Gmail/Outlook, view daily send count, toggle reply attribution.
 */

"use client";

import { toast } from "sonner";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Trash2, RefreshCw } from "lucide-react";

interface Account {
  id: string;
  provider: "GMAIL" | "OUTLOOK";
  email: string;
  dailyLimit: number;
  sentToday: number;
  replyAttributionEnabled: boolean;
  lastInboxSyncAt: string | null;
  createdAt: string;
}

export function EmailAccountsPanel({ accounts: initial }: { accounts: Account[] }) {
  const [accounts, setAccounts] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  const connect = (provider: "gmail" | "outlook") => {
    window.location.href = `/api/oauth/start/${provider}`;
  };

  const disconnect = async (id: string) => {
    if (!confirm("Remove this account?")) return;
    setBusy(id);
    const res = await fetch(`/api/email-accounts/${id}`, { method: "DELETE" });
    setBusy(null);
    if (res.ok) {
      setAccounts((a) => a.filter((x) => x.id !== id));
      toast.success("Account removed");
    } else {
      toast.error("Couldn't remove account");
    }
  };

  const toggleReplyAttr = async (id: string, enabled: boolean) => {
    setBusy(id);
    const res = await fetch(`/api/email-accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ replyAttributionEnabled: enabled }),
    });
    setBusy(null);
    if (res.ok) {
      setAccounts((a) =>
        a.map((x) => (x.id === id ? { ...x, replyAttributionEnabled: enabled } : x)),
      );
      toast.success(enabled ? "Reply attribution enabled" : "Reply attribution disabled");
    } else {
      toast.error("Update failed");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-(--leadac-300)" /> Email accounts
          </CardTitle>
          <CardDescription>
            Send openers directly from Leadac AI. CSV export for Smartlead/Instantly
            stays available; this is an extra channel. Daily limit is 500 for Gmail, 30 for Outlook.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => connect("gmail")} variant="outline">
              + Connect Gmail
            </Button>
            <Button onClick={() => connect("outlook")} variant="outline">
              + Connect Outlook
            </Button>
          </div>

          {accounts.length === 0 ? (
            <p className="text-sm text-white/40">No accounts connected yet.</p>
          ) : (
            <div className="space-y-2">
              {accounts.map((a) => (
                <div
                  key={a.id}
                  className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-wrap items-center gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">
                      {a.provider === "GMAIL" ? "Gmail" : "Outlook"} · {a.email}
                    </p>
                    <p className="text-xs text-white/40 mt-0.5">
                      Sent today: {a.sentToday} / {a.dailyLimit}
                      {a.lastInboxSyncAt && ` · Last sync: ${new Date(a.lastInboxSyncAt).toLocaleString()}`}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-white/60">
                    <input
                      type="checkbox"
                      checked={a.replyAttributionEnabled}
                      onChange={(e) => toggleReplyAttr(a.id, e.target.checked)}
                      disabled={busy === a.id}
                      className="rounded"
                    />
                    Reply attribution
                  </label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fetch(`/api/email-accounts/${a.id}/sync`, { method: "POST" })}
                    disabled={busy === a.id || !a.replyAttributionEnabled}
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Sync
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => disconnect(a.id)}
                    disabled={busy === a.id}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-[hsl(4_62%_54%)]" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
