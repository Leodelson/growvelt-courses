-- Record an independently earned free-course claim even when another source
-- already created the shared enrollment row. Historical grants are not inferred.
-- This does not alter access or enable live company checkout.
begin;

create table public.learning_free_enrollment_claims (
  learner_id uuid not null references public.profiles(id) on delete restrict,
  course_id bigint not null references public.learning_courses(id) on delete restrict,
  enrollment_id bigint not null references public.enrollments(id) on delete restrict,
  claimed_at timestamptz not null default now(),
  primary key (learner_id,course_id)
);
create index learning_free_enrollment_claims_enrollment_idx
  on public.learning_free_enrollment_claims(enrollment_id);
alter table public.learning_free_enrollment_claims enable row level security;
revoke all on public.learning_free_enrollment_claims from public,anon,authenticated,service_role;
grant select on public.learning_free_enrollment_claims to service_role;
create trigger prevent_learning_free_enrollment_claim_mutation
before update or delete on public.learning_free_enrollment_claims
for each row execute function public.prevent_learning_company_sale_mutation();

create or replace function public.enroll_in_free_learning_course(p_course_id bigint)
returns table(enrollment_id bigint,enrollment_status text)
language plpgsql security definer set search_path to '' as $function$
declare enrollment_row public.enrollments%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform 1 from public.learning_courses as course_row
  where course_row.id = p_course_id
    and course_row.status = 'published'
    and course_row.is_free = true
    and coalesce(course_row.price_amount,0) = 0
    and coalesce(course_row.price_currency,'NGN') = 'NGN'
    and coalesce(course_row.is_limited_time_free,false) = false
  for share;
  if not found then
    raise exception 'This course is not currently available for free enrollment' using errcode = '22023';
  end if;
  -- Retain the original enrollment timestamp and any completed progress.
  insert into public.enrollments(learner_id,course_id,status)
  values(auth.uid(),p_course_id,'active')
  on conflict(learner_id,course_id) do update
    set status='active',completed_at=null
    where public.enrollments.status='cancelled';
  select * into enrollment_row from public.enrollments enrollment
  where enrollment.learner_id=auth.uid() and enrollment.course_id=p_course_id;
  if not found or enrollment_row.status not in ('active','completed') then
    raise exception 'Free-course enrollment was not granted' using errcode = '23514';
  end if;
  -- A successful free choice is an independent source even if the row was
  -- already active because a company or personal purchase created it.
  insert into public.learning_free_enrollment_claims(learner_id,course_id,enrollment_id)
  values(auth.uid(),p_course_id,enrollment_row.id)
  on conflict(learner_id,course_id) do nothing;
  return query select enrollment_row.id,enrollment_row.status;
end;$function$;

revoke all on function public.enroll_in_free_learning_course(bigint) from public,anon,authenticated;
grant execute on function public.enroll_in_free_learning_course(bigint) to authenticated,postgres,service_role;

commit;
