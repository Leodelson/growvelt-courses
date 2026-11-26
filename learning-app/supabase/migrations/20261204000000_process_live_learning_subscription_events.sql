-- Extend the verified subscription event processor to Live records while
-- preserving strict separation from Test plans, invoices, and provider events.
begin;

do $migration$
declare
  function_definition text;
begin
  select pg_get_functiondef(
    'public.receive_learning_subscription_provider_event(text,text,text,jsonb,uuid,uuid,text)'::regprocedure
  ) into function_definition;
  if function_definition is null
    or strpos(function_definition, 'if p_payment_domain is distinct from ''test'' then') = 0
    or strpos(function_definition, 'true, ''test'', p_subscription_id, resolved_invoice_id') = 0 then
    raise exception 'Subscription event receipt source changed; review before applying Live event support';
  end if;

  function_definition := replace(function_definition,
    'if p_payment_domain is distinct from ''test'' then',
    'if p_payment_domain is null or p_payment_domain not in (''test'', ''live'') then');
  function_definition := replace(function_definition,
    'where subscription.id = p_subscription_id',
    'where subscription.id = p_subscription_id and subscription.payment_domain = p_payment_domain');
  function_definition := replace(function_definition,
    'Subscription provider event has no matching subscription',
    'Subscription provider event has no matching subscription domain');
  function_definition := replace(function_definition,
    E'where invoice.subscription_id = p_subscription_id\n      and (',
    E'where invoice.subscription_id = p_subscription_id and invoice.payment_domain = p_payment_domain\n      and (');
  function_definition := replace(function_definition,
    'where invoice.id = resolved_invoice_id and invoice.subscription_id = p_subscription_id',
    'where invoice.id = resolved_invoice_id and invoice.subscription_id = p_subscription_id and invoice.payment_domain = p_payment_domain');
  function_definition := replace(function_definition,
    'where event.provider_event_id = p_provider_event_id',
    'where event.provider_event_id = p_provider_event_id and event.payment_domain = p_payment_domain');
  function_definition := replace(function_definition,
    'true, ''test'', p_subscription_id, resolved_invoice_id',
    'true, p_payment_domain, p_subscription_id, resolved_invoice_id');

  if strpos(function_definition, 'p_payment_domain not in (''test'', ''live'')') = 0
    or strpos(function_definition, 'subscription.payment_domain = p_payment_domain') = 0
    or strpos(function_definition, 'invoice.payment_domain = p_payment_domain') = 0
    or strpos(function_definition, 'event.payment_domain = p_payment_domain') = 0
    or strpos(function_definition, 'true, p_payment_domain, p_subscription_id, resolved_invoice_id') = 0 then
    raise exception 'Live subscription event receipt isolation could not be verified';
  end if;
  execute function_definition;
end;
$migration$;

do $migration$
declare
  function_definition text;
