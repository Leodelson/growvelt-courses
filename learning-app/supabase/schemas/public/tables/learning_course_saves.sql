create table "public"."learning_course_saves" (
  "learner_id" uuid                     not null,
  "course_id"  bigint                   not null,
  "saved_at"   timestamp with time zone not null default now(),
  constraint "learning_course_saves_pkey" primary key (learner_id, course_id),
  constraint "learning_course_saves_course_id_fkey" foreign key (course_id) references public.learning_courses(id) on delete cascade,
  constraint "learning_course_saves_learner_id_fkey" foreign key (learner_id) references public.profiles(id) on delete cascade
);

alter table "public"."learning_course_saves"
  enable row level security;

create index learning_course_saves_learner_saved_at_idx on public.learning_course_saves using btree (learner_id, saved_at desc, course_id desc);

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."learning_course_saves" to "postgres", "service_role";
