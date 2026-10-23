import "server-only";
// Keep operator addresses out of public/client bundles. This supplements—not
// replaces—the existing database-backed Learning administrator check.
export const emailOperators = ["nduleonardc@gmail.com", "admin@growvelt.com"] as const;
export function isEmailOperator(user: { email?: string; email_confirmed_at?: string } | null) {
  return !!user?.email_confirmed_at && emailOperators.some(email => email === user.email?.trim().toLowerCase());
}
