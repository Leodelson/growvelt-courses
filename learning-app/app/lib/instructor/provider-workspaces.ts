// Presentation helpers only. No backend or payment dependencies.
export function providerDate(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Date unavailable";
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

export function providerSetupChecklist(
  profile: { headline: string; description: string; contact_email: string; logo_storage_path: string | null; cover_storage_path: string | null } | null,
  verified: boolean,
) {
  return [
    { label: "Provider details saved", complete: Boolean(profile), href: "#provider-details" },
    { label: "Provider logo uploaded", complete: Boolean(profile?.logo_storage_path), href: "#provider-branding" },
    { label: "Cover image uploaded", complete: Boolean(profile?.cover_storage_path), href: "#provider-branding" },
    { label: "Growvelt Admin verification", complete: verified, href: "#provider-verification" },
  ];
}
