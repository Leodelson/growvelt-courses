create table "public"."learning_subscription_course_enrollment_sources" (
  "subscription_id"       uuid                     not null,
  "learner_id"             uuid                     not null,
  "course_id"              bigint                   not null,
  "enrollment_id"          bigint                   not null,
  "preexisting_access"     boolean                  not null,
  "granted_at"             timestamp with time zone not null default now(),
  constraint "learning_subscription_course_enrollment_sources_pkey"
    primary key (subscription_id, course_id),
  constraint "learning_subscription_course_enrollment_sources_subscription_id_fkey"
    foreign key (subscription_id) references public.learning_subscriptions(id) on delete restrict,
  constraint "learning_subscription_course_enrollment_sources_learner_id_fkey"
    foreign key (learner_id) references public.profiles(id) on delete restrict,
  constraint "learning_subscription_course_enrollment_sources_course_id_fkey"
    foreign key (course_id) references public.learning_courses(id) on delete restrict,
  constraint "learning_subscription_course_enrollment_source_enrollment_fkey"
    foreign key (enrollment_id, learner_id, course_id)
    references public.enrollments(id, learner_id, course_id) on delete restrict
);

alter table "public"."learning_subscription_course_enrollment_sources"
  enable row level security;

create index learning_subscription_course_enrollment_source_learner_idx
  on public.learning_subscription_course_enrollment_sources using btree (learner_id, course_id, enrollment_id);

create trigger prevent_learning_subscription_course_enrollment_source_mutation
  before update or delete on public.learning_subscription_course_enrollment_sources
  for each row
  execute function public.prevent_learning_subscription_course_enrollment_source_mutation();

create trigger grant_learning_subscription_invoice_course_access
  after update of status on public.learning_subscription_invoices
  for each row
  when ((old.status is distinct from new.status) and (new.status = 'paid'::text))
  execute function public.grant_learning_subscription_invoice_course_access();

revoke all on table "public"."learning_subscription_course_enrollment_sources"
  from "public", "anon", "authenticated", "service_role";
