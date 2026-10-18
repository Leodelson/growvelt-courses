"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { learningPath } from "@/app/lib/site-urls.mjs";

export default function LearningLink({ href, ...props }: ComponentProps<typeof Link>) {
  const destination = typeof href === "string" ? learningPath(href)
    : href.host || href.protocol ? href : { ...href, pathname: typeof href.pathname === "string" ? learningPath(href.pathname) : href.pathname };
  return <Link {...props} href={destination} />;
}
