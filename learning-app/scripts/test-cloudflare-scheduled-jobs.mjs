import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { LEARNING_CRON_SCHEDULES, runLearningScheduledJob } from "../cloudflare-scheduled-jobs.mjs";

const calls = [];
const logs = [];
const logger = {
  log: (...args) => logs.push(args),
  error: (...args) => logs.push(args),
};
const env = { SUPABASE_SERVICE_ROLE_KEY: "fixture-only" };
const jobs = {
  async releaseMaturedEarnings(...args) {
    calls.push(["release", ...args]);
    return { releasedCount: 2 };
  },
  async drainAdminSubmissionAlerts(...args) {
    calls.push(["alerts", ...args]);
    return { state: "checked", accepted: 0 };
  },
};

assert.deepEqual(LEARNING_CRON_SCHEDULES, {
  earningsRelease: "0 4 * * *",
  adminSubmissionAlerts: "10 4 * * *",
});
const cloudflareConfig = await readFile(new URL("../cloudflare.config.ts", import.meta.url), "utf8");
for (const schedule of Object.values(LEARNING_CRON_SCHEDULES)) {
  assert.ok(cloudflareConfig.includes(`schedule: "${schedule}"`), `Cloudflare config is missing ${schedule}`);
}
assert.deepEqual(
  await runLearningScheduledJob({ cron: LEARNING_CRON_SCHEDULES.earningsRelease }, env, jobs, logger),
  { job: "earnings_release", releasedCount: 2 },
);
assert.deepEqual(calls[0], ["release", "scheduler", null, env]);
assert.deepEqual(
  await runLearningScheduledJob({ cron: LEARNING_CRON_SCHEDULES.adminSubmissionAlerts }, env, jobs, logger),
  { job: "admin_submission_alerts", state: "checked", accepted: 0 },
);
assert.deepEqual(calls[1], ["alerts", env]);

let unknownCalled = false;
await assert.rejects(
  runLearningScheduledJob({ cron: "* * * * *" }, env, {
    ...jobs,
    async releaseMaturedEarnings() { unknownCalled = true; },
    async drainAdminSubmissionAlerts() { unknownCalled = true; },
  }, logger),
  /Scheduled Learning job failed\./,
);
assert.equal(unknownCalled, false);
assert.equal(logs.at(-1)[0], "learning.scheduled_job_failed");
console.log("PASS Cloudflare Learning cron job dispatch uses the two preserved daily schedules.");
