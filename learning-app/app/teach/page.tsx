import type { Metadata } from "next";
import { PublicTeach } from "@/app/components/public/public-teach";

export const metadata: Metadata = {
  title: "Teach on Growvelt",
  description: "Teach on Growvelt by sharing practical, career-relevant expertise through structured online courses and a guided instructor application process.",
  alternates: { canonical: "/teach" },
  openGraph: {
    url: "/teach",
    title: "Teach on Growvelt | Share practical expertise",
    description: "Share your experience, create practical courses, and help learners build skills through Growvelt Learning.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Teach on Growvelt | Share practical expertise",
    description: "Share your experience, create practical courses, and help learners build skills through Growvelt Learning.",
  },
};

export default function TeachPage() { return <PublicTeach />; }
