import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  path: "/legal/privacy",
  title: "Privacy Policy — Leadac AI",
  description:
    "Privacy policy for Leadac AI — what we store, how we handle public business data from Google Maps, and how workspaces keep their pipeline private.",
});

export default function PrivacyPage() {
  return (
    <article className="max-w-2xl mx-auto px-5 sm:px-6 pt-32 pb-24 prose prose-invert">
      <h1 className="text-[34px] font-semibold tracking-tight mb-2">Privacy Policy</h1>
      <p className="text-[12.5px] text-white/45 mb-8">Last updated: April 2026</p>

      <div className="space-y-6 text-[14px] text-white/70 leading-relaxed">
        <p>
          Your data stays yours. Here&apos;s exactly what we store and why.
        </p>
        <h2 className="text-[18px] font-semibold text-white mt-6">What we collect</h2>
        <ul className="list-disc list-inside space-y-1.5">
          <li>Your email and (optionally) name and avatar</li>
          <li>The leads you discover, your pipeline notes, your shortlist, and your todos</li>
          <li>Usage counters (so we can enforce plan limits) and basic auth events</li>
        </ul>

        <h2 className="text-[18px] font-semibold text-white mt-6">What we don&apos;t do</h2>
        <ul className="list-disc list-inside space-y-1.5">
          <li>We don&apos;t sell or share your data with third parties</li>
          <li>We don&apos;t train AI models on your workspace data</li>
          <li>We don&apos;t use your data to enrich anyone else&apos;s account</li>
        </ul>

        <h2 className="text-[18px] font-semibold text-white mt-6">Where data lives</h2>
        <p>
          Postgres on Supabase (EU region), Redis for the job queue, Stripe for billing,
          and Google Places + Gemini for the lead-discovery and analysis APIs. Your raw
          workspace data never leaves Supabase.
        </p>

        <h2 className="text-[18px] font-semibold text-white mt-6">
          Marketing-site analytics
        </h2>
        <p>
          When you browse the public Leadac marketing pages we collect a
          first-party stream of pageviews, scroll depth, clicks on buttons and
          links, and timing for any forms you focus. We store these in our own
          Postgres database under a random visitor id (kept in your browser&apos;s
          localStorage). Your IP address is hashed before storage; we never
          retain the raw IP. Form values, email addresses and other inputs are
          never captured.
        </p>
        <p>
          We additionally use{" "}
          <a
            href="https://posthog.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-(--leadac-300) hover:underline"
          >
            PostHog
          </a>{" "}
          for session replay, configured to mask all text and form inputs by
          default so the founder team only sees layout, clicks and scroll —
          not the words you typed.
        </p>
        <p>
          Both layers honor the browser&apos;s Do Not Track and Global Privacy
          Control signals. Setting either one disables marketing analytics
          and replay for your visit.
        </p>

        <h2 className="text-[18px] font-semibold text-white mt-6">Your rights</h2>
        <p>
          Email{" "}
          <a href="mailto:hello@leadacai.com" className="text-(--leadac-300) hover:underline">
            hello@leadacai.com
          </a>{" "}
          to request a full export or deletion of your account and data.
        </p>
      </div>
    </article>
  );
}
