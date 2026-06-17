"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Check, Loader2, Mail } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase/browser";
import { safeNextPath } from "@/lib/safe-redirect";
import { cn } from "@/lib/utils";

/**
 * AuthForm — site-themed Supabase auth surface.
 *
 * Used by /login and /signup inside the (site)/ route group. Reads against
 * the new --ink-* / --paper-* / --signal palette instead of the legacy
 * --revint-* product palette so it matches the rest of the marketing site.
 *
 * Behaviour mirrors the legacy AuthForm in src/components/marketing/, with
 * password + magic-link tabs and Google OAuth. The legacy version stays
 * mounted under /app/* until Wave 4 deletes the (marketing)/ surface.
 */

type AuthFormProps = {
  mode: "login" | "signup";
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"), "/app/dashboard");
  const supabase = createSupabaseBrowser();

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

  const altLink = mode === "signup" ? "/login" : "/signup";
  const altLinkText =
    mode === "signup" ? "Already have an account?" : "New to Revint?";
  const altLinkCta = mode === "signup" ? "Sign in" : "Create workspace";

  return (
    <div className="rounded-2xl border border-ink-3 bg-ink-1 p-6 md:p-7">
      {magicSent ? (
        <div className="py-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-signal/40 bg-[hsl(218_50%_16%_/_0.4)]">
            <Mail className="h-5 w-5 text-signal" />
          </div>
          <h2 className="mt-4 text-[18px] font-medium text-paper-0">
            Check your email
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-paper-2">
            We sent a {mode === "signup" ? "confirmation" : "magic"} link to
            <br />
            <span className="font-medium text-paper-0">{email}</span>
          </p>
          <button
            type="button"
            onClick={() => {
              setMagicSent(false);
              setError(null);
            }}
            className="site-source mt-5"
          >
            Use a different email
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-paper-0 px-4 py-2.5 text-[13px] font-medium text-ink-0 transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
              <path
                fill="#FFC107"
                d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
              />
              <path
                fill="#FF3D00"
                d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"
              />
              <path
                fill="#4CAF50"
                d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5c-2 1.4-4.5 2.2-7.2 2.2-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
              />
              <path
                fill="#1976D2"
                d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.7l6.2 5c-.4.4 6.6-4.8 6.6-14.7 0-1.3-.1-2.4-.4-3.5z"
              />
            </svg>
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-ink-3" />
            <span className="site-eyebrow">or</span>
            <div className="h-px flex-1 bg-ink-3" />
          </div>

          <div
            className="mb-4 flex rounded-lg bg-ink-0 p-0.5"
            role="tablist"
          >
            <button
              type="button"
              onClick={() => setTab("password")}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
                tab === "password"
                  ? "bg-ink-2 text-paper-0"
                  : "text-paper-2 hover:text-paper-1",
              )}
              role="tab"
              aria-selected={tab === "password"}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => setTab("magic")}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
                tab === "magic"
                  ? "bg-ink-2 text-paper-0"
                  : "text-paper-2 hover:text-paper-1",
              )}
              role="tab"
              aria-selected={tab === "magic"}
            >
              Magic link
            </button>
          </div>

          <form
            onSubmit={tab === "password" ? handlePassword : handleMagicLink}
            className="space-y-3"
          >
            {mode === "signup" ? (
              <Field
                id="name"
                label="Name"
                hint="optional"
                type="text"
                value={name}
                onChange={(v) => setName(v)}
                placeholder="Alex Morgan"
                autoComplete="name"
              />
            ) : null}
            <Field
              id="email"
              label="Email"
              type="email"
              value={email}
              onChange={(v) => setEmail(v)}
              placeholder="you@company.com"
              autoComplete="email"
              required
            />
            {tab === "password" ? (
              <Field
                id="password"
                label="Password"
                type="password"
                value={password}
                onChange={(v) => setPassword(v)}
                placeholder={
                  mode === "signup"
                    ? "At least 8 characters"
                    : "Your password"
                }
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                minLength={8}
                required
              />
            ) : null}

            {error ? (
              <div
                className="flex items-start gap-2 rounded-lg border border-[hsl(0_60%_50%_/_0.3)] bg-[hsl(0_60%_15%_/_0.3)] px-3 py-2 text-[12px] text-[hsl(0_60%_70%)]"
                role="alert"
              >
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="site-btn-primary mt-2 w-full justify-center disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {mode === "signup" ? "Creating workspace…" : "Signing in…"}
                </>
              ) : tab === "magic" ? (
                <>
                  <Mail className="h-3.5 w-3.5" />
                  Email me a link
                </>
              ) : mode === "signup" ? (
                <>
                  Create workspace
                  <Check className="h-3.5 w-3.5" />
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>
        </>
      )}

      <p className="mt-6 text-center text-[13px] text-paper-2">
        {altLinkText}{" "}
        <Link
          href={altLink}
          className="text-paper-0 underline decoration-ink-3 underline-offset-4 hover:decoration-signal"
        >
          {altLinkCta}
        </Link>
      </p>
    </div>
  );
}

type FieldProps = {
  id: string;
  label: string;
  hint?: string;
  type: "text" | "email" | "password";
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
};

function Field({
  id,
  label,
  hint,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  minLength,
  required,
}: FieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-paper-3"
      >
        {label}
        {hint ? (
          <span className="ml-1.5 normal-case tracking-normal text-paper-3/60">
            ({hint})
          </span>
        ) : null}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        minLength={minLength}
        required={required}
        className="flex h-10 w-full rounded-xl border border-ink-3 bg-ink-0 px-3 py-2 text-[14px] text-paper-0 placeholder:text-paper-3 transition-colors focus:border-signal focus:shadow-[0_0_0_3px_hsl(var(--signal-glow))] focus:outline-none disabled:opacity-50"
      />
    </div>
  );
}
