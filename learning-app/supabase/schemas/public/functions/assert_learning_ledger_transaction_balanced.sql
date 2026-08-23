create or replace function public.assert_learning_ledger_transaction_balanced()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare transaction_key bigint; ledger_currency text; entry_count integer; net_amount bigint;
begin
  if tg_table_name = 'learning_ledger_transactions' then transaction_key := new.id;
  elsif tg_op = 'DELETE' then transaction_key := old.transaction_id;
  else transaction_key := new.transaction_id;
  end if;
  select currency into ledger_currency from public.learning_ledger_transactions where id = transaction_key;
  select count(*)::integer, coalesce(sum(amount_minor), 0)::bigint into entry_count, net_amount
  from public.learning_ledger_entries where transaction_id = transaction_key;
  if ledger_currency is null or entry_count < 2 or net_amount <> 0
    or exists (select 1 from public.learning_ledger_entries where transaction_id = transaction_key and currency <> ledger_currency)
  then raise exception 'Ledger transaction must contain at least two balanced entries in one currency' using errcode = '23514'; end if;
  return new;
end;
$function$;
revoke all on function public.assert_learning_ledger_transaction_balanced() from public, anon, authenticated;
grant execute on function public.assert_learning_ledger_transaction_balanced() to postgres, service_role;
