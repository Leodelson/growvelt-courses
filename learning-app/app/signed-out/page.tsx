import Link from "next/link";

export const metadata = { title: "Signed out" };

export default function SignedOutPage() {
  return <main className="signed-out-page section-shell"><section className="signed-out-card"><p className="eyebrow">Signed out</p><h1>You have been signed out securely.</h1><p>Sign in again when you are ready to continue learning, teaching, or managing your Growvelt workspace.</p><div><Link className="button button-primary" href="/sign-in">Sign in</Link><Link className="button button-secondary" href="/">Continue browsing</Link></div></section></main>;
}
