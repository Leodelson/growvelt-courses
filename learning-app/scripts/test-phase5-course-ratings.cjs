/* eslint-disable @typescript-eslint/no-require-imports */
// Entirely in memory. Never connects to local or hosted Supabase.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const migration = readFileSync('supabase/migrations/20261102000000_add_enrolled_learner_course_ratings.sql', 'utf8');
const owner = '00000000-0000-4000-8000-000000000001';
const learner = '00000000-0000-4000-8000-000000000002';
const other = '00000000-0000-4000-8000-000000000003';
(async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create table profiles(id uuid primary key);
      create table learning_courses(id bigint primary key,instructor_id uuid,organization_id bigint,status text,company_test_mode_only boolean);
      create table learning_paystack_test_fixtures(course_id bigint);
      create table test_access(learner_id uuid,course_id bigint);
      create function public.has_own_learning_course_access(uuid,bigint) returns boolean language sql stable security definer as $$select exists(select 1 from public.test_access where learner_id=$1 and course_id=$2)$$;
      insert into profiles values('${owner}'),('${learner}'),('${other}');
      insert into learning_courses values(1,'${owner}',null,'published',false),(2,'${owner}',null,'published',true),(3,'${owner}',null,'draft',false),(4,'${owner}',null,'published',false);
      insert into learning_paystack_test_fixtures values(4);
      insert into test_access values('${learner}',1),('${learner}',2),('${owner}',1);
    `);
    await db.exec(migration);
    await db.exec(`set role anon`);
    await assert.rejects(db.query('select public.rate_own_learning_course(1,5)'), /permission denied/);
    await assert.rejects(db.query('select * from learning_course_ratings'), /permission denied/);
    await db.exec(`reset role; select set_config('request.jwt.claim.sub','${learner}',false); set role authenticated`);
    await assert.rejects(db.query('insert into learning_course_ratings values(1,$1,5,now())',[learner]), /permission denied/);
    for (const rating of [0,6,null]) await assert.rejects(db.query('select rate_own_learning_course(1,$1)',[rating]), /one and five/);
    await db.query('select rate_own_learning_course(1,5)');
    await db.query('select rate_own_learning_course(1,4)');
    assert.deepEqual((await db.query('select * from get_own_learning_course_rating(1)')).rows,[{rating:4,can_rate:true}]);
    const summary = (await db.query('select * from list_public_learning_course_ratings(array[1,2,3,4]::bigint[])')).rows;
    assert.equal(summary.length,1); assert.equal(Number(summary[0].average_rating),4); assert.equal(Number(summary[0].rating_count),1);
    await assert.rejects(db.query('select * from list_public_learning_course_ratings($1)',[Array(101).fill(1)]), /Too many/);
    await db.exec(`reset role; select set_config('request.jwt.claim.sub','${other}',false); set role authenticated`);
    await assert.rejects(db.query('select rate_own_learning_course(1,5)'), /eligible learner/);
    assert.equal((await db.query('select * from get_own_learning_course_rating(1)')).rows.length,0);
    await db.exec(`reset role; select set_config('request.jwt.claim.sub','${owner}',false); set role authenticated`);
    await assert.rejects(db.query('select rate_own_learning_course(1,5)'), /eligible learner/);
    await db.exec(`reset role; delete from test_access where learner_id='${learner}'; select set_config('request.jwt.claim.sub','${learner}',false); set role authenticated`);
    await assert.rejects(db.query('select rate_own_learning_course(1,2)'), /eligible learner/);
    await db.exec(`reset role; set role anon`);
    assert.equal(Number((await db.query('select * from list_public_learning_course_ratings(array[1]::bigint[])')).rows[0].rating_count),1);
    console.log('PASS: real database execution; role grants, enrollment/expired access boundary, instructor self-rating denied, input limits, private/test/draft isolation, own-read privacy, one rating per learner and aggregate accuracy. No external database used.');
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
