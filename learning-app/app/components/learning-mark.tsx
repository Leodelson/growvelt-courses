import Link from "next/link";
import { GrowveltLogo } from "@/app/components/growvelt-logo";

export function LearningMark({ compact = false, href = "/" }: { compact?: boolean; href?: string }) {
  return <Link className={`learning-mark${compact ? " is-compact" : ""}`} href={href} aria-label="Growvelt Learning home">
    <GrowveltLogo priority />
  </Link>;
}
