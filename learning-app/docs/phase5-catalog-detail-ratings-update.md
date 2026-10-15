# Phase 5 — Explore, course details and learner ratings

## Implemented
- Public `/learn` and dashboard `/dashboard/explore` share the same redesigned catalog: topic shortcuts, working filters, compact course cards and keyboard/touch-scrollable shelves. Sparse subjects are combined rather than displaying mostly empty rows. Filtered results retain a responsive grid and existing pagination/search.
- Both `/courses/[slug]` and `/dashboard/courses/[slug]`: cover-led course introduction, instructor identity, real rating aggregate, course facts, section anchors, original overview/outline and access actions, plus up to four public related courses. The current course is excluded; same-category courses precede recent alternatives. No private/test content is exposed through recommendations.
- Eligible learners can submit/update 1–5 stars on `/dashboard/my-learning/[slug]`, during learning or after completion. One rating per learner/course; instructors cannot rate their own course. Database checks use the existing unified access predicate, including subscription validity. No client-supplied learner identity is accepted. Only aggregates are public. Existing `course_reviews` records remain untouched; this feature uses its own star-only table.
- Additive migration `20261102000000_add_enrolled_learner_course_ratings.sql` applied successfully to linked Learning project `qtcpjcaoptdunuefwvgc`, after confirming the linked reference and dry-run showing exactly that migration. No resets, fixture writes, payment changes or Docker changes.
- New presentation copy supports English, French and Spanish.

## Additional requested corrections
- Homepage decorative video requests no picture-in-picture or remote playback, suppresses media controls and ignores pointer input; retains inline muted playback and reduced-motion/data-saver behavior. Browser settings/extensions may override a site's PiP request.
- Revised repetitive “clear” marketing, dashboard and form copy without renaming identifiers or breaking existing URLs. “Carry your proof forward” becomes “Earn a verifiable certificate”. Existing legal terms are not changed.
- Teach opening and FAQ no longer repeat the Teach eyebrow; the main introduction retains a single context label.
- Signed-out `/teach/apply` visits now go to Create account with a safe return path and Teach selected. Learners can select Learn instead, and existing account holders can choose Sign in. Signed-in teaching applicants continue to the existing application; other protected routes still go to Sign in.

## Verification
- Production Next build and TypeScript passed.
- In-memory PostgreSQL rating tests: grants, invalid inputs, own-read privacy, enrollment/expired-access denial, instructor self-rating denial, private/test/draft aggregate isolation, update uniqueness and aggregate accuracy.
- Render-only presentation tests: all three locales, real/unrated display, escaped content, accessible star selection, catalog routes, sparse grouping and course section links.
- Isolated teaching-entry tests: guest signup routing, signed-in continuation, safe next path and visible Learn/Teach options. Auth session regression tests passed.
- Existing homepage motion and Home/Teach opening regression tests passed, including PiP suppression attributes.
- Browser testing uses read-only hosted catalog data. No synthetic hosted learner/rating/Auth/Storage writes were performed. The default environment remains hosted; local write tests must explicitly use local URL and keys.

## Next verification by the owner
Open My Learning → an enrolled course → “How is this course?” and save a genuine rating. Confirm the aggregate on Explore/course details. No rating was submitted on the owner's behalf.

Preserve the existing unrelated earnings, enterprise-doc, PWA, UI-review, image and build-cache work. No roadmap phase or security gate is marked complete by this visual update.
