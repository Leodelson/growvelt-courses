import Link from "next/link";

export const metadata = { title: "Certificate space" };

export default function LearnerCertificatesPage() {
  return <section className="certificate-space" aria-labelledby="certificate-space-title">
    <p className="eyebrow">Certificate space</p>
    <h1 id="certificate-space-title">Your earned proof will live here.</h1>
    <p>Growvelt Learning will connect certificates to real completion and verification rules in a later phase. No certificates are issued or stored here yet.</p>
    <div className="certificate-space-actions"><Link className="button button-secondary" href="/certificates">Explore the public certificate concept</Link><Link className="text-link" href="/dashboard">Back to overview <span aria-hidden="true">→</span></Link></div>
  </section>;
}
