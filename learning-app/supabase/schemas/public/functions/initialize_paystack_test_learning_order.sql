create or replace function public.initialize_paystack_test_learning_order (
  p_learner_id uuid,
  p_course_id  bigint
)
  returns table (
    order_id           bigint,
    order_reference    text,
    payment_attempt_id bigint,
    amount_minor       bigint,
    currency           text
  )
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare course_row record; order_key bigint; order_ref text; attempt_key bigint; amount_key bigint;
begin
  if p_learner_id is null or p_course_id is null then raise exception 'Learner and course are required' using errcode='22023'; end if;
  if not exists(select 1 from public.learning_paystack_test_fixtures fixture where fixture.course_id=p_course_id and fixture.tester_id=p_learner_id and fixture.status='active' and fixture.expires_at>now())
  then raise exception 'Learner is not eligible for this controlled test checkout' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_learner_id::text||':'||p_course_id::text,0));
  if not exists(select 1 from public.profiles where id=p_learner_id) then raise exception 'Learner profile was not found' using errcode='P0002'; end if;
  select c.id,c.instructor_id,c.title,c.price_amount,c.price_currency,c.is_free,c.is_limited_time_free,c.status,p.full_name instructor_name into course_row
  from public.learning_courses c left join public.profiles p on p.id=c.instructor_id where c.id=p_course_id;
  if not found or course_row.status<>'published' then raise exception 'Course is not available for purchase' using errcode='22023'; end if;
  if course_row.is_free or course_row.is_limited_time_free or course_row.price_amount is null or course_row.price_amount<=0 or course_row.price_currency<>'NGN' or scale(course_row.price_amount)>2
  then raise exception 'Course does not have an eligible paid NGN price' using errcode='22023'; end if;
  if exists(select 1 from public.enrollments where learner_id=p_learner_id and course_id=p_course_id and status in ('active','completed'))
    or exists(select 1 from public.learning_course_entitlements where learner_id=p_learner_id and course_id=p_course_id and status='active')
  then raise exception 'Learner already has course access' using errcode='23505'; end if;
  if exists(select 1 from public.learning_orders where learner_id=p_learner_id and course_id=p_course_id and status in ('created','payment_pending','paid','partially_refunded'))
  then raise exception 'A purchase already exists for this course' using errcode='23505'; end if;
  amount_key:=round(course_row.price_amount*100)::bigint;
  insert into public.learning_orders(learner_id,course_id,instructor_id,course_title_snapshot,instructor_name_snapshot,gross_amount_minor,currency,status,commercial_terms_version)
  values(p_learner_id,p_course_id,course_row.instructor_id,course_row.title,course_row.instructor_name,amount_key,'NGN','created','phase1a-test-v1')
  returning id,learning_orders.order_reference into order_key,order_ref;
  insert into public.learning_payment_attempts(order_id,provider,provider_reference,amount_minor,currency,status)
  values(order_key,'paystack',order_ref,amount_key,'NGN','initialized') returning id into attempt_key;
  return query select order_key,order_ref,attempt_key,amount_key,'NGN'::text;
end;$function$;

grant execute on function "public"."initialize_paystack_test_learning_order"(uuid, bigint) to "postgres", "service_role";

revoke all on function "public"."initialize_paystack_test_learning_order"(uuid, bigint) from public;
