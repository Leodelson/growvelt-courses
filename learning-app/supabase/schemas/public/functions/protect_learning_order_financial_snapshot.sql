create or replace function public.protect_learning_order_financial_snapshot()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  if old.order_reference is distinct from new.order_reference or old.learner_reference is distinct from new.learner_reference
    or old.course_title_snapshot is distinct from new.course_title_snapshot or old.instructor_name_snapshot is distinct from new.instructor_name_snapshot
    or old.gross_amount_minor is distinct from new.gross_amount_minor or old.currency is distinct from new.currency
    or old.commercial_terms_version is distinct from new.commercial_terms_version
    or (old.learner_id is distinct from new.learner_id and new.learner_id is not null)
    or (old.course_id is distinct from new.course_id and new.course_id is not null)
    or (old.instructor_id is distinct from new.instructor_id and new.instructor_id is not null)
  then raise exception 'Learning order financial snapshots are immutable' using errcode = '42501'; end if;
  if old.status is distinct from new.status and not (
    (old.status = 'created' and new.status in ('payment_pending', 'cancelled'))
    or (old.status = 'payment_pending' and new.status in ('paid', 'cancelled'))
    or (old.status = 'paid' and new.status in ('partially_refunded', 'refunded', 'chargeback'))
    or (old.status = 'partially_refunded' and new.status in ('refunded', 'chargeback'))
    or (old.status = 'refunded' and new.status = 'chargeback')
  ) then raise exception 'Unsupported learning order status transition' using errcode = '22023'; end if;
  new.updated_at := now(); return new;
end;
$function$;
revoke all on function public.protect_learning_order_financial_snapshot() from public, anon, authenticated;
grant execute on function public.protect_learning_order_financial_snapshot() to postgres, service_role;
