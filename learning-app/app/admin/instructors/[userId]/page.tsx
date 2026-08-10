import { redirect } from "next/navigation";

export default async function LegacyAdminInstructorDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  redirect(`/dashboard/admin/instructors/${encodeURIComponent(userId)}`);
}
