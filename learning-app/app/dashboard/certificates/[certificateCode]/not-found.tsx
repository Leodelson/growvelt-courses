import Link from "next/link";
export default function CertificateNotFound() { return <section className="certificate-space"><p className="eyebrow">Certificate</p><h1>Certificate not found.</h1><p>This certificate is unavailable in your account.</p><Link className="button button-primary" href="/dashboard/certificates">Back to certificates</Link></section>; }
