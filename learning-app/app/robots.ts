import type { MetadataRoute } from "next";
import { absoluteLearningUrl } from "@/app/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard/",
        "/admin/",
        "/instructor/",
        "/settings",
        "/sign-in",
        "/sign-up",
        "/forgot-password",
        "/reset-password",
        "/check-email",
        "/auth/",
        "/verify-certificate/",
      ],
    },
    sitemap: absoluteLearningUrl("/sitemap.xml"),
    host: absoluteLearningUrl(),
  };
}
