/** @type {import('next').NextConfig} */
const nextConfig = {
  // AWS Amplify SSR compute expects the standalone output bundle.
  output: "standalone",

  // Amplify builds fail hard on any TS/ESLint warning in transitive deps
  // (e.g. generated prisma client, tiptap types). Keep the build unblocked;
  // CI (.github/workflows/ci.yml) still runs tsc --noEmit and eslint on PRs
  // so regressions don't slip in silently.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  // Keep the Prisma engine + pg driver out of the webpack bundle so the
  // native binary resolves correctly at runtime on Amplify.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],

  // Intentionally no top-level `env` block. Anything declared there is
  // inlined into the CLIENT bundle at build time. Server secrets must be
  // read via process.env inside server code only. See SECURITY.md.
};

export default nextConfig;
