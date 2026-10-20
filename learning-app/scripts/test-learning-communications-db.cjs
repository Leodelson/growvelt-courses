/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.env.PGLITE_PACKAGE_PATH || '@electric-sql/pglite');

const migration = (name) => readFileSync(path.resolve(__dirname, `../supabase/migrations/${name}`), 'utf8');
const learner = '00000000-0000-4000-8000-000000000001';
const instructor = '00000000-0000-4000-8000-000000000002';
const company = '00000000-0000-4000-8000-000000000003';
const stranger = '00000000-0000-4000-8000-000000000004';
const admin = '00000000-0000-4000-8000-000000000005';

async function main() {
  const db = new PGlite();
  try {
    await db.exec(`
      create role authenticated; create role anon; create role service_role bypassrls;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;
      create function public.is_growvelt_learning_admin() returns boolean language sql stable as
        $$ select auth.uid() = '${admin}'::uuid $$;
      create table auth.users(id uuid primary key, email text);
      create table public.profiles(id uuid primary key, account_type text not null);
      create table public.instructor_profiles(user_id uuid primary key, approval_status text);
      create table public.learning_company_workspaces(id bigint primary key, status text);
      create table public.learning_company_memberships(user_id uuid, workspace_id bigint, status text, role text);
      insert into auth.users values
        ('${learner}','learner@example.com'),('${instructor}','instructor@example.com'),
        ('${company}','company@example.com'),('${stranger}','stranger@example.com'),
        ('${admin}','admin@example.com');
      insert into public.profiles values
        ('${learner}','learner'),('${instructor}','learner'),('${company}','learner'),('${stranger}','learner'),('${admin}','admin');
      insert into public.instructor_profiles values ('${instructor}','approved');
      insert into public.learning_company_workspaces values (1,'active');
      insert into public.learning_company_memberships values ('${company}',1,'active','owner');
    `);
    await db.exec(migration('20261103000000_add_learning_login_activity_and_notifications.sql'));
    await db.exec(migration('20261104000000_add_learning_email_center.sql'));
    await db.exec(migration('20261105000000_add_learning_support_inbox.sql'));
    await db.exec(`
      insert into public.learning_email_preferences(user_id,marketing_opt_in) values
        ('${learner}',true),('${instructor}',true),('${company}',true),('${stranger}',false);
      insert into public.learning_login_activity(user_id,sign_in_at,browser,device) values
        ('${learner}',now(),'Chrome','Mobile');
      insert into public.learning_notifications(user_id,kind,title,body,source_key) values
        ('${learner}','login','New sign-in','Chrome on Mobile','login:1');
    `);

    for (const [audience, expected] of [['learners', 3], ['instructors', 1], ['organizations', 1]]) {
      const result = await db.query('select public.learning_marketing_recipient_count($1) as count', [audience]);
      assert.equal(Number(result.rows[0].count), expected);
    }
    const eligible = await db.query('select user_id from public.learning_marketing_recipients($1,$2,$3)', ['instructors', null, 10]);
    assert.deepEqual(eligible.rows.map((row) => row.user_id), [instructor]);
    await assert.rejects(db.query("insert into public.learning_login_activity(user_id,sign_in_at,browser,device) select user_id,sign_in_at,'Chrome','Mobile' from public.learning_login_activity where user_id=$1", [learner]), /duplicate key/, 'a sign-in is recorded once');
    await db.exec(`insert into public.learning_email_campaigns(created_by,audience,subject,headline,body) values ('${learner}','instructors','Example subject','Example headline','A long example message')`);
    const campaignId = (await db.query('select id from public.learning_email_campaigns')).rows[0].id;
    await db.query("insert into public.learning_email_deliveries(campaign_id,user_id,state) values ($1,$2,'claimed')", [campaignId, instructor]);
    assert.equal((await db.query('select * from public.learning_marketing_recipients($1,$2,$3)', ['instructors', campaignId, 3])).rows.length, 0, 'claimed recipients cannot be sent twice');
    await db.query('update public.learning_email_preferences set marketing_opt_in=false where user_id=$1', [learner]);
    assert.equal(Number((await db.query("select public.learning_marketing_recipient_count('learners') as count")).rows[0].count), 2, 'opt-out immediately removes recipient');

    await db.exec(`select set_config('request.jwt.claim.sub','${learner}',false);`);
    const supportCaseId = (await db.query("select public.create_learning_support_case('courses','Course access question','I cannot find the course I enrolled in after signing in.') as id")).rows[0].id;
    assert.equal((await db.query('select status from public.learning_support_conversations where id=$1', [supportCaseId])).rows[0].status, 'open');
    assert.equal((await db.query('select sender_role from public.learning_support_messages where conversation_id=$1', [supportCaseId])).rows[0].sender_role, 'customer');

    await db.exec(`select set_config('request.jwt.claim.sub','${stranger}',false); set role authenticated;`);
    assert.equal((await db.query('select * from public.learning_login_activity')).rows.length, 0);
    assert.equal((await db.query('select * from public.learning_notifications')).rows.length, 0);
    assert.equal((await db.query('select * from public.learning_support_conversations')).rows.length, 0, 'strangers cannot read support cases');
    assert.equal((await db.query('select * from public.learning_support_messages')).rows.length, 0, 'strangers cannot read support messages');
    await assert.rejects(db.query('select public.post_learning_support_message($1,$2)', [supportCaseId, 'A reply from another account.']), /Not authorized/);
    await assert.rejects(db.query('select public.resolve_learning_support_case($1)', [supportCaseId]), /Not authorized/);
    await assert.rejects(db.query('select * from public.learning_email_campaigns'), /permission denied/);
    await assert.rejects(db.query('select * from public.learning_marketing_recipients($1,$2,$3)', ['learners', null, 3]), /permission denied/);
    await db.exec('reset role;');
    await db.exec(`select set_config('request.jwt.claim.sub','${learner}',false); set role authenticated;`);
    assert.equal((await db.query('select * from public.learning_login_activity')).rows.length, 1);
    assert.equal((await db.query('select * from public.learning_notifications')).rows.length, 1);
    assert.equal((await db.query('select * from public.learning_support_conversations where id=$1', [supportCaseId])).rows.length, 1, 'learners can read their own support case');
    assert.equal((await db.query('select * from public.learning_support_messages where conversation_id=$1', [supportCaseId])).rows.length, 1, 'learners can read their own support messages');
    await assert.rejects(db.query("insert into public.learning_notifications(user_id,kind,title,body) values ($1,'login','Fake','Fake')", [learner]), /permission denied/);
    console.log('Learning communications migrations, opt-in audiences, and RLS passed.');
    await db.exec('reset role;');

    await db.exec(`select set_config('request.jwt.claim.sub','${admin}',false);`);
    assert.equal((await db.query('select * from public.learning_support_conversations where id=$1', [supportCaseId])).rows.length, 1, 'Learning admins can read all support cases');
    await db.query('select public.post_learning_support_message($1,$2)', [supportCaseId, 'Thanks for reporting this. We are checking your Learning access.']);
    assert.equal((await db.query('select status from public.learning_support_conversations where id=$1', [supportCaseId])).rows[0].status, 'waiting', 'admin replies await the learner');
    assert.equal((await db.query("select count(*)::int as count from public.learning_notifications where user_id=$1 and kind='support'", [learner])).rows[0].count, 1, 'admin replies notify the learner');
    await db.query('select public.resolve_learning_support_case($1)', [supportCaseId]);
    assert.equal((await db.query('select status from public.learning_support_conversations where id=$1', [supportCaseId])).rows[0].status, 'resolved');
    await db.exec(`select set_config('request.jwt.claim.sub','${learner}',false);`);
    await db.query('select public.post_learning_support_message($1,$2)', [supportCaseId, 'I still need help with this issue.']);
    assert.equal((await db.query('select status from public.learning_support_conversations where id=$1', [supportCaseId])).rows[0].status, 'open', 'learner reply reopens a resolved case');
    console.log('Learning support ownership, admin replies, notifications, and status transitions passed.');
  } finally { await db.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
