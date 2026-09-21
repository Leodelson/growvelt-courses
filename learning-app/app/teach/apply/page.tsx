import { redirect } from "next/navigation";
import { InstructorApplicationForm } from "@/app/components/instructor/application-form";
import { PublicHeader } from "@/app/components/public-header";
import { getOwnInstructorApplicationContext } from "@/app/lib/instructor/application";
import { getRequestLocale } from "@/app/lib/i18n-server";
import { translate } from "@/app/lib/i18n";

export const metadata = { title: "Apply to teach" };

export default async function TeachApplyPage() {
  const [{ application, identity }, locale] = await Promise.all([getOwnInstructorApplicationContext(), getRequestLocale()]);
  if (application) redirect("/teach/application");
  return <div className="public-page"><PublicHeader /><main id="main-content" className="instructor-page section-shell"><div className="instructor-page-intro"><p className="eyebrow">{translate(locale, "teach.eyebrow")}</p><h1>{translate(locale, "teach.applyTitle")}</h1><p>{translate(locale, "teach.applyCopy")}</p></div><InstructorApplicationForm identity={identity} /></main></div>;
}
