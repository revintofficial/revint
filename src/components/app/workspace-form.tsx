"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function WorkspaceForm({
  initial,
  role,
}: {
  initial: { id: string; name: string; slug: string; plan: string };
  role: "OWNER" | "ADMIN" | "MEMBER";
}) {
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [busy, setBusy] = useState(false);
  const canEdit = role === "OWNER" || role === "ADMIN";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/workspace", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to update");
      return;
    }
    toast.success("Workspace updated");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace</CardTitle>
        <CardDescription>How your workspace appears in the app.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-4 max-w-md">
          <div>
            <label className="block text-[11.5px] text-white/55 mb-1">Workspace name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <label className="block text-[11.5px] text-white/55 mb-1">Slug</label>
            <Input
              value={slug}
              onChange={(e) =>
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
              }
              disabled={!canEdit}
            />
          </div>
          <div>
            <p className="block text-[11.5px] text-white/55 mb-1">Current plan</p>
            <p className="text-[14px] font-medium">{initial.plan}</p>
          </div>
          {canEdit && (
            <Button type="submit" disabled={busy}>
              {busy ? (<><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</>) : "Save changes"}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
