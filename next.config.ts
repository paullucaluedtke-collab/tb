import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Native modules (better-sqlite3) must NOT be bundled by Next.js — they have
  // a compiled .node binary that must be required from node_modules at runtime.
  serverExternalPackages: ['better-sqlite3'],
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  // @ts-ignore
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
