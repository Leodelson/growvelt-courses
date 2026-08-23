import { access, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const containerName = "supabase_db_growvelt-learning-phase0c-local";

const dockerCandidates = process.platform === "win32"
  ? [
      process.env.DOCKER_PATH,
      path.join(process.env.LOCALAPPDATA ?? "", "Programs", "DockerDesktop", "resources", "bin", "docker.exe"),
      path.join(process.env.ProgramFiles ?? "", "Docker", "Docker", "resources", "bin", "docker.exe"),
    ].filter(Boolean)
  : [process.env.DOCKER_PATH, "docker"].filter(Boolean);

let docker = dockerCandidates.at(-1);
for (const candidate of dockerCandidates) {
  try {
    if (candidate === "docker") {
      docker = candidate;
      break;
    }
    await access(candidate);
    docker = candidate;
    break;
  } catch {
    // Continue to the next known installation path.
  }
}

function runDocker(args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(docker, args, {
      cwd: repositoryRoot,
      env: process.env,
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`${stderr || stdout || `Docker exited with ${code}`}`.trim()));
    });
    if (input !== undefined) child.stdin.end(input);
  });
}

const target = await runDocker([
  "inspect",
  "--format",
  "{{.Name}}|{{.State.Status}}|{{(index (index .NetworkSettings.Ports \"5432/tcp\") 0).HostPort}}",
  containerName,
]);
if (target !== `/${containerName}|running|55432`) {
  throw new Error(`Refusing unexpected database target: ${target}`);
}

const tests = [
  "supabase/tests/phase0b_catalog_assertions.sql",
  "supabase/tests/phase0c_multi_user_authorization.sql",
  "supabase/tests/phase0d_account_deletion_retention.sql",
];

for (const relativePath of tests) {
  const sql = await readFile(path.join(repositoryRoot, relativePath), "utf8");
  await runDocker(
    ["exec", "-i", containerName, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
    sql,
  );
  console.log(`PASS ${relativePath}`);
}

console.log(`PASS isolated local target ${path.join(os.tmpdir(), "growvelt-learning-phase0c-local")}`);
