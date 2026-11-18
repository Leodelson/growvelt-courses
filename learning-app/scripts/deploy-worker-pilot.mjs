import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = "growvelt-learning-staging-pilot";
const cf = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "cf.cmd" : "cf");

const result = spawnSync(cf, ["deploy", "--prebuilt", "--provision=false", "--worker", target], {
  cwd: root,
  env: process.env,
  shell: process.platform === "win32",
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
