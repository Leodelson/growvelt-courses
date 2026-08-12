import Link from "next/link";
import { listOwnCertificates } from "@/app/lib/learning/certificates";

export const metadata = { title: "Certificate space" };

export default async function LearnerCertificatesPage() {
  const certificates = await listOwnCertificates();
  if (!certificates.length) return <section className="certificate-space" aria-labelledby="certificate-space-title"><p className="eyebrow">Certificates</p><h1 id="certificate-space-title">Your issued certificates will appear here.</h1><p>Complete an eligible Growvelt Learning course, then issue your certificate from the completed course page.</p><div className="certificate-space-actions"><Link className="text-link" href="/dashboard/my-learning">Go to My Learning <span aria-hidden="true">→</span></Link></div></section>;
  return <section className="certificate-list section-shell" aria-labelledby="certificate-space-title"><header className="catalog-hero"><p className="eyebrow">Certificates</p><h1 id="certificate-space-title">Your earned proof</h1><p>Issued records are available to view and verify.</p></header><div className="my-learning-list">{certificates.map(c=><article className="my-learning-card" key={c.code}><div><p className="eyebrow">{c.status === "issued" ? "Issued certificate" : "Revoked certificate"}</p><h2>{c.courseTitle}</h2><p>Completed {new Intl.DateTimeFormat("en-NG",{dateStyle:"medium"}).format(new Date(c.completedAt))}</p><small>Reference: {c.code}</small></div><Link className="button button-primary" href={`/dashboard/certificates/${encodeURIComponent(c.code)}`}>View certificate</Link></article>)}</div></section>;
}
