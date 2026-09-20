"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabase/browser";
import { LearningIcon } from "@/app/components/learning-icon";

type MediaKind = "logo" | "cover";

const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export function OrganizationProfileMediaUploadButton({ organizationId, kind, currentPath, className }: { organizationId: number; kind: MediaKind; currentPath: string | null; className: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const label = kind === "logo" ? "Change provider logo" : "Change provider cover";

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy) return;
    if (!acceptedTypes.has(file.type) || file.size > 5 * 1024 * 1024) { setMessage("Choose a JPG, PNG, or WebP image smaller than 5 MB."); return; }

    setBusy(true);
    setMessage("");
    const extension = extensions[file.type];
    const folder = kind === "logo" ? "logos" : "covers";
    const nextPath = `${organizationId}/${folder}/${crypto.randomUUID()}.${extension}`;
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage.from("learning-provider-media").upload(nextPath, file, { cacheControl: "3600", contentType: file.type, upsert: false });
    if (uploadError) { setMessage("We couldn’t upload that image. Please try again."); setBusy(false); return; }

    try {
      const response = await fetch(`/api/instructor/organizations/${organizationId}/profile/media`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, storagePath: nextPath }) });
      if (!response.ok) throw new Error((await response.json().catch(() => null) as { code?: string } | null)?.code ?? "media_unavailable");
      if (currentPath) await supabase.storage.from("learning-provider-media").remove([currentPath]);
      router.refresh();
    } catch (error) {
      await supabase.storage.from("learning-provider-media").remove([nextPath]);
      const code = error instanceof Error ? error.message : "media_unavailable";
      setMessage(code === "owner_required" ? "Only the active organization owner can change this image." : "We couldn’t save that image. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <div className={`${className} profile-media-control`}><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" tabIndex={-1} aria-hidden="true" onChange={upload} /><button type="button" onClick={() => inputRef.current?.click()} disabled={busy} aria-busy={busy}>{busy ? <span className="profile-upload-spinner" aria-hidden="true" /> : <LearningIcon name={kind === "logo" ? "camera" : "image"} size={16} />}<span className="profile-media-label">{busy ? "Uploading…" : label}</span></button>{message && <span role="status">{message}</span>}</div>;
}
