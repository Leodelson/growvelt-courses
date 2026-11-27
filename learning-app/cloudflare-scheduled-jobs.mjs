export const LEARNING_CRON_SCHEDULES = {
  earningsRelease: "0 4 * * *",
  adminSubmissionAlerts: "10 4 * * *",
};

export async function runLearningScheduledJob(controller, env, jobs, logger = console) {
  try {
    if (controller.cron === LEARNING_CRON_SCHEDULES.earningsRelease) {
      const { releasedCount } = await jobs.releaseMaturedEarnings("scheduler", null, env);
      logger.log("learning.earnings_release_completed", { releasedCount });
      return { job: "earnings_release", releasedCount };
    }

    if (controller.cron === LEARNING_CRON_SCHEDULES.adminSubmissionAlerts) {
      const result = await jobs.drainAdminSubmissionAlerts(env);
      logger.log("learning.admin_submission_alerts_completed", {
        state: result.state,
        accepted: result.accepted,
      });
      return { job: "admin_submission_alerts", state: result.state, accepted: result.accepted };
    }

    throw new Error("Unexpected Learning scheduled event.");
  } catch {
    logger.error("learning.scheduled_job_failed", { cron: controller.cron });
    throw new Error("Scheduled Learning job failed.");
  }
}
