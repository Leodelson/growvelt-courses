import Link from "next/link";

export function LearningMark({ compact = false }: { compact?: boolean }) {
  return <Link className="learning-mark" href="/" aria-label="Growvelt Learning home"><span aria-hidden="true" className="mark-orbit">G</span>{!compact && <span><strong>Growvelt</strong><em>Learning</em></span>}</Link>;
}
