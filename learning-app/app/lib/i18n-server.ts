import { cookies } from "next/headers";
import { localeCookieName, normalizeLocale } from "@/app/lib/i18n";

export async function getRequestLocale() {
  return normalizeLocale((await cookies()).get(localeCookieName)?.value);
}
