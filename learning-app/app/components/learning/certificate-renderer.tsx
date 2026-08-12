"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { ActionButton } from "@/app/components/ui/action-button";

type CertificateRendererProps = {
  certificate: {
    code: string;
    learnerName: string;
    courseTitle: string;
    instructorName?: string | null;
    completedAt: string;
    issuedAt: string;
    status: "issued" | "revoked";
  };
};

const verificationOrigin = "https://learn.growvelt.com";

export function CertificateRenderer({ certificate }: CertificateRendererProps) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const verificationUrl = `${verificationOrigin}/verify-certificate/${encodeURIComponent(certificate.code)}`;

  useEffect(() => {
    QRCode.toDataURL(verificationUrl, {
      margin: 1,
      width: 180,
      errorCorrectionLevel: "M",
      color: { dark: "#381562", light: "#ffffff" },
    })
      .then(setQrCode)
      .catch(() => setQrCode(null));
  }, [verificationUrl]);

  const completionDate = new Intl.DateTimeFormat("en-NG", { dateStyle: "long" }).format(
    new Date(certificate.completedAt),
  );
  const issuedDate = new Intl.DateTimeFormat("en-NG", { dateStyle: "long" }).format(new Date(certificate.issuedAt));
  const isRevoked = certificate.status === "revoked";

  return (
    <div className="certificate-renderer">
      <article className={`issued-certificate ${isRevoked ? "is-revoked" : ""}`} aria-labelledby="certificate-title">
        <div className="certificate-corner certificate-corner-top" aria-hidden="true" />

        <header className="certificate-brand">
          <img src="/logo/growvelt-logo-white-text.png" alt="Growvelt" />
          <p>GROWVELT LEARNING &amp; CAREER DEVELOPMENT SERVICES</p>
        </header>

        <div className="certificate-main">
          <p className="certificate-kicker">Certificate of Completion</p>
          <p className="certificate-intro">This certificate is proudly presented to</p>
          <h1 id="certificate-title">{certificate.learnerName}</h1>
          <div className="certificate-rule" aria-hidden="true" />
          <p className="certificate-intro">For successfully completing the course</p>
          <h2>{certificate.courseTitle}</h2>
          <p className="certificate-provider">Issued by Growvelt Technologies Limited</p>
          <p className="certificate-instructor">Course Instructor: {certificate.instructorName || "Growvelt Learning"}</p>
        </div>

        <footer className="certificate-footer">
          <div className="certificate-dates">
            <p className="certificate-label">Completed</p>
            <strong>{completionDate}</strong>
            <p className="certificate-label certificate-issued-date">Issued</p>
            <strong>{issuedDate}</strong>
            <small className="certificate-tagline">LEARN. APPLY. SUCCEED.</small>
          </div>

          <div className="certificate-verification">
            {qrCode ? (
              <img src={qrCode} alt={`QR code for ${verificationUrl}`} />
            ) : (
              <div className="certificate-qr-fallback" aria-hidden="true" />
            )}
            <div>
              <p className="certificate-label">Verify this certificate</p>
              <strong>Certificate ID: {certificate.code}</strong>
              <small>{verificationUrl}</small>
            </div>
          </div>

          <div className="certificate-signatory">
            <img src="/signature/Ndu_Leonard_Signature-removebg-preview.png" alt="Approved signature of Ndu Leonard C." />
            <div className="signature-space" aria-hidden="true" />
            <strong>Ndu Leonard C.</strong>
            <small>
              Founder &amp; CEO
              <br />
              Growvelt Technologies Limited
            </small>
          </div>
        </footer>

        {isRevoked && <div className="certificate-revoked" role="status">Revoked certificate — this credential is no longer valid.</div>}
        <div className="certificate-corner certificate-corner-bottom" aria-hidden="true" />
      </article>

      {!isRevoked && (
        <div className="certificate-actions">
          <ActionButton type="button" className="button button-primary" onClick={() => window.print()}>
            Download / Print Certificate
          </ActionButton>
          <a className="button button-secondary" href={verificationUrl} target="_blank" rel="noreferrer">
            Verify Certificate
          </a>
          <a className="button button-secondary" href="https://growvelt.com/jobs" target="_blank" rel="noreferrer">
            Explore Jobs
          </a>
        </div>
      )}
    </div>
  );
}
