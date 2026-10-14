import type { Metadata } from "next";
import { PublicTeach } from "@/app/components/public/public-teach";

export const metadata: Metadata = {
  title: "Teach on Growvelt",
  description: "Apply to teach practical, career-relevant courses with Growvelt Learning.",
  alternates: { canonical: "/teach" },
  openGraph: { url: "/teach", title: "Teach on Growvelt" },
};

export default function TeachPage() { return <PublicTeach />; }
