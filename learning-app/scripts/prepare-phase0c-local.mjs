import { access, copyFile, cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const localRoot = path.join(os.tmpdir(), "growvelt-learning-phase0c-local");
const localSupabase = path.join(localRoot, "supabase");

if (!localRoot.startsWith(path.resolve(os.tmpdir()) + path.sep)) {
  throw new Error("Refusing to prepare Phase 0C outside the operating-system temp directory.");
}

const dockerCandidates = process.platform === "win32"
  ? [
      process.env.DOCKER_PATH,
      path.join(process.env.LOCALAPPDATA ?? "", "Programs", "DockerDesktop", "resources", "bin", "docker.exe"),
      path.join(process.env.ProgramFiles ?? "", "Docker", "Docker", "resources", "bin", "docker.exe"),
    ].filter(Boolean)
  : [process.env.DOCKER_PATH, "docker"].filter(Boolean);

let docker;
for (const candidate of dockerCandidates) {
  try {
    if (candidate !== "docker") await access(candidate);
    docker = candidate;
    break;
  } catch {
    // Continue to the next known installation path.
  }
}

function inspectLocalContainer() {
  if (!docker) return Promise.resolve(false);
  return new Promise((resolve, reject) => {
    const child = spawn(docker, ["inspect", "supabase_db_growvelt-learning-phase0c-local"], {
      cwd: repositoryRoot,
      stdio: "ignore",
      shell: false,
    });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code === 0));
  });
}

if (await inspectLocalContainer()) {
  throw new Error("Stop the isolated Phase 0C Supabase project before preparing it again; refusing to remove an active work directory.");
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repositoryRoot,
      env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1" },
      stdio: "inherit",
      shell: false,
      ...options,
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

await rm(localRoot, { recursive: true, force: true });
await mkdir(path.join(localSupabase, "migrations"), { recursive: true });
await cp(path.join(repositoryRoot, "supabase", "schemas"), path.join(localSupabase, "schemas"), {
  recursive: true,
});

const config = `project_id = "growvelt-learning-phase0c-local"

[db]
port = 55432
shadow_port = 55430
major_version = 17
health_timeout = "2m"

[db.migrations]
enabled = true
schema_paths = ["./schemas/**/*.sql"]

[db.seed]
enabled = false

[experimental.pgdelta]
enabled = true
`;

await writeFile(path.join(localSupabase, "config.toml"), config, "utf8");

await run("supabase", [
  "db",
  "schema",
  "declarative",
  "sync",
  "--name",
  "phase0c_local_baseline",
  "--no-apply",
  "--strict-coverage",
  "--workdir",
  localRoot,
]);

const migrationDirectory = path.join(localSupabase, "migrations");
const generatedMigration = (await readdir(migrationDirectory)).find((name) =>
  name.endsWith("_phase0c_local_baseline.sql"),
);
if (!generatedMigration) throw new Error("Supabase did not generate the local baseline migration.");

const generatedSql = await readFile(path.join(migrationDirectory, generatedMigration), "utf8");
if (!generatedSql.includes('create table "public"."profiles"')) {
  throw new Error("Generated local baseline is missing public.profiles.");
}

const tableSchemaDirectory = path.join(repositoryRoot, "supabase", "schemas", "public", "tables");
const columnPrivilegeStatements = [];
for (const fileName of await readdir(tableSchemaDirectory)) {
  if (!fileName.endsWith(".sql")) continue;
  const sql = await readFile(path.join(tableSchemaDirectory, fileName), "utf8");
  for (const statement of sql.split(/;\s*(?:\r?\n|$)/)) {
    const normalized = statement.trim();
    if (
      /^(grant|revoke)\b/i.test(normalized) &&
      /\bon table\b/i.test(normalized) &&
      /\([^)]*\)/.test(normalized)
    ) {
      columnPrivilegeStatements.push(`${normalized};`);
    }
  }
}
if (columnPrivilegeStatements.length === 0) {
  throw new Error("No captured column-level privileges were found for local reconciliation.");
}
await writeFile(
  path.join(migrationDirectory, "99999999999995_restore_baseline_column_privileges.sql"),
  `-- Local-only reconciliation for pg-delta's documented column-grant limitation.\n${columnPrivilegeStatements.join("\n\n")}\n`,
  "utf8",
);

await copyFile(
  path.join(repositoryRoot, "supabase", "migrations", "20260821000000_harden_client_privileges.sql"),
  path.join(migrationDirectory, "99999999999996_harden_client_privileges.sql"),
);
await copyFile(
  path.join(repositoryRoot, "supabase", "migrations", "20260822000000_add_learning_audit_events.sql"),
  path.join(migrationDirectory, "99999999999997_add_learning_audit_events.sql"),
);
await copyFile(
  path.join(repositoryRoot, "supabase", "migrations", "20260823000000_restore_public_course_detail_access.sql"),
  path.join(migrationDirectory, "99999999999998_restore_public_course_detail_access.sql"),
);
console.log(`Prepared isolated Phase 0C project at ${localRoot}`);
