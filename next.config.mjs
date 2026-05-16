/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build safety: typecheck errors fail the build. Do not flip this to true
  // to unblock unrelated deploys - fix the type error. See SECURITY.md and
  // .github/workflows/ci.yml. Next 16 removed the `eslint` config key; lint
  // is now enforced in CI via the separate `eslint .` step, not at build.
  typescript: { ignoreBuildErrors: false },

  // Keep the Prisma engine + pg driver out of the webpack bundle so the
  // native binary resolves correctly at runtime.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],

  // Intentionally no top-level `env` block. Anything declared there is
  // inlined into the CLIENT bundle at build time. Server secrets must be
  // read via process.env inside server code only. See SECURITY.md.

  // /app/watchlist and /app/pipeline collapsed into /app/deals (kanban).
  // Permanent redirects preserve bookmarks, command-palette deep links, and
  // any email body URLs pointing at the old routes.
  // Proxy PostHog through /ingest to bypass ad blockers. The client-side
  // SDK uses NEXT_PUBLIC_POSTHOG_HOST=/ingest as its api_host.
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },

  async redirects() {
    return [
      {
        source: "/app/watchlist",
        destination: "/app/deals",
        permanent: true,
      },
      {
        source: "/app/pipeline",
        destination: "/app/deals",
        permanent: true,
      },
      // Marketing rebuild (May 2026): the per-vertical landings collapsed
      // into one F&B-first vertical + a sharper homepage. We send 308
      // permanents so any inbound link earned by the old slugs survives.
      {
        source: "/for/agencies",
        destination: "/for/restaurant-agencies",
        permanent: true,
      },
      {
        source: "/for/smma",
        destination: "/",
        permanent: true,
      },
      {
        source: "/for/specialists",
        destination: "/",
        permanent: true,
      },
      {
        source: "/for/walk-in-web-agencies",
        destination: "/",
        permanent: true,
      },
      // Pricing is gated during pre-launch — plans are being shaped with
      // the first cohort of agencies. Inbound links to /pricing land on
      // the homepage waitlist anchor instead. 308 preserves SEO equity
      // and bookmarks; flipping this back to a real page is a one-line
      // edit when production opens.
      {
        source: "/pricing",
        destination: "/#waitlist",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
