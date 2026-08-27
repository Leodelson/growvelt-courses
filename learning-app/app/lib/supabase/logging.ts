type SafeSupabaseError = { code: string; status?: number };

export function getSafeSupabaseError(error: unknown): SafeSupabaseError {
  if (!error || typeof error !== "object") return { code: "unknown" };
  const value = error as Record<string, unknown>;
  const code = typeof value.code === "string" && value.code.trim() ? value.code : "unknown";
  return typeof value.status === "number" ? { code, status: value.status } : { code };
}

export function logSupabaseError(event: string, error: unknown) {
  console.error(event, getSafeSupabaseError(error));
}
