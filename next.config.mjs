/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  typescript: { ignoreBuildErrors: true },
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY,
  },
};

export default nextConfig;
