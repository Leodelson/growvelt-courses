/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.env.PGLITE_PACKAGE_PATH || '@electric-sql/pglite');

const migration = readFileSync(path.resolve(__dirname,
  '../supabase/migrations/20261018000000_require_instructor_owned_coupon_courses.sql'), 'utf8');
const namedInstructor = '00000000-0000-4000-8000-000000000001';
const blankInstructor = '00000000-0000-4000-8000-000000000002';

async function main() {
  const db = new PGlite();
  try {
    await db.exec([
      'create role anon;',
      'create role authenticated;',
      'create role service_role;',
      'create table public.profiles(id uuid primary key, full_name text);',
      'create table public.learning_courses(' +
        'id bigint primary key, instructor_id uuid, status text, is_free boolean, is_limited_time_free boolean, ' +
        'company_test_mode_only boolean, organization_id bigint, price_currency text, price_amount numeric);',
      'create table public.learning_paystack_test_fixtures(course_id bigint, status text, expires_at timestamptz);',
      'create function public.is_paystack_test_fixture_course(p_course_id bigint) returns boolean ' +
        'language sql stable as $$ select p_course_id = 99 $$;',
      `insert into public.profiles values ('${namedInstructor}', 'Instructor One'), ('${blankInstructor}', '   ');`,
      'insert into public.learning_courses values ' +
        `(1,'${namedInstructor}','published',false,false,false,null,'NGN',5000),` +
        `(2,null,'published',false,false,false,null,'NGN',5000),` +
        `(3,'${blankInstructor}','published',false,false,false,null,'NGN',5000),` +
        `(4,'${namedInstructor}','published',false,false,true,null,'NGN',5000),` +
        `(5,'${namedInstructor}','published',false,false,false,7,'NGN',5000),` +
        `(6,'${namedInstructor}','published',true,false,false,null,'NGN',5000),` +
        `(99,'${namedInstructor}','published',false,false,false,null,'NGN',5000);`,
      "insert into public.learning_paystack_test_fixtures values (99,'active',now()+interval '1 day');",
    ].join('\n'));

    await db.exec(migration);
    const result = await db.query(
      'select id, public.is_learning_promotion_course_eligible(id) as eligible ' +
      'from public.learning_courses order by id');
    assert.deepEqual(result.rows.map((row) => [row.id, row.eligible]), [
      [1, true],       // Named instructor-owned public paid course.
      [2, false],      // Legacy/unowned seed course.
      [3, false],      // Instructor profile without a real display name.
      [4, false],      // Company-only course.
      [5, false],      // Organization-attributed course.
      [6, false],      // Free course.
      [99, true],      // Test fixture remains eligible only while active.
    ]);
    await db.exec("update public.learning_paystack_test_fixtures set expires_at=now()-interval '1 second' where course_id=99;");
    assert.equal((await db.query('select public.is_learning_promotion_course_eligible(99) as eligible')).rows[0].eligible, false);
    assert.match(migration, /security definer set search_path to ''/i);
    assert.match(migration, /grant execute[\s\S]*to postgres, service_role/i);
    console.log('PASS coupon eligibility excludes unowned/sample courses while preserving named instructor and active fixture rules');
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
