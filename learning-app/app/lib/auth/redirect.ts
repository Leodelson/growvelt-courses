const defaultDestination = "/dashboard";

const allowedExactPaths = new Set([
  "/dashboard",
  "/settings",
  "/learn",
  "/certificates",
  "/teach",
  "/teach/apply",
  "/teach/application",
  "/instructor",
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

export function getExplicitSafeNextPath(value: string | null | undefined) {
  if (!value || value.length > 512) return null;

  const decoded = decodeSafely(value);
  if (!decoded || decoded.includes("\\") || !decoded.startsWith("/") || decoded.startsWith("//")) {
    return null;
  }

  try {
    const candidate = new URL(decoded, "https://learning.invalid");
    if (candidate.origin !== "https://learning.invalid") return null;

    const { pathname } = candidate;
    const isDashboardPath = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
    const isSettingsPath = pathname === "/settings" || pathname.startsWith("/settings/");
    const isInstructorPath = pathname === "/instructor" || pathname.startsWith("/instructor/");
    const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");

    if (!isDashboardPath && !isSettingsPath && !isInstructorPath && !isAdminPath && !allowedExactPaths.has(pathname)) {
      return null;
    }

    return `${pathname}${candidate.search}${candidate.hash}`;
  } catch {
    return null;
  }
}

export function getSafeNextPath(value: string | null | undefined) {
  return getExplicitSafeNextPath(value) ?? defaultDestination;
}

export const defaultAuthenticatedPath = defaultDestination;
