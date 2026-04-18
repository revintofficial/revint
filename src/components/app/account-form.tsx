"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowser } from "@/lib/supabase/browser";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function AccountForm({
  initial,
}: {
  initial: { email: string; fullName: string | null; avatarUrl: string | null };
}) {
  const supabase = createSupabaseBrowser();
  const [name, setName] = useState(initial.fullName || "");
  const [busy, setBusy] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pw, setPw] = useState("");

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({
      data: { full_name: name },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Profile updated");
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setPwBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setPwBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Password updated");
      setPw("");
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your name and email.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-4 max-w-md">
            <div>
              <label htmlFor="email" className="block text-[11.5px] text-white/55 mb-1">Email</label>
              <Input id="email" type="email" value={initial.email} disabled className="opacity-60" />
              <p className="text-[11px] text-white/35 mt-1">
                Contact support to change your email address.
              </p>
            </div>
            <div>
              <label htmlFor="name" className="block text-[11.5px] text-white/55 mb-1">Full name</label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex" />
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? (<><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</>) : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Update your password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="space-y-4 max-w-md">
            <div>
              <label htmlFor="pw" className="block text-[11.5px] text-white/55 mb-1">New password</label>
              <Input
                id="pw"
                type="password"
                minLength={8}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <Button type="submit" disabled={pwBusy || pw.length < 8} variant="outline">
              {pwBusy ? (<><Loader2 className="w-3.5 h-3.5 animate-spin" />Updating…</>) : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
