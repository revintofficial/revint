"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Mail, UserMinus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Member {
  id: string;
  userId: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: "OWNER" | "ADMIN" | "MEMBER";
}

export function TeamPanel({
  role,
  currentUserId,
  members,
}: {
  role: "OWNER" | "ADMIN" | "MEMBER";
  currentUserId: string;
  members: Member[];
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const canManage = role === "OWNER" || role === "ADMIN";

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    const res = await fetch("/api/team/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Failed to invite");
      return;
    }
    toast.success(data.message || "Invitation sent");
    setEmail("");
  }

  return (
    <div className="space-y-5">
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Invite a teammate</CardTitle>
            <CardDescription>
              They&apos;ll get an email invitation to join this workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={invite} className="flex flex-col sm:flex-row gap-2 max-w-md">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@company.com"
                required
              />
              <Button type="submit" disabled={busy}>
                <Mail className="w-3.5 h-3.5" />
                {busy ? "Sending…" : "Send invite"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>People who can access this workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-white/5">
            {members.map((m) => {
              const isMe = m.userId === currentUserId;
              return (
                <div key={m.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0"
                    style={{ background: "linear-gradient(135deg, #0A84FF, #5E5CE6)" }}
                  >
                    {(m.fullName || m.email).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate">
                      {m.fullName || m.email} {isMe && <span className="text-white/40">(you)</span>}
                    </p>
                    <p className="text-[11.5px] text-white/45 truncate">{m.email}</p>
                  </div>
                  <Badge variant={m.role === "OWNER" ? "success" : "secondary"}>{m.role}</Badge>
                  {canManage && !isMe && m.role !== "OWNER" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (!confirm(`Remove ${m.email}?`)) return;
                        const res = await fetch(`/api/team/${m.id}`, { method: "DELETE" });
                        if (res.ok) {
                          toast.success("Removed");
                          window.location.reload();
                        } else {
                          toast.error("Failed to remove");
                        }
                      }}
                      aria-label={`Remove ${m.email}`}
                    >
                      <UserMinus className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
