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
  .filter((name) => /^202609(4[3-9]|5[0-4])000000_.*\.sql$/.test(name))
  .sort();
if (migrationNames.length !== 12) {
  throw new Error(`Expected migrations 43–54; found ${migrationNames.length}`);
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
    console.log('Pending company migrations apply to the supplied public schema.');
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
