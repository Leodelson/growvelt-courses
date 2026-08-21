# Growvelt Learning Phase 0B security matrix

Status: reviewed against the Phase 0A production baseline on 2026-08-21.

This matrix records the expected database boundary. Tests must exercise the
database/RPC layer, not merely UI route guards.

| Actor | Operation | Expected database result | Enforcement |
|---|---|---|---|
| Learner | Read/update own profile | Allow only permitted profile columns | profile RLS + column grants |
| Learner | Read/update another profile | Deny/no rows | profile RLS using `auth.uid()` |
| Learner | Free-enroll in published zero-price course | Allow; duplicate request idempotent | `enroll_in_free_learning_course` + unique learner/course |
| Learner | Free-enroll in paid, unpublished, archived, limited-time-free, or invalid course | Reject | authoritative RPC course checks |
| Learner | Read own enrollment/progress/saves/certificates | Allow | owner RLS or owner-scoped RPC |
| Learner | Read/mutate another learner's enrollment/progress/saves/certificates | Deny/no rows | RLS + RPC derives learner from `auth.uid()` |
| Learner | Read published preview lesson anonymously | Allow | lesson preview policy |
| Learner | Read non-preview lesson without enrollment | Deny | lesson/resource RLS and learner snapshot RPC |
| Learner | Complete own enrolled text/video lesson | Allow | `complete_own_enrolled_lesson` relationship checks |
| Learner | Complete another learner's or foreign-course lesson | Reject | enrollment is selected by `auth.uid()` |
| Learner | Submit own quiz answers | Allow and score server-side | `submit_own_quiz_attempt` |
| Learner | Supply score, foreign question/option/quiz/enrollment | Reject/ignore client score | composite relationships + RPC validation |
| Learner | Read correct answers before submission | Deny | quiz authoring tables have no client grants |
| Learner | Issue own eligible certificate | Allow once | completed enrollment + eligibility + unique learner/course |
| Learner | Issue early/for another learner/control snapshots | Reject | issuance derives identity and snapshot values in database |
| Instructor applicant | Submit own application | Allow pending record | instructor-profile RLS |
| Instructor applicant | Edit own pending application | Allow approved input columns only | RLS + column grants |
| Instructor applicant | Edit approved/rejected state or review fields | Deny | policy/column grants; admin RPC owns transition |
| Pending/rejected user | Use instructor mutation RPC | Reject | active capability + approved application predicate |
| Approved instructor | Create/edit/submit/archive/restore own course | Allow by lifecycle rules | instructor RPC ownership and status checks |
| Approved instructor | Mutate another instructor's course/modules/lessons/quizzes/cover | Reject | every authoring RPC joins course owner to `auth.uid()` |
| Approved instructor | Read another instructor's private analytics | Reject | analytics RPC scopes to `auth.uid()` |
| Approved instructor | Manage own draft course cover path | Allow | private bucket policy + course/path helper |
| Learner/foreign instructor | Manage another course cover | Reject | `can_manage_learning_course_video_cover` |
| Normal user | Insert/update/delete capability | Deny | no client table privileges or policies |
| Normal user | Become admin/instructor by profile account label | Deny | authority comes from active capabilities, not profile label |
| Normal user/instructor | Execute moderation RPC | Reject | internal `is_growvelt_learning_admin()` check |
| Admin | Review pending instructor/course | Allow | active admin capability + RPC lifecycle checks |
| Anonymous | Read published course/catalog/public certificate verification | Allow only public projection | public policies/RPCs |
| Anonymous | Enumerate private learner/application/content rows | Deny/no rows | RLS and absent grants |
| Anonymous | Submit validated public inquiry/newsletter/legacy intake | Allow intended insert only | validation RPC or insert-only RLS/grant |
| Anonymous | Update/delete intake records | Deny | insert-only policy and narrowed grants |

## Hostile input cases

The negative suite covers foreign user, course, module, lesson, quiz,
enrollment and certificate identifiers; invalid status/order values; foreign
quiz question/option pairs; manipulated free-course state; and attempts to
pass authority identifiers. Authoritative identity must always come from
`auth.uid()` and authoritative ownership from database relationships.

## Storage cases

- `learning-profile-media`: first path segment must equal `auth.uid()` for all
  owner operations; anonymous listing is denied.
- `learning-course-video-covers`: path is exactly
  `<instructor uuid>/<owned draft course id>/course-video-cover`; only an
  approved owner can manage it. Published cover reads remain available through
  the read helper, while draft/pending reads remain owner/admin scoped.
