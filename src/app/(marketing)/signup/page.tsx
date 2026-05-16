import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/marketing/auth-form";
import { getOptionalUser } from "@/lib/auth";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  path: "/signup",
  title: "Sign up — Leadac AI",
  description:
    "Start your 14-day trial. 50 fresh leads from our local-business index, a 20-signal audit on every site, and pipeline-ready dossiers for outbound agencies.",
  index: false,
  follow: true,
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SignupPage({ searchParams }: { searchParams: SearchParams }) {
  // Mirror LoginPage: an already-authenticated visitor arriving at /signup
  // (usually because they clicked a pricing CTA while logged in) should not
  // see the form. Short-circuit into checkout when an intent is present,
  // otherwise send them to their dashboard.
  const session = await getOptionalUser();
  const sp = await searchParams;
  if (session) {
    const plan = typeof sp.plan === "string" ? sp.plan : undefined;
    if (plan === "PRO" || plan === "PRO_TEAM" || plan === "AGENCY") {
      const params = new URLSearchParams({ plan, autocheckout: "1" });
      const currency = typeof sp.currency === "string" ? sp.currency : undefined;
      if (currency === "USD" || currency === "GBP") params.set("currency", currency);
      const cycle = typeof sp.cycle === "string" ? sp.cycle : undefined;
      if (cycle === "monthly" || cycle === "annual") params.set("cycle", cycle);
      redirect(`/app/settings/billing?${params.toString()}`);
    }
    redirect("/app/dashboard");
  }
  return (
    // M20 - Suspense boundary with a real skeleton fallback so the
    // initial paint shows a card-shaped placeholder instead of an
    // empty viewport while AuthForm hydrates. Same shape as
    // /login for visual continuity if the user toggles between
    // them.
    <div className="pt-32 md:pt-40 pb-24 md:pb-32">
      <div className="max-w-md mx-auto px-5 sm:px-6">
        <Suspense fallback={<AuthSkeleton />}>
          <AuthForm mode="signup" />
        </Suspense>
      </div>
    </div>
  );
}

function AuthSkeleton() {
  return (
    <div
      className="w-full space-y-6 rounded-2xl p-8"
      style={{
        background: "hsl(var(--leadac-h) var(--leadac-ns) 11% / 0.5)",
        border: "0.5px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="h-7 w-1/2 mx-auto rounded bg-white/5 animate-pulse" />
      <div className="h-4 w-3/4 mx-auto rounded bg-white/5 animate-pulse" />
      <div className="space-y-3 pt-2">
        <div className="h-10 rounded bg-white/5 animate-pulse" />
        <div className="h-10 rounded bg-white/5 animate-pulse" />
      </div>
      <div className="h-10 rounded bg-white/10 animate-pulse" />
    </div>
  );
}
