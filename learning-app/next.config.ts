import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Isolate local migration rehearsals from the normal .next/dev workspace.
  distDir: process.env.GROWVELT_DOMAIN_TEST_MODE === "legacy" ? ".next-domain-legacy"
    : process.env.GROWVELT_DOMAIN_TEST_MODE === "future" ? ".next-domain-future"
    : process.env.GROWVELT_DOMAIN_TEST_MODE === "bridge" ? ".next-domain-bridge" : ".next",
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      // Authentication and payment URLs can contain one-time codes or references.
      // Keep them out of referrers even when the next page is on this origin.
      ...["/auth/:path*", "/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/check-email", "/payments/:path*", "/api/payments/:path*", "/api/learning/email/unsubscribe"].map((source) => ({
        source,
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      })),
    ];
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
