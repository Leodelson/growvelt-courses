-- Add service-only Live reservation and completion RPCs by copying the
-- established Test Mode state machine. Assertions make this migration fail
-- closed if the source safety checks change before the Live counterpart is
-- reviewed.

begin;

do $migration$
declare
  function_definition text;
  expected_insert_count integer;
begin
  select pg_get_functiondef(
    'public.begin_own_learning_test_subscription_checkout(uuid,uuid,uuid)'::regprocedure
  ) into function_definition;

  if function_definition is null
    or strpos(function_definition,
      'FUNCTION public.begin_own_learning_test_subscription_checkout(p_learner_id uuid, p_plan_id uuid, p_request_id uuid)') = 0
    or strpos(function_definition, 'plan_row.payment_domain <> ''test''') = 0
    or strpos(function_definition,
      'values (p_plan_id, p_learner_id, ''test'', ''pending'')') = 0
    or strpos(function_definition, 'provider_reference, amount_minor, platform_share_minor') = 0 then
    raise exception 'Live subscription reservation source changed; review before applying this migration';
  end if;

  expected_insert_count := (length(function_definition)
    - length(replace(function_definition,
      'request_id, learner_id, plan_id, subscription_id, invoice_id, state', '')))
    / length('request_id, learner_id, plan_id, subscription_id, invoice_id, state');
  if expected_insert_count <> 2 then
    raise exception 'Expected two subscription attempt inserts; review the Live reservation migration';
  end if;

  function_definition := replace(function_definition,
    'FUNCTION public.begin_own_learning_test_subscription_checkout(p_learner_id uuid, p_plan_id uuid, p_request_id uuid)',
    'FUNCTION public.begin_own_learning_live_subscription_checkout(p_learner_id uuid, p_plan_id uuid, p_request_id uuid)');
  function_definition := replace(function_definition,
    'attempt_row.learner_id <> p_learner_id or attempt_row.plan_id <> p_plan_id',
    'attempt_row.learner_id <> p_learner_id or attempt_row.plan_id <> p_plan_id or attempt_row.payment_domain <> ''live''');
  function_definition := replace(function_definition,
    'plan_row.payment_domain <> ''test''', 'plan_row.payment_domain <> ''live''');
  function_definition := replace(function_definition,
    'where subscription.plan_id = p_plan_id and subscription.learner_id = p_learner_id',
    'where subscription.plan_id = p_plan_id and subscription.learner_id = p_learner_id and subscription.payment_domain = ''live''');
  function_definition := replace(function_definition,
    'where invoice.subscription_id = subscription_row.id
      and invoice.status',
    'where invoice.subscription_id = subscription_row.id and invoice.payment_domain = ''live''
      and invoice.status');
  function_definition := replace(function_definition,
    'where attempt.subscription_id = resolved_subscription_id
    order by',
    'where attempt.subscription_id = resolved_subscription_id and attempt.payment_domain = ''live''
    order by');
  function_definition := replace(function_definition,
    'request_id, learner_id, plan_id, subscription_id, invoice_id, state',
    'request_id, learner_id, plan_id, subscription_id, invoice_id, payment_domain, state');
  function_definition := replace(function_definition,
    'resolved_invoice_id, ''initializing'')', 'resolved_invoice_id, ''live'', ''initializing'')');
  function_definition := replace(function_definition,
    'values (p_plan_id, p_learner_id, ''test'', ''pending'')',
    'values (p_plan_id, p_learner_id, ''live'', ''pending'')');
  function_definition := replace(function_definition,
    'provider_reference, amount_minor, platform_share_minor, seller_share_minor,',
    'provider_reference, payment_domain, amount_minor, platform_share_minor, seller_share_minor,');
  function_definition := replace(function_definition,
    '''GS-'' || upper(replace(gen_random_uuid()::text, ''-'', '''')), plan_row.amount_minor,',
    '''GS-'' || upper(replace(gen_random_uuid()::text, ''-'', '''')), ''live'', plan_row.amount_minor,');
  function_definition := replace(function_definition,
    'jsonb_build_object(''payment_domain'',''test'',''plan_id'',p_plan_id,''invoice_id'',resolved_invoice_id)',
    'jsonb_build_object(''payment_domain'',''live'',''plan_id'',p_plan_id,''invoice_id'',resolved_invoice_id)');
  function_definition := replace(function_definition,
    'jsonb_build_object(''payment_domain'',''test'',''plan_id'',p_plan_id)',
    'jsonb_build_object(''payment_domain'',''live'',''plan_id'',p_plan_id)');

  execute function_definition;
end;
$migration$;

do $migration$
declare
  function_definition text;
begin
  select pg_get_functiondef(
    'public.finish_own_learning_test_subscription_checkout(uuid,text,text)'::regprocedure
  ) into function_definition;
  if function_definition is null
    or strpos(function_definition,
      'FUNCTION public.finish_own_learning_test_subscription_checkout(p_request_id uuid, p_outcome text, p_authorization_url text DEFAULT NULL::text)') = 0
    or strpos(function_definition, 'where attempt.request_id = p_request_id') = 0 then
    raise exception 'Live subscription completion source changed; review before applying this migration';
  end if;
  function_definition := replace(function_definition,
    'FUNCTION public.finish_own_learning_test_subscription_checkout(p_request_id uuid, p_outcome text, p_authorization_url text DEFAULT NULL::text)',
    'FUNCTION public.finish_own_learning_live_subscription_checkout(p_request_id uuid, p_outcome text, p_authorization_url text DEFAULT NULL::text)');
  function_definition := replace(function_definition,
    'where attempt.request_id = p_request_id',
    'where attempt.request_id = p_request_id and attempt.payment_domain = ''live''');
  function_definition := replace(function_definition,
    'where invoice.id = attempt_row.invoice_id and invoice.status = ''created''',
    'where invoice.id = attempt_row.invoice_id and invoice.payment_domain = ''live'' and invoice.status = ''created''');
  execute function_definition;
end;
$migration$;

revoke all on function public.begin_own_learning_live_subscription_checkout(uuid,uuid,uuid),
  public.finish_own_learning_live_subscription_checkout(uuid,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.begin_own_learning_live_subscription_checkout(uuid,uuid,uuid),
  public.finish_own_learning_live_subscription_checkout(uuid,text,text)
  to service_role, postgres;

comment on function public.begin_own_learning_live_subscription_checkout(uuid,uuid,uuid) is
  'Creates one Live-domain subscription invoice and idempotent checkout reservation for an eligible learner and active Live plan. Service role only; application Live gate remains independently required.';
comment on function public.finish_own_learning_live_subscription_checkout(uuid,text,text) is
  'Completes only a Live-domain subscription checkout reservation; a provider response with an unknown outcome remains held for reconciliation.';

commit;
