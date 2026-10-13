-- Phase 4: grant subscription course access only from verified, paid periods.
-- The shared enrollment row and learning progress are retained; an expired
-- subscription does not delete or overwrite a learner's enrollment history.
begin;

create table public.learning_subscription_course_enrollment_sources (
  subscription_id uuid not null references public.learning_subscriptions(id) on delete restrict,
  learner_id uuid not null references public.profiles(id) on delete restrict,
  course_id bigint not null references public.learning_courses(id) on delete restrict,
  enrollment_id bigint not null,
  preexisting_access boolean not null,
  granted_at timestamptz not null default now(),
  primary key (subscription_id, course_id),
  constraint learning_subscription_course_enrollment_source_enrollment_fkey
    foreign key (enrollment_id, learner_id, course_id)
    references public.enrollments(id, learner_id, course_id) on delete restrict
);

create index learning_subscription_course_enrollment_source_learner_idx
  on public.learning_subscription_course_enrollment_sources(learner_id, course_id, enrollment_id);

alter table public.learning_subscription_course_enrollment_sources enable row level security;
revoke all on public.learning_subscription_course_enrollment_sources from public, anon, authenticated, service_role;

create or replace function public.prevent_learning_subscription_course_enrollment_source_mutation()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  raise exception 'Subscription course access provenance cannot be changed or deleted' using errcode = '42501';
end;
$function$;

create trigger prevent_learning_subscription_course_enrollment_source_mutation
before update or delete on public.learning_subscription_course_enrollment_sources
for each row execute function public.prevent_learning_subscription_course_enrollment_source_mutation();

create or replace function public.grant_learning_subscription_invoice_course_access()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
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

create trigger grant_learning_subscription_invoice_course_access
after update of status on public.learning_subscription_invoices
for each row
when (old.status is distinct from new.status and new.status = 'paid')
execute function public.grant_learning_subscription_invoice_course_access();

create or replace function public.has_own_learning_course_access(p_learner_id uuid, p_course_id bigint)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  with own_enrollment as (
    select enrollment.id, enrollment.status
    from public.enrollments enrollment
    join public.learning_courses course
      on course.id = enrollment.course_id and course.status = 'published'
    where enrollment.learner_id = p_learner_id
      and enrollment.course_id = p_course_id
      and enrollment.status in ('active', 'completed')
  ), source_state as (
    select exists (
      select 1 from public.learning_subscription_course_enrollment_sources source
      join own_enrollment enrollment on enrollment.id = source.enrollment_id
      where source.learner_id = p_learner_id and source.course_id = p_course_id
    ) as has_subscription_provenance,
    exists (
      select 1 from public.learning_subscription_course_enrollment_sources source
      join own_enrollment enrollment on enrollment.id = source.enrollment_id
      where source.learner_id = p_learner_id and source.course_id = p_course_id
        and source.preexisting_access
    ) as had_access_before_subscription,
    exists (
      select 1
      from public.learning_subscription_course_enrollment_sources source
      join own_enrollment enrollment on enrollment.id = source.enrollment_id
      join public.learning_subscriptions subscription
        on subscription.id = source.subscription_id and subscription.learner_id = source.learner_id
      join public.learning_subscription_invoices invoice
        on invoice.subscription_id = subscription.id
       and invoice.status = 'paid'
       and invoice.payment_domain = 'test'
       and now() >= invoice.billing_period_starts_at
       and now() < invoice.paid_through
      join public.learning_subscription_invoice_courses included
        on included.invoice_id = invoice.id and included.course_id = source.course_id
      where source.learner_id = p_learner_id and source.course_id = p_course_id
        and subscription.payment_domain = 'test'
        and subscription.status in ('active', 'non_renewing', 'attention', 'cancelled', 'completed')
    ) as has_paid_subscription_period,
    exists (
      select 1 from public.learning_free_enrollment_claims claim
      join own_enrollment enrollment on enrollment.id = claim.enrollment_id
      where claim.learner_id = p_learner_id and claim.course_id = p_course_id
    ) or exists (
      select 1 from public.learning_course_entitlements entitlement
      where entitlement.learner_id = p_learner_id and entitlement.course_id = p_course_id
        and entitlement.status = 'active'
    ) or exists (
      select 1
      from public.learning_company_free_assignment_origins origin
      join public.learning_company_course_assignments assignment
        on assignment.id = origin.assignment_id and assignment.status = 'active'
      join public.learning_company_workspaces workspace
        on workspace.id = assignment.workspace_id and workspace.status = 'active'
      join public.learning_company_memberships membership
        on membership.workspace_id = workspace.id and membership.user_id = p_learner_id
         and membership.status = 'active'
      join own_enrollment enrollment on enrollment.id = origin.enrollment_id
      where assignment.assigned_user_id = p_learner_id and assignment.course_id = p_course_id
    ) or exists (
      select 1
      from public.learning_company_paid_seat_access source
      join public.learning_company_paid_course_purchases purchase
        on purchase.id = source.purchase_id and purchase.status = 'paid'
      join own_enrollment enrollment on enrollment.id = source.enrollment_id
      where source.assigned_user_id = p_learner_id and purchase.course_id = p_course_id
        and source.status = 'active'
    ) or exists (
      select 1 from public.learning_orders order_row
      where order_row.learner_id = p_learner_id and order_row.course_id = p_course_id
        and order_row.status in ('paid', 'partially_refunded')
    ) or exists (
      select 1 from public.learning_courses course
      where course.id = p_course_id and course.instructor_id = p_learner_id
    ) or exists (
      select 1 from public.learning_courses course
      where course.id = p_course_id and coalesce(course.is_free, false)
        and coalesce(course.price_amount, 0) = 0
    ) as has_non_subscription_source
  )
  select case
    when not exists (select 1 from own_enrollment) then false
    when not (select has_subscription_provenance from source_state) then true
    else (select had_access_before_subscription or has_paid_subscription_period or has_non_subscription_source from source_state)
  end;
