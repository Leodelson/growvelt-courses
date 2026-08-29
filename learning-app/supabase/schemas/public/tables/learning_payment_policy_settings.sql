create table "public"."learning_payment_policy_settings" (
  "id"                                     boolean                  not null default true,
  "routine_refund_window_days"             integer                  not null default 14,
  "routine_refund_progress_percent"        numeric(5,2)             not null default 20,
  "customer_acknowledgement_business_days" integer                  not null default 1,
  "operator_review_business_days"          integer                  not null default 2,
  "dispute_review_business_hours"          integer                  not null default 4,
  "updated_at"                             timestamp with time zone not null default now(),
  "updated_by"                             uuid,
  constraint "learning_payment_policy_sett_customer_acknowledgement_bus_check"
    check (((customer_acknowledgement_business_days >= 1) AND (customer_acknowledgement_business_days <= 30))),
  constraint "learning_payment_policy_sett_dispute_review_business_hour_check" check (((dispute_review_business_hours >= 1) AND (dispute_review_business_hours <= 168))),
  constraint "learning_payment_policy_sett_operator_review_business_day_check" check (((operator_review_business_days >= 1) AND (operator_review_business_days <= 30))),
  constraint "learning_payment_policy_sett_routine_refund_progress_perc_check"
    check (((routine_refund_progress_percent >= (0)::numeric) AND (routine_refund_progress_percent <= (100)::numeric))),
  constraint "learning_payment_policy_settin_routine_refund_window_days_check" check (((routine_refund_window_days >= 0) AND (routine_refund_window_days <= 365))),
  constraint "learning_payment_policy_settings_id_check" check (id),
  constraint "learning_payment_policy_settings_pkey" primary key (id),
  constraint "learning_payment_policy_settings_updated_by_fkey" foreign key (updated_by) references public.profiles(id) on delete set null
);

alter table "public"."learning_payment_policy_settings"
  enable row level security;

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."learning_payment_policy_settings" to "postgres", "service_role";
