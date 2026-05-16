import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  path: "/legal/terms",
  title: "Terms of Service — Leadac AI",
  description:
    "Terms of service for Leadac AI — acceptable use, subscription terms, data ownership, and how we handle the leads you pull through the platform.",
});

export default function TermsPage() {
  return (
    <article className="max-w-2xl mx-auto px-5 sm:px-6 pt-32 pb-24 prose prose-invert">
      <h1 className="text-[34px] font-semibold tracking-tight mb-2">Terms of Service</h1>
      <p className="text-[12.5px] text-white/45 mb-8">Last updated: April 2026</p>

      <div className="space-y-6 text-[14px] text-white/70 leading-relaxed">
        <p>
          By using Leadac AI you agree to these terms. They&apos;re intentionally short.
        </p>
        <h2 className="text-[18px] font-semibold text-white mt-6">Your account</h2>
        <p>
          You&apos;re responsible for what happens under your account. Don&apos;t share your
          password. If a teammate needs access, invite them from the Team page.
        </p>
        <h2 className="text-[18px] font-semibold text-white mt-6">Acceptable use</h2>
        <p>
          Don&apos;t use Leadac AI to spam, scrape data we don&apos;t expose, or do
          anything illegal. We will terminate accounts that abuse the service.
        </p>
        <h2 className="text-[18px] font-semibold text-white mt-6">Plans, limits, refunds</h2>
        <p>
          Lead and AI quotas reset every 30 days. You can upgrade, downgrade, or cancel
          at any time from Settings → Billing. We do not refund partial months, but you
          keep access until your current cycle ends.
        </p>
        <h2 className="text-[18px] font-semibold text-white mt-6">Liability</h2>
        <p>
          The service is provided &quot;as is&quot;. We&apos;re not liable for indirect or
          consequential damages from how you use the leads or pitches we generate.
        </p>
        <h2 className="text-[18px] font-semibold text-white mt-6">Contact</h2>
        <p>
          Questions? Reach us at{" "}
          <a href="mailto:hello@leadacai.com" className="text-(--leadac-300) hover:underline">
            hello@leadacai.com
          </a>
          .
        </p>
      </div>
    </article>
  );
}
