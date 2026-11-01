import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const instructor = "22222222-2222-4222-8222-222222222222";
const operator = "11111111-1111-4111-8111-111111111111";
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table public.profiles(id uuid primary key);
    create table public.learning_instructor_payout_profiles(
      id bigint primary key,instructor_id uuid,currency text,provider text,
      provider_domain text,status text);
    create table public.learning_instructor_earnings(
      id bigint primary key,instructor_id uuid,currency text,
      gross_amount_minor bigint,status text);
    create table public.learning_instructor_earning_reservations(
      id bigint primary key,earning_id bigint,instructor_id uuid,currency text,
      amount_minor bigint,future_payout_item_reference text);
    create table public.learning_instructor_payout_items(
      id bigint primary key,reservation_id bigint,earning_id bigint);
    insert into public.profiles values ('${operator}'),('${instructor}');
    insert into public.learning_instructor_payout_profiles values
      (1,'${instructor}','NGN','paystack','live','active');
    insert into public.learning_instructor_earnings values
      (1,'${instructor}','NGN',45000,'reserved'),
      (2,'${instructor}','NGN',60000,'reserved'),
      (3,'${instructor}','NGN',70000,'reserved'),
      (4,'${instructor}','NGN',50000,'reserved');
    insert into public.learning_instructor_earning_reservations values
      (1,1,'${instructor}','NGN',45000,null),
      (2,2,'${instructor}','NGN',60000,null),
      (3,3,'${instructor}','NGN',70000,null),
      (4,4,'${instructor}','NGN',50000,null);
  `);
  const migration = await readFile(new URL(
    "../supabase/migrations/20261122000000_add_instructor_live_payout_batch_identity.sql",
    import.meta.url,
  ), "utf8");
  await db.exec(migration);

  await db.exec(`
    begin;
    insert into public.learning_instructor_payout_batches
      (id,batch_reference,idempotency_key,instructor_id,payout_profile_id,
       amount_minor,currency,assembled_by)
      values (1,'LPB-1','batch:1','${instructor}',1,105000,'NGN','${operator}');
    insert into public.learning_instructor_payout_batch_members
      (batch_id,reservation_id,earning_id,amount_minor)
      values (1,1,1,45000),(1,2,2,60000);
    commit;
  `);
  const members = await db.query("select count(*)::int as n,sum(amount_minor)::bigint as amount from public.learning_instructor_payout_batch_members where batch_id=1");
  assert.equal(members.rows[0].n,2);
  assert.equal(Number(members.rows[0].amount),105000);
  await assert.rejects(() => db.query(
    "update public.learning_instructor_payout_batches set amount_minor=106000 where id=1"),
    /immutable/,
  );
  await assert.rejects(() => db.query(
    "delete from public.learning_instructor_payout_batch_members where batch_id=1"),
    /immutable/,
  );
  await assert.rejects(() => db.query(
    "insert into public.learning_instructor_payout_items values (1,1,1)"),
    /already allocated/,
  );
  await db.query("insert into public.learning_instructor_payout_items values (2,3,3)");
  await assert.rejects(() => db.query(
    "insert into public.learning_instructor_payout_batch_members values (1,3,3,70000,now())"),
    /Ineligible or already allocated/,
  );
  await assert.rejects(() => db.exec(`
    begin;
    insert into public.learning_instructor_payout_batches
      (id,batch_reference,idempotency_key,instructor_id,payout_profile_id,
       amount_minor,currency,assembled_by)
      values (2,'LPB-2','batch:2','${instructor}',1,100000,'NGN','${operator}');
    insert into public.learning_instructor_payout_batch_members
      (batch_id,reservation_id,earning_id,amount_minor) values (2,4,4,50000);
    commit;
  `), /exact members/);
  await db.exec("rollback;");
  const permissions = await db.query(`
    select has_table_privilege('service_role',
      'public.learning_instructor_payout_batches','insert') as service_insert,
      has_table_privilege('authenticated',
      'public.learning_instructor_payout_batch_members','select') as browser_select`);
  assert.equal(permissions.rows[0].service_insert,false);
  assert.equal(permissions.rows[0].browser_select,false);
  console.log("PASS inert Live payout batch identity migration in isolated PGlite database");
} finally {
  await db.close();
}
