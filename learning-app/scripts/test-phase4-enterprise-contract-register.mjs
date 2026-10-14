import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

const migration = await source("supabase/migrations/20261101000000_add_learning_enterprise_contract_register.sql");
const action = await source("app/dashboard/admin/enterprise-contracts/actions.ts");
const page = await source("app/dashboard/admin/enterprise-contracts/page.tsx");
const navigation = await source("app/components/learning-shell-navigation.tsx");
const adminHome = await source("app/dashboard/admin/page.tsx");

assert.match(migration, /create table public\.learning_company_enterprise_contract_records/);
assert.match(migration, /references public\.learning_company_workspaces\(id\) on delete restrict/);
assert.match(migration, /alter table public\.learning_company_enterprise_contract_records enable row level security/);
assert.match(migration, /revoke all on public\.learning_company_enterprise_contract_records from public, anon, authenticated, service_role/);
assert.match(migration, /before update or delete on public\.learning_company_enterprise_contract_records/);
assert.match(migration, /Enterprise contract records are append-only/);
assert.equal((migration.match(/public\.is_growvelt_learning_admin\(\)/g) ?? []).length, 3, "all admin RPCs must check the authoritative admin function");
assert.match(migration, /p_executed_externally is distinct from true/);
assert.match(migration, /contract_reference\)\)/);
assert.match(migration, /company\.enterprise_contract\.recorded/);
const executableSql = migration.replace(/--.*$/gm, "");
assert.doesNotMatch(executableSql, /paystack|checkout|seller_earnings|course_entitlement|grant_learning_course/i, "register migration must not implement payments or access grants");

assert.match(action, /isLearningAdmin\(\)/, "server action must check Learning Admin");
assert.match(action, /p_executed_externally: executedExternally/);
assert.match(action, /p_workspace_id: workspaceId/);
assert.match(page, /recordLearningEnterpriseContractAction/);
assert.match(page, /does not create legal documents, collect payment, change the workspace seat limit, grant course access, or initiate seller payouts/);
assert.match(page, /[Cc]onfirm the enterprise-contract migration is applied/);
assert.match(navigation, /href="\/dashboard\/admin\/enterprise-contracts"/);
assert.match(adminHome, /href="\/dashboard\/admin\/enterprise-contracts"/);

console.log("Phase 4 enterprise contract register boundaries passed.");
