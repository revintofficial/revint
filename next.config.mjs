/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build safety: typecheck and lint errors fail the build. If you need to
  // unblock an unrelated deploy, fix the lint/type error - do not flip these
  // flags. See SECURITY.md and CI workflow.
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },

  // Keep the Prisma engine + pg driver out of the webpack bundle so the
  // native binary resolves correctly at runtime.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],

  // Intentionally no top-level `env` block. Anything declared there is
  // inlined into the CLIENT bundle at build time. Server secrets must be
  // read via process.env inside server code only. See SECURITY.md.
};

export default nextConfig;
