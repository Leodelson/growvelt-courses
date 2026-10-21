-- Operator-only rollback, not run automatically. Preserve all customer data,
-- quota settings/counters and existing grants; disable only this migration's
-- intake triggers. The compatible app error handling can remain deployed.
begin;
drop trigger if exists learning_public_intake_guard on public.newsletter_subscribers;
drop trigger if exists learning_public_intake_guard on public.learning_public_inquiries;
commit;
