import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { VerifiedProviderBadge } from "@/app/components/verified-provider-badge";
import { isApprovedInstructor } from "@/app/lib/instructor/authorization";
import { getOwnInstructorOrganizationProfileBranding, getOwnInstructorOrganizations, getOwnInstructorOrganizationVerifications } from "@/app/lib/instructor/organizations";
import { listPublicVerifiedProviderCourses } from "@/app/lib/catalog/published-courses";
import { createClient } from "@/app/lib/supabase/server";

export const metadata = { title: "Preview provider profile" };

export default async function ProviderProfilePreviewPage({ params }: { params: Promise<{ organizationId: string }> }) {
  if (!await isApprovedInstructor()) redirect("/teach/application");
  const organizationId = Number((await params).organizationId);
  const [organizations, verifications] = await Promise.all([getOwnInstructorOrganizations(), getOwnInstructorOrganizationVerifications()]);
  const organization = organizations.find((item) => item.organization_id === organizationId && item.membership_role === "owner" && item.membership_status === "active" && item.organization_status === "active");
  const verification = verifications.find((item) => item.organization_id === organizationId && item.status === "verified");
  if (!organization || !verification) notFound();
  const profile = await getOwnInstructorOrganizationProfileBranding(organizationId);
  if (!profile) notFound();
  const courses = await listPublicVerifiedProviderCourses(organization.slug).catch(() => []);
  const supabase = await createClient();
  const [logo, cover] = await Promise.all([profile.logo_storage_path ? supabase.storage.from("learning-provider-media").createSignedUrl(profile.logo_storage_path, 3600) : Promise.resolve({ data: null }), profile.cover_storage_path ? supabase.storage.from("learning-provider-media").createSignedUrl(profile.cover_storage_path, 3600) : Promise.resolve({ data: null })]);
  return <section className="provider-profile-page section-shell"><Link className="back-link" href={`/dashboard/instructor/organizations/${organizationId}/profile`}>← Back to provider profile</Link><header className="provider-profile-cover">{cover.data?.signedUrl && <img className="provider-profile-cover-image" src={cover.data.signedUrl} alt="" />}<div className="provider-profile-cover-pattern" aria-hidden="true" /></header><section className="provider-profile-identity-card"><div className="provider-profile-mark" aria-hidden="true">{logo.data?.signedUrl ? <img src={logo.data.signedUrl} alt="" /> : organization.name.charAt(0).toUpperCase()}</div><div className="provider-profile-identity-copy"><p className="eyebrow">Verified training provider</p><h1>{organization.name} <VerifiedProviderBadge /></h1><p className="provider-profile-headline">{profile.headline}</p><div className="provider-profile-meta"><span>Verified by Growvelt</span><span>{courses.length} active {courses.length === 1 ? "course" : "courses"}</span></div></div></section><section className="provider-profile-details-grid"><article><p className="eyebrow">About</p><h2>Learning with {organization.name}</h2><p>{profile.description}</p></article><aside><p className="eyebrow">Connect</p><h2>Contact this provider</h2><a className="provider-profile-email" href={`mailto:${profile.contact_email}`}>{profile.contact_email}</a></aside></section><section className="provider-profile-courses"><header><div><p className="eyebrow">Courses</p><h2>Courses from {organization.name}</h2><p>Browse the active learning experiences this verified provider offers.</p></div><span>{courses.length} active {courses.length === 1 ? "course" : "courses"}</span></header>{courses.length ? <div className="provider-course-grid">{courses.map((course) => <article key={course.id}><div><p>{course.category || "Learning"} · {course.level || "All levels"}</p><h3>{course.title}</h3><span>{course.summary || "Explore this course and start learning with Growvelt."}</span></div><footer><strong>{course.isFree ? "Free" : `${course.priceCurrency || "NGN"} ${Number(course.priceAmount ?? 0).toLocaleString("en-NG")}`}</strong><Link href={`/dashboard/courses/${encodeURIComponent(course.slug)}`}>View course →</Link></footer></article>)}</div> : <p>No public courses yet.</p>}</section></section>;
}
