import { createClient } from "@/app/lib/supabase/server";

type ProviderInsightRow = {
  course_id: number;
  course_title: string;
  course_status: "draft" | "pending_review" | "published" | "archived";
  enrolled_learner_count: number;
  active_learner_count: number;
  completed_learner_count: number;
  completion_rate: number;
  issued_certificate_count: number;
  revoked_certificate_count: number;
  paid_order_count: number;
  reversed_order_count: number;
  gross_sales_minor: number;
  platform_commission_minor: number;
  instructor_allocation_minor: number;
  last_enrolled_at: string | null;
  last_sale_at: string | null;
};

export type ProviderOrganizationInsights = {
  courses: Array<{
    courseId: number;
    title: string;
    status: ProviderInsightRow["course_status"];
    enrolledLearnerCount: number;
    activeLearnerCount: number;
    completedLearnerCount: number;
    completionRate: number;
    issuedCertificateCount: number;
    revokedCertificateCount: number;
    paidOrderCount: number;
    reversedOrderCount: number;
    grossSalesMinor: number;
    platformCommissionMinor: number;
    instructorAllocationMinor: number;
    lastEnrolledAt: string | null;
    lastSaleAt: string | null;
  }>;
  totalEnrolledLearners: number;
  totalCompletedLearners: number;
  overallCompletionRate: number;
  totalIssuedCertificates: number;
  totalGrossSalesMinor: number;
  totalPlatformCommissionMinor: number;
  totalInstructorAllocationMinor: number;
};

export async function getOwnProviderOrganizationInsights(organizationId: number): Promise<ProviderOrganizationInsights> {
  const { data, error } = await (await createClient()).rpc("get_own_learning_provider_organization_insights", { p_organization_id: organizationId });
  if (error) throw new Error("Unable to load provider insights.");
  const courses = ((data ?? []) as ProviderInsightRow[]).map((row) => ({
    courseId: row.course_id, title: row.course_title, status: row.course_status,
    enrolledLearnerCount: row.enrolled_learner_count, activeLearnerCount: row.active_learner_count,
    completedLearnerCount: row.completed_learner_count, completionRate: row.completion_rate,
    issuedCertificateCount: row.issued_certificate_count, revokedCertificateCount: row.revoked_certificate_count,
    paidOrderCount: row.paid_order_count, reversedOrderCount: row.reversed_order_count,
    grossSalesMinor: row.gross_sales_minor, platformCommissionMinor: row.platform_commission_minor,
    instructorAllocationMinor: row.instructor_allocation_minor, lastEnrolledAt: row.last_enrolled_at, lastSaleAt: row.last_sale_at,
  }));
  const totalEnrolledLearners = courses.reduce((total, course) => total + course.enrolledLearnerCount, 0);
  const totalCompletedLearners = courses.reduce((total, course) => total + course.completedLearnerCount, 0);
  return {
    courses, totalEnrolledLearners, totalCompletedLearners,
    overallCompletionRate: totalEnrolledLearners ? Math.round((totalCompletedLearners / totalEnrolledLearners) * 100) : 0,
    totalIssuedCertificates: courses.reduce((total, course) => total + course.issuedCertificateCount, 0),
    totalGrossSalesMinor: courses.reduce((total, course) => total + course.grossSalesMinor, 0),
    totalPlatformCommissionMinor: courses.reduce((total, course) => total + course.platformCommissionMinor, 0),
    totalInstructorAllocationMinor: courses.reduce((total, course) => total + course.instructorAllocationMinor, 0),
  };
}
