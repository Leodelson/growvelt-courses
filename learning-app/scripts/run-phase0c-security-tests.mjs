import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const productionRef = "qtcpjcaoptdunuefwvgc";
const projectRef = process.env.SUPABASE_TEST_PROJECT_REF?.trim();
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();

if (process.env.PHASE0C_ALLOW_REMOTE_TESTS !== "true") throw new Error("Set PHASE0C_ALLOW_REMOTE_TESTS=true after confirming the staging target.");
if (!projectRef) throw new Error("SUPABASE_TEST_PROJECT_REF is required.");
if (projectRef === productionRef) throw new Error("Refusing to run Phase 0C integration tests against production.");
if (!accessToken) throw new Error("SUPABASE_ACCESS_TOKEN is required and must not be committed.");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tests = [
  "supabase/tests/phase0b_catalog_assertions.sql",
  "supabase/tests/phase0c_multi_user_authorization.sql",
];

for (const relativePath of tests) {
  const query = await readFile(path.join(root, relativePath), "utf8");
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw new Error(`${relativePath} failed: ${response.status} ${await response.text()}`);
  console.log(`PASS ${relativePath}`);
}
