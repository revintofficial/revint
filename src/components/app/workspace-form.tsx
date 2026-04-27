"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COUNTRIES } from "@/lib/countries";
import { getPlanLabel } from "@/lib/plans";
import { toast } from "sonner";
import { Loader2, Globe } from "lucide-react";

export function WorkspaceForm({
  initial,
  role,
}: {
  initial: { id: string; name: string; slug: string; plan: string; country?: string | null };
  role: "OWNER" | "ADMIN" | "MEMBER";
}) {
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [country, setCountry] = useState(initial.country ?? "");
  const [busy, setBusy] = useState(false);
  const canEdit = role === "OWNER" || role === "ADMIN";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/workspace", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug, country: country || null }),
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
            <label className="block text-[11.5px] text-white/55 mb-1">Country</label>
            <Select value={country} onValueChange={setCountry} disabled={!canEdit}>
              <SelectTrigger>
                <SelectValue placeholder="Select a country…">
                  {country ? (
                    <span className="flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-white/30" />
                      {COUNTRIES.find((c) => c.code === country)?.name ?? country}
                    </span>
                  ) : (
                    <span className="text-white/40">Select a country…</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    <div className="flex items-center gap-2">
                      <Globe className="w-3 h-3 text-white/30" />
                      {c.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-white/35 mt-1">
              Used to scope Discovery searches. Can be overridden per search.
            </p>
          </div>
          <div>
            <p className="block text-[11.5px] text-white/55 mb-1">Current plan</p>
            <p className="text-[14px] font-medium">{getPlanLabel(initial.plan)}</p>
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
