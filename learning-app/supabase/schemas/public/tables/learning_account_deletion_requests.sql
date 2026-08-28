create table "public"."learning_account_deletion_requests" (
  "user_id"            uuid                     not null,
  "certificate_choice" text                     not null,
  "requested_at"       timestamp with time zone not null default now(),
  constraint "learning_account_deletion_requests_certificate_choice_check" check ((certificate_choice = ANY (ARRAY['keep_verifiable'::text, 'remove_public_verification'::text]))),
  constraint "learning_account_deletion_requests_pkey" primary key (user_id),
  constraint "learning_account_deletion_requests_user_id_fkey" foreign key (user_id) references public.profiles(id) on delete cascade
);

alter table "public"."learning_account_deletion_requests"
  enable row level security;

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."learning_account_deletion_requests" to "postgres", "service_role";
