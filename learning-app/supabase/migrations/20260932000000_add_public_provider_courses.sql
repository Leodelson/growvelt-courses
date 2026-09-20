-- Phase 2B3: public course listings for a verified training provider. Only
-- courses that are already public through the catalog can appear here.

create function public.list_public_learning_provider_courses(p_provider_slug text, p_limit integer default 12)
returns table(course_id bigint, slug text, title text, summary text, category text, level text, is_free boolean, price_amount numeric, price_currency text, instructor_name text, published_at timestamptz)
language plpgsql stable security definer set search_path to '' as $function$
declare normalized_slug text := lower(btrim(p_provider_slug));
begin
  if normalized_slug is null or normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or p_limit not between 1 and 24 then return; end if;
  return query
  select course.id, course.slug, course.title, course.summary, course.category, course.level, course.is_free, course.price_amount, course.price_currency, instructor.full_name, course.published_at
  from public.learning_provider_organizations organization
  join public.learning_provider_organization_verifications verification on verification.organization_id = organization.id and verification.status = 'verified'
  join public.learning_courses course on course.organization_id = organization.id and course.status = 'published'
  left join public.profiles instructor on instructor.id = course.instructor_id
  where organization.slug = normalized_slug
    and organization.status = 'active'
    and not exists(select 1 from public.learning_paystack_test_fixtures fixture where fixture.course_id = course.id)
  order by course.published_at desc nulls last, course.id desc
  limit p_limit;
end;
$function$;

revoke all on function public.list_public_learning_provider_courses(text,integer) from public, anon, authenticated;
grant execute on function public.list_public_learning_provider_courses(text,integer) to anon, authenticated, postgres, service_role;
