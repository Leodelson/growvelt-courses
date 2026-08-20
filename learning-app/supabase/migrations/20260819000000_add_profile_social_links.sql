-- Optional owner-managed social and professional links for Growvelt Learning profiles.
-- Run this migration in the Growvelt Learning Supabase project before deploying the UI.

alter table public.profiles
  add column if not exists linkedin_url text,
  add column if not exists website_url text,
  add column if not exists instagram_url text,
  add column if not exists facebook_url text,
  add column if not exists x_url text;

comment on column public.profiles.linkedin_url is 'Optional public LinkedIn profile URL selected by the account owner.';
comment on column public.profiles.website_url is 'Optional public professional website or portfolio URL selected by the account owner.';
comment on column public.profiles.instagram_url is 'Optional public Instagram profile URL selected by the account owner.';
comment on column public.profiles.facebook_url is 'Optional public Facebook profile URL selected by the account owner.';
comment on column public.profiles.x_url is 'Optional public X or Twitter profile URL selected by the account owner.';

-- Keep the authenticated role aligned with the existing owner-update policy,
-- including when the project uses column-specific update grants.
grant update (linkedin_url, website_url, instagram_url, facebook_url, x_url) on table public.profiles to authenticated;

-- Make the new columns available to Supabase's REST schema cache immediately.
notify pgrst, 'reload schema';
