import { createClient } from "@/app/lib/supabase/server";

export type OwnLearningProfile = {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  avatarStoragePath: string | null;
  coverUrl: string | null;
  coverStoragePath: string | null;
  accountType: string;
};

export async function getOwnLearningProfile(): Promise<OwnLearningProfile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id || !user.email) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error("Unable to load your profile.");
  const row = data as (typeof data & {
    avatar_storage_path?: string | null;
    cover_storage_path?: string | null;
  }) | null;
  const avatarStoragePath = row?.avatar_storage_path?.trim() || null;
  const coverStoragePath = row?.cover_storage_path?.trim() || null;
  const [avatarMedia, coverMedia] = await Promise.all([
    avatarStoragePath
      ? supabase.storage.from("learning-profile-media").createSignedUrl(avatarStoragePath, 60 * 60)
      : Promise.resolve({ data: null }),
    coverStoragePath
      ? supabase.storage.from("learning-profile-media").createSignedUrl(coverStoragePath, 60 * 60)
      : Promise.resolve({ data: null }),
  ]);
  const metadataName = typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name.trim() : "";
  return {
    id: user.id,
    email: user.email,
    fullName: data?.full_name?.trim() || metadataName || "Growvelt learner",
    avatarUrl: avatarMedia.data?.signedUrl || data?.avatar_url?.trim() || null,
    avatarStoragePath,
    coverUrl: coverMedia.data?.signedUrl || null,
    coverStoragePath,
    accountType: data?.account_type || "learner",
  };
}
