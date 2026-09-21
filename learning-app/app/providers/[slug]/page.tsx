import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/app/lib/supabase/server";
import { VerifiedProviderBadge } from "@/app/components/verified-provider-badge";
import { BrowserBackLink } from "@/app/components/browser-back-link";
import { listPublicVerifiedProviderCourses } from "@/app/lib/catalog/published-courses";

type ProviderProfile = {
  name: string;
  slug: string;
  headline: string;
  description: string;
  contact_email: string;
  website_url: string | null;
  linkedin_url: string | null;
  instagram_url: string | null;
  logo_storage_path: string | null;
  cover_storage_path: string | null;
};

async function getProviderProfile(slug: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  const { data, error } = await (await createClient()).rpc("get_public_learning_provider_organization_profile_branding", { p_slug: slug });
  if (error) return null;
  return ((data ?? [])[0] ?? null) as ProviderProfile | null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const provider = await getProviderProfile(slug);
  return provider ? { title: `${provider.name} | Verified training provider`, description: provider.headline } : { title: "Provider not found" };
}

export default async function PublicProviderProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const provider = await getProviderProfile(slug);
  if (!provider) notFound();
  const courses = await listPublicVerifiedProviderCourses(provider.slug).catch(() => []);

  const initial = provider.name.trim().charAt(0).toUpperCase() || "G";
  const supabase = await createClient();
  const [logoMedia, coverMedia] = await Promise.all([
    provider.logo_storage_path ? supabase.storage.from("learning-provider-media").createSignedUrl(provider.logo_storage_path, 60 * 60) : Promise.resolve({ data: null }),
    provider.cover_storage_path ? supabase.storage.from("learning-provider-media").createSignedUrl(provider.cover_storage_path, 60 * 60) : Promise.resolve({ data: null }),
  ]);
  const links = [
    provider.website_url && { label: "Website", href: provider.website_url },
    provider.linkedin_url && { label: "LinkedIn", href: provider.linkedin_url },
    provider.instagram_url && { label: "Instagram", href: provider.instagram_url },
  ].filter(Boolean) as { label: string; href: string }[];

  return <main className="provider-profile-page section-shell">
    <header className="provider-profile-cover"><BrowserBackLink className="provider-profile-back"><span aria-hidden="true">←</span> Back</BrowserBackLink>{coverMedia.data?.signedUrl && <img className="provider-profile-cover-image" src={coverMedia.data.signedUrl} alt="" />}<div className="provider-profile-cover-pattern" aria-hidden="true" /></header>
    <section className="provider-profile-identity-card" aria-labelledby="provider-name">
      <div className="provider-profile-mark" aria-hidden="true">{logoMedia.data?.signedUrl ? <img src={logoMedia.data.signedUrl} alt="" /> : initial}</div>
      <div className="provider-profile-identity-copy">
        <p className="eyebrow">Verified training provider</p>
        <h1 id="provider-name">{provider.name} <VerifiedProviderBadge /></h1>
        <p className="provider-profile-headline">{provider.headline}</p>
        <div className="provider-profile-meta"><span>Verified by Growvelt</span><span>{courses.length} active {courses.length === 1 ? "course" : "courses"}</span></div>
      </div>
    </section>
    <section className="provider-profile-details-grid" aria-label="Provider details">
      <article><p className="eyebrow">About</p><h2>Learning with {provider.name}</h2><p>{provider.description}</p></article>
      <aside><p className="eyebrow">Connect</p><h2>Contact this provider</h2><a className="provider-profile-email" href={`mailto:${provider.contact_email}`}>{provider.contact_email}</a>{links.length > 0 && <nav className="provider-profile-links" aria-label={`${provider.name} links`}>{links.map((link) => <a key={link.label} href={link.href} target="_blank" rel="noreferrer">{link.label} <span aria-hidden="true">↗</span></a>)}</nav>}</aside>
    </section>
    <section className="provider-profile-courses" aria-labelledby="provider-courses-title"><header><div><p className="eyebrow">Courses</p><h2 id="provider-courses-title">Courses from {provider.name}</h2><p>Browse the active learning experiences this verified provider offers.</p></div><span>{courses.length} active {courses.length === 1 ? "course" : "courses"}</span></header>{courses.length ? <div className="provider-course-grid">{courses.map((course) => <article key={course.id}><div><p>{course.category || "Learning"} · {course.level || "All levels"}</p><h3>{course.title}</h3><span>{course.summary || "Explore this course and start learning with Growvelt."}</span></div><footer><strong>{course.isFree ? "Free" : `${course.priceCurrency || "NGN"} ${Number(course.priceAmount ?? 0).toLocaleString("en-NG")}`}</strong><Link href={`/courses/${encodeURIComponent(course.slug)}`}>View course <span aria-hidden="true">→</span></Link></footer></article>)}</div> : <div className="provider-course-empty"><h3>No public courses yet</h3><p>This provider has not published a course yet. Explore the Growvelt Learning catalog in the meantime.</p><Link href="/courses" className="button button-secondary">Explore courses</Link></div>}</section>
  </main>;
}
