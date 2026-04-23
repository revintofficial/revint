import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/marketing/auth-form";
import { getOptionalUser } from "@/lib/auth";
import { buildMetadata } from "@/lib/seo/metadata";

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
    const next = typeof sp.next === "string" ? sp.next : "/app/dashboard";
    redirect(next);
  }
  return (
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  );
}
