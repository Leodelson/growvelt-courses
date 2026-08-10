import Link from "next/link";
import { LearningMark } from "@/app/components/learning-mark";
import { SkipLink } from "@/app/components/ui/skip-link";

export function ProtectedPageHeader({ context, backHref, backLabel, homeHref = "/dashboard", homeLabel = "Learning dashboard" }: { context: string; backHref: string; backLabel: string; homeHref?: string; homeLabel?: string }) {
  const showHomeLink = homeHref !== backHref;

  return <header className="protected-page-header"><SkipLink /><div className="protected-page-header-inner"><div className="protected-page-identity"><LearningMark compact href={homeHref} /><p>{context}</p></div><nav aria-label={`${context} navigation`}><Link className="back-link" href={backHref}>← {backLabel}</Link>{showHomeLink && <Link className="back-link" href={homeHref}>{homeLabel}</Link>}</nav></div></header>;
}
