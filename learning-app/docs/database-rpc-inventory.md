# Growvelt Learning RPC inventory

Captured from project `qtcpjcaoptdunuefwvgc` on 2026-08-20. Every application
RPC listed below has a matching SQL definition under
`supabase/schemas/public/functions`.

## Application-called RPCs

| Area | RPCs | Main callers | Capture |
|---|---|---|---|
| Authorization | `is_approved_growvelt_instructor`, `is_growvelt_learning_admin` | `app/lib/instructor/authorization.ts`, `app/lib/admin/authorization.ts` | Captured |
| Public catalog | `list_published_learning_courses`, `search_public_published_learning_courses`, `get_published_learning_course_by_slug` | `app/lib/catalog/published-courses.ts`, public catalog, sitemap | Captured |
| Free enrollment | `get_own_learning_enrollment_state`, `enroll_in_free_learning_course` | enrollment library/button | Captured |
| Learning overview | `list_own_learning_course_experience`, `get_own_enrolled_learning_course_experience_by_slug` | `app/lib/learning/enrollments.ts` | Captured |
| Lessons | `get_own_enrolled_lesson_snapshot`, `complete_own_enrolled_lesson` | lesson player/completion button | Captured |
| Learner quizzes | `get_own_enrolled_quiz_snapshot`, `submit_own_quiz_attempt` | quiz library/player | Captured |
| Saved courses | `get_own_saved_learning_course_ids`, `list_own_saved_learning_courses`, `toggle_own_learning_course_save` | saved-course library/button | Captured |
| Certificates | `get_own_learning_certificate_state`, `issue_own_learning_certificate`, `list_own_learning_certificates`, `get_own_learning_certificate`, `verify_learning_certificate` | learner certificate pages and public verification | Captured |
| Instructor course list | `list_own_instructor_courses`, `search_own_instructor_courses`, `get_own_instructor_course` | instructor course library | Captured |
| Course lifecycle | `create_instructor_course_draft`, `update_instructor_course_draft`, `submit_learning_course_for_review`, `archive_own_instructor_course`, `restore_own_instructor_course`, `delete_own_instructor_draft` | course forms/actions | Captured |
| Curriculum | `get_own_instructor_curriculum`, `add_instructor_course_module`, `update_instructor_course_module`, `delete_instructor_course_module`, `move_instructor_course_module`, `add_instructor_course_lesson`, `update_instructor_course_lesson`, `delete_instructor_course_lesson`, `move_instructor_course_lesson` | curriculum library/editor | Captured |
| Quiz authoring | `get_own_instructor_quiz_authoring`, `upsert_instructor_quiz_configuration`, `upsert_instructor_quiz_question`, `delete_instructor_quiz_question`, `move_instructor_quiz_question` | curriculum editor | Captured |
| Course covers | `set_own_instructor_course_video_cover`, `get_own_or_published_learning_course_video_cover` | cover upload and signed-cover API | Captured |
| Instructor analytics | `get_own_instructor_learning_analytics` | instructor analytics library | Captured |
| Instructor moderation | `list_pending_instructor_applications`, `search_pending_instructor_applications`, `get_instructor_application_for_review`, `review_instructor_application` | admin instructor queue/forms | Captured |
| Course moderation | `list_pending_learning_courses`, `search_pending_learning_courses`, `get_learning_course_for_review`, `get_learning_course_quiz_for_review`, `review_learning_course` | admin course queue/forms | Captured |
| Public inquiry | `submit_public_learning_inquiry` | `app/api/inquiries/route.ts` | Captured |

Application-called total: **57**. Missing deployed definitions: **0**.

## Database functions not called directly by application code

These 11 functions are present and captured:

- `can_manage_learning_course_video_cover`: storage-policy ownership helper.
- `can_read_learning_course_video_cover`: storage-policy visibility helper.
- `get_own_enrolled_learning_course_by_slug`: older/compatibility learner read.
- `get_own_enrolled_learning_course_progress_by_slug`: older progress read.
- `handle_new_growvelt_learning_profile`: Auth user creation trigger.
- `has_growvelt_learning_capability`: authorization predicate helper.
- `list_own_learning_course_progress`: older progress listing.
- `list_own_learning_enrollments`: older enrollment listing.
- `recompute_learning_enrollment_completion`: internal completion helper.
- `rls_auto_enable`: DDL event-trigger function.
- `validate_learning_course_quiz_readiness`: course-status trigger function.

These are not automatically dead code: several are invoked by triggers, storage
policies or other functions. The four older learner read/list functions have no
current application caller and should be reviewed in Phase 0B before removal.

## Direct table and bucket access

The application directly accesses `profiles`, `instructor_profiles`, and
`newsletter_subscribers`. Other learning-domain mutations/read models are
primarily RPC-backed. Storage callers use `learning-profile-media` and
`learning-course-video-covers`; both bucket names and their policies match the
deployed project.
