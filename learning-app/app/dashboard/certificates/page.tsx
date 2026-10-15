import { CertificateLibrary } from "@/app/components/learning/certificate-library";
import { listOwnCertificates } from "@/app/lib/learning/certificates";
import { listOwnLearningEnrollments } from "@/app/lib/learning/enrollments";

export const metadata = { title: "Certificates" };

export default async function LearnerCertificatesPage() {
  const [certificates, courses] = await Promise.all([listOwnCertificates(), listOwnLearningEnrollments()]);
  return <CertificateLibrary certificates={certificates} completedCourses={courses.filter((course) => course.enrollmentStatus === "completed").map(({ id, title, slug }) => ({ id, title, slug }))} />;
}
