import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const admin = "11111111-1111-4111-8111-111111111111";
const instructor = "22222222-2222-4222-8222-222222222222";
const other = "33333333-3333-4333-8333-333333333333";

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table public.account_capabilities(user_id uuid, capability text, status text);
    create table public.learning_orders(id bigint primary key, status text, currency text, gross_amount_minor bigint);
    create table public.learning_commercial_allocations(
      id bigint primary key, order_id bigint, instructor_id uuid, currency text, status text);
    create table public.learning_instructor_earnings(
      id bigint primary key, allocation_id bigint, instructor_id uuid, currency text,
      gross_amount_minor bigint, status text, recoverable_amount_minor bigint);
    create table public.learning_payment_attempts(
      order_id bigint, status text, provider text, paystack_domain text,
      amount_minor bigint, currency text);
    create table public.learning_payment_cases(order_id bigint, status text);
    create table public.learning_instructor_earning_reservations(earning_id bigint);
    create table public.learning_instructor_payout_profiles(
      instructor_id uuid, provider text, provider_domain text, status text, currency text);
  `);
  const migration = await readFile(new URL(
    "../supabase/migrations/20261121000000_list_instructor_live_payout_batch_eligibility.sql",
    import.meta.url,
  ), "utf8");
  await db.exec(migration);
  await db.query("insert into public.account_capabilities values ($1,'admin','active')", [admin]);
  await db.exec(`
    insert into public.learning_orders values
      (1,'paid','NGN',60000),(2,'paid','NGN',60000),(3,'paid','NGN',90000),
      (4,'paid','NGN',90000),(5,'paid','NGN',90000),(6,'paid','NGN',90000),
      (7,'paid','NGN',90000),(8,'paid','NGN',20000),(9,'paid','NGN',20000),
      (10,'paid','NGN',20000),(11,'paid','NGN',20000),(12,'paid','NGN',20000);
    insert into public.learning_commercial_allocations
      select id,id,case when id=12 then '${other}'::uuid else '${instructor}'::uuid end,
        'NGN',case when id=7 then 'reversed' else 'allocated' end
      from public.learning_orders;
    insert into public.learning_instructor_earnings
      select id,id,case when id=12 then '${other}'::uuid else '${instructor}'::uuid end,
        'NGN',case when id<=2 then 45000 when id<=7 then 67500 else 15000 end,
        case when id=6 then 'held' else 'available' end,0
      from public.learning_orders;
    insert into public.learning_payment_attempts
      select id,'succeeded','paystack',case when id=5 then 'test' else 'live' end,
        gross_amount_minor,'NGN' from public.learning_orders;
    insert into public.learning_payment_cases values (3,'requested'),(9,'processed');
    insert into public.learning_instructor_earning_reservations values (4);
    insert into public.learning_instructor_payout_profiles values
      ('${instructor}','paystack','live','active','NGN');
  `);
  const call = "select * from public.list_learning_instructor_live_payout_batch_eligibility($1,$2)";
  const before = await db.query(call, [admin, 100]);
  assert.equal(before.rows.length, 2);
  const first = before.rows.find(row => row.instructor_id === instructor);
  const second = before.rows.find(row => row.instructor_id === other);
  // The two 45,000-minor-unit sales and three 15,000-minor-unit sales count.
  // Active/processed cases, test-domain, held, reversed, and previously
  // reserved earnings are excluded, even if fixture statuses disagree.
  assert.equal(Number(first.eligible_amount_minor), 135000);
  assert.equal(Number(first.eligible_earning_count), 5);
  assert.equal(first.has_live_profile, true);
  assert.equal(first.meets_ordinary_minimum, true);
  assert.equal(Number(second.eligible_amount_minor), 15000);
  assert.equal(second.has_live_profile, false);
  assert.equal(second.meets_ordinary_minimum, false);
  await assert.rejects(() => db.query(call, [other, 100]), /Active administrator required/);
  const permission = await db.query(`select has_function_privilege(
    'authenticated',
    'public.list_learning_instructor_live_payout_batch_eligibility(uuid,integer)',
    'execute') as allowed`);
  assert.equal(permission.rows[0].allowed, false);
  console.log("PASS Live payout batch eligibility migration in isolated PGlite database");
} finally {
  await db.close();
}
