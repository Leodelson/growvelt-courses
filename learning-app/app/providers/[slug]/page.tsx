import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/app/lib/supabase/server";
import { VerifiedProviderBadge } from "@/app/components/verified-provider-badge";

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
    <header className="provider-profile-cover">{coverMedia.data?.signedUrl && <img className="provider-profile-cover-image" src={coverMedia.data.signedUrl} alt="" />}<div className="provider-profile-cover-pattern" aria-hidden="true" /></header>
    <section className="provider-profile-identity-card" aria-labelledby="provider-name">
      <div className="provider-profile-mark" aria-hidden="true">{logoMedia.data?.signedUrl ? <img src={logoMedia.data.signedUrl} alt="" /> : initial}</div>
      <div className="provider-profile-identity-copy">
        <p className="eyebrow">Verified training provider</p>
        <h1 id="provider-name">{provider.name} <VerifiedProviderBadge /></h1>
        <p className="provider-profile-headline">{provider.headline}</p>
        <div className="provider-profile-meta"><span>Verified by Growvelt</span><span>Training organization</span></div>
      </div>
    </section>
    <section className="provider-profile-details-grid" aria-label="Provider details">
      <article><p className="eyebrow">About</p><h2>Learning with {provider.name}</h2><p>{provider.description}</p></article>
      <aside><p className="eyebrow">Connect</p><h2>Contact this provider</h2><a className="provider-profile-email" href={`mailto:${provider.contact_email}`}>{provider.contact_email}</a>{links.length > 0 && <nav className="provider-profile-links" aria-label={`${provider.name} links`}>{links.map((link) => <a key={link.label} href={link.href} target="_blank" rel="noreferrer">{link.label} <span aria-hidden="true">↗</span></a>)}</nav>}</aside>
    </section>
    <section className="provider-profile-footer-card"><div><p className="eyebrow">Growvelt Learning</p><h2>Explore courses built for your growth.</h2><p>Course listings and provider analytics will be added as this provider workspace grows.</p></div><Link href="/courses" className="button button-primary">Explore courses</Link></section>
  </main>;
}
