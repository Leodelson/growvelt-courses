import Link from "next/link";
import { notFound } from "next/navigation";
import { getOwnCertificate } from "@/app/lib/learning/certificates";

export const metadata = { title: "Certificate" };

export default async function CertificatePage({ params }: { params: Promise<{ certificateCode: string }> }) {
  const { certificateCode } = await params;
  const certificate = await getOwnCertificate(certificateCode);
  if (!certificate) notFound();
  return <section className="certificate-view section-shell" aria-labelledby="certificate-title"><Link className="back-link" href="/dashboard/certificates">Certificates</Link><article className="certificate-paper issued-certificate"><p className="eyebrow">Growvelt Learning</p><p>This certifies that</p><h1 id="certificate-title">{certificate.learnerName}</h1><p>has completed</p><h2>{certificate.courseTitle}</h2><div className="certificate-demo-line" /><small>Completed {new Intl.DateTimeFormat("en-NG", { dateStyle: "long" }).format(new Date(certificate.completedAt))}</small><small>Verification code: {certificate.code}</small></article></section>;
}
