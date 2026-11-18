import { PublicTeach } from "@/app/components/public/public-teach";
import { publicPageMetadata } from "@/app/lib/seo";

export const metadata = publicPageMetadata({
  title: "Teach Practical Online Courses",
  description: "Share your expertise through practical online courses. Build structured lessons and guide learners through useful, career-relevant skills.",
  path: "/teach",
});

export default function TeachPage() { return <PublicTeach />; }
