import Link from "next/link";
import styles from "@/app/components/ui/route-feedback.module.css";
export default function CertificateNotFound() { return <section className={`route-feedback-page section-shell ${styles.page}`}><section className="route-feedback-panel"><p className="eyebrow">Certificate</p><h1>Certificate not found.</h1><p>This certificate is unavailable in your account.</p><Link className="button button-primary" href="/dashboard/certificates">Back to certificates</Link></section></section>; }
