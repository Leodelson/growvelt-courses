"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabase/browser";
import { LearningIcon } from "@/app/components/learning-icon";

type MediaKind = "avatar" | "cover";

const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function ProfileMediaUploadButton({
  userId,
  kind,
  currentPath,
  className,
}: {
  userId: string;
  kind: MediaKind;
  currentPath: string | null;
  className: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const label = kind === "avatar" ? "Change profile photo" : "Change Cover";

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy) return;

    if (!acceptedTypes.has(file.type) || file.size > 5 * 1024 * 1024) {
      setMessage("Choose a JPG, PNG, or WebP image smaller than 5 MB.");
      return;
    }

    setBusy(true);
    setMessage("");
    const previewUrl = URL.createObjectURL(file);
    const mediaContainer = event.currentTarget.closest(kind === "cover" ? ".profile-cover" : ".profile-avatar-preview");
    let previewImage: HTMLImageElement | null = null;
    let previousImageSource: string | null = null;
    let createdPreviewImage = false;

    if (mediaContainer instanceof HTMLElement) {
      previewImage = mediaContainer.querySelector(kind === "cover" ? ".profile-cover-image" : "img");
      if (previewImage) {
        previousImageSource = previewImage.src;
        previewImage.src = previewUrl;
      } else {
        previewImage = document.createElement("img");
        previewImage.alt = "";
        if (kind === "cover") previewImage.className = "profile-cover-image";
        mediaContainer.prepend(previewImage);
        previewImage.src = previewUrl;
        createdPreviewImage = true;
      }
    }

    const extension = extensions[file.type];
    const nextPath = `${userId}/${kind}s/${crypto.randomUUID()}.${extension}`;
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from("learning-profile-media")
      .upload(nextPath, file, { cacheControl: "3600", contentType: file.type, upsert: false });

    if (uploadError) {
      if (previewImage) {
        if (createdPreviewImage) previewImage.remove();
        else if (previousImageSource) previewImage.src = previousImageSource;
      }
      URL.revokeObjectURL(previewUrl);
      setMessage("We couldn’t upload that image. Please try again.");
      setBusy(false);
      return;
    }

    const column = kind === "avatar" ? "avatar_storage_path" : "cover_storage_path";
    const { data: savedProfile, error: saveError } = await supabase
      .from("profiles")
      .update({ [column]: nextPath })
      .eq("id", userId)
      .select(column)
      .maybeSingle();

    if (saveError || savedProfile?.[column as keyof typeof savedProfile] !== nextPath) {
      await supabase.storage.from("learning-profile-media").remove([nextPath]);
      if (previewImage) {
        if (createdPreviewImage) previewImage.remove();
        else if (previousImageSource) previewImage.src = previousImageSource;
      }
      URL.revokeObjectURL(previewUrl);
      setMessage("We couldn't save that image. Please try again.");
      setBusy(false);
      return;
    }

    if (currentPath) {
      await supabase.storage.from("learning-profile-media").remove([currentPath]);
    }

    const { data: signedMedia, error: displayError } = await supabase.storage
      .from("learning-profile-media")
      .createSignedUrl(nextPath, 60 * 60);

    if (displayError || !signedMedia?.signedUrl) {
      setMessage("Your image was saved, but could not be displayed yet. Refresh the page and try again.");
      setBusy(false);
      return;
    }

    if (previewImage) previewImage.src = signedMedia.signedUrl;

    setBusy(false);
    router.refresh();
  }

  return (
    <div className={`${className} profile-media-control`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        tabIndex={-1}
        aria-hidden="true"
        onChange={upload}
      />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} aria-busy={busy}>
        {busy ? <span className="profile-upload-spinner" aria-hidden="true" /> : <LearningIcon name={kind === "avatar" ? "camera" : "image"} size={16} />}
        <span className="profile-media-label">{busy ? "Uploading..." : label}</span>
      </button>
      {message && <span role="status">{message}</span>}
    </div>
  );
}