begin
  select pg_get_functiondef('public.process_learning_subscription_provider_event(bigint,jsonb)'::regprocedure)
    into function_definition;
  if function_definition is null
    or strpos(function_definition, 'event_row.payment_domain <> ''test''') = 0
    or strpos(function_definition, 'verified ->> ''domain'' is distinct from ''test''') = 0
    or strpos(function_definition, 'provider_reference, provider_invoice_code,') = 0 then
    raise exception 'Subscription event processor source changed; review before applying Live event processing';
  end if;

  function_definition := replace(function_definition,
    'event_row.payment_domain <> ''test''',
    'event_row.payment_domain not in (''test'', ''live'')');
  function_definition := replace(function_definition,
    'Only signature-verified Test Mode events may be processed',
    'Only signature-verified subscription events may be processed');
  function_definition := replace(function_definition,
    'where subscription.id = event_row.subscription_id',
    'where subscription.id = event_row.subscription_id and subscription.payment_domain = event_row.payment_domain');
  function_definition := replace(function_definition,
    'Subscription provider event has no matching subscription',
    'Subscription provider event has no matching subscription domain');
  function_definition := replace(function_definition,
    'from public.learning_subscription_plans plan where plan.id = subscription_row.plan_id;',
    'from public.learning_subscription_plans plan where plan.id = subscription_row.plan_id and plan.payment_domain = event_row.payment_domain;');
  function_definition := replace(function_definition,
    E'where invoice.subscription_id = subscription_row.id\n      and invoice.provider_invoice_code = event_invoice_code',
    E'where invoice.subscription_id = subscription_row.id and invoice.payment_domain = event_row.payment_domain\n      and invoice.provider_invoice_code = event_invoice_code');
  function_definition := replace(function_definition,
    'provider_reference, provider_invoice_code,',
    'provider_reference, provider_invoice_code, payment_domain,');
  function_definition := replace(function_definition,
    'event_invoice_code,',
    'event_invoice_code, event_row.payment_domain,');
  function_definition := replace(function_definition,
    'where invoice.id = event_row.invoice_id and invoice.subscription_id = subscription_row.id',
    'where invoice.id = event_row.invoice_id and invoice.subscription_id = subscription_row.id and invoice.payment_domain = event_row.payment_domain');
  function_definition := replace(function_definition,
    'verified ->> ''domain'' is distinct from ''test''',
    'verified ->> ''domain'' is distinct from event_row.payment_domain');
  function_definition := replace(function_definition,
    'matching verified Test Mode transaction',
    'matching verified provider-domain transaction');

  if strpos(function_definition, 'event_row.payment_domain not in (''test'', ''live'')') = 0
    or strpos(function_definition, 'subscription.payment_domain = event_row.payment_domain') = 0
    or strpos(function_definition, 'plan.payment_domain = event_row.payment_domain') = 0
    or strpos(function_definition, 'invoice.payment_domain = event_row.payment_domain') = 0
    or strpos(function_definition, 'provider_invoice_code, payment_domain,') = 0
    or strpos(function_definition, 'event_invoice_code, event_row.payment_domain,') = 0
    or strpos(function_definition, 'verified ->> ''domain'' is distinct from event_row.payment_domain') = 0 then
    raise exception 'Live subscription event processor isolation could not be verified (guard %, subscription %, plan %, invoice %, column %, value %, transaction domain %)',
      strpos(function_definition, 'event_row.payment_domain not in (''test'', ''live'')') > 0,
      strpos(function_definition, 'subscription.payment_domain = event_row.payment_domain') > 0,
      strpos(function_definition, 'plan.payment_domain = event_row.payment_domain') > 0,
      strpos(function_definition, 'invoice.payment_domain = event_row.payment_domain') > 0,
      strpos(function_definition, 'provider_invoice_code, payment_domain,') > 0,
      strpos(function_definition, 'event_invoice_code, event_row.payment_domain,') > 0,
      strpos(function_definition, 'verified ->> ''domain'' is distinct from event_row.payment_domain') > 0;
  end if;
  execute function_definition;
end;
$migration$;

do $migration$
declare
  function_definition text;
begin
  select pg_get_functiondef('public.grant_learning_subscription_invoice_course_access()'::regprocedure)
    into function_definition;
  if function_definition is null
    or strpos(function_definition, 'subscription_row.payment_domain <> ''test''') = 0 then
    raise exception 'Subscription access trigger changed; review before allowing Live paid periods';
  end if;
  function_definition := replace(function_definition,
    'subscription_row.payment_domain <> ''test''',
    'subscription_row.payment_domain not in (''test'', ''live'') or new.payment_domain is distinct from subscription_row.payment_domain');
  function_definition := replace(function_definition,
    'Paid subscription invoice has no matching Test Mode learner subscription',
    'Paid subscription invoice has no matching learner and payment domain');
  if strpos(function_definition, 'new.payment_domain is distinct from subscription_row.payment_domain') = 0 then
    raise exception 'Subscription access trigger domain matching could not be verified';
  end if;
  execute function_definition;
end;
$migration$;

do $migration$
declare
  function_definition text;
begin
  select pg_get_functiondef('public.has_own_learning_course_access(uuid,bigint)'::regprocedure)
    into function_definition;
  if function_definition is null
    or strpos(function_definition, 'invoice.payment_domain = ''test''') = 0
    or strpos(function_definition, 'subscription.payment_domain = ''test''') = 0 then
    raise exception 'Subscription access projection changed; review before allowing Live paid periods';
  end if;
  function_definition := replace(function_definition,
    'invoice.payment_domain = ''test''',
    'invoice.payment_domain = subscription.payment_domain and invoice.payment_domain in (''test'', ''live'')');
  function_definition := replace(function_definition,
    'subscription.payment_domain = ''test''',
    'subscription.payment_domain in (''test'', ''live'')');
  if strpos(function_definition, 'invoice.payment_domain = subscription.payment_domain') = 0
    or strpos(function_definition, 'subscription.payment_domain in (''test'', ''live'')') = 0 then
    raise exception 'Subscription access projection domain matching could not be verified';
  end if;
  execute function_definition;
end;
$migration$;

commit;
