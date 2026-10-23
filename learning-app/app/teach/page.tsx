import type { Metadata } from "next";
import { PublicTeach } from "@/app/components/public/public-teach";

export const metadata: Metadata = {
  title: "Become Instructor",
  description: "Become an instructor on Growvelt. Share practical, career-relevant expertise through structured online courses and a guided application process.",
  alternates: { canonical: "/teach" },
  openGraph: {
    url: "/teach",
    title: "Become Instructor | Share practical expertise",
    description: "Share your experience, create practical courses, and help learners build skills through Growvelt.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Become Instructor | Share practical expertise",
    description: "Share your experience, create practical courses, and help learners build skills through Growvelt.",
  },
};

export default function TeachPage() { return <PublicTeach />; }
