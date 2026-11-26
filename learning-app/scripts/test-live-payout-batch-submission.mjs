import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const admin = "11111111-1111-4111-8111-111111111111";
const instructor = "22222222-2222-4222-8222-222222222222";
const another = "33333333-3333-4333-8333-333333333333";
const createBatch = `select * from public.approve_learning_instructor_live_payout_batch(
  '${admin}','${instructor}',1,array[1,2]::bigint[],110000,'batch:submission-fixture')`;
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table public.profiles(id uuid primary key);
    create table public.account_capabilities(user_id uuid,capability text,status text);
    create table public.learning_orders(id bigint primary key,status text,currency text,gross_amount_minor bigint);
    create table public.learning_commercial_allocations(
      id bigint primary key,order_id bigint,instructor_id uuid,instructor_gross_minor bigint,
      currency text,status text);
    create table public.learning_instructor_earnings(
      id bigint primary key,allocation_id bigint,instructor_id uuid,gross_amount_minor bigint,
      currency text,status text,available_at timestamptz,released_at timestamptz,
      reserved_at timestamptz,paid_at timestamptz,reversed_at timestamptz,
      recoverable_amount_minor bigint default 0,hold_reason text,updated_at timestamptz default now());
    create table public.learning_instructor_earning_events(
      earning_id bigint,event_type text,from_status text,to_status text,actor_user_id uuid,
      ledger_transaction_id bigint,metadata jsonb,occurred_at timestamptz default now());
    create table public.learning_audit_events(
      actor_user_id uuid,actor_role text,action text,entity_type text,entity_id text,metadata jsonb,
      occurred_at timestamptz default now());
    create table public.learning_payment_cases(order_id bigint,status text);
    create table public.learning_payment_attempts(
      order_id bigint,status text,provider text,paystack_domain text,amount_minor bigint,currency text);
    create table public.learning_instructor_payout_profiles(
      id bigint primary key,instructor_id uuid,provider text,provider_domain text,status text,
      recipient_code text,provider_recipient_id text,currency text,bank_code text,bank_name text,
      account_name text,account_last4 text,created_at timestamptz default now(),disabled_at timestamptz,
      created_by uuid);
    create table public.learning_instructor_payout_items(id bigint primary key,reservation_id bigint,earning_id bigint);
    create function public.assert_learning_approved_instructor(p_instructor_id uuid)
      returns void language plpgsql as $f$ begin
        if p_instructor_id<>'${instructor}' then raise exception 'Not approved' using errcode='42501'; end if;
      end;$f$;
    insert into public.profiles values ('${admin}'),('${instructor}'),('${another}');
    insert into public.account_capabilities values ('${admin}','admin','active');
    insert into public.learning_orders values (1,'paid','NGN',60000),(2,'paid','NGN',50000);
    insert into public.learning_commercial_allocations values
      (1,1,'${instructor}',45000,'NGN','allocated'),(2,2,'${instructor}',65000,'NGN','allocated');
    insert into public.learning_instructor_earnings values
      (1,1,'${instructor}',45000,'NGN','available',now()-interval '20 days',now(),null,null,null,0,null,now()),
      (2,2,'${instructor}',65000,'NGN','available',now()-interval '20 days',now(),null,null,null,0,null,now());
    insert into public.learning_payment_attempts values
      (1,'succeeded','paystack','live',60000,'NGN'),(2,'succeeded','paystack','live',50000,'NGN');
    insert into public.learning_instructor_payout_profiles values
      (1,'${instructor}','paystack','live','active','RCP_testbatch1','102030','NGN','058',
        'Example Bank','Instructor','3030',now(),null,'${admin}');
  `);
  for (const name of [
    "20260908000000_add_instructor_earnings_reservation_foundation.sql",
    "20261122000000_add_instructor_live_payout_batch_identity.sql",
    "20261123000000_fix_instructor_reservation_column_ambiguity.sql",
    "20261124000000_approve_instructor_live_payout_batch.sql",
    "20261125000000_add_instructor_live_payout_batch_submission.sql",
  ]) {
    const sql = await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
    await db.exec(sql);
  }
  await db.query(createBatch);
  const beginSql = `select * from public.begin_learning_instructor_live_payout_batch_transfer(
    (select id from public.learning_instructor_payout_batches where idempotency_key='batch:submission-fixture'),
    $1,$2)`;
  const cases = await db.query("insert into public.learning_payment_cases values (1,'requested') returning order_id");
  assert.equal(cases.rows.length,1);
  await assert.rejects(() => db.query(beginSql,[admin,"batch:attempt:block"]),
    /no longer eligible/);
  assert.equal((await db.query("select count(*)::int as n from public.learning_instructor_payout_batch_attempts")).rows[0].n,0);
  await db.exec("delete from public.learning_payment_cases");

  await assert.rejects(() => db.query(beginSql,[another,"batch:attempt:unauthorized"]),
    /Valid administrator/);
  const start = await db.query(beginSql,[admin,"batch:attempt:otp"]);
  const attempt = start.rows[0];
  assert.match(attempt.attempt_reference,/^lpb-live-batch-[0-9]+-a1$/);
  assert.equal(Number(attempt.amount_minor),110000);
  assert.equal(attempt.recipient_code,"RCP_testbatch1");
  assert.equal(attempt.transfer_submission_needed,true);
  const retryStart = await db.query(beginSql,[admin,"batch:attempt:otp"]);
  assert.deepEqual(
    { ...retryStart.rows[0], transfer_submission_needed: true },
    start.rows[0],
  );
  assert.equal(retryStart.rows[0].transfer_submission_needed,false);
  await assert.rejects(() => db.query(beginSql,[admin,"batch:attempt:different"]),
    /not available for a new transfer attempt/);

  await db.query(`select public.record_learning_instructor_live_payout_batch_transfer($1,$2,$3,$4,$5)`,
    [attempt.attempt_id,"9001","TRF_batch1","otp",admin]);
  const otpStart = await db.query(`select * from public.begin_learning_instructor_live_payout_batch_otp_finalization($1,$2)`,
    [attempt.attempt_id,admin]);
  assert.equal(otpStart.rows[0].attempt_reference,attempt.attempt_reference);
  assert.equal(otpStart.rows[0].transfer_code,"TRF_batch1");
  await assert.rejects(() => db.query(`select * from public.begin_learning_instructor_live_payout_batch_otp_finalization($1,$2)`,
    [attempt.attempt_id,admin]),/not available/);
  await db.query(`select public.complete_learning_instructor_live_payout_batch_otp_finalization($1,$2,$3)`,
    [otpStart.rows[0].otp_attempt_id,"submitted",admin]);
  await assert.rejects(() => db.query(`select public.complete_learning_instructor_live_payout_batch_otp_finalization($1,$2,$3)`,
    [otpStart.rows[0].otp_attempt_id,"submitted",admin]),/Open OTP attempt required/);
  const status = await db.query(`select b.status batch_status,a.status attempt_status,
    a.provider_status,a.provider_transfer_id,(select count(*)::int from public.learning_instructor_payout_batch_otp_attempts o where o.attempt_id=a.id) otp_count
    from public.learning_instructor_payout_batches b join public.learning_instructor_payout_batch_attempts a on a.batch_id=b.id`);
  assert.deepEqual(status.rows[0],{
    batch_status:"pending",attempt_status:"pending",provider_status:"otp",
    provider_transfer_id:"9001",otp_count:1,
  });
  const permission = await db.query(`select has_function_privilege('authenticated',
    'public.begin_learning_instructor_live_payout_batch_transfer(bigint,uuid,text)','execute') allowed,
    has_table_privilege('service_role','public.learning_instructor_payout_batch_attempts','insert') service_insert`);
  assert.equal(permission.rows[0].allowed,false);
  assert.equal(permission.rows[0].service_insert,false);
  console.log("PASS Live payout batch transfer submission and OTP controls in isolated PGlite database");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await db.close();
}
