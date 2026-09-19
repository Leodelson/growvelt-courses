-- Phase 2A3: forward-only attribution for new organization course drafts.
-- The lead instructor remains the course's existing instructor_id and commercial owner.
-- This migration does not change historical courses, orders, commercial allocations,
-- earnings, reservations, payouts, certificates, enrollments, or Paystack state.
begin;

alter table public.learning_courses
  add column organization_id bigint references public.learning_provider_organizations(id) on delete restrict;

create index learning_courses_organization_updated_at_idx
  on public.learning_courses(organization_id, updated_at desc, id desc)
  where organization_id is not null;

create or replace function public.prevent_learning_course_organization_attribution_mutation()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if old.organization_id is distinct from new.organization_id then
    raise exception 'Course organization attribution is immutable' using errcode = '42501';
  end if;
  return new;
end;
$function$;

create trigger prevent_learning_course_organization_attribution_mutation
  before update of organization_id on public.learning_courses
  for each row
  execute function public.prevent_learning_course_organization_attribution_mutation();

create or replace function public.create_learning_organization_course_draft(
  p_organization_id bigint,
  p_title text,
  p_summary text,
  p_description text,
  p_category text,
  p_level text,
  p_is_free boolean,
  p_price_amount numeric,
  p_price_currency text default 'NGN'::text
)
returns table(course_id bigint, slug text, status text, organization_id bigint)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  normalized_title text := btrim(p_title);
  normalized_summary text := btrim(p_summary);
  normalized_description text := btrim(p_description);
  normalized_category text := btrim(p_category);
  normalized_level text := btrim(p_level);
  normalized_currency text := upper(btrim(coalesce(p_price_currency, '')));
  normalized_price numeric;
  slug_base text;
  candidate_slug text;
  attempt integer := 2;
  created_course_id bigint;
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then
    raise exception 'Approved Instructor capability required' using errcode = '42501';
  end if;

  if p_organization_id is null
    or not exists (
      select 1
      from public.learning_provider_organizations organization
      join public.learning_provider_organization_memberships membership
        on membership.organization_id = organization.id
      where organization.id = p_organization_id
        and organization.status = 'active'
        and membership.user_id = auth.uid()
        and membership.status = 'active'
        and membership.role in ('owner', 'admin', 'instructor')
    ) then
    raise exception 'Active organization membership required' using errcode = '42501';
  end if;

  if normalized_title is null
     or normalized_summary is null
     or normalized_description is null
     or char_length(normalized_title) not between 3 and 160
     or char_length(normalized_summary) not between 10 and 320
     or char_length(normalized_description) not between 40 and 10000 then
    raise exception 'Course metadata does not meet the required length limits' using errcode = '22023';
  end if;

  if normalized_category is null or normalized_category not in (
    'Data Analytics', 'Business', 'Data Science', 'Business Intelligence',
    'Programming', 'Web Development', 'Cybersecurity', 'Digital Marketing',
    'Creative Skills', 'Digital Skills', 'Productivity'
  ) then
    raise exception 'Choose a supported course category' using errcode = '22023';
  end if;

  if normalized_level is null or normalized_level not in ('Beginner', 'Intermediate', 'Beginner to intermediate', 'Beginner to job-ready') then
    raise exception 'Choose a supported course level' using errcode = '22023';
  end if;

  if p_is_free is null or normalized_currency <> 'NGN' then
    raise exception 'Course drafts support NGN pricing only' using errcode = '22023';
  elsif p_is_free then
    normalized_price := 0;
  elsif p_price_amount is null
        or p_price_amount <= 0
        or p_price_amount > 10000000
        or scale(p_price_amount) > 2 then
    raise exception 'Paid drafts require a valid NGN price' using errcode = '22023';
  else
    normalized_price := p_price_amount;
  end if;

  slug_base := trim(both '-' from regexp_replace(lower(normalized_title), '[^a-z0-9]+', '-', 'g'));
  if slug_base is null or slug_base = '' then
    raise exception 'Course title cannot produce a safe slug' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(slug_base));
  candidate_slug := slug_base;
  while exists (select 1 from public.learning_courses course where course.slug = candidate_slug) loop
    candidate_slug := slug_base || '-' || attempt;
    attempt := attempt + 1;
  end loop;

  insert into public.learning_courses (
    instructor_id, organization_id, title, slug, summary, description, category, level,
    price_amount, price_currency, is_free, is_limited_time_free, status
  ) values (
    auth.uid(), p_organization_id, normalized_title, candidate_slug, normalized_summary,
    normalized_description, normalized_category, normalized_level, normalized_price,
    'NGN', p_is_free, false, 'draft'
  ) returning id into created_course_id;

  insert into public.learning_audit_events(actor_user_id, actor_role, action, entity_type, entity_id, metadata)
  values (
    auth.uid(), 'instructor', 'provider_organization.course_draft_created',
    'learning_course', created_course_id::text,
    jsonb_build_object('organization_id', p_organization_id, 'commercial_owner_instructor_id', auth.uid())
  );

  return query select created_course_id, candidate_slug, 'draft'::text, p_organization_id;
end;
$function$;

revoke all on function public.prevent_learning_course_organization_attribution_mutation() from public, anon, authenticated;
grant execute on function public.prevent_learning_course_organization_attribution_mutation() to postgres, service_role;
revoke all on function public.create_learning_organization_course_draft(bigint, text, text, text, text, text, boolean, numeric, text) from public, anon;
grant execute on function public.create_learning_organization_course_draft(bigint, text, text, text, text, text, boolean, numeric, text) to authenticated, postgres, service_role;

commit;
