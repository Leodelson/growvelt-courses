// Read-only source inventory. No network, environment secrets, database or file writes.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const tracked = new Set(execFileSync("git", ["ls-files", "--full-name"], { cwd: root, encoding: "utf8" })
  .trim().split(/\r?\n/).map(name => name.replace(/^learning-app\//, "")));
function walk(directory) {
  if (!existsSync(path.join(root, directory))) return [];
  return readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => {
    const relative = `${directory}/${entry.name}`;
    return entry.isDirectory() ? walk(relative) : [relative];
  });
}
const files = [...walk("app"), ...walk("supabase/email-templates")];
const routes = files.filter(file => /\/(page|route)\.[jt]sx?$/.test(file)).map(file => ({
  path: file.replace(/^app/, "").replace(/\/(page|route)\.[jt]sx?$/, "")
    .replace(/\/\([^/]+\)/g, "") || "/",
  type: /\/route\./.test(file) ? "handler" : "page",
  source: file,
  tracked: tracked.has(file),
})).sort((a, b) => a.path.localeCompare(b.path));
const hardCodedHosts = [];
for (const file of files.filter(file => /\.(?:[jt]sx?|html)$/.test(file))) {
  readFileSync(path.join(root, file), "utf8").split(/\r?\n/).forEach((line, index) => {
    const urls = [...line.matchAll(/https?:\/\/(?:[a-z0-9.-]+\.)?growvelt\.com[^\s"'<>{}`)]*/g)]
      .map(match => match[0]);
    if (urls.length) hardCodedHosts.push({ source: file, line: index + 1, urls: [...new Set(urls)] });
  });
}
const pwaFiles = ["public/site.webmanifest", "public/sw.js", "public/offline.html",
  ...walk("app/components/pwa"), ...walk("public/pwa")];
const projectReferencePath = path.join(root, "supabase/.temp/project-ref");
const report = {
  scope: "Learning only; source inventory, not an assertion of Careers route ownership",
  linkedSupabaseProject: existsSync(projectReferencePath) ? readFileSync(projectReferencePath, "utf8").trim() : "not linked locally",
  metadataRoutes: ["/favicon.ico", "/robots.txt", "/sitemap.xml", "/site.webmanifest"],
  routes,
  hardCodedHosts,
  pwaFiles: pwaFiles.map(source => ({ source, tracked: tracked.has(source) })),
};
if (process.argv.includes("--json")) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`Learning Supabase project: ${report.linkedSupabaseProject}`);
  console.log(`Routes (${routes.length}):`);
  for (const route of routes) console.log(`${route.path} [${route.type}${route.tracked ? "" : ", UNTRACKED"}]`);
  console.log(`Metadata/static endpoints: ${report.metadataRoutes.join(", ")}`);
  console.log("\nHard-coded Growvelt URLs:");
  for (const item of hardCodedHosts) console.log(`${item.source}:${item.line} ${item.urls.join(" ")}`);
  console.log("\nPWA files:");
  for (const item of report.pwaFiles) console.log(`${item.source} [${item.tracked ? "tracked" : "UNTRACKED"}]`);
}
