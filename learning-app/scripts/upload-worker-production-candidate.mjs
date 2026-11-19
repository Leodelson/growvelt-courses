import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = "growvelt-learning-production";
const cf = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "cf.cmd" : "cf");
const commit = process.env.WORKERS_CI_COMMIT_SHA?.slice(0, 8);
const message = commit ? `Learning production candidate ${commit}` : "Learning production candidate";

const result = spawnSync(
  cf,
  ["workers", "versions", "create", "--prebuilt", "--worker", target, "--message", message],
  {
    cwd: root,
    env: process.env,
    shell: process.platform === "win32",
    stdio: "inherit",
  },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
