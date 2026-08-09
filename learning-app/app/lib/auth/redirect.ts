const defaultDestination = "/dashboard";

const allowedExactPaths = new Set([
  "/dashboard",
  "/settings",
  "/learn",
  "/certificates",
  "/teach",
  "/reset-password",
]);

function decodeSafely(value: string) {
  let decoded = value;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      return null;
    }
  }

  return decoded;
}

export function getSafeNextPath(value: string | null | undefined) {
  if (!value || value.length > 512) return defaultDestination;

  const decoded = decodeSafely(value);
  if (!decoded || decoded.includes("\\") || !decoded.startsWith("/") || decoded.startsWith("//")) {
    return defaultDestination;
  }

  try {
    const candidate = new URL(decoded, "https://learning.invalid");
    if (candidate.origin !== "https://learning.invalid") return defaultDestination;

    const { pathname } = candidate;
    const isDashboardPath = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
    const isSettingsPath = pathname === "/settings" || pathname.startsWith("/settings/");

    if (!isDashboardPath && !isSettingsPath && !allowedExactPaths.has(pathname)) {
      return defaultDestination;
    }

    return `${pathname}${candidate.search}${candidate.hash}`;
  } catch {
    return defaultDestination;
  }
}

export const defaultAuthenticatedPath = defaultDestination;
