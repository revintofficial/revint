import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/marketing/auth-form";
import { getOptionalUser } from "@/lib/auth";
import { buildMetadata } from "@/lib/seo/metadata";
import { safeNextPath } from "@/lib/safe-redirect";

export const metadata = buildMetadata({
  path: "/login",
  title: "Log in — Leadac AI",
  description:
    "Log in to your Leadac AI workspace to run a new discovery, review leads, and ship audit-grounded outreach.",
  index: false,
  follow: true,
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  // If the visitor is already authenticated and arrived here with a purchase
  // intent (from the pricing page or a marketing CTA), skip the login form
  // entirely and drop them straight into checkout. This is what fixes the
  // "clicked 'Log in' from signup pill and landed on dashboard" bug - we
  // never render the form in the first place when their session is valid.
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
    const rawNext = typeof sp.next === "string" ? sp.next : undefined;
    redirect(safeNextPath(rawNext, "/app/dashboard"));
  }
  return (
    // M20 - Suspense boundary with a real skeleton fallback so the
    // initial paint shows a card-shaped placeholder instead of an
    // empty viewport while AuthForm hydrates and reads searchParams.
    // (AuthForm is a "use client" component that pulls
    // searchParams via useSearchParams; without a fallback the
    // first paint flickers from blank -> form on every nav.)
    <div className="pt-32 md:pt-40 pb-24 md:pb-32">
      <div className="max-w-md mx-auto px-5 sm:px-6">
        <Suspense fallback={<AuthSkeleton />}>
          <AuthForm mode="login" />
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
