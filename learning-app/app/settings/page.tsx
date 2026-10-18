import { learningPath } from "@/app/lib/site-urls.mjs";
import { redirect } from "next/navigation";

export default function LegacySettingsPage() {
  redirect(learningPath("/dashboard/settings"));
}
