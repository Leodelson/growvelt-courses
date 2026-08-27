import { createClient } from "@/app/lib/supabase/server";
import { logSupabaseError } from "@/app/lib/supabase/logging";

export type Certificate = { code: string; courseTitle: string; learnerName: string; instructorName?: string | null; completedAt: string; issuedAt: string; status: "issued" | "revoked" };
type CertificateRow = { certificate_code: string; course_title: string; learner_name: string; instructor_name?: string | null; completed_at: string; issued_at: string; certificate_status: "issued" | "revoked" };

export async function listOwnCertificates(): Promise<Certificate[]> {
  const { data, error } = await (await createClient()).rpc("list_own_learning_certificates");
  if (error) {
    logSupabaseError("dashboard.certificates_load_failed", error);
    throw new Error("Unable to load certificates.");
  }
  return ((data ?? []) as CertificateRow[]).map((row) => ({ code: row.certificate_code, courseTitle: row.course_title, learnerName: row.learner_name, completedAt: row.completed_at, issuedAt: row.issued_at, status: row.certificate_status }));
}
export async function getOwnCertificate(code: string): Promise<Certificate | null> {
  const { data, error } = await (await createClient()).rpc("get_own_learning_certificate", { p_certificate_code: code });
  if (error) throw new Error("Unable to load this certificate."); const row = data?.[0] as CertificateRow | undefined;
  return row ? { code: row.certificate_code, courseTitle: row.course_title, learnerName: row.learner_name, instructorName: row.instructor_name, completedAt: row.completed_at, issuedAt: row.issued_at, status: row.certificate_status } : null;
}
