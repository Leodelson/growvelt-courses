import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Opt-in real PostgreSQL test. Only the known local Docker pipe/socket and the
// existing isolated Learning container are accepted; never a hosted DB URL.
const root = fileURLToPath(new URL("../", import.meta.url));
const docker = process.platform === "win32"
  ? path.join(process.env.LOCALAPPDATA ?? "", "Programs/DockerDesktop/resources/bin/docker.exe") : "docker";
const localHost = process.platform === "win32" ? "npipe:////./pipe/dockerDesktopLinuxEngine" : "unix:///var/run/docker.sock";
const container = "supabase_db_growvelt-learning-phase0c-local";
const database = "phase6_intake_" + randomUUID().replaceAll("-", "");
assert.match(database, /^phase6_intake_[0-9a-f]{32}$/);
const read = relative => readFileSync(path.join(root, relative), "utf8");
function start(args, input) {
  const child = spawn(docker, ["--host", localHost, ...args], { cwd: root, shell: false, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  let stdout = "", stderr = "";
  child.stdout.on("data", chunk => { stdout += chunk; });
  child.stderr.on("data", chunk => { stderr += chunk; });
  const done = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", code => resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() }));
  });
  child.stdin.on("error", () => undefined);
  child.stdin.end(input);
  return done;
}
async function run(args, input) {
  const result = await start(args, input);
  assert.equal(result.code, 0, result.stderr || result.stdout);
  return result.stdout;
}
const target = await run(["inspect", "--format", '{{.Name}}|{{.State.Status}}|{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}', container]);
assert.equal(target, `/${container}|running|55432`, "refuse any other database container/port");
const psqlArgs = db => ["exec", "-i", container, "psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", db];
const sql = statement => run(psqlArgs(database), statement);
let created = false;
try {
  await run(psqlArgs("postgres"), `create database ${database};`);
  created = true;
  await sql(`do $$ begin
    if not exists(select 1 from pg_roles where rolname='anon')
      or not exists(select 1 from pg_roles where rolname='authenticated')
      or not exists(select 1 from pg_roles where rolname='service_role') then
      raise exception 'Expected existing local Supabase roles'; end if;
    end $$;`);
  for (const file of ["supabase/schemas/public/tables/newsletter_subscribers.sql", "supabase/schemas/public/tables/learning_public_inquiries.sql", "supabase/schemas/public/functions/submit_public_learning_inquiry.sql", "supabase/migrations/20261106000000_add_public_intake_quotas.sql"]) await sql(read(file));

  for (const [kind, limitColumn, label] of [["newsletter", "hourly_limit", "global_hour"], ["newsletter", "daily_limit", "global_day"], ["inquiry", "email_hourly_limit", "email_hour"], ["inquiry", "email_daily_limit", "email_day"]]) {
    // Names and column identifiers above are fixed internal constants.
    await sql(`truncate public.learning_public_intake_counters, public.newsletter_subscribers, public.learning_public_inquiries;
      update public.learning_public_intake_limits set hourly_limit=100,daily_limit=100,email_hourly_limit=100,email_daily_limit=100;
      update public.learning_public_intake_limits set ${limitColumn}=1 where kind='${kind}';`);
    const insert = email => kind === "newsletter"
      ? `insert into public.newsletter_subscribers(email) values ('${email}@example.invalid');`
      : `select * from public.submit_public_learning_inquiry('contact','Example','same@example.invalid','Course help','Please help me access my Learning course materials.',null,null,null);`;
    const first = start(psqlArgs(database), `set application_name='phase6_intake_first'; set role anon; begin; ${insert("first")} select pg_sleep(4); commit;`);
    const pause = () => new Promise(resolve => setTimeout(resolve, 100));
    let held = false;
    for (let attempt=0; attempt<50; attempt++) {
      if (Number(await sql("select count(*) from pg_stat_activity where application_name='phase6_intake_first' and datname=current_database() and wait_event='PgSleep';")) > 0) { held=true; break; }
      await pause();
    }
    assert.ok(held, `${label}: first insert must be uncommitted and holding its counter locks`);
    const second = start(psqlArgs(database), `set application_name='phase6_intake_second'; set role anon; ${insert("second")}`);
    let waited = false;
    for (let attempt=0; attempt<30; attempt++) {
      if (Number(await sql("select count(*) from pg_stat_activity where application_name='phase6_intake_second' and datname=current_database() and wait_event_type='Lock';")) > 0) { waited=true; break; }
      await pause();
    }
    const [one, two] = await Promise.all([first, second]);
    assert.equal(one.code, 0, one.stderr);
    assert.notEqual(two.code, 0, `${label}: competing submission must be rejected`);
    assert.match(two.stderr, /Submission limit reached/);
    assert.ok(waited, `${label}: observe a real competing-session lock wait`);
    const table = kind === "newsletter" ? "newsletter_subscribers" : "learning_public_inquiries";
    assert.equal(Number(await sql(`select count(*) from public.${table};`)), 1);
    assert.equal(Number(await sql("select sum(accepted_count) from public.learning_public_intake_counters;")), 4, "rejected attempt rolls back every counter slot");
  }
  console.log("PASS real local PostgreSQL: four multi-session quota races waited on locks, accepted one submission, and rolled back all rejected counter increments.");
} finally {
  if (created) {
    // Only the fresh random database created by this invocation is removed.
    await run(psqlArgs("postgres"), `select pg_terminate_backend(pid) from pg_stat_activity where datname='${database}' and pid<>pg_backend_pid();`);
    await run(psqlArgs("postgres"), `drop database ${database};`);
  }
}
