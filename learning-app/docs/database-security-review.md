# Growvelt Learning Phase 0B database security review

Reviewed 2026-08-21 against the deployed project and the Phase 0A baseline.

## SECURITY DEFINER functions

All **68** public functions are `SECURITY DEFINER` and all set an explicit
`search_path` (`''`, except the DDL helper uses `pg_catalog`). The exact body,
signature, caller mapping and grant for every function are versioned in
`supabase/schemas/public/functions` and `docs/database-rpc-inventory.md`.

Execute-grant classification after Phase 0B:

- Anonymous plus authenticated (5):
  `can_read_learning_course_video_cover`,
  `get_own_or_published_learning_course_video_cover`,
  `search_public_published_learning_courses`,
  `submit_public_learning_inquiry`, and
  `verify_learning_certificate`. Each exposes an intentional public read or
  validated intake path. Draft/pending cover branches still require owner/admin
  identity.
- Authenticated plus server roles (59): authorization predicates, owner reads,
  learner mutations, instructor authoring/analytics, and admin moderation. The
  mutation functions derive the actor from `auth.uid()` and re-check ownership
  or capability internally.
- Server/internal only (4): `handle_new_growvelt_learning_profile`,
  `recompute_learning_enrollment_completion`,
  `validate_learning_course_quiz_readiness`, and `rls_auto_enable`. Phase 0B
  removed client execution from `rls_auto_enable`; the other three were already
  server-only.

### Authorization conclusions

- Admin moderation functions require a non-null `auth.uid()` and active admin
  capability internally.
- Instructor mutations require both approved-instructor state and course
  ownership. Child module/lesson/quiz mutations resolve ownership through the
  parent course rather than trusting an instructor ID parameter.
- Learner progress, quiz, save and certificate functions derive learner
  identity from `auth.uid()` and authoritative enrollment relationships.
- Quiz scoring is calculated from database options. Client input contains only
  question/option identifiers; cross-quiz pairs are rejected.
- Certificate issuance derives all snapshot fields from current authoritative
  rows and requires completed eligible enrollment. There is no client-supplied
  learner/course/instructor snapshot.
- Public certificate verification intentionally exposes only the verification
  projection. It does not grant table access.

No function required conversion away from `SECURITY DEFINER`; doing so would
break the intentionally RPC-only model without improving the tested boundary.

## Grants and RLS

All 24 public tables remain RLS-enabled; none is forced. `FORCE ROW LEVEL
SECURITY` was not enabled because the definer RPCs intentionally perform
privileged, internally authorized mutations. Forcing RLS without redesigning
function ownership would risk breaking enrollment, progress, quiz, moderation
and certificate flows.

Phase 0B removed `MAINTAIN`, `REFERENCES`, `TRIGGER`, and `TRUNCATE` from browser
roles on current public tables. These are not required by PostgREST and
`TRUNCATE` is not row-scoped by RLS. Default privileges for future public
tables, sequences and functions were also removed from `anon` and
`authenticated`; future migrations must grant their precise API surface.

Current application tables retain their existing column/table grants and RLS
policies. Legacy intake tables were reduced to intended insert-only access,
with published reviews read-only and legacy registrations readable only to the
authenticated admin policy.

## Storage

Both buckets remain private. Profile-media policies require the first path
segment to equal `auth.uid()`. Course-cover management requires an exact path,
approved instructor state, owned draft course and matching course ID. Published
cover reads and owner/admin private reads remain supported. Transactional
helper tests rejected a foreign instructor/path combination. No storage object
was enumerated, downloaded, created or modified during testing.

## Legacy classification

| Object | Classification | Reason |
|---|---|---|
| `course_contacts` | DEPRECATE | No current caller; retain insert-only intake temporarily |
| `course_leads` | DEPRECATE | No current caller; retain insert-only intake temporarily |
| `course_registrations` | REMOVE LATER | Historical payment-shaped intake, not current marketplace architecture; retain until explicit data/operations review |
| `partner_requests` | DEPRECATE | Replaced by validated unified inquiry RPC in current app |
| `course_reviews` | KEEP | Published review read model may be reused; current app has no write workflow |
| `get_own_enrolled_learning_course_by_slug` | DEPRECATE | Superseded by experience snapshot RPC |
| `get_own_enrolled_learning_course_progress_by_slug` | DEPRECATE | Superseded by experience/progress snapshot |
| `list_own_learning_course_progress` | DEPRECATE | No current caller |
| `list_own_learning_enrollments` | DEPRECATE | No current caller |

No legacy object was dropped in Phase 0B.

## Certificate retention

Issuance, ownership, uniqueness and public verification are appropriately
protected. The existing certificate foreign keys still cascade when a learner
or course is deleted. That is a retention/business-policy concern, not a
present authorization bypass; changing it requires a separately approved data
retention design and was intentionally deferred.

## Audit logging decision

No audit table was added. Instructor/course decisions currently retain reviewer
and timestamps on operational rows, but there is no append-only history for
capability changes, repeated moderation decisions, or future financial actions.
Adding a trustworthy immutable audit subsystem requires decisions about event
retention, actor/service attribution, redaction and who may read it. It should
be designed before financial work in a later approved security/retention phase,
not bolted onto Phase 0B RPCs speculatively.
