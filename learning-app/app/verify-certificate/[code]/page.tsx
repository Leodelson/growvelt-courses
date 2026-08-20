import { getRequestLocale } from "@/app/lib/i18n-server";
import { createClient } from "@/app/lib/supabase/server";

export const metadata = { title: "Certificate verification" };

const copy = {
  en: { eyebrow: "Growvelt Learning verification", valid: "Valid certificate", revoked: "Revoked certificate", validCopy: "This Growvelt Learning certificate is valid.", revokedCopy: "This certificate record exists but is no longer a valid credential.", missing: "Certificate not found", missingCopy: "Check the verification code and try again.", recipient: "Recipient", course: "Course", reference: "Reference" },
  fr: { eyebrow: "Vérification Growvelt Learning", valid: "Certificat valide", revoked: "Certificat révoqué", validCopy: "Ce certificat Growvelt Learning est valide.", revokedCopy: "Ce dossier de certificat existe, mais n’est plus un justificatif valide.", missing: "Certificat introuvable", missingCopy: "Vérifiez le code de vérification et réessayez.", recipient: "Bénéficiaire", course: "Cours", reference: "Référence" },
  es: { eyebrow: "Verificación de Growvelt Learning", valid: "Certificado válido", revoked: "Certificado revocado", validCopy: "Este certificado de Growvelt Learning es válido.", revokedCopy: "Este registro de certificado existe, pero ya no es una credencial válida.", missing: "Certificado no encontrado", missingCopy: "Comprueba el código de verificación e inténtalo de nuevo.", recipient: "Destinatario", course: "Curso", reference: "Referencia" },
} as const;

export default async function VerifyCertificatePage({ params }: { params: Promise<{ code: string }> }) {
  const [{ code }, locale] = await Promise.all([params, getRequestLocale()]);
  const text = copy[locale];
  const { data } = await (await createClient()).rpc("verify_learning_certificate", { p_certificate_code: code });
  const certificate = data?.[0];
  const status = certificate ? (certificate.is_valid ? "valid" : "revoked") : "missing";

  return (
    <main className="certificate-view section-shell">
      <article className={`verification-card verification-${status}`}>
        <p className="eyebrow">{text.eyebrow}</p>
        {certificate ? (
          <>
            <h1>{certificate.is_valid ? text.valid : text.revoked}</h1>
            <p>{certificate.is_valid ? text.validCopy : text.revokedCopy}</p>
            <dl>
              <div><dt>{text.recipient}</dt><dd>{certificate.learner_name}</dd></div>
              <div><dt>{text.course}</dt><dd>{certificate.course_title}</dd></div>
              <div><dt>{text.reference}</dt><dd>{certificate.certificate_code}</dd></div>
            </dl>
          </>
        ) : (
          <>
            <h1>{text.missing}</h1>
            <p>{text.missingCopy}</p>
          </>
        )}
      </article>
    </main>
  );
}
