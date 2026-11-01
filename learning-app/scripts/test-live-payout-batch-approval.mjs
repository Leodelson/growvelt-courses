import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const operator = "11111111-1111-4111-8111-111111111111";
const instructor = "22222222-2222-4222-8222-222222222222";
const outsider = "33333333-3333-4333-8333-333333333333";
const call = (ids, amount, key, actor = operator, profile = 1) =>
  `select * from public.approve_learning_instructor_live_payout_batch(
    '${actor}','${instructor}',${profile},array[${ids.join(",")}]::bigint[],${amount},'${key}')`;

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table public.profiles(id uuid primary key);
    create table public.account_capabilities(user_id uuid,capability text,status text);
    create table public.learning_orders(
      id bigint primary key,status text,currency text,gross_amount_minor bigint);
    create table public.learning_commercial_allocations(
      id bigint primary key,order_id bigint,instructor_id uuid,
      instructor_gross_minor bigint,currency text,status text);
    create table public.learning_instructor_earnings(
      id bigint primary key,allocation_id bigint,instructor_id uuid,
      gross_amount_minor bigint,currency text,status text,reserved_at timestamptz,
      hold_reason text);
    create table public.learning_instructor_earning_events(
      earning_id bigint,event_type text,from_status text,to_status text,
      actor_user_id uuid,metadata jsonb);
    create table public.learning_audit_events(
      actor_user_id uuid,actor_role text,action text,entity_type text,
      entity_id text,metadata jsonb);
    create table public.learning_payment_cases(order_id bigint,status text);
    create table public.learning_payment_attempts(
      order_id bigint,status text,provider text,paystack_domain text,
      amount_minor bigint,currency text);
    create table public.learning_instructor_payout_profiles(
      id bigint primary key,instructor_id uuid,provider text,provider_domain text,
      status text,currency text);
    create table public.learning_instructor_payout_items(
      id bigint primary key,reservation_id bigint,earning_id bigint);
    create function public.assert_learning_approved_instructor(p_instructor_id uuid)
      returns void language plpgsql as $f$ begin
        if p_instructor_id <> '${instructor}' then
          raise exception 'Not approved' using errcode='42501';
        end if;
      end;$f$;
    insert into public.profiles values ('${operator}'),('${instructor}'),('${outsider}');
    insert into public.account_capabilities values ('${operator}','admin','active');
    insert into public.learning_orders values
      (1,'paid','NGN',60000),(2,'paid','NGN',50000),
      (3,'paid','NGN',60000),(4,'paid','NGN',60000),
      (5,'paid','NGN',50000);
    insert into public.learning_commercial_allocations
      select id,id,'${instructor}',gross_amount_minor,'NGN','allocated'
      from public.learning_orders;
    insert into public.learning_instructor_earnings
      select id,id,'${instructor}',gross_amount_minor,'NGN','available',null,null
      from public.learning_orders;
    insert into public.learning_payment_attempts
      select id,'succeeded','paystack',case when id=3 then 'test' else 'live' end,
        gross_amount_minor,'NGN' from public.learning_orders;
    insert into public.learning_payment_cases values (4,'requested');
    insert into public.learning_instructor_payout_profiles values
      (1,'${instructor}','paystack','live','active','NGN');
  `);
  for (const name of [
    "20260908000000_add_instructor_earnings_reservation_foundation.sql",
    "20261122000000_add_instructor_live_payout_batch_identity.sql",
    "20261123000000_fix_instructor_reservation_column_ambiguity.sql",
    "20261124000000_approve_instructor_live_payout_batch.sql",
  ]) {
    const sql = await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
    await db.exec(sql);
  }

  await assert.rejects(() => db.query(call([1,2],110000,"batch:unauthorized",outsider)),
    /Active administrator required/);
  await assert.rejects(() => db.query(call([1,2],100000,"batch:wrongamount")),
    /Confirmed amount does not match/);
  assert.equal((await db.query("select count(*)::int as n from public.learning_instructor_earning_reservations")).rows[0].n,0);
  assert.equal((await db.query("select count(*)::int as n from public.learning_instructor_earnings where status='reserved'")).rows[0].n,0);
  await assert.rejects(() => db.query(call([3,5],110000,"batch:testdomain")),
    /Live payment or financial protection/);
  await assert.rejects(() => db.query(call([4,5],110000,"batch:refund")),
    /Active financial protection/);
  await assert.rejects(() => db.query(call([1,1],120000,"batch:duplicate")),
    /Duplicate earning/);
  await assert.rejects(() => db.query(call([1],60000,"batch:belowminimum")),
    /Valid batch identity and confirmed amount/);

  const created = await db.query(call([2,1],110000,"batch:valid"));
  assert.match(created.rows[0].batch_reference,/^LPB-[0-9]+$/);
  assert.equal(created.rows[0].member_count,2);
  const retry = await db.query(call([1,2],110000,"batch:valid"));
  assert.deepEqual(retry.rows,created.rows);
  await assert.rejects(() => db.query(call([1,2],100000,"batch:valid")),
    /Payout batch idempotency conflict/);
  const outcome = await db.query(`
    select (select count(*)::int from public.learning_instructor_payout_batches) as batches,
      (select count(*)::int from public.learning_instructor_payout_batch_members) as members,
      (select count(*)::int from public.learning_instructor_earning_reservations
        where future_payout_item_reference is not null) as bound,
      (select count(*)::int from public.learning_instructor_earning_events
        where event_type='earning.reserved') as events,
      (select count(*)::int from public.learning_audit_events
        where action='instructor_payout_batch.assembled') as audit_events`);
  assert.deepEqual(outcome.rows[0],{
    batches:1,members:2,bound:2,events:2,audit_events:1,
  });
  const privilege = await db.query(`select has_function_privilege(
    'authenticated',
    'public.approve_learning_instructor_live_payout_batch(uuid,uuid,bigint,bigint[],bigint,text)',
    'execute') as allowed`);
  assert.equal(privilege.rows[0].allowed,false);
  console.log("PASS atomic Live payout batch approval in isolated PGlite database");
} finally {
  await db.close();
}
