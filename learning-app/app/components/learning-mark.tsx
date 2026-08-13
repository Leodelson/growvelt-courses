import Link from "next/link";
import Image from "next/image";

export function LearningMark({ compact = false, href = "/" }: { compact?: boolean; href?: string }) {
  return <Link className={`learning-mark${compact ? " is-compact" : ""}`} href={href} aria-label="Growvelt Learning home">
    <Image src="/logo/growvelt-logo-white-text.png" alt="Growvelt" width={500} height={500} priority />
  </Link>;
}
