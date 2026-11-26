-- Install Live-domain projections and provider-API recovery by copying the
-- already-reviewed Test Mode functions after domain-checking every copy.
-- This does not enable checkout or apply any production setting.

begin;

do $migration$
declare
  function_definition text;
  source_guard constant text := 'plan.payment_domain = ''test''';
begin
  select pg_get_functiondef(
    'public.list_public_test_learning_subscription_plans_for_course(bigint)'::regprocedure
  ) into function_definition;
  if function_definition is null or strpos(function_definition, source_guard) = 0 then
    raise exception 'Live plan listing source changed; review before applying this migration';
  end if;
  function_definition := replace(function_definition,
    'FUNCTION public.list_public_test_learning_subscription_plans_for_course(p_course_id bigint)',
    'FUNCTION public.list_public_live_learning_subscription_plans_for_course(p_course_id bigint)');
  function_definition := replace(function_definition, source_guard, 'plan.payment_domain = ''live''');
  execute function_definition;
end;
$migration$;

do $migration$
declare
  function_definition text;
  source_guard constant text := 'invoice.payment_domain = ''test''';
begin
  select pg_get_functiondef(
    'public.get_own_learning_subscription_payment_status(text)'::regprocedure
  ) into function_definition;
  if function_definition is null
    or strpos(function_definition, source_guard) = 0
    or strpos(function_definition, 'subscription.payment_domain = ''test''') = 0 then
    raise exception 'Live subscription status source changed; review before applying this migration';
  end if;
  function_definition := replace(function_definition,
    'FUNCTION public.get_own_learning_subscription_payment_status(p_reference text)',
    'FUNCTION public.get_own_learning_live_subscription_payment_status(p_reference text)');
  function_definition := replace(function_definition, 'subscription.payment_domain = ''test''', 'subscription.payment_domain = ''live''');
  function_definition := replace(function_definition, source_guard, 'invoice.payment_domain = ''live''');
  execute function_definition;
end;
$migration$;

do $migration$
declare
  function_definition text;
begin
  select pg_get_functiondef(
    'public.finalize_learning_test_subscription_initial_period(uuid,uuid,text,timestamptz)'::regprocedure
  ) into function_definition;
  if function_definition is null
    or strpos(function_definition, 'subscription.payment_domain = ''test''') = 0
    or strpos(function_definition, 'invoice.payment_domain = ''test''') = 0 then
    raise exception 'Live subscription period finalizer source changed; review before applying this migration';
  end if;
  function_definition := replace(function_definition,
    'FUNCTION public.finalize_learning_test_subscription_initial_period(p_subscription_id uuid, p_invoice_id uuid, p_provider_transaction_id text, p_paid_at timestamp with time zone)',
    'FUNCTION public.finalize_learning_live_subscription_initial_period(p_subscription_id uuid, p_invoice_id uuid, p_provider_transaction_id text, p_paid_at timestamp with time zone)');
  function_definition := replace(function_definition, 'subscription.payment_domain = ''test''', 'subscription.payment_domain = ''live''');
  function_definition := replace(function_definition, 'invoice.payment_domain = ''test''', 'invoice.payment_domain = ''live''');
  function_definition := replace(function_definition, 'Test subscription was not found', 'Live subscription was not found');
  function_definition := replace(function_definition, 'Test subscription payment period', 'Live subscription payment period');
  execute function_definition;
end;
$migration$;

do $migration$
declare
  function_definition text;
begin
  select pg_get_functiondef(
    'public.reconcile_own_learning_test_subscription_payment(uuid,text,uuid,uuid,text,bigint,bigint,bigint,text,jsonb)'::regprocedure
  ) into function_definition;
  if function_definition is null
    or strpos(function_definition, 'p_verified_payload ->> ''domain'' is distinct from ''test''') = 0
    or strpos(function_definition, 'invoice.payment_domain = ''test''') = 0
    or strpos(function_definition, 'public.process_learning_subscription_provider_event(event_key, verified_transaction)') = 0 then
    raise exception 'Live subscription reconciliation source changed; review before applying this migration';
  end if;
  function_definition := replace(function_definition,
    'FUNCTION public.reconcile_own_learning_test_subscription_payment(p_learner_id uuid, p_reference text, p_subscription_id uuid, p_invoice_id uuid, p_provider_transaction_id text, p_amount_minor bigint, p_requested_amount_minor bigint, p_fees_minor bigint, p_payload_digest text, p_verified_payload jsonb)',
    'FUNCTION public.reconcile_own_learning_live_subscription_payment(p_learner_id uuid, p_reference text, p_subscription_id uuid, p_invoice_id uuid, p_provider_transaction_id text, p_amount_minor bigint, p_requested_amount_minor bigint, p_fees_minor bigint, p_payload_digest text, p_verified_payload jsonb)');
  function_definition := replace(function_definition, '''test''', '''live''');
  function_definition := replace(function_definition,
    'transaction.verify:subscription:test:', 'transaction.verify:subscription:live:');
  function_definition := replace(function_definition,
    'paystack:subscription:test:', 'paystack:subscription:live:');
  function_definition := replace(function_definition, 'Test subscription', 'Live subscription');
  function_definition := replace(function_definition,
    'public.finalize_learning_test_subscription_initial_period(',
    'public.finalize_learning_live_subscription_initial_period(');
  execute function_definition;
end;
$migration$;

revoke all on function public.list_public_live_learning_subscription_plans_for_course(bigint),
  public.get_own_learning_live_subscription_payment_status(text),
  public.finalize_learning_live_subscription_initial_period(uuid,uuid,text,timestamptz),
  public.reconcile_own_learning_live_subscription_payment(uuid,text,uuid,uuid,text,bigint,bigint,bigint,text,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.list_public_live_learning_subscription_plans_for_course(bigint)
  to authenticated, postgres;
grant execute on function public.get_own_learning_live_subscription_payment_status(text)
  to authenticated, postgres;
grant execute on function public.finalize_learning_live_subscription_initial_period(uuid,uuid,text,timestamptz)
  to service_role, postgres;
grant execute on function public.reconcile_own_learning_live_subscription_payment(uuid,text,uuid,uuid,text,bigint,bigint,bigint,text,jsonb)
  to service_role, postgres;

comment on function public.list_public_live_learning_subscription_plans_for_course(bigint) is
  'Returns only active, Live-domain monthly subscription plans whose full course snapshot remains eligible.';
comment on function public.get_own_learning_live_subscription_payment_status(text) is
  'Returns the signed-in learner’s Live-domain subscription invoice status and access state only.';
comment on function public.finalize_learning_live_subscription_initial_period(uuid,uuid,text,timestamptz) is
  'Finalizes the initial paid period only for a Live-domain invoice that the shared processor already marked paid from verified evidence.';
comment on function public.reconcile_own_learning_live_subscription_payment(uuid,text,uuid,uuid,text,bigint,bigint,bigint,text,jsonb) is
  'Reconciles a learner-owned Live subscription invoice only from server-verified Live Paystack API evidence; preserves provider_api provenance and never starts a charge.';

commit;
