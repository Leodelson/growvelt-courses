# Growvelt Learning database architecture

Status: Phase 0A production baseline captured 2026-08-20.

This document describes the deployed Growvelt Learning database represented by
`supabase/schemas`. It is not a future architecture proposal.

## Authentication and profiles

Supabase Auth owns `auth.users`. A database trigger calls
`handle_new_growvelt_learning_profile` to create the matching `public.profiles`
row. `profiles.id` references `auth.users.id` with `ON DELETE CASCADE`.

The base profile defaults to `account_type = learner`. Instructor and admin
authority is not derived from that label alone. Active capability records live
in `account_capabilities`, keyed by `(user_id, capability)`, with capability
values `instructor` or `admin` and lifecycle states active, suspended or
revoked.

`has_growvelt_learning_capability`, `is_approved_growvelt_instructor`, and
`is_growvelt_learning_admin` are the authoritative application predicates.

## Instructor approval

An authenticated owner submits one `instructor_profiles` record. RLS restricts
creation to the caller's user ID and requires a pending, unreviewed application
with validated application fields. Owners can read their application and edit
it only while pending. Admins can read applications through the admin predicate.

`review_instructor_application` records the decision and grants/revokes the
instructor capability. Instructor application and capability records cascade
when the profile is deleted.

## Courses and ownership

`learning_courses.instructor_id` references `profiles.id`. Current ownership is
one individual instructor per course. Course states are draft, pending_review,
published and archived. Published rows are publicly readable; authoring and
moderation changes are performed through security-definer RPCs.

Curriculum is:

```text
learning_courses
  -> course_modules
    -> lessons
      -> quiz_lessons
        -> quiz_questions
          -> quiz_options
```

Course submission records an immutable-version rights declaration in
`course_rights_declarations`. A status trigger validates quiz readiness before a
course enters review.

## Enrollment and learning progress

`enrollments` is unique by `(learner_id, course_id)`. Current statuses are
active, completed and cancelled. Free enrollment is created only by
`enroll_in_free_learning_course`, which rechecks published/free/zero-price NGN
state inside the database.

`lesson_progress` belongs to an enrollment and lesson. Learners can read only
progress associated with their own enrollment. Completion is recalculated by
`recompute_learning_enrollment_completion`.

Quiz attempts use `quiz_attempts` and `quiz_attempt_answers`. Composite foreign
keys tie the attempt to the authoritative enrollment, learner, course, quiz,
question and selected option. `submit_own_quiz_attempt` scores answers in the
database; correct options are not trusted from the browser.

## Certificates

`certificates` is unique by certificate code and by learner/course. It stores
learner, course and instructor names as issuance snapshots, plus completion and
issue timestamps. Status is issued or revoked, with a constraint requiring a
revocation timestamp for revoked certificates.

`issue_own_learning_certificate` requires the caller's completed enrollment and
rechecks eligibility. It generates a 32-character uppercase UUID-derived code.
`verify_learning_certificate` exposes only public verification data.

## Saved courses and inquiries

`learning_course_saves` is keyed by learner/course and is mutated through an
owner-scoped RPC. Public contact and partnership forms write to
`learning_public_inquiries` through a validated RPC.

The database also contains older or currently unused public-intake tables:
`course_contacts`, `course_leads`, `course_registrations`, `partner_requests`
and `course_reviews`. They are not called by the current Learning application.
`course_registrations` includes historical PayPal/Paystack-oriented columns;
their presence is not an active payment implementation.

## RLS and grants

All 24 captured public tables have RLS enabled. None is forced. Direct learner
table access is predominantly read-only; business mutations use narrowly
granted security-definer functions with explicit empty or `pg_catalog`
`search_path` settings. Public catalog policies expose only published courses,
published modules, preview lessons and published reviews.

An event trigger named `ensure_rls` invokes `rls_auto_enable` after public-table
creation. It automatically enables RLS but does not create policies.

See the individual table/function files under `supabase/schemas` for exact
constraints, policies, grants and SQL bodies.

## Storage

Both buckets are private:

- `learning-profile-media`: 5 MiB, JPEG/PNG/WebP. Owners access paths whose first
  folder equals `auth.uid()`; display uses signed URLs.
- `learning-course-video-covers`: 1 MiB, JPEG/WebP. Access is delegated to
  `can_manage_learning_course_video_cover` and
  `can_read_learning_course_video_cover`; display uses signed URLs.

The exact deployed policies are recorded in
`supabase/baseline/storage-security.snapshot.sql`.

## Baseline and future migrations

The declarative tree is a reference snapshot and must not be pushed to the live
project. Future approved changes should be forward-only timestamped migrations
under `supabase/migrations`, reviewed against this baseline. Phase 0A does not
introduce future provider, payment, payout or organization models.
