export const metadata = { title: "Privacy — Leadac AI" };

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

        <h2 className="text-[18px] font-semibold text-white mt-6">Your rights</h2>
        <p>
          Email{" "}
          <a href="mailto:hello@leadac.ai" className="text-[#A5B4FC] hover:underline">
            hello@leadac.ai
          </a>{" "}
          to request a full export or deletion of your account and data.
        </p>
      </div>
    </article>
  );
}
