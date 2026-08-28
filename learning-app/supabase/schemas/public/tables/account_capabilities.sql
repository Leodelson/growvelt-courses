create table "public"."account_capabilities" (
  "user_id"    uuid                     not null,
  "capability" text                     not null,
  "status"     text                     not null default 'active'::text,
  "granted_at" timestamp with time zone not null default now(),
  "granted_by" uuid,
  "revoked_at" timestamp with time zone,
  "revoked_by" uuid,
  "reason"     text,
  constraint "account_capabilities_capability_check" check ((capability = ANY (ARRAY['instructor'::text, 'admin'::text]))),
  constraint "account_capabilities_pkey" primary key (user_id, capability),
  constraint "account_capabilities_status_check" check ((status = ANY (ARRAY['active'::text, 'suspended'::text, 'revoked'::text]))),
  constraint "account_capabilities_status_lifecycle_check"
    check
    ((((status = 'active'::text) AND (revoked_at IS NULL) AND (revoked_by IS NULL) AND (reason IS NULL)) OR ((status = 'suspended'::text) AND (revoked_at IS NULL)) OR ((status =
    'revoked'::text) AND (revoked_at IS NOT NULL)))),
  constraint "account_capabilities_granted_by_fkey" foreign key (granted_by) references public.profiles(id) on delete set null,
  constraint "account_capabilities_revoked_by_fkey" foreign key (revoked_by) references public.profiles(id) on delete set null,
  constraint "account_capabilities_user_id_fkey" foreign key (user_id) references public.profiles(id) on delete cascade
);

alter table "public"."account_capabilities"
  enable row level security;

create trigger audit_learning_capability_change
  after insert or update of status on public.account_capabilities
  for each row
  execute function public.capture_learning_security_audit_event('capability.changed', 'account_capability');

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."account_capabilities" to "postgres", "service_role";
