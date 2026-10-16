import { redirect } from "next/navigation";
import { getOwnInstructorEarnings } from "@/app/lib/instructor/earnings";
import { isApprovedInstructor } from "@/app/lib/instructor/authorization";
import { EarningsOverview } from "./earnings-overview";

export const metadata = { title: "Instructor earnings" };

export default async function InstructorEarningsPage() {
  if (!await isApprovedInstructor()) redirect("/teach/application");
  const { earnings, events } = await getOwnInstructorEarnings();
  return <EarningsOverview earnings={earnings} events={events} />;
}
