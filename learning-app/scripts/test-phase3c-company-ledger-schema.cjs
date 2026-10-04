const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.env.PGLITE_PACKAGE_PATH || '@electric-sql/pglite');

const schemaPath = process.argv[2];
if (!schemaPath) {
  console.error('Usage: node scripts/test-phase3c-company-ledger-schema.cjs <public-schema-dump.sql>');
  process.exit(2);
}

const migrationsDir = path.resolve(__dirname, '../supabase/migrations');
const migrationNames = readdirSync(migrationsDir)
  .filter((name) => /^202609(4[3-9]|5[0-7])000000_.*\.sql$/.test(name))
  .sort();
if (migrationNames.length !== 15) {
  throw new Error(`Expected migrations 43–57; found ${migrationNames.length}`);
}

async function main() {
  const db = new PGlite();
  let stage = 'Supabase prerequisite stubs';
  try {
    // The export contains only the public schema. These auth objects and roles
    // satisfy its cross-schema references; no production data is copied.
    await db.exec(`
      create schema auth;
      create schema storage;
      create schema extensions;
      create schema vault;
      create schema graphql;
      create schema pgsodium;
      create schema cron;
      create schema net;
      create role anon;
      create role authenticated;
      create role service_role;
      create role supabase_auth_admin;
      create role supabase_storage_admin;
      create role dashboard_user;
      create role supabase_admin;
      create role authenticator;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as 'select null::uuid';
    `);
    stage = 'public schema import';
    await db.exec(readFileSync(path.resolve(schemaPath), 'utf8'));
    // pg_dump disables function-body checking while restoring out-of-order
    // functions. Re-enable it for each new migration definition.
    await db.exec('set check_function_bodies = true');
    for (const name of migrationNames) {
      stage = name;
      await db.exec(readFileSync(path.join(migrationsDir, name), 'utf8'));
      console.log(`ok ${name}`);
    }
    stage = 'payout-source isolation';
    const { rows: foreignKeys } = await db.query(`
      select source_table.relname as source, target_table.relname as target
      from pg_constraint constraint_row
      join pg_class source_table on source_table.oid = constraint_row.conrelid
      join pg_class target_table on target_table.oid = constraint_row.confrelid
      where constraint_row.contype = 'f' and constraint_row.conrelid in (
        'public.learning_instructor_earnings'::regclass,
        'public.learning_commercial_allocations'::regclass,
        'public.learning_company_commercial_sales'::regclass,
        'public.learning_instructor_earning_reservations'::regclass,
        'public.learning_instructor_payout_items'::regclass,
        'public.learning_instructor_payout_settlements'::regclass)
    `);
    const hasEdge = (source, target) => foreignKeys.some((row) =>
      row.source === source && row.target === target);
    assert.ok(hasEdge('learning_instructor_earnings', 'learning_commercial_allocations'));
    assert.ok(hasEdge('learning_commercial_allocations', 'learning_orders'));
    assert.ok(hasEdge('learning_company_commercial_sales', 'learning_company_paid_course_purchases'));
    assert.ok(hasEdge('learning_instructor_earning_reservations', 'learning_instructor_earnings'));
    assert.ok(hasEdge('learning_instructor_payout_items', 'learning_instructor_earning_reservations'));
    assert.ok(hasEdge('learning_instructor_payout_items', 'learning_instructor_earnings'));
    assert.ok(hasEdge('learning_instructor_payout_settlements', 'learning_instructor_payout_items'));
    assert.ok(!foreignKeys.some((row) => row.source === 'learning_company_commercial_sales'
      && ['learning_orders', 'learning_commercial_allocations', 'learning_instructor_earnings'].includes(row.target)));
    assert.ok(!foreignKeys.some((row) =>
      ['learning_instructor_earning_reservations', 'learning_instructor_payout_items',
        'learning_instructor_payout_settlements'].includes(row.source)
      && ['learning_company_paid_course_purchases', 'learning_company_commercial_sales'].includes(row.target)));

    const payoutFunctions = [
      ['release_matured_learning_instructor_earnings(integer,uuid)', ['learning_instructor_earnings', 'learning_commercial_allocations', 'learning_orders']],
      ['reserve_learning_instructor_earning(bigint,uuid,text,uuid)', ['learning_instructor_earnings', 'learning_commercial_allocations', 'learning_orders']],
      ['approve_learning_instructor_payout_item(bigint,text,uuid)', ['learning_instructor_earnings', 'learning_commercial_allocations', 'learning_orders']],
      ['list_learning_instructor_payout_candidates(uuid,integer)', ['learning_instructor_earnings', 'learning_commercial_allocations', 'learning_orders']],
      ['process_learning_instructor_payout_provider_event(bigint)', ['learning_instructor_earnings', 'learning_commercial_allocations', 'learning_orders']],
    ];
    for (const [signature, requiredTables] of payoutFunctions) {
      const { rows } = await db.query('select pg_get_functiondef($1::regprocedure) as definition',
        [`public.${signature}`]);
      const definition = rows[0]?.definition || '';
      for (const table of requiredTables) assert.ok(definition.includes(table), `${signature} lost ${table}`);
      assert.ok(!definition.includes('learning_company_commercial_sales'),
        `${signature} must not release or pay company-held proceeds`);
    }
    const companyMigrationSql = migrationNames.map((name) =>
      readFileSync(path.join(migrationsDir, name), 'utf8')).join('\n');
    assert.doesNotMatch(companyMigrationSql,
      /(?:insert\s+into|update|delete\s+from)\s+public\.(?:learning_instructor_earnings|learning_commercial_allocations|learning_instructor_payout_items)\b/i);
    const { rows: holdPermissions } = await db.query(`select
      has_function_privilege('authenticated','public.list_learning_company_seller_held_liabilities()','EXECUTE') as member_read,
      has_function_privilege('service_role','public.list_learning_company_seller_held_liabilities()','EXECUTE') as service_read`);
    assert.deepEqual(holdPermissions[0], { member_read: false, service_read: true });
    const { rows: exclusionPermissions } = await db.query(`select
      has_table_privilege('authenticated','public.learning_company_historical_test_sale_exclusions','SELECT') as member_read,
      has_table_privilege('service_role','public.learning_company_historical_test_sale_exclusions','SELECT') as service_read,
      has_table_privilege('service_role','public.learning_company_historical_test_sale_exclusions','INSERT') as service_insert`);
    assert.deepEqual(exclusionPermissions[0], { member_read: false, service_read: true, service_insert: false });
    stage = 'company financial role permissions';
    const privateTables = [
      'learning_company_sale_ledger_transactions',
      'learning_company_sale_ledger_entries',
      'learning_company_commercial_sales',
      'learning_company_commercial_sale_lines',
      'learning_company_reversal_event_inbox',
      'learning_company_commercial_reversals',
      'learning_company_commercial_reversal_lines',
      'learning_company_commercial_reversal_ledger_entries',
      'learning_company_paid_seat_access',
      'learning_company_reversal_access_results',
      'learning_company_historical_test_sale_exclusions',
    ];
    for (const table of privateTables) {
      const { rows } = await db.query(`select
        has_table_privilege('anon',$1,'SELECT') as anonymous_read,
        has_table_privilege('authenticated',$1,'SELECT') as member_read,
        has_table_privilege('service_role',$1,'SELECT') as service_read,
        has_table_privilege('service_role',$1,'INSERT') as service_insert`, [`public.${table}`]);
      assert.deepEqual(rows[0], {
        anonymous_read: false, member_read: false, service_read: true, service_insert: false,
      }, `${table} must remain service-readable but not browser-readable or service-writable`);
    }
    const privateFunctions = [
      ['post_learning_company_commercial_sale(bigint)', true],
      ['reconcile_learning_company_commercial_sales()', true],
      ['receive_learning_company_reversal_notice(text,text,text,text,text,text,bigint,text,text)', true],
      ['grant_paid_learning_company_purchase_access(bigint)', true],
      ['reconcile_learning_company_paid_seat_access()', true],
      ['assess_learning_company_reversal_access(bigint)', true],
      ['resolve_learning_course_access_sources(uuid,bigint)', true],
      ['post_learning_company_commercial_reversal(bigint,text,text,text,bigint,uuid[])', false],
      ['apply_learning_company_reversal_access(bigint)', false],
      ['commit_learning_company_reversal_after_verification(bigint,text,text,text,bigint,uuid[])', true],
      ['list_learning_company_seller_held_liabilities()', true],
      ['reconcile_learning_company_seller_held_liabilities()', true],
      ['list_learning_company_seller_payout_review_queue()', true],
    ];
    for (const [signature, serviceExecute] of privateFunctions) {
      const { rows } = await db.query(`select
        has_function_privilege('anon',$1,'EXECUTE') as anonymous_execute,
        has_function_privilege('authenticated',$1,'EXECUTE') as member_execute,
        has_function_privilege('service_role',$1,'EXECUTE') as service_execute`, [`public.${signature}`]);
      assert.deepEqual(rows[0], {
        anonymous_execute: false, member_execute: false, service_execute: serviceExecute,
      }, `${signature} must retain its reviewed role boundary`);
    }
    console.log('Pending company migrations apply to the supplied public schema.');
    console.log('Company proceeds remain isolated from personal payouts; private financial role grants match the reviewed matrix.');
  } catch (error) {
    console.error(`Failed at ${stage}: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
