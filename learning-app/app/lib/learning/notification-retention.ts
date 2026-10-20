export const LOGIN_NOTIFICATION_KIND = "login";
export const LOGIN_NOTIFICATION_RETENTION_MS = 24 * 60 * 60 * 1000;

export type LearningNotificationReadState = {
  kind: string;
  read_at: string | null;
};

export function loginNotificationExpiresAt(readAt: string | null): number | null {
  if (!readAt) return null;
  const markedReadAt = Date.parse(readAt);
  return Number.isFinite(markedReadAt) ? markedReadAt + LOGIN_NOTIFICATION_RETENTION_MS : null;
}

export function isLearningNotificationVisible(
  notification: LearningNotificationReadState,
  now = Date.now(),
): boolean {
  if (notification.kind !== LOGIN_NOTIFICATION_KIND || notification.read_at === null) return true;
  const expiresAt = loginNotificationExpiresAt(notification.read_at);
  return expiresAt === null || now < expiresAt;
}
