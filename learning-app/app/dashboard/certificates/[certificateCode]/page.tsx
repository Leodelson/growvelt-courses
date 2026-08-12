import Link from "next/link";
import { notFound } from "next/navigation";
import { CertificateRenderer } from "@/app/components/learning/certificate-renderer";
import { getOwnCertificate } from "@/app/lib/learning/certificates";

export const metadata = { title: "Certificate" };

export default async function CertificatePage({ params }: { params: Promise<{ certificateCode: string }> }) {
  const { certificateCode } = await params;
  const certificate = await getOwnCertificate(certificateCode);
  if (!certificate) notFound();
  return <section className="certificate-view section-shell" aria-labelledby="certificate-title"><Link className="back-link certificate-back" href="/dashboard/certificates">Certificates</Link><CertificateRenderer certificate={certificate} /></section>;
}
