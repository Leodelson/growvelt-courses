import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Isolate local migration rehearsals from the normal .next/dev workspace.
  distDir: process.env.GROWVELT_DOMAIN_TEST_MODE === "legacy" ? ".next-domain-legacy"
    : process.env.GROWVELT_DOMAIN_TEST_MODE === "future" ? ".next-domain-future"
    : process.env.GROWVELT_DOMAIN_TEST_MODE === "bridge" ? ".next-domain-bridge" : ".next",
  reactStrictMode: true,
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
