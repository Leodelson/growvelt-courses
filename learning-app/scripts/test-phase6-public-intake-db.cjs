/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const read = relative => readFileSync(path.join(__dirname, '..', relative), 'utf8');
const migration = read('supabase/migrations/20261106000000_add_public_intake_quotas.sql');

async function main() {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    await db.exec(read('supabase/schemas/public/tables/newsletter_subscribers.sql'));
    await db.exec(read('supabase/schemas/public/tables/learning_public_inquiries.sql'));
    await db.exec(read('supabase/schemas/public/functions/submit_public_learning_inquiry.sql'));
    await db.exec("insert into public.newsletter_subscribers(email,source_page,created_at) values ('LEGACY@EXAMPLE.INVALID','original-source','2020-01-01')");
    const legacy = (await db.query('select email,source_page,created_at from public.newsletter_subscribers')).rows[0];
    await db.exec(migration);
    await db.exec("update public.learning_public_intake_limits set hourly_limit=199 where kind='newsletter'");
    await db.exec(migration);
    assert.equal((await db.query("select hourly_limit from public.learning_public_intake_limits where kind='newsletter'")).rows[0].hourly_limit, 199, 'reapply preserves operator settings');
    const original = (await db.query('select email,source_page,created_at from public.newsletter_subscribers')).rows[0];
    assert.equal(original.email, 'LEGACY@EXAMPLE.INVALID');
    assert.equal(original.source_page, 'original-source');
    assert.deepEqual(original, legacy, 'migration never rewrites existing subscriber records');

    const count = async table => Number((await db.query(`select count(*) as n from public.${table}`)).rows[0].n);
    const snapshot = async () => (await db.query('select * from public.learning_public_intake_counters order by kind,subject_key,window_seconds,window_start')).rows;
    const submit = async email => db.query("select * from public.submit_public_learning_inquiry('contact','Example',$1,'Course help','Please help me find the course material I enrolled in.',null,null,null)", [email]);
    const rejected = async (operation, code) => assert.rejects(operation, error => error.code === code);
    const reset = async (kind, hour, day, emailHour, emailDay) => {
      await db.exec('reset role; truncate public.learning_public_intake_counters, public.newsletter_subscribers, public.learning_public_inquiries;');
      await db.query('update public.learning_public_intake_limits set hourly_limit=$2,daily_limit=$3,email_hourly_limit=$4,email_daily_limit=$5 where kind=$1', [kind,hour,day,emailHour,emailDay]);
    };

    await db.exec('set role anon');
    await rejected(db.query("insert into public.newsletter_subscribers(email) values ('legacy@example.invalid')"), '23505');
    await rejected(db.query('select * from public.learning_public_intake_counters'), '42501');
    await rejected(db.query('select * from public.learning_public_intake_limits'), '42501');
    await rejected(db.query("update public.learning_public_intake_limits set hourly_limit=9999"), '42501');
    await rejected(db.query("select public.consume_learning_public_intake_budget('newsletter','test@example.invalid')"), '42501');
    await rejected(db.query('select public.guard_learning_public_intake()'), '42501');
    await rejected(db.query('select * from public.newsletter_subscribers'), '42501');
    await rejected(db.query("insert into public.learning_public_inquiries(inquiry_type,full_name,email,subject,message) values ('contact','Example','test@example.invalid','Help','Please help me access my Learning account.')"), '42501');
    await db.query("insert into public.newsletter_subscribers(email,created_at) values (' NEW@EXAMPLE.INVALID ','2000-01-01')");
    await db.exec('reset role');
    const current = (await db.query("select * from public.newsletter_subscribers where email='new@example.invalid'")).rows[0];
    assert.ok(new Date(current.created_at).getTime() > Date.now() - 60000, 'public timestamps cannot backdate quota activity');
    assert.equal(await count('learning_public_intake_counters'), 4);
    const beforeInvalid = await snapshot();
    await db.exec('set role anon');
    await rejected(db.query("insert into public.newsletter_subscribers(email) values ('invalid')"), '22023');
    await rejected(db.query("insert into public.newsletter_subscribers(email,source_page) values ('valid@example.invalid',$1)", ['x'.repeat(161)]), '22023');
    await db.exec('reset role');
    assert.deepEqual(await snapshot(), beforeInvalid, 'invalid/duplicate submissions never consume accepted budgets');

    await reset('inquiry', 1000, 1000, 2, 3);
    await db.exec('set role authenticated');
    await submit('same@example.invalid'); await submit('SAME@EXAMPLE.INVALID');
    await db.exec('reset role');
    const beforeLimit = await snapshot();
    await db.exec('set role anon');
    await rejected(submit('same@example.invalid'), 'PT429');
    await db.exec('reset role');
    assert.equal(await count('learning_public_inquiries'), 2);
    assert.deepEqual(await snapshot(), beforeLimit, 'later-slot rejection rolls back earlier counter increments');
    await db.exec("update public.learning_public_intake_counters set window_start=window_start-interval '2 hours' where window_seconds=3600");
    await db.exec('set role anon');
    await submit('same@example.invalid');
    await rejected(submit('same@example.invalid'), 'PT429');
    await db.exec('reset role');
    assert.equal(await count('learning_public_inquiries'), 3, 'daily limit remains after hourly rollover');

    for (const [hour, day] of [[3, 1000], [1000, 3]]) {
      await reset('newsletter', hour, day, 10, 10);
      await db.exec('set role anon');
      for (let i=0;i<3;i++) await db.query('insert into public.newsletter_subscribers(email) values ($1)', [`person${i}@example.invalid`]);
      await rejected(db.query("insert into public.newsletter_subscribers(email) values ('fourth@example.invalid')"), 'PT429');
      await db.exec('reset role');
      assert.equal(await count('newsletter_subscribers'), 3, 'rotating email addresses cannot bypass global accepted-volume limits');
    }

    await reset('newsletter', 3, 1000, 10, 10);
    await db.exec('set role anon');
    await rejected(db.query("insert into public.newsletter_subscribers(email) values ('a@example.invalid'),('b@example.invalid'),('c@example.invalid'),('d@example.invalid')"), 'PT429');
    await db.exec('reset role');
    assert.equal(await count('newsletter_subscribers'), 0, 'rejected multirow statements are atomic');
    assert.equal(await count('learning_public_intake_counters'), 0);
    await db.query("insert into public.newsletter_subscribers(email) values ('first@example.invalid')");
    await db.exec("update public.learning_public_intake_counters set window_start=window_start-interval '3 days'");
    await db.query("insert into public.newsletter_subscribers(email) values ('second@example.invalid')");
    assert.equal(await count('learning_public_intake_counters'), 4, 'new accepted writes clear expired counters');
    assert.ok((await snapshot()).every(row => row.subject_key === 'all' || /^email:[0-9a-f]{64}$/.test(row.subject_key)), 'counters never store raw email addresses');
    assert.equal((await db.query("select has_table_privilege('anon','public.newsletter_subscribers','INSERT') as allowed")).rows[0].allowed, true);
    assert.equal((await db.query("select has_function_privilege('authenticated','public.submit_public_learning_inquiry(text,text,text,text,text,text,text,text)','EXECUTE') as allowed")).rows[0].allowed, true);
    await db.exec(read('supabase/tests/phase6_public_intake_assertions.sql'));
    const beforeRollback = await snapshot();
    const rowsBeforeRollback = await count('newsletter_subscribers');
    await db.exec(read('supabase/rollbacks/20261106000000_public_intake_quotas.sql'));
    assert.equal(await count('newsletter_subscribers'), rowsBeforeRollback, 'rollback preserves subscribers');
    assert.deepEqual(await snapshot(), beforeRollback, 'rollback preserves protected quota state');
    await db.exec('set role anon');
    await db.query("insert into public.newsletter_subscribers(email) values ('after-rollback@example.invalid')");
    await db.exec('reset role');
    assert.deepEqual(await snapshot(), beforeRollback, 'rollback leaves the original write path without quota triggers');
    await db.exec(migration);
    await db.exec(read('supabase/tests/phase6_public_intake_assertions.sql'));
    console.log('PASS isolated intake migration/reapply/rollback: preserved records/settings/grants, direct INSERT and RPC coverage, private counters, normalization/timestamps, per-email and global hourly/daily limits, atomic rejection, on-write cleanup, and read-only activation assertions. PGlite is single-connection; real multi-session PostgreSQL concurrency remains a separate gate.');
  } finally { await db.close(); }
}
main().catch(error => { console.error(error); process.exitCode=1; });
