create or replace function public.grant_learning_subscription_invoice_course_access()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  subscription_row public.learning_subscriptions%rowtype;
  included_course record;
  enrollment_key bigint;
  enrollment_status text;
  had_preexisting_access boolean;
  existing_source public.learning_subscription_course_enrollment_sources%rowtype;
  course_count integer := 0;
begin
  if tg_op = 'UPDATE' and old.status = 'paid' then return new; end if;
  if new.status <> 'paid' then return new; end if;

  select * into subscription_row
  from public.learning_subscriptions subscription
  where subscription.id = new.subscription_id
  for update;
  if not found or subscription_row.learner_id is null or subscription_row.payment_domain <> 'test' then
    raise exception 'Paid subscription invoice has no matching Test Mode learner subscription' using errcode = '23514';
  end if;

  for included_course in
    select item.course_id
    from public.learning_subscription_invoice_courses item
    where item.invoice_id = new.id
    order by item.course_id
  loop
    course_count := course_count + 1;
    perform pg_advisory_xact_lock(hashtextextended(
      'learning-company-paid-access:' || included_course.course_id::text || ':' || subscription_row.learner_id::text, 0));

    select enrollment.id, enrollment.status
    into enrollment_key, enrollment_status
    from public.enrollments enrollment
    where enrollment.learner_id = subscription_row.learner_id
      and enrollment.course_id = included_course.course_id
    for update;
    had_preexisting_access := found and enrollment_status in ('active', 'completed');

    if enrollment_key is null then
      insert into public.enrollments(learner_id, course_id, status)
      values (subscription_row.learner_id, included_course.course_id, 'active')
      on conflict (learner_id, course_id) do nothing
      returning id, status into enrollment_key, enrollment_status;
      if enrollment_key is null then
        select enrollment.id, enrollment.status
        into enrollment_key, enrollment_status
        from public.enrollments enrollment
        where enrollment.learner_id = subscription_row.learner_id
          and enrollment.course_id = included_course.course_id
        for update;
        had_preexisting_access := enrollment_status in ('active', 'completed');
      end if;
    elsif enrollment_status = 'cancelled' then
      update public.enrollments enrollment
      set status = 'active', completed_at = null
      where enrollment.id = enrollment_key
      returning enrollment.status into enrollment_status;
    end if;

    if enrollment_key is null or enrollment_status not in ('active', 'completed') then
      raise exception 'Subscription course enrollment could not be safely established' using errcode = '23514';
    end if;

    select * into existing_source
    from public.learning_subscription_course_enrollment_sources source
    where source.subscription_id = subscription_row.id
      and source.course_id = included_course.course_id
    for update;
    if found then
      if existing_source.learner_id <> subscription_row.learner_id
         or existing_source.enrollment_id <> enrollment_key then
        raise exception 'Subscription course access provenance conflicts with its existing enrollment' using errcode = '23514';
      end if;
    else
      insert into public.learning_subscription_course_enrollment_sources(
        subscription_id, learner_id, course_id, enrollment_id, preexisting_access
      ) values (
        subscription_row.id, subscription_row.learner_id, included_course.course_id,
        enrollment_key, had_preexisting_access
      );
    end if;
  end loop;

  if course_count = 0 then
    raise exception 'Paid subscription invoice has no included course snapshot' using errcode = '23514';
  end if;
  return new;
end;
$function$;

revoke all on function public.grant_learning_subscription_invoice_course_access()
  from public, anon, authenticated, service_role;
