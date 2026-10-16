import { listOwnCertificates } from "@/app/lib/learning/certificates";
import { listOwnLearningEnrollments } from "@/app/lib/learning/enrollments";
import { DashboardOverview } from "@/app/components/learning/dashboard-overview";

export const metadata = { title: "Learning overview" };

export default async function DashboardPage() {
  const [courses, certificates] = await Promise.all([listOwnLearningEnrollments(), listOwnCertificates()]);
  return <DashboardOverview courses={courses} certificates={certificates} />;
}