$function$;

revoke all on function public.prevent_learning_subscription_course_enrollment_source_mutation(),
  public.grant_learning_subscription_invoice_course_access(),
  public.has_own_learning_course_access(uuid, bigint)
from public, anon, authenticated, service_role;
grant execute on function public.has_own_learning_course_access(uuid, bigint) to postgres, service_role;

-- Patch the seven existing learner entry points by replacing only their exact
-- enrollment-status predicate. Fail closed if a source definition has drifted.
do $migration$
declare
  function_signature text;
  function_definition text;
  enrollment_predicate constant text := 'enrollment_row.status in (''active'', ''completed'')';
  guarded_predicate constant text := 'enrollment_row.status in (''active'', ''completed'') and public.has_own_learning_course_access(auth.uid(), enrollment_row.course_id)';
  signatures constant text[] := array[
    'public.get_own_learning_enrollment_state(bigint)',
    'public.list_own_learning_course_experience(integer,integer)',
    'public.get_own_enrolled_learning_course_experience_by_slug(text)',
    'public.get_own_enrolled_lesson_snapshot(text,bigint)',
    'public.get_own_enrolled_quiz_snapshot(text,bigint)',
    'public.complete_own_enrolled_lesson(bigint,bigint)',
    'public.submit_own_quiz_attempt(text,bigint,jsonb)'
  ];
begin
  foreach function_signature in array signatures loop
    function_definition := pg_get_functiondef(to_regprocedure(function_signature));
    if function_definition is null then
      raise exception 'Required learner access function is missing: %', function_signature using errcode = '42883';
    end if;
    if position(guarded_predicate in function_definition) > 0 then continue; end if;
    if position(enrollment_predicate in function_definition) = 0 then
      raise exception 'Learner access function did not contain the reviewed enrollment predicate: %', function_signature using errcode = '23514';
    end if;
    function_definition := replace(function_definition, enrollment_predicate, guarded_predicate);
    execute function_definition;
  end loop;
end;
$migration$;

commit;
