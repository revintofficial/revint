"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowser } from "@/lib/supabase/browser";
import { safeNextPath } from "@/lib/safe-redirect";
import Image from "next/image";
import { Loader2, Mail, Check, AlertCircle } from "lucide-react";

/**
 * If the visitor arrived from the pricing page with `?plan=PRO_TEAM`
 * (and optional `currency` / `cycle`), build a post-auth URL that lands them
 * directly in checkout: `/app/settings/billing?plan=...&autocheckout=1`.
 * Falls back to the explicit `?next=` param, then to the dashboard. This is
 * the load-bearing piece that turns a 5-click "pricing -> signup -> dashboard
 * -> settings -> billing -> upgrade -> Stripe" funnel into "pricing -> signup
 * -> Stripe".
 */
function resolveNext(params: URLSearchParams): string {
  const plan = params.get("plan");
  if (plan === "PRO" || plan === "PRO_TEAM" || plan === "AGENCY") {
    const checkoutParams = new URLSearchParams({ plan, autocheckout: "1" });
    const currency = params.get("currency");
    if (currency === "USD" || currency === "GBP") checkoutParams.set("currency", currency);
    const cycle = params.get("cycle");
    if (cycle === "monthly" || cycle === "annual") checkoutParams.set("cycle", cycle);
    return `/app/settings/billing?${checkoutParams.toString()}`;
  }
  return safeNextPath(params.get("next"), "/app/dashboard");
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = resolveNext(new URLSearchParams(params.toString()));
  const supabase = createSupabaseBrowser();
  const intentPlan = params.get("plan");

  const [tab, setTab] = useState<"password" | "magic">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
            data: { full_name: name || undefined },
          },
        });
        if (error) throw error;
        setMagicSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push(next);
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: mode === "signup",
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          data: { full_name: name || undefined },
        },
      });
      if (error) throw error;
      setMagicSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (error) throw error;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center pt-20 pb-12 px-5">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[440px] rounded-full opacity-25 blur-3xl"
          style={{ background: "radial-gradient(closest-side, hsl(var(--revint-h) var(--revint-s) 60% / 0.55), transparent)" }}
        />
      </div>

      <div className="w-full max-w-[400px]">
        <div className="text-center mb-7">
          <Link href="/" className="inline-block mb-5" aria-label="Revint home">
            <Image
              src="/logo.png"
              alt="Revint"
              width={44}
              height={44}
              priority
              className="w-11 h-11 object-contain mx-auto"
            />
          </Link>
          <h1
            className="text-[26px] font-semibold tracking-tight mb-1"
            style={{ letterSpacing: "-0.02em" }}
          >
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="text-[13px] text-white/55">
            {mode === "signup"
              ? "Discover your first 50 leads — free."
              : "Sign in to your Revint workspace."}
          </p>
          {intentPlan && (intentPlan === "PRO" || intentPlan === "PRO_TEAM" || intentPlan === "AGENCY") && (
            <div
              className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11.5px]"
              style={{
                background: "hsl(var(--revint-h) var(--revint-s) 60% / 0.12)",
                border: "0.5px solid hsl(var(--revint-h) var(--revint-s) 60% / 0.32)",
                color: "var(--revint-300)",
              }}
            >
              <Check className="w-3 h-3" />
              We&apos;ll take you straight to checkout after signup.
            </div>
          )}
        </div>

        <div
          className="rounded-2xl p-6"
          style={{
            background: "hsl(var(--revint-h) var(--revint-ns) 8% / 0.85)",
            border: "0.5px solid rgba(255,255,255,0.08)",
            backdropFilter: "saturate(180%) blur(20px)",
          }}
        >
          {magicSent ? (
            <div className="text-center py-4">
              <div
                className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{
                  background: "hsl(152 48% 50% / 0.12)",
                  border: "0.5px solid hsl(152 48% 50% / 0.3)",
                }}
              >
                <Mail className="w-5 h-5 text-[hsl(152_48%_50%)]" />
              </div>
              <h2 className="text-[17px] font-semibold mb-1.5">Check your email</h2>
              <p className="text-[13px] text-white/55 leading-relaxed">
                We sent a {mode === "signup" ? "confirmation" : "magic"} link to
                <br />
                <span className="text-white font-medium">{email}</span>
              </p>
              <button
                onClick={() => {
                  setMagicSent(false);
                  setError(null);
                }}
                className="mt-5 text-[12px] text-(--revint-300) hover:underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={signInWithGoogle}
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-medium mb-4 transition-all disabled:opacity-50"
                style={{
                  background: "white",
                  color: "black",
                }}
              >
                <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
                  <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5c-2 1.4-4.5 2.2-7.2 2.2-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.7l6.2 5c-.4.4 6.6-4.8 6.6-14.7 0-1.3-.1-2.4-.4-3.5z"/>
                </svg>
                Continue with Google
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[10.5px] uppercase tracking-wider text-white/35">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <div
                className="flex p-0.5 rounded-lg mb-4"
                style={{ background: "rgba(255,255,255,0.04)" }}
                role="tablist"
              >
                <button
                  onClick={() => setTab("password")}
                  className="flex-1 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all"
                  style={{
                    background: tab === "password" ? "rgba(255,255,255,0.08)" : "transparent",
                    color: tab === "password" ? "white" : "hsl(var(--revint-h) var(--revint-nts) 92% / 0.5)",
                  }}
                  role="tab"
                  aria-selected={tab === "password"}
                >
                  Password
                </button>
                <button
                  onClick={() => setTab("magic")}
                  className="flex-1 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all"
                  style={{
                    background: tab === "magic" ? "rgba(255,255,255,0.08)" : "transparent",
                    color: tab === "magic" ? "white" : "hsl(var(--revint-h) var(--revint-nts) 92% / 0.5)",
                  }}
                  role="tab"
                  aria-selected={tab === "magic"}
                >
                  Magic link
                </button>
              </div>

              <form onSubmit={tab === "password" ? handlePassword : handleMagicLink} className="space-y-3">
                {mode === "signup" && (
                  <div>
                    <label htmlFor="name" className="block text-[11px] font-medium text-white/55 mb-1">
                      Name <span className="text-white/30">(optional)</span>
                    </label>
                    <Input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Alex"
                      autoComplete="name"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="block text-[11px] font-medium text-white/55 mb-1">
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    autoComplete="email"
                  />
                </div>

                {tab === "password" && (
                  <div>
                    <label htmlFor="password" className="block text-[11px] font-medium text-white/55 mb-1">
                      Password
                    </label>
                    <Input
                      id="password"
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    />
                  </div>
                )}

                {error && (
                  <div
                    className="flex items-start gap-2 px-3 py-2 rounded-lg text-[12px]"
                    style={{
                      background: "hsl(4 62% 54% / 0.08)",
                      border: "0.5px solid hsl(4 62% 54% / 0.25)",
                      color: "hsl(4 42% 72%)",
                    }}
                    role="alert"
                  >
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button type="submit" disabled={busy} className="w-full">
                  {busy ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      {mode === "signup" ? "Creating account…" : "Signing in…"}
                    </>
                  ) : tab === "magic" ? (
                    <>
                      <Mail className="w-3.5 h-3.5" />
                      Email me a link
                    </>
                  ) : mode === "signup" ? (
                    <>
                      Create account
                      <Check className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="text-[12.5px] text-white/55 text-center mt-5">
          {mode === "signup" ? (
            <>
              Already have an account?{" "}
              <Link
                href={`/login${params.toString() ? `?${params.toString()}` : ""}`}
                className="text-(--revint-300) hover:underline"
              >
                Log in
              </Link>
            </>
          ) : (
            <>
              New to Revint?{" "}
              <Link
                href={`/signup${params.toString() ? `?${params.toString()}` : ""}`}
                className="text-(--revint-300) hover:underline"
              >
                Create an account
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
