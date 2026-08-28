create table "public"."profiles" (
  "id"                  uuid                     not null,
  "full_name"           text,
  "email"               text,
  "account_type"        text                     not null default 'learner'::text,
  "avatar_url"          text,
  "onboarding_status"   text                     not null default 'pending'::text,
  "created_at"          timestamp with time zone not null default now(),
  "updated_at"          timestamp with time zone not null default now(),
  "avatar_storage_path" text,
  "cover_storage_path"  text,
  "linkedin_url"        text,
  "website_url"         text,
  "instagram_url"       text,
  "facebook_url"        text,
  "x_url"               text,
  constraint "profiles_account_type_check" check ((account_type = ANY (ARRAY['learner'::text, 'instructor'::text, 'admin'::text]))),
  constraint "profiles_id_fkey" foreign key (id) references auth.users(id) on delete cascade,
  constraint "profiles_onboarding_status_check" check ((onboarding_status = ANY (ARRAY['pending'::text, 'complete'::text]))),
  constraint "profiles_pkey" primary key (id)
);

alter table "public"."profiles"
  enable row level security;

create trigger apply_learning_account_deletion_retention
  before delete on public.profiles
  for each row
  execute function public.apply_learning_account_deletion_retention();

create policy "Profiles are created by owner" on "public"."profiles"
  for insert
  to "authenticated"
  with check (((auth.uid() = id) AND (account_type = 'learner'::text)));

create policy "Profiles are readable by owner" on "public"."profiles"
  for select
  to "authenticated"
  using ((auth.uid() = id));

create policy "Profiles are updated by owner" on "public"."profiles"
  for update
  to "authenticated"
  using ((auth.uid() = id))
  with check ((auth.uid() = id));

grant select on table "public"."profiles" to "anon";

grant update ("avatar_storage_path") on table "public"."profiles" to "authenticated";

grant insert ("avatar_url"), update ("avatar_url") on table "public"."profiles" to "authenticated";

grant update ("cover_storage_path") on table "public"."profiles" to "authenticated";

grant insert ("email") on table "public"."profiles" to "authenticated";

grant update ("facebook_url") on table "public"."profiles" to "authenticated";

grant insert ("full_name"), update ("full_name") on table "public"."profiles" to "authenticated";

grant insert ("id") on table "public"."profiles" to "authenticated";

grant update ("instagram_url") on table "public"."profiles" to "authenticated";

grant update ("linkedin_url") on table "public"."profiles" to "authenticated";

grant insert ("onboarding_status"), update ("onboarding_status") on table "public"."profiles" to "authenticated";

grant update ("website_url") on table "public"."profiles" to "authenticated";

grant update ("x_url") on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."profiles" to "postgres", "service_role";

comment on column "public"."profiles"."facebook_url" is 'Optional public Facebook profile URL selected by the account owner.';

comment on column "public"."profiles"."instagram_url" is 'Optional public Instagram profile URL selected by the account owner.';

comment on column "public"."profiles"."linkedin_url" is 'Optional public LinkedIn profile URL selected by the account owner.';

comment on column "public"."profiles"."website_url" is 'Optional public professional website or portfolio URL selected by the account owner.';

comment on column "public"."profiles"."x_url" is 'Optional public X or Twitter profile URL selected by the account owner.';
