/**
 * A deliberately small, server-side allowlist for private subscription tests.
 * Keep the configured addresses in an environment variable, never in source.
 */
export function isLearningSubscriptionTestLearnerAllowed(
  email: string | null | undefined,
  configuredEmails: string | undefined,
) {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail || !configuredEmails) return false;
  return configuredEmails
    .split(",")
    .map((allowedEmail) => allowedEmail.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalizedEmail);
}
