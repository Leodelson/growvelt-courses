# Email Center CPU incident, 24 October 2026

The hosted database displayed 86.81% CPU for the selected three-hour report. Between 23:04:07 and 23:31:20 UTC on 23 October, the service-role PostgREST initialization statement increased by 3,053,669 calls. API Gateway showed only ordinary low-volume requests. Postgres logs repeatedly showed `Draft changed; reload it` inside `review_learning_email_center_draft`.

The application used SQLSTATE `40001` for permanent optimistic revision conflicts. The project runs PostgREST 14.5. Supabase documents that custom `40001` exceptions can trigger infinite internal retries in PostgREST 14: https://supabase.com/kb/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions

The owner approved repairing Email Center conflict codes and stopping only confirmed looping backends. Migration `20261111000000` changes the literal error code to `PT409` in eight explicitly named Email Center functions, retaining their current bodies, grants and security attributes. The API recognizes both codes during rollout.

The migration succeeded in the hosted Learning project. Verification at 00:25:56 UTC found zero remaining retriable custom codes in those eight functions and only two idle authenticator connections, one normal COMMIT and one LISTEN. No backend was terminated and no project restart was performed. At 00:32:05 UTC the service initialization counter was 27,064,937 and rollback count 27,065,547; a later sample is needed to quantify the post-repair rate and refreshed CPU chart.

Migration `20261110000000` for private submission alerts also succeeded. Both versions are recorded in the migration history. All four new tables have RLS enabled and deny anonymous/authenticated direct reads. Initial event and delivery counts were zero, confirming no historical backfill.

Local tests execute the migration and verify all eight functions use `PT409`, preserve service-only privileges, and reject a stale review with that exact code. The broadcast recovery suite passes, including lost-response handling and duplicate-send protection.

Follow-up for the paused Phase 6 work: older payment/test-fixture functions also contain custom `40001` exceptions. They were not changed in this targeted Email Center repair. Audit their permanent-conflict error codes with their financial regression suites before enabling payment flows.
