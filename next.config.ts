import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  // The /api/seed function reads the gzipped Synthea bundle from seed/ and the
  // migration SQL from db/migrations/. Vercel's file tracer doesn't see these
  // through dynamic path.join() calls, so include them explicitly.
  outputFileTracingIncludes: {
    "/api/seed": ["./seed/**/*", "./db/migrations/**/*"],
    "/setup": ["./db/migrations/**/*"],
  },
};

export default nextConfig;
