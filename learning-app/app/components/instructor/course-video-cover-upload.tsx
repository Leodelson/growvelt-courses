"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { LearningIcon } from "@/app/components/learning-icon";
import { createClient } from "@/app/lib/supabase/browser";

const maximumUploadBytes = 1024 * 1024;
const maximumSourceBytes = 10 * 1024 * 1024;
const preferredTargetBytes = 900 * 1024;
const acceptedTypes = new Set(["image/jpeg", "image/webp"]);

function renderCover(image: HTMLImageElement, width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare this image.");
  context.drawImage(image, 0, 0, width, height);
  return canvas;
}

function exportCover(canvas: HTMLCanvasElement, type: "image/webp" | "image/jpeg", quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || !acceptedTypes.has(blob.type)) {
        reject(new Error("Your browser could not compress this image. Please choose another JPG or WebP file."));
        return;
      }
      resolve(blob);
    }, type, quality);
  });
}

async function exportSupportedCover(canvas: HTMLCanvasElement, preferredType: "image/webp" | "image/jpeg", quality: number) {
  try {
    return await exportCover(canvas, preferredType, quality);
  } catch (error) {
    if (preferredType === "image/webp") {
      return exportCover(canvas, "image/jpeg", quality);
    }
    throw error;
  }
}

async function prepareCover(file: File) {
  if (!acceptedTypes.has(file.type) || file.size > maximumSourceBytes) {
    throw new Error("Choose a JPG or WebP image no larger than 10 MB.");
  }

  const imageUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The selected image could not be read."));
      image.src = imageUrl;
    });
    const ratio = image.naturalWidth / image.naturalHeight;
    if (image.naturalWidth < 960 || image.naturalHeight < 540 || ratio < 1.65 || ratio > 1.9) {
      throw new Error("Use a landscape 16:9 image at least 960 × 540 pixels.");
    }

    const scale = Math.min(1, 1920 / image.naturalWidth, 1080 / image.naturalHeight);
    let width = Math.round(image.naturalWidth * scale);
    let height = Math.round(image.naturalHeight * scale);
    const outputType: "image/webp" | "image/jpeg" = file.type === "image/webp" ? "image/webp" : "image/jpeg";

    while (width >= 960 && height >= 540) {
      const canvas = renderCover(image, width, height);
      for (const quality of [0.86, 0.78, 0.7, 0.62, 0.54]) {
        const optimized = await exportSupportedCover(canvas, outputType, quality);
        if (optimized.size <= preferredTargetBytes || optimized.size <= maximumUploadBytes) {
          const extension = optimized.type === "image/webp" ? "webp" : "jpg";
          return new File([optimized], `${file.name.replace(/\.[^.]+$/, "") || "course-video-cover"}.${extension}`, {
            type: optimized.type,
          });
        }
      }

      width = Math.floor(width * 0.85);
      height = Math.floor(height * 0.85);
    }

    throw new Error("This image could not be reduced below 1 MB without losing too much quality. Please choose a simpler image.");
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export function CourseVideoCoverUpload({ courseId, userId }: { courseId: number; userId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("Uploading…");
  const [message, setMessage] = useState("");

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy) return;

    setBusy(true);
    setBusyLabel("Optimising image…");
    setMessage("");

    let optimizedCover: File;
    try {
      optimizedCover = await prepareCover(file);
    } catch (error) {
      setBusy(false);
      setMessage(error instanceof Error ? error.message : "Choose a valid course video cover.");
      return;
    }

    setBusyLabel("Uploading…");
    const path = `${userId}/${courseId}/course-video-cover`;
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from("learning-course-video-covers")
      .upload(path, optimizedCover, {
        cacheControl: "3600",
        contentType: optimizedCover.type,
        upsert: true,
      });

    if (uploadError) {
      if (process.env.NODE_ENV === "development") {
        console.error(
          `Course video cover upload failed — code: ${uploadError.name ?? "unknown"}; message: ${uploadError.message ?? "none"}`,
        );
        console.error("raw course video cover upload error:", uploadError);
      }
      setBusy(false);
      setBusyLabel("Uploading…");
      setMessage("We couldn’t upload this course video cover. Please try again.");
      return;
    }

    const { data, error: saveError } = await supabase.rpc(
      "set_own_instructor_course_video_cover",
      { p_course_id: courseId, p_storage_path: path },
    );

    if (saveError || !data?.[0]) {
      setBusy(false);
      setBusyLabel("Uploading…");
      setMessage("The image uploaded, but could not be attached to this draft. Please try again.");
      return;
    }

    setBusy(false);
    setBusyLabel("Uploading…");
    setMessage("Course video cover saved.");
    router.refresh();
  }

  return (
    <section className="course-video-cover-upload" aria-labelledby="course-video-cover-heading">
      <div>
        <p className="eyebrow">Course video cover</p>
        <h2 id="course-video-cover-heading">Give the course a clear visual identity.</h2>
        <p>Upload one landscape JPG or WebP for course cards and the course page. Use 16:9 at least 960 × 540 pixels; files up to 10 MB are automatically reduced before upload, with a strict 1 MB final limit.</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/webp"
        tabIndex={-1}
        aria-hidden="true"
        onChange={upload}
      />
      <button className="button button-secondary" type="button" onClick={() => inputRef.current?.click()} disabled={busy} aria-busy={busy}>
        {busy ? <span className="profile-upload-spinner" aria-hidden="true" /> : <LearningIcon name="image" size={16} />}
        {busy ? busyLabel : "Upload course video cover"}
      </button>
      {message && <p className={message === "Course video cover saved." ? "course-cover-upload-success" : "course-cover-upload-error"} role="status">{message}</p>}
    </section>
  );
}
