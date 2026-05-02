import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/marketing/auth-form";
import { getOptionalUser } from "@/lib/auth";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  path: "/signup",
  title: "Sign up — Leadac AI",
  description:
    "Start free. 50 fresh Google Maps leads, a 20-signal audit on every site, and 3 per-lead website plans. No credit card.",
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
    <Suspense fallback={<AuthSkeleton />}>
      <AuthForm mode="signup" />
    </Suspense>
  );
}

function AuthSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-white/8 bg-card-dark p-8">
        <div className="h-7 w-1/2 mx-auto rounded bg-white/5 animate-pulse" />
        <div className="h-4 w-3/4 mx-auto rounded bg-white/5 animate-pulse" />
        <div className="space-y-3 pt-2">
          <div className="h-10 rounded bg-white/5 animate-pulse" />
          <div className="h-10 rounded bg-white/5 animate-pulse" />
        </div>
        <div className="h-10 rounded bg-white/10 animate-pulse" />
      </div>
    </div>
  );
}
